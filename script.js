import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    onValue,
    off,
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
let usuarioActual     = '';
let llamadaActiva     = false;
let timerInterval     = null;
let segundosLlamada   = 0;
let peerConnection    = null;
let localStream       = null;
let miLlamadaId       = null;
let llamadaEntranteId = null;
let yaNotifique       = false;
let _pendingAutoAccept = false;
let _pendingAutoReject = false;
let icePendientes     = [];
let audiollamandoa    = null;

// Listeners activos para limpiar al colgar
const _listeners = [];

// ===== FOTOS DE USUARIOS =====
const FOTOS_USUARIOS = {
    'pedro':  'https://i.ibb.co/yFPG4sjP/pedrofoto.png',
    'maria':  'https://i.ibb.co/3yzQ2WBb/mariafoto.png',
    'diego':  'https://i.ibb.co/9mTjY0T4/diegoperfil.png',
    'matias': 'https://i.ibb.co/F4xrbDMT/matiasperfil.png'
};

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
// Todos son usuarios individuales — ya no existe "palmitas"
const CATALOGO_USUARIOS = {
    'pedro':  { nombre: 'Pedro'  },
    'maria':  { nombre: 'Maria'  },
    'diego':  { nombre: 'Diego'  },
    'matias': { nombre: 'Matias' }
};

// ===== REGLAS DE VISIBILIDAD =====
// Define quién puede llamar a quién
const REGLAS_VISIBILIDAD = {
    'pedro':  ['maria', 'diego', 'matias'],
    'maria':  ['pedro', 'diego', 'matias'],
    'diego':  ['pedro', 'maria', 'matias'],
    'matias': ['pedro', 'maria', 'diego']
};

// ========================================================
// INIT
// ========================================================
window.addEventListener('load', () => {
    if (!document.getElementById('audio-remoto')) {
        const a = document.createElement('audio');
        a.id    = 'audio-remoto';
        a.autoplay = true;
        a.muted    = false;
        a.volume   = 1;
        a.setAttribute('playsinline', '');
        document.body.appendChild(a);
    }

    const usuarioGuardado = localStorage.getItem('usuario');
    if (usuarioGuardado && usuarioGuardado.trim() !== '') {
        usuarioActual = usuarioGuardado;
        document.getElementById('pantalla-ingreso').style.display    = 'none';
        document.getElementById('pantalla-directorio').style.display = 'flex';
        escucharLlamadasDirectas();
        renderizarContactos();
        if (window.Android) window.Android.setUsuario(usuarioActual);
    } else {
        document.getElementById('input-username').focus();
    }
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
// AUDIO REMOTO
// ========================================================
function reproducirAudioRemoto(stream) {
    const audio = document.getElementById('audio-remoto');
    if (!audio) { console.error('Elemento audio-remoto no encontrado'); return; }

    audio.muted  = false;
    audio.volume = 1;

    if (audio.srcObject !== stream) {
        audio.srcObject = stream;
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise
            .then(() => console.log('Audio remoto reproduciéndose'))
            .catch(err => {
                console.warn('Autoplay bloqueado, esperando interacción:', err);
                const reanudar = () => {
                    audio.play()
                        .then(() => console.log('Audio reanudado'))
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
// ICE CANDIDATES — llamadas directas
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
// ESCUCHAR LLAMADAS ENTRANTES
// ========================================================
function escucharLlamadasDirectas() {
    _escuchar('llamadas_directas', (snapshot) => {
        const llamadas = snapshot.val();
        if (!llamadas) return;

        Object.keys(llamadas).forEach(id => {
            const llamada = llamadas[id];

            if (llamada.para    !== usuarioActual) return;
            if (llamada.de      === usuarioActual) return;
            if (llamada.estado  !== 'llamando')    return;
            if (llamadaActiva)                     return;
            if (yaNotifique)                       return;
            if (llamadaEntranteId === id)          return;
            if (!llamada.oferta?.sdp)              return;

            yaNotifique       = true;
            llamadaEntranteId = id;

            if (_pendingAutoAccept) {
                _pendingAutoAccept = false;
                window.aceptarLlamadaEntrante();
                return;
            }
            if (_pendingAutoReject) {
                _pendingAutoReject = false;
                window.rechazarLlamada();
                return;
            }

            // ── NUEVO: solo mostrar notificación web si la app
            // está en primer plano (visible). Si está en segundo plano,
            // Android ya muestra IncomingCallActivity automáticamente
            // y no necesitamos la doble pantalla del HTML.
            if (document.visibilityState === 'visible') {
                const nombre = CATALOGO_USUARIOS[llamada.de]?.nombre || llamada.de;
                mostrarNotificacionEntrante(nombre, 'Te está llamando...');
            }
        });
    });
}

// ========================================================
// INGRESAR
// ========================================================
window.ingresar = function () {
    const username = document.getElementById('input-username').value.trim().toLowerCase();
    if (!username) { alert('Por favor, escribe tu nombre'); return; }

    if (!CATALOGO_USUARIOS[username]) {
        alert('Usuario no reconocido. Verifica tu nombre.');
        return;
    }

    localStorage.setItem('usuario', username);
    usuarioActual = username;
    document.getElementById('pantalla-ingreso').style.display    = 'none';
    document.getElementById('pantalla-directorio').style.display = 'flex';
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
    localStorage.removeItem('usuario');
    usuarioActual = '';
    document.getElementById('pantalla-directorio').style.display = 'none';
    document.getElementById('pantalla-ingreso').style.display    = 'flex';
    document.getElementById('input-username').value = '';
    document.getElementById('modal-volver').style.display = 'none';
};

// ========================================================
// DIRECTORIO
// ========================================================
window.renderizarContactos = function () {
    const contenedor     = document.getElementById('lista-contactos');
    contenedor.innerHTML = '';

    const visibles = (REGLAS_VISIBILIDAD[usuarioActual] || []).map(id => ({
        id, nombre: CATALOGO_USUARIOS[id]?.nombre || id
    }));

    // Limpiar info-palmitas-container (ya no existe "palmitas")
    const infoContainer = document.getElementById('info-palmitas-container');
    if (infoContainer) infoContainer.innerHTML = '';

    visibles.forEach(contacto => {
        const div     = document.createElement('div');
        div.className = 'tarjeta-contacto';

        div.onclick = function () {
            iniciarLlamada(contacto.id);
        };

        const tieneFoto  = FOTOS_USUARIOS[contacto.id];
        const avatarHTML = tieneFoto
            ? `<img src="${tieneFoto}" alt="${contacto.nombre}"
                    onerror="this.style.display='none';
                             this.parentElement.textContent='${contacto.nombre.charAt(0)}';">`
            : contacto.nombre.charAt(0);

        div.innerHTML = `
            <div class="avatar-contacto">
                ${avatarHTML}
            </div>
            <div class="info-contacto">
                <div class="nombre-contacto">${contacto.nombre}</div>
            </div>
            <span class="icono-llamar telefono-verde" style="font-size:250%;"></span>
            <button class="boton-llamar-directo"
                    onclick="event.stopPropagation(); iniciarLlamada('${contacto.id}')"
                    title="Llamar a ${contacto.nombre}">
                <span class="texto-llamar">LLAMAR</span>
            </button>
        `;
        contenedor.appendChild(div);
    });
};

// ========================================================
// INICIAR LLAMADA — EMISOR
// ========================================================
window.iniciarLlamada = async function (contactoId) {
    if (llamadaActiva) return;

    const nombre  = CATALOGO_USUARIOS[contactoId]?.nombre || contactoId;
    const llamadaId = `${usuarioActual}_${contactoId}_${Date.now()}`;
    miLlamadaId   = llamadaId;
    icePendientes = [];

    mostrarPantallaLlamada(nombre, 'Llamando...');
    iniciarAudioLlamando();

    try {
        localStream    = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        peerConnection = new RTCPeerConnection(configICE);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        peerConnection.ontrack = (e) => {
            console.log('EMISOR: ontrack recibido');
            if (e.streams && e.streams[0]) reproducirAudioRemoto(e.streams[0]);
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log('EMISOR ICE state:', peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === 'failed') peerConnection.restartIce();
        };

        peerConnection.onconnectionstatechange = () => {
            console.log('EMISOR connection state:', peerConnection.connectionState);
        };

        const offer = await peerConnection.createOffer();

        peerConnection.onicecandidate = async (e) => {
            if (!e.candidate) return;
            const r = push(ref(database, `llamadas_directas/${llamadaId}/ice/${usuarioActual}`));
            await set(r, {
                candidate:     e.candidate.candidate,
                sdpMid:        e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex
            });
        };

        await peerConnection.setLocalDescription(offer);

        await set(ref(database, `llamadas_directas/${llamadaId}`), {
            de:        usuarioActual,
            para:      contactoId,
            estado:    'llamando',
            timestamp: serverTimestamp(),
            oferta:    { type: offer.type, sdp: offer.sdp }
        });

        // Escuchar ICE del receptor
        _escuchar(`llamadas_directas/${llamadaId}/ice/${contactoId}`, (snap) => {
            const cands = snap.val();
            if (!cands) return;
            Object.values(cands).forEach(c => {
                if (c?.candidate) aplicarIceCandidate(c);
            });
        });

        // Escuchar respuesta del receptor
        _escuchar(`llamadas_directas/${llamadaId}/respuesta`, async (snap) => {
            const respuesta = snap.val();
            if (!respuesta?.sdp)                         return;
            if (!peerConnection)                          return;
            if (peerConnection.remoteDescription?.type)  return;

            console.log('EMISOR: aplicando answer');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(respuesta));
            await vaciarColaICE();

            if (!llamadaActiva) {
                llamadaActiva = true;
                iniciarTimer();
                mostrarEstadoConectado();
                mostrarControlesDuranteLlamada();
            }
        });

        // Escuchar estado (rechazada / colgada)
        _escuchar(`llamadas_directas/${llamadaId}/estado`, (snap) => {
            const estado = snap.val();
            if (estado === 'rechazada') recargarPagina();
            if (estado === 'colgada')   recargarPagina();
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
    if (!llamadaEntranteId) return;

    icePendientes = [];

    // Mostrar pantalla inmediatamente
    const partes    = llamadaEntranteId.split('_');
    const emisorTmp = partes[0] || '';
    const nombreTmp = CATALOGO_USUARIOS[emisorTmp]?.nombre || emisorTmp;
    mostrarPantallaLlamada(nombreTmp, 'Conectando...');

    try {
        const snap  = await get(ref(database, `llamadas_directas/${llamadaEntranteId}`));
        const datos = snap.val();

        if (!datos?.oferta?.sdp) {
            document.getElementById('estado-llamada').textContent = 'Error al conectar ❌';
            document.getElementById('estado-llamada').style.color = '#ff3333';
            return;
        }

        const emisorId = datos.de;
        const nombre   = CATALOGO_USUARIOS[emisorId]?.nombre || emisorId;

        document.getElementById('nombre-llamada').textContent = nombre;
        document.getElementById('avatar-llamada').textContent = nombre.charAt(0).toUpperCase();

        localStream    = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        peerConnection = new RTCPeerConnection(configICE);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        peerConnection.ontrack = (e) => {
            console.log('RECEPTOR: ontrack recibido');
            if (e.streams && e.streams[0]) reproducirAudioRemoto(e.streams[0]);
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log('RECEPTOR ICE state:', peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === 'failed') peerConnection.restartIce();
        };

        peerConnection.onconnectionstatechange = () => {
            console.log('RECEPTOR connection state:', peerConnection.connectionState);
        };

        console.log('RECEPTOR: aplicando offer');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(datos.oferta));
        await vaciarColaICE();

        const answer = await peerConnection.createAnswer();

        peerConnection.onicecandidate = async (e) => {
            if (!e.candidate) return;
            const r = push(ref(database, `llamadas_directas/${llamadaEntranteId}/ice/${usuarioActual}`));
            await set(r, {
                candidate:     e.candidate.candidate,
                sdpMid:        e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex
            });
        };

        await peerConnection.setLocalDescription(answer);

        console.log('RECEPTOR: enviando answer');
        await set(ref(database, `llamadas_directas/${llamadaEntranteId}/respuesta`), {
            type: answer.type,
            sdp:  answer.sdp
        });
        await set(ref(database, `llamadas_directas/${llamadaEntranteId}/estado`), 'aceptada');

        // Escuchar ICE del emisor
        _escuchar(`llamadas_directas/${llamadaEntranteId}/ice/${emisorId}`, (snap) => {
            const cands = snap.val();
            if (!cands) return;
            Object.values(cands).forEach(c => { if (c?.candidate) aplicarIceCandidate(c); });
        });

        // Escuchar si el emisor cuelga
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
    recargarPagina();
};

// ========================================================
// COLGAR LLAMADA
// ========================================================
window.colgarLlamada = async function () {
    // Emisor cuelga
    if (miLlamadaId) {
        await set(ref(database, `llamadas_directas/${miLlamadaId}/estado`), 'colgada');
    }
    // Receptor cuelga
    if (llamadaEntranteId && !miLlamadaId) {
        await set(ref(database, `llamadas_directas/${llamadaEntranteId}/estado`), 'colgada');
    }
    recargarPagina();
};

// ========================================================
// RECARGA AL COLGAR
// ========================================================
function recargarPagina() {
    detenerAudioLlamando();
    if (window.Android && typeof window.Android.setAudioNormal === 'function') {
        window.Android.setAudioNormal();
    }
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    if (localStream)    { localStream.getTracks().forEach(t => t.stop()); localStream = null; }

    const audioEl = document.getElementById('audio-remoto');
    if (audioEl) audioEl.srcObject = null;

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
    <button class="btn-colgar" onclick="colgarLlamada()">📵 COLGAR</button>
`;
}

function mostrarNotificacionEntrante(nombre, texto) {
    let emisorId = null;
    if (llamadaEntranteId) emisorId = llamadaEntranteId.split('_')[0];

    const fotoUrl = emisorId ? FOTOS_USUARIOS[emisorId] : null;
    const iconoEl = document.getElementById('icono-entrante-contenido');

    if (iconoEl) {
        if (fotoUrl) {
            iconoEl.innerHTML = `<img src="${fotoUrl}"
                style="width:160px;height:160px;border-radius:50%;
                       border:5px solid #ffd700;object-fit:cover;"
                onerror="this.parentElement.innerHTML='📞'">`;
        } else {
            iconoEl.innerHTML = '📞';
        }
    }

    document.getElementById('nombre-entrante').textContent = nombre;
    document.querySelector('#notificacion-entrante .texto-entrante').textContent = texto;
    document.getElementById('notificacion-entrante').style.display = 'flex';
}

function mostrarEstadoConectado() {
    detenerAudioLlamando();
    if (window.Android && typeof window.Android.setAudioParaLlamada === 'function') {
        window.Android.setAudioParaLlamada();
    }
    const el = document.getElementById('estado-llamada');
    if (el) { el.textContent = '✅ Conectado'; el.style.color = '#00ff88'; }
}

function mostrarControlesDuranteLlamada() {
    document.getElementById('controles-llamada').innerHTML = `
    <button class="btn-silencio" id="btn-silencio" onclick="toggleSilencio(this)">🎤 SILENCIO</button>
    <button class="btn-colgar"                     onclick="colgarLlamada()">📵 COLGAR</button>
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
    btn.textContent           = track.enabled ? '🎤 SILENCIO' : '🔇 MUTEADO';
    btn.style.backgroundColor = track.enabled ? '#555555' : '#e94560';
};

window.liberarMicrofono = function () {
    if (localStream) {
        localStream.getAudioTracks().forEach(t => { t.enabled = false; t.stop(); });
    }
    console.log('Micrófono liberado por llamada telefónica');
};

// ========================================================
// RESET ESTADO
// ========================================================
function resetEstado() {
    llamadaActiva     = false;
    peerConnection    = null;
    localStream       = null;
    miLlamadaId       = null;
    llamadaEntranteId = null;
    yaNotifique       = false;
    segundosLlamada   = 0;
    icePendientes     = [];
    _pendingAutoAccept = false;
    _pendingAutoReject = false;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ========================================================
// BRIDGE ANDROID → WEB
// ========================================================
window.onLlamadaAceptada = function (de, nombre) {
    if (llamadaEntranteId) {
        document.getElementById('notificacion-entrante').style.display = 'none';
        window.aceptarLlamadaEntrante();
    } else {
        _pendingAutoAccept = true;
    }
};

window.onLlamadaRechazada = function (de) {
    if (llamadaEntranteId) {
        window.rechazarLlamada();
    } else {
        _pendingAutoReject = true;
    }
};

// ========================================================
// AUDIO LLAMANDO (tono saliente)
// ========================================================
function iniciarAudioLlamando() {
    if (audiollamandoa) return;

    function sonarUnaVez() {
        if (!audiollamandoa) return;
        const tono = new Audio('tono_llamando.mp3');
        tono.volume = 1;
        tono.play().catch(e => console.warn('Audio bloqueado:', e));
    }

    audiollamandoa = true;
    sonarUnaVez();
    audiollamandoa = setInterval(sonarUnaVez, 2500);
}

function detenerAudioLlamando() {
    if (!audiollamandoa) return;
    clearInterval(audiollamandoa);
    audiollamandoa = null;
}

// ========================================================
// BOTÓN SALIR
// ========================================================
const botonSalir = document.getElementById('btn-salir-app');
if (botonSalir) {
    botonSalir.addEventListener('click', () => {
        if (window.Android && typeof window.Android.minimizarDesdeWeb === 'function') {
            window.Android.minimizarDesdeWeb();
        } else {
            console.log('No estás en la App de Android.');
        }
    });
}
