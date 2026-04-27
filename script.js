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
    push
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

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
console.log("Firebase v10 Modular conectado correctamente");

// ===== VARIABLES GLOBALES =====
let usuarioActual = '';
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let llamadaActiva = false;
let timerInterval = null;
let segundosLlamada = 0;
let contactoActual = null;
let esLlamadaPalmitas = false;
let soyReceptorPalmitas = false;
let emisorOriginalPalmitas = null;
let palmitasUnsubscribe = null;
let directasUnsubscribe = null;
let receptoresColgaron = { diego: false, matias: false };
let llamadaDirectaId = null;
let datosLlamadaDirecta = null;
let miLlamadaId = null; // ID de la llamada que YO inicié

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
    'pedro': { nombre: 'Pedro', id: 'pedro' },
    'maria': { nombre: 'Maria', id: 'maria' },
    'palmitas': { nombre: 'Palmitas', id: 'palmitas' },
    'diego': { nombre: 'Diego', id: 'diego' },
    'matias': { nombre: 'Matias', id: 'matias' }
};

// ===== REGLAS DE VISIBILIDAD =====
const REGLAS_VISIBILIDAD = {
    'pedro': ['maria', 'palmitas'],
    'maria': ['pedro', 'palmitas'],
    'diego': ['maria', 'pedro'],
    'matias': ['maria', 'pedro'],
    'palmitas': ['pedro', 'maria', 'diego', 'matias']
};

// ===== INICIALIZACIÓN =====
window.addEventListener('load', () => {
    document.getElementById('input-username').focus();
});

// ===== FIREBASE: ESCRIBIR SEÑAL PALMITAS =====
async function escribirSenalPalmitas(emisorId, tipo, data) {
    const dbRef = ref(database, 'llamadas_palmitas/' + emisorId);
    await set(dbRef, {
        emisor: emisorId,
        tipo: tipo,
        data: data || {},
        timestamp: serverTimestamp(),
        activa: tipo !== 'colgada',
        receptores: {
            diego: { colgo: false },
            matias: { colgo: false }
        }
    });
}

// ===== FIREBASE: ACTUALIZAR RECEPTOR QUE COLGÓ =====
async function marcarReceptorColgo(emisorId, receptorId) {
    const dbRef = ref(database, 'llamadas_palmitas/' + emisorId + '/receptores/' + receptorId);
    await set(dbRef, { colgo: true, timestamp: serverTimestamp() });
}

// ===== FIREBASE: DESACTIVAR LLAMADA PALMITAS =====
async function desactivarLlamadaPalmitas(emisorId) {
    const dbRef = ref(database, 'llamadas_palmitas/' + emisorId);
    await update(dbRef, { 
        activa: false,
        motivo: 'ambos_receptores_colgaron'
    });
}

// ===== FIREBASE: ESCUCHAR LLAMADAS PALMITAS =====
function escucharLlamadasPalmitas() {
    const dbRef = ref(database, 'llamadas_palmitas');

    palmitasUnsubscribe = onValue(dbRef, (snapshot) => {
        const llamadas = snapshot.val();
        if (!llamadas) return;

        Object.keys(llamadas).forEach(emisorId => {
            const llamada = llamadas[emisorId];

            if (usuarioActual !== 'diego' && usuarioActual !== 'matias') return;
            if (emisorId === usuarioActual) return;

            if (llamada.activa && !llamadaActiva) {
                emisorOriginalPalmitas = emisorId;
                soyReceptorPalmitas = true;
                esLlamadaPalmitas = true;
                receptoresColgaron = { diego: false, matias: false };

                const nombreEmisor = CATALOGO_USUARIOS[emisorId]?.nombre || emisorId;

                mostrarNotificacionEntrante(
                    `${nombreEmisor} (vía Palmitas)`,
                    'Llamada entrante compartida...'
                );
            } else if (!llamada.activa && llamadaActiva && esLlamadaPalmitas) {
                if (emisorOriginalPalmitas === emisorId) {
                    forzarDesconexion("El emisor original colgó la llamada");
                }
            }
        });
    });
}

// ===== FIREBASE: ESCUCHAR LLAMADAS DIRECTAS =====
function escucharLlamadasDirectas() {
    const dbRef = ref(database, 'llamadas_directas');

    directasUnsubscribe = onValue(dbRef, (snapshot) => {
        const llamadas = snapshot.val();
        if (!llamadas) return;

        Object.keys(llamadas).forEach(id => {
            const llamada = llamadas[id];

            // Solo reaccionar si la llamada es PARA mí
            if (llamada.para !== usuarioActual) return;
            if (llamadaActiva) return;
            if (llamada.estado !== 'llamando') return;
            // No reaccionar si yo fui quien la creó
            if (llamada.de === usuarioActual) return;

            // Guardar datos
            llamadaDirectaId = id;
            datosLlamadaDirecta = llamada;
            esLlamadaPalmitas = false;
            soyReceptorPalmitas = false;

            // Mostrar notificación de llamada entrante
            const nombreEmisor = CATALOGO_USUARIOS[llamada.de]?.nombre || llamada.de;
            mostrarNotificacionEntrante(nombreEmisor, 'Te está llamando...');
        });
    });
}

// ===== NAVEGACIÓN =====
window.ingresar = function() {
    const username = document.getElementById('input-username').value.trim().toLowerCase();
    if (!username) {
        alert('Por favor, escribe tu nombre');
        return;
    }

    usuarioActual = username;

    document.getElementById('pantalla-ingreso').style.display = 'none';
    document.getElementById('pantalla-directorio').style.display = 'flex';

    if (usuarioActual === 'diego' || usuarioActual === 'matias') {
        escucharLlamadasPalmitas();
    }

    // TODOS escuchan llamadas directas
    escucharLlamadasDirectas();

    renderizarContactos();
};

window.cerrarSesion = function() {
    if (llamadaActiva) colgarLlamada();

    if (palmitasUnsubscribe) {
        const dbRef = ref(database, 'llamadas_palmitas');
        off(dbRef, 'value', palmitasUnsubscribe);
        palmitasUnsubscribe = null;
    }

    if (directasUnsubscribe) {
        const dbRef = ref(database, 'llamadas_directas');
        off(dbRef, 'value', directasUnsubscribe);
        directasUnsubscribe = null;
    }

    usuarioActual = '';
    esLlamadaPalmitas = false;
    soyReceptorPalmitas = false;
    emisorOriginalPalmitas = null;
    receptoresColgaron = { diego: false, matias: false };
    llamadaDirectaId = null;
    datosLlamadaDirecta = null;
    miLlamadaId = null;

    document.getElementById('pantalla-directorio').style.display = 'none';
    document.getElementById('pantalla-ingreso').style.display = 'flex';
    document.getElementById('input-username').value = '';
};

// ===== OBTENER CONTACTOS VISIBLES =====
function obtenerContactosVisibles() {
    const visibles = REGLAS_VISIBILIDAD[usuarioActual] || [];
    return visibles.map(id => ({
        id: id,
        nombre: CATALOGO_USUARIOS[id]?.nombre || id,
        estado: 'online'
    }));
}

// ===== DIRECTORIO =====
window.renderizarContactos = function() {
    const contenedor = document.getElementById('lista-contactos');
    contenedor.innerHTML = '';

    const contactosVisibles = obtenerContactosVisibles();

    const infoContainer = document.getElementById('info-palmitas-container');
    const vePalmitas = contactosVisibles.some(c => c.id === 'palmitas');

    if (vePalmitas && usuarioActual !== 'palmitas') {
        infoContainer.innerHTML = `
            <div class="info-palmitas">
                📢 Llamar a <strong>Palmitas</strong> conectará automáticamente con Diego y Matias
            </div>
        `;
    } else if (usuarioActual === 'diego' || usuarioActual === 'matias') {
        infoContainer.innerHTML = `
            <div class="info-palmitas">
                📡 Escuchando llamadas a Palmitas... 
            </div>
        `;
    } else {
        infoContainer.innerHTML = '';
    }

    contactosVisibles.forEach(contacto => {
        const esPalmitas = contacto.id === 'palmitas';
        const div = document.createElement('div');
        div.className = 'tarjeta-contacto';

        let badge = '';
        if (esPalmitas) {
            badge = '<span class="badge-palmitas">COMPARTIDO</span>';
        }

        div.innerHTML = `
            <div class="avatar-contacto" style="${esPalmitas ? 'background-color: #ff6b6b;' : ''}">${contacto.nombre.charAt(0)}</div>
            <div class="info-contacto">
                <div class="nombre-contacto">${contacto.nombre} ${badge}</div>
                <div class="estado-contacto ${contacto.estado}">${contacto.estado === 'online' ? '🟢 En línea' : '⚫ Desconectado'}</div>
            </div>
            <button class="boton-llamar-directo" onclick="iniciarLlamada('${contacto.id}')" title="Llamar a ${contacto.nombre}">📞</button>
        `;
        contenedor.appendChild(div);
    });
};

// ===== WEBRTC - INICIAR LLAMADA =====
window.iniciarLlamada = async function(contactoId) {
    contactoActual = contactoId;
    const contacto = CATALOGO_USUARIOS[contactoId];
    const nombreContacto = contacto ? contacto.nombre : contactoId;

    // VARIABLE llamadaId DECLARADA AQUÍ ARRIBA para todo el scope de la función
    let llamadaId = null;

    if (contactoId === 'palmitas') {
        esLlamadaPalmitas = true;
        emisorOriginalPalmitas = usuarioActual;
        receptoresColgaron = { diego: false, matias: false };

        await escribirSenalPalmitas(usuarioActual, 'oferta', {
            emisor: usuarioActual,
            para: 'palmitas',
            mensaje: 'llamada_compartida'
        });

        mostrarPantallaLlamada(nombreContacto + ' (Compartida)', 'Conectando con Diego y Matias...');
    } else {
        // ===== LLAMADA DIRECTA P2P VÍA FIREBASE =====
        esLlamadaPalmitas = false;
        mostrarPantallaLlamada(nombreContacto, 'Llamando...');

        // Crear ID único para esta llamada
        llamadaId = usuarioActual + '_' + contactoId + '_' + Date.now();
        miLlamadaId = llamadaId;

        // Guardar en Firebase que estamos llamando
        const dbRef = ref(database, 'llamadas_directas/' + llamadaId);
        await set(dbRef, {
            de: usuarioActual,
            para: contactoId,
            estado: 'llamando',
            timestamp: serverTimestamp()
        });

        // Escuchar respuesta del destinatario
        const respuestaRef = ref(database, 'llamadas_directas/' + llamadaId + '/respuesta');
        onValue(respuestaRef, async (snapshot) => {
            const respuesta = snapshot.val();
            if (!respuesta || !respuesta.sdp) return;
            if (peerConnection && peerConnection.remoteDescription) return;

            await peerConnection.setRemoteDescription(new RTCSessionDescription(respuesta));

            document.getElementById('estado-llamada').textContent = 'Conectado ✅';
            document.getElementById('estado-llamada').style.color = '#00ff88';
            if (!llamadaActiva) {
                iniciarTimer();
                llamadaActiva = true;
                mostrarControlesDuranteLlamada();
            }
        });

        // Escuchar candidatos ICE del destinatario
        const iceEntranteRef = ref(database, 'llamadas_directas/' + llamadaId + '/ice_candidates/' + contactoId);
        onValue(iceEntranteRef, (snap) => {
            const candidates = snap.val();
            if (!candidates || !peerConnection) return;
            Object.values(candidates).forEach(cand => {
                if (cand && cand.candidate) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
                }
            });
        });
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        peerConnection = new RTCPeerConnection(configICE);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.autoplay = true;
            audio.play().catch(e => console.log('Audio play error:', e));
        };

        // ===== ENVIAR CANDIDATOS ICE =====
        // ESTO VA AQUÍ, DESPUÉS de crear peerConnection, NO afuera
        peerConnection.onicecandidate = async (event) => {
            if (!event.candidate) return;

            const iceRef = ref(database, 'llamadas_directas/' + llamadaId + '/ice_candidates/' + usuarioActual);
            const nuevoIceRef = push(iceRef);
            await set(nuevoIceRef, {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex
            });
        };

        // Crear oferta
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Si es llamada directa, guardar oferta en Firebase
        if (!esLlamadaPalmitas && llamadaId) {
            const ofertaRef = ref(database, 'llamadas_directas/' + llamadaId + '/oferta');
            await set(ofertaRef, {
                type: offer.type,
                sdp: offer.sdp
            });
        }

    } catch (error) {
        console.error('Error iniciando llamada:', error);
        document.getElementById('estado-llamada').textContent = 'Error ❌';
        document.getElementById('estado-llamada').style.color = '#ff3333';
    }
};

// ===== WEBRTC - ACEPTAR LLAMADA =====
window.aceptarLlamada = async function() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        peerConnection = new RTCPeerConnection(configICE);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.autoplay = true;
            audio.play().catch(e => console.log('Audio play error:', e));
        };

        // Si es llamada directa, procesar la oferta recibida
        if (!esLlamadaPalmitas && llamadaDirectaId && datosLlamadaDirecta?.oferta) {
            const oferta = new RTCSessionDescription(datosLlamadaDirecta.oferta);
            await peerConnection.setRemoteDescription(oferta);

            // Crear respuesta
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            // Enviar respuesta por Firebase
            const respuestaRef = ref(database, 'llamadas_directas/' + llamadaDirectaId + '/respuesta');
            await set(respuestaRef, {
                type: answer.type,
                sdp: answer.sdp
            });

            // Marcar como aceptada
            const estadoRef = ref(database, 'llamadas_directas/' + llamadaDirectaId + '/estado');
            await set(estadoRef, 'aceptada');

            // Escuchar candidatos ICE del emisor
            const emisorId = datosLlamadaDirecta.de;
            const iceRef = ref(database, 'llamadas_directas/' + llamadaDirectaId + '/ice_candidates/' + emisorId);
            onValue(iceRef, (snap) => {
                const candidates = snap.val();
                if (!candidates) return;
                Object.values(candidates).forEach(cand => {
                    if (cand && cand.candidate) {
                        peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
                    }
                });
            });

            // Enviar mis candidatos ICE
            peerConnection.onicecandidate = async (event) => {
                if (!event.candidate) return;
                const iceRef = ref(database, 'llamadas_directas/' + llamadaDirectaId + '/ice_candidates/' + usuarioActual);
                const nuevoIceRef = push(iceRef);
                await set(nuevoIceRef, {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                });
            };
        }

        document.getElementById('estado-llamada').textContent = 'Conectado ✅';
        document.getElementById('estado-llamada').style.color = '#00ff88';
        iniciarTimer();
        llamadaActiva = true;
        mostrarControlesDuranteLlamada();

    } catch (error) {
        console.error('Error aceptando llamada:', error);
    }
};

window.aceptarLlamadaEntrante = async function() {
    document.getElementById('notificacion-entrante').style.display = 'none';

    let nombreMostrar;

    if (esLlamadaPalmitas && emisorOriginalPalmitas) {
        nombreMostrar = (CATALOGO_USUARIOS[emisorOriginalPalmitas]?.nombre || emisorOriginalPalmitas) + ' (vía Palmitas)';
    } else if (datosLlamadaDirecta) {
        nombreMostrar = CATALOGO_USUARIOS[datosLlamadaDirecta.de]?.nombre || datosLlamadaDirecta.de || 'Alguien';
    } else {
        nombreMostrar = 'Alguien';
    }

    mostrarPantallaLlamada(nombreMostrar, 'Conectando...');
    aceptarLlamada();
};

window.rechazarLlamada = async function() {
    document.getElementById('notificacion-entrante').style.display = 'none';

    if (llamadaDirectaId) {
        const dbRef = ref(database, 'llamadas_directas/' + llamadaDirectaId + '/estado');
        await set(dbRef, 'rechazada');
    }

    llamadaDirectaId = null;
    datosLlamadaDirecta = null;
};

// ===== COLGAR LLAMADA =====
window.colgarLlamada = async function() {
    // Si soy receptor de Palmitas y cuelgo
    if (esLlamadaPalmitas && soyReceptorPalmitas && emisorOriginalPalmitas) {
        await marcarReceptorColgo(emisorOriginalPalmitas, usuarioActual);

        const dbRef = ref(database, 'llamadas_palmitas/' + emisorOriginalPalmitas + '/receptores');
        const snapshot = await get(dbRef);
        const receptores = snapshot.val() || {};

        const diegoColgo = receptores['diego']?.colgo || false;
        const matiasColgo = receptores['matias']?.colgo || false;

        if (diegoColgo && matiasColgo) {
            await desactivarLlamadaPalmitas(emisorOriginalPalmitas);
        }
    }

    // Si soy el emisor original de Palmitas y cuelgo
    if (esLlamadaPalmitas && emisorOriginalPalmitas === usuarioActual) {
        await escribirSenalPalmitas(usuarioActual, 'colgada', {});
    }

    // Si es llamada directa
    if (!esLlamadaPalmitas && miLlamadaId) {
        const dbRef = ref(database, 'llamadas_directas/' + miLlamadaId + '/estado');
        await set(dbRef, 'colgada');
    }
    if (!esLlamadaPalmitas && llamadaDirectaId) {
        const dbRef = ref(database, 'llamadas_directas/' + llamadaDirectaId + '/estado');
        await set(dbRef, 'colgada');
    }

    limpiarLlamada();
};

// ===== FORZAR DESCONECTIÓN =====
function forzarDesconexion(mensaje) {
    alert(mensaje);
    limpiarLlamada();
    // NO pongas reload aquí, ya lo hace limpiarLlamada()
}
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

    resetearEstadoLlamada();

    document.getElementById('pantalla-llamada').style.display = 'none';
    document.getElementById('pantalla-directorio').style.display = 'flex';
    
    // Recargar la página para limpiar todo estado y volver al directorio fresco
    setTimeout(() => {
        location.reload();
    }, 300);
}

// ===== UI LLAMADA =====
function mostrarPantallaLlamada(nombre, estado) {
    document.getElementById('pantalla-directorio').style.display = 'none';
    document.getElementById('pantalla-llamada').style.display = 'flex';

    document.getElementById('nombre-llamada').textContent = nombre;
    document.getElementById('avatar-llamada').textContent = nombre.charAt(0);
    document.getElementById('estado-llamada').textContent = estado;

    document.getElementById('controles-llamada').innerHTML = `
        <button class="boton-control boton-aceptar" onclick="aceptarLlamada()" title="Aceptar">📞</button>
        <button class="boton-control boton-cortar" onclick="colgarLlamada()" title="Cortar">📵</button>
    `;
}

function mostrarNotificacionEntrante(nombre, texto) {
    document.getElementById('nombre-entrante').textContent = nombre;
    document.querySelector('#notificacion-entrante .texto-entrante').textContent = texto;
    document.getElementById('notificacion-entrante').style.display = 'flex';
}

function mostrarControlesDuranteLlamada() {
    document.getElementById('controles-llamada').innerHTML = `
        <button class="boton-control boton-silencio" onclick="toggleSilencio()" title="Silencio">🔇</button>
        <button class="boton-control boton-cortar" onclick="colgarLlamada()" title="Cortar">📵</button>
        <button class="boton-control boton-altavoz" onclick="toggleAltavoz()" title="Altavoz">🔊</button>
    `;
}

// ===== TIMER =====
function iniciarTimer() {
    segundosLlamada = 0;
    timerInterval = setInterval(() => {
        segundosLlamada++;
        const mins = Math.floor(segundosLlamada / 60).toString().padStart(2, '0');
        const secs = (segundosLlamada % 60).toString().padStart(2, '0');
        document.getElementById('timer-llamada').textContent = `${mins}:${secs}`;
    }, 1000);
}

function detenerTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// ===== CONTROLES =====
let silencioActivo = false;
window.toggleSilencio = function() {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
        silencioActivo = !silencioActivo;
        event.target.textContent = silencioActivo ? '🔇' : '🎤';
        event.target.style.backgroundColor = silencioActivo ? '#ff4444' : '#666';
    }
};

let altavozActivo = false;
window.toggleAltavoz = function() {
    altavozActivo = !altavozActivo;
    event.target.style.backgroundColor = altavozActivo ? '#ffd700' : '#666';
    event.target.style.color = altavozActivo ? '#000' : '#fff';
};
