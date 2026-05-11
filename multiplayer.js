// ⚠️ REEMPLAZA estas credenciales con las tuyas de Firebase Console
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCSqgJA6uL8SkY-kphhuaR9TuGPulucPic",
  authDomain: "ajedrez-65b15.firebaseapp.com",
  projectId: "ajedrez-65b15",
  storageBucket: "ajedrez-65b15.firebasestorage.app",
  messagingSenderId: "501222935015",
  appId: "1:501222935015:web:bb08aeab5af07a77eb1542",
  measurementId: "G-HH7PYX89EG"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

class MultiplayerChess {
    constructor() {
        this.game = new ChessGame();
        this.playerId = null;
        this.playerName = null;
        this.playerElo = 1200;
        this.stats = { played: 0, won: 0, lost: 0, drawn: 0 };
        this.gameId = null;
        this.playerColor = null;
        this.isMyTurn = false;
        this.opponentName = null;
        this.opponentElo = 1200;
        this.chat = null;
        this.playerTime = 600;
        this.opponentTime = 600;
        this.timerInterval = null;
        this.currentSearchRef = null;
        this.searchListener = null;
        this.gameRef = null;
        this.gameListener = null;
        
        this.init();
    }

    init() {
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('find-match-btn').addEventListener('click', () => this.findMatch());
        document.getElementById('cancel-search-btn').addEventListener('click', () => this.cancelSearch());
        document.getElementById('resign-btn').addEventListener('click', () => this.resign());
        document.getElementById('draw-offer-btn').addEventListener('click', () => this.offerDraw());
        document.getElementById('leave-game-btn').addEventListener('click', () => this.leaveGame());
        
        document.getElementById('board').addEventListener('click', (e) => {
            const square = e.target.closest('.square');
            if (!square) return;
            const row = parseInt(square.dataset.row);
            const col = parseInt(square.dataset.col);
            this.handleSquareClick(row, col);
        });
        
        document.getElementById('dialog-overlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('dialog-overlay')) this.closeDialog();
        });
        
        this.loadGameState();
    }

    login() {
        const username = document.getElementById('username').value.trim();
        const errorDiv = document.getElementById('login-error');
        
        if (!username) { errorDiv.textContent = 'Ingresa un nombre'; return; }
        if (username.length < 3) { errorDiv.textContent = 'Mínimo 3 caracteres'; return; }
        
        this.playerName = username;
        this.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        localStorage.setItem('chessPlayerId', this.playerId);
        localStorage.setItem('chessPlayerName', username);
        
        database.ref(`players/${this.playerId}`).once('value').then((snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.playerElo = data.elo || 1200;
                this.stats = data.stats || { played: 0, won: 0, lost: 0, drawn: 0 };
            } else {
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
        this.updateStatsDisplay();
    }

    showGame() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        document.getElementById('player-game-name').textContent = this.playerName;
        document.getElementById('player-game-elo').textContent = this.playerElo;
        document.getElementById('opponent-name').textContent = this.opponentName || 'Oponente';
        document.getElementById('opponent-elo').textContent = this.opponentElo;
        document.getElementById('game-status').textContent = '';
        document.getElementById('resign-btn').classList.remove('hidden');
        document.getElementById('draw-offer-btn').classList.remove('hidden');
        document.getElementById('leave-game-btn').classList.add('hidden');
        this.updateTimerDisplay();
        this.renderBoard();
        this.updateTurnIndicator();
        this.updateMoveHistory();
    }

    updateStatsDisplay() {
        document.getElementById('games-played').textContent = this.stats.played;
        document.getElementById('games-won').textContent = this.stats.won;
        document.getElementById('games-lost').textContent = this.stats.lost;
        document.getElementById('games-drawn').textContent = this.stats.drawn;
    }

    findMatch() {
        if (!this.playerId) return;
        document.getElementById('find-match-btn').disabled = true;
        document.getElementById('searching-status').classList.remove('hidden');
        
        const matchmakingRef = database.ref('matchmaking');
        matchmakingRef.orderByChild('timestamp').limitToFirst(1).once('value').then((snapshot) => {
            const requests = snapshot.val();
            if (requests) {
                const [requestId, requestData] = Object.entries(requests)[0];
                if (requestData.playerId !== this.playerId) {
                    matchmakingRef.child(requestId).remove();
                    this.createGame(requestData.playerId, requestData.playerName, requestData.elo);
                    return;
                }
            }
            
            this.currentSearchRef = matchmakingRef.push({
                playerId: this.playerId,
                playerName: this.playerName,
                elo: this.playerElo,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            
            this.searchListener = this.currentSearchRef.on('value', (snapshot) => {
                if (!snapshot.exists()) {
                    document.getElementById('find-match-btn').disabled = false;
                    document.getElementById('searching-status').classList.add('hidden');
                    this.checkForActiveGame();
                }
            });
        });
    }

    cancelSearch() {
        if (this.currentSearchRef) {
            this.currentSearchRef.remove();
            this.currentSearchRef = null;
        }
        if (this.searchListener && this.currentSearchRef) {
            this.currentSearchRef.off('value', this.searchListener);
        }
        document.getElementById('find-match-btn').disabled = false;
        document.getElementById('searching-status').classList.add('hidden');
    }

    checkForActiveGame() {
        database.ref('games').orderByChild(`players/${this.playerId}`).equalTo(true).once('value').then((snapshot) => {
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
        const opponentColor = playerColor === 'white' ? 'black' : 'white';
        
        const gameData = {
            players: { [this.playerId]: true, [opponentId]: true },
            playerInfo: {
                [this.playerId]: { name: this.playerName, elo: this.playerElo, color: playerColor },
                [opponentId]: { name: opponentName, elo: opponentElo, color: opponentColor }
            },
            currentTurn: 'white',
            board: this.game.board,
            moveHistory: [],
            lastMove: null,
            status: 'active',
            winner: null,
            reason: null,
            drawOffer: null,
            processed: false,
            timers: { white: 600, black: 600, lastTick: firebase.database.ServerValue.TIMESTAMP }
        };
        
        database.ref(`games/${gameId}`).set(gameData);
        this.joinGame(gameId, gameData);
        this.cancelSearch();
    }

    joinGame(gameId, gameData) {
        this.gameId = gameId;
        const myInfo = gameData.playerInfo[this.playerId];
        this.playerColor = myInfo.color;
        
        const opponentId = Object.keys(gameData.players).find(id => id !== this.playerId);
        const opponentInfo = gameData.playerInfo[opponentId];
        this.opponentName = opponentInfo.name;
        this.opponentElo = opponentInfo.elo;
        
        this.game.loadFromData(gameData);
        this.isMyTurn = gameData.currentTurn === this.playerColor;
        this.playerTime = gameData.timers[this.playerColor];
        this.opponentTime = gameData.timers[this.playerColor === 'white' ? 'black' : 'white'];
        
        this.showGame();
        this.startGameListeners();
        this.startTimer();
        this.chat = new Chat(gameId, this.playerId, this.playerName, database);
    }

    startGameListeners() {
        this.gameRef = database.ref(`games/${this.gameId}`);
        this.gameListener = this.gameRef.on('value', (snapshot) => {
            const gameData = snapshot.val();
            if (!gameData) { this.handleGameDeleted(); return; }
            
            if (gameData.status === 'finished') {
                this.handleGameEnd(gameData);
                return;
            }
            
            // Actualizar tablero si cambió
            const boardChanged = JSON.stringify(gameData.board) !== JSON.stringify(this.game.board);
            const turnChanged = gameData.currentTurn !== this.game.currentTurn;
            
            if (boardChanged || turnChanged) {
                this.game.loadFromData(gameData);
                this.isMyTurn = gameData.currentTurn === this.playerColor;
                this.renderBoard();
                this.updateTurnIndicator();
                this.updateMoveHistory();
            }
            
            // Actualizar tiempos
            if (gameData.timers) {
                this.playerTime = gameData.timers[this.playerColor] || this.playerTime;
                this.opponentTime = gameData.timers[this.playerColor === 'white' ? 'black' : 'white'] || this.opponentTime;
                this.updateTimerDisplay();
            }
            
            // Verificar oferta de tablas
            if (gameData.drawOffer && gameData.drawOffer !== this.playerId) {
                this.handleDrawOffer(gameData.drawOffer);
            }
        });
    }

    handleSquareClick(row, col) {
        if (!this.isMyTurn || this.game.gameOver) return;
        
        const piece = this.game.board[row][col];
        
        if (this.game.selectedPiece) {
            const fromRow = this.game.selectedPiece.row;
            const fromCol = this.game.selectedPiece.col;
            
            if (this.game.makeMove(fromRow, fromCol, row, col)) {
                // Movimiento exitoso
                const updateData = {
                    board: this.game.board,
                    moveHistory: this.game.moveHistory,
                    currentTurn: this.game.currentTurn,
                    lastMove: this.game.lastMove,
                    gameOver: this.game.gameOver,
                    gameResult: this.game.gameResult
                };
                
                if (this.game.gameOver) {
                    updateData.status = 'finished';
                    updateData.winner = this.game.gameResult.includes('Blancas') ? 'white' :
                                       this.game.gameResult.includes('Negras') ? 'black' : 'draw';
                    updateData.reason = this.game.gameResult;
                }
                
                database.ref(`games/${this.gameId}`).update(updateData);
                
                this.game.selectedPiece = null;
                this.game.validMoves = [];
                this.renderBoard();
                this.updateTurnIndicator();
                this.updateMoveHistory();
                
                if (this.game.gameOver) {
                    this.showGameResult(this.game.gameResult);
                }
            } else {
                // Click en movimiento inválido: deseleccionar o cambiar selección
                this.game.selectedPiece = null;
                this.game.validMoves = [];
                if (piece && piece.color === this.playerColor) {
                    this.game.selectedPiece = { row, col };
                    this.game.validMoves = this.game.getPieceMoves(row, col, piece);
                }
                this.renderBoard();
            }
        } else if (piece && piece.color === this.playerColor) {
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
                square.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
                square.dataset.row = row;
                square.dataset.col = col;
                
                if (this.game.selectedPiece && this.game.selectedPiece.row === row && this.game.selectedPiece.col === col) {
                    square.classList.add('selected');
                }
                if (this.game.validMoves.some(m => m.row === row && m.col === col)) {
                    square.classList.add('valid-move');
                }
                if (this.game.lastMove) {
                    if ((this.game.lastMove.fromRow === row && this.game.lastMove.fromCol === col) ||
                        (this.game.lastMove.toRow === row && this.game.lastMove.toCol === col)) {
                        square.classList.add('last-move');
                    }
                }
                if (this.game.isInCheck(this.playerColor) &&
                    this.game.kingPositions[this.playerColor].row === row &&
                    this.game.kingPositions[this.playerColor].col === col) {
                    square.classList.add('king-in-check');
                }
                
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
            indicator.textContent = this.isMyTurn ? '🔵 Tu turno' : '⏳ Turno del oponente';
        }
    }

    updateMoveHistory() {
        const movesList = document.getElementById('moves-list');
        movesList.innerHTML = '';
        
        for (let i = 0; i < this.game.moveHistory.length; i += 2) {
            const moveDiv = document.createElement('div');
            moveDiv.style.display = 'contents';
            
            const numSpan = document.createElement('span');
            numSpan.className = 'move-number';
            numSpan.textContent = (Math.floor(i / 2) + 1) + '.';
            moveDiv.appendChild(numSpan);
            
            const whiteSpan = document.createElement('span');
            whiteSpan.className = 'move-white';
            whiteSpan.textContent = this.game.moveHistory[i]?.notation || '...';
            moveDiv.appendChild(whiteSpan);
            
            const blackSpan = document.createElement('span');
            blackSpan.className = 'move-black';
            blackSpan.textContent = this.game.moveHistory[i + 1]?.notation || '';
            moveDiv.appendChild(blackSpan);
            
            movesList.appendChild(moveDiv);
        }
        
        const container = document.getElementById('move-history');
        container.scrollTop = container.scrollHeight;
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
            }
            
            this.updateTimerDisplay();
            
            // Sincronizar con Firebase cada 10 segundos
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
        const formatTime = (s) => {
            const mins = Math.floor(s / 60);
            const secs = s % 60;
            return mins + ':' + secs.toString().padStart(2, '0');
        };
        document.getElementById('player-timer').textContent = formatTime(this.playerTime);
        document.getElementById('opponent-timer').textContent = formatTime(this.opponentTime);
    }

    loseByTime() {
        if (this.game.gameOver) return;
        this.game.gameOver = true;
        this.game.gameResult = 'Pierdes por tiempo';
        database.ref(`games/${this.gameId}`).update({
            status: 'finished',
            winner: this.playerColor === 'white' ? 'black' : 'white',
            reason: 'time'
        });
        this.showGameResult(this.game.gameResult);
    }

    handleGameEnd(gameData) {
        this.game.gameOver = true;
        let result = '';
        if (gameData.winner === 'draw') {
            result = 'Tablas';
        } else if (gameData.winner === this.playerColor) {
            result = '¡Has ganado!';
        } else {
            result = 'Has perdido';
        }
        this.game.gameResult = result;
        this.showGameResult(result);
        
        if (!gameData.processed) {
            this.updatePlayerStats(gameData);
            database.ref(`games/${this.gameId}/processed`).set(true);
        }
    }

    handleGameDeleted() {
        this.showDialog('La partida ha sido eliminada', [
            { text: 'Aceptar', class: 'btn-primary', action: () => { this.closeDialog(); this.leaveGame(); } }
        ]);
    }
        updatePlayerStats(gameData) {
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
        this.updateTurnIndicator();
    }

    resign() {
        this.showDialog('¿Abandonar la partida?', [
            { text: 'Cancelar', class: 'btn-secondary', action: () => this.closeDialog() },
            { text: 'Abandonar', class: 'btn-primary', action: () => {
                database.ref(`games/${this.gameId}`).update({
                    status: 'finished',
                    winner: this.playerColor === 'white' ? 'black' : 'white',
                    reason: 'resignation'
                });
                this.closeDialog();
            } }
        ]);
    }

    offerDraw() {
        this.showDialog('¿Ofrecer tablas?', [
            { text: 'Cancelar', class: 'btn-secondary', action: () => this.closeDialog() },
            { text: 'Ofrecer', class: 'btn-primary', action: () => {
                database.ref(`games/${this.gameId}/drawOffer`).set(this.playerId);
                if (this.chat) this.chat.sendSystemMessage(this.playerName + ' ofrece tablas');
                this.closeDialog();
            } }
        ]);
    }

    handleDrawOffer(offerPlayerId) {
        this.showDialog(this.opponentName + ' ofrece tablas. ¿Aceptas?', [
            { text: 'Rechazar', class: 'btn-secondary', action: () => {
                database.ref(`games/${this.gameId}/drawOffer`).remove();
                this.closeDialog();
            } },
            { text: 'Aceptar', class: 'btn-primary', action: () => {
                database.ref(`games/${this.gameId}`).update({
                    status: 'finished',
                    winner: 'draw',
                    reason: 'mutual_agreement'
                });
                database.ref(`games/${this.gameId}/drawOffer`).remove();
                this.closeDialog();
            } }
        ]);
    }

    leaveGame() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.gameRef && this.gameListener) {
            this.gameRef.off('value', this.gameListener);
        }
        if (this.chat) this.chat.destroy();
        
        this.gameId = null;
        this.playerColor = null;
        this.isMyTurn = false;
        this.chat = null;
        this.game.reset();
        this.showLobby();
    }

    logout() {
        this.cancelSearch();
        if (this.gameId) this.leaveGame();
        localStorage.removeItem('chessPlayerId');
        localStorage.removeItem('chessPlayerName');
        this.playerId = null;
        this.playerName = null;
        this.showLogin();
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
                    this.savePlayerData();
                }
                
                database.ref('games').orderByChild(`players/${this.playerId}`).equalTo(true).once('value').then((snapshot) => {
                    const games = snapshot.val();
                    if (games) {
                        const [gameId, gameData] = Object.entries(games)[0];
                        if (gameData.status === 'active') {
                            this.joinGame(gameId, gameData);
                        } else {
                            this.showLobby();
                        }
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

window.addEventListener('DOMContentLoaded', () => {
    new MultiplayerChess();
});
