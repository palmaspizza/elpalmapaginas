// ============================================================
// BASKETBALL MULTIPLAYER - SISTEMA DE SALAS COMPLETO
// ============================================================

// 1. IMPORTS
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, set, onValue, push, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// 2. FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyCSqgJA6uL8SkY-kphhuaR9TuGPulucPic",
    authDomain: "ajedrez-65b15.firebaseapp.com",
    databaseURL: "https://ajedrez-65b15-default-rtdb.firebaseio.com",
    projectId: "ajedrez-65b15",
    storageBucket: "ajedrez-65b15.firebasestorage.app",
    messagingSenderId: "501222935015",
    appId: "1:501222935015:web:bb08aeab5af07a77eb1542"
};
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ============================================================
// 3. VARIABLES GLOBALES
// ============================================================
let scene, camera, renderer, labelRenderer;
let gameFinished = false;      // Para evitar múltiples finalizaciones
let targetPointsToWin = 10;    // Valor por defecto (se actualizará al crear la sala)
let myPlayerId = null;
let soundEventsRef = null;
let lastShooterTeam = null; // Equipo del último jugador que tiró (blue/red)
let myPlayerName = "";
let myPlayerTeam = null;   // 'blue' | 'red'
let myPlayerMesh = null;
let myPlayerScore = 0;
let lastShooterId = null; 
let lastScoringTeam = null;
let teamScores = { blue: 0, red: 0 }; // Sincronización de marcador global
let players = new Map();   // otros jugadores en escena
let ball = null;
let ballInAir = false;
let possession = null;     // 'player' = yo tengo la pelota, null = libre/otro
let ballAuthority = null;  // playerId que controla la física de la pelota
let shooting = false;
let shootPower = 0;
let shootMaxPower = 1.4;
let shotClock = 24;
let hoops = [];
// hoops[0] = aro DERECHO (X positivo) → equipo AZUL ataca aquí
// hoops[1] = aro IZQUIERDO (X negativo) → equipo ROJO ataca aquí
let gameRunning = false;
let gamePaused = false;

// Sistema de salas
let currentRoomId = null;
let currentRoomData = null;
let unsubscribeRoom = null;

// Cámara
let cameraAngleX = 0;
let cameraAngleY = 0.4;
let cameraDistance = 14; // Un poco más lejos para ver personajes más grandes
let targetCameraAngleX = 0;
let targetCameraAngleY = 0.4;
let pointerLockActive = false;
const mouseSensitivity = 0.004;

// Movimiento
let currentPosition = { x: 0, y: 0, z: 0 };
let keysPressed = {};
let isJumping = false;
let verticalVelocity = 0;
const gravity = 20;
const jumpPower = 9.5; // Salto más alto para personajes más grandes
const groundY = 0;
let isMoving = false;
let velocityX = 0, velocityZ = 0;
const acceleration = 25;
const deceleration = 20;
const maxSpeed = 11;

// Robo de pelota
let lastStealTime = 0;
const stealCooldownMax = 0.5; // Reducido para que el robo sea más fluido

// Animación
let animationTime = 0;
let lastDeltaTimeFrame = 0;

// Sincronización de pelota
let lastBallSyncTime = 0;
const BALL_SYNC_MS = 60;

// === NUEVAS VARIABLES SPRINT Y VENGANZA ===
let isSprinting = false;
let sprintTime = 0;
const sprintMaxTime = 2.0;
let sprintCooldown = 0;
const sprintCooldownMax = 5.5;
let fireParticles = [];

let hasRevengeWeapon = false;
let revengeWeaponMesh = null;
let revengeCountdown = 0;
let revengeDisappearTimer = 0;
let missiles = [];
let isDead = false;
let respawnTimer = 0;

// Colores por equipo
const teamColors = {
    blue: { primary: 0x2255ee, hex: "#2255ee", name: "AZUL" },
    red:  { primary: 0xee2233, hex: "#ee2233", name: "ROJO" }
};

const bodyTypes = [
    { scaleX: 1.2,  scaleY: 2.2, scaleZ: 1.2  }, // Personajes casi del tamaño del aro
    { scaleX: 1.4,  scaleY: 1.8, scaleZ: 1.4  },
    { scaleX: 1.0,  scaleY: 2.4, scaleZ: 1.0  },
    { scaleX: 1.5,  scaleY: 2.0, scaleZ: 1.5  },
    { scaleX: 1.3,  scaleY: 2.1, scaleZ: 1.3  }
];

const courtConfig = {
    width: 30,
    length: 50,
    limitX: 23,
    limitZ: 14,
    hoopHeight: 4.5, // Aro más alto para personajes más grandes
    threePointLine: 6.75
};

// ============================================================
// 4. SISTEMA DE SALAS
// ============================================================

function getMaxPerTeam(modo) {
    const map = { '1v1': 1, '2v2': 2, '3v3': 3, '4v4': 4 };
    return map[modo] || 2;
}
function loadRooms() {

    const roomsRef = ref(database, 'salas');
    onValue(roomsRef, (snapshot) => {
        const rooms = snapshot.val();
        const list = document.getElementById('rooms-list');
        if (!list) return;
        
        // Si no hay salas, mostrar mensaje y salir
        if (!rooms || Object.keys(rooms).length === 0) {
            list.innerHTML = '<div class="no-rooms" style="text-align:center;color:rgba(255,255,255,0.5);padding:40px;font-size:18px;">No hay salas disponibles. ¡Crea una!</div>';
            return;
        }
        
        // Generar HTML de las salas
        let html = '';
        for (const [roomId, room] of Object.entries(rooms)) {
            const bluePlayers = room.equipos && room.equipos.azul ? Object.keys(room.equipos.azul).length : 0;
            const redPlayers  = room.equipos && room.equipos.rojo ? Object.keys(room.equipos.rojo).length : 0;
            const maxPT = getMaxPerTeam(room.modo);
            html += `
                <div class="room-card" data-room-id="${roomId}">
                    <h3>🏟️ ${room.nombre}</h3>
                    <span class="room-mode">${room.modo}</span>
                    <div class="room-players">👥 ${bluePlayers + redPlayers}/${maxPT * 2} jugadores</div>
                    <div class="room-teams">
                        <div class="team-blue-info">🔵 Azul: ${bluePlayers}/${maxPT}</div>
                        <div class="team-red-info">🔴 Rojo: ${redPlayers}/${maxPT}</div>
                    </div>
                </div>`;
        }
        list.innerHTML = html;
        
        // Eliminar salas que estén completamente vacías (0 jugadores en ambos equipos)
//for (const [roomId, room] of Object.entries(rooms)) {
//    const blueCount = room.equipos && room.equipos.azul ? Object.keys(room.equipos.azul).length : 0;
//    const redCount = room.equipos && room.equipos.rojo ? Object.keys(room.equipos.rojo).length : 0;
//    if (blueCount + redCount === 0) {
//        if (roomId !== currentRoomId) {
//            remove(ref(database, 'salas/' + roomId));
//        }
//    }
//}
        
        // Agregar event listener a cada tarjeta de sala
        list.querySelectorAll('.room-card').forEach(card => {
            card.addEventListener('click', () => joinRoom(card.dataset.roomId));
        });
    });
}

// Elimina salas que tienen 0 jugadores en ambos equipos
function cleanEmptyRooms() {
    const roomsRef = ref(database, 'salas');
    onValue(roomsRef, (snapshot) => {
        const rooms = snapshot.val();
        if (!rooms) return;
        
        Object.entries(rooms).forEach(([roomId, room]) => {
            // Contar jugadores en ambos equipos
            const blueCount = room.equipos?.azul ? Object.keys(room.equipos.azul).length : 0;
            const redCount = room.equipos?.rojo ? Object.keys(room.equipos.rojo).length : 0;
            const totalPlayers = blueCount + redCount;
            
            // Si no hay jugadores, eliminar la sala (pero no la actual si estamos dentro)
            if (totalPlayers === 0 && roomId !== currentRoomId) {
                remove(ref(database, 'salas/' + roomId))
                    .then(() => console.log(`Sala vacía eliminada: ${roomId}`))
                    .catch(err => console.warn("Error al eliminar sala vacía:", err));
            }
        });
    }, { onlyOnce: true }); // Solo se ejecuta una vez al llamarla
}
function createRoom() {
    const roomName = document.getElementById('room-name-input').value.trim();
    const mode = document.getElementById('room-mode-select').value;
    if (!roomName) { alert("Ingresa un nombre para la sala"); return; }
    let pointsToWin = parseInt(document.getElementById('room-points-select').value);
    if (isNaN(pointsToWin)) pointsToWin = 10;
    
    // Pedir nombre si aún no se tiene (puedes usar un prompt o un modal)
    let playerName = myPlayerName;
    if (!playerName) {
        playerName = prompt("Ingresa tu nombre para jugar:");
        if (!playerName) return;
        myPlayerName = playerName;
    }
    
    // Elegir equipo aleatorio (o podrías poner 'blue' fijo)
    const randomTeam = Math.random() < 0.5 ? 'blue' : 'red';
    myPlayerTeam = randomTeam;
    
    const newRoomRef = push(ref(database, 'salas'));
    const roomData = {
        puntos_ganar: pointsToWin,
        nombre: roomName,
        modo: mode,
        max_por_equipo: getMaxPerTeam(mode),
        equipos: { azul: {}, rojo: {} },
        creada: Date.now(),
        gameStarted: false,
        bola: { /* ... */ }
    };
    
    set(newRoomRef, roomData).then(() => {
    document.getElementById('create-room-modal').classList.remove('active');
    setTimeout(() => {
        joinRoom(newRoomRef.key);
        // Ahora asignamos al jugador al equipo guardado en myPlayerTeam
        const fbTeam = myPlayerTeam === 'blue' ? 'azul' : 'rojo';
        const playerRef = ref(database, 'salas/' + newRoomRef.key + '/equipos/' + fbTeam + '/' + myPlayerId);
        const baseX = myPlayerTeam === 'blue' ? -8 : 8;
        const startX = baseX + (Math.random() - 0.5) * 4;
        const startZ = (Math.random() - 0.5) * 8;
        set(playerRef, {
            nombre: myPlayerName,
            x: startX, y: 0, z: startZ,
            rotationY: 0,
            score: 0,
            team: myPlayerTeam,
            lastUpdate: Date.now()
        });
        onDisconnect(playerRef).remove();
        // Finalmente iniciamos el juego (si quieres que empiece de inmediato, o esperar a que se llene)
        initGameWithRoom(startX, startZ);
    }, 300);
});
}
function assignPlayerToTeam(roomId, team, playerName) {
    const fbTeam = team === 'blue' ? 'azul' : 'rojo';
    myPlayerId = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    
    const playerRef = ref(database, 'salas/' + roomId + '/equipos/' + fbTeam + '/' + myPlayerId);
    // Posición inicial según equipo
    const baseX = team === 'blue' ? -8 : 8;
    const startX = baseX + (Math.random() - 0.5) * 4;
    const startZ = (Math.random() - 0.5) * 8;
    
    set(playerRef, {
        nombre: playerName,
        x: startX, y: 0, z: startZ,
        rotationY: 0,
        score: 0,
        team: team,
        lastUpdate: Date.now()
    });
    onDisconnect(playerRef).remove();
    
    // Iniciar el juego directamente
    initGameWithRoom(startX, startZ);
}
function joinRoom(roomId) {
    if (unsubscribeRoom) {
        unsubscribeRoom();
        unsubscribeRoom = null;
    }
    
    const roomRef = ref(database, 'salas/' + roomId);
    unsubscribeRoom = onValue(roomRef, (snapshot) => {
        const room = snapshot.val();
        if (!room) {
            console.error("La sala no existe:", roomId);
            alert("La sala ya no existe o fue eliminada");
            backToRooms();
            return;
        }
        
        currentRoomId = roomId;
        currentRoomData = room;
        targetPointsToWin = room.puntos_ganar || 10;
        updateRoomUI(room);
        
        // *** NUEVO: Si la partida ya empezó y aún no estamos en juego, iniciar ***
        if (room.gameStarted === true && !gameRunning && myPlayerMesh === null && myPlayerTeam) {
            // Esto puede ocurrir si el jugador se unió después de que empezó la partida
            // pero aún no ha llamado a initGameWithRoom. Para simplificar, forzamos inicio.
            const baseX = myPlayerTeam === 'blue' ? -8 : 8;
            const startX = baseX + (Math.random() - 0.5) * 4;
            const startZ = (Math.random() - 0.5) * 8;
            initGameWithRoom(startX, startZ);
        }
        
        // Cambiar pantalla solo si no ha comenzado el juego
          if (!skipScreen) {
        document.getElementById('rooms-screen').style.display = 'none';
        document.getElementById('room-screen').style.display = 'block';
    }
        
    });
    
    // Opcional: eventos de sonido
    soundEventsRef = ref(database, 'salas/' + roomId + '/soundEvents');
    onValue(soundEventsRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        const latestKey = Object.keys(data).pop();
        const event = data[latestKey];
        if (event && event.playerId !== myPlayerId) {
            let soundFile = '';
            if (event.type === 'score') soundFile = 'encesta1.mp3';
            else if (event.type === 'win') soundFile = 'ganar1.mp3';
            else if (event.type === 'jump') soundFile = 'saltar1.mp3';
            if (soundFile) {
                new Audio('assets/sounds/' + soundFile).play().catch(e => console.warn("Audio no encontrado"));
            }
        }
        if (latestKey) remove(ref(database, 'salas/' + currentRoomId + '/soundEvents/' + latestKey));
    });
}

function updateRoomUI(room) {
    // Validar que room existe
    if (!room) return;

    // Obtener valores con defaults
    const modo = room.modo || '1v1';
    const maxPT = getMaxPerTeam(modo);
    const bluePlayersObj = (room.equipos && room.equipos.azul) ? room.equipos.azul : {};
    const redPlayersObj  = (room.equipos && room.equipos.rojo) ? room.equipos.rojo : {};
    
    // Calcular conteos
    const blueCount = Object.keys(bluePlayersObj).length;
    const redCount  = Object.keys(redPlayersObj).length;

    // Actualizar contadores en UI
    const blueCountEl = document.getElementById('blue-team-count');
    const redCountEl = document.getElementById('red-team-count');
    if (blueCountEl) blueCountEl.textContent = blueCount + '/' + maxPT;
    if (redCountEl) redCountEl.textContent = redCount + '/' + maxPT;

    // Llenar listas de jugadores
    const blueList = document.getElementById('blue-team-list');
    const redList = document.getElementById('red-team-list');
    if (blueList) {
        let html = '';
        Object.values(bluePlayersObj).forEach(p => {
            html += `<div class="player-item"><span class="player-name">🔵 ${p.nombre}</span></div>`;
        });
        for (let i = blueCount; i < maxPT; i++) html += '<div class="empty-slot">⬜ Vacante</div>';
        blueList.innerHTML = html || '<div class="empty-slot">Esperando jugadores...</div>';
    }
    if (redList) {
        let html = '';
        Object.values(redPlayersObj).forEach(p => {
            html += `<div class="player-item"><span class="player-name">🔴 ${p.nombre}</span></div>`;
        });
        for (let i = redCount; i < maxPT; i++) html += '<div class="empty-slot">⬜ Vacante</div>';
        redList.innerHTML = html || '<div class="empty-slot">Esperando jugadores...</div>';
    }

    // Botones de unirse
    const joinBlueBtn = document.getElementById('join-blue-btn');
    const joinRedBtn = document.getElementById('join-red-btn');
    const myAlreadyIn = myPlayerId && (bluePlayersObj[myPlayerId] || redPlayersObj[myPlayerId]);

    // ===== NUEVO: Si la partida ya comenzó, deshabilitar botones y salir =====
    if (room.gameStarted === true) {
        if (joinBlueBtn) {
            joinBlueBtn.disabled = true;
            joinBlueBtn.classList.add('disabled');
        }
        if (joinRedBtn) {
            joinRedBtn.disabled = true;
            joinRedBtn.classList.add('disabled');
        }
        // No permitir unirse ni iniciar de nuevo
        return;
    }

    // Configurar botones normalmente (partida no iniciada)
    if (joinBlueBtn) {
        const disabled = (blueCount >= maxPT) || !!myAlreadyIn;
        joinBlueBtn.disabled = disabled;
        joinBlueBtn.classList.toggle('disabled', disabled);
    }
    if (joinRedBtn) {
        const disabled = (redCount >= maxPT) || !!myAlreadyIn;
        joinRedBtn.disabled = disabled;
        joinRedBtn.classList.toggle('disabled', disabled);
    }

    // Mostrar nombre y modo
    const nameDisplay = document.getElementById('room-name-display');
    const modeDisplay = document.getElementById('room-mode-display');
    if (nameDisplay) nameDisplay.textContent = '🏟️ ' + (room.nombre || 'Sala sin nombre');
    if (modeDisplay) modeDisplay.textContent = 'Modo: ' + modo;

    // ===== NUEVO: Verificar si ambos equipos están llenos y la partida aún no ha comenzado =====
    const isFull = (blueCount >= maxPT && redCount >= maxPT);
    if (isFull && !room.gameStarted && !gameFinished && !gameRunning) {
        // Marcar la partida como iniciada en Firebase (solo una vez)
        // Usamos transacción para evitar condiciones de carrera
        const roomRef = ref(database, 'salas/' + currentRoomId);
        onValue(roomRef, (snap) => {
            const current = snap.val();
            if (current && !current.gameStarted) {
                set(ref(database, 'salas/' + currentRoomId + '/gameStarted'), true)
                    .then(() => {
                        // Iniciar el juego localmente
                        startGameForAll();
                    })
                    .catch(err => console.error("Error al iniciar partida:", err));
            }
        }, { onlyOnce: true });
    }
}

function showNameModal(team) {
    myPlayerTeam = team;
    const teamNameEl = document.getElementById('selected-team-name');
    if (teamNameEl) teamNameEl.textContent = team === 'blue' ? 'AZUL 🔵' : 'ROJO 🔴';
    document.getElementById('name-modal').classList.add('active');
    const input = document.getElementById('player-name-input');
    if (input) { input.value = ''; input.focus(); }
}
function startGameForAll() {
    // Si el juego ya está corriendo para este jugador, no hacer nada
    if (gameRunning) return;
    
    // Si el jugador ya está en la sala (myPlayerTeam definido) pero aún no se ha iniciado su juego,
    // entonces llamar a initGameWithRoom con su posición almacenada en Firebase.
    if (myPlayerTeam && currentRoomId && !myPlayerMesh) {
        // Obtener la posición guardada en Firebase para este jugador
        const fbTeam = myPlayerTeam === 'blue' ? 'azul' : 'rojo';
        const playerRef = ref(database, 'salas/' + currentRoomId + '/equipos/' + fbTeam + '/' + myPlayerId);
        onValue(playerRef, (snap) => {
            const data = snap.val();
            if (data) {
                const startX = data.x || (myPlayerTeam === 'blue' ? -8 : 8);
                const startZ = data.z || 0;
                initGameWithRoom(startX, startZ);
            } else {
                // Fallback
                const baseX = myPlayerTeam === 'blue' ? -8 : 8;
                const startX = baseX + (Math.random() - 0.5) * 4;
                const startZ = (Math.random() - 0.5) * 8;
                initGameWithRoom(startX, startZ);
            }
        }, { onlyOnce: true });
    } else if (!myPlayerTeam) {
        console.warn("startGameForAll llamado sin myPlayerTeam");
    }
}
function confirmJoinGame() {
     console.log("confirmJoinGame llamado. myPlayerTeam =", myPlayerTeam, "currentRoomId =", currentRoomId);
    if (!myPlayerTeam || !currentRoomId) {
        console.error("Error: equipo o sala no definidos");
        alert("Error al unirse, intente de nuevo");
        return;
    }
     const input = document.getElementById('player-name-input');
    const playerName = input ? input.value.trim() : '';
    if (!playerName) { alert("Ingresa tu nombre"); return; }
    myPlayerName = playerName;
    myPlayerId = Date.now().toString() + Math.random().toString(36).substr(2, 6);

    // Posición inicial según equipo
    // Azul → izquierda (X negativo), ataca aro derecho
    // Rojo → derecha (X positivo), ataca aro izquierdo
    const baseX = myPlayerTeam === 'blue' ? -8 : 8;
    const startX = baseX + (Math.random() - 0.5) * 4;
    const startZ = (Math.random() - 0.5) * 8;

    const fbTeam = myPlayerTeam === 'blue' ? 'azul' : 'rojo';
    const playerRef = ref(database, 'salas/' + currentRoomId + '/equipos/' + fbTeam + '/' + myPlayerId);
    set(playerRef, {
        nombre: myPlayerName,
        x: startX, y: 0, z: startZ,
        rotationY: 0,
        score: 0,
        team: myPlayerTeam,
        lastUpdate: Date.now()
    });
    onDisconnect(playerRef).remove();

    // Limpiar sala si queda vacía al desconectar (solo si eres el último)
    onDisconnect(ref(database, 'salas/' + currentRoomId + '/equipos/' + fbTeam + '/' + myPlayerId)).remove();

    document.getElementById('name-modal').classList.remove('active');
    document.getElementById('room-screen').style.display = 'none';

    initGameWithRoom(startX, startZ);
}

function backToRooms() {
    // Quitar al jugador de la sala
    if (myPlayerId && currentRoomId && myPlayerTeam) {
        const fbTeam = myPlayerTeam === 'blue' ? 'azul' : 'rojo';
        remove(ref(database, 'salas/' + currentRoomId + '/equipos/' + fbTeam + '/' + myPlayerId));
    }
    cleanupGame();
    if (unsubscribeRoom) { unsubscribeRoom(); unsubscribeRoom = null; }
    currentRoomId = null; currentRoomData = null; myPlayerTeam = null; myPlayerId = null;
    document.getElementById('room-screen').style.display = 'none';
    document.getElementById('rooms-screen').style.display = 'block';
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('pause-menu').classList.remove('active');
    if (pointerLockActive) document.exitPointerLock();
}

function exitToMenu() {
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.classList.remove('active');
    backToRooms();
}

function cleanupGame() {
    gameRunning = false;
    gamePaused = false;
    if (myPlayerMesh) { scene.remove(myPlayerMesh); myPlayerMesh = null; }
    players.forEach(p => scene.remove(p.mesh));
    players.clear();
    myPlayerScore = 0;
    possession = null;
    ballInAir = false;
    ballAuthority = null;
    shooting = false;
    shootPower = 0;
    if (ball) { ball.position.set(0, 0.8, 0); ball.userData.inAir = false; ball.userData.velocity = null; }
}

// ============================================================
// 5. SINCRONIZACIÓN FIREBASE
// ============================================================

function syncPosition() {
    if (!myPlayerId || !myPlayerMesh || !currentRoomId || !myPlayerTeam) return;
    const fbTeam = myPlayerTeam === 'blue' ? 'azul' : 'rojo';
    set(ref(database, 'salas/' + currentRoomId + '/equipos/' + fbTeam + '/' + myPlayerId), {
        nombre: myPlayerName,
        x: currentPosition.x,
        y: currentPosition.y,
        z: currentPosition.z,
        rotationY: myPlayerMesh.rotation.y,
        score: myPlayerScore,
        team: myPlayerTeam,
        isSprinting: isSprinting, // Sincronizar sprint para fuego (Mecánica 1)
        lastUpdate: Date.now()
    });
}

function syncBallToFirebase() {
    if (!currentRoomId || !ball) return;
    const now = Date.now();
    // Aumentamos la frecuencia de sincronización de 60ms a 30ms para "tiempo real" perfecto
    if (now - lastBallSyncTime < 30) return;
    lastBallSyncTime = now;
    const vel = ball.userData.velocity;
    set(ref(database, 'salas/' + currentRoomId + '/bola'), {
        x: ball.position.x,
        y: ball.position.y,
        z: ball.position.z,
        vx: vel ? vel.x : 0,
        vy: vel ? vel.y : 0,
        vz: vel ? vel.z : 0,
        inAir: ballInAir,
        authorityId: myPlayerId,
        possessorId: possession === 'player' ? myPlayerId : (ballAuthority && ballAuthority !== myPlayerId ? ballAuthority : null),
        possessorTeam: possession === 'player' ? myPlayerTeam : null,
        shooterTeam: (ball.userData && ball.userData.shooterTeam) ? ball.userData.shooterTeam : null,
        isThreePoint: (ball.userData && ball.userData.isThreePoint) ? ball.userData.isThreePoint : false,
        lastUpdate: now
    });
}

function applyBallFromFirebase(d) {
    if (!ball || !d) return;
    
    // Si soy la autoridad, no sobrescribir mi propia física
    if (d.authorityId === myPlayerId) return;

    ballAuthority = d.authorityId || null;

    // Si alguien más tiene la pelota, pegarla a su posición localmente
    if (!d.inAir && d.possessorId && d.possessorId !== myPlayerId) {
        const possessor = players.get(d.possessorId);
        if (possessor && possessor.mesh) {
            ball.position.set(possessor.mesh.position.x, possessor.mesh.position.y + 1.2, possessor.mesh.position.z);
            possession = null;
            ballInAir = false;
            updatePossessionUI();
            return;
        }
    }

    // Interpolación suave para pelotas libres o en el aire
    ball.position.x += (d.x - ball.position.x) * 0.45;
    ball.position.y += (d.y - ball.position.y) * 0.45;
    ball.position.z += (d.z - ball.position.z) * 0.45;

    if (d.inAir) {
        ballInAir = true;
        ball.userData.inAir = true;
        ball.userData.velocity = new THREE.Vector3(d.vx || 0, d.vy || 0, d.vz || 0);
        ball.userData.shooterTeam = d.shooterTeam || null;
        ball.userData.isThreePoint = d.isThreePoint || false;
        if (possession === 'player') { possession = null; updatePossessionUI(); }
    } else {
        if (ball.userData) ball.userData.inAir = false;
        // Si no hay poseedor o es de otro equipo/jugador
        if (!d.possessorId || d.possessorId !== myPlayerId) {
            if (possession === 'player') { possession = null; updatePossessionUI(); }
            ballInAir = false;
        }
    }
}

function listenRoomPlayers() {
    if (!currentRoomId) return;

    const listenTeam = (fbPath, teamName) => {
        onValue(ref(database, 'salas/' + currentRoomId + '/equipos/' + fbPath), (snap) => {
            const data = snap.val() || {};
            const activeIds = new Set(Object.keys(data));

            Object.keys(data).forEach(pid => {
                if (pid === myPlayerId) return;
                const pd = data[pid];
                const color = teamName === 'blue' ? teamColors.blue.primary : teamColors.red.primary;

                if (!players.has(pid)) {
                    const { group } = createChibiPlayer(color, pd.nombre, Math.floor(Math.random() * bodyTypes.length));
                    scene.add(group);
                    players.set(pid, { 
                        mesh: group, 
                        name: pd.nombre, 
                        team: teamName, 
                        score: 0, 
                        isSprinting: false 
                    });
                }
                
                // Obtener el jugador (ya sea existente o recién creado)
                const p = players.get(pid);
                if (p && pd.x !== undefined) {
                    p.mesh.position.set(pd.x, pd.y || 0, pd.z);
                    if (pd.rotationY !== undefined) p.mesh.rotation.y = pd.rotationY;
                    p.score = pd.score || 0;
                    p.isSprinting = pd.isSprinting || false;
                }
            });

            // Eliminar desconectados de este equipo
            players.forEach((p, pid) => {
                if (p.team === teamName && !activeIds.has(pid)) {
                    scene.remove(p.mesh);
                    players.delete(pid);
                }
            });

            const total = players.size + 1;
            const pauseOnline = document.getElementById('pause-online-count');
            if (pauseOnline) pauseOnline.textContent = total;
        });
    };

    listenTeam('azul', 'blue');
    listenTeam('rojo', 'red');

    // Escuchar puntajes globales
    onValue(ref(database, 'salas/' + currentRoomId + '/puntajes'), (snap) => {
        const scores = snap.val() || { blue: 0, red: 0 };
        teamScores = scores;
        const blueEl = document.getElementById('blue-score');
        const redEl = document.getElementById('red-score');
        if (blueEl) blueEl.textContent = scores.blue;
        if (redEl) redEl.textContent = scores.red;
    });

    // Escuchar pelota de otros jugadores
    onValue(ref(database, 'salas/' + currentRoomId + '/bola'), (snap) => {
        const d = snap.val();
        if (d && d.authorityId !== myPlayerId) {
            applyBallFromFirebase(d);
        }
    });
}

// ============================================================
// 6. THREE.JS INIT
// ============================================================

function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a2a);
    scene.fog = new THREE.FogExp2(0x0a0a2a, 0.005);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.left = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.body.appendChild(labelRenderer.domElement);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    setupLights();
    createBeautifulCourt();
    createGiantHoops();
    createBigBall();
    animate();
}

function setupLights() {
    scene.add(new THREE.AmbientLight(0x404060));

    const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    mainLight.position.set(10, 20, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const fillLight = new THREE.PointLight(0x4466cc, 0.6);
    fillLight.position.set(0, 10, 0);
    scene.add(fillLight);

    const stadiumColors = [0xffaa66, 0xff8855, 0xffaa66, 0xff8855];
    const spotPositions = [[-15,8,-20],[15,8,-20],[-15,8,20],[15,8,20]];
    spotPositions.forEach((pos, i) => {
        const light = new THREE.SpotLight(stadiumColors[i], 0.8);
        light.position.set(pos[0], pos[1], pos[2]);
        light.castShadow = true;
        scene.add(light);
    });

    const floorLight = new THREE.PointLight(0xcc8844, 0.5);
    floorLight.position.set(0, 2, 0);
    scene.add(floorLight);
}

// ============================================================
// 7. CANCHA
// ============================================================

function createBeautifulCourt() {
    // === TEXTURA DE MADERA PROFESIONAL DE ALTA FIDELIDAD (Estética 2) ===
    const canvas = document.createElement('canvas');
    canvas.width = 4096; canvas.height = 4096;
    const ctx = canvas.getContext('2d');

    // Madera de roble profesional (color más realista)
    ctx.fillStyle = '#d2b48c'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vetas de madera sutiles y realistas
    for (let i = 0; i < 3000; i++) {
        ctx.beginPath();
        const sx = Math.random() * canvas.width, sy = Math.random() * canvas.height;
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(
            sx + 100, sy + 20,
            sx + 200, sy - 20,
            sx + 500, sy + (Math.random() - 0.5) * 50
        );
        ctx.strokeStyle = 'rgba(100,70,40,' + (Math.random() * 0.1) + ')';
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.stroke();
    }

    // Barniz y brillo sutil
    const woodTex = new THREE.CanvasTexture(canvas);
    woodTex.anisotropy = 16;
    woodTex.wrapS = THREE.RepeatWrapping;
    woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(1, 1);

    const courtPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(courtConfig.length, courtConfig.width),
        new THREE.MeshStandardMaterial({ 
            map: woodTex, 
            roughness: 0.1, 
            metalness: 0.1,
            envMapIntensity: 1.0
        })
    );
    courtPlane.rotation.x = -Math.PI / 2;
    courtPlane.position.y = -0.05;
    courtPlane.receiveShadow = true;
    scene.add(courtPlane);

    // === MITADES COLOREADAS POR EQUIPO (Estética Realista - Mayoría de la mitad) ===
    const sideW = courtConfig.length / 2 - 1.5;
    const sideH = courtConfig.width - 1.5;

    const blueSide = new THREE.Mesh(
        new THREE.PlaneGeometry(sideW, sideH),
        new THREE.MeshStandardMaterial({ color: 0x0000ff, transparent: true, opacity: 0.45, roughness: 0.5 })
    );
    blueSide.rotation.x = -Math.PI / 2;
    blueSide.position.set(-courtConfig.length / 4, -0.04, 0);
    scene.add(blueSide);

    const redSide = new THREE.Mesh(
        new THREE.PlaneGeometry(sideW, sideH),
        new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.45, roughness: 0.5 })
    );
    redSide.rotation.x = -Math.PI / 2;
    redSide.position.set(courtConfig.length / 4, -0.04, 0);
    scene.add(redSide);

    // === BORDES Y SURROUNDINGS ===
    createMoreCourtDetails();

    // === ZONAS PINTADAS Y BORDES (Realismo Pro) ===
    const borderMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const outerBorder = new THREE.Mesh(
        new THREE.PlaneGeometry(courtConfig.length + 6, courtConfig.width + 6),
        borderMat
    );
    outerBorder.rotation.x = -Math.PI / 2;
    outerBorder.position.y = -0.07;
    scene.add(outerBorder);

    // === LÍNEAS (White Pro) ===
    const white = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const orange = new THREE.LineBasicMaterial({ color: 0xffaa44 });

    function makeLine(pts, mat) {
        return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    }
    function v3(x, z) { return new THREE.Vector3(x, 0.01, z); }

    // Perímetro
    const hl = courtConfig.length / 2 - 0.8, hw = courtConfig.width / 2 - 0.8;
    scene.add(makeLine([v3(-hl,-hw), v3(hl,-hw), v3(hl,hw), v3(-hl,hw), v3(-hl,-hw)], white));

    // Media cancha
    scene.add(makeLine([v3(0,-hw), v3(0,hw)], white));

    // Círculo central
    const mkArc = (r, segs, cx, cz, a0, a1) => {
        const pts = [];
        for (let i = 0; i <= segs; i++) {
            const a = a0 + (a1 - a0) * (i / segs);
            pts.push(v3(cx + Math.cos(a) * r, cz + Math.sin(a) * r));
        }
        return pts;
    };
    scene.add(makeLine(mkArc(2.2, 128, 0, 0, 0, Math.PI * 2), white));
    scene.add(makeLine(mkArc(1.5, 128, 0, 0, 0, Math.PI * 2), orange));

    // Líneas de tiros libres
    const ftR = courtConfig.length / 2 - 3.8;
    const ftL = -courtConfig.length / 2 + 3.8;
    scene.add(makeLine([v3(ftR, -2.2), v3(ftR, 2.2)], white));
    scene.add(makeLine([v3(ftL, -2.2), v3(ftL, 2.2)], white));

    // Semicírculos de tiros libres
    scene.add(makeLine(mkArc(1.8, 60, ftR, 0, -Math.PI / 2, Math.PI / 2).map(p => v3(p.x, p.z)), white));
    scene.add(makeLine(mkArc(1.8, 60, ftL, 0, Math.PI / 2, 3 * Math.PI / 2).map(p => v3(p.x, p.z)), white));

    // Línea de 3 puntos (arcos)
    const tp = courtConfig.threePointLine;
    const tpPtsR = [], tpPtsL = [];
    for (let i = 0; i <= 120; i++) {
        const a = -Math.PI / 2 + (Math.PI * i / 120);
        const x1 = (courtConfig.length / 2 - 1.5) + Math.cos(a) * tp;
        const z1 = Math.sin(a) * tp;
        if (Math.abs(z1) <= courtConfig.width / 2 - 1.2) tpPtsR.push(v3(x1, z1));

        const x2 = -(courtConfig.length / 2 - 1.5) + Math.cos(a + Math.PI) * tp;
        const z2 = Math.sin(a + Math.PI) * tp;
        if (Math.abs(z2) <= courtConfig.width / 2 - 1.2) tpPtsL.push(v3(x2, z2));
    }
    scene.add(makeLine(tpPtsR, orange));
    scene.add(makeLine(tpPtsL, orange));

    // Líneas corner de 3 puntos
    const cw = courtConfig.width / 2 - 1.2;
    scene.add(makeLine([v3(courtConfig.length/2 - 1.5, -cw), v3(courtConfig.length/2 - 1.5, cw)], orange));
    scene.add(makeLine([v3(-courtConfig.length/2 + 1.5, -cw), v3(-courtConfig.length/2 + 1.5, cw)], orange));

    // Carriles
    [-1.5, 0, 1.5].forEach(step => {
        scene.add(makeLine([v3(courtConfig.length/2 - 2.2, step), v3(courtConfig.length/2 - 3.2, step)], white));
        scene.add(makeLine([v3(-courtConfig.length/2 + 2.2, step), v3(-courtConfig.length/2 + 3.2, step)], white));
    });

    // Glow de cancha
    const glowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(courtConfig.length, courtConfig.width),
        new THREE.MeshStandardMaterial({ color: 0xffaa66, emissive: 0x442200, emissiveIntensity: 0.08, transparent: true, opacity: 0.2 })
    );
    glowPlane.rotation.x = -Math.PI / 2;
    glowPlane.position.y = -0.048;
    scene.add(glowPlane);

    // === GRADAS ===
    const standMat = new THREE.MeshStandardMaterial({ color: 0x553322, roughness: 0.7 });
    const seatColors = [0x44aa44, 0xaa4444, 0x4444aa, 0xaaaa44];
    for (let i = -24; i <= 24; i += 2.2) {
        for (const side of [-1, 1]) {
            const stand = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.5), standMat);
            stand.position.set(i * 1.3, -0.3, side * (courtConfig.width / 2 + 3.0));
            scene.add(stand);
            for (let s = -0.9; s <= 0.9; s += 0.9) {
                const seatMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(0.45, 0.1, 0.6),
                    new THREE.MeshStandardMaterial({ color: seatColors[Math.floor(Math.random() * 4)], roughness: 0.5 })
                );
                seatMesh.position.set(i * 1.3 + s, -0.05, side * (courtConfig.width / 2 + 3.3));
                scene.add(seatMesh);
            }
        }
    }

    // Mesa de anotadores
    const scoreTable = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.4, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 })
    );
    scoreTable.position.set(0, 0.2, courtConfig.width / 2 - 0.5);
    scene.add(scoreTable);
}

function createStadiumAtmosphere() {
    // === GRADAS MASIVAS CON AUDIENCIA (Estética 2) ===
    const stadiumRadius = 100;
    const stadiumGeometry = new THREE.CylinderGeometry(stadiumRadius, stadiumRadius - 20, 40, 64, 10, true);
    const stadiumMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x111122, 
        side: THREE.BackSide,
        roughness: 0.9,
        metalness: 0.1
    });
    const stadium = new THREE.Mesh(stadiumGeometry, stadiumMaterial);
    stadium.position.y = 15;
    scene.add(stadium);

    // Luces de estadio masivas
    const towerGeo = new THREE.BoxGeometry(2, 40, 2);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const lightPanelGeo = new THREE.PlaneGeometry(8, 6);
    const lightPanelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const towers = [[-45, 45], [45, 45], [-45, -45], [45, -45]];
    towers.forEach(([tx, tz]) => {
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.set(tx, 20, tz);
        scene.add(tower);

        const panel = new THREE.Mesh(lightPanelGeo, lightPanelMat);
        panel.position.set(tx, 40, tz);
        panel.lookAt(0, 0, 0);
        scene.add(panel);

        const spot = new THREE.SpotLight(0xffffff, 2, 150, Math.PI/4, 0.5);
        spot.position.set(tx, 40, tz);
        spot.target.position.set(0, 0, 0);
        scene.add(spot);
        scene.add(spot.target);
    });

    // Audiencia densa (representada por miles de puntos brillantes)
    const audienceCount = 15000;
    const audienceGeo = new THREE.BufferGeometry();
    const audiencePos = new Float32Array(audienceCount * 3);
    const audienceColors = new Float32Array(audienceCount * 3);

    for (let i = 0; i < audienceCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = stadiumRadius - 10 - Math.random() * 15;
        const height = 5 + Math.random() * 30;
        
        audiencePos[i * 3] = Math.cos(angle) * radius;
        audiencePos[i * 3 + 1] = height;
        audiencePos[i * 3 + 2] = Math.sin(angle) * radius;

        const color = new THREE.Color().setHSL(Math.random(), 0.7, 0.6);
        audienceColors[i * 3] = color.r;
        audienceColors[i * 3 + 1] = color.g;
        audienceColors[i * 3 + 2] = color.b;
    }

    audienceGeo.setAttribute('position', new THREE.BufferAttribute(audiencePos, 3));
    audienceGeo.setAttribute('color', new THREE.BufferAttribute(audienceColors, 3));
    
    const audienceMaterial = new THREE.PointsMaterial({ 
        size: 0.4, 
        vertexColors: true, 
        transparent: true, 
        opacity: 0.8,
        blending: THREE.AdditiveBlending 
    });
    const audience = new THREE.Points(audienceGeo, audienceMaterial);
    scene.add(audience);
}

function createMoreCourtDetails() {
    // Carritos de pelotas
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.2 });
    for (const pos of [[-26, 16], [26, 16], [-26, -16], [26, -16]]) {
        const rack = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 1), rackMat);
        rack.add(base);
        // Pelotas en el rack
        for (let j = 0; j < 6; j++) {
            const ballSample = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff6600 }));
            ballSample.position.set(-0.6 + (j % 3) * 0.6, 0.4 + Math.floor(j / 3) * 0.5, 0);
            rack.add(ballSample);
        }
        rack.position.set(pos[0], 0.1, pos[1]);
        scene.add(rack);
    }

    // Bancas de suplentes
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    for (let i = -5; i <= 5; i += 2.5) {
        if (Math.abs(i) < 1) continue;
        const bench = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 0.8), benchMat);
        bench.position.set(i, 0.2, -courtConfig.width / 2 - 1.5);
        scene.add(bench);
    }

    // Botellas de agua
    const bottleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8);
    const bottleMat = new THREE.MeshStandardMaterial({ color: 0x00aaff, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 5; i++) {
        const bottle = new THREE.Mesh(bottleGeo, bottleMat);
        bottle.position.set(-0.5 + i * 0.2, 0.5, courtConfig.width / 2 - 0.5);
        scene.add(bottle);
    }

    // Publicidad LED con nombres chilenos
    const ads = ["TÍO MANOLO", "COMPLETAZO", "VTR ROBO", "SÚPER CERDO", "ENTEL"];
    ads.forEach((text, i) => {
        const adGeo = new THREE.BoxGeometry(8, 2, 0.2);
        const adMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00ff00, emissiveIntensity: 0.2 });
        const ad = new THREE.Mesh(adGeo, adMat);
        ad.position.set(-20 + i * 10, 1, -courtConfig.width / 2 - 3);
        scene.add(ad);
    });
}

// ============================================================
// 8. AROS
// ============================================================

function createGiantHoops() {
    // Colores y materiales mejorados para aros profesionales (Estética 2)
    const hoopMat    = new THREE.MeshStandardMaterial({ color: 0xff3300, metalness: 0.9, roughness: 0.1, emissive: 0xff0000, emissiveIntensity: 0.3 });
    const boardMat   = new THREE.MeshPhysicalMaterial({ 
        color: 0xffffff, 
        metalness: 0.1, 
        roughness: 0.05, 
        transparent: true, 
        opacity: 0.8,
        transmission: 0.5,
    });
    const rimMat     = new THREE.MeshStandardMaterial({ color: 0xff4400, metalness: 0.9, roughness: 0.1 });
    const suppMat    = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 });
    const netMat     = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const borderMat  = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
    
    const hoopRadius = 1.2, hoopTube = 0.12;
    const bw = 4.2, bh = 2.7, netLen = 1.5;
    const hh = courtConfig.hoopHeight;

    function buildHoop(isRight) {
        const g = new THREE.Group();
        const hoopX   = isRight ? 0.75 : -0.75;
        const suppX   = isRight ? -1.5 : 1.5;
        const armX    = isRight ? -0.4 : 0.4;

        // Estructura de soporte profesional
        const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1.5), suppMat);
        base.position.set(suppX, 0.25, 0);
        g.add(base);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 5, 8), suppMat);
        pole.position.set(suppX, 2.5, 0);
        g.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 0.3), suppMat);
        arm.position.set(armX * 1.5, 4.5, 0);
        g.add(arm);

        // Tablero detallado
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, bh, bw), boardMat);
        board.position.set(0, hh + 0.5, 0);
        g.add(board);

        // Marco del tablero con luces LED
        const frameGeo = new THREE.BoxGeometry(0.12, bh + 0.2, 0.1);
        const frameL = new THREE.Mesh(frameGeo, borderMat);
        frameL.position.set(0, hh + 0.5, bw/2);
        g.add(frameL);
        const frameR = new THREE.Mesh(frameGeo, borderMat);
        frameR.position.set(0, hh + 0.5, -bw/2);
        g.add(frameR);
        const frameT = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, bw + 0.2), borderMat);
        frameT.position.set(0, hh + 0.5 + bh/2, 0);
        g.add(frameT);
        const frameB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, bw + 0.2), borderMat);
        frameB.position.set(0, hh + 0.5 - bh/2, 0);
        g.add(frameB);

        // El aro
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(hoopRadius, hoopTube, 32, 100), hoopMat);
        hoop.rotation.x = Math.PI / 2;
        hoop.position.set(hoopX, hh, 0);
        g.add(hoop);

        // Soporte del aro (el "breakaway rim")
        const breakaway = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), rimMat);
        breakaway.position.set(hoopX * 0.4, hh, 0);
        g.add(breakaway);

        // Red profesional (más detallada)
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            const x1 = hoopX + Math.cos(a) * hoopRadius;
            const z1 = Math.sin(a) * hoopRadius;
            const x2 = hoopX + Math.cos(a) * (hoopRadius * 0.6);
            const z2 = Math.sin(a) * (hoopRadius * 0.6);
            
            const points = [
                new THREE.Vector3(x1, hh, z1),
                new THREE.Vector3(x2, hh - netLen, z2)
            ];
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), netMat);
            g.add(line);

            // Nudos de la red
            if (i % 2 === 0) {
                const nextA = ((i + 1) / 24) * Math.PI * 2;
                const nx1 = hoopX + Math.cos(nextA) * hoopRadius;
                const nz1 = Math.sin(nextA) * hoopRadius;
                const crossLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(x1, hh - 0.3, z1),
                    new THREE.Vector3(nx1, hh - 0.3, nz1)
                ]), netMat);
                g.add(crossLine);
            }
        }

        return g;
    }

    // ARO DERECHO (X positivo) → equipo AZUL ataca aquí
    const hoopRight = buildHoop(true);
    hoopRight.position.set(courtConfig.length / 2 - 0.85, 0, 0);
    hoopRight.rotation.y = Math.PI;
    scene.add(hoopRight);

    // Luces aro derecho
    [[courtConfig.length/2-0.85, hh+0.85, -0.65, 0xff6600, 1.3, 28],
     [courtConfig.length/2-0.85, hh+1.55, -0.9,  0xff4422, 0.55, 18],
     [courtConfig.length/2-0.85, hh+1.2,  0.5,   0xff8844, 0.4,  15]
    ].forEach(([x,y,z,c,i,d]) => {
        const l = new THREE.PointLight(c, i, d);
        l.position.set(x, y, z);
        scene.add(l);
    });

    // ARO IZQUIERDO (X negativo) → equipo ROJO ataca aquí
    const hoopLeft = buildHoop(false);
    hoopLeft.position.set(-courtConfig.length / 2 + 0.85, 0, 0);
    hoopLeft.rotation.y = Math.PI;
    scene.add(hoopLeft);

    [[-courtConfig.length/2+0.85, hh+0.85, -0.65, 0xff6600, 1.3, 28],
     [-courtConfig.length/2+0.85, hh+1.55, -0.9,  0xff4422, 0.55, 18],
     [-courtConfig.length/2+0.85, hh+1.2,  0.5,   0xff8844, 0.4,  15]
    ].forEach(([x,y,z,c,i,d]) => {
        const l = new THREE.PointLight(c, i, d);
        l.position.set(x, y, z);
        scene.add(l);
    });

    // GUARDAR POSICIONES PARA DETECCIÓN DE CANASTA (Estética 2)
    // hoops[0] = aro derecho (AZUL ataca aquí), hoops[1] = aro izquierdo (ROJO ataca aquí)
    hoops.push({ position: new THREE.Vector3(courtConfig.length / 2 - 0.1, hh, 0), attackingTeam: 'blue' });
    hoops.push({ position: new THREE.Vector3(-courtConfig.length / 2 + 0.1, hh, 0), attackingTeam: 'red' });
}

// ============================================================
// 9. PELOTA
// ============================================================

function createBigBall() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ff6600';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 15;
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(canvas.width/2, canvas.height/2, canvas.width/2.5, canvas.height/6, 0, 0, Math.PI*2); ctx.stroke();

    for (let i = 0; i < 300; i++) {
        ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.3) + ')';
        ctx.beginPath();
        ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 3 + 1, 0, Math.PI * 2);
        ctx.fill();
    }

    ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 128, 128),
        new THREE.MeshStandardMaterial({
            map: new THREE.CanvasTexture(canvas),
            roughness: 0.3, metalness: 0.05,
            color: 0xff6600, emissive: 0x442200, emissiveIntensity: 0.1
        })
    );
    ball.castShadow = true;
    ball.userData = { inAir: false, velocity: null };
    ball.position.set(0, 0.8, 0);
    scene.add(ball);
}

// ============================================================
// 10. PERSONAJE CHIBI
// ============================================================

function createChibiPlayer(color, name, bodyTypeIndex) {
    const g = new THREE.Group();
    const bt = bodyTypes[bodyTypeIndex % bodyTypes.length];
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.05 });

    // Cuerpo
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * bt.scaleX, 0.5 * bt.scaleX, 0.95 * bt.scaleY, 12), bodyMat);
    body.position.y = 0.5 * bt.scaleY;
    body.castShadow = true;
    g.add(body);

    // Cabeza
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 64, 64), new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.2 }));
    head.position.y = 1.1 * bt.scaleY;
    g.add(head);

    // Ojos (Animación 4 - Diseño facial estúpido)
    const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const eyeP = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const eyeH = new THREE.MeshStandardMaterial({ color: 0xffffff });
    [[-0.3, 1], [0.3, -1]].forEach(([ex], i) => {
        // Ojos de diferentes tamaños y bizcos para efecto gracioso
        const size = 0.15 + Math.random() * 0.2;
        const ew = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 32), eyeW);
        ew.position.set(ex, 1.25 * bt.scaleY, 0.7); g.add(ew);
        
        const ep = new THREE.Mesh(new THREE.SphereGeometry(size * 0.6, 32, 32), eyeP);
        // Posiciones bizcas
        ep.position.set(ex + (i === 0 ? 0.05 : -0.05), 1.22 * bt.scaleY, 0.7 + size * 0.8); 
        g.add(ep);
    });

    // Nariz (Más grande y roja - Animación 4)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff3300 }));
    nose.position.set(0, 1.05 * bt.scaleY, 0.95); g.add(nose);

    // Sonrisa (Boca abierta y estúpida - Animación 4)
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 16, 32, Math.PI), new THREE.MeshStandardMaterial({ color: 0x660000 }));
    mouth.position.set(0, 0.85 * bt.scaleY, 0.85);
    mouth.rotation.x = Math.PI;
    g.add(mouth);

    // Mejillas exageradas
    [[-0.52, 0.98, 0.68], [0.52, 0.98, 0.68]].forEach(([cx, cy, cz]) => {
        const ch = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff77aa }));
        ch.position.set(cx, cy * bt.scaleY, cz); g.add(ch);
    });

    // Gorra absurda (Animación 4)
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 32), new THREE.MeshStandardMaterial({ color: 0xffff00 }));
    hat.position.y = 1.75 * bt.scaleY; 
    hat.position.x = 0.2; // Gorra torcida
    hat.rotation.z = 0.3;
    hat.scale.set(1, 0.28, 1); 
    g.add(hat);

    // Hélice en la gorra para más ridiculez
    const propeller = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.1), new THREE.MeshStandardMaterial({ color: 0xff00ff }));
    propeller.position.set(0.2, 1.95 * bt.scaleY, 0);
    g.add(propeller);
    g.userData.propeller = propeller;

    // Brazos exagerados
    const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8); // Más largos
    const armMat = new THREE.MeshStandardMaterial({ color });
    const leftArm = new THREE.Mesh(armGeo, armMat); 
    leftArm.position.set(-0.7, 0.9 * bt.scaleY, 0); 
    leftArm.castShadow = true; 
    g.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeo, armMat); 
    rightArm.position.set(0.7, 0.9 * bt.scaleY, 0); 
    rightArm.castShadow = true; 
    g.add(rightArm);

    // Manos (Más grandes - Animación 4)
    const handMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
    const handGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const lh = new THREE.Mesh(handGeo, handMat); lh.position.set(-0.7, -0.6, 0); leftArm.add(lh);
    const rh = new THREE.Mesh(handGeo, handMat); rh.position.set(0.7, -0.6, 0); rightArm.add(rh);

    // Piernas (Animación 4)
    const legGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
    const legMat = new THREE.MeshStandardMaterial({ color });
    const leftLeg = new THREE.Mesh(legGeo, legMat); leftLeg.position.set(-0.35, 0.4 * bt.scaleY, 0); leftLeg.castShadow = true; g.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat); rightLeg.position.set(0.35, 0.4 * bt.scaleY, 0); rightLeg.castShadow = true; g.add(rightLeg);

    // Zapatos gigantes (Animación 4)
    const shoeGeo = new THREE.BoxGeometry(0.6, 0.25, 0.9);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const ls = new THREE.Mesh(shoeGeo, shoeMat); ls.position.set(0, -0.4, 0.2); leftLeg.add(ls);
    const rs = new THREE.Mesh(shoeGeo, shoeMat); rs.position.set(0, -0.4, 0.2); rightLeg.add(rs);

    g.userData = { leftArm, rightArm, leftLeg, rightLeg, body, head, color, bodyTypeIndex, propeller };

    // Etiqueta de nombre (UI 3 - Color por equipo automático)
    const teamHex = color === teamColors.blue.primary ? teamColors.blue.hex : teamColors.red.hex;
    const div = document.createElement('div');
    div.textContent = name;
    div.style.cssText = `color:white;font-size:16px;font-weight:bold;text-shadow:2px 2px 0 black;background:${teamHex};padding:5px 16px;border-radius:40px;border:3px solid white;white-space:nowrap;font-family:Montserrat,sans-serif;backdrop-filter:blur(6px);box-shadow:0 0 15px ${teamHex};`;
    const label = new CSS2DObject(div);
    label.position.set(0, 2.5 * bt.scaleY, 0);
    g.add(label);

    return { group: g, label };
}

// ============================================================
// 11. INICIO DEL JUEGO
// ============================================================

function initGameWithRoom(startX, startZ) {
    // Limpiar sesión anterior
    console.log("initGameWithRoom ejecutándose con startX=", startX, "startZ=", startZ);

    if (myPlayerMesh) { scene.remove(myPlayerMesh); myPlayerMesh = null; }
    players.forEach(p => scene.remove(p.mesh));
    players.clear();

    const myColor = myPlayerTeam === 'blue' ? teamColors.blue.primary : teamColors.red.primary;
    const myBodyType = Math.floor(Math.random() * bodyTypes.length);

    const { group } = createChibiPlayer(myColor, myPlayerName, myBodyType);
    scene.add(group);
    myPlayerMesh = group;
    myPlayerMesh.userData.color = myColor;
    myPlayerMesh.userData.bodyType = myBodyType;
    myPlayerMesh.userData.team = myPlayerTeam;
myPlayerMesh.hasGun = false; // Inicialmente no tiene pistola
    currentPosition = { x: startX, y: 0, z: startZ };
    myPlayerMesh.position.set(startX, 0, startZ);
    velocityX = 0; velocityZ = 0;

    // La primera pelota la tiene el equipo azul (lado izquierdo)
    possession = myPlayerTeam === 'blue' ? 'player' : null;
    ballInAir = false;
    if (possession === 'player') {
        ball.position.set(startX, 1.0, startZ);
        ball.userData.inAir = false;
        ballAuthority = myPlayerId;
    }
    myPlayerScore = 0;
    shotClock = 24;

    // Escuchar jugadores de AMBOS equipos y pelota
    listenRoomPlayers();
    listenForDeaths(); // Escuchar muertes (Mecánica 4)
if (currentRoomData && currentRoomData.puntos_ganar) {
    targetPointsToWin = currentRoomData.puntos_ganar;
} else {
    targetPointsToWin = 10;
}
    // UI
    document.getElementById('game-ui').style.display = 'block';
    document.getElementById('my-name').textContent = myPlayerName;
    const blueScoreEl = document.getElementById('blue-score');
    const redScoreEl = document.getElementById('red-score');
    if (blueScoreEl) blueScoreEl.textContent = teamScores.blue;
    if (redScoreEl) redScoreEl.textContent = teamScores.red;
    
    document.getElementById('shot-clock-value').textContent = '24';
    const badge = document.getElementById('my-team-badge');
    if (badge) {
        badge.textContent = myPlayerTeam === 'blue' ? '🔵' : '🔴';
        badge.style.color = myPlayerTeam === 'blue' ? '#4488ff' : '#ff4444';
    }

    setupPointerLock();

    setInterval(() => { updateShotClock(); updatePowerBar(); }, 1000);

    gameRunning = true;
    gamePaused = false;
    updatePossessionUI();
    showMessage('🎉 ¡Wena ' + myPlayerName + '! Estái en el equipo ' + (myPlayerTeam === 'blue' ? 'AZUL 🔵' : 'ROJO 🔴') + '. ¡Dale con todo, conchetumare! 🏀');
}

// ============================================================
// 12. POINTER LOCK
// ============================================================

function setupPointerLock() {
    const canvas = renderer.domElement;
    canvas.addEventListener('click', () => {
        if (gameRunning && !gamePaused) canvas.requestPointerLock();
    });

    function onLockChange() {
        if (document.pointerLockElement === canvas && !gamePaused) {
            pointerLockActive = true;
            const info = document.getElementById('pointer-lock-info');
            if (info) info.style.opacity = '0';
            document.addEventListener('mousemove', onMouseMove);
        } else {
            pointerLockActive = false;
            const info = document.getElementById('pointer-lock-info');
            if (info) info.style.opacity = '1';
            document.removeEventListener('mousemove', onMouseMove);
        }
    }

    function onMouseMove(e) {
        if (!pointerLockActive || gamePaused) return;
        targetCameraAngleX -= e.movementX * mouseSensitivity;
        targetCameraAngleY += e.movementY * mouseSensitivity;
        targetCameraAngleY = Math.max(-0.6, Math.min(1.0, targetCameraAngleY));
    }

    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mozpointerlockchange', onLockChange);
}

// ============================================================
// 13. CÁMARA
// ============================================================

function stopSprinting() {
    isSprinting = false;
    sprintTime = 0;
    sprintCooldown = sprintCooldownMax;
}

function playRandomSprintSound() {
    const sounds = ['wuaa.mp3', 'wuoo.mp3', 'wiii.mp3'];
    const sound = sounds[Math.floor(Math.random() * sounds.length)];
    const audio = new Audio('assets/sounds/' + sound);
    audio.play().catch(e => console.warn("Audio no encontrado:", sound));
}

function updateFireEffect(deltaTime) {
    if (!myPlayerMesh) return;
    
    // Crear partículas de fuego
    for (let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.1 + Math.random() * 0.2, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 })
        );
        p.position.copy(myPlayerMesh.position);
        p.position.x += (Math.random() - 0.5) * 1.2;
        p.position.z += (Math.random() - 0.5) * 1.2;
        p.position.y += Math.random() * 0.5;
        scene.add(p);
        fireParticles.push({ mesh: p, life: 1.0, vel: new THREE.Vector3((Math.random()-0.5)*2, 2 + Math.random()*2, (Math.random()-0.5)*2) });
    }

    // Actualizar partículas
    for (let i = fireParticles.length - 1; i >= 0; i--) {
        const fp = fireParticles[i];
        fp.life -= deltaTime * 2.5;
        fp.mesh.position.add(fp.vel.clone().multiplyScalar(deltaTime));
        fp.mesh.material.opacity = fp.life;
        fp.mesh.scale.multiplyScalar(0.95);
        if (fp.life <= 0) {
            scene.remove(fp.mesh);
            fireParticles.splice(i, 1);
        }
    }
}

function updateCamera() {
    if (!myPlayerMesh) return;
    cameraAngleX += (targetCameraAngleX - cameraAngleX) * 0.15;
    cameraAngleY += (targetCameraAngleY - cameraAngleY) * 0.15;
    const pos = myPlayerMesh.position;
    camera.position.set(
        pos.x - Math.sin(cameraAngleX) * cameraDistance,
        pos.y + 1.8 + Math.sin(cameraAngleY) * 2,
        pos.z - Math.cos(cameraAngleX) * cameraDistance
    );
    camera.lookAt(pos);
    myPlayerMesh.rotation.y = cameraAngleX;
}

// ============================================================
// 14. MOVIMIENTO
// ============================================================

function handleMovement(deltaTime) {
    if (!gameRunning || gamePaused || !myPlayerMesh || isDead) return;

    // Gestión de Sprint (Mecánica 1)
    if (sprintCooldown > 0) {
        sprintCooldown -= deltaTime;
        const coolText = document.getElementById('sprint-cooldown-text');
        if (coolText) coolText.textContent = "ENFRIANDO: " + Math.max(0, sprintCooldown).toFixed(1) + "s";
        const fill = document.getElementById('sprint-bar-fill');
        if (fill) fill.style.width = '0%';
    } else {
        const coolText = document.getElementById('sprint-cooldown-text');
        if (coolText) coolText.textContent = "LISTO 🔥";
        const fill = document.getElementById('sprint-bar-fill');
        if (fill) fill.style.width = ((sprintMaxTime - sprintTime) / sprintMaxTime * 100) + '%';
    }
    
    const wantsToSprint = (keysPressed['shift'] || keysPressed['capslock']);
    const canSprint = wantsToSprint && sprintCooldown <= 0 && sprintTime < sprintMaxTime;

    if (canSprint) {
        if (!isSprinting) {
            isSprinting = true;
            playRandomSprintSound();
        }
        sprintTime += deltaTime;
        if (sprintTime >= sprintMaxTime) {
            stopSprinting();
        }
    } else {
        if (isSprinting) stopSprinting();
    }

    const currentMaxSpeed = isSprinting ? maxSpeed * 2.0 : maxSpeed;
    
    let moveX = 0, moveZ = 0;
    if (keysPressed['w'] || keysPressed['arrowup'])    moveZ -= 1;
    if (keysPressed['s'] || keysPressed['arrowdown'])  moveZ += 1;
    if (keysPressed['a'] || keysPressed['arrowleft'])  moveX -= 1;
    if (keysPressed['d'] || keysPressed['arrowright']) moveX += 1;

    isMoving = (moveX !== 0 || moveZ !== 0);

    if (isMoving) {
        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        moveX /= len; moveZ /= len;
        const fwd = new THREE.Vector3(-Math.sin(cameraAngleX), 0, -Math.cos(cameraAngleX));
        const rgt = new THREE.Vector3(Math.cos(cameraAngleX), 0, -Math.sin(cameraAngleX));
        const tvX = (fwd.x * moveZ - rgt.x * moveX) * currentMaxSpeed;
        const tvZ = (fwd.z * moveZ - rgt.z * moveX) * currentMaxSpeed;
        velocityX += (tvX - velocityX) * acceleration * deltaTime;
        velocityZ += (tvZ - velocityZ) * acceleration * deltaTime;
    } else {
        velocityX *= (1 - deceleration * deltaTime);
        velocityZ *= (1 - deceleration * deltaTime);
        if (Math.abs(velocityX) < 0.1) velocityX = 0;
        if (Math.abs(velocityZ) < 0.1) velocityZ = 0;
    }

    currentPosition.x = Math.min(Math.max(currentPosition.x + velocityX * deltaTime, -courtConfig.limitX), courtConfig.limitX);
    currentPosition.z = Math.min(Math.max(currentPosition.z + velocityZ * deltaTime, -courtConfig.limitZ), courtConfig.limitZ);

    // Física de salto
    if (isJumping) {
        verticalVelocity -= gravity * deltaTime;
        currentPosition.y += verticalVelocity * deltaTime;
        if (currentPosition.y <= groundY) {
            currentPosition.y = groundY;
            isJumping = false;
            verticalVelocity = 0;
        }
    } else {
        currentPosition.y = groundY;
    }

    myPlayerMesh.position.set(currentPosition.x, currentPosition.y, currentPosition.z);

    // Animación de brazos/piernas
    if (isMoving && !isJumping) {
        animationTime += deltaTime * (isSprinting ? 25 : 15);
        const swing = Math.sin(animationTime) * 1.2;
        const legSwing = Math.sin(animationTime) * 0.8;
        if (myPlayerMesh.userData.leftArm) {
            myPlayerMesh.userData.leftArm.rotation.x = swing;
            myPlayerMesh.userData.rightArm.rotation.x = -swing;
            myPlayerMesh.userData.leftLeg.rotation.x = legSwing;
            myPlayerMesh.userData.rightLeg.rotation.x = -legSwing;
            myPlayerMesh.rotation.z = Math.sin(animationTime * 0.5) * 0.15;
        }
        currentPosition.y = groundY + Math.abs(Math.sin(animationTime * 2)) * 0.15;
        myPlayerMesh.position.y = currentPosition.y;
    } else if (!isJumping) {
        if (myPlayerMesh.userData.leftArm) {
            myPlayerMesh.userData.leftArm.rotation.x = 0;
            myPlayerMesh.userData.rightArm.rotation.x = 0;
            myPlayerMesh.userData.leftLeg.rotation.x = 0;
            myPlayerMesh.userData.rightLeg.rotation.x = 0;
            myPlayerMesh.rotation.z = 0;
        }
    }

    // Girar hélice
    if (myPlayerMesh.userData.propeller) myPlayerMesh.userData.propeller.rotation.y += deltaTime * (isSprinting ? 40 : 20);

    // Mover pelota con jugador
    if (possession === 'player' && !ballInAir && ball) {
        ball.position.set(currentPosition.x, currentPosition.y + 1.2, currentPosition.z);
        ballAuthority = myPlayerId;
    }

    syncPosition();
    if (ballAuthority === myPlayerId) syncBallToFirebase();
}

function updateOtherPlayerFire(mesh, deltaTime, team) {
    if (!mesh) return;
    const fireColor = team === 'blue' ? 0x0044ff : 0xff4400;
    for (let i = 0; i < 2; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.1 + Math.random() * 0.2, 8, 8),
            new THREE.MeshBasicMaterial({ color: fireColor, transparent: true, opacity: 0.8 })
        );
        p.position.copy(mesh.position);
        p.position.x += (Math.random() - 0.5) * 1.5;
        p.position.z += (Math.random() - 0.5) * 1.5;
        scene.add(p);
        fireParticles.push({ mesh: p, life: 1.0, vel: new THREE.Vector3((Math.random()-0.5)*2, 2 + Math.random()*2, (Math.random()-0.5)*2) });
    }
}

function showGiantMessage(text, duration) {
    const div = document.createElement('div');
    div.className = 'global-gun-msg';
    div.style.cssText = `position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);font-size:70px;font-weight:900;color:white;text-shadow:0 0 30px red;text-align:center;z-index:10000;font-family:Orbitron;width:100%;background:rgba(255,0,0,0.6);padding:40px;`;
    div.textContent = text;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), duration);
}

function jump() {
    if (!myPlayerMesh || !gameRunning || gamePaused) return;
    if (!isJumping) {
        isJumping = true;
        verticalVelocity = jumpPower;
        playRandomJumpSound();
        if (myPlayerMesh.userData.leftArm) {
            myPlayerMesh.userData.leftArm.rotation.x = -0.8;
            myPlayerMesh.userData.rightArm.rotation.x = -0.8;
            setTimeout(() => {
                if (myPlayerMesh && myPlayerMesh.userData.leftArm && !isMoving) {
                    myPlayerMesh.userData.leftArm.rotation.x = 0;
                    myPlayerMesh.userData.rightArm.rotation.x = 0;
                }
            }, 300);
        }
        
    }
    
}

// ============================================================
// 15. TIRO
// ============================================================

function shoot() {
    if (!gameRunning || gamePaused || ballInAir || possession !== 'player' || !pointerLockActive) return;

    ballInAir = true;
    ballAuthority = myPlayerId;

    // Dirección exacta de la cámara + arco natural
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const dir = new THREE.Vector3(camDir.x, camDir.y + 0.5, camDir.z).normalize();

    // POTENCIA AUMENTADA X5 (Mecánica solicitada)
    const powerMult = 2.0;
    const minPow = 6 * powerMult, maxPow = 22 * powerMult;
    const power = minPow + (shootPower / shootMaxPower) * (maxPow - minPow);
    const heightBonus = (shootPower / shootMaxPower) * 6 * powerMult;

    // ¿Es triple? Calcular distancia al aro objetivo
    const targetHoopIdx = myPlayerTeam === 'blue' ? 0 : 1;
    const targetHoop = hoops[targetHoopIdx];
    const distToHoop = myPlayerMesh.position.distanceTo(new THREE.Vector3(targetHoop.position.x, myPlayerMesh.position.y, targetHoop.position.z));
    const isThreePoint = distToHoop > courtConfig.threePointLine;

    ball.userData = {
        inAir: true,
        velocity: new THREE.Vector3(
            dir.x * power,
            5 * powerMult + heightBonus + (dir.y * 2 * powerMult),
            dir.z * power
        ),
        isThreePoint,
        shooterTeam: myPlayerTeam,
        shooterId: myPlayerId
    };
    
    lastShooterTeam = myPlayerTeam;
    lastShooterId = myPlayerId;
    possession = null;
    updatePossessionUI();
    showMessage('🏀 ¡TIRO POTENTE X5! Potencia: ' + Math.floor((shootPower / shootMaxPower) * 100) + '% ' + (isThreePoint ? '(TRIPLE)' : ''));

    shootPower = 0;
    const fill = document.getElementById('power-bar-fill');
    const pct  = document.getElementById('power-percent');
    if (fill) fill.style.width = '0%';
    if (pct)  pct.textContent = '0%';

    if (myPlayerMesh.userData.rightArm) {
        myPlayerMesh.userData.rightArm.rotation.x = -1.2;
        myPlayerMesh.userData.rightArm.rotation.z = -0.5;
        setTimeout(() => {
            if (myPlayerMesh && myPlayerMesh.userData.rightArm && !isMoving) {
                myPlayerMesh.userData.rightArm.rotation.x = 0;
                myPlayerMesh.userData.rightArm.rotation.z = -0.3;
            }
        }, 300);
    }
    syncBallToFirebase();
}

// ============================================================
// 16. ROBO / RECOGER PELOTA
// ============================================================

function stealBall() {
    const now = performance.now() / 1000;
    if (now - lastStealTime < stealCooldownMax) {
        showMessage('⏳ Espera un poco, weón: ' + (stealCooldownMax - (now - lastStealTime)).toFixed(1) + 's');
        return false;
    }
    if (!gameRunning || gamePaused) return false;
    if (possession === 'player') { showMessage('❌ ¡Ya tení la pelota, culiao!'); return false; }
    if (!myPlayerMesh) return false;

    const dist = myPlayerMesh.position.distanceTo(ball.position);
    if (dist < 5.0) {
        // Robar exitosamente
        possession = 'player';
        ballInAir = false;
        ball.userData.inAir = false;
        ball.userData.velocity = null;
        ball.position.set(currentPosition.x, currentPosition.y + 1.2, currentPosition.z);
        ballAuthority = myPlayerId;
        lastStealTime = now;
        updatePossessionUI();
        shotClock = 24;
        const sc = document.getElementById('shot-clock-value');
        if (sc) sc.textContent = shotClock;
        
        showMessage(dist > 1.5 ? '🏀 ¡ROBO MAESTRO! Se la quitaste al otro weón' : '🏀 ¡Recogiste la pelota!');
        
        if (myPlayerMesh.userData.rightArm) {
            myPlayerMesh.userData.rightArm.rotation.x = -0.8;
            setTimeout(() => {
                if (myPlayerMesh && myPlayerMesh.userData.rightArm && !isMoving) myPlayerMesh.userData.rightArm.rotation.x = 0;
            }, 300);
        }
        
        // Sincronizar inmediatamente con Firebase para que todos vean el cambio de dueño
        syncBallToFirebase();
        return true;
    } else {
        showMessage('❌ Estái muy lejos, weón: ' + dist.toFixed(1) + 'm (acércate a < 5m)');
        lastStealTime = now - (stealCooldownMax - 0.8);
        return false;
    }
}

function passBall() {
    if (possession !== 'player' || ballInAir || gamePaused) return;
    const dir = new THREE.Vector3(-Math.sin(cameraAngleX), 0.3, -Math.cos(cameraAngleX));
    ballInAir = true;
    ballAuthority = myPlayerId;
    
    const powerMult = 5.0; // También aumentamos potencia del pase para consistencia
    ball.userData = {
        inAir: true,
        velocity: new THREE.Vector3(dir.x * 20 * powerMult, 4.5 * powerMult, dir.z * 20 * powerMult), // Subimos base de 16 a 20
        isPass: true,
        shooterTeam: myPlayerTeam
    };
    possession = null;
    updatePossessionUI();
    if (myPlayerMesh.userData.rightArm) {
        myPlayerMesh.userData.rightArm.rotation.x = -0.5;
        myPlayerMesh.userData.rightArm.rotation.z = -0.8;
        setTimeout(() => {
            if (myPlayerMesh && myPlayerMesh.userData.rightArm && !isMoving) {
                myPlayerMesh.userData.rightArm.rotation.x = 0;
                myPlayerMesh.userData.rightArm.rotation.z = -0.3;
            }
        }, 200);
    }
    showMessage('🎯 ¡Pase POTENTE pal compañero, weón!');
    syncBallToFirebase();
}

// ============================================================
// 18. FÍSICA DE LA PELOTA
// ============================================================

function updateBallPhysics(deltaTime) {
    if (!ball) return;

    // Escalar pelota por posesión (Mecánica 1)
    const isAnyoneHolding = (possession === 'player' && !ballInAir) || (ballAuthority && ballAuthority !== myPlayerId && !ballInAir);
    const targetScale = isAnyoneHolding ? 2.0 : 1.0;
    ball.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    
    // Visibilidad/Brillo aumentado al tener posesión
    if (ball.material) {
        ball.material.emissiveIntensity = isAnyoneHolding ? 0.8 : 0.1;
        ball.material.emissive.setHex(isAnyoneHolding ? 0xffaa00 : 0x442200);
    }

    // Rotar pelota visualmente si está en el aire
    if (ballInAir) {
        ball.rotation.x += 0.2;
        ball.rotation.z += 0.1;
    }

    // Solo la autoridad computa la física
    if (ballAuthority !== myPlayerId) {
        return;
    }

    if (!ballInAir || !ball.userData || !ball.userData.inAir || gamePaused) return;

    const data = ball.userData;
    if (!data.velocity) return;

    // Gravedad
    data.velocity.y -= gravity * deltaTime;
    ball.position.x += data.velocity.x * deltaTime;
    ball.position.y += data.velocity.y * deltaTime;
    ball.position.z += data.velocity.z * deltaTime;

    // ===== DETECCIÓN DE CANASTA =====
    // ===== DETECCIÓN DE CANASTA =====
if (hoops && hoops.length > 0) {
    // Determinar qué aro corresponde al equipo que ataca
    let scoringHoop = null;
    let scoringTeam = null;
    
    // Comprobar los dos aros
    for (let i = 0; i < hoops.length; i++) {
        const hoop = hoops[i];
        const distToHoop = ball.position.distanceTo(hoop.position);
        const isScoring = (distToHoop < 4.5 && 
                           ball.position.y < hoop.position.y + 0.8 && 
                           ball.position.y > hoop.position.y - 0.3 &&
                           Math.abs(data.velocity.y) < 8);
        if (isScoring) {
            scoringHoop = hoop;
            scoringTeam = hoop.attackingTeam; // 'blue' o 'red'
            break;
        }
    }
    
    if (scoringTeam) {
        // Quién anotó? El shooterTeam del balón (quien tiró)
        const shooterTeam = data.shooterTeam;
        if (shooterTeam && shooterTeam === scoringTeam) {
            // Anotación válida: sumar punto al equipo que anotó
            const points = data.isThreePoint ? 3 : 2;
            // Actualizar marcador global en Firebase
            const newScores = { ...teamScores };
            newScores[scoringTeam] += points;
            teamScores = newScores;
            set(ref(database, 'salas/' + currentRoomId + '/puntajes'), newScores);
            
            // Actualizar UI
            const blueScoreEl = document.getElementById('blue-score');
            const redScoreEl = document.getElementById('red-score');
            if (blueScoreEl) blueScoreEl.textContent = teamScores.blue;
            if (redScoreEl) redScoreEl.textContent = teamScores.red;
            // Verificar si se alcanzó el límite de puntos
if (teamScores.blue >= targetPointsToWin || teamScores.red >= targetPointsToWin) {
    const winningTeam = teamScores.blue >= targetPointsToWin ? 'blue' : 'red';
    endGameWithWinner(winningTeam);
    return; // Salir de updateBallPhysics para no seguir procesando
}
            
            // Si el que anotó soy yo, actualizo mi puntaje personal
            if (data.shooterId === myPlayerId) {
                myPlayerScore += points;
                const myScoreEl = document.getElementById('my-score');
                if (myScoreEl) myScoreEl.textContent = myPlayerScore;
                syncPosition();
            }
            
            showScorePopup(points);
            playRandomScoreSound();
            showMessage(`🎉 ¡CANASTA de ${scoringTeam.toUpperCase()}! +${points} 🎉`);
            
            // === ENTREGAR PISTOLA AL EQUIPO CONTRARIO ===
            const rivalTeam = scoringTeam === 'blue' ? 'red' : 'blue';
            giveGunToRandomPlayerOfTeam(rivalTeam);
            
            resetBallAfterScore();
            return;
        }
    }
}

    // Rebote en el suelo
    if (ball.position.y < 0.6) {
        ball.position.y = 0.6;
        data.velocity.y = Math.abs(data.velocity.y) * 0.52;
        data.velocity.x *= 0.88;
        data.velocity.z *= 0.88;

        if (Math.abs(data.velocity.y) < 1.5 && Math.abs(data.velocity.x) < 1.5 && Math.abs(data.velocity.z) < 1.5) {
            ballInAir = false;
            data.inAir = false;
            possession = null;
            ball.position.y = 0.6;
            if (typeof showMessage === 'function') showMessage('¡La pelota quedó botada, agárrala weón! 🏀');
            if (typeof updatePossessionUI === 'function') updatePossessionUI();
            if (typeof syncBallToFirebase === 'function') syncBallToFirebase();
        }
    }

    // Límites de cancha
    if (Math.abs(ball.position.x) > courtConfig.limitX) {
        ball.position.x = Math.sign(ball.position.x) * courtConfig.limitX;
        data.velocity.x *= -0.7;
    }
    if (Math.abs(ball.position.z) > courtConfig.limitZ) {
        ball.position.z = Math.sign(ball.position.z) * courtConfig.limitZ;
        data.velocity.z *= -0.7;
    }

    // Pelota muy alta
    if (ball.position.y > 15) {
        ballInAir = false;
        data.inAir = false;
        ball.position.set(0, 1.2, 0);
        possession = null;
        if (typeof updatePossessionUI === 'function') updatePossessionUI();
        if (typeof showMessage === 'function') showMessage('¡Mandaste la pelota a la chucha! 🏀');
        if (typeof syncBallToFirebase === 'function') syncBallToFirebase();
    }
}

function resetBallAfterScore() {
    ballInAir = false;
    // Verificar si el equipo que anotó NO es mi equipo (es decir, me anotaron a mí)
    if (lastScoringTeam && lastScoringTeam !== myPlayerTeam && !hasRevengeWeapon && !isDead && myPlayerMesh) {
        giveRevengeWeapon();
    }
    if (ball.userData) {
        ball.userData.inAir = false;
        ball.userData.velocity = null;
    }
    possession = null;
    shotClock = 24;
    const sc = document.getElementById('shot-clock-value');
    if (sc) sc.textContent = shotClock;
    ball.position.set(0, 0.8, 0);
    updatePossessionUI();
    syncBallToFirebase();
    // Resetear la variable para la próxima anotación
    lastScoringTeam = null;
}

function giveRevengeWeapon() {
    if (hasRevengeWeapon || isDead) return;
    if (!myPlayerMesh) {
        console.warn("No se pudo crear el arma: myPlayerMesh no existe");
        return;
    }
    hasRevengeWeapon = true;
    revengeCountdown = 2.5;
    
    // Anuncio Global (Mecánica 4)
    showGiantMessage("¡EL " + myPlayerName.toUpperCase() + " TIENE LA PISTOLA, ARRANQUEN WEONES!", 600);

    // Audio recarga
    new Audio('assets/sounds/recarga.mp3').play().catch(e => console.warn("Audio no encontrado: recarga.mp3"));

    // Crear pistola gigante
    const gunGroup = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.5, 16), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.z = 1.2;
    gunGroup.add(gunBody);
    gunGroup.add(gunBarrel);
    
    gunGroup.scale.set(1.5, 1.5, 1.5);
    
    if (myPlayerMesh) {
        myPlayerMesh.add(gunGroup);
        gunGroup.position.set(0.9, 1.2, 0.7);
        revengeWeaponMesh = gunGroup;
    }

    // UI Advertencia con Flash Amarillo (Mecánica 4)
    const flash = document.createElement('div');
    flash.className = 'yellow-flash';
    flash.innerHTML = '<div class="dispara-text">DISPARA</div>';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 700);

    const timer = document.createElement('div');
    timer.id = 'revenge-timer';
    timer.style.cssText = 'position:fixed;top:60%;left:50%;transform:translate(-50%,-50%);color:white;font-size:36px;font-weight:bold;z-index:999;font-family:Orbitron;text-shadow:0 0 10px red;';
    document.body.appendChild(timer);
}

function updateRevengeLogic(deltaTime) {
    if (!hasRevengeWeapon) return;

    revengeCountdown -= deltaTime;
    const timerEl = document.getElementById('revenge-timer');
    if (timerEl) timerEl.textContent = "¡MÁTALO WEÓN!: " + revengeCountdown.toFixed(1) + 's';

    if (revengeCountdown <= 0) {
        discardWeapon();
    }
}

function discardWeapon() {
    if (!hasRevengeWeapon) return;
    hasRevengeWeapon = false;
    const timerEl = document.getElementById('revenge-timer');
    if (timerEl) timerEl.remove();

    if (revengeWeaponMesh && myPlayerMesh) {
        const worldPos = new THREE.Vector3();
        revengeWeaponMesh.getWorldPosition(worldPos);
        const worldQuat = new THREE.Quaternion();
        revengeWeaponMesh.getWorldQuaternion(worldQuat);
        
        myPlayerMesh.remove(revengeWeaponMesh);
        scene.add(revengeWeaponMesh);
        revengeWeaponMesh.position.copy(worldPos);
        revengeWeaponMesh.quaternion.copy(worldQuat);
        
        // Cae al suelo y desaparece en 3s (Mecánica 3)
        revengeDisappearTimer = 3.0;
    }
}

function shootMissile() {
    if (!hasRevengeWeapon || isDead) return;
    
    // Audio disparo (Mecánica 3)
    const sounds = ['disparo.mp3', 'disparo2.mp3'];
    new Audio('assets/sounds/' + sounds[Math.floor(Math.random()*2)]).play().catch(e => console.warn("Audio no encontrado"));

    // Detectar si apunta al rival (Mecánica 3)
    let targetPlayer = null;
    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0); // Centro de la pantalla (crosshair)
    raycaster.setFromCamera(center, camera);
    
    const potentialTargets = [];
    players.forEach(p => {
        if (p.team !== myPlayerTeam) potentialTargets.push(p.mesh);
    });
    
    const intersects = raycaster.intersectObjects(potentialTargets, true);
    if (intersects.length > 0) {
        // Encontrar el objeto raíz del jugador (el group)
        let obj = intersects[0].object;
        while (obj.parent && !obj.userData.team) obj = obj.parent;
        targetPlayer = obj;
    }

    // Crear Misil
    const missileGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.0, 8);
    const missileMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000 });
    const missile = new THREE.Mesh(missileGeo, missileMat);
    missile.rotation.x = Math.PI / 2;
    
    const startPos = new THREE.Vector3();
    revengeWeaponMesh.getWorldPosition(startPos);
    missile.position.copy(startPos);
    
    const startQuat = new THREE.Quaternion();
    revengeWeaponMesh.getWorldQuaternion(startQuat);
    missile.quaternion.copy(startQuat);
    
    scene.add(missile);
    
    missiles.push({
        mesh: missile,
        target: targetPlayer,
        timer: 1.2, // Tarda 1.2s en impactar (Mecánica 3)
        startPos: startPos.clone(),
        initialDir: new THREE.Vector3(0, 0, 1).applyQuaternion(startQuat).normalize()
    });

    // Descartar arma inmediatamente tras disparar
    hasRevengeWeapon = false;
    const timerEl = document.getElementById('revenge-timer');
    if (timerEl) timerEl.remove();
    if (myPlayerMesh && revengeWeaponMesh) myPlayerMesh.remove(revengeWeaponMesh);
    revengeWeaponMesh = null;
}

function updateMissiles(deltaTime) {
    for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        m.timer -= deltaTime;
        
        const progress = 1.0 - (m.timer / 1.2);
        
        if (m.target) {
            // Teledirigido (Mecánica 3)
            const targetPos = m.target.position.clone().add(new THREE.Vector3(0, 1, 0));
            m.mesh.position.lerpVectors(m.startPos, targetPos, progress);
            m.mesh.lookAt(targetPos);
        } else {
            // Fallo: Se desvía (Mecánica 3)
            const forward = m.initialDir.clone().multiplyScalar(progress * 30);
            const deviation = new THREE.Vector3(0, Math.sin(progress * 5) * 2, 0);
            m.mesh.position.copy(m.startPos).add(forward).add(deviation);
        }

        if (m.timer <= 0) {
            if (m.target) {
                // Impacto (Mecánica 4)
                handleImpact(m.target);
            }
            scene.remove(m.mesh);
            missiles.splice(i, 1);
        }
    }
}

function handleImpact(targetMesh) {
    // Buscar el ID del jugador impactado
    let targetId = null;
    players.forEach((p, id) => {
        if (p.mesh === targetMesh) targetId = id;
    });

    if (targetId) {
        // Enviar evento de muerte a través de Firebase (simulado aquí por ahora, idealmente usar un nodo 'events')
        const deathRef = ref(database, 'salas/' + currentRoomId + '/muertes/' + targetId);
        set(deathRef, { killerName: myPlayerName, time: Date.now() });
    }
}

function listenForDeaths() {
    if (!currentRoomId || !myPlayerId) return;
    onValue(ref(database, 'salas/' + currentRoomId + '/muertes/' + myPlayerId), (snap) => {
        const data = snap.val();
        if (data && !isDead) {
            onKilled(data.killerName);
            remove(ref(database, 'salas/' + currentRoomId + '/muertes/' + myPlayerId));
        }
    });
}

function onKilled(killerName) {
    isDead = true;
    respawnTimer = 2.5;
    
    // Mensaje de muerte (Mecánica 5)
    const msg = document.createElement('div');
    msg.id = 'death-msg';
    msg.style.cssText = 'position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);color:red;font-size:48px;font-weight:900;z-index:2000;font-family:Orbitron;text-align:center;';
    msg.innerHTML = killerName + ' te mató XD<br><span id="respawn-countdown" style="font-size:32px;color:white;">2.5</span>';
    document.body.appendChild(msg);

    // Ocultar player
    if (myPlayerMesh) myPlayerMesh.visible = false;
    if (hasRevengeWeapon) discardWeapon();
}

function updateRespawn(deltaTime) {
    if (!isDead) return;
    respawnTimer -= deltaTime;
    const countEl = document.getElementById('respawn-countdown');
    if (countEl) countEl.textContent = "REVIVIENDO EN: " + Math.max(0, respawnTimer).toFixed(1) + "s";

    if (respawnTimer <= 0) {
        isDead = false;
        document.getElementById('death-msg')?.remove();
        if (myPlayerMesh) {
            myPlayerMesh.visible = true;
            // Respawn en posición base (Chilean style)
            const baseX = myPlayerTeam === 'blue' ? -18 : 18;
            currentPosition.x = baseX + (Math.random() - 0.5) * 4;
            currentPosition.z = (Math.random() - 0.5) * 10;
            currentPosition.y = 0;
            myPlayerMesh.position.set(currentPosition.x, 0, currentPosition.z);
        }
    }
}

function updateShotClock() {
    if (!gameRunning || gamePaused) return;
    if (possession === 'player' && !ballInAir) {
        // Se maneja en handleMovement
    }
}

function updatePowerBar() {
    if (shooting && possession === 'player' && !ballInAir && pointerLockActive && !gamePaused) {
        shootPower += 0.14; 
        if (shootPower > shootMaxPower) shootPower = shootMaxPower;
        const pct = (shootPower / shootMaxPower) * 100;
        const fill = document.getElementById('power-bar-fill');
        const pctEl = document.getElementById('power-percent');
        if (fill) fill.style.width = pct + '%';
        if (pctEl) pctEl.textContent = Math.floor(pct) + '%';
    }
}

function updatePossessionUI() {
    const text = document.getElementById('possession-text');
    const ballDiv = document.querySelector('.possession-ball');
    if (!text || !ballDiv) return;
    if (possession === 'player') {
        text.textContent = '🏀 TIENES LA PELOTA, WEÓN 🏀';
        ballDiv.style.background = '#4CAF50';
    } else {
        text.textContent = '❌ PELOTA LIBRE / OTRO CULIAO ❌';
        ballDiv.style.background = '#FF5722';
    }
}

function showMessage(msg) {
    const existing = document.querySelector('.game-message');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'game-message';
    div.textContent = msg;
    const ui = document.getElementById('game-ui');
    if (ui) ui.appendChild(div);
    setTimeout(() => { if (div.parentNode) div.remove(); }, 2500);
}

function showScorePopup(points) {
    const container = document.getElementById('score-popup-container');
    if (!container) return;
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = points === 3 ? '🏆 +3 🏆' : '⭐ +' + points + ' ⭐';
    popup.style.color = points === 3 ? '#FF9800' : '#4CAF50';
    container.appendChild(popup);
    setTimeout(() => { if (popup.parentNode) popup.remove(); }, 1500);
}

function togglePauseMenu() {
    const menu = document.getElementById('pause-menu');
    if (!menu) return;
    if (gamePaused) {
        gamePaused = false;
        menu.classList.remove('active');
        if (renderer) renderer.domElement.requestPointerLock();
    } else {
        gamePaused = true;
        menu.classList.add('active');
        const pn = document.getElementById('pause-player-name');
        const ps = document.getElementById('pause-score');
        if (pn) pn.textContent = myPlayerName;
        if (ps) ps.textContent = myPlayerScore;
        if (pointerLockActive) document.exitPointerLock();
    }
}

// ============================================================
// 22. EVENTOS
// ============================================================

function setupEventListeners() {
    window.addEventListener('keydown', (e) => {
        if (!e.key) return;
         if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
        const key = e.key.toLowerCase();

        if (key === 'escape') {
            if (gameRunning && myPlayerMesh) { togglePauseMenu(); e.preventDefault(); }
            return;
        }
        if (gamePaused) return;
        if (key === 'e') { stealBall(); e.preventDefault(); return; }

        keysPressed[key] = true;

        if (key === ' ') { jump(); e.preventDefault(); }
    });

    window.addEventListener('keyup', (e) => {
        keysPressed[e.key.toLowerCase()] = false;
    });

    window.addEventListener('mousedown', (e) => {
        if (gamePaused || !gameRunning || !myPlayerMesh || isDead) return;
        
        // Disparar misil si tiene arma (Mecánica 3)
        if (hasRevengeWeapon) {
            shootMissile();
            return;
        }

        if (e.button === 0 && !ballInAir && possession === 'player' && pointerLockActive) {
            shooting = true;
            shootPower = 0;
            const pbc = document.getElementById('power-bar-container');
            if (pbc) pbc.classList.add('active');
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (gamePaused) return;
        if (e.button === 0 && shooting && !ballInAir && possession === 'player' && pointerLockActive) {
            shoot();
        }
        shooting = false;
        const pbc = document.getElementById('power-bar-container');
        if (pbc) pbc.classList.remove('active');
    });

    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!gamePaused && gameRunning && !ballInAir && possession === 'player' && myPlayerMesh && pointerLockActive) passBall();
        return false;
    });

    // Botones UI
    document.getElementById('resume-game')?.addEventListener('click', togglePauseMenu);
    document.getElementById('exit-game')?.addEventListener('click', exitToMenu);
    document.getElementById('create-room-btn')?.addEventListener('click', () => {
    // Primero pedimos el nombre (modal)
    document.getElementById('name-modal').classList.add('active');
    // Guardamos que estamos en modo "crear sala"
    window.pendingCreateRoom = true;
});
    document.getElementById('confirm-create-room')?.addEventListener('click', createRoom);
    document.getElementById('cancel-create-room')?.addEventListener('click', () => document.getElementById('create-room-modal').classList.remove('active'));
    document.getElementById('join-blue-btn')?.addEventListener('click', () => {
    if (!document.getElementById('join-blue-btn').disabled) showNameModal('blue');
});
document.getElementById('join-red-btn')?.addEventListener('click', () => {
    if (!document.getElementById('join-red-btn').disabled) showNameModal('red');
});document.getElementById('confirm-name-btn')?.addEventListener('click', confirmJoinGame);
    document.getElementById('cancel-name-btn')?.addEventListener('click', () => document.getElementById('name-modal').classList.remove('active'));
    document.getElementById('back-to-rooms')?.addEventListener('click', backToRooms);
    document.getElementById('player-name-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') confirmJoinGame(); });
    document.getElementById('room-name-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') createRoom(); });
}

// ============================================================
// 23. BUCLE DE ANIMACIÓN
// ============================================================

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    let dt = Math.min(0.033, (now - (lastDeltaTimeFrame || now)) / 1000);
    lastDeltaTimeFrame = now;
    if (dt < 0.001) dt = 0.016;

    if (myPlayerMesh && gameRunning && !gamePaused) {
        // Solo la autoridad computa la física
        if (ballAuthority !== myPlayerId) {
            // Si no soy la autoridad, pero alguien la tiene, forzar la posición localmente
            if (!ballInAir && ballAuthority) {
                const possessor = players.get(ballAuthority);
                if (possessor && possessor.mesh) {
                    ball.position.set(possessor.mesh.position.x, possessor.mesh.position.y + 1.2, possessor.mesh.position.z);
                }
            }
            
            // Si no soy la autoridad, igual actualizo efectos visuales como el fuego de otros
            if (typeof players !== 'undefined') {
                players.forEach(p => {
                    if (p.isSprinting && typeof updateOtherPlayerFire === 'function') updateOtherPlayerFire(p.mesh, dt, p.team);
                });
            }
        } else {
            // Si soy la autoridad, actualizar mi propio fuego
            if (typeof isSprinting !== 'undefined' && isSprinting && typeof updateFireEffect === 'function') {
                updateFireEffect(dt);
            }
        }

        handleMovement(dt);
        updateBallPhysics(dt);
        updateCamera();
        
        // Actualizar nuevas lógicas
        updateRevengeLogic(dt);
        updateMissiles(dt);
        updateRespawn(dt);
        
        // Desaparecer arma descartada
        if (revengeDisappearTimer > 0) {
            revengeDisappearTimer -= dt;
            if (revengeDisappearTimer <= 0 && revengeWeaponMesh && !hasRevengeWeapon) {
                scene.remove(revengeWeaponMesh);
                revengeWeaponMesh = null;
            }
        }
    }

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

// ============================================================
// 24. ARRANQUE
// ============================================================

window.onload = () => {
    initThree();
    setupEventListeners();
    loadRooms();

    onValue(ref(database, '.info/connected'), (snap) => {
        const connStatus = document.getElementById('conn-status');
        if (!connStatus) return;
        if (snap.val() === true) {
            connStatus.className = 'connection-status online';
            connStatus.innerHTML = '🟢 Conectado';
        } else {
            connStatus.className = 'connection-status offline';
            connStatus.innerHTML = '🔴 Desconectado';
        }
    });
};



// Entrega una pistola a un jugador aleatorio del equipo rival (que no sea yo)
function giveGunToRandomPlayerOfTeam(team) {
    // Buscar jugadores de ese equipo (excluyéndome a mí mismo)
    const candidates = [];
    for (let [id, player] of players) {
        if (player.team === team && id !== myPlayerId) {
            candidates.push({ id, player });
        }
    }
    if (candidates.length === 0) {
        showMessage(`No hay jugadores en el equipo ${team} para darles la pistola`);
        return;
    }
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const { player } = candidates[randomIndex];
    
    if (player.hasGun) {
        showMessage(`${player.name} ya tiene pistola, no se le da otra.`);
        return;
    }
    
    // Crear modelo de pistola
    const gunGroup = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7 }));
    barrel.position.z = 0.2;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.1), new THREE.MeshStandardMaterial({ color: 0x884422 }));
    grip.position.y = -0.1;
    grip.position.z = -0.05;
    const trigger = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({ color: 0xaa8866 }));
    trigger.position.set(0.05, -0.05, 0.1);
    gunGroup.add(barrel, grip, trigger);
    
    // Posición en la mano del rival
    gunGroup.position.set(0.55, 0.85, 0.35);
    gunGroup.rotation.z = -0.2;
    gunGroup.rotation.x = 0.3;
    player.mesh.add(gunGroup);
    
    player.hasGun = true;
    player.gunMesh = gunGroup;
    
    // Mostrar mensaje (solo al que anotó o global)
    showMessage(`🔫 ¡${player.name} (${team.toUpperCase()}) ha recibido una pistola! Disparará cada 2 segundos.`);
    
    // Configurar intervalo de disparo automático
    if (player.shootInterval) clearInterval(player.shootInterval);
    player.shootInterval = setInterval(() => {
        if (!player.hasGun || gamePaused || !gameRunning) return;
        // El rival dispara hacia el jugador que anotó (o hacia el más cercano)
        let target = myPlayerMesh;
        // Buscar al jugador que anotó (sería el que tiene el balón o el último shooter)
        if (lastShooterTeam && lastShooterTeam !== team) {
            // Podríamos buscar al jugador específico, pero por simplicidad dispara a mí
        }
        shootFromRival(player, target);
    }, 2000); // Cada 2 segundos
    
    // Temporizador: 5 segundos y luego la pistola cae y explota
    if (player.gunTimer) clearTimeout(player.gunTimer);
    player.gunTimer = setTimeout(() => {
        if (player.hasGun && player.gunMesh) {
            dropAndExplodeGun(player);
            if (player.shootInterval) clearInterval(player.shootInterval);
            delete player.shootInterval;
        }
    }, 5000);
}

// Función para que un rival dispare un proyectil hacia un objetivo
function shootFromRival(shooter, targetMesh) {
    if (!shooter.mesh || !targetMesh) return;
    
    // Crear proyectil (una esfera roja)
    const bulletGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const bulletMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200 });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    bullet.position.copy(shooter.mesh.position);
    bullet.position.y += 1.0;
    scene.add(bullet);
    
    // Dirección hacia el objetivo
    const direction = new THREE.Vector3().subVectors(targetMesh.position, bullet.position).normalize();
    const speed = 12;
    const velocity = direction.multiplyScalar(speed);
    
    bullet.userData = { velocity, life: 3.0, target: targetMesh };
    
    function animateBullet() {
        if (!bullet.parent) return;
        bullet.position.x += bullet.userData.velocity.x * 0.016;
        bullet.position.y += bullet.userData.velocity.y * 0.016;
        bullet.position.z += bullet.userData.velocity.z * 0.016;
        bullet.userData.life -= 0.016;
        
        // Colisión con el jugador objetivo
        if (bullet.position.distanceTo(targetMesh.position) < 0.8) {
            scene.remove(bullet);
            // Efecto: robar la pelota si el objetivo la tiene
            if (possession === 'player' && myPlayerMesh === targetMesh) {
                possession = null;
                ballInAir = false;
                ball.userData.inAir = false;
                showMessage(`💥 ¡Te dieron con la pistola! Perdiste la pelota.`);
                updatePossessionUI();
                syncBallToFirebase();
            } else {
                showMessage(`💥 ¡Bala impactada!`);
            }
            return;
        }
        
        if (bullet.userData.life <= 0 || bullet.position.y < 0 || Math.abs(bullet.position.x) > 40 || Math.abs(bullet.position.z) > 40) {
            scene.remove(bullet);
        } else {
            requestAnimationFrame(animateBullet);
        }
    }
    requestAnimationFrame(animateBullet);
}

// Hace que la pistola caiga al suelo y explote
function dropAndExplodeGun(rival) {
    if (!rival || !rival.gunMesh) return;
    const gun = rival.gunMesh;
    rival.mesh.remove(gun);
    rival.hasGun = false;
    delete rival.gunMesh;
    
    gun.position.copy(rival.mesh.position);
    gun.position.y += 0.5;
    scene.add(gun);
    
    let fallY = gun.position.y;
    const fallInterval = setInterval(() => {
        if (!gun.parent) { clearInterval(fallInterval); return; }
        fallY -= 0.1;
        gun.position.y = fallY;
        if (fallY <= 0.2) {
            clearInterval(fallInterval);
            createExplosion(gun.position.clone());
            scene.remove(gun);
            showMessage("💥 ¡La pistola explotó!");
        }
    }, 50);
}

function createExplosion(position) {
    for (let i = 0; i < 15; i++) {
        const particle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff2200 }));
        particle.position.copy(position);
        scene.add(particle);
        const vx = (Math.random() - 0.5) * 3;
        const vz = (Math.random() - 0.5) * 3;
        const vy = Math.random() * 2;
        let life = 0.6;
        const animateParticle = () => {
            if (life <= 0) { scene.remove(particle); return; }
            particle.position.x += vx * 0.1;
            particle.position.z += vz * 0.1;
            particle.position.y += vy * 0.1;
            life -= 0.05;
            requestAnimationFrame(animateParticle);
        };
        animateParticle();
    }
}
function playRandomScoreSound() {
    const sounds = ['encesta1.mp3', 'encesta2.mp3', 'encesta3.mp3'];
    const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
    const audio = new Audio('assets/sounds/' + randomSound);
    audio.play().catch(e => console.warn("Audio no encontrado:", randomSound));
}
function endGameWithWinner(winningTeam) {
    if (gameFinished) return;
    gameFinished = true;
    gameRunning = false;

    // Reproducir audio de victoria aleatorio
    const winSounds = ['ganar1.mp3', 'ganar2.mp3', 'ganar3.mp3'];
    const randomWin = winSounds[Math.floor(Math.random() * winSounds.length)];
    const audio = new Audio('assets/sounds/' + randomWin);
    audio.play().catch(e => console.warn("Audio de victoria no encontrado:", randomWin));

    // Mostrar mensaje gigante de ganador
    const winnerName = winningTeam === 'blue' ? '🔵 EQUIPO AZUL 🔵' : '🔴 EQUIPO ROJO 🔴';
    showGiantMessage(`🏆 ¡${winnerName} HA GANADO! 🏆`, 5000);

    // Deshabilitar controles adicionales y mostrar opción para volver a salas
    const winnerMsg = document.createElement('div');
    winnerMsg.style.cssText = 'position:fixed; top:30%; left:50%; transform:translate(-50%,-50%); background:gold; color:black; font-size:48px; font-weight:900; padding:30px; border-radius:30px; z-index:10000; font-family:Orbitron; text-align:center;';
    winnerMsg.innerHTML = `¡${winnerName} GANÓ!<br><button id="back-after-win" style="margin-top:20px; padding:10px 30px; font-size:24px; cursor:pointer;">Volver a Salas</button>`;
    document.body.appendChild(winnerMsg);

    document.getElementById('back-after-win')?.addEventListener('click', () => {
        winnerMsg.remove();
        backToRooms();
        
    });

    // Opcional: detener la pelota y el movimiento
    possession = null;
    ballInAir = false;
    if (ball.userData) ball.userData.velocity = null;
}
function playRandomJumpSound() {
    const sounds = ['saltar1.mp3', 'saltar2.mp3', 'saltar3.mp3'];
    const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
    const audio = new Audio('assets/sounds/' + randomSound);
    audio.play().catch(e => console.warn("Audio no encontrado:", randomSound));
}

function playSoundGlobal(soundType) {
    // 1. Reproducir localmente
    let soundFile = '';
    switch(soundType) {
        case 'score':
            const scoreSounds = ['encesta1.mp3', 'encesta2.mp3', 'encesta3.mp3'];
            soundFile = scoreSounds[Math.floor(Math.random() * scoreSounds.length)];
            break;
        case 'win':
            const winSounds = ['ganar1.mp3', 'ganar2.mp3', 'ganar3.mp3'];
            soundFile = winSounds[Math.floor(Math.random() * winSounds.length)];
            break;
        case 'jump':
            const jumpSounds = ['saltar1.mp3', 'saltar2.mp3', 'saltar3.mp3'];
            soundFile = jumpSounds[Math.floor(Math.random() * jumpSounds.length)];
            break;
        default: return;
    }
    const audio = new Audio('assets/sounds/' + soundFile);
    audio.play().catch(e => console.warn("Audio no encontrado:", soundFile));

    // 2. Enviar evento a Firebase para que otros lo escuchen
    if (soundEventsRef) {
        push(soundEventsRef, {
            type: soundType,
            playerId: myPlayerId,
            timestamp: Date.now()
        });
    }
}
function startRoomCleanupScheduler() {
    setInterval(() => {
        const roomsRef = ref(database, 'salas');
        onValue(roomsRef, (snapshot) => {
            const rooms = snapshot.val();
            if (!rooms) return;
            const now = Date.now();
            Object.entries(rooms).forEach(([roomId, room]) => {
                if (room.lastEmptyCheck && (now - room.lastEmptyCheck) > 15000) { // 15 segundos
                    // Eliminar la sala si no es la actual (para no echar al jugador)
                    if (roomId !== currentRoomId) {
                        remove(ref(database, 'salas/' + roomId));
                        console.log(`Sala ${roomId} eliminada por inactividad (vacía >15s)`);
                    }
                }
            });
        }, { onlyOnce: true });
    }, 10000); // cada 10 segundos
}

function checkAndScheduleRoomCleanup(roomId, roomData) {
    const blueCount = roomData.equipos?.azul ? Object.keys(roomData.equipos.azul).length : 0;
    const redCount = roomData.equipos?.rojo ? Object.keys(roomData.equipos.rojo).length : 0;
    const isEmpty = (blueCount + redCount === 0);
    
    if (isEmpty) {
        // Si está vacía y no hay marca de tiempo, poner la actual
        if (!roomData.lastEmptyCheck) {
            set(ref(database, 'salas/' + roomId + '/lastEmptyCheck'), Date.now());
        }
    } else {
        // Si no está vacía, borrar la marca de tiempo (si existe)
        if (roomData.lastEmptyCheck) {
            set(ref(database, 'salas/' + roomId + '/lastEmptyCheck'), null);
        }
    }
}
