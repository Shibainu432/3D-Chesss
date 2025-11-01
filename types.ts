
export interface Piece {
  type: 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
  color: 'white' | 'black';
  x: number;
  y: number;
  z: number;
  hasMoved: boolean;
}

export type BoardState = (Piece | null)[][][];

export interface Move {
  x: number;
  y: number;
  z: number;
  capture: boolean;
  castle?: 'king' | 'queen';
}

export const SIZE = 8;
export const CELL_SIZE = 7;
export const BOARD_BOUNDS = SIZE * CELL_SIZE;
export const CENTER_OFFSET = BOARD_BOUNDS / 2 - (CELL_SIZE / 2);

export const PIECE_VALUES: { [key in Piece['type']]: number } = { 'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0 };

export const PIECE_SYMBOLS: { [color: string]: { [type: string]: string } } = {
    white: { 'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙' },
    black: { 'K': '♚', 'Q': '♛', 'R': '♜', 'B': '♝', 'N': '♞', 'P': '♟' }
};

export const BOARD_SIZE_2D = 8;
export const CELL_SIZE_2D = 30;