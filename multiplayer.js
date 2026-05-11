// Configuración de Firebase (reemplaza con tus propias credenciales)
const firebaseConfig = {
  apiKey: "AIzaSyCSqgJA6uL8SkY-kphhuaR9TuGPulucPic",
  authDomain: "ajedrez-65b15.firebaseapp.com",
  projectId: "ajedrez-65b15",
  storageBucket: "ajedrez-65b15.firebasestorage.app",
  messagingSenderId: "501222935015",
  appId: "1:501222935015:web:bb08aeab5af07a77eb1542",
  measurementId: "G-HH7PYX89EG"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

class MultiplayerChess {
    constructor() {
        this.game = new ChessGame();
        this.playerId = null;
        this.playerName = null;
        this.playerElo = 1200;
        this.gameId = null;
        this.playerColor = null;
        this.isMyTurn = false;
        this.chat = null;
        this.timer = null;
        this.playerTime = 600; // 10 minutos
        this.opponentTime = 600;
        this.timerInterval = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadGameState();
    }

    setupEventListeners() {
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('find-match-btn').addEventListener('click', () => this.findMatch());
        document.getElementById('cancel-search-btn').addEventListener('click', () => this.cancelSearch());
        document.getElementById('resign-btn').addEventListener('click', () => this.resign());
        document.getElementById('draw-offer-btn').addEventListener('click', () => this.offerDraw());
        document.getElementById('leave-game-btn').addEventListener('click', () => this.leaveGame());
        
        // Delegación de eventos para el tablero
        document.getElementById('board').addEventListener('click', (e) => {
            const square = e.target.closest('.square');
            if (!square) return;
            
            const row = parseInt(square.dataset.row);
            const col = parseInt(square.dataset.col);
            this.handleSquareClick(row, col);
        });
        
        // Diálogo
        document.getElementById('dialog-overlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('dialog-overlay')) {
                this.closeDialog();
            }
        });
    }

    login() {
        const username = document.getElementById('username').value.trim();
        const errorDiv = document.getElementById('login-error');
        
        if (!username) {
            errorDiv.textContent = 'Por favor, ingresa un nombre';
            return;
        }
        
        if (username.length < 3) {
            errorDiv.textContent = 'El nombre debe tener al menos 3 caracteres';
            return;
        }
        
        this.playerName = username;
        this.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Guardar en localStorage
        localStorage.setItem('chessPlayerId', this.playerId);
        localStorage.setItem('chessPlayerName', username);
        
        // Obtener ELO del jugador
        database.ref(`players/${this.playerId}`).once('value').then((snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.playerElo = data.elo || 1200;
                this.stats = data.stats || { played: 0, won: 0, lost: 0, drawn: 0 };
            } else {
                this.stats = { played: 0, won: 0, lost: 0, drawn: 0 };
                this.savePlayerData();
            }
            this.showLobby();
        });
    }

    savePlayerData() {
        database.ref(`players/${this.playerId}`).set({
            name: this.playerName,
            elo: this.playerElo,
            stats: this.stats,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    }

    logout() {
        if (this.currentSearchRef) {
            this.currentSearchRef.remove();
        }
        if (this.gameId) {
            this.cleanupGame();
        }
        
        localStorage.removeItem('chessPlayerId');
        localStorage.removeItem('chessPlayerName');
        
        this.playerId = null;
        this.playerName = null;
        this.showLogin();
    }

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.add('hidden');
    }

    showLobby() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        
        document.getElementById('player-name-display').textContent = this.playerName;
        document.getElementById('player-elo').textContent = this.playerElo;
        
        // Cargar estadísticas
        this.updateStatsDisplay();
    }

    updateStatsDisplay() {
        document.getElementById('games-played').textContent = this.stats.played;
        document.getElementById('games-won').textContent = this.stats.won;
        document.getElementById('games-lost').textContent = this.stats.lost;
        document.getElementById('games-drawn').textContent = this.stats.drawn;
    }

    showGame() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        
        document.getElementById('player-game-name').textContent = this.playerName;
        document.getElementById('player-game-elo').textContent = this.playerElo;
        document.getElementById('opponent-name').textContent = this.opponentName || 'Oponente';
        document.getElementById('opponent-elo').textContent = this.opponentElo || '1200';
        
        this.renderBoard();
        this.updateTurnIndicator();
    }

    findMatch() {
        if (!this.playerId) return;
        
        const findMatchBtn = document.getElementById('find-match-btn');
        const searchingStatus = document.getElementById('searching-status');
        
        findMatchBtn.disabled = true;
        searchingStatus.classList.remove('hidden');
        
        // Buscar partida disponible o crear una nueva solicitud
        const matchmakingRef = database.ref('matchmaking');
        
        // Primero, verificar si hay solicitudes pendientes
        matchmakingRef.orderByChild('timestamp').limitToFirst(1).once('value').then((snapshot) => {
            const requests = snapshot.val();
            
            if (requests) {
                // Hay una solicitud pendiente
                const [requestId, requestData] = Object.entries(requests)[0];
                
                // No emparejarse con uno mismo
                if (requestData.playerId !== this.playerId) {
                    // Eliminar la solicitud y crear el juego
                    matchmakingRef.child(requestId).remove();
                    this.createGame(requestData.playerId, requestData.playerName, requestData.elo);
                    return;
                }
            }
            
            // Crear nueva solicitud de emparejamiento
            const newRequest = {
                playerId: this.playerId,
                playerName: this.playerName,
                elo: this.playerElo,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            
            this.currentSearchRef = matchmakingRef.push(newRequest);
            
            // Escuchar cambios (cuando se elimina la solicitud = emparejado)
            this.searchListener = this.currentSearchRef.on('value', (snapshot) => {
                if (!snapshot.exists()) {
                    // La solicitud fue eliminada, verificar si estamos en un juego
                    this.checkForActiveGame();
                }
            });
        }).catch((error) => {
            console.error('Error en matchmaking:', error);
            findMatchBtn.disabled = false;
            searchingStatus.classList.add('hidden');
        });
    }

    cancelSearch() {
        if (this.currentSearchRef) {
            this.currentSearchRef.remove();
            this.currentSearchRef = null;
        }
        if (this.searchListener) {
            this.currentSearchRef?.off('value', this.searchListener);
        }
        
        document.getElementById('find-match-btn').disabled = false;
        document.getElementById('searching-status').classList.add('hidden');
    }

    checkForActiveGame() {
        database.ref(`games`).orderByChild(`players/${this.playerId}`).equalTo(true).once('value').then((snapshot) => {
            const games = snapshot.val();
            if (games) {
                const [gameId, gameData] = Object.entries(games)[0];
                this.joinGame(gameId, gameData);
            }
        });
    }

    createGame(opponentId, opponentName, opponentElo) {
        const gameId = 'game_' + Date.now();
        const playerColor = Math.random() < 0.5 ? 'white' : 'black';
        
        const gameData = {
            players: {
                [this.playerId]: true,
                [opponentId]: true
            },
            playerInfo: {
                [this.playerId]: {
                    name: this.playerName,
                    elo: this.playerElo,
                    color: playerColor
                },
                [opponentId]: {
                    name: opponentName,
                    elo: opponentElo,
                    color: playerColor === 'white' ? 'black' : 'white'
                }
            },
            currentTurn: 'white',
            board: this.game.board,
            moveHistory: [],
            status: 'active',
            winner: null,
            drawOffer: null,
            timers: {
                white: 600,
                black: 600,
                lastTick: firebase.database.ServerValue.TIMESTAMP
            }
        };
        
        database.ref(`games/${gameId}`).set(gameData);
        this.joinGame(gameId, gameData);
        
        // Notificar al oponente
        database.ref(`players/${opponentId}/gameInvite`).set({
            gameId: gameId,
            opponent: this.playerName
        });
    }

    joinGame(gameId, gameData) {
        this.gameId = gameId;
        this.game.reset();
        this.game.board = gameData.board;
        this.game.moveHistory = gameData.moveHistory || [];
        
        this.playerColor = gameData.playerInfo[this.playerId].color;
        this.opponentName = gameData.playerInfo[Object.keys(gameData.players).find(id => id !== this.playerId)].name;
        this.opponentElo = gameData.playerInfo[Object.keys(gameData.players).find(id => id !== this.playerId)].elo;
        
        this.playerTime = gameData.timers[this.playerColor];
        this.opponentTime = gameData.timers[this.playerColor === 'white' ? 'black' : 'white'];
        
        this.isMyTurn = gameData.currentTurn === this.playerColor;
        
        this.showGame();
        this.startGameListeners();
        this.startTimer();
        this.updateMoveHistory();
        
        // Inicializar chat
        this.chat = new Chat(gameId, this.playerId, this.playerName, database);
        
        // Limpiar búsqueda
        this.cancelSearch();
    }

    startGameListeners() {
        // Escuchar cambios en el juego
        this.gameRef = database.ref(`games/${this.gameId}`);
        
        this.gameListener = this.gameRef.on('value', (snapshot) => {
            const gameData = snapshot.val();
            if (!gameData) {
                this.handleGameDeleted();
                return;
            }
            
            // Actualizar tablero si hay movimientos
            if (JSON.stringify(gameData.board) !== JSON.stringify(this.game.board)) {
                this.game.board = gameData.board;
                this.game.moveHistory = gameData.moveHistory || [];
                this.game.currentTurn = gameData.currentTurn;
                this.isMyTurn = gameData.currentTurn === this.playerColor;
                
                this.renderBoard();
                this.updateTurnIndicator();
                this.updateMoveHistory();
                this.updateTimers(gameData.timers);
            }
            
            // Verificar estado del juego
            if (gameData.status !== 'active') {
                this.handleGameEnd(gameData);
            }
            
            // Verificar oferta de tablas
            if (gameData.drawOffer && gameData.drawOffer !== this.playerId) {
                this.handleDrawOffer(gameData.drawOffer);
            }
        });
    }

    updateTimers(timers) {
        this.playerTime = timers[this.playerColor];
        this.opponentTime = timers[this.playerColor === 'white' ? 'black' : 'white'];
        this.updateTimerDisplay();
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            if (!this.gameId || this.game.gameOver) return;
            
            if (this.isMyTurn) {
                this.playerTime--;
                if (this.playerTime <= 0) {
                    this.playerTime = 0;
                    this.loseByTime();
                }
            } else {
                this.opponentTime--;
                if (this.opponentTime <= 0) {
                    this.opponentTime = 0;
                    // El oponente pierde por tiempo
                }
            }
            
            this.updateTimerDisplay();
            
            // Actualizar tiempos en Firebase cada 10 segundos
            if (Math.floor(Date.now() / 10000) % 3 === 0) {
                database.ref(`games/${this.gameId}/timers`).update({
                    [this.playerColor]: this.playerTime,
                    [this.playerColor === 'white' ? 'black' : 'white']: this.opponentTime,
                    lastTick: firebase.database.ServerValue.TIMESTAMP
                });
            }
        }, 1000);
    }

    updateTimerDisplay() {
        document.getElementById('player-timer').textContent = this.formatTime(this.playerTime);
        document.getElementById('opponent-timer').textContent = this.formatTime(this.opponentTime);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    loseByTime() {
        if (this.game.gameOver) return;
        
        this.game.gameOver = true;
        this.game.gameResult = `${this.opponentName} gana por tiempo`;
        
        database.ref(`games/${this.gameId}`).update({
            status: 'finished',
            winner: this.playerColor === 'white' ? 'black' : 'white',
            reason: 'time'
        });
        
        this.showGameResult(this.game.gameResult);
    }

    handleSquareClick(row, col) {
        if (!this.isMyTurn || this.game.gameOver) return;
        
        const piece = this.game.board[row][col];
        
        if (this.game.selectedPiece) {
            // Intentar mover
            const fromRow = this.game.selectedPiece.row;
            const fromCol = this.game.selectedPiece.col;
            
            if (this.game.makeMove(fromRow, fromCol, row, col)) {
                // Movimiento exitoso
                const moveData = {
                    board: this.game.board,
                    moveHistory: this.game.moveHistory,
                    currentTurn: this.game.currentTurn,
                    lastMove: this.game.lastMove,
                    gameOver: this.game.gameOver,
                    gameResult: this.game.gameResult
                };
                
                database.ref(`games/${this.gameId}`).update(moveData);
                
                this.game.selectedPiece = null;
                this.game.validMoves = [];
                this.renderBoard();
                this.updateTurnIndicator();
                
                if (this.game.gameOver) {
                    this.handleLocalGameEnd();
                }
            } else {
                // Movimiento inválido, deseleccionar o seleccionar nueva pieza
                this.game.selectedPiece = null;
                this.game.validMoves = [];
                if (piece && piece.color === this.playerColor) {
                    this.game.selectedPiece = { row, col };
                    this.game.validMoves = this.game.getPieceMoves(row, col, piece);
                }
                this.renderBoard();
            }
        } else if (piece && piece.color === this.playerColor) {
            // Seleccionar pieza
            this.game.selectedPiece = { row, col };
            this.game.validMoves = this.game.getPieceMoves(row, col, piece);
            this.renderBoard();
        }
    }

    renderBoard() {
        const boardDiv = document.getElementById('board');
        boardDiv.innerHTML = '';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = 'square';
                square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
                square.dataset.row = row;
                square.dataset.col = col;
                
                // Marcar casilla seleccionada
                if (this.game.selectedPiece && 
                    this.game.selectedPiece.row === row && 
                    this.game.selectedPiece.col === col) {
                    square.classList.add('selected');
                }
                
                // Marcar movimientos válidos
                if (this.game.validMoves.some(m => m.row === row && m.col === col)) {
                    square.classList.add('valid-move');
                }
                
                // Marcar último movimiento
                if (this.game.lastMove) {
                    if ((this.game.lastMove.fromRow === row && this.game.lastMove.fromCol === col) ||
                        (this.game.lastMove.toRow === row && this.game.lastMove.toCol === col)) {
                        square.classList.add('last-move');
                    }
                }
                
                // Marcar rey en jaque
                if (this.game.isInCheck(this.playerColor) && 
                    this.game.kingPositions[this.playerColor].row === row &&
                    this.game.kingPositions[this.playerColor].col === col) {
                    square.classList.add('king-in-check');
                }
                
                // Renderizar pieza
                const piece = this.game.board[row][col];
                if (piece) {
                    const pieceDiv = document.createElement('div');
                    pieceDiv.className = 'piece';
                    pieceDiv.textContent = this.getPieceSymbol(piece);
                    square.appendChild(pieceDiv);
                }
                
                boardDiv.appendChild(square);
            }
        }
    }

    getPieceSymbol(piece) {
        const symbols = {
            king: { white: '♔', black: '♚' },
            queen: { white: '♕', black: '♛' },
            rook: { white: '♖', black: '♜' },
            bishop: { white: '♗', black: '♝' },
            knight: { white: '♘', black: '♞' },
            pawn: { white: '♙', black: '♟' }
        };
        return symbols[piece.type][piece.color];
    }

    updateTurnIndicator() {
        const indicator = document.getElementById('turn-indicator');
        if (this.game.gameOver) {
            indicator.textContent = 'Juego terminado';
        } else {
            indicator.textContent = this.isMyTurn ? 'Tu turno' : 'Turno del oponente';
        }
    }

    updateMoveHistory() {
        const movesList = document.getElementById('moves-list');
        movesList.innerHTML = '';
        
        for (let i = 0; i < this.game.moveHistory.length; i += 2) {
            const movePair = document.createElement('div');
            movePair.className = 'move-pair';
            
            const moveNumber = document.createElement('span');
            moveNumber.className = 'move-number';
            moveNumber.textContent = `${Math.floor(i / 2) + 1}.`;
            movePair.appendChild(moveNumber);
            
            const whiteMove = document.createElement('span');
            whiteMove.className = 'move-white';
            whiteMove.textContent = this.game.moveHistory[i]?.notation || '';
            movePair.appendChild(whiteMove);
            
            if (i + 1 < this.game.moveHistory.length) {
                const blackMove = document.createElement('span');
                blackMove.className = 'move-black';
                blackMove.textContent = this.game.moveHistory[i + 1]?.notation || '';
                movePair.appendChild(blackMove);
            }
            
            movesList.appendChild(movePair);
        }
        
        // Scroll al final
        movesList.parentElement.scrollTop = movesList.parentElement.scrollHeight;
    }

    handleLocalGameEnd() {
        if (this.game.gameOver) {
            database.ref(`games/${this.gameId}`).update({
                status: 'finished',
                winner: this.game.gameResult.includes('blancas') ? 'white' : 
                        this.game.gameResult.includes('negras') ? 'black' : 'draw',
                reason: this.game.gameResult
            });
        }
    }

    handleGameEnd(gameData) {
        this.game.gameOver = true;
        
        let result;
        if (gameData.winner === 'draw') {
            result = 'Tablas';
        } else if (gameData.winner === this.playerColor) {
            result = '¡Has ganado!';
        } else {
            result = 'Has perdido';
        }
        
        this.game.gameResult = result;
        this.showGameResult(result);
        
        // Actualizar ELO y estadísticas
        this.updatePlayerStats(gameData);
    }

    updatePlayerStats(gameData) {
        if (gameData.processed) return; // Evitar procesar múltiples veces
        
        // Marcar como procesado
        database.ref(`games/${this.gameId}/processed`).set(true);
        
        this.stats.played++;
        
        if (gameData.winner === this.playerColor) {
            this.stats.won++;
            this.playerElo += 25;
        } else if (gameData.winner === 'draw') {
            this.stats.drawn++;
        } else {
            this.stats.lost++;
            this.playerElo = Math.max(100, this.playerElo - 25);
        }
        
        this.savePlayerData();
        this.updateStatsDisplay();
    }

    showGameResult(result) {
        document.getElementById('game-status').textContent = result;
        document.getElementById('resign-btn').classList.add('hidden');
        document.getElementById('draw-offer-btn').classList.add('hidden');
        document.getElementById('leave-game-btn').classList.remove('hidden');
    }

    resign() {
        this.showDialog('¿Estás seguro de que quieres abandonar?', [
            { text: 'Cancelar', class: 'btn-secondary', action: () => this.closeDialog() },
            { text: 'Abandonar', class: 'btn-primary', action: () => {
                database.ref(`games/${this.gameId}`).update({
                    status: 'finished',
                    winner: this.playerColor === 'white' ? 'black' : 'white',
                    reason: 'resignation'
                });
                this.closeDialog();
            }}
        ]);
    }

    offerDraw() {
        this.showDialog('¿Ofrecer tablas a tu oponente?', [
            { text: 'Cancelar', class: 'btn-secondary', action: () => this.closeDialog() },
            { text: 'Ofrecer tablas', class: 'btn-primary', action: () => {
                database.ref(`games/${this.gameId}/drawOffer`).set(this.playerId);
                this.chat.sendSystemMessage(`${this.playerName} ofrece tablas`);
                this.closeDialog();
            }}
        ]);
    }

    handleDrawOffer(offerPlayerId) {
        const offerPlayerColor = offerPlayerId === this.playerId ? this.playerColor : 
                                (this.playerColor === 'white' ? 'black' : 'white');
        
        this.showDialog(`${this.opponentName} ofrece tablas. ¿Aceptas?`, [
            { text: 'Rechazar', class: 'btn-secondary', action: () => {
                database.ref(`games/${this.gameId}/drawOffer`).remove();
                this.closeDialog();
            }},
            { text: 'Aceptar', class: 'btn-primary', action: () => {
                database.ref(`games/${this.gameId}`).update({
                    status: 'finished',
                    winner: 'draw',
                    reason: 'mutual_agreement'
                });
                database.ref(`games/${this.gameId}/drawOffer`).remove();
                this.closeDialog();
            }}
        ]);
    }

    leaveGame() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.gameRef && this.gameListener) {
            this.gameRef.off('value', this.gameListener);
        }
        if (this.chat) {
            this.chat.destroy();
        }
        
        this.gameId = null;
        this.playerColor = null;
        this.isMyTurn = false;
        this.chat = null;
        
        this.game.reset();
        this.showLobby();
    }

    handleGameDeleted() {
        this.showDialog('La partida ha sido eliminada', [
            { text: 'Aceptar', class: 'btn-primary', action: () => {
                this.closeDialog();
                this.leaveGame();
            }}
        ]);
    }

    cleanupGame() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.gameRef && this.gameListener) {
            this.gameRef.off('value', this.gameListener);
        }
        if (this.chat) {
            this.chat.destroy();
        }
    }

    showDialog(message, buttons) {
        document.getElementById('dialog-message').textContent = message;
        const buttonsDiv = document.getElementById('dialog-buttons');
        buttonsDiv.innerHTML = '';
        
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.textContent = btn.text;
            button.className = btn.class;
            button.addEventListener('click', btn.action);
            buttonsDiv.appendChild(button);
        });
        
        document.getElementById('dialog-overlay').classList.remove('hidden');
    }

    closeDialog() {
        document.getElementById('dialog-overlay').classList.add('hidden');
    }

    loadGameState() {
        const savedPlayerId = localStorage.getItem('chessPlayerId');
        const savedPlayerName = localStorage.getItem('chessPlayerName');
        
        if (savedPlayerId && savedPlayerName) {
            this.playerId = savedPlayerId;
            this.playerName = savedPlayerName;
            
            database.ref(`players/${this.playerId}`).once('value').then((snapshot) => {
                const data = snapshot.val();
                if (data) {
                    this.playerElo = data.elo || 1200;
                    this.stats = data.stats || { played: 0, won: 0, lost: 0, drawn: 0 };
                } else {
                    this.stats = { played: 0, won: 0, lost: 0, drawn: 0 };
                    this.savePlayerData();
                }
                
                // Verificar si hay juego activo
                database.ref('games').orderByChild(`players/${this.playerId}`).equalTo(true).once('value').then((snapshot) => {
                    const games = snapshot.val();
                    if (games) {
                        const [gameId, gameData] = Object.entries(games)[0];
                        this.joinGame(gameId, gameData);
                    } else {
                        this.showLobby();
                    }
                });
            });
        } else {
            this.showLogin();
        }
    }
}

// Inicializar cuando la página cargue
window.addEventListener('DOMContentLoaded', () => {
    new MultiplayerChess();
});
