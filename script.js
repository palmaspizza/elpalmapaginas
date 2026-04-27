 import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
        import { 
            getDatabase, 
            ref, 
            set, 
            onValue, 
            off,
            update,
            get,
            serverTimestamp 
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
        let receptoresColgaron = { diego: false, matias: false };

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
                    
                    // Solo Diego y Matias reaccionan
                    if (usuarioActual !== 'diego' && usuarioActual !== 'matias') return;
                    
                    // Ignorar si yo fui el emisor
                    if (emisorId === usuarioActual) return;

                    if (llamada.activa && !llamadaActiva) {
                        // Llamada entrante vía Palmitas
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
                        // El emisor original colgó - desconectar a todos
                        if (emisorOriginalPalmitas === emisorId) {
                            forzarDesconexion("El emisor original colgó la llamada");
                        }
                    }
                });
            });
        }
// ===== FIREBASE: ESCUCHAR LLAMADAS DIRECTAS ENTRANTES =====
function escucharLlamadasDirectas() {
    const dbRef = ref(database, 'llamadas_directas');
    
    onValue(dbRef, (snapshot) => {
        const llamadas = snapshot.val();
        if (!llamadas) return;

        Object.keys(llamadas).forEach(llamadaId => {
            const llamada = llamadas[llamadaId];
            
            // Solo reaccionar si la llamada es PARA mí
            if (llamada.para !== usuarioActual) return;
            
            // Ignorar si ya estoy en una llamada
            if (llamadaActiva) return;
            
            if (llamada.estado === 'llamando') {
                // Mostrar notificación de llamada entrante
                const nombreEmisor = CATALOGO_USUARIOS[llamada.de]?.nombre || llamada.de;
                
                // Guardar ID de llamada para poder responder
                window.llamadaDirectaId = llamadaId;
                
                mostrarNotificacionEntrante(
                    nombreEmisor,
                    'Te está llamando...'
                );
            }
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
            
            // Iniciar escucha de llamadas Palmitas si es Diego o Matias
            if (usuarioActual === 'diego' || usuarioActual === 'matias') {
                escucharLlamadasPalmitas();
                escucharLlamadasDirectas();
            }
            
            renderizarContactos();
        };

        window.cerrarSesion = function() {
            if (llamadaActiva) colgarLlamada();
            
            // Detener listener de Palmitas
            if (palmitasUnsubscribe) {
                const dbRef = ref(database, 'llamadas_palmitas');
                off(dbRef, 'value', palmitasUnsubscribe);
                palmitasUnsubscribe = null;
                // Detener listener de llamadas directas
const dbRefDirectas = ref(database, 'llamadas_directas');
off(dbRefDirectas, 'value');
            }
            
            usuarioActual = '';
            esLlamadaPalmitas = false;
            soyReceptorPalmitas = false;
            emisorOriginalPalmitas = null;
            receptoresColgaron = { diego: false, matias: false };
            
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
            
            // Mostrar info especial si ve a Palmitas
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
        // ===== WEBRTC - INICIAR LLAMADA =====
window.iniciarLlamada = async function(contactoId) {
    contactoActual = contactoId;
    const contacto = CATALOGO_USUARIOS[contactoId];
    const nombreContacto = contacto ? contacto.nombre : contactoId;
    
    if (contactoId === 'palmitas') {
        // Llamada a Palmitas (lógica existente, sin cambios)
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
        const llamadaId = usuarioActual + '_' + contactoId + '_' + Date.now();
        
        // Guardar en Firebase que estamos llamando
        const dbRef = ref(database, 'llamadas_directas/' + llamadaId);
        await set(dbRef, {
            de: usuarioActual,
            para: contactoId,
            estado: 'llamando',
            timestamp: serverTimestamp()
        });
        
        // Escuchar respuesta del destinatario
        const respuestaRef = ref(database, 'llamadas_directas/' + llamadaId);
        onValue(respuestaRef, async (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            
            if (data.estado === 'aceptada' && !llamadaActiva) {
                document.getElementById('estado-llamada').textContent = 'Conectado ✅';
                document.getElementById('estado-llamada').style.color = '#00ff88';
                iniciarTimer();
                llamadaActiva = true;
                mostrarControlesDuranteLlamada();
            } else if (data.estado === 'rechazada') {
                document.getElementById('estado-llamada').textContent = 'Llamada rechazada ❌';
                document.getElementById('estado-llamada').style.color = '#ff3333';
                setTimeout(() => limpiarLlamada(), 2000);
            } else if (data.estado === 'colgada') {
                forzarDesconexion('El otro usuario colgó');
            }
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
        };
        
        // Crear oferta
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Si es llamada directa, guardar oferta en Firebase
        if (!esLlamadaPalmitas && contactoActual) {
            const ofertaRef = ref(database, 'llamadas_directas/' + usuarioActual + '_' + contactoActual + '_' + Date.now() + '/oferta');
            await set(ofertaRef, { sdp: offer.sdp, type: offer.type });
        }
        
        // Simular conexión para demo (en producción esto se maneja por Firebase)
        setTimeout(() => {
            if (esLlamadaPalmitas) {
                document.getElementById('estado-llamada').textContent = 'Conectado con Palmitas ✅';
                document.getElementById('estado-llamada').style.color = '#00ff88';
                iniciarTimer();
                llamadaActiva = true;
                mostrarControlesDuranteLlamada();
            }
            // Para llamadas directas, esperamos la respuesta del listener de Firebase arriba
        }, 2000);
        
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
                };
                
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
    } else if (window.llamadaDirectaId) {
        // Llamada directa - obtener nombre del emisor desde Firebase
        const dbRef = ref(database, 'llamadas_directas/' + window.llamadaDirectaId);
        const snapshot = await get(dbRef);
        const data = snapshot.val();
        nombreMostrar = CATALOGO_USUARIOS[data?.de]?.nombre || data?.de || 'Alguien';
        
        // Marcar como aceptada en Firebase
        await update(dbRef, { estado: 'aceptada' });
    } else {
        nombreMostrar = 'Alguien';
    }
        
    mostrarPantallaLlamada(nombreMostrar, 'Conectando...');
    aceptarLlamada();
};

        window.rechazarLlamada = function() {
            document.getElementById('notificacion-entrante').style.display = 'none';
        };

        // ===== COLGAR LLAMADA =====
        window.colgarLlamada = async function() {
            // Si soy receptor de Palmitas y cuelgo
            if (esLlamadaPalmitas && soyReceptorPalmitas && emisorOriginalPalmitas) {
                await marcarReceptorColgo(emisorOriginalPalmitas, usuarioActual);
                
                // Verificar si ambos receptores colgaron
                const dbRef = ref(database, 'llamadas_palmitas/' + emisorOriginalPalmitas + '/receptores');
                const snapshot = await get(dbRef);
                const receptores = snapshot.val() || {};
                
                const diegoColgo = receptores['diego']?.colgo || false;
                const matiasColgo = receptores['matias']?.colgo || false;
                
                if (diegoColgo && matiasColgo) {
                    // Ambos colgaron - desconectar emisor
                    await desactivarLlamadaPalmitas(emisorOriginalPalmitas);
                }
            }
            
            // Si soy el emisor original de Palmitas y cuelgo
            if (esLlamadaPalmitas && emisorOriginalPalmitas === usuarioActual) {
                await escribirSenalPalmitas(usuarioActual, 'colgada', {});
            }
            // Si es llamada directa y tenemos ID, marcar como colgada en Firebase
if (!esLlamadaPalmitas && window.llamadaDirectaId) {
    const dbRef = ref(database, 'llamadas_directas/' + window.llamadaDirectaId);
    update(dbRef, { estado: 'colgada' });
    window.llamadaDirectaId = null;
}
            limpiarLlamada();
        };

        // ===== FORZAR DESCONECTIÓN =====
        function forzarDesconexion(mensaje) {
            alert(mensaje);
            limpiarLlamada();
        }

        function limpiarLlamada() {
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }
            
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
            }
            
            remoteStream = null;
            llamadaActiva = false;
            detenerTimer();
            
            document.getElementById('pantalla-llamada').style.display = 'none';
            document.getElementById('pantalla-directorio').style.display = 'flex';
            
            // Resetear estados Palmitas
            esLlamadaPalmitas = false;
            soyReceptorPalmitas = false;
            emisorOriginalPalmitas = null;
            receptoresColgaron = { diego: false, matias: false };
            
            // Resetear UI
            document.getElementById('estado-llamada').textContent = 'Conectando...';
            document.getElementById('estado-llamada').style.color = '#ffd700';
            document.getElementById('timer-llamada').textContent = '00:00';
            segundosLlamada = 0;
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
