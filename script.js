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
let llamadaActiva    = false;
let timerInterval    = null;
let segundosLlamada  = 0;
    const FOTOS_USUARIOS = {
        'pedro': 'https://i.ibb.co/yFPG4sjP/pedrofoto.png',
        'maria': 'https://i.ibb.co/3yzQ2WBb/mariafoto.png',
        'palmitas': 'https://i.ibb.co/jZvWMMgX/diegomatiasfoto.png'
    };
// Palmitas - Mesh P2P
let esLlamadaPalmitas      = false;
let soyReceptorPalmitas    = false;
let emisorOriginalPalmitas = null;
let soyEmisorPalmitas      = false;
let receptoresConectados   = new Set();
let conexionesPalmitas     = {};
let streamsPalmitas        = {};
let localStreamPalmitas    = null;

// Llamadas directas
let peerConnection   = null;
let localStream      = null;
let miLlamadaId       = null;
let llamadaEntranteId = null;
let yaNotifique       = false;
let _pendingAutoAccept = false;
let _pendingAutoReject = false;

// Cola de candidatos ICE pendientes
let icePendientes = [];
// Después de: let icePendientes = [];
let audiollamandoa = null;
// Listeners activos para limpiar al colgar
const _listeners = [];

// ===== CONFIGURACIÓN WebRTC =====
const configICE = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
            urls:       'turn:openrelay.metered.ca:80',
            username:   '032566480e449e4cee6763ad',
            credential: 'Qtj4tbTR/oR7nFLD'
        },
        {
            urls:       'turn:openrelay.metered.ca:443',
            username:   '032566480e449e4cee6763ad',
            credential: 'Qtj4tbTR/oR7nFLD'
        },
        {
            urls:       'turns:openrelay.metered.ca:443',
            username:   '032566480e449e4cee6763ad',
            credential: 'Qtj4tbTR/oR7nFLD'
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
    if (!document.getElementById('audio-remoto')) {
        const a        = document.createElement('audio');
        a.id           = 'audio-remoto';
        a.autoplay     = true;
        a.muted        = false;
        a.volume       = 1;
        a.setAttribute('playsinline', '');
        document.body.appendChild(a);
    }

    const usuarioGuardado = localStorage.getItem('usuario');
    if (usuarioGuardado && usuarioGuardado.trim() !== '') {
        usuarioActual = usuarioGuardado;
        document.getElementById('pantalla-ingreso').style.display    = 'none';
        document.getElementById('pantalla-directorio').style.display = 'flex';
        if (usuarioActual === 'diego' || usuarioActual === 'matias') escucharLlamadasPalmitas();
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

    audio.muted   = false;
    audio.volume  = 1;

    if (audio.srcObject !== stream) {
        audio.srcObject = stream;
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise
            .then(() => console.log('Audio remoto reproduciéndose'))
            .catch(err => {
                console.warn('Autoplay bloqueado, esperando interacción del usuario:', err);
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
// APLICAR CANDIDATO ICE — directas
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
// PALMITAS — helpers Firebase (Mesh P2P)
// ========================================================
async function escribirSenalPalmitas(emisorId, tipo, extra = {}) {
    const base = {
        emisor: emisorId,
        tipo,
        timestamp: serverTimestamp(),
        activa: tipo !== 'colgada',
        ...extra
    };
    await set(ref(database, 'llamadas_palmitas/' + emisorId), base);
}

async function marcarReceptorColgo(emisorId, receptorId) {
    await set(ref(database, `llamadas_palmitas/${emisorId}/receptores/${receptorId}`), { colgo: true });
}

async function desactivarLlamadaPalmitas(emisorId) {
    await update(ref(database, 'llamadas_palmitas/' + emisorId), { activa: false });
}

async function enviarOfertaPalmitas(emisorId, receptorId, oferta) {
    await set(ref(database, `llamadas_palmitas/${emisorId}/ofertas/${receptorId}`), {
        type: oferta.type,
        sdp: oferta.sdp,
        timestamp: serverTimestamp()
    });
}

async function enviarRespuestaPalmitas(emisorId, receptorId, respuesta) {
    await set(ref(database, `llamadas_palmitas/${emisorId}/respuestas/${receptorId}`), {
        type: respuesta.type,
        sdp: respuesta.sdp,
        timestamp: serverTimestamp()
    });
}

async function enviarIcePalmitas(emisorId, receptorId, candidato, quienEnvia) {
    const r = push(ref(database, `llamadas_palmitas/${emisorId}/ice/${receptorId}/${quienEnvia}`));
    await set(r, {
        candidate:     candidato.candidate,
        sdpMid:        candidato.sdpMid,
        sdpMLineIndex: candidato.sdpMLineIndex
    });
}

// ========================================================
// ESCUCHAR LLAMADAS PALMITAS (diego y matias)
// ========================================================
function escucharLlamadasPalmitas() {
    _escuchar('llamadas_palmitas', async (snapshot) => {
        const llamadas = snapshot.val();
        if (!llamadas) return;

        Object.keys(llamadas).forEach(emisorId => {
            const llamada = llamadas[emisorId];
            if (emisorId === usuarioActual) return;

            // 1. NOTIFICACIÓN ENTRANTE
           // REEMPLAZAR el bloque de NOTIFICACIÓN ENTRANTE (sección 1):
if (llamada.activa && !llamadaActiva && !yaNotifique) {
    yaNotifique            = true;
    emisorOriginalPalmitas = emisorId;
    soyReceptorPalmitas    = true;
    esLlamadaPalmitas      = true;

    // ✅ FIX Bug 1 para Palmitas
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

    const nombre = CATALOGO_USUARIOS[emisorId]?.nombre || emisorId;
    mostrarNotificacionEntrante(`${nombre} (via Palmitas)`, 'Llamada compartida...');
}

            // 2. SI FUERON COLGADAS DESDE EL EMISOR
            if (!llamada.activa && llamadaActiva && esLlamadaPalmitas && emisorOriginalPalmitas === emisorId) {
                recargarPagina();
            }

            // 3. RECEPTOR: escuchar ofertas del emisor para crear answer
            if (soyReceptorPalmitas && llamada.ofertas && llamada.ofertas[usuarioActual]) {
                const ofertaData = llamada.ofertas[usuarioActual];
                if (ofertaData?.sdp && !conexionesPalmitas[emisorId]) {
                    procesarOfertaPalmitas(emisorId, ofertaData);
                }
            }

            // 4. RECEPTOR: escuchar candidatos ICE del emisor
            if (soyReceptorPalmitas && llamada.ice && llamada.ice[usuarioActual] && llamada.ice[usuarioActual][emisorId]) {
                const cands = llamada.ice[usuarioActual][emisorId];
                if (cands && conexionesPalmitas[emisorId]) {
                    Object.values(cands).forEach(c => {
                        if (c?.candidate) aplicarIceCandidatePalmitas(emisorId, c);
                    });
                }
            }

            // 5. EMISOR: escuchar respuestas de receptores
            if (soyEmisorPalmitas && llamada.respuestas) {
                Object.keys(llamada.respuestas).forEach(receptorId => {
                    const respData = llamada.respuestas[receptorId];
                    if (respData?.sdp && conexionesPalmitas[receptorId]) {
                        procesarRespuestaPalmitas(receptorId, respData);
                    }
                });
            }

            // 6. EMISOR: escuchar candidatos ICE de receptores
            if (soyEmisorPalmitas && llamada.ice) {
    Object.keys(llamada.ice).forEach(receptorId => {
        if (!llamada.ice[receptorId][receptorId]) return;      // ← receptorId, no usuarioActual
        const cands = llamada.ice[receptorId][receptorId];     // ← receptorId, no usuarioActual
        if (cands && conexionesPalmitas[receptorId]) {
            Object.values(cands).forEach(c => {
                if (c?.candidate) aplicarIceCandidatePalmitas(receptorId, c);
            });
        }
    });
}
        });
    });
}

// ========================================================
// PALMITAS — PROCESAR OFERTA (receptor crea answer)
// ========================================================
async function procesarOfertaPalmitas(emisorId, ofertaData) {
    if (!localStreamPalmitas) {
        try {
            localStreamPalmitas = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (err) {
            console.error('Error micrófono Palmitas receptor:', err);
            return;
        }
    }

    const pc = new RTCPeerConnection(configICE);
    conexionesPalmitas[emisorId] = pc;

    localStreamPalmitas.getTracks().forEach(t => pc.addTrack(t, localStreamPalmitas));

    pc.ontrack = (e) => {
        console.log('PALMITAS RECEPTOR: ontrack de', emisorId);
        if (e.streams && e.streams[0]) {
            streamsPalmitas[emisorId] = e.streams[0];
            reproducirAudioRemoto(e.streams[0]);
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log('PALMITAS RECEPTOR ICE', emisorId, ':', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') pc.restartIce();
    };

    pc.onicecandidate = async (e) => {
        if (!e.candidate) return;
        await enviarIcePalmitas(emisorId, usuarioActual, e.candidate, usuarioActual);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(ofertaData));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await enviarRespuestaPalmitas(emisorId, usuarioActual, answer);
}

// ========================================================
// PALMITAS — PROCESAR RESPUESTA (emisor recibe answer)
// ========================================================
async function procesarRespuestaPalmitas(receptorId, respData) {
    const pc = conexionesPalmitas[receptorId];
    if (!pc) return;
    if (pc.remoteDescription?.type) return;

    await pc.setRemoteDescription(new RTCSessionDescription(respData));

    if (!llamadaActiva) {
        llamadaActiva = true;
        iniciarTimer();
        mostrarEstadoConectado();
        mostrarControlesDuranteLlamada();
    }
}

// ========================================================
// PALMITAS — APLICAR ICE CANDIDATE
// ========================================================
async function aplicarIceCandidatePalmitas(peerId, cand) {
    const pc = conexionesPalmitas[peerId];
    if (!pc) return;
    try {
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
            if (!pc._icePendientes) pc._icePendientes = [];
            pc._icePendientes.push(cand);
        } else {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
        }
    } catch (e) {
        console.error('addIceCandidate Palmitas error:', e);
    }
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
           // REEMPLAZAR dentro del forEach de escucharLlamadasDirectas:
if (llamada.para !== usuarioActual) return;
if (llamada.de   === usuarioActual) return;
if (llamada.estado !== 'llamando')  return;
if (llamadaActiva)  return;
if (yaNotifique)    return;
if (llamadaEntranteId === id) return;
if (!llamada.oferta?.sdp) return;

yaNotifique       = true;
llamadaEntranteId = id;
esLlamadaPalmitas = false;

// ✅ FIX Bug 1: si Android ya pidió aceptar/rechazar antes de que JS cargara
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
    localStorage.setItem('usuario', username);
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
    localStorage.removeItem('usuario');
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
        infoContainer.innerHTML = `<br>`;
    } else if (usuarioActual === 'diego' || usuarioActual === 'matias') {
        infoContainer.innerHTML = ``;
    } else {
        infoContainer.innerHTML = '';
    }
    

    
    visibles.forEach(contacto => {
        const esPalmitas = contacto.id === 'palmitas';
        const div        = document.createElement('div');
        div.className    = 'tarjeta-contacto';
        
        div.onclick = function() {
            iniciarLlamada(contacto.id);
        };
        
        const tieneFoto = FOTOS_USUARIOS[contacto.id];
        const avatarHTML = tieneFoto 
            ? `<img src="${tieneFoto}" alt="${contacto.nombre}" onerror="this.style.display='none'; this.parentElement.textContent='${contacto.nombre.charAt(0)}';">`
            : contacto.nombre.charAt(0);
        
        div.innerHTML    = `
            <div class="avatar-contacto" style="${esPalmitas ? 'background-color:#ff6b6b;' : ''}">
                ${avatarHTML}
            </div>
           <div class="info-contacto">
    <div class="nombre-contacto">
        ${contacto.nombre}${esPalmitas ? ' <br><span class="badge-palmitas">DIEGO Y MATIAS</span>' : ''}
    </div>
</div>

<!-- Teléfono verde -->
<span class="icono-llamar telefono-verde" style="font-size: 250%;"></span>

<!-- Teléfono rojo (alternativa) -->
<!-- <span class="icono-llamar telefono-rojo" style="font-size: 250%;"></span> -->

<button class="boton-llamar-directo" onclick="event.stopPropagation(); iniciarLlamada('${contacto.id}')" title="Llamar a ${contacto.nombre}">
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
    const nombre = CATALOGO_USUARIOS[contactoId]?.nombre || contactoId;

    // --- PALMITAS (Mesh P2P real) ---
    if (contactoId === 'palmitas') {
        esLlamadaPalmitas      = true;
        soyEmisorPalmitas      = true;
        emisorOriginalPalmitas = usuarioActual;
        receptoresConectados.clear();
        conexionesPalmitas     = {};
        streamsPalmitas        = {};
        icePendientes          = [];

        const receptores = ['diego', 'matias'];
        const nombreContacto = CATALOGO_USUARIOS[contactoId]?.nombre || contactoId;

        mostrarPantallaLlamada(nombreContacto + ' (Compartida)', 'Conectando con Diego y Matias...');
iniciarAudioLlamando();
        try {
            localStreamPalmitas = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

            for (const receptorId of receptores) {
                const pc = new RTCPeerConnection(configICE);
                conexionesPalmitas[receptorId] = pc;

                localStreamPalmitas.getTracks().forEach(t => pc.addTrack(t, localStreamPalmitas));

                pc.ontrack = (e) => {
                    console.log('PALMITAS EMISOR: ontrack de', receptorId);
                    if (e.streams && e.streams[0]) {
                        streamsPalmitas[receptorId] = e.streams[0];
                        reproducirAudioRemoto(e.streams[0]);
                    }
                };

                pc.oniceconnectionstatechange = () => {
                    console.log('PALMITAS EMISOR ICE', receptorId, ':', pc.iceConnectionState);
                    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                        receptoresConectados.add(receptorId);
                        const conectados = Array.from(receptoresConectados).map(id => CATALOGO_USUARIOS[id]?.nombre || id).join(', ');
                        document.getElementById('estado-llamada').textContent = `Conectado con: ${conectados}`;
                    }
                    if (pc.iceConnectionState === 'failed') pc.restartIce();
                };

                pc.onconnectionstatechange = () => {
                    console.log('PALMITAS EMISOR connection', receptorId, ':', pc.connectionState);
                };

                pc.onicecandidate = async (e) => {
                    if (!e.candidate) return;
                    await enviarIcePalmitas(usuarioActual, receptorId, e.candidate, usuarioActual);
                };

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                await enviarOfertaPalmitas(usuarioActual, receptorId, offer);
            }

            await escribirSenalPalmitas(usuarioActual, 'oferta', {
                receptores: { diego: { colgo: false }, matias: { colgo: false } }
            });

            _escuchar(`llamadas_palmitas/${usuarioActual}/receptores`, (snap) => {
                const receptores = snap.val();
                if (!receptores) return;
                const ambosColgaron = receptores.diego?.colgo && receptores.matias?.colgo;
                if (ambosColgaron && llamadaActiva) {
                    recargarPagina();
                }
            });

        } catch (err) {
            console.error('Error iniciando llamada Palmitas:', err);
            document.getElementById('estado-llamada').textContent = 'Error al acceder al micrófono ❌';
            document.getElementById('estado-llamada').style.color = '#ff3333';
        }

        return;
    }

    // --- LLAMADA DIRECTA P2P ---
    esLlamadaPalmitas = false;
    icePendientes     = [];

    const llamadaId = `${usuarioActual}_${contactoId}_${Date.now()}`;
    miLlamadaId     = llamadaId;

    mostrarPantallaLlamada(nombre, 'Llamando...');
iniciarAudioLlamando();
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        peerConnection = new RTCPeerConnection(configICE);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        peerConnection.ontrack = (e) => {
            console.log('EMISOR: ontrack recibido, streams:', e.streams.length);
            if (e.streams && e.streams[0]) {
                reproducirAudioRemoto(e.streams[0]);
            }
        };

        peerConnection.oniceconnectionstatechange = async () => {
    console.log('EMISOR ICE state:', peerConnection.iceConnectionState);
    if (peerConnection.iceConnectionState === 'failed') {
        console.warn('ICE failed — reiniciando con nueva offer');
        try {
            const newOffer = await peerConnection.createOffer({ iceRestart: true });
            await peerConnection.setLocalDescription(newOffer);
            // Reenviar la nueva offer por Firebase
            await set(ref(database, `llamadas_directas/${llamadaId}/oferta`), {
                type: newOffer.type,
                sdp:  newOffer.sdp
            });
        } catch(e) {
            console.error('Error en ICE restart:', e);
        }
    }
};

        peerConnection.onconnectionstatechange = () => {
            console.log('EMISOR connection state:', peerConnection.connectionState);
        };

        const offer = await peerConnection.createOffer();

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

        await peerConnection.setLocalDescription(offer);

        await set(ref(database, `llamadas_directas/${llamadaId}`), {
            de:        usuarioActual,
            para:      contactoId,
            estado:    'llamando',
            timestamp: serverTimestamp(),
            oferta:    { type: offer.type, sdp: offer.sdp }
        });

        _escuchar(`llamadas_directas/${llamadaId}/ice/${contactoId}`, (snap) => {
            const cands = snap.val();
            if (!cands) return;
            Object.values(cands).forEach(c => {
                if (c?.candidate) aplicarIceCandidate(c);
            });
        });

        _escuchar(`llamadas_directas/${llamadaId}/respuesta`, async (snap) => {
            const respuesta = snap.val();
            if (!respuesta?.sdp) return;
            if (!peerConnection)  return;
            if (peerConnection.remoteDescription?.type) return;

            console.log('EMISOR: recibiendo answer, aplicando remoteDescription');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(respuesta));
            await vaciarColaICE();

            if (!llamadaActiva) {
                llamadaActiva = true;
                iniciarTimer();
                mostrarEstadoConectado();
                mostrarControlesDuranteLlamada();
            }
        });

        _escuchar(`llamadas_directas/${llamadaId}/estado`, (snap) => {
    const estado = snap.val();
    if (estado === 'rechazada') recargarPagina();
    if (estado === 'colgada')   recargarPagina(); // ← siempre recargar
});

    } catch (err) {
        console.error('Error iniciando llamada:', err);
        document.getElementById('estado-llamada').textContent = 'Error al acceder al micrófono ❌';
        document.getElementById('estado-llamada').style.color = '#ff3333';
    }
};

// ========================================================
// ACEPTAR LLAMADA ENTRANTE — RECEPTOR
// REEMPLAZAR COMPLETO desde la línea 688:
window.aceptarLlamadaEntrante = async function () {
    document.getElementById('notificacion-entrante').style.display = 'none';

    // --- PALMITAS ---
    if (esLlamadaPalmitas) {
        const nombre = (CATALOGO_USUARIOS[emisorOriginalPalmitas]?.nombre || emisorOriginalPalmitas) + ' (via Palmitas)';
        mostrarPantallaLlamada(nombre, 'ESPERA UN POCO...');
        llamadaActiva = true;
        iniciarTimer();
        mostrarControlesDuranteLlamada();
        return;
    }

    // --- LLAMADA DIRECTA ---
    if (!llamadaEntranteId) return;
    icePendientes = [];

    // ✅ Mostrar pantalla INMEDIATAMENTE (antes del await Firebase)
    // Extraer emisor del ID de llamada: formato "emisor_receptor_timestamp"
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

        // Actualizar nombre y avatar correctos
        document.getElementById('nombre-llamada').textContent = nombre;
        document.getElementById('avatar-llamada').textContent = nombre.charAt(0).toUpperCase();

        localStream    = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        peerConnection = new RTCPeerConnection(configICE);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        peerConnection.ontrack = (e) => {
            console.log('RECEPTOR: ontrack recibido, streams:', e.streams.length);
            if (e.streams && e.streams[0]) reproducirAudioRemoto(e.streams[0]);
        };

        peerConnection.oniceconnectionstatechange = async () => {
    console.log('RECEPTOR ICE state:', peerConnection.iceConnectionState);
    if (peerConnection.iceConnectionState === 'failed') {
        console.warn('ICE failed en receptor — esperando nueva offer del emisor');
        // El receptor no inicia restart, solo espera la nueva offer del emisor
    }
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
            console.log('RECEPTOR: enviando ICE candidate');
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

        _escuchar(`llamadas_directas/${llamadaEntranteId}/ice/${emisorId}`, (snap) => {
            const cands = snap.val();
            if (!cands) return;
            Object.values(cands).forEach(c => { if (c?.candidate) aplicarIceCandidate(c); });
        });

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
// REEMPLAZAR la sección "Palmitas: receptor cuelga" dentro de colgarLlamada:

window.colgarLlamada = async function () {
    // Palmitas: receptor cuelga
    if (esLlamadaPalmitas && soyReceptorPalmitas && emisorOriginalPalmitas) {
        await marcarReceptorColgo(emisorOriginalPalmitas, usuarioActual);

        // ✅ FIX: terminar la llamada si los demás receptores nunca se conectaron
        const snap      = await get(ref(database, `llamadas_palmitas/${emisorOriginalPalmitas}`));
        const data      = snap.val() || {};
        const receptores = data.receptores || {};
        const respuestas = data.respuestas || {};

        // Solo se consideran "participantes" los que enviaron una respuesta WebRTC
        const participantes = ['diego', 'matias'].filter(r => respuestas[r]?.sdp);

        // Si todos los que realmente participaron ya colgaron → terminar para el emisor
        const todosColgaron = participantes.every(
            r => r === usuarioActual || receptores[r]?.colgo === true
        );

        if (todosColgaron) {
            await desactivarLlamadaPalmitas(emisorOriginalPalmitas);
        }
    }

    // Palmitas: emisor cuelga
    if (esLlamadaPalmitas && soyEmisorPalmitas && emisorOriginalPalmitas === usuarioActual) {
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
     detenerAudioLlamando();
         if (window.Android && typeof window.Android.setAudioNormal === 'function')
    window.Android.setAudioNormal(); // ← agregar
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    Object.values(conexionesPalmitas).forEach(pc => { if (pc) pc.close(); });
    conexionesPalmitas = {};
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    if (localStreamPalmitas) { localStreamPalmitas.getTracks().forEach(t => t.stop()); localStreamPalmitas = null; }
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
      <button class="boton-control boton-cortar telefono-rojo" onclick="colgarLlamada()" title="Cancelar"></button>


    `;
}

// REEMPLAZAR COMPLETO:
function mostrarNotificacionEntrante(nombre, texto) {
    // Extraer ID real del emisor
    let emisorId = null;
    if (esLlamadaPalmitas) {
        emisorId = emisorOriginalPalmitas;
    } else if (llamadaEntranteId) {
        emisorId = llamadaEntranteId.split('_')[0];
    }

    const fotoUrl  = emisorId ? FOTOS_USUARIOS[emisorId] : null;
    const iconoEl  = document.getElementById('icono-entrante-contenido');

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
    if (window.Android && typeof window.Android.setAudioParaLlamada === 'function')
    window.Android.setAudioParaLlamada(); // ← agregar
    const el = document.getElementById('estado-llamada');
    if (el) { el.textContent = '✅ Conectado'; el.style.color = '#00ff88'; }
}

function mostrarControlesDuranteLlamada() {
    document.getElementById('controles-llamada').innerHTML = `
        <button class="boton-control boton-silencio" id="btn-silencio" onclick="toggleSilencio(this)" title="Silencio">🎤</button>
        <button class="boton-control boton-cortar"                      onclick="colgarLlamada()"      title="Colgar">📞</button>
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
    if (!localStream && !localStreamPalmitas) return;
    const stream = localStream || localStreamPalmitas;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled             = !track.enabled;
    btn.textContent           = track.enabled ? '🎤' : '🔇';
    btn.style.backgroundColor = track.enabled ? '#555' : '#e94560';
};
// AGREGAR al final del archivo:

// ========================================================
// LIBERAR MICRÓFONO (llamada telefónica normal entrante)
// ========================================================
window.liberarMicrofono = function () {
    // Detener tracks de audio de llamadas directas
    if (localStream) {
        localStream.getAudioTracks().forEach(t => {
            t.enabled = false;
            t.stop();
        });
    }
    // Detener tracks de audio de llamadas Palmitas
    if (localStreamPalmitas) {
        localStreamPalmitas.getAudioTracks().forEach(t => {
            t.enabled = false;
            t.stop();
        });
    }
    console.log('Micrófono liberado por llamada telefónica');
};
// ========================================================
// RESET ESTADO INTERNO
// ========================================================
function resetEstado() {
    llamadaActiva          = false;
    esLlamadaPalmitas      = false;
    soyReceptorPalmitas    = false;
    soyEmisorPalmitas      = false;
    emisorOriginalPalmitas = null;
    receptoresConectados.clear();
    conexionesPalmitas     = {};
    streamsPalmitas        = {};
    localStreamPalmitas    = null;
    miLlamadaId            = null;
    llamadaEntranteId      = null;
    yaNotifique            = false;
    segundosLlamada        = 0;
    icePendientes          = [];
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ========================================================
// BRIDGE ANDROID → WEB  (llamadas desde notificación nativa)
// ========================================================
// REEMPLAZAR COMPLETO (el que agregaste antes):
window.onLlamadaAceptada = function (de, nombre) {
    if (llamadaEntranteId || esLlamadaPalmitas) {
        // JS ya tiene el ID de la llamada, aceptar inmediato
        document.getElementById('notificacion-entrante').style.display = 'none';
        window.aceptarLlamadaEntrante();
    } else {
        // JS aún no detectó la llamada, marcar para auto-aceptar cuando llegue
        _pendingAutoAccept = true;
    }
};

window.onLlamadaRechazada = function (de) {
    if (llamadaEntranteId || esLlamadaPalmitas) {
        window.rechazarLlamada();
    } else {
        _pendingAutoReject = true;
    }
};
// ========================================================
// AUDIO LLAMANDO (tono de llamada saliente)
// ========================================================
function iniciarAudioLlamando() {
    if (audiollamandoa) return;

    function sonarUnaVez() {
        if (!audiollamandoa) return; // fue detenido mientras esperaba
        const tono = new Audio('tono_llamando.mp3'); // ← tu ruta/URL
        tono.volume = 1;
        tono.play().catch(e => console.warn('Audio bloqueado:', e));
    }

    audiollamandoa = true; // marca que está activo
    sonarUnaVez();
    audiollamandoa = setInterval(sonarUnaVez, 2500);
}

function detenerAudioLlamando() {
    if (!audiollamandoa) return;
    clearInterval(audiollamandoa);
    audiollamandoa = null;
}
// 1. Identificamos el botón
const botonSalir = document.getElementById('btn-salir-app');

if (botonSalir) {
    botonSalir.addEventListener('click', () => {
        // 2. Verificamos si la App de Android está escuchando (el puente)
        if (window.Android && typeof window.Android.minimizarDesdeWeb === 'function') {
            
            // OPCIONAL: Si quieres que al salir se limpie el usuario 
            // para que tenga que loguearse de nuevo, descomenta la siguiente línea:
            // localStorage.removeItem('usuario'); 

            // 3. Ejecutamos la orden de minimizar
            window.Android.minimizarDesdeWeb();
            
        } else {
            // Esto solo se verá si abres la web en un PC o Chrome normal
            console.log("No estás en la App de Android. No se puede minimizar.");
            alert("Saliendo de la sesión (Simulación)");
        }
    });
}
