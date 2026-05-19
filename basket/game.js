// game.js - Sincronización completa en tiempo real (todos ven la pelota, el poseedor, robos y lanzamientos)
const firebaseConfig = {
    apiKey: "AIzaSyCSqgJA6uL8SkY-kphhuaR9TuGPulucPic",
    authDomain: "ajedrez-65b15.firebaseapp.com",
    databaseURL: "https://ajedrez-65b15-default-rtdb.firebaseio.com",
    projectId: "ajedrez-65b15",
    storageBucket: "ajedrez-65b15.firebasestorage.app",
    messagingSenderId: "501222935015",
    appId: "1:501222935015:web:bb08aeab5af07a77eb1542"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const CANVAS_W = 1300, CANVAS_H = 700;
const PLAYER_RADIUS = 18, BALL_RADIUS = 12;
const HOOP_POS = { left: { x: 80, y: CANVAS_H/2 }, right: { x: CANVAS_W-80, y: CANVAS_H/2 } };
const SCORE_DIST = 35;
const BASE_SPEED = 3.8;
const SPRINT_MULT = 2.0;
const SPRINT_DUR = 3.0;
const SPRINT_CD = 4.0;
const STEAL_DIST = 55;
const MAX_SHOT_POWER = 26;
const CHARGE_TIME = 2.0;
const SHOT_CLOCK_TIME = 5.0;
const MATCH_DUR = 120;
const BALL_FRICTION = 0.98;

let localPlayer = null, currentRoomRef = null;
let playersMap = new Map();
let ball = { x: CANVAS_W/2, y: CANVAS_H/2, vx: 0, vy: 0, holderId: null };
let scores = { blue: 0, red: 0 };
let gameActive = false;
let matchTime = MATCH_DUR;
let matchInterval = null;
let localInput = { up: false, down: false, left: false, right: false, sprint: false };
let lastTimestamp = 0;
let sprintRemaining = SPRINT_DUR;
let sprintOnCooldown = false;
let sprintCdTimer = 0;
let localShotClock = 0;

let isCharging = false;
let chargePower = 0;
let chargeStartTime = 0;

let playerImage = new Image();
playerImage.src = "mockey.webp";
let imageLoaded = false;
playerImage.onload = () => { imageLoaded = true; };

let canvas, ctx, menuContainer, gameContainer, roomsListDiv, playerNameInput;
let blueScoreSpan, redScoreSpan, sprintFillDiv, shotClockSpan, gameTimerSpan;
let powerBarContainer, powerFillDiv;

// ========== DIBUJO DE CANCHA ==========
function drawCourt() {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#c89d6e');
    grad.addColorStop(1, '#a56e3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(CANVAS_W/2, CANVAS_H/2, 75, 0, 2*Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CANVAS_W/2, 0);
    ctx.lineTo(CANVAS_W/2, CANVAS_H);
    ctx.stroke();
    ctx.fillStyle = 'rgba(42, 111, 219, 0.3)';
    ctx.fillRect(CANVAS_W-130, CANVAS_H/2-130, 110, 260);
    ctx.fillStyle = 'rgba(227, 66, 52, 0.3)';
    ctx.fillRect(20, CANVAS_H/2-130, 110, 260);
    ctx.strokeRect(20, CANVAS_H/2-130, 110, 260);
    ctx.strokeRect(CANVAS_W-130, CANVAS_H/2-130, 110, 260);
    ctx.beginPath();
    ctx.ellipse(80, CANVAS_H/2, 165, 135, 0, -Math.PI/2.5, Math.PI/2.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(CANVAS_W-80, CANVAS_H/2, 165, 135, 0, Math.PI/2.5, -Math.PI/2.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CANVAS_W/2, CANVAS_H/2, 25, 0, 2*Math.PI);
    ctx.stroke();
    function drawHoop(x, y) {
        ctx.fillStyle = '#2c2c2c';
        ctx.fillRect(x-18, y-35, 36, 8);
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x-15, y-27, 30, 6);
        ctx.fillStyle = '#FF7700';
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, 2*Math.PI);
        ctx.fill();
        ctx.fillStyle = '#E65C00';
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, 2*Math.PI);
        ctx.fill();
        for(let i=0; i<8; i++) {
            let angle = -Math.PI/2 + (i * Math.PI/4);
            let dx = Math.cos(angle)*14;
            let dy = Math.sin(angle)*14;
            ctx.beginPath();
            ctx.moveTo(x+dx, y+dy);
            ctx.lineTo(x+dx*0.7, y+dy*0.7 + 12);
            ctx.strokeStyle = '#CCC';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }
    drawHoop(HOOP_POS.left.x, HOOP_POS.left.y);
    drawHoop(HOOP_POS.right.x, HOOP_POS.right.y);
    ctx.restore();
}

function drawGame() {
    drawCourt();
    // Pelota (dibujar siempre según ball global)
    ctx.fillStyle = '#FFA500';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, 2*Math.PI);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(ball.x-3, ball.y-3, 3, 0, 2*Math.PI);
    ctx.fill();

    // Dibujar todos los jugadores (incluyendo al local)
    playersMap.forEach(p => {
        if (imageLoaded) {
            ctx.drawImage(playerImage, p.x-PLAYER_RADIUS, p.y-PLAYER_RADIUS, PLAYER_RADIUS*2, PLAYER_RADIUS*2);
        } else {
            ctx.fillStyle = p.team === 'blue' ? '#2A6FDB' : '#E34234';
            ctx.beginPath();
            ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, 2*Math.PI);
            ctx.fill();
        }
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px "Inter"';
        ctx.fillText(p.name || '?', p.x-18, p.y-18);
        // Mostrar pelota sobre el poseedor (si tiene la pelota)
        if (p.hasBall) {
            ctx.fillStyle = '#FFD966';
            ctx.beginPath();
            ctx.arc(p.x+5, p.y-8, 6, 0, 2*Math.PI);
            ctx.fill();
        }
    });

    // Dibujar jugador local (si no está ya en playersMap, pero normalmente sí)
    if (localPlayer && localPlayer.x) {
        if (imageLoaded) {
            ctx.drawImage(playerImage, localPlayer.x-PLAYER_RADIUS, localPlayer.y-PLAYER_RADIUS, PLAYER_RADIUS*2, PLAYER_RADIUS*2);
        } else {
            ctx.fillStyle = localPlayer.team === 'blue' ? '#2A6FDB' : '#E34234';
            ctx.beginPath();
            ctx.arc(localPlayer.x, localPlayer.y, PLAYER_RADIUS, 0, 2*Math.PI);
            ctx.fill();
        }
        ctx.fillStyle = '#FFD966';
        ctx.font = 'bold 14px "Inter"';
        ctx.fillText(localPlayer.name || 'Tú', localPlayer.x-18, localPlayer.y-18);
        if (localPlayer.hasBall && !imageLoaded) {
            ctx.fillStyle = '#FFD966';
            ctx.beginPath();
            ctx.arc(localPlayer.x+5, localPlayer.y-8, 6, 0, 2*Math.PI);
            ctx.fill();
        }
        if (localPlayer.hasBall && gameActive) {
            if (isCharging) {
                let percent = Math.floor(chargePower * 100);
                ctx.fillStyle = '#ffaa00';
                ctx.font = 'bold 18px "Orbitron"';
                ctx.fillText(`💪 CARGANDO ${percent}%`, localPlayer.x-80, localPlayer.y-35);
            } else {
                ctx.fillStyle = '#FFD966';
                ctx.font = 'bold 16px "Orbitron"';
                ctx.fillText('🏀 Mantén ESPACIO para cargar', localPlayer.x-100, localPlayer.y-28);
            }
        }
    }

    if (!gameActive && currentRoomRef) {
        ctx.font = 'bold 28px "Orbitron"';
        ctx.fillStyle = '#FFD966';
        ctx.fillText('ESPERANDO JUGADORES...', CANVAS_W/2-180, CANVAS_H/2);
    }
}

// ========== FÍSICA Y SINCRONIZACIÓN EN TIEMPO REAL ==========
function updatePhysics(delta) {
    if (!localPlayer || !gameActive) return;

    // Movimiento del jugador local
    let speed = BASE_SPEED;
    if (localInput.sprint && sprintRemaining > 0 && !sprintOnCooldown) {
        speed *= SPRINT_MULT;
        sprintRemaining -= delta;
        if (sprintRemaining <= 0) { sprintRemaining = 0; sprintOnCooldown = true; sprintCdTimer = SPRINT_CD; }
    } else if (sprintOnCooldown) {
        sprintCdTimer -= delta;
        if (sprintCdTimer <= 0) { sprintOnCooldown = false; sprintRemaining = SPRINT_DUR; }
    } else if (!localInput.sprint && sprintRemaining < SPRINT_DUR && !sprintOnCooldown) {
        sprintRemaining += delta * 0.8;
        if (sprintRemaining > SPRINT_DUR) sprintRemaining = SPRINT_DUR;
    }
    let mx = (localInput.right?1:0) - (localInput.left?1:0);
    let my = (localInput.down?1:0) - (localInput.up?1:0);
    if (mx || my) { let len = Math.hypot(mx,my); mx/=len; my/=len; }
    localPlayer.vx = mx * speed;
    localPlayer.vy = my * speed;
    localPlayer.vx *= 0.96;
    localPlayer.vy *= 0.96;
    localPlayer.x += localPlayer.vx;
    localPlayer.y += localPlayer.vy;
    // bordes
    if (localPlayer.x - PLAYER_RADIUS < 20) { localPlayer.x = 20+PLAYER_RADIUS; localPlayer.vx *= -0.5; }
    if (localPlayer.x + PLAYER_RADIUS > CANVAS_W-20) { localPlayer.x = CANVAS_W-20-PLAYER_RADIUS; localPlayer.vx *= -0.5; }
    if (localPlayer.y - PLAYER_RADIUS < 20) { localPlayer.y = 20+PLAYER_RADIUS; localPlayer.vy *= -0.5; }
    if (localPlayer.y + PLAYER_RADIUS > CANVAS_H-20) { localPlayer.y = CANVAS_H-20-PLAYER_RADIUS; localPlayer.vy *= -0.5; }

    // Robo solicitado
    if (window.stealRequest) { window.stealRequest = false; attemptSteal(); }

    // COLISIÓN CON PELOTA: si la pelota está libre y el jugador local la toca
    if (!ball.holderId && !localPlayer.hasBall && Math.hypot(localPlayer.x-ball.x, localPlayer.y-ball.y) < PLAYER_RADIUS + BALL_RADIUS + 5) {
        takeBall(localPlayer);
    }

    // Si el jugador local tiene la pelota (es el poseedor), actualizar su posición y shot clock
    if (localPlayer.hasBall && ball.holderId === localPlayer.id) {
        let ang = Math.atan2(localPlayer.vy, localPlayer.vx);
        ball.x = localPlayer.x + Math.cos(ang)*(PLAYER_RADIUS+BALL_RADIUS);
        ball.y = localPlayer.y + Math.sin(ang)*(PLAYER_RADIUS+BALL_RADIUS);
        ball.vx = localPlayer.vx;
        ball.vy = localPlayer.vy;
        localShotClock -= delta;
        if (localShotClock <= 0) {
            loseBallTimeout();
        }
        updateFireball();
    }

    // MOVIMIENTO DE LA PELOTA CUANDO ESTÁ LIBRE (sin poseedor)
    if (!ball.holderId) {
        ball.vx *= BALL_FRICTION;
        ball.vy *= BALL_FRICTION;
        ball.x += ball.vx;
        ball.y += ball.vy;
        // Rebotes
        if (ball.x - BALL_RADIUS < 20) { ball.x = 20 + BALL_RADIUS; ball.vx *= -0.7; }
        if (ball.x + BALL_RADIUS > CANVAS_W - 20) { ball.x = CANVAS_W - 20 - BALL_RADIUS; ball.vx *= -0.7; }
        if (ball.y - BALL_RADIUS < 20) { ball.y = 20 + BALL_RADIUS; ball.vy *= -0.7; }
        if (ball.y + BALL_RADIUS > CANVAS_H - 20) { ball.y = CANVAS_H - 20 - BALL_RADIUS; ball.vy *= -0.7; }
        updateFireball();
    }

    checkScore();

    // Enviar los datos del jugador local a Firebase (posición y estado de posesión)
    if (currentRoomRef) {
        currentRoomRef.child(`players/${localPlayer.id}`).set({
            x: localPlayer.x, y: localPlayer.y, vx: localPlayer.vx, vy: localPlayer.vy,
            hasBall: localPlayer.hasBall, team: localPlayer.team, name: localPlayer.name
        }).catch(err => console.warn("Error actualizando jugador:", err));
    }

    updateUI();

    if (isCharging && (!localPlayer.hasBall || !gameActive)) {
        cancelCharge();
    }
}

function takeBall(player) {
    if (player.hasBall) return;
    player.hasBall = true;
    ball.holderId = player.id;
    localShotClock = SHOT_CLOCK_TIME;
    let ang = Math.atan2(player.vy, player.vx);
    ball.x = player.x + Math.cos(ang)*(PLAYER_RADIUS+BALL_RADIUS);
    ball.y = player.y + Math.sin(ang)*(PLAYER_RADIUS+BALL_RADIUS);
    ball.vx = player.vx;
    ball.vy = player.vy;
    updateFireball();
    if (currentRoomRef) {
        currentRoomRef.child(`players/${player.id}/hasBall`).set(true);
        currentRoomRef.child('ball').set({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, holderId: player.id });
    }
    cancelCharge();
}

function loseBallTimeout() {
    if (!localPlayer.hasBall) return;
    localPlayer.hasBall = false;
    ball.holderId = null;
    let ang = Math.atan2(localPlayer.vy, localPlayer.vx);
    ball.vx = localPlayer.vx * 1.5 + (Math.random() - 0.5) * 4;
    ball.vy = localPlayer.vy * 1.5 + (Math.random() - 0.5) * 4;
    ball.x = localPlayer.x + Math.cos(ang) * 30;
    ball.y = localPlayer.y + Math.sin(ang) * 30;
    localShotClock = 0;
    updateFireball();
    if (currentRoomRef) {
        currentRoomRef.child(`players/${localPlayer.id}/hasBall`).set(false);
        currentRoomRef.child('ball').set({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, holderId: null });
    }
    cancelCharge();
}

function attemptSteal() {
    if (!localPlayer || !gameActive) return;
    for (let [id, p] of playersMap.entries()) {
        if (p.team !== localPlayer.team && p.hasBall && Math.hypot(localPlayer.x-p.x, localPlayer.y-p.y) < STEAL_DIST) {
            // Realizar robo
            p.hasBall = false;
            localPlayer.hasBall = true;
            ball.holderId = localPlayer.id;
            localShotClock = SHOT_CLOCK_TIME;
            // Ajustar pelota a la posición del ladrón
            let ang = Math.atan2(localPlayer.vy, localPlayer.vx);
            ball.x = localPlayer.x + Math.cos(ang)*(PLAYER_RADIUS+BALL_RADIUS);
            ball.y = localPlayer.y + Math.sin(ang)*(PLAYER_RADIUS+BALL_RADIUS);
            ball.vx = localPlayer.vx;
            ball.vy = localPlayer.vy;
            updateFireball();
            if (currentRoomRef) {
                currentRoomRef.child(`players/${id}/hasBall`).set(false);
                currentRoomRef.child(`players/${localPlayer.id}/hasBall`).set(true);
                currentRoomRef.child('ball').set({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, holderId: localPlayer.id });
            }
            cancelCharge();
            break;
        }
    }
}

function shootBallWithPower(power) {
    console.log("Disparo con potencia:", power);
    if (!localPlayer || !localPlayer.hasBall || !gameActive) return;
    let finalPower = Math.min(1, Math.max(0.45, power));
    let shotStrength = finalPower * MAX_SHOT_POWER;
    let ang = Math.atan2(localPlayer.vy, localPlayer.vx);
    ball.vx = Math.cos(ang) * shotStrength + localPlayer.vx * 0.8;
    ball.vy = Math.sin(ang) * shotStrength + localPlayer.vy * 0.8;
    ball.holderId = null;
    localPlayer.hasBall = false;
    localShotClock = 0;
    updateFireball();
    if (currentRoomRef) {
        currentRoomRef.child(`players/${localPlayer.id}/hasBall`).set(false);
        currentRoomRef.child('ball').set({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, holderId: null });
    }
}

function cancelCharge() {
    if (isCharging) {
        isCharging = false;
        chargePower = 0;
        if (powerBarContainer) powerBarContainer.style.display = 'none';
    }
}

function startCharge() {
    if (!localPlayer || !localPlayer.hasBall || !gameActive) return;
    isCharging = true;
    chargePower = 0;
    chargeStartTime = performance.now();
    if (powerBarContainer) {
        powerBarContainer.style.display = 'flex';
        if (powerFillDiv) powerFillDiv.style.width = '0%';
    }
}

function releaseCharge() {
    if (!isCharging) return;
    let elapsed = (performance.now() - chargeStartTime) / 1000;
    let power = Math.min(1.0, elapsed / CHARGE_TIME);
    if (power < 0.1) power = 0.3;
    shootBallWithPower(power);
    isCharging = false;
    chargePower = 0;
    if (powerBarContainer) powerBarContainer.style.display = 'none';
}

function checkScore() {
    if (!ball.holderId) return;
    const holder = playersMap.get(ball.holderId) || (ball.holderId === localPlayer?.id ? localPlayer : null);
    if (!holder) return;
    const leftDist = Math.hypot(holder.x - HOOP_POS.left.x, holder.y - HOOP_POS.left.y);
    const rightDist = Math.hypot(holder.x - HOOP_POS.right.x, holder.y - HOOP_POS.right.y);
    if (leftDist < SCORE_DIST && holder.team === 'red') { scores.blue++; resetAfterScore(); }
    else if (rightDist < SCORE_DIST && holder.team === 'blue') { scores.red++; resetAfterScore(); }
}

function resetAfterScore() {
    if (currentRoomRef) currentRoomRef.child('scores').set(scores);
    ball.holderId = null;
    ball.x = CANVAS_W/2;
    ball.y = CANVAS_H/2;
    ball.vx = 0; ball.vy = 0;
    if (localPlayer) localPlayer.hasBall = false;
    localShotClock = 0;
    updateFireball();
    if (currentRoomRef) {
        currentRoomRef.child('ball').set({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, holderId: null });
        if (ball.holderId) currentRoomRef.child(`players/${ball.holderId}/hasBall`).set(false);
    }
    cancelCharge();
}

function updateFireball() {
    if (currentRoomRef) {
        let holderIdValue = (ball.holderId === undefined) ? null : ball.holderId;
        currentRoomRef.child('ball').set({
            x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, holderId: holderIdValue
        }).catch(err => console.warn("Error actualizando pelota:", err));
    }
}

// ========== SALAS Y SINCRONIZACIÓN DE JUGADORES ==========
async function createRoom(name, mode, team) {
    let playerName = playerNameInput.value.trim() || "Anonimo";
    let roomRef = database.ref('rooms').push();
    let playerId = roomRef.child('players').push().key;
    localPlayer = {
        id: playerId, name: playerName, x: CANVAS_W/2 + (Math.random()*100-50), y: CANVAS_H/2,
        vx: 0, vy: 0, team: team, hasBall: false
    };
    let roomData = {
        name: name, mode: mode, createdAt: Date.now(),
        players: { [playerId]: { ...localPlayer } },
        scores: { blue: 0, red: 0 },
        ball: { x: CANVAS_W/2, y: CANVAS_H/2, vx: 0, vy: 0, holderId: null },
        gameStarted: false
    };
    await roomRef.set(roomData);
    currentRoomRef = roomRef;
    enterGame(roomRef, playerId);
}

async function joinRoom(roomId, team) {
    let playerName = playerNameInput.value.trim() || "Anonimo";
    let roomRef = database.ref(`rooms/${roomId}`);
    let snapshot = await roomRef.get();
    if (!snapshot.exists()) return alert("Sala no existe");
    let room = snapshot.val();
    let players = room.players || {};
    let max = room.mode === '1v1' ? 2 : (room.mode === '2v2' ? 4 : 6);
    if (Object.keys(players).length >= max) return alert("Sala llena");
    let playerId = roomRef.child('players').push().key;
    localPlayer = {
        id: playerId, name: playerName, x: CANVAS_W/2 + (Math.random()*100-50), y: CANVAS_H/2,
        vx: 0, vy: 0, team: team, hasBall: false
    };
    await roomRef.child(`players/${playerId}`).set(localPlayer);
    currentRoomRef = roomRef;
    enterGame(roomRef, playerId);
}

function enterGame(roomRef, playerId) {
    menuContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    canvas.focus();

    // Suscripción en tiempo real a los jugadores
    roomRef.child('players').on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        // Actualizar mapa de jugadores (excepto el local)
        for (let id in data) {
            if (id === localPlayer?.id) continue;
            if (playersMap.has(id)) {
                let p = playersMap.get(id);
                p.x = data[id].x; p.y = data[id].y; p.vx = data[id].vx; p.vy = data[id].vy;
                p.hasBall = data[id].hasBall; p.team = data[id].team; p.name = data[id].name;
            } else {
                playersMap.set(id, { ...data[id], id: id });
            }
        }
        // Eliminar jugadores que ya no están
        for (let [id] of playersMap) {
            if (id !== localPlayer?.id && !data[id]) playersMap.delete(id);
        }
    });

    // Suscripción a la pelota
    roomRef.child('ball').on('value', (snap) => {
        let b = snap.val();
        if (b) {
            // Actualizar la pelota global
            ball.x = b.x;
            ball.y = b.y;
            ball.vx = b.vx;
            ball.vy = b.vy;
            ball.holderId = b.holderId;
            // Sincronizar el estado de hasBall en los jugadores locales según el holderId
            if (localPlayer) {
                if (ball.holderId === localPlayer.id && !localPlayer.hasBall) {
                    localPlayer.hasBall = true;
                    localShotClock = SHOT_CLOCK_TIME;
                } else if (ball.holderId !== localPlayer.id && localPlayer.hasBall) {
                    localPlayer.hasBall = false;
                    localShotClock = 0;
                }
            }
        }
    });

    roomRef.child('scores').on('value', (snap) => { if(snap.val()) scores = snap.val(); updateUI(); });
    roomRef.child('gameStarted').on('value', (snap) => {
        let started = snap.val();
        if (started === true && !gameActive) {
            gameActive = true;
            startMatchTimer();
        } else if (started === false && gameActive) {
            gameActive = false;
            if (matchInterval) clearInterval(matchInterval);
        }
    });

    checkAutoStart(roomRef);
    roomRef.child('players').on('value', () => checkAutoStart(roomRef));
    setupCleanup(roomRef, playerId);

    lastTimestamp = performance.now();
    requestAnimationFrame(gameLoop);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
}

function checkAutoStart(roomRef) {
    roomRef.once('value', (snap) => {
        let room = snap.val();
        if (!room) return;
        let count = Object.keys(room.players || {}).length;
        let max = room.mode === '1v1' ? 2 : (room.mode === '2v2' ? 4 : 6);
        if (count === max && !room.gameStarted) roomRef.child('gameStarted').set(true);
    });
}

function setupCleanup(roomRef, playerId) {
    roomRef.child(`players/${playerId}`).onDisconnect().remove();
    roomRef.child('players').on('value', (snap) => {
        if (snap.numChildren() === 0) roomRef.remove();
    });
}

function startMatchTimer() {
    if (matchInterval) clearInterval(matchInterval);
    matchTime = MATCH_DUR;
    matchInterval = setInterval(() => {
        if (!gameActive) return;
        if (matchTime <= 0) {
            clearInterval(matchInterval);
            gameActive = false;
            alert("¡TIEMPO FINALIZADO!");
        } else {
            matchTime--;
            let mins = Math.floor(matchTime / 60);
            let secs = matchTime % 60;
            if (gameTimerSpan) gameTimerSpan.innerText = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
        }
    }, 1000);
}

function gameLoop(now) {
    if (!gameContainer || gameContainer.classList.contains('hidden')) return;
    let delta = Math.min(0.033, (now - lastTimestamp) / 1000);
    if (delta > 0) lastTimestamp = now;
    if (gameActive) updatePhysics(delta);
    drawGame();
    updateUI();
    requestAnimationFrame(gameLoop);
}

function updateUI() {
    if (blueScoreSpan) blueScoreSpan.innerText = scores.blue;
    if (redScoreSpan) redScoreSpan.innerText = scores.red;
    let percent = (sprintRemaining / SPRINT_DUR) * 100;
    if (sprintOnCooldown) percent = 0;
    if (sprintFillDiv) sprintFillDiv.style.width = `${percent}%`;
    if (shotClockSpan) {
        if (localPlayer && localPlayer.hasBall && localShotClock > 0) {
            shotClockSpan.innerText = localShotClock.toFixed(1) + "s";
            shotClockSpan.style.color = localShotClock <= 1.0 ? "#ff4444" : "#ffffff";
        } else {
            shotClockSpan.innerText = "---";
        }
    }
    if (isCharging && powerFillDiv) {
        let elapsed = (performance.now() - chargeStartTime) / 1000;
        let power = Math.min(1.0, elapsed / CHARGE_TIME);
        chargePower = power;
        let widthPercent = power * 100;
        powerFillDiv.style.width = `${widthPercent}%`;
    }
}

function handleKeyDown(e) {
    if (!gameActive) return;
    let key = e.key;
    if (key === 'w' || key === 'W') localInput.up = true;
    if (key === 's' || key === 'S') localInput.down = true;
    if (key === 'a' || key === 'A') localInput.left = true;
    if (key === 'd' || key === 'D') localInput.right = true;
    if (key === 'Shift') localInput.sprint = true;
    if (key === 'e' || key === 'E') window.stealRequest = true;
    if (key === ' ') {
        e.preventDefault();
        if (localPlayer && localPlayer.hasBall && !isCharging) {
            startCharge();
        }
    }
}

function handleKeyUp(e) {
    let key = e.key;
    if (key === 'w' || key === 'W') localInput.up = false;
    if (key === 's' || key === 'S') localInput.down = false;
    if (key === 'a' || key === 'A') localInput.left = false;
    if (key === 'd' || key === 'D') localInput.right = false;
    if (key === 'Shift') localInput.sprint = false;
    if (key === ' ' && isCharging) {
        e.preventDefault();
        releaseCharge();
    }
}

function loadRoomsList() {
    const roomsRef = database.ref('rooms');
    roomsRef.on('value', (snapshot) => {
        const rooms = snapshot.val();
        roomsListDiv.innerHTML = '';
        if (!rooms) { roomsListDiv.innerHTML = '<div class="placeholder">No hay salas, crea una!</div>'; return; }
        for (let roomId in rooms) {
            const r = rooms[roomId];
            let count = Object.keys(r.players || {}).length;
            let max = r.mode === '1v1' ? 2 : (r.mode === '2v2' ? 4 : 6);
            let div = document.createElement('div');
            div.className = 'room-item';
            div.innerHTML = `<strong>${r.name}</strong> (${count}/${max}) - ${r.mode}
                            <button class="join-btn" data-id="${roomId}" data-team="blue">🔵 Azul</button>
                            <button class="join-btn" data-id="${roomId}" data-team="red">🔴 Rojo</button>`;
            roomsListDiv.appendChild(div);
        }
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.onclick = () => joinRoom(btn.dataset.id, btn.dataset.team);
        });
    });
}

export function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    menuContainer = document.getElementById('menuContainer');
    gameContainer = document.getElementById('gameContainer');
    roomsListDiv = document.getElementById('roomsList');
    playerNameInput = document.getElementById('playerNameInput');
    blueScoreSpan = document.getElementById('blueScore');
    redScoreSpan = document.getElementById('redScore');
    sprintFillDiv = document.getElementById('sprintFill');
    shotClockSpan = document.getElementById('shotClockDisplay');
    gameTimerSpan = document.getElementById('gameTimer');
    powerBarContainer = document.getElementById('powerBarContainer');
    powerFillDiv = document.getElementById('powerFill');
    if (powerBarContainer) powerBarContainer.style.display = 'none';

    document.getElementById('createRoomBtn').onclick = () => document.getElementById('createRoomModal').classList.remove('hidden');
    document.getElementById('refreshRoomsBtn').onclick = () => loadRoomsList();
    document.getElementById('confirmCreateBtn').onclick = async () => {
        let name = document.getElementById('roomNameInput').value.trim() || "Sala Basket";
        let mode = document.getElementById('roomModeSelect').value;
        let team = document.getElementById('createTeamSelect').value;
        document.getElementById('createRoomModal').classList.add('hidden');
        await createRoom(name, mode, team);
    };
    document.getElementById('cancelCreateBtn').onclick = () => document.getElementById('createRoomModal').classList.add('hidden');
    loadRoomsList();
}