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
let isProcessingMove = false;
let lastProcessedTimestamp = 0;
let isMuted = true;
let isLongPressing = false;
let pressTimer = null;
let currentTouchSquare = null;
let isTurnOverlayActive = false;

// Variables para resaltado de movimientos legales
let currentHighlightedSquares = [];

// Variables para piezas capturadas
let capturedPiecesRed = [];
let capturedPiecesGreen = [];

// Audios de captura
const victimAudios = [
    { src: 'audios/aweonao.mp3', name: 'aweonao' },
    { src: 'audios/bonk.mp3', name: 'bonk' }
];

const attackerAudios = [
    { src: 'audios/uena.mp3', name: 'uena' },
    { src: 'audios/bonk.mp3', name: 'bonk' },
];

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
    if (isMuted) return;
    const randomIndex = Math.floor(Math.random() * preloadedVictimAudios.length);
    const audio = preloadedVictimAudios[randomIndex];
    audio.currentTime = 0;
    audio.play().catch(e => console.log('Error reproduciendo audio:', e));
}

function playRandomAttackerAudio() {
    if (isMuted) return;
    const randomIndex = Math.floor(Math.random() * preloadedAttackerAudios.length);
    const audio = preloadedAttackerAudios[randomIndex];
    audio.currentTime = 0;
    audio.play().catch(e => console.log('Error reproduciendo audio:', e));
}

function showTurnOverlay() {
    if (isTurnOverlayActive) return;
    isTurnOverlayActive = true;
    
    const overlay = $('<div class="turn-overlay"><span>🎯 TU TURNO 🎯</span></div>');
    $('body').append(overlay);
    
    setTimeout(() => {
        overlay.remove();
        isTurnOverlayActive = false;
    }, 2000);
}

$(document).ready(() => {
    preloadAudios();
    
    // Configurar botón de mute
    const muteBtn = $('#mute-btn');
    muteBtn.click(() => {
        isMuted = !isMuted;
        if (isMuted) {
            muteBtn.html('🔇');
            muteBtn.addClass('muted');
        } else {
            muteBtn.html('🔊');
            muteBtn.removeClass('muted');
        }
    });
    
    // Prevenir pull-to-refresh en móviles
    // Prevenir scroll SOLO cuando se arrastra una pieza (no en todo momento)
let isDraggingPiece = false;

document.body.addEventListener('touchmove', (e) => {
    // Solo prevenir scroll si se está arrastrando una pieza
    if (isDraggingPiece) {
        e.preventDefault();
    }
}, { passive: false });

// Detectar cuando se empieza a arrastrar una pieza
$(document).on('dragstart', '.piece-417db', function() {
    isDraggingPiece = true;
});

// Detectar cuando se suelta la pieza
$(document).on('dragend', function() {
    setTimeout(() => {
        isDraggingPiece = false;
    }, 100);
});
    
    const savedName = localStorage.getItem('chessPlayerName');
    if (savedName) {
        $('#player-name').val(savedName);
    }
    
    $('#search-btn').click(startMatchmaking);
    $('#leave-btn').click(leaveGame);
    
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
        createdAt: Date.now(),
        lastMoveTimestamp: Date.now(),
        lastCapturePending: null,
        capturedPiecesRed: [],
        capturedPiecesGreen: []
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
        if (isProcessingMove) return;
        
        const roomData = snapshot.val();
        if (!roomData) return;
        
        roomDataCache = roomData;
        
        if (roomData.player2 && roomData.player2.id === playerUniqueId && currentPlayer === 'player1') {
            leaveGame();
            alert('No puedes jugar contra ti mismo. Buscando otra partida...');
            setTimeout(() => startMatchmaking(), 1000);
            return;
        }
        
        // Sincronizar contadores de piezas capturadas desde Firebase
        if (roomData.capturedPiecesRed && Array.isArray(roomData.capturedPiecesRed)) {
            capturedPiecesRed = [...roomData.capturedPiecesRed];
        }
        if (roomData.capturedPiecesGreen && Array.isArray(roomData.capturedPiecesGreen)) {
            capturedPiecesGreen = [...roomData.capturedPiecesGreen];
        }
        updateCapturedPiecesDisplay();
        
        // Procesar captura pendiente
        if (roomData.lastCapturePending && !roomData.lastCapturePending.processed && 
            roomData.lastCapturePending.timestamp && roomData.lastCapturePending.timestamp > lastProcessedTimestamp) {
            
            const capture = roomData.lastCapturePending;
            
            if (capture.attackerId !== playerUniqueId) {
                lastProcessedTimestamp = capture.timestamp;
                
                const captureRef = ref(database, `rooms/${currentRoomId}/lastCapturePending/processed`);
                set(captureRef, true).catch(() => {});
                
                const isCaptureOnMe = (capture.victimId === playerUniqueId);
                
                if (isCaptureOnMe) {
                    showCaptureAnimation(false, capture.piece, capture.square);
                    playRandomVictimAudio();
                    capturedPiecesRed.push(capture.piece);
                    updateCapturedPiecesDisplay();
                    animateFlyingPiece(capture.square, capture.piece, true);
                    
                    // Actualizar Firebase con los nuevos contadores
                    update(roomRef, {
                        capturedPiecesRed: capturedPiecesRed,
                        capturedPiecesGreen: capturedPiecesGreen
                    }).catch(() => {});
                }
            }
        }
        
        // Actualizar tablero si hay cambios
        if (roomData.fen && game && game.fen() !== roomData.fen) {
            game.load(roomData.fen);
            if (board) {
                board.position(roomData.fen, false);
                clearHighlights();
            }
        }
        
        const previousTurn = isMyTurn;
        
        if (roomData.turn) {
            const myColorCode = playerColor === 'w' ? 'w' : 'b';
            const newIsMyTurn = (roomData.turn === myColorCode && !roomData.gameOver);
            
            if (!previousTurn && newIsMyTurn && isGameActive && !roomData.gameOver) {
                showTurnOverlay();
            }
            
            isMyTurn = newIsMyTurn;
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
        if (roomData && roomData.capturedPiecesRed) {
            capturedPiecesRed = [...roomData.capturedPiecesRed];
            capturedPiecesGreen = [...roomData.capturedPiecesGreen];
            updateCapturedPiecesDisplay();
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
        onSnapEnd: onSnapEnd,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare
    };
    
    board = Chessboard('board-container', config);
    
    // Agregar eventos táctiles para long press y zoom
    setTimeout(() => {
        $('.square-55d63').each(function() {
            const squareClass = $(this).attr('class');
            const match = squareClass.match(/square-([a-h][1-8])/);
            if (match) {
                const squareName = match[1];
                
                // Remover eventos previos para evitar duplicados
                $(this).off('touchstart.chess');
                $(this).off('touchend.chess');
                $(this).off('touchmove.chess');
                
                // Agregar nuevos eventos
                $(this).on('touchstart.chess', (e) => {
                    handleTouchStart(squareName, e.originalEvent);
                    e.preventDefault();
                });
                
                $(this).on('touchend.chess', () => {
                    handleTouchEnd();
                });
                
                $(this).on('touchmove.chess', (e) => {
                    if (isLongPressing) {
                        e.preventDefault();
                    }
                });
            }
        });
    }, 100);
}

function handleTouchMove(event) {
    if (isLongPressing) {
        event.preventDefault();
    }
}


function handleTouchEnd() {
    clearTimeout(pressTimer);
    
    if (isLongPressing) {
        isLongPressing = false;
        currentTouchSquare = null;
        
        // Quitar zoom
        applyZoomToBoard(null, false);
        
        // Limpiar highlights
        clearHighlights();
    }
}
// Función para manejar el inicio de presión larga en una pieza (táctil)
function handleTouchStart(square, event) {
    if (!isGameActive) return;
    if (!isMyTurn) return;
    if (game.game_over()) return;
    if (isTurnOverlayActive) return;
    
    const piece = game.get(square);
    if (!piece) return;
    
    const pieceColor = piece.color;
    if (playerColor !== pieceColor) return;
    
    // Prevenir scroll
    if (event) {
        event.preventDefault();
    }
    
    // Detectar long press
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
        isLongPressing = true;
        currentTouchSquare = square;
        
        // Aplicar zoom al tablero centrado en la pieza
        applyZoomToBoard(square, true);
        
        // Resaltar movimientos legales
        highlightLegalMoves(square);
    }, 300); // 300ms para detectar long press
}

function onMouseoverSquare(square) {
    if (!isGameActive) return;
    if (!isMyTurn) return;
    if (game.game_over()) return;
    if (isTurnOverlayActive) return;
    
    const piece = game.get(square);
    if (!piece) return;
    
    const pieceColor = piece.color;
    if (playerColor !== pieceColor) return;
    
    highlightLegalMoves(square);
}

function onMouseoutSquare(square) {
    clearHighlights();
}

function highlightLegalMoves(square) {
    clearHighlights();
    
    const moves = game.moves({
        square: square,
        verbose: true
    });
    
    if (moves.length === 0) return;
    
    moves.forEach(move => {
        const targetSquare = move.to;
        highlightSquare(targetSquare, 'legal-move');
        currentHighlightedSquares.push(targetSquare);
    });
}

function highlightSquare(square, className) {
    const squareElement = $(`.square-${square}`);
    if (squareElement.length) {
        squareElement.addClass(className);
    }
}


function clearHighlights() {
    currentHighlightedSquares.forEach(square => {
        const squareElement = $(`.square-${square}`);
        if (squareElement.length) {
            squareElement.removeClass('legal-move');
        }
    });
    currentHighlightedSquares = [];
}

function onDragStart(source, piece, position, orientation) {
    if (!isGameActive) return false;
    if (!game) return false;
    if (!isMyTurn) return false;
    if (game.game_over()) return false;
    if (isProcessingMove) return false;
    if (isTurnOverlayActive) return false;
    
    const pieceColor = piece.charAt(0);
    if (playerColor !== pieceColor) return false;
    
    return true;
}

function applyZoomToBoard(square, shouldZoom) {
    const boardContainer = $('#board-container');
    
    if (shouldZoom && square) {
        const pos = getSquarePosition(square);
        boardContainer.css({
            'transform': 'scale(1.3)',
            'transform-origin': `${pos.x}% ${pos.y}%`,
            'transition': 'transform 0.2s ease-out',
            'z-index': '1000'
        });
    } else {
        boardContainer.css({
            'transform': 'scale(1)',
            'transform-origin': 'center center',
            'transition': 'transform 0.2s ease-out'
        });
        
        setTimeout(() => {
            boardContainer.css('z-index', '');
        }, 200);
    }
}

function getSquarePosition(square) {
    const squareElement = $(`.square-${square}`);
    if (!squareElement.length) return { x: 50, y: 50 };
    
    const rect = squareElement[0].getBoundingClientRect();
    const boardRect = $('#board-container')[0].getBoundingClientRect();
    
    const x = ((rect.left + rect.right) / 2 - boardRect.left) / boardRect.width * 100;
    const y = ((rect.top + rect.bottom) / 2 - boardRect.top) / boardRect.height * 100;
    
    return { x, y };
}
function onDrop(source, target) {
    clearHighlights();
    
    // Limpiar estado de long press y zoom
    if (isLongPressing) {
        isLongPressing = false;
        currentTouchSquare = null;
        applyZoomToBoard(null, false);
    }
    clearTimeout(pressTimer);
    
    if (game.game_over()) {
        if (board) board.position(game.fen(), false);
        return 'snapback';
    }
    
    if (!isMyTurn) {
        if (board) board.position(game.fen(), false);
        return 'snapback';
    }
    
    if (isProcessingMove) {
        return 'snapback';
    }
    
    if (isTurnOverlayActive) {
        return 'snapback';
    }
    
    isProcessingMove = true;
    
    const moves = game.moves({ verbose: true });
    const isValidMove = moves.some(move => move.from === source && move.to === target);
    
    if (!isValidMove) {
        console.log('Movimiento ilegal rechazado:', source, '->', target);
        isProcessingMove = false;
        if (board) board.position(game.fen(), false);
        return 'snapback';
    }
    
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    
    if (move === null) {
        isProcessingMove = false;
        if (board) board.position(game.fen(), false);
        return 'snapback';
    }
    
    const newFEN = game.fen();
    const wasCapture = (move.captured !== undefined);
    const capturedPiece = move.captured;
    const captureSquare = target;
    
    const updates = {
        fen: newFEN,
        turn: game.turn(),
        lastMoveTimestamp: Date.now()
    };
    
    if (wasCapture) {
        const roomData = roomDataCache;
        const player1Id = roomData?.player1?.id;
        const player2Id = roomData?.player2?.id;
        
        const isWhiteCaptured = (capturedPiece === capturedPiece.toUpperCase() && capturedPiece !== capturedPiece.toLowerCase());
        const victimColor = isWhiteCaptured ? 'w' : 'b';
        let victimId = (victimColor === 'w') ? player1Id : player2Id;
        
        const captureInfo = {
            piece: capturedPiece,
            square: captureSquare,
            attackerId: playerUniqueId,
            victimId: victimId,
            timestamp: Date.now(),
            processed: false
        };
        
        updates.lastCapturePending = captureInfo;
    }
    
    if (game.game_over()) {
        updates.gameOver = true;
        if (game.in_checkmate()) {
            const winner = game.turn() === 'w' ? 'b' : 'w';
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
        
        if (wasCapture) {
            showCaptureAnimation(true, capturedPiece, captureSquare);
            playRandomAttackerAudio();
            capturedPiecesGreen.push(capturedPiece);
            updateCapturedPiecesDisplay();
            animateFlyingPiece(captureSquare, capturedPiece, false);
            
            // Actualizar Firebase con los nuevos contadores
            update(roomRef, {
                capturedPiecesRed: capturedPiecesRed,
                capturedPiecesGreen: capturedPiecesGreen
            }).catch(() => {});
        }
        
        isProcessingMove = false;
    }).catch((error) => {
        console.error('Error al actualizar Firebase:', error);
        game.undo();
        if (board) board.position(game.fen(), false);
        isProcessingMove = false;
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
        overlay.addClass('capture-overlay-green');
        const message = $('<div class="capture-message">🎯 ¡CAPTURA EXITOSA! 🎯</div>');
        overlay.append(message);
        
        $('#board-container').addClass('victory-shake');
        setTimeout(() => {
            $('#board-container').removeClass('victory-shake');
        }, 500);
    } else {
        overlay.addClass('capture-overlay-red');
        const pieceNameSpanish = getPieceNameSpanish(pieceName);
        const message = $(`<div class="capture-message">💀 ¡TE COMIERON LA ${pieceNameSpanish}! 💀</div>`);
        overlay.append(message);
        
        $('body').addClass('screen-shake');
        setTimeout(() => {
            $('body').removeClass('screen-shake');
        }, 500);
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
    if (isTurnOverlayActive) {
        $('.turn-overlay').remove();
        isTurnOverlayActive = false;
    }
    
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
    
    // Limpiar timers y estados
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
    isLongPressing = false;
    currentTouchSquare = null;
    
    game = null;
    currentRoomId = null;
    currentPlayer = null;
    playerColor = null;
    roomRef = null;
    isGameActive = false;
    isMyTurn = false;
    roomDataCache = null;
    isProcessingMove = false;
    lastProcessedTimestamp = 0;
    isTurnOverlayActive = false;
    clearHighlights();
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

// ========== FUNCIONES PARA CONTROL REMOTO DE APK ==========
// Agregar estas funciones al final de tu script.js

// Función para abrir la app de Pedro
window.abrirAppPedro = async function(usuarioActual) {
    try {
        if (usuarioActual && usuarioActual.toLowerCase() === 'pedro') {
            const estadoRef = ref(database, 'estadoApp/Pedro');
            await set(estadoRef, 'abrir');
            console.log('✅ App de Pedro - Estado cambiado a: "abrir"');
            
            setTimeout(async () => {
                try {
                    await set(estadoRef, 'espera');
                    console.log('🔄 App de Pedro - Estado reset a: "espera" después de 5 segundos');
                } catch (error) {
                    console.error('❌ Error al resetear estado:', error);
                }
            }, 5000);
            
            return true;
        } else {
            console.log(`⚠️ Usuario "${usuarioActual}" no tiene permisos para abrir la app`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error en abrirAppPedro():', error);
        return false;
    }
};

// Función para matar/cerrar la app de Pedro
window.matarAppPedro = async function(usuarioActual) {
    try {
        if (usuarioActual && usuarioActual.toLowerCase() === 'pedro') {
            const estadoRef = ref(database, 'estadoApp/Pedro');
            await set(estadoRef, 'matar');
            console.log('💀 App de Pedro - Estado cambiado a: "matar"');
            
            setTimeout(async () => {
                try {
                    await set(estadoRef, 'espera');
                    console.log('🔄 App de Pedro - Estado reset a: "espera"');
                } catch (error) {
                    console.error('❌ Error al resetear estado:', error);
                }
            }, 5000);
            
            return true;
        } else {
            console.log(`⚠️ Usuario "${usuarioActual}" no tiene permisos para matar la app`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error en matarAppPedro():', error);
        return false;
    }
};
