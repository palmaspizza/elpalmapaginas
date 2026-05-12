import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, set, onValue, push, remove, onDisconnect, update } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

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

$(document).ready(() => {
    const savedName = localStorage.getItem('chessPlayerName');
    if (savedName) {
        $('#player-name').val(savedName);
    }
    
    $('#search-btn').click(startMatchmaking);
    $('#leave-btn').click(leaveGame);
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
    
    onValue(roomsRef, (snapshot) => {
        if (currentRoomId) return;
        
        const rooms = snapshot.val();
        let availableRoom = null;
        
        if (rooms) {
            for (const [roomId, roomData] of Object.entries(rooms)) {
                if (roomData.player1 && !roomData.player2 && !roomData.gameOver) {
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
    }, { onlyOnce: true });
}

function createNewRoom() {
    const roomsRef = ref(database, 'rooms');
    const newRoomRef = push(roomsRef);
    currentRoomId = newRoomRef.key;
    
    const initialFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const roomData = {
        player1: {
            name: playerName,
            id: Date.now().toString()
        },
        player2: null,
        fen: initialFEN,
        turn: 'w',
        gameOver: false,
        winner: null,
        createdAt: Date.now()
    };
    
    set(newRoomRef, roomData).then(() => {
        setupGame(newRoomRef, 'player1', 'w');
        setupRoomCleanup();
        $('#search-status').html('Esperando oponente... <i class="fas fa-hourglass-half"></i>');
    });
}

function joinRoom(roomId, roomData) {
    currentRoomId = roomId;
    const roomRef_full = ref(database, `rooms/${roomId}`);
    
    const updatedData = {
        player2: {
            name: playerName,
            id: Date.now().toString()
        }
    };
    
    update(roomRef_full, updatedData).then(() => {
        setupGame(roomRef_full, 'player2', 'b');
        $('#search-status').html('¡Partida encontrada! <i class="fas fa-check"></i>');
        setTimeout(() => {
            $('#overlay').fadeOut();
        }, 1000);
    });
}

function setupGame(roomReference, playerPosition, color) {
    currentPlayer = playerPosition;
    playerColor = color;
    roomRef = roomReference;
    
    game = new Chess();
    
    onValue(roomRef, (snapshot) => {
        const roomData = snapshot.val();
        if (roomData) {
            if (roomData.fen && roomData.fen !== game.fen()) {
                game.load(roomData.fen);
                if (board) {
                    board.position(roomData.fen);
                }
            }
            
            updateUI(roomData);
            
            if (!currentPlayer && roomData.player1 && roomData.player2) {
                setupGame(roomReference, null, null);
            }
        }
    });
    
    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };
    
    board = Chessboard('board-container', config);
    
    $('#leave-btn').show();
    isGameActive = true;
}

function onDragStart(source, piece, position, orientation) {
    if (!isGameActive) return false;
    
    onValue(roomRef, (snapshot) => {
        const roomData = snapshot.val();
        if (roomData.gameOver) return false;
        
        const currentTurn = roomData.turn;
        
        if (currentPlayer === 'player1' && currentTurn !== 'w') return false;
        if (currentPlayer === 'player2' && currentTurn !== 'b') return false;
        
        const pieceColor = piece.charAt(0);
        if ((currentPlayer === 'player1' && pieceColor !== 'w') ||
            (currentPlayer === 'player2' && pieceColor !== 'b')) {
            return false;
        }
    }, { onlyOnce: true });
    
    return true;
}

function onDrop(source, target) {
    onValue(roomRef, (snapshot) => {
        const roomData = snapshot.val();
        
        if (roomData.gameOver) {
            board.position(game.fen());
            return 'snapback';
        }
        
        const currentTurn = roomData.turn;
        
        if (currentPlayer === 'player1' && currentTurn !== 'w') {
            board.position(game.fen());
            return 'snapback';
        }
        if (currentPlayer === 'player2' && currentTurn !== 'b') {
            board.position(game.fen());
            return 'snapback';
        }
        
        const move = game.move({
            from: source,
            to: target,
            promotion: 'q'
        });
        
        if (move === null) {
            return 'snapback';
        }
        
        const newFEN = game.fen();
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
                updates.winnerName = winner === 'w' ? roomData.player1?.name : roomData.player2?.name;
            } else if (game.in_stalemate() || game.in_threefold_repetition()) {
                updates.winner = 'draw';
                updates.winnerName = 'Tablas';
            }
        }
        
        update(roomRef, updates);
        
    }, { onlyOnce: true });
    
    return 'snapback';
}

function onSnapEnd() {
    board.position(game.fen());
}

function updateUI(roomData) {
    if (roomData.player1) {
        $('#player1-name').text(roomData.player1.name || 'Jugador 1');
    }
    
    if (roomData.player2) {
        $('#player2-name').text(roomData.player2.name || 'Jugador 2');
    }
    
    const turnText = roomData.turn === 'w' ? 'Blancas' : 'Negras';
    $('#turn-text').html(`${turnText} <i class="fas fa-chess-${roomData.turn === 'w' ? 'king' : 'knight'}"></i>`);
    
    if (roomData.gameOver) {
        isGameActive = false;
        let statusMessage = '';
        if (roomData.winner === 'draw') {
            statusMessage = '♟️ ¡Tablas! Partida empatada ♟️';
        } else if (roomData.winner === 'w') {
            statusMessage = `🏆 ¡Jaque Mate! Ganan las Blancas (${roomData.player1?.name}) 🏆`;
        } else if (roomData.winner === 'b') {
            statusMessage = `🏆 ¡Jaque Mate! Ganan las Negras (${roomData.player2?.name}) 🏆`;
        }
        
        $('#game-status').html(statusMessage);
        $('#turn-text').html('Partida finalizada');
        
        setTimeout(() => {
            if (confirm('Partida finalizada. ¿Deseas jugar otra partida?')) {
                leaveGame();
                startMatchmaking();
            }
        }, 500);
    } else {
        if (game.in_check()) {
            const checkedColor = game.turn() === 'w' ? 'Blancas' : 'Negras';
            $('#game-status').html(`⚠️ ¡${checkedColor} están en jaque! ⚠️`);
        } else {
            $('#game-status').html('');
        }
    }
    
    if (currentPlayer === 'player1' && roomData.turn === 'w') {
        $('#turn-indicator').css('background', 'linear-gradient(135deg, #28a745 0%, #20c997 100%)');
    } else if (currentPlayer === 'player2' && roomData.turn === 'b') {
        $('#turn-indicator').css('background', 'linear-gradient(135deg, #28a745 0%, #20c997 100%)');
    } else {
        $('#turn-indicator').css('background', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
    }
}

function leaveGame() {
    if (roomRef && currentRoomId) {
        if (currentPlayer === 'player1') {
            update(roomRef, { gameOver: true, winner: 'abandoned', winnerName: `${playerName} abandonó` });
        }
        
        setTimeout(() => {
            remove(ref(database, `rooms/${currentRoomId}`)).then(() => {
                resetGame();
                $('#overlay').fadeIn();
                $('#search-status').html('');
                $('#search-btn').prop('disabled', false);
                $('#leave-btn').hide();
            });
        }, 500);
    } else {
        resetGame();
        $('#overlay').fadeIn();
        $('#search-status').html('');
        $('#search-btn').prop('disabled', false);
        $('#leave-btn').hide();
    }
}

function resetGame() {
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
    $('#board-container').empty();
    $('#board-container').html('');
    const config = {
        draggable: true,
        position: 'start'
    };
    board = Chessboard('board-container', config);
    board.destroy();
    $('#board-container').empty();
}

function setupRoomCleanup() {
    if (roomRef) {
        onDisconnect(roomRef).remove();
    }
}