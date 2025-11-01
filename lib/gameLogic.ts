
import { SIZE } from '../types';
import type { Piece, BoardState, Move } from '../types';

export function initializeBoardState(): BoardState {
    const state: BoardState = Array(SIZE).fill(0).map(() => 
        Array(SIZE).fill(0).map(() => 
            Array(SIZE).fill(null)
        )
    );

    const MAJOR_PIECE_PATTERN = [
        "rnbrrbnr",
        "nnbnnbnn",
        "bbbqqbbb",
        "rnqqkqnr",
        "rnqqqqnr",
        "bbbqqbbb",
        "nnbnnbnn",
        "rnbrrbnr"
    ];
    
    const PAWN_ROW = "pppppppp"; 

    for (let z = 0; z < SIZE; z++) {
        const isWhite = z < 2;
        let layerPattern: string[] | null = null;

        if (z === 0) layerPattern = MAJOR_PIECE_PATTERN;
        else if (z === 1) layerPattern = Array(SIZE).fill(PAWN_ROW);
        else if (z === 6) layerPattern = Array(SIZE).fill(PAWN_ROW);
        else if (z === 7) layerPattern = MAJOR_PIECE_PATTERN;
        
        if (layerPattern) {
            for (let y = 0; y < SIZE; y++) {
                const rowString = layerPattern[y];
                for (let x = 0; x < SIZE; x++) {
                    const char = rowString[x];
                    if (char !== ' ') { 
                        const pieceKey = char.toUpperCase() as Piece['type'];
                        state[x][y][z] = {
                            type: pieceKey, 
                            color: isWhite ? 'white' : 'black',
                            x, y, z,
                            hasMoved: false
                        };
                    }
                }
            }
        }
    }
    return state;
}

function isWithinBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE && z >= 0 && z < SIZE;
}

function isSquareAttacked(x: number, y: number, z: number, attackerColor: 'white' | 'black', boardState: BoardState): boolean {
    const opponentColor = attackerColor === 'white' ? 'black' : 'white';
    
    // Check for pawn attacks
    const zDir = attackerColor === 'white' ? 1 : -1;
    const pawnCaptureDirections = [];
    for (const dx of [-1, 0, 1]) {
        for (const dy of [-1, 0, 1]) {
            if (dx === 0 && dy === 0) continue;
            pawnCaptureDirections.push([dx, dy]);
        }
    }
    for (const [dx, dy] of pawnCaptureDirections) {
        const checkX = x - dx;
        const checkY = y - dy;
        const checkZ = z - zDir;
        if (isWithinBounds(checkX, checkY, checkZ)) {
            const piece = boardState[checkX][checkY][checkZ];
            if (piece && piece.type === 'P' && piece.color === attackerColor) {
                return true;
            }
        }
    }
    
    // Check for Knight attacks
    const knightMoves = [
        [2, 1, 0], [2, -1, 0], [-2, 1, 0], [-2, -1, 0],
        [1, 2, 0], [1, -2, 0], [-1, 2, 0], [-1, -2, 0],
        [2, 0, 1], [2, 0, -1], [-2, 0, 1], [-2, 0, -1],
        [1, 0, 2], [1, 0, -2], [-1, 0, 2], [-1, 0, -2],
        [0, 2, 1], [0, 2, -1], [0, -2, 1], [0, -2, -1],
        [0, 1, 2], [0, 1, -2], [0, -1, 2], [0, -1, -2]
    ];
    for (const [dx, dy, dz] of knightMoves) {
        const checkX = x - dx, checkY = y - dy, checkZ = z - dz;
        if (isWithinBounds(checkX, checkY, checkZ)) {
            const piece = boardState[checkX][checkY][checkZ];
            if (piece && piece.type === 'N' && piece.color === attackerColor) {
                return true;
            }
        }
    }

    // Check for Rook, Bishop, Queen, King attacks (ray casting)
    const all3DDirections: number[][] = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dy === 0 && dz === 0) continue;
                all3DDirections.push([dx, dy, dz]);
            }
        }
    }
    
    for (const [dx, dy, dz] of all3DDirections) {
        for (let k = 1; k < SIZE; k++) {
            const checkX = x + dx * k, checkY = y + dy * k, checkZ = z + dz * k;
            if (!isWithinBounds(checkX, checkY, checkZ)) break;

            const piece = boardState[checkX][checkY][checkZ];
            if (piece) {
                if (piece.color === attackerColor) {
                    const isOrthogonal = (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) === 1;
                    const isDiagonal = (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) > 1;

                    if (piece.type === 'Q') return true;
                    if (piece.type === 'R' && isOrthogonal) return true;
                    if (piece.type === 'B' && isDiagonal) return true;
                    if (piece.type === 'K' && k === 1) return true;
                }
                break; 
            }
        }
    }

    return false;
}

function findKing(kingColor: 'white' | 'black', boardState: BoardState): Piece | null {
    for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < SIZE; y++) {
            for (let z = 0; z < SIZE; z++) {
                const piece = boardState[x][y][z];
                if (piece && piece.type === 'K' && piece.color === kingColor) {
                    return piece;
                }
            }
        }
    }
    return null;
}

export function isKingInCheck(kingColor: 'white' | 'black', boardState: BoardState): boolean {
    const king = findKing(kingColor, boardState);
    if (!king) return false;
    const opponentColor = kingColor === 'white' ? 'black' : 'white';
    return isSquareAttacked(king.x, king.y, king.z, opponentColor, boardState);
}

function calculateValidMoves(piece: Piece, boardState: BoardState): Move[] {
    const { x: startX, y: startY, z: startZ, type, color } = piece;
    const moves: Move[] = [];

    if (type === 'P') {
        const zDir = color === 'white' ? 1 : -1; 
        const moveZ = startZ + zDir;
        if (isWithinBounds(startX, startY, moveZ) && !boardState[startX][startY][moveZ]) {
            moves.push({ x: startX, y: startY, z: moveZ, capture: false });
            const startLayer = (color === 'white') ? 1 : 6;
            if (startZ === startLayer) {
                const doubleMoveZ = startZ + zDir * 2;
                if (isWithinBounds(startX, startY, doubleMoveZ) && !boardState[startX][startY][doubleMoveZ] && !boardState[startX][startY][moveZ]) {
                    moves.push({ x: startX, y: startY, z: doubleMoveZ, capture: false });
                }
            }
        }
        const threeDDirections = [];
        for (const dx of [-1, 0, 1]) {
            for (const dy of [-1, 0, 1]) {
                if (dx === 0 && dy === 0) continue; 
                threeDDirections.push([dx, dy, zDir]);
            }
        }

        for (const [dx, dy, dz] of threeDDirections) {
            const tx = startX + dx;
            const ty = startY + dy;
            const tz = startZ + dz;
            if (isWithinBounds(tx, ty, tz)) {
                const targetPiece = boardState[tx][ty][tz];
                if (targetPiece && targetPiece.color !== color) {
                    moves.push({ x: tx, y: ty, z: tz, capture: true });
                }
            }
        }
    } else if (type === 'N') {
        const permutations = [
            [2, 1, 0], [2, -1, 0], [-2, 1, 0], [-2, -1, 0],
            [1, 2, 0], [1, -2, 0], [-1, 2, 0], [-1, -2, 0],
            [2, 0, 1], [2, 0, -1], [-2, 0, 1], [-2, 0, -1],
            [1, 0, 2], [1, 0, -2], [-1, 0, 2], [-1, 0, -2],
            [0, 2, 1], [0, 2, -1], [0, -2, 1], [0, -2, -1],
            [0, 1, 2], [0, 1, -2], [0, -1, 2], [0, -1, -2]
        ];

        for (const [dx, dy, dz] of permutations) {
            const tx = startX + dx, ty = startY + dy, tz = startZ + dz;
            if (isWithinBounds(tx, ty, tz)) {
                const targetPiece = boardState[tx][ty][tz];
                if (!targetPiece || targetPiece.color !== color) {
                    moves.push({ x: tx, y: ty, z: tz, capture: !!targetPiece });
                }
            }
        }
    } else {
        const all3DDirections: number[][] = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    if (dx === 0 && dy === 0 && dz === 0) continue; 
                    all3DDirections.push([dx, dy, dz]);
                }
            }
        }

        let rayDirections: number[][] = [];
        if (type === 'R' || type === 'Q' || type === 'K') {
            rayDirections.push(...all3DDirections.filter(([dx, dy, dz]) => (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) === 1));
        }
        if (type === 'B' || type === 'Q' || type === 'K') {
            rayDirections.push(...all3DDirections.filter(([dx, dy, dz]) => (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) > 1));
        }

        const uniqueDirections = new Set(rayDirections.map(d => d.join(',')));
        rayDirections = Array.from(uniqueDirections).map(s => s.split(',').map(Number));

        const maxDistance = (type === 'K') ? 1 : SIZE; 

        for (const [dx, dy, dz] of rayDirections) {
            for (let k = 1; k <= maxDistance; k++) {
                const tx = startX + dx * k, ty = startY + dy * k, tz = startZ + dz * k;
                if (!isWithinBounds(tx, ty, tz)) break; 
                const targetPiece = boardState[tx][ty][tz];
                if (targetPiece) {
                    if (targetPiece.color !== color) {
                        moves.push({ x: tx, y: ty, z: tz, capture: true }); 
                    }
                    break; 
                } else {
                    moves.push({ x: tx, y: ty, z: tz, capture: false }); 
                }
            }
        }

        if (type === 'K' && !piece.hasMoved && !isKingInCheck(color, boardState)) {
            const opponentColor = color === 'white' ? 'black' : 'white';
            const kingY = color === 'white' ? 3 : 3; 
            const kingZ = color === 'white' ? 0 : 7;
            
            if (startY === kingY && startZ === kingZ) {
                // Kingside castle
                const kingsideRook = boardState[7][startY][startZ];
                if (kingsideRook && kingsideRook.type === 'R' && !kingsideRook.hasMoved && kingsideRook.color === color) {
                    if (boardState[5][startY][startZ] === null && boardState[6][startY][startZ] === null) {
                        if (!isSquareAttacked(5, startY, startZ, opponentColor, boardState) && !isSquareAttacked(6, startY, startZ, opponentColor, boardState)) {
                            moves.push({ x: startX + 2, y: startY, z: startZ, capture: false, castle: 'king' });
                        }
                    }
                }
                
                // Queenside castle
                const queensideRook = boardState[0][startY][startZ];
                if (queensideRook && queensideRook.type === 'R' && !queensideRook.hasMoved && queensideRook.color === color) {
                    if (boardState[1][startY][startZ] === null && boardState[2][startY][startZ] === null && boardState[3][startY][startZ] === null) {
                        if (!isSquareAttacked(2, startY, startZ, opponentColor, boardState) && !isSquareAttacked(3, startY, startZ, opponentColor, boardState)) {
                             moves.push({ x: startX - 2, y: startY, z: startZ, capture: false, castle: 'queen' });
                        }
                    }
                }
            }
        }
    }
    return moves;
}

function applyMove(board: BoardState, piece: Piece, move: Move): BoardState {
    const newBoard = JSON.parse(JSON.stringify(board));
    const { x: oldX, y: oldY, z: oldZ } = piece;
    const { x: newX, y: newY, z: newZ } = move;

    newBoard[oldX][oldY][oldZ] = null;
    const movedPiece = { ...piece, x: newX, y: newY, z: newZ, hasMoved: true };
    newBoard[newX][newY][newZ] = movedPiece;

    if (move.castle) {
        if (move.castle === 'king') {
            const rook = newBoard[7][newY][newZ];
            if (rook) {
                newBoard[7][newY][newZ] = null;
                rook.x = newX - 1;
                rook.hasMoved = true;
                newBoard[newX - 1][newY][newZ] = rook;
            }
        } else { // Queenside
            const rook = newBoard[0][newY][newZ];
            if (rook) {
                newBoard[0][newY][newZ] = null;
                rook.x = newX + 1;
                rook.hasMoved = true;
                newBoard[newX + 1][newY][newZ] = rook;
            }
        }
    }
    return newBoard;
}

export function calculateLegalMoves(piece: Piece, boardState: BoardState): Move[] {
    const pseudoLegalMoves = calculateValidMoves(piece, boardState);
    
    return pseudoLegalMoves.filter(move => {
        const tempBoard = applyMove(boardState, piece, move);
        return !isKingInCheck(piece.color, tempBoard);
    });
}

function hasAnyLegalMoves(color: 'white' | 'black', boardState: BoardState): boolean {
    for (let z = 0; z < SIZE; z++) {
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                const piece = boardState[x][y][z];
                if (piece && piece.color === color) {
                    if (calculateLegalMoves(piece, boardState).length > 0) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

export function isCheckmate(color: 'white' | 'black', boardState: BoardState): boolean {
    if (!isKingInCheck(color, boardState)) {
        return false;
    }
    return !hasAnyLegalMoves(color, boardState);
}

export function isStalemate(color: 'white' | 'black', boardState: BoardState): boolean {
    if (isKingInCheck(color, boardState)) {
        return false;
    }
    return !hasAnyLegalMoves(color, boardState);
}
