import React from 'react';
import type { Piece } from '../types';
import { PIECE_SYMBOLS } from '../types';

interface PromotionModalProps {
  color: 'white' | 'black';
  onPromote: (pieceType: Piece['type']) => void;
}

const PromotionModal: React.FC<PromotionModalProps> = ({ color, onPromote }) => {
  const promotionPieces: Piece['type'][] = ['Q', 'R', 'B', 'N'];

  return (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl flex flex-col items-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Promote Pawn</h2>
        <div className="flex space-x-4">
          {promotionPieces.map((pieceType) => (
            <button
              key={pieceType}
              onClick={() => onPromote(pieceType)}
              className="w-20 h-20 bg-gray-700 rounded-md flex items-center justify-center text-6xl hover:bg-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-opacity-75 transition-colors"
              aria-label={`Promote to ${pieceType}`}
            >
              <span style={{ color: color === 'white' ? '#f3f4f6' : '#9ca3af' }}>
                {PIECE_SYMBOLS[color][pieceType]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PromotionModal;
