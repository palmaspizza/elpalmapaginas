class ChessGame {
    constructor() {
        this.board = this.createInitialBoard();
        this.currentTurn = 'white';
        this.selectedPiece = null;
        this.validMoves = [];
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameOver = false;
        this.gameResult = null;
        this.enPassantTarget = null;
        this.castlingRights = {
            white: { kingSide: true, queenSide: true },
            black: { kingSide: true, queenSide: true }
        };
        this.lastMove = null;
        this.kingPositions = {
            white: { row: 7, col: 4 },
            black: { row: 0, col: 4 }
        };
    }

    createInitialBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Piezas negras
        board[0][0] = { type: 'rook', color: 'black' };
        board[0][1] = { type: 'knight', color: 'black' };
        board[0][2] = { type: 'bishop', color: 'black' };
        board[0][3] = { type: 'queen', color: 'black' };
        board[0][4] = { type: 'king', color: 'black' };
        board[0][5] = { type: 'bishop', color: 'black' };
        board[0][6] = { type: 'knight', color: 'black' };
        board[0][7] = { type: 'rook', color: 'black' };
        
        for (let i = 0; i < 8; i++) {
            board[1][i] = { type: 'pawn', color: 'black' };
        }
        
        // Piezas blancas
        for (let i = 0; i < 8; i++) {
            board[6][i] = { type: 'pawn', color: 'white' };
        }
        
        board[7][0] = { type: 'rook', color: 'white' };
        board[7][1] = { type: 'knight', color: 'white' };
        board[7][2] = { type: 'bishop', color: 'white' };
        board[7][3] = { type: 'queen', color: 'white' };
        board[7][4] = { type: 'king', color: 'white' };
        board[7][5] = { type: 'bishop', color: 'white' };
        board[7][6] = { type: 'knight', color: 'white' };
        board[7][7] = { type: 'rook', color: 'white' };
        
        return board;
    }

    getPieceMoves(row, col, piece) {
        const moves = [];
        
        switch (piece.type) {
            case 'pawn':
                this.getPawnMoves(row, col, piece, moves);
                break;
            case 'rook':
                this.getSlidingMoves(row, col, piece, [[0,1],[0,-1],[1,0],[-1,0]], moves);
                break;
            case 'knight':
                this.getKnightMoves(row, col, piece, moves);
                break;
            case 'bishop':
                this.getSlidingMoves(row, col, piece, [[1,1],[1,-1],[-1,1],[-1,-1]], moves);
                break;
            case 'queen':
                this.getSlidingMoves(row, col, piece, [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]], moves);
                break;
            case 'king':
                this.getKingMoves(row, col, piece, moves);
                break;
        }
        
        // Filtrar movimientos que dejan al rey en jaque
        return moves.filter(move => !this.wouldBeInCheck(row, col, move.row, move.col, piece.color));
    }

    getPawnMoves(row, col, piece, moves) {
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;
        
        // Avance simple
        if (this.isValidPosition(row + direction, col) && !this.board[row + direction][col]) {
            moves.push({ row: row + direction, col: col });
            
            // Avance doble desde la posición inicial
            if (row === startRow && !this.board[row + 2 * direction][col]) {
                moves.push({ row: row + 2 * direction, col: col });
            }
        }
        
        // Capturas
        for (const dc of [-1, 1]) {
            if (this.isValidPosition(row + direction, col + dc)) {
                const target = this.board[row + direction][col + dc];
                if (target && target.color !== piece.color) {
                    moves.push({ row: row + direction, col: col + dc });
                }
                // Captura al paso
                if (this.enPassantTarget && 
                    this.enPassantTarget.row === row + direction && 
                    this.enPassantTarget.col === col + dc) {
                    moves.push({ row: row + direction, col: col + dc, enPassant: true });
                }
            }
        }
    }

    getSlidingMoves(row, col, piece, directions, moves) {
        for (const [dr, dc] of directions) {
            let r = row + dr;
            let c = col + dc;
            
            while (this.isValidPosition(r, c)) {
                const target = this.board[r][c];
                if (!target) {
                    moves.push({ row: r, col: c });
                } else {
                    if (target.color !== piece.color) {
                        moves.push({ row: r, col: c });
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }
    }

    getKnightMoves(row, col, piece, moves) {
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        
        for (const [dr, dc] of knightMoves) {
            const r = row + dr;
            const c = col + dc;
            if (this.isValidPosition(r, c)) {
                const target = this.board[r][c];
                if (!target || target.color !== piece.color) {
                    moves.push({ row: r, col: c });
                }
            }
        }
    }

    getKingMoves(row, col, piece, moves) {
        const kingMoves = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];
        
        for (const [dr, dc] of kingMoves) {
            const r = row + dr;
            const c = col + dc;
            if (this.isValidPosition(r, c)) {
                const target = this.board[r][c];
                if (!target || target.color !== piece.color) {
                    if (!this.isSquareAttacked(r, c, piece.color)) {
                        moves.push({ row: r, col: c });
                    }
                }
            }
        }
        
        // Enroque
        if (piece.color === 'white') {
            if (this.castlingRights.white.kingSide && 
                !this.board[7][5] && !this.board[7][6] &&
                !this.isSquareAttacked(7, 4, 'white') &&
                !this.isSquareAttacked(7, 5, 'white') &&
                !this.isSquareAttacked(7, 6, 'white')) {
                moves.push({ row: 7, col: 6, castling: 'kingside' });
            }
            if (this.castlingRights.white.queenSide && 
                !this.board[7][3] && !this.board[7][2] && !this.board[7][1] &&
                !this.isSquareAttacked(7, 4, 'white') &&
                !this.isSquareAttacked(7, 3, 'white') &&
                !this.isSquareAttacked(7, 2, 'white')) {
                moves.push({ row: 7, col: 2, castling: 'queenside' });
            }
        } else {
            if (this.castlingRights.black.kingSide && 
                !this.board[0][5] && !this.board[0][6] &&
                !this.isSquareAttacked(0, 4, 'black') &&
                !this.isSquareAttacked(0, 5, 'black') &&
                !this.isSquareAttacked(0, 6, 'black')) {
                moves.push({ row: 0, col: 6, castling: 'kingside' });
            }
            if (this.castlingRights.black.queenSide && 
                !this.board[0][3] && !this.board[0][2] && !this.board[0][1] &&
                !this.isSquareAttacked(0, 4, 'black') &&
                !this.isSquareAttacked(0, 3, 'black') &&
                !this.isSquareAttacked(0, 2, 'black')) {
                moves.push({ row: 0, col: 2, castling: 'queenside' });
            }
        }
    }

    isSquareAttacked(row, col, defendingColor) {
        const opponentColor = defendingColor === 'white' ? 'black' : 'white';
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === opponentColor) {
                    const moves = this.getRawMoves(r, c, piece);
                    if (moves.some(m => m.row === row && m.col === col)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    getRawMoves(row, col, piece) {
        const moves = [];
        
        switch (piece.type) {
            case 'pawn':
                const direction = piece.color === 'white' ? -1 : 1;
                for (const dc of [-1, 1]) {
                    if (this.isValidPosition(row + direction, col + dc)) {
                        moves.push({ row: row + direction, col: col + dc });
                    }
                }
                break;
            case 'rook':
                this.getRawSlidingMoves(row, col, [[0,1],[0,-1],[1,0],[-1,0]], moves);
                break;
            case 'knight':
                const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
                for (const [dr, dc] of knightMoves) {
                    if (this.isValidPosition(row + dr, col + dc)) {
                        moves.push({ row: row + dr, col: col + dc });
                    }
                }
                break;
            case 'bishop':
                this.getRawSlidingMoves(row, col, [[1,1],[1,-1],[-1,1],[-1,-1]], moves);
                break;
            case 'queen':
                this.getRawSlidingMoves(row, col, [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]], moves);
                break;
            case 'king':
                const kingMoves = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
                for (const [dr, dc] of kingMoves) {
                    if (this.isValidPosition(row + dr, col + dc)) {
                        moves.push({ row: row + dr, col: col + dc });
                    }
                }
                break;
        }
        return moves;
    }

    getRawSlidingMoves(row, col, directions, moves) {
        for (const [dr, dc] of directions) {
            let r = row + dr;
            let c = col + dc;
            while (this.isValidPosition(r, c)) {
                moves.push({ row: r, col: c });
                if (this.board[r][c]) break;
                r += dr;
                c += dc;
            }
        }
    }

    wouldBeInCheck(fromRow, fromCol, toRow, toCol, color) {
        // Simular el movimiento
        const tempBoard = this.board.map(row => [...row]);
        tempBoard[toRow][toCol] = tempBoard[fromRow][fromCol];
        tempBoard[fromRow][fromCol] = null;
        
        // Encontrar la posición del rey
        let kingRow, kingCol;
        if (tempBoard[toRow][toCol].type === 'king') {
            kingRow = toRow;
            kingCol = toCol;
        } else {
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (tempBoard[r][c] && tempBoard[r][c].type === 'king' && tempBoard[r][c].color === color) {
                        kingRow = r;
                        kingCol = c;
                    }
                }
            }
        }
        
        // Verificar si el rey está bajo ataque
        const opponentColor = color === 'white' ? 'black' : 'white';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = tempBoard[r][c];
                if (piece && piece.color === opponentColor) {
                    const moves = this.getRawMovesOnBoard(r, c, piece, tempBoard);
                    if (moves.some(m => m.row === kingRow && m.col === kingCol)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    getRawMovesOnBoard(row, col, piece, board) {
        const moves = [];
        
        switch (piece.type) {
            case 'pawn':
                const direction = piece.color === 'white' ? -1 : 1;
                for (const dc of [-1, 1]) {
                    if (row + direction >= 0 && row + direction < 8 && col + dc >= 0 && col + dc < 8) {
                        moves.push({ row: row + direction, col: col + dc });
                    }
                }
                break;
            case 'rook':
                this.getRawSlidingMovesOnBoard(row, col, [[0,1],[0,-1],[1,0],[-1,0]], moves, board);
                break;
            case 'knight':
                const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
                for (const [dr, dc] of knightMoves) {
                    if (row + dr >= 0 && row + dr < 8 && col + dc >= 0 && col + dc < 8) {
                        moves.push({ row: row + dr, col: col + dc });
                    }
                }
                break;
            case 'bishop':
                this.getRawSlidingMovesOnBoard(row, col, [[1,1],[1,-1],[-1,1],[-1,-1]], moves, board);
                break;
            case 'queen':
                this.getRawSlidingMovesOnBoard(row, col, [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]], moves, board);
                break;
            case 'king':
                const kingMoves = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
                for (const [dr, dc] of kingMoves) {
                    if (row + dr >= 0 && row + dr < 8 && col + dc >= 0 && col + dc < 8) {
                        moves.push({ row: row + dr, col: col + dc });
                    }
                }
                break;
        }
        return moves;
    }

    getRawSlidingMovesOnBoard(row, col, directions, moves, board) {
        for (const [dr, dc] of directions) {
            let r = row + dr;
            let c = col + dc;
            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                moves.push({ row: r, col: c });
                if (board[r][c]) break;
                r += dr;
                c += dc;
            }
        }
    }

    isValidPosition(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;
        
        const move = this.validMoves.find(m => m.row === toRow && m.col === toCol);
        if (!move) return false;
        
        // Guardar información para notación algebraica
        const capturedPiece = this.board[toRow][toCol];
        const isEnPassant = move.enPassant;
        const isCastling = move.castling;
        
        // Realizar el movimiento
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // Manejar captura al paso
        if (isEnPassant) {
            const capturedRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
            this.capturedPieces[piece.color].push(this.board[capturedRow][toCol]);
            this.board[capturedRow][toCol] = null;
        } else if (capturedPiece) {
            this.capturedPieces[piece.color].push(capturedPiece);
        }
        
        // Manejar enroque
        if (isCastling) {
            if (isCastling === 'kingside') {
                this.board[toRow][5] = this.board[toRow][7];
                this.board[toRow][7] = null;
            } else {
                this.board[toRow][3] = this.board[toRow][0];
                this.board[toRow][0] = null;
            }
        }
        
        // Actualizar enroque
        if (piece.type === 'king') {
            this.castlingRights[piece.color].kingSide = false;
            this.castlingRights[piece.color].queenSide = false;
            this.kingPositions[piece.color] = { row: toRow, col: toCol };
        }
        if (piece.type === 'rook') {
            if (fromCol === 0) this.castlingRights[piece.color].queenSide = false;
            if (fromCol === 7) this.castlingRights[piece.color].kingSide = false;
        }
        
        // Establecer en passant
        this.enPassantTarget = null;
        if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
            this.enPassantTarget = { 
                row: (fromRow + toRow) / 2, 
                col: fromCol 
            };
        }
        
        // Registrar movimiento en notación algebraica
        const algebraicNotation = this.getAlgebraicNotation(
            piece, fromRow, fromCol, toRow, toCol, 
            capturedPiece || (isEnPassant ? { type: 'pawn' } : null),
            isEnPassant, isCastling
        );
        
        this.moveHistory.push({
            piece: piece,
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            captured: capturedPiece || (isEnPassant ? { type: 'pawn', color: piece.color === 'white' ? 'black' : 'white' } : null),
            notation: algebraicNotation,
            enPassant: isEnPassant,
            castling: isCastling
        });
        
        this.lastMove = { fromRow, fromCol, toRow, toCol };
        
        // Cambiar turno
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
        
        // Verificar jaque mate y tablas
        this.checkGameStatus();
        
        return true;
    }

    getAlgebraicNotation(piece, fromRow, fromCol, toRow, toCol, captured, isEnPassant, isCastling) {
        const cols = 'abcdefgh';
        const rows = '87654321';
        
        if (isCastling === 'kingside') return 'O-O';
        if (isCastling === 'queenside') return 'O-O-O';
        
        let notation = '';
        
        if (piece.type === 'pawn') {
            if (captured || isEnPassant) {
                notation = cols[fromCol] + 'x';
            }
            notation += cols[toCol] + rows[toRow];
            
            // Promoción (para futura implementación)
            if (toRow === 0 || toRow === 7) {
                notation += '=Q'; // Promoción a reina por defecto
            }
        } else {
            const pieceLetter = { king: 'R', queen: 'D', rook: 'T', bishop: 'A', knight: 'C' }[piece.type];
            notation = pieceLetter;
            
            // Desambiguación (simplificada)
            const otherPieces = this.findOtherPieces(piece.type, piece.color, toRow, toCol);
            if (otherPieces.length > 0) {
                for (const other of otherPieces) {
                    if (this.isLegalMove(other.row, other.col, toRow, toCol)) {
                        if (other.col !== fromCol) {
                            notation += cols[fromCol];
                        } else if (other.row !== fromRow) {
                            notation += rows[fromRow];
                        }
                        break;
                    }
                }
            }
            
            if (captured) notation += 'x';
            notation += cols[toCol] + rows[toRow];
        }
        
        // Verificar jaque o mate
        const opponentColor = this.currentTurn === 'white' ? 'black' : 'white';
        if (this.isInCheck(opponentColor)) {
            notation += this.isCheckmate(opponentColor) ? '#' : '+';
        }
        
        return notation;
    }

    findOtherPieces(type, color, excludeRow, excludeCol) {
        const pieces = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.type === type && p.color === color && 
                    !(r === excludeRow && c === excludeCol)) {
                    pieces.push({ row: r, col: c });
                }
            }
        }
        return pieces;
    }

    isLegalMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;
        const moves = this.getRawMoves(fromRow, fromCol, piece);
        return moves.some(m => m.row === toRow && m.col === toCol);
    }

    isInCheck(color) {
        const kingPos = this.kingPositions[color];
        return this.isSquareAttacked(kingPos.row, kingPos.col, color);
    }

    isCheckmate(color) {
        if (!this.isInCheck(color)) return false;
        
        // Verificar si hay algún movimiento legal
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === color) {
                    const moves = this.getPieceMoves(r, c, piece);
                    if (moves.length > 0) return false;
                }
            }
        }
        return true;
    }

    isStalemate(color) {
        if (this.isInCheck(color)) return false;
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === color) {
                    const moves = this.getPieceMoves(r, c, piece);
                    if (moves.length > 0) return false;
                }
            }
        }
        return true;
    }

    isInsufficientMaterial() {
        const pieces = { white: [], black: [] };
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece) {
                    pieces[piece.color].push(piece);
                }
            }
        }
        
        // Solo reyes
        if (pieces.white.length === 1 && pieces.black.length === 1) return true;
        
        // Rey y caballo/alfil contra rey
        for (const color of ['white', 'black']) {
            const otherColor = color === 'white' ? 'black' : 'white';
            if (pieces[color].length === 1 && pieces[otherColor].length === 2) {
                const otherPieces = pieces[otherColor].filter(p => p.type !== 'king');
                if (otherPieces.length === 1 && 
                    (otherPieces[0].type === 'knight' || otherPieces[0].type === 'bishop')) {
                    return true;
                }
            }
        }
        
        return false;
    }

    checkGameStatus() {
        const opponentColor = this.currentTurn;
        const playerColor = opponentColor === 'white' ? 'black' : 'white';
        
        if (this.isCheckmate(opponentColor)) {
            this.gameOver = true;
            this.gameResult = `${playerColor} gana por jaque mate`;
            return;
        }
        
        if (this.isStalemate(opponentColor)) {
            this.gameOver = true;
            this.gameResult = 'Tablas por ahogado';
            return;
        }
        
        if (this.isInsufficientMaterial()) {
            this.gameOver = true;
            this.gameResult = 'Tablas por material insuficiente';
            return;
        }
        
        // Regla de 50 movimientos
        // Simplificada: solo verificamos si no hay peones y pocas piezas
        let hasPawns = false;
        let pieceCount = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c]) {
                    pieceCount++;
                    if (this.board[r][c].type === 'pawn') hasPawns = true;
                }
            }
        }
        
        if (!hasPawns && pieceCount <= 4 && this.moveHistory.length >= 50) {
            // Simplificación: podrías implementar el contador real de 50 movimientos
            this.gameOver = true;
            this.gameResult = 'Tablas por regla de 50 movimientos';
        }
    }

    reset() {
        this.board = this.createInitialBoard();
        this.currentTurn = 'white';
        this.selectedPiece = null;
        this.validMoves = [];
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameOver = false;
        this.gameResult = null;
        this.enPassantTarget = null;
        this.castlingRights = {
            white: { kingSide: true, queenSide: true },
            black: { kingSide: true, queenSide: true }
        };
        this.lastMove = null;
        this.kingPositions = {
            white: { row: 7, col: 4 },
            black: { row: 0, col: 4 }
        };
    }
}

// Exportar para usar en otros archivos
window.ChessGame = ChessGame;