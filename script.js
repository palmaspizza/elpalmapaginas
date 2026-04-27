import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    onValue,
    off,
    update,
    get,
    serverTimestamp,
    push,
    remove
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js";

// ===== CONFIGURACIÓN FIREBASE =====
const firebaseConfig = {
    apiKey: "AIzaSyBKPYmxIBVFPYvSKJapm2B9lyW_7SBL_fs",
    authDomain: "palmaxd-32720.firebaseapp.com",
    databaseURL: "https://palmaxd-32720-default-rtdb.firebaseio.com",
    projectId: "palmaxd-32720",
    storageBucket: "palmaxd-32720.appspot.com",
    messagingSenderId: "527831930817",
    appId: "1:527831930817:web:05fcfd4b53296068d4c140"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
console.log("Firebase v10 Modular conectado correctamente");

// ===== VARIABLES GLOBALES =====
let usuarioActual = '';
let peerConnection = null;
let localStream = null;
let llamadaActiva = false;
let timerInterval = null;
let segundosLlamada = 0;
let esLlamadaPalmitas = false;
let soyReceptorPalmitas = false;
let emisorOriginalPalmitas = null;
let palmitasUnsubscribe = null;
let directasUnsubscribe = null;

// Para llamadas directas
let miLlamadaId = null;       // ID de la llamada que YO inicié (soy emisor)
let llamadaEntranteId = null;  // ID de la llamada que recibí (soy receptor)

// Listeners activos que hay que limpiar
const activeListeners = [];

// ===== CONFIGURACIÓN WebRTC =====
const configICE = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
    ]
};

// ===== CATÁLOGO COMPLETO DE USUARIOS =====
const CATALOGO_USUARIOS = {
    'pedro':    { nombre: 'Pedro',    id: 'pedro'    },
    'maria':    { nombre: 'Maria',    id: 'maria'    },
    'palmitas': { nombre: 'Palmitas', id: 'palmitas' },
    'diego':    { nombre: 'Diego',    id: 'diego'    },
    'matias':   { nombre: 'Matias',   id: 'matias'   }
};

// ===== REGLAS DE VISIBILIDAD =====
const REGLAS_VISIBILIDAD = {
    'pedro':    ['maria', 'palmitas'],
    'maria':    ['pedro', 'palmitas'],
    'diego':    ['maria', 'pedro'],
    'matias':   ['maria', 'pedro'],
    'palmitas': ['pedro', 'maria', 'diego', 'matias']
};

// ===== INICIALIZACIÓN =====
window.addEventListener('load', () => {
    document.getElementById('input-username').focus();
});

// ===== HELPERS FIREBASE PALMITAS =====
async function escribirSenalPalmitas(emisorId, tipo, data) {
    const dbRef = ref(database, 'llamadas_palmitas/' + emisorId);
    await set(dbRef, {
        emisor: emisorId,
        tipo: tipo,
        data: data || {},
        timestamp: serverTimestamp(),
        activa: tipo !== 'colgada',
        receptores: {
            diego:  { colgo: false },
            matias: { colgo: false }
        }
    });
}

async function marcarReceptorColgo(emisorId, receptorId) {
    const dbRef = ref(database, 'llamadas_palmitas/' + emisorId + '/receptores/' + receptorId);
    await set(dbRef, { colgo: true, timestamp: serverTimestamp() });
}

async function desactivarLlamadaPalmitas(emisorId) {
    await update(ref(database, 'llamadas_palmitas/' + emisorId), {
        activa: false
    });
}

// ===== ESCUCHAR LLAMADAS PALMITAS =====
function escucharLlamadasPalmitas() {
    const dbRef = ref(database, 'llamadas_palmitas');
    const handler = onValue(dbRef, (snapshot) => {
        const llamadas = snapshot.val();
        if (!llamadas) return;

        Object.keys(llamadas).forEach(emisorId => {
            const llamada = llamadas[emisorId];
            if (emisorId === usuarioActual) return;

            if (llamada.activa && !llamadaActiva) {
                emisorOriginalPalmitas = emisorId;
                soyReceptorPalmitas = true;
                esLlamadaPalmitas = true;

                const nombreEmisor = CATALOGO_USUARIOS[emisorId]?.nombre || emisorId;
                mostrarNotificacionEntrante(`${nombreEmisor} (vía Palmitas)`, 'Llamada entrante compartida...');

            } else if (!llamada.activa && llamadaActiva && esLlamadaPalmitas) {
                if (emisorOriginalPalmitas === emisorId) {
                    forzarDesconexion("El emisor colgó la llamada.");
                }
            }
        });
    });
    palmitasUnsubscribe = { dbRef, handler };
}

// ===== ESCUCHAR LLAMADAS DIRECTAS ENTRANTES =====
function escucharLlamadasDirectas() {
    const dbRef = ref(database, 'llamadas_directas');
    const handler = onValue(dbRef, (snapshot) => {
        const llamadas = snapshot.val();
        if (!llamadas) return;

        Object.keys(llamadas).forEach(id => {
            const llamada = llamadas[id];

            // Solo si va para mí
            if (llamada.para !== usuarioActual) return;
            // No la inicié yo
            if (llamada.de === usuarioActual) return;
            // Estado es "llamando"
            if (llamada.estado !== 'llamando') return;
            // No estoy ya en otra llamada
            if (llamadaActiva) return;
            // No mostrar la misma notificación dos veces
            if (llamadaEntranteId === id) return;

            // ===== FILTRO CRÍTICO: Solo llamadas de los últimos 30 segundos =====
            const ahora = Date.now();
            const timestampLlamada = llamada.timestamp;
            
            // Si el timestamp es un objeto de Firebase (serverTimestamp), 
            // puede tardar en sincronizarse. Usamos Date.now() como fallback.
            let tiempoLlamada;
            if (typeof timestampLlamada === 'number') {
                tiempoLlamada = timestampLlamada;
            } else if (timestampLlamada && timestampLlamada.timestamp) {
                tiempoLlamada = timestampLlamada.timestamp;
            } else {
                // Si no hay timestamp válido, asumimos que es vieja y la ignoramos
                // a menos que sea una llamada creada en esta sesión
                tiempoLlamada = 0;
            }
            
            // Si la llamada tiene más de 30 segundos, ignorarla (datos residuales)
            if (ahora - tiempoLlamada > 30000) {
                return;
            }

            llamadaEntranteId = id;
            esLlamadaPalmitas = false;
            soyReceptorPalmitas = false;

            const nombreEmisor = CATALOGO_USUARIOS[llamada.de]?.nombre || llamada.de;
            mostrarNotificacionEntrante(nombreEmisor, 'Te está llamando...');
        });
    });
    directasUnsubscribe = { dbRef, handler };
}

// ===== INGRESAR =====
window.ingresar = function () {
    const username = document.getElementById('input-username').value.trim().toLowerCase();
    if (!username) { alert('Por favor, escribe tu nombre'); return; }

    usuarioActual = username;
    document.getElementById('pantalla-ingreso').style.display = 'none';
    document.getElementById('pantalla-directorio').style.display = 'flex';

    if (usuarioActual === 'diego' || usuarioActual === 'matias') {
        escucharLlamadasPalmitas();
    }
    escucharLlamadasDirectas();
    renderizarContactos();
};

// ===== CERRAR SESIÓN =====
window.cerrarSesion = function () {
    if (llamadaActiva) colgarLlamada();

    if (palmitasUnsubscribe) {
        off(palmitasUnsubscribe.dbRef, 'value', palmitasUnsubscribe.handler);
        palmitasUnsubscribe = null;
    }
    if (directasUnsubscribe) {
        off(directasUnsubscribe.dbRef, 'value', directasUnsubscribe.handler);
        directasUnsubscribe = null;
    }
    activeListeners.forEach(({ dbRef, handler }) => off(dbRef, 'value', handler));
    activeListeners.length = 0;

    usuarioActual = '';
    resetearEstadoLlamada();

    document.getElementById('pantalla-directorio').style.display = 'none';
    document.getElementById('pantalla-ingreso').style.display = 'flex';
    document.getElementById('input-username').value = '';
};

// ===== RENDERIZAR CONTACTOS =====
function obtenerContactosVisibles() {
    const visibles = REGLAS_VISIBILIDAD[usuarioActual] || [];
    return visibles.map(id => ({
        id,
        nombre: CATALOGO_USUARIOS[id]?.nombre || id,
        estado: 'online'
    }));
}

window.renderizarContactos = function () {
    const contenedor = document.getElementById('lista-contactos');
    contenedor.innerHTML = '';

    const contactosVisibles = obtenerContactosVisibles();
    const infoContainer = document.getElementById('info-palmitas-container');
    const vePalmitas = contactosVisibles.some(c => c.id === 'palmitas');

    if (vePalmitas && usuarioActual !== 'palmitas') {
        infoContainer.innerHTML = `<div class="info-palmitas">📢 Llamar a <strong>Palmitas</strong> conectará automáticamente con Diego y Matias</div>`;
    } else if (usuarioActual === 'diego' || usuarioActual === 'matias') {
        infoContainer.innerHTML = `<div class="info-palmitas">📡 Escuchando llamadas a Palmitas...</div>`;
    } else {
        infoContainer.innerHTML = '';
    }

    contactosVisibles.forEach(contacto => {
        const esPalmitas = contacto.id === 'palmitas';
        const div = document.createElement('div');
        div.className = 'tarjeta-contacto';
        div.innerHTML = `
            <div class="avatar-contacto" style="${esPalmitas ? 'background-color:#ff6b6b;' : ''}">${contacto.nombre.charAt(0)}</div>
            <div class="info-contacto">
                <div class="nombre-contacto">${contacto.nombre}${esPalmitas ? '<span class="badge-palmitas">COMPARTIDO</span>' : ''}</div>
                <div class="estado-contacto">🟢 En línea</div>
            </div>
            <button class="boton-llamar-directo" onclick="iniciarLlamada('${contacto.id}')" title="Llamar a ${contacto.nombre}">📞</button>
        `;
        contenedor.appendChild(div);
    });
};

// ===== INICIAR LLAMADA (EMISOR) =====
window.iniciarLlamada = async function (contactoId) {
    if (llamadaActiva) return;

    const contacto = CATALOGO_USUARIOS[contactoId];
    const nombreContacto = contacto ? contacto.nombre : contactoId;

    // ===== PALMITAS =====
    if (contactoId === 'palmitas') {
        esLlamadaPalmitas = true;
        emisorOriginalPalmitas = usuarioActual;

        await escribirSenalPalmitas(usuarioActual, 'oferta', {
            emisor: usuarioActual,
            mensaje: 'llamada_compartida'
        });

        mostrarPantallaLlamada(nombreContacto + ' (Compartida)', 'Conectando con Diego y Matias...');

        // Simulación: no hay WebRTC real para Palmitas en esta versión
        return;
    }

    // ===== LLAMADA DIRECTA P2P =====
    esLlamadaPalmitas = false;

    // Crear ID único
    const llamadaId = `${usuarioActual}_${contactoId}_${Date.now()}`;
    miLlamadaId = llamadaId;

    mostrarPantallaLlamada(nombreContacto, 'Llamando...');

    try {
        // 1. Obtener audio local
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // 2. Crear PeerConnection
        peerConnection = new RTCPeerConnection(configICE);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        // 3. Reproducir audio remoto cuando llegue
        peerConnection.ontrack = (event) => {
            const audio = document.getElementById('audio-remoto') || crearElementoAudio();
            audio.srcObject = event.streams[0];
            audio.play().catch(console.error);
        };

        // 4. Enviar candidatos ICE al receptor
        peerConnection.onicecandidate = async (event) => {
            if (!event.candidate) return;
            const iceRef = push(ref(database, `llamadas_directas/${llamadaId}/ice/${usuarioActual}`));
            await set(iceRef, {
                candidate:     event.candidate.candidate,
                sdpMid:        event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex
            });
        };

        // 5. Crear oferta SDP
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // 6. Publicar la llamada completa (con oferta) en Firebase de una vez
        await set(ref(database, `llamadas_directas/${llamadaId}`), {
            de:     usuarioActual,
            para:   contactoId,
            estado: 'llamando',
            timestamp: serverTimestamp(),
            oferta: { type: offer.type, sdp: offer.sdp }
        });

        // 7. Escuchar candidatos ICE del receptor
        const iceReceptorRef = ref(database, `llamadas_directas/${llamadaId}/ice/${contactoId}`);
        const iceHandler = onValue(iceReceptorRef, (snap) => {
            const candidates = snap.val();
            if (!candidates || !peerConnection) return;
            Object.values(candidates).forEach(c => {
                if (c?.candidate) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(c)).catch(console.error);
                }
            });
        });
        activeListeners.push({ dbRef: iceReceptorRef, handler: iceHandler });

        // 8. Escuchar respuesta (answer) del receptor
        const respuestaRef = ref(database, `llamadas_directas/${llamadaId}/respuesta`);
        const respuestaHandler = onValue(respuestaRef, async (snap) => {
            const respuesta = snap.val();
            if (!respuesta?.sdp) return;
            if (!peerConnection || peerConnection.remoteDescription) return;

            await peerConnection.setRemoteDescription(new RTCSessionDescription(respuesta));
            llamadaActiva = true;
            // 9b. Escuchar si el receptor cuelga o rechaza
const estadoRef = ref(database, `llamadas_directas/${llamadaId}/estado`);
const estadoHandler = onValue(estadoRef, (snap) => {
    const estado = snap.val();
    if (estado === 'colgada' && llamadaActiva) {
        forzarDesconexion('El otro usuario colgó.');
    }
});
activeListeners.push({ dbRef: estadoRef, handler: estadoHandler });
            iniciarTimer();
            mostrarEstadoConectado();
            mostrarControlesDuranteLlamada();
        });
        activeListeners.push({ dbRef: respuestaRef, handler: respuestaHandler });

        // 9. Escuchar si el receptor cuelga o rechaza
        const estadoRef = ref(database, `llamadas_directas/${llamadaId}/estado`);
        const estadoHandler = onValue(estadoRef, (snap) => {
            const estado = snap.val();
            if (estado === 'rechazada') {
                forzarDesconexion('Llamada rechazada.');
            } else if (estado === 'colgada' && llamadaActiva) {
                forzarDesconexion('El otro usuario colgó.');
            }
        });
        activeListeners.push({ dbRef: estadoRef, handler: estadoHandler });

    } catch (error) {
        console.error('Error iniciando llamada:', error);
        document.getElementById('estado-llamada').textContent = 'Error al acceder al micrófono ❌';
        document.getElementById('estado-llamada').style.color = '#ff3333';
    }
};

// ===== ACEPTAR LLAMADA ENTRANTE (NOTIFICACIÓN) =====
window.aceptarLlamadaEntrante = async function () {
    document.getElementById('notificacion-entrante').style.display = 'none';

    if (esLlamadaPalmitas) {
        // Palmitas no tiene WebRTC real, solo mostrar pantalla
        const nombre = (CATALOGO_USUARIOS[emisorOriginalPalmitas]?.nombre || emisorOriginalPalmitas) + ' (vía Palmitas)';
        mostrarPantallaLlamada(nombre, 'Escuchando...');
        llamadaActiva = true;
        iniciarTimer();
        mostrarControlesDuranteLlamada();
        return;
    }

    if (!llamadaEntranteId) return;

    // Leer datos frescos de Firebase
    const snap = await get(ref(database, `llamadas_directas/${llamadaEntranteId}`));
    const datos = snap.val();
    if (!datos || !datos.oferta) {
        alert('No se pudo obtener los datos de la llamada.');
        return;
    }

    const emisorId = datos.de;
    const nombreEmisor = CATALOGO_USUARIOS[emisorId]?.nombre || emisorId;
    mostrarPantallaLlamada(nombreEmisor, 'Conectando...');

    try {
        // 1. Obtener audio local
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // 2. Crear PeerConnection
        peerConnection = new RTCPeerConnection(configICE);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        // 3. Reproducir audio remoto
        peerConnection.ontrack = (event) => {
            const audio = document.getElementById('audio-remoto') || crearElementoAudio();
            audio.srcObject = event.streams[0];
            audio.play().catch(console.error);
        };

        // 4. Enviar mis candidatos ICE al emisor
        peerConnection.onicecandidate = async (event) => {
            if (!event.candidate) return;
            const iceRef = push(ref(database, `llamadas_directas/${llamadaEntranteId}/ice/${usuarioActual}`));
            await set(iceRef, {
                candidate:     event.candidate.candidate,
                sdpMid:        event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex
            });
        };

        // 5. Aplicar oferta del emisor
        await peerConnection.setRemoteDescription(new RTCSessionDescription(datos.oferta));

        // 6. Crear y enviar answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await set(ref(database, `llamadas_directas/${llamadaEntranteId}/respuesta`), {
            type: answer.type,
            sdp:  answer.sdp
        });
        await set(ref(database, `llamadas_directas/${llamadaEntranteId}/estado`), 'aceptada');

        // 7. Escuchar candidatos ICE del emisor
        const iceEmisorRef = ref(database, `llamadas_directas/${llamadaEntranteId}/ice/${emisorId}`);
        const iceHandler = onValue(iceEmisorRef, (snap) => {
            const candidates = snap.val();
            if (!candidates || !peerConnection) return;
            Object.values(candidates).forEach(c => {
                if (c?.candidate) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(c)).catch(console.error);
                }
            });
        });
        activeListeners.push({ dbRef: iceEmisorRef, handler: iceHandler });

        // 8. Escuchar si el emisor cuelga
        const estadoRef = ref(database, `llamadas_directas/${llamadaEntranteId}/estado`);
        const estadoHandler = onValue(estadoRef, (snap) => {
            const estado = snap.val();
            if (estado === 'colgada' && llamadaActiva) {
                forzarDesconexion('El otro usuario colgó.');
            }
        });
        activeListeners.push({ dbRef: estadoRef, handler: estadoHandler });

        llamadaActiva = true;
        // 8b. Escuchar si el emisor cuelga
const estadoRef = ref(database, `llamadas_directas/${llamadaEntranteId}/estado`);
const estadoHandler = onValue(estadoRef, (snap) => {
    const estado = snap.val();
    if (estado === 'colgada' && llamadaActiva) {
        forzarDesconexion('El otro usuario colgó.');
    }
});
activeListeners.push({ dbRef: estadoRef, handler: estadoHandler });
        iniciarTimer();
        mostrarEstadoConectado();
        mostrarControlesDuranteLlamada();

    } catch (error) {
        console.error('Error aceptando llamada:', error);
        document.getElementById('estado-llamada').textContent = 'Error al conectar ❌';
        document.getElementById('estado-llamada').style.color = '#ff3333';
    }
};

// ===== RECHAZAR LLAMADA =====
window.rechazarLlamada = async function () {
    document.getElementById('notificacion-entrante').style.display = 'none';

    if (llamadaEntranteId) {
        await set(ref(database, 'llamadas_directas/' + llamadaEntranteId + '/estado'), 'rechazada');
        // Borrar después de 5 segundos para que el emisor se entere
        setTimeout(() => {
            remove(ref(database, 'llamadas_directas/' + llamadaEntranteId)).catch(console.error);
        }, 5000);
        llamadaEntranteId = null;
    }
};

// ===== COLGAR LLAMADA =====
window.colgarLlamada = async function () {
    // Palmitas: soy receptor
    if (esLlamadaPalmitas && soyReceptorPalmitas && emisorOriginalPalmitas) {
        await marcarReceptorColgo(emisorOriginalPalmitas, usuarioActual);
        const snap = await get(ref(database, `llamadas_palmitas/${emisorOriginalPalmitas}/receptores`));
        const receptores = snap.val() || {};
        if (receptores.diego?.colgo && receptores.matias?.colgo) {
            await desactivarLlamadaPalmitas(emisorOriginalPalmitas);
        }
    }

    // Palmitas: soy emisor
    if (esLlamadaPalmitas && emisorOriginalPalmitas === usuarioActual) {
        await escribirSenalPalmitas(usuarioActual, 'colgada', {});
    }

    // Llamada directa: soy emisor
    // Llamada directa: soy emisor → escribo en MI nodo para que el receptor se entere
if (!esLlamadaPalmitas && miLlamadaId) {
    await set(ref(database, `llamadas_directas/${miLlamadaId}/estado`), 'colgada');
}

// Llamada directa: soy receptor → escribo en el nodo del emisor para que él se entere
if (!esLlamadaPalmitas && llamadaEntranteId) {
    await set(ref(database, `llamadas_directas/${llamadaEntranteId}/estado`), 'colgada');
}

    limpiarLlamada();
};

// ===== FORZAR DESCONEXIÓN =====
function forzarDesconexion(mensaje) {
    if (llamadaActiva) {
        // Solo mostrar alerta si no fue el usuario quien colgó (evita doble alerta)
        const btnCortar = document.querySelector('.boton-cortar:active');
        if (!btnCortar) {
            alert(mensaje);
        }
        limpiarLlamada();
    }
}

// ===== LIMPIAR LLAMADA =====
function limpiarLlamada() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }

    const audioEl = document.getElementById('audio-remoto');
    if (audioEl) audioEl.remove();

    // Limpiar listeners activos
    activeListeners.forEach(({ dbRef, handler }) => off(dbRef, 'value', handler));
    activeListeners.length = 0;

    // ===== BORRAR LLAMADA DE FIREBASE AL COLGAR =====
    if (miLlamadaId) {
        remove(ref(database, 'llamadas_directas/' + miLlamadaId)).catch(console.error);
    }
    if (llamadaEntranteId) {
        remove(ref(database, 'llamadas_directas/' + llamaEntranteId)).catch(console.error);
    }

    resetearEstadoLlamada();
// Borrar datos de Firebase después de 3 segundos (tiempo suficiente para que el otro se entere)
setTimeout(() => {
    if (miLlamadaId) {
        remove(ref(database, `llamadas_directas/${miLlamadaId}`)).catch(()=>{});
    }
    if (llamadaEntranteId) {
        remove(ref(database, `llamadas_directas/${llamadaEntranteId}`)).catch(()=>{});
    }
}, 1000);
    document.getElementById('pantalla-llamada').style.display = 'none';
    document.getElementById('pantalla-directorio').style.display = 'flex';
}

function resetearEstadoLlamada() {
    llamadaActiva = false;
    detenerTimer();
    segundosLlamada = 0;
    esLlamadaPalmitas = false;
    soyReceptorPalmitas = false;
    emisorOriginalPalmitas = null;
    miLlamadaId = null;
    llamadaEntranteId = null;

    const estadoEl = document.getElementById('estado-llamada');
    const timerEl  = document.getElementById('timer-llamada');
    if (estadoEl) { estadoEl.textContent = 'Conectando...'; estadoEl.style.color = '#ffd700'; }
    if (timerEl)  { timerEl.textContent = '00:00'; }
}

// ===== UI =====
function crearElementoAudio() {
    const audio = document.createElement('audio');
    audio.id = 'audio-remoto';
    audio.autoplay = true;
    document.body.appendChild(audio);
    return audio;
}

function mostrarPantallaLlamada(nombre, estado) {
    document.getElementById('pantalla-directorio').style.display = 'none';
    document.getElementById('pantalla-llamada').style.display = 'flex';

    document.getElementById('nombre-llamada').textContent = nombre;
    document.getElementById('avatar-llamada').textContent = nombre.charAt(0).toUpperCase();
    document.getElementById('estado-llamada').textContent = estado;
    document.getElementById('timer-llamada').textContent = '00:00';

    // Mostrar botón de colgar mientras llama
    document.getElementById('controles-llamada').innerHTML = `
        <button class="boton-control boton-cortar" onclick="colgarLlamada()" title="Cortar">📵</button>
    `;
}

function mostrarNotificacionEntrante(nombre, texto) {
    document.getElementById('nombre-entrante').textContent = nombre;
    document.querySelector('#notificacion-entrante .texto-entrante').textContent = texto;
    document.getElementById('notificacion-entrante').style.display = 'flex';
}

function mostrarEstadoConectado() {
    const el = document.getElementById('estado-llamada');
    if (el) { el.textContent = '✅ Conectado'; el.style.color = '#00ff88'; }
}

function mostrarControlesDuranteLlamada() {
    document.getElementById('controles-llamada').innerHTML = `
        <button class="boton-control boton-silencio"  id="btn-silencio"  onclick="toggleSilencio(this)"  title="Silencio">🎤</button>
        <button class="boton-control boton-cortar"                        onclick="colgarLlamada()"       title="Colgar">📵</button>
        <button class="boton-control boton-altavoz"   id="btn-altavoz"   onclick="toggleAltavoz(this)"   title="Altavoz">🔊</button>
    `;
}

// ===== TIMER =====
function iniciarTimer() {
    segundosLlamada = 0;
    timerInterval = setInterval(() => {
        segundosLlamada++;
        const mins = Math.floor(segundosLlamada / 60).toString().padStart(2, '0');
        const secs = (segundosLlamada % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('timer-llamada');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

function detenerTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ===== CONTROLES DE AUDIO =====
window.toggleSilencio = function (btn) {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    btn.textContent = track.enabled ? '🎤' : '🔇';
    btn.style.backgroundColor = track.enabled ? '#666' : '#ff4444';
};

window.toggleAltavoz = function (btn) {
    const audio = document.getElementById('audio-remoto');
    if (!audio) return;
    // En móvil esto activa el altavoz si la API lo soporta
    btn.style.backgroundColor = btn.dataset.activo === '1' ? '#666' : '#ffd700';
    btn.style.color           = btn.dataset.activo === '1' ? '#fff' : '#000';
    btn.dataset.activo        = btn.dataset.activo === '1' ? '0' : '1';
};
