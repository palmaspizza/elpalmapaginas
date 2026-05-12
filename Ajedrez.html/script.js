import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, set, onValue, push, remove, update, get, onDisconnect } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCSqgJA6uL8SkY-kphhuaR9TuGPulucPic",
    authDomain: "ajedrez-65b15.firebaseapp.com",
    databaseURL: "https://ajedrez-65b15-default-rtdb.firebaseio.com",
    projectId: "ajedrez-65b15",
    storageBucket: "ajedrez-65b15.firebasestorage.app",
    messagingSenderId: "501222935015",
    appId: "1:501222935015:web:bb08aeab5af07a77eb1542",
    measurementId: "G-HH7PYX89EG"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let game = null;
let board = null;
let currentRoomId = null;
let currentPlayer = null;
let playerName = null;
let playerColor = null;
let roomRef = null;
let isGameActive = false;
let roomListener = null;
let isMyTurn = false;
let playerUniqueId = null;
let roomDataCache = null;

// Variables para piezas capturadas
let capturedPiecesRed = [];
let capturedPiecesGreen = [];

// Audios de captura
// Audios cuando TE COMEN una pieza (victima)
const victimAudios = [
    { src: 'audios/aweonao.mp3', name: 'aweonao' },
    { src: 'audios/conesta.mp3', name: 'conesta' },
    { src: 'audios/veggeta.mp3', name: 'veggeta' }
];

// Audios cuando CAPTURAS una pieza (atacante)
const attackerAudios = [
    { src: 'audios/uena.mp3', name: 'uena' },
    { src: 'audios/bonk.mp3', name: 'bonk' },
    { src: 'audios/choche.mp3', name: 'choche' }
];

// Pre-cargar audios para evitar delays
const preloadedVictimAudios = [];
const preloadedAttackerAudios = [];

function preloadAudios() {
    victimAudios.forEach(audio => {
        const audioElement = new Audio(audio.src);
        audioElement.preload = 'auto';
        preloadedVictimAudios.push(audioElement);
    });
    
    attackerAudios.forEach(audio => {
        const audioElement = new Audio(audio.src);
        audioElement.preload = 'auto';
        preloadedAttackerAudios.push(audioElement);
    });
}

function playRandomVictimAudio() {
    const randomIndex = Math.floor(Math.random() * preloadedVictimAudios.length);
    const audio = preloadedVictimAudios[randomIndex];
    audio.currentTime = 0;
    audio.play().catch(e => console.log('Error reproduciendo audio:', e));
}

function playRandomAttackerAudio() {
    const randomIndex = Math.floor(Math.random() * preloadedAttackerAudios.length);
    const audio = preloadedAttackerAudios[randomIndex];
    audio.currentTime = 0;
    audio.play().catch(e => console.log('Error reproduciendo audio:', e));
}

$(document).ready(() => {
    preloadAudios();
    
    const savedName = localStorage.getItem('chessPlayerName');
    if (savedName) {
        $('#player-name').val(savedName);
    }
    
    $('#search-btn').click(startMatchmaking);
    $('#leave-btn').click(leaveGame);
    
    // Generar ID único para este dispositivo/sesión
    playerUniqueId = localStorage.getItem('playerUniqueId');
    if (!playerUniqueId) {
        playerUniqueId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('playerUniqueId', playerUniqueId);
    }
});

function startMatchmaking() {
    playerName = $('#player-name').val().trim();
    if (!playerName) {
        alert('Por favor ingresa tu nombre');
        return;
    }
    
    localStorage.setItem('chessPlayerName', playerName);
    $('#search-status').html('<i class="fas fa-spinner fa-spin"></i> Buscando partida...');
    $('#search-btn').prop('disabled', true);
    
    findOrCreateRoom();
}

function findOrCreateRoom() {
    const roomsRef = ref(database, 'rooms');
    
    get(roomsRef).then((snapshot) => {
        const rooms = snapshot.val();
        let availableRoom = null;
        
        if (rooms) {
            for (const [roomId, roomData] of Object.entries(rooms)) {
                if (roomData.player1 && roomData.player1.id !== playerUniqueId && !roomData.player2 && !roomData.gameOver) {
                    availableRoom = { id: roomId, ...roomData };
                    break;
                }
            }
        }
        
        if (availableRoom) {
            joinRoom(availableRoom.id, availableRoom);
        } else {
            createNewRoom();
        }
    }).catch((error) => {
        console.error('Error al buscar salas:', error);
        $('#search-status').html('Error al conectar. Reintentando...');
        setTimeout(() => {
            $('#search-btn').prop('disabled', false);
            $('#search-status').html('');
        }, 2000);
    });
}

function createNewRoom() {
    const roomsRef = ref(database, 'rooms');
    const newRoomRef = push(roomsRef);
    currentRoomId = newRoomRef.key;
    
    const initialFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const roomData = {
        player1: {
            name: playerName,
            id: playerUniqueId
        },
        player2: null,
        fen: initialFEN,
        turn: 'w',
        gameOver: false,
        winner: null,
        winnerName: null,
        createdAt: Date.now()
    };
    
    set(newRoomRef, roomData).then(() => {
        currentPlayer = 'player1';
        playerColor = 'w';
        isMyTurn = true;
        setupGame(newRoomRef, 'player1', 'w');
        setupRoomCleanup(newRoomRef);
        $('#search-status').html('Esperando oponente... <i class="fas fa-hourglass-half"></i>');
    }).catch((error) => {
        console.error('Error al crear sala:', error);
        $('#search-status').html('Error al crear sala. Reintentando...');
        setTimeout(() => {
            $('#search-btn').prop('disabled', false);
            $('#search-status').html('');
        }, 2000);
    });
}

function joinRoom(roomId, roomData) {
    currentRoomId = roomId;
    const roomRef_full = ref(database, `rooms/${roomId}`);
    
    const updatedData = {
        player2: {
            name: playerName,
            id: playerUniqueId
        }
    };
    
    update(roomRef_full, updatedData).then(() => {
        currentPlayer = 'player2';
        playerColor = 'b';
        isMyTurn = false;
        setupGame(roomRef_full, 'player2', 'b');
        $('#search-status').html('¡Partida encontrada! <i class="fas fa-check"></i>');
        setTimeout(() => {
            $('#overlay').fadeOut();
        }, 1000);
    }).catch((error) => {
        console.error('Error al unirse a sala:', error);
        $('#search-status').html('Error al unirse. Reintentando...');
        setTimeout(() => {
            $('#search-btn').prop('disabled', false);
            $('#search-status').html('');
        }, 2000);
    });
}

function setupGame(roomReference, playerPosition, color) {
    currentPlayer = playerPosition;
    playerColor = color;
    roomRef = roomReference;
    
    game = new Chess();
    
    if (roomListener) {
        roomListener();
        roomListener = null;
    }
    
    resetCapturedPieces();
    
    roomListener = onValue(roomRef, (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) return;
        
        roomDataCache = roomData;
        
        if (roomData.player2 && roomData.player2.id === playerUniqueId && currentPlayer === 'player1') {
            leaveGame();
            alert('No puedes jugar contra ti mismo. Buscando otra partida...');
            setTimeout(() => startMatchmaking(), 1000);
            return;
        }
        
        const oldFEN = game ? game.fen() : null;
        
        if (roomData.fen && game && game.fen() !== roomData.fen) {
            game.load(roomData.fen);
            
            if (oldFEN && oldFEN !== roomData.fen) {
                detectAndRegisterCapture(oldFEN, roomData.fen, playerColor);
            }
            
            if (board) {
                board.position(roomData.fen, false);
            }
        }
        
        if (roomData.turn) {
            const myColorCode = playerColor === 'w' ? 'w' : 'b';
            isMyTurn = (roomData.turn === myColorCode && !roomData.gameOver);
        }
        
        updateUI(roomData);
        
        if (roomData.gameOver && !roomData.gameOverHandled) {
            isGameActive = false;
            const statusMsg = roomData.winner === 'draw' ? 'Tablas!' : 
                            `Ganador: ${roomData.winnerName || (roomData.winner === 'w' ? roomData.player1?.name : roomData.player2?.name)}`;
            
            update(roomRef, { gameOverHandled: true }).catch(() => {});
            
            setTimeout(() => {
                if (confirm(`Partida finalizada. ${statusMsg} ¿Desea jugar otra?`)) {
                    leaveGame();
                    startMatchmaking();
                }
            }, 500);
        }
        
        if (roomData.player1 && roomData.player2 && roomData.fen && !roomData.gameOver) {
            if ($('#overlay').is(':visible')) {
                $('#overlay').fadeOut();
            }
        }
    });
    
    initBoard();
    
    get(roomRef).then((snapshot) => {
        const roomData = snapshot.val();
        if (roomData && roomData.fen) {
            game.load(roomData.fen);
            if (board) {
                board.position(roomData.fen, false);
            }
        }
        if (roomData && roomData.turn) {
            const myColorCode = playerColor === 'w' ? 'w' : 'b';
            isMyTurn = (roomData.turn === myColorCode && !roomData.gameOver);
        }
    });
    
    $('#leave-btn').show();
    isGameActive = true;
}

function initBoard() {
    const orientation = playerColor === 'w' ? 'white' : 'black';
    
    if (board) {
        board.destroy();
        $('#board-container').empty();
    }
    
    const config = {
        draggable: true,
        position: 'start',
        orientation: orientation,
        showNotation: true,
        pieceTheme: function(piece) {
            let pieceFile = '';
            if (piece === 'wP') pieceFile = 'wp.png';
            else if (piece === 'wN') pieceFile = 'wn.png';
            else if (piece === 'wB') pieceFile = 'wb.png';
            else if (piece === 'wR') pieceFile = 'wr.png';
            else if (piece === 'wQ') pieceFile = 'wq.png';
            else if (piece === 'wK') pieceFile = 'wk.png';
            else if (piece === 'bP') pieceFile = 'bp.png';
            else if (piece === 'bN') pieceFile = 'bn.png';
            else if (piece === 'bB') pieceFile = 'bb.png';
            else if (piece === 'bR') pieceFile = 'br.png';
            else if (piece === 'bQ') pieceFile = 'bq.png';
            else if (piece === 'bK') pieceFile = 'bk.png';
            else pieceFile = 'wp.png';
            
            return `pieces/${pieceFile}`;
        },
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };
    
    board = Chessboard('board-container', config);
}

function onDragStart(source, piece, position, orientation) {
    if (!isGameActive) return false;
    if (!game) return false;
    if (!isMyTurn) return false;
    if (game.game_over()) return false;
    
    const pieceColor = piece.charAt(0);
    if (playerColor !== pieceColor) return false;
    
    return true;
}

function onDrop(source, target) {
    if (game.game_over()) {
        if (board) board.position(game.fen(), false);
        return 'snapback';
    }
    
    if (!isMyTurn) {
        if (board) board.position(game.fen(), false);
        return 'snapback';
    }
    
    const oldFEN = game.fen();
    
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    
    if (move === null) {
        if (board) board.position(game.fen(), false);
        return 'snapback';
    }
    
    const newFEN = game.fen();
    const wasCapture = detectAndRegisterCapture(oldFEN, newFEN, playerColor);
    
    const newTurn = game.turn();
    
    const updates = {
        fen: newFEN,
        turn: newTurn
    };
    
    if (game.game_over()) {
        updates.gameOver = true;
        if (game.in_checkmate()) {
            const winner = newTurn === 'w' ? 'b' : 'w';
            updates.winner = winner;
            updates.winnerName = winner === 'w' ? roomDataCache?.player1?.name : roomDataCache?.player2?.name;
        } else if (game.in_stalemate() || game.in_threefold_repetition()) {
            updates.winner = 'draw';
            updates.winnerName = 'Tablas';
        }
    }
    
    update(roomRef, updates).then(() => {
        if (board) board.position(newFEN, false);
        isMyTurn = false;
    }).catch((error) => {
        console.error('Error al actualizar Firebase:', error);
        game.undo();
        if (board) board.position(game.fen(), false);
    });
    
    return;
}

function onSnapEnd() {
    if (board && game) {
        board.position(game.fen(), false);
    }
}

function updateUI(roomData) {
    if (!roomData) return;
    
    $('#player1-name').text(roomData.player1?.name || 'Esperando jugador...');
    $('#player2-name').text(roomData.player2?.name || 'Esperando jugador...');
    
    if (!roomData.gameOver && roomData.player1 && roomData.player2) {
        if (isMyTurn) {
            $('#turn-text').html(`Tu turno <i class="fas fa-chess-${playerColor === 'w' ? 'king' : 'knight'}"></i>`);
            $('#turn-indicator').css('background', 'linear-gradient(135deg, #28a745 0%, #20c997 100%)');
        } else {
            $('#turn-text').html(`Turno del oponente <i class="fas fa-hourglass-half"></i>`);
            $('#turn-indicator').css('background', 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)');
        }
    } else if (roomData.gameOver) {
        $('#turn-text').html('Partida finalizada');
        let statusMessage = '';
        if (roomData.winner === 'draw') {
            statusMessage = '♟️ ¡Tablas! Partida empatada ♟️';
        } else if (roomData.winner === 'w') {
            statusMessage = `🏆 ¡Jaque Mate! Ganan las Blancas (${roomData.player1?.name}) 🏆`;
        } else if (roomData.winner === 'b') {
            statusMessage = `🏆 ¡Jaque Mate! Ganan las Negras (${roomData.player2?.name}) 🏆`;
        }
        $('#game-status').html(statusMessage);
    }
    
    if (!roomData.gameOver && game && game.in_check()) {
        const checkedColor = game.turn() === 'w' ? 'Blancas' : 'Negras';
        $('#game-status').html(`⚠️ ¡${checkedColor} en jaque! ⚠️`);
    } else if (!roomData.gameOver && $('#game-status').html().includes('jaque')) {
        $('#game-status').html('');
    }
}

// ========== FUNCIONES DE CAPTURA Y ANIMACIONES ==========

function showCaptureAnimation(isAttacker, pieceName, position) {
    const overlay = $('<div class="capture-overlay"></div>');
    
    if (isAttacker) {
        // El que CAPTURA ve pantalla VERDE
        overlay.addClass('capture-overlay-green');
        const message = $('<div class="capture-message">🎯 ¡CAPTURA EXITOSA! 🎯</div>');
        overlay.append(message);
        
        $('#board-container').addClass('victory-shake');
        setTimeout(() => {
            $('#board-container').removeClass('victory-shake');
        }, 500);
        
        // Reproducir audio de atacante (uena, bonk o choche)
        playRandomAttackerAudio();
    } else {
        // El que es VÍCTIMA ve pantalla ROJA
        overlay.addClass('capture-overlay-red');
        const pieceNameSpanish = getPieceNameSpanish(pieceName);
        const message = $(`<div class="capture-message">💀 ¡TE COMIERON LA ${pieceNameSpanish}! 💀</div>`);
        overlay.append(message);
        
        $('body').addClass('screen-shake');
        setTimeout(() => {
            $('body').removeClass('screen-shake');
        }, 500);
        
        // Reproducir audio de víctima (aweonao, conesta o veggeta)
        playRandomVictimAudio();
    }
    
    $('body').append(overlay);
    
    setTimeout(() => {
        overlay.remove();
    }, 500);
    
    if (position) {
        const square = $(`.square-${position}`);
        square.css('animation', 'captureFlash 0.3s ease-out');
        setTimeout(() => {
            square.css('animation', '');
        }, 300);
    }
}

function getPieceNameSpanish(piece) {
    const pieceNames = {
        'p': 'Peón', 'n': 'Caballo', 'b': 'Alfil',
        'r': 'Torre', 'q': 'Reina', 'k': 'Rey'
    };
    return pieceNames[piece.toLowerCase()] || 'Pieza';
}

function getPieceSymbol(piece) {
    const symbols = {
        'p': '♟', 'n': '♞', 'b': '♝',
        'r': '♜', 'q': '♛', 'k': '♚',
        'P': '♙', 'N': '♘', 'B': '♗',
        'R': '♖', 'Q': '♕', 'K': '♔'
    };
    return symbols[piece] || '●';
}

function updateCapturedPiecesDisplay() {
    const redContainer = $('#captured-red-pieces');
    redContainer.empty();
    
    capturedPiecesRed.forEach(piece => {
        const pieceHtml = `<div class="captured-piece" style="color: #ff6b6b;">
                            <span class="piece-icon">${getPieceSymbol(piece)}</span>
                           </div>`;
        redContainer.append(pieceHtml);
    });
    
    if (capturedPiecesRed.length === 0) {
        redContainer.html('<span style="color: #666; font-size: 12px;">Ninguna</span>');
    }
    
    const greenContainer = $('#captured-green-pieces');
    greenContainer.empty();
    
    capturedPiecesGreen.forEach(piece => {
        const pieceHtml = `<div class="captured-piece" style="color: #6bff6b;">
                            <span class="piece-icon">${getPieceSymbol(piece)}</span>
                           </div>`;
        greenContainer.append(pieceHtml);
    });
    
    if (capturedPiecesGreen.length === 0) {
        greenContainer.html('<span style="color: #666; font-size: 12px;">Ninguna</span>');
    }
    
    $('#captured-red-section h4').html(`<i class="fas fa-skull"></i> Piezas perdidas: ${capturedPiecesRed.length}`);
    $('#captured-green-section h4').html(`<i class="fas fa-trophy"></i> Piezas capturadas: ${capturedPiecesGreen.length}`);
}

function detectAndRegisterCapture(oldFEN, newFEN, currentPlayerColor) {
    const oldBoard = fenToBoard(oldFEN);
    const newBoard = fenToBoard(newFEN);
    
    let capturedPiece = null;
    let captureSquare = null;
    
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const oldPiece = oldBoard[i][j];
            const newPiece = newBoard[i][j];
            
            if (oldPiece && !newPiece) {
                capturedPiece = oldPiece;
                captureSquare = `${String.fromCharCode(97 + j)}${8 - i}`;
                break;
            }
        }
        if (capturedPiece) break;
    }
    
    if (capturedPiece) {
        const isWhitePiece = capturedPiece === capturedPiece.toUpperCase() && capturedPiece !== capturedPiece.toLowerCase();
        const lostPieceColor = isWhitePiece ? 'w' : 'b';
        
        if (lostPieceColor === currentPlayerColor) {
            // A MI me comieron una pieza (soy víctima)
            capturedPiecesRed.push(capturedPiece);
            showCaptureAnimation(false, capturedPiece, captureSquare);
        } else {
            // YO le comí una pieza al oponente (soy atacante)
            capturedPiecesGreen.push(capturedPiece);
            showCaptureAnimation(true, capturedPiece, captureSquare);
        }
        
        updateCapturedPiecesDisplay();
        animateFlyingPiece(captureSquare, capturedPiece, lostPieceColor === currentPlayerColor);
        return true;
    }
    
    return false;
}

function fenToBoard(fen) {
    const board = Array(8).fill().map(() => Array(8).fill(null));
    const rows = fen.split(' ')[0].split('/');
    
    for (let i = 0; i < 8; i++) {
        let col = 0;
        for (let j = 0; j < rows[i].length; j++) {
            const char = rows[i][j];
            if (isNaN(char)) {
                board[i][col] = char;
                col++;
            } else {
                col += parseInt(char);
            }
        }
    }
    return board;
}

function animateFlyingPiece(square, piece, isLoss) {
    const squareElement = $(`.square-${square}`);
    if (!squareElement.length) return;
    
    const rect = squareElement[0].getBoundingClientRect();
    const flyingPiece = $(`<div class="captured-piece" style="position: fixed; left: ${rect.left}px; top: ${rect.top}px; font-size: 40px; z-index: 10001; pointer-events: none; transition: all 0.4s ease-out;">
                            ${getPieceSymbol(piece)}
                          </div>`);
    
    $('body').append(flyingPiece);
    
    let targetX, targetY;
    if (isLoss) {
        const redSection = $('#captured-red-section').offset();
        if (redSection) {
            targetX = redSection.left + 50;
            targetY = redSection.top + 20;
        }
        flyingPiece.css('color', '#ff0000');
    } else {
        const greenSection = $('#captured-green-section').offset();
        if (greenSection) {
            targetX = greenSection.left + 50;
            targetY = greenSection.top + 20;
        }
        flyingPiece.css('color', '#00ff00');
    }
    
    setTimeout(() => {
        flyingPiece.css({
            left: targetX + 'px',
            top: targetY + 'px',
            transform: 'scale(0.3)',
            opacity: '0'
        });
    }, 50);
    
    setTimeout(() => {
        flyingPiece.remove();
    }, 450);
}

function resetCapturedPieces() {
    capturedPiecesRed = [];
    capturedPiecesGreen = [];
    updateCapturedPiecesDisplay();
}

function leaveGame() {
    if (roomRef && currentRoomId) {
        get(roomRef).then((snapshot) => {
            const roomData = snapshot.val();
            if (roomData && !roomData.gameOver && roomData.player1 && roomData.player2) {
                const abandonedByName = currentPlayer === 'player1' ? roomData.player1?.name : roomData.player2?.name;
                update(roomRef, { 
                    gameOver: true, 
                    winner: 'abandoned', 
                    winnerName: `${abandonedByName} abandonó`,
                    gameOverHandled: true
                });
            }
            
            setTimeout(() => {
                remove(ref(database, `rooms/${currentRoomId}`)).then(() => {
                    resetGame();
                    $('#overlay').fadeIn();
                    $('#search-status').html('');
                    $('#search-btn').prop('disabled', false);
                    $('#leave-btn').hide();
                }).catch(() => {
                    resetGame();
                    $('#overlay').fadeIn();
                    $('#search-btn').prop('disabled', false);
                    $('#leave-btn').hide();
                });
            }, 500);
        });
    } else {
        resetGame();
        $('#overlay').fadeIn();
        $('#search-btn').prop('disabled', false);
        $('#leave-btn').hide();
    }
}

function resetGame() {
    if (roomListener) {
        roomListener();
        roomListener = null;
    }
    
    if (board) {
        board.destroy();
        board = null;
    }
    
    game = null;
    currentRoomId = null;
    currentPlayer = null;
    playerColor = null;
    roomRef = null;
    isGameActive = false;
    isMyTurn = false;
    roomDataCache = null;
    resetCapturedPieces();
    
    $('#board-container').empty();
    $('#player1-name').text('Esperando jugador...');
    $('#player2-name').text('Esperando jugador...');
    $('#turn-text').text('Esperando partida...');
    $('#game-status').html('');
    $('#turn-indicator').css('background', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
}

function setupRoomCleanup(roomReference) {
    if (roomReference) {
        onDisconnect(roomReference).remove();
    }
}
