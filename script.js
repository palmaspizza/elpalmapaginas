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

const app      = initializeApp(firebaseConfig);
const database = getDatabase(app);
console.log("Firebase conectado");

// ===== VARIABLES GLOBALES =====
let usuarioActual    = '';
let peerConnection   = null;
let localStream      = null;
let llamadaActiva    = false;
let timerInterval    = null;
let segundosLlamada  = 0;

// Palmitas
let esLlamadaPalmitas      = false;
let soyReceptorPalmitas    = false;
let emisorOriginalPalmitas = null;

// Llamadas directas
let miLlamadaId       = null;
let llamadaEntranteId = null;
let yaNotifique       = false;

// Cola de candidatos ICE pendientes (llegan antes del remoteDescription)
let icePendientes = [];

// Listeners activos para limpiar al colgar
const _listeners = [];

// ===== CONFIGURACIÓN WebRTC =====
const configICE = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        {
            urls:       'turn:openrelay.metered.ca:80',
            username:   'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls:       'turn:openrelay.metered.ca:443',
            username:   'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

// ===== CATÁLOGO DE USUARIOS =====
const CATALOGO_USUARIOS = {
    'pedro':    { nombre: 'Pedro'    },
    'maria':    { nombre: 'Maria'    },
    'palmitas': { nombre: 'Palmitas' },
    'diego':    { nombre: 'Diego'    },
    'matias':   { nombre: 'Matias'   }
};

// ===== REGLAS DE VISIBILIDAD =====
const REGLAS_VISIBILIDAD = {
    'pedro':    ['maria', 'palmitas'],
    'maria':    ['pedro', 'palmitas'],
    'diego':    ['maria', 'pedro'],
    'matias':   ['maria', 'pedro'],
    'palmitas': ['pedro', 'maria', 'diego', 'matias']
};

// ===== INIT =====
window.addEventListener('load', () => {
    // Crear elemento de audio persistente en el DOM desde el inicio
    if (!document.getElementById('audio-remoto')) {
        const a        = document.createElement('audio');
        a.id           = 'audio-remoto';
        a.autoplay     = true;
        a.muted        = false;
        a.volume       = 1;
        a.setAttribute('playsinline', '');  // necesario en iOS
        document.body.appendChild(a);
    }
    document.getElementById('input-username').focus();
});

// ========================================================
// HELPERS LISTENERS FIREBASE
// ========================================================
function _escuchar(path, cb) {
    const dbRef   = ref(database, path);
    const handler = onValue(dbRef, cb);
    _listeners.push({ dbRef, handler });
    return { dbRef, handler };
}

function _limpiarListeners() {
    _listeners.forEach(l => off(l.dbRef, 'value', l.handler));
    _listeners.length = 0;
}

// ========================================================
// AUDIO REMOTO — reproducir stream entrante
// ========================================================
function reproducirAudioRemoto(stream) {
    const audio = document.getElementById('audio-remoto');
    if (!audio) { console.error('Elemento audio-remoto no encontrado'); return; }

    audio.muted   = false;
    audio.volume  = 1;

    // Asignar el stream solo si cambió (evita reinicio innecesario)
    if (audio.srcObject !== stream) {
        audio.srcObject = stream;
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise
            .then(() => console.log('Audio remoto reproduciéndose'))
            .catch(err => {
                console.warn('Autoplay bloqueado, esperando interacción del usuario:', err);
                // Segundo intento ante cualquier interacción del usuario
                const reanudar = () => {
                    audio.play()
                        .then(() => console.log('Audio reanudado tras interacción'))
                        .catch(console.error);
                    document.removeEventListener('click',      reanudar);
                    document.removeEventListener('touchstart', reanudar);
                    document.removeEventListener('keydown',    reanudar);
                };
                document.addEventListener('click',      reanudar, { once: true });
                document.addEventListener('touchstart', reanudar, { once: true });
                document.addEventListener('keydown',    reanudar, { once: true });
            });
    }
}

// ========================================================
// APLICAR CANDIDATO ICE — con cola si aún no hay remoteDescription
// ========================================================
async function aplicarIceCandidate(cand) {
    if (!peerConnection) return;
    try {
        if (!peerConnection.remoteDescription || !peerConnection.remoteDescription.type) {
            icePendientes.push(cand);
        } else {
            await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        }
    } catch (e) {
        console.error('addIceCandidate error:', e);
    }
}

async function vaciarColaICE() {
    while (icePendientes.length > 0 && peerConnection) {
        const cand = icePendientes.shift();
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(cand)); }
        catch (e) { console.error('addIceCandidate (cola) error:', e); }
    }
}

// ========================================================
// PALMITAS — helpers Firebase
// ========================================================
async function escribirSenalPalmitas(emisorId, tipo) {
    await set(ref(database, 'llamadas_palmitas/' + emisorId), {
        emisor: emisorId, tipo,
        timestamp: serverTimestamp(),
        activa: tipo !== 'colgada',
        receptores: { diego: { colgo: false }, matias: { colgo: false } }
    });
}

async function marcarReceptorColgo(emisorId, receptorId) {
    await set(ref(database, `llamadas_palmitas/${emisorId}/receptores/${receptorId}`), { colgo: true });
}

async function desactivarLlamadaPalmitas(emisorId) {
    await update(ref(database, 'llamadas_palmitas/' + emisorId), { activa: false });
}

// ========================================================
// ESCUCHAR LLAMADAS PALMITAS (solo diego/matias)
// ========================================================
function escucharLlamadasPalmitas() {
    _escuchar('llamadas_palmitas', (snapshot) => {
        const llamadas = snapshot.val();
        if (!llamadas) return;
        Object.keys(llamadas).forEach(emisorId => {
            const llamada = llamadas[emisorId];
            if (emisorId === usuarioActual) return;
            if (llamada.activa && !llamadaActiva && !yaNotifique) {
                yaNotifique            = true;
                emisorOriginalPalmitas = emisorId;
                soyReceptorPalmitas    = true;
                esLlamadaPalmitas      = true;
                const nombre = CATALOGO_USUARIOS[emisorId]?.nombre || emisorId;
                mostrarNotificacionEntrante(`${nombre} (via Palmitas)`, 'Llamada compartida...');
            }
            if (!llamada.activa && llamadaActiva && esLlamadaPalmitas && emisorOriginalPalmitas === emisorId) {
                recargarPagina();
            }
        });
    });
}

// ========================================================
// ESCUCHAR LLAMADAS DIRECTAS ENTRANTES
// ========================================================
function escucharLlamadasDirectas() {
    _escuchar('llamadas_directas', (snapshot) => {
        const llamadas = snapshot.val();
        if (!llamadas) return;
        Object.keys(llamadas).forEach(id => {
            const llamada = llamadas[id];
            if (llamada.para !== usuarioActual) return;
            if (llamada.de   === usuarioActual) return;
            if (llamada.estado !== 'llamando')  return;
            if (llamadaActiva)  return;
            if (yaNotifique)    return;
            if (llamadaEntranteId === id) return;
            // Solo notificar cuando la oferta ya existe en Firebase
            if (!llamada.oferta?.sdp) return;

            yaNotifique       = true;
            llamadaEntranteId = id;
            esLlamadaPalmitas = false;

            const nombre = CATALOGO_USUARIOS[llamada.de]?.nombre || llamada.de;
            mostrarNotificacionEntrante(nombre, 'Te está llamando...');
        });
    });
}

// ========================================================
// INGRESAR
// ========================================================
window.ingresar = function () {
    const username = document.getElementById('input-username').value.trim().toLowerCase();
    if (!username) { alert('Por favor, escribe tu nombre'); return; }
    usuarioActual = username;
    document.getElementById('pantalla-ingreso').style.display    = 'none';
    document.getElementById('pantalla-directorio').style.display = 'flex';
    if (usuarioActual === 'diego' || usuarioActual === 'matias') escucharLlamadasPalmitas();
    escucharLlamadasDirectas();
    renderizarContactos();
    if (window.Android) window.Android.setUsuario(usuarioActual);
};

// ========================================================
// CERRAR SESIÓN
// ========================================================
window.cerrarSesion = function () {
    if (llamadaActiva) colgarLlamada();
    _limpiarListeners();
    resetEstado();
    usuarioActual = '';
    document.getElementById('pantalla-directorio').style.display = 'none';
    document.getElementById('pantalla-ingreso').style.display    = 'flex';
    document.getElementById('input-username').value = '';
};

// ========================================================
// DIRECTORIO
// ========================================================
window.renderizarContactos = function () {
    const contenedor    = document.getElementById('lista-contactos');
    contenedor.innerHTML = '';
    const visibles      = (REGLAS_VISIBILIDAD[usuarioActual] || []).map(id => ({
        id, nombre: CATALOGO_USUARIOS[id]?.nombre || id
    }));
    const infoContainer = document.getElementById('info-palmitas-container');
    const vePalmitas    = visibles.some(c => c.id === 'palmitas');
    if (vePalmitas && usuarioActual !== 'palmitas') {
        infoContainer.innerHTML = `<div class="info-palmitas">📢 Llamar a <strong>Palmitas</strong> conecta con Diego y Matias</div>`;
    } else if (usuarioActual === 'diego' || usuarioActual === 'matias') {
        infoContainer.innerHTML = `<div class="info-palmitas">📡 Escuchando llamadas a Palmitas...</div>`;
    } else {
        infoContainer.innerHTML = '';
    }
    visibles.forEach(contacto => {
        const esPalmitas = contacto.id === 'palmitas';
        const div        = document.createElement('div');
        div.className    = 'tarjeta-contacto';
        div.innerHTML    = `
            <div class="avatar-contacto" style="${esPalmitas ? 'background-color:#ff6b6b;' : ''}">
                ${contacto.nombre.charAt(0)}
            </div>
            <div class="info-contacto">
                <div class="nombre-contacto">${contacto.nombre}${esPalmitas ? ' <span class="badge-palmitas">COMPARTIDO</span>' : ''}</div>
                <div class="estado-contacto">🟢 En linea</div>
            </div>
            <button class="boton-llamar-directo" onclick="iniciarLlamada('${contacto.id}')" title="Llamar a ${contacto.nombre}">📞</button>
        `;
        contenedor.appendChild(div);
    });
};

// ========================================================
// INICIAR LLAMADA — EMISOR
// ========================================================
window.iniciarLlamada = async function (contactoId) {
    if (llamadaActiva) return;
    const nombre = CATALOGO_USUARIOS[contactoId]?.nombre || contactoId;

    // --- PALMITAS (sin WebRTC real) ---
    if (contactoId === 'palmitas') {
        esLlamadaPalmitas      = true;
        emisorOriginalPalmitas = usuarioActual;
        await escribirSenalPalmitas(usuarioActual, 'oferta');
        mostrarPantallaLlamada(nombre + ' (Compartida)', 'Conectando con Diego y Matias...');
        return;
    }

    // --- LLAMADA DIRECTA P2P ---
    esLlamadaPalmitas = false;
    icePendientes     = [];

    const llamadaId = `${usuarioActual}_${contactoId}_${Date.now()}`;
    miLlamadaId     = llamadaId;

    mostrarPantallaLlamada(nombre, 'Llamando...');

    try {
        // 1. Obtener audio local
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // 2. Crear PeerConnection
        peerConnection = new RTCPeerConnection(configICE);

        // 3. Agregar tracks locales
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        // 4. Cuando llegue audio remoto, reproducirlo
        peerConnection.ontrack = (e) => {
            console.log('EMISOR: ontrack recibido, streams:', e.streams.length);
            if (e.streams && e.streams[0]) {
                reproducirAudioRemoto(e.streams[0]);
            }
        };

        // 5. Monitorear estado de conexión ICE
        peerConnection.oniceconnectionstatechange = () => {
            console.log('EMISOR ICE state:', peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === 'failed') {
                console.warn('ICE falló, intentando reiniciar...');
                peerConnection.restartIce();
            }
        };

        peerConnection.onconnectionstatechange = () => {
            console.log('EMISOR connection state:', peerConnection.connectionState);
        };

        // 6. Crear oferta SDP
        const offer = await peerConnection.createOffer();

        // *** CRÍTICO: registrar onicecandidate ANTES de setLocalDescription ***
        // setLocalDescription dispara inmediatamente la recolección de ICE.
        // Si el handler se registra después, se pierden candidatos ya generados.
        peerConnection.onicecandidate = async (e) => {
            if (!e.candidate) return;
            console.log('EMISOR: enviando ICE candidate');
            const r = push(ref(database, `llamadas_directas/${llamadaId}/ice/${usuarioActual}`));
            await set(r, {
                candidate:     e.candidate.candidate,
                sdpMid:        e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex
            });
        };

        // 7. Aplicar descripción local (la recolección ICE comienza aquí)
        await peerConnection.setLocalDescription(offer);

        // 8. Publicar en Firebase: estado + oferta juntos
        await set(ref(database, `llamadas_directas/${llamadaId}`), {
            de:        usuarioActual,
            para:      contactoId,
            estado:    'llamando',
            timestamp: serverTimestamp(),
            oferta:    { type: offer.type, sdp: offer.sdp }
        });

        // 9. Escuchar candidatos ICE del receptor y aplicarlos
        _escuchar(`llamadas_directas/${llamadaId}/ice/${contactoId}`, (snap) => {
            const cands = snap.val();
            if (!cands) return;
            Object.values(cands).forEach(c => {
                if (c?.candidate) aplicarIceCandidate(c);
            });
        });

        // 10. Escuchar el answer del receptor
        _escuchar(`llamadas_directas/${llamadaId}/respuesta`, async (snap) => {
            const respuesta = snap.val();
            if (!respuesta?.sdp) return;
            if (!peerConnection)  return;
            if (peerConnection.remoteDescription?.type) return; // ya aplicado

            console.log('EMISOR: recibiendo answer, aplicando remoteDescription');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(respuesta));
            // Vaciar cola ICE que llegó antes del answer
            await vaciarColaICE();

            if (!llamadaActiva) {
                llamadaActiva = true;
                iniciarTimer();
                mostrarEstadoConectado();
                mostrarControlesDuranteLlamada();
            }
        });

        // 11. Escuchar estado: rechazo o cuelgue del receptor
        _escuchar(`llamadas_directas/${llamadaId}/estado`, (snap) => {
            const estado = snap.val();
            if (estado === 'rechazada') recargarPagina();
            if (estado === 'colgada' && llamadaActiva) recargarPagina();
        });

    } catch (err) {
        console.error('Error iniciando llamada:', err);
        document.getElementById('estado-llamada').textContent = 'Error al acceder al micrófono ❌';
        document.getElementById('estado-llamada').style.color = '#ff3333';
    }
};

// ========================================================
// ACEPTAR LLAMADA ENTRANTE — RECEPTOR
// ========================================================
window.aceptarLlamadaEntrante = async function () {
    document.getElementById('notificacion-entrante').style.display = 'none';

    // --- PALMITAS ---
    if (esLlamadaPalmitas) {
        const nombre = (CATALOGO_USUARIOS[emisorOriginalPalmitas]?.nombre || emisorOriginalPalmitas) + ' (via Palmitas)';
        mostrarPantallaLlamada(nombre, 'Conectado ✅');
        llamadaActiva = true;
        iniciarTimer();
        mostrarControlesDuranteLlamada();
        return;
    }

    // --- LLAMADA DIRECTA ---
    if (!llamadaEntranteId) return;
    icePendientes = [];

    const snap  = await get(ref(database, `llamadas_directas/${llamadaEntranteId}`));
    const datos = snap.val();
    if (!datos?.oferta?.sdp) { alert('No se pudo obtener la oferta.'); return; }

    const emisorId = datos.de;
    const nombre   = CATALOGO_USUARIOS[emisorId]?.nombre || emisorId;
    mostrarPantallaLlamada(nombre, 'Conectando...');

    try {
        // 1. Audio local
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // 2. PeerConnection
        peerConnection = new RTCPeerConnection(configICE);

        // 3. Tracks locales
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        // 4. Audio remoto al llegar tracks
        peerConnection.ontrack = (e) => {
            console.log('RECEPTOR: ontrack recibido, streams:', e.streams.length);
            if (e.streams && e.streams[0]) {
                reproducirAudioRemoto(e.streams[0]);
            }
        };

        // 5. Monitorear estado de conexión ICE
        peerConnection.oniceconnectionstatechange = () => {
            console.log('RECEPTOR ICE state:', peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === 'failed') {
                console.warn('ICE falló, intentando reiniciar...');
                peerConnection.restartIce();
            }
        };

        peerConnection.onconnectionstatechange = () => {
            console.log('RECEPTOR connection state:', peerConnection.connectionState);
        };

        // 6. Aplicar oferta del emisor
        console.log('RECEPTOR: aplicando offer');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(datos.oferta));

        // Vaciar candidatos ICE que pudieron llegar antes de la remoteDescription
        await vaciarColaICE();

        // 7. Crear answer
        const answer = await peerConnection.createAnswer();

        // *** CRÍTICO: registrar onicecandidate ANTES de setLocalDescription ***
        peerConnection.onicecandidate = async (e) => {
            if (!e.candidate) return;
            console.log('RECEPTOR: enviando ICE candidate');
            const r = push(ref(database, `llamadas_directas/${llamadaEntranteId}/ice/${usuarioActual}`));
            await set(r, {
                candidate:     e.candidate.candidate,
                sdpMid:        e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex
            });
        };

        // 8. Aplicar descripción local (la recolección ICE comienza aquí)
        await peerConnection.setLocalDescription(answer);

        console.log('RECEPTOR: enviando answer');
        await set(ref(database, `llamadas_directas/${llamadaEntranteId}/respuesta`), {
            type: answer.type,
            sdp:  answer.sdp
        });
        await set(ref(database, `llamadas_directas/${llamadaEntranteId}/estado`), 'aceptada');

        // 9. Escuchar candidatos ICE del emisor
        _escuchar(`llamadas_directas/${llamadaEntranteId}/ice/${emisorId}`, (snap) => {
            const cands = snap.val();
            if (!cands) return;
            Object.values(cands).forEach(c => {
                if (c?.candidate) aplicarIceCandidate(c);
            });
        });

        // 10. Escuchar si el emisor cuelga
        _escuchar(`llamadas_directas/${llamadaEntranteId}/estado`, (snap) => {
            const estado = snap.val();
            if (estado === 'colgada') recargarPagina();
        });

        llamadaActiva = true;
        iniciarTimer();
        mostrarEstadoConectado();
        mostrarControlesDuranteLlamada();

    } catch (err) {
        console.error('Error aceptando llamada:', err);
        document.getElementById('estado-llamada').textContent = 'Error al conectar ❌';
        document.getElementById('estado-llamada').style.color = '#ff3333';
    }
};

// ========================================================
// RECHAZAR LLAMADA
// ========================================================
window.rechazarLlamada = async function () {
    document.getElementById('notificacion-entrante').style.display = 'none';
    if (llamadaEntranteId) {
        await set(ref(database, `llamadas_directas/${llamadaEntranteId}/estado`), 'rechazada');
    }
    resetEstado();
};

// ========================================================
// COLGAR LLAMADA
// ========================================================
window.colgarLlamada = async function () {
    // Palmitas: receptor cuelga
    if (esLlamadaPalmitas && soyReceptorPalmitas && emisorOriginalPalmitas) {
        await marcarReceptorColgo(emisorOriginalPalmitas, usuarioActual);
        const snap       = await get(ref(database, `llamadas_palmitas/${emisorOriginalPalmitas}/receptores`));
        const receptores = snap.val() || {};
        if (receptores.diego?.colgo && receptores.matias?.colgo) {
            await desactivarLlamadaPalmitas(emisorOriginalPalmitas);
        }
    }
    // Palmitas: emisor cuelga
    if (esLlamadaPalmitas && emisorOriginalPalmitas === usuarioActual) {
        await escribirSenalPalmitas(usuarioActual, 'colgada');
    }
    // Directa: emisor cuelga
    if (!esLlamadaPalmitas && miLlamadaId) {
        await set(ref(database, `llamadas_directas/${miLlamadaId}/estado`), 'colgada');
    }
    // Directa: receptor cuelga
    if (!esLlamadaPalmitas && llamadaEntranteId && !miLlamadaId) {
        await set(ref(database, `llamadas_directas/${llamadaEntranteId}/estado`), 'colgada');
    }
    recargarPagina();
};

// ========================================================
// RECARGA DE PÁGINA AL COLGAR/SER COLGADO
// ========================================================
function recargarPagina() {
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    if (localStream)    { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    const audioEl = document.getElementById('audio-remoto');
    if (audioEl) { audioEl.srcObject = null; }
    _limpiarListeners();
    setTimeout(() => location.reload(), 400);
}

// ========================================================
// UI
// ========================================================
function mostrarPantallaLlamada(nombre, estado) {
    document.getElementById('pantalla-directorio').style.display = 'none';
    document.getElementById('pantalla-llamada').style.display    = 'flex';
    document.getElementById('nombre-llamada').textContent        = nombre;
    document.getElementById('avatar-llamada').textContent        = nombre.charAt(0).toUpperCase();
    document.getElementById('estado-llamada').textContent        = estado;
    document.getElementById('timer-llamada').textContent         = '00:00';
    document.getElementById('controles-llamada').innerHTML = `
        <button class="boton-control boton-cortar" onclick="colgarLlamada()" title="Cancelar">📵</button>
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
        <button class="boton-control boton-silencio" id="btn-silencio" onclick="toggleSilencio(this)" title="Silencio">🎤</button>
        <button class="boton-control boton-cortar"                      onclick="colgarLlamada()"      title="Colgar">📵</button>
    `;
}

// ========================================================
// TIMER
// ========================================================
function iniciarTimer() {
    segundosLlamada = 0;
    timerInterval   = setInterval(() => {
        segundosLlamada++;
        const m  = Math.floor(segundosLlamada / 60).toString().padStart(2, '0');
        const s  = (segundosLlamada % 60).toString().padStart(2, '0');
        const el = document.getElementById('timer-llamada');
        if (el) el.textContent = `${m}:${s}`;
    }, 1000);
}

// ========================================================
// CONTROLES DE AUDIO
// ========================================================
window.toggleSilencio = function (btn) {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled             = !track.enabled;
    btn.textContent           = track.enabled ? '🎤' : '🔇';
    btn.style.backgroundColor = track.enabled ? '#555' : '#e94560';
};

// ========================================================
// RESET ESTADO INTERNO
// ========================================================
function resetEstado() {
    llamadaActiva          = false;
    esLlamadaPalmitas      = false;
    soyReceptorPalmitas    = false;
    emisorOriginalPalmitas = null;
    miLlamadaId            = null;
    llamadaEntranteId      = null;
    yaNotifique            = false;
    segundosLlamada        = 0;
    icePendientes          = [];
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}
