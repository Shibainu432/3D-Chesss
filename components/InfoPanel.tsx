import React from 'react';
import type { Piece, BoardState, Move } from '../types';
import { PIECE_VALUES, PIECE_SYMBOLS } from '../types';
import LayerCanvas from './LayerCanvas';

interface InfoPanelProps {
  turn: 'white' | 'black';
  capturedPieces: { white: Piece[]; black: Piece[] };
  boardState: BoardState;
  selectedPiece: Piece | null;
  validMoves: Move[];
  onSquareClick: (x: number, y: number, z: number) => void;
  onSquareHover: (coords: { x: number; y: number; z: number } | null) => void;
  onCustomModelLoad: (fileContent: string) => void;
  gameStatus: string;
  kingInCheck: 'white' | 'black' | null;
  onPlayWithFriendClick: () => void;
  gameId: string | null;
  playerColor: 'white' | 'black' | null;
}

const getPieceSymbol = (type: Piece['type'], color: Piece['color']) => {
  return PIECE_SYMBOLS[color][type] || type;
};

const InfoPanel: React.FC<InfoPanelProps> = ({ turn, capturedPieces, boardState, selectedPiece, validMoves, onSquareClick, onSquareHover, onCustomModelLoad, gameStatus, kingInCheck, onPlayWithFriendClick, gameId, playerColor }) => {

  const whiteMaterial = capturedPieces.black.reduce((sum, p) => sum + PIECE_VALUES[p.type], 0);
  const blackMaterial = capturedPieces.white.reduce((sum, p) => sum + PIECE_VALUES[p.type], 0);
  const materialAdvantage = whiteMaterial - blackMaterial;

  const sortPieces = (a: Piece, b: Piece) => PIECE_VALUES[b.type] - PIECE_VALUES[a.type];
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) onCustomModelLoad(text);
      };
      reader.onerror = () => alert("Error: Could not read the selected file.");
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  return (
    <div className="w-full h-full p-4 flex flex-col space-y-4 overflow-y-auto bg-gray-900 text-white">
      <h1 className="text-3xl font-extrabold text-pink-400 text-center mb-2">3D Volumetric Chess</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-800 p-3 rounded-lg shadow-xl border-t-4 border-gray-700">
          <div className="font-bold text-lg flex justify-between items-center">
            <span className="text-gray-300">Black Player</span>
            <span className="text-red-400 font-mono text-xl">+{blackMaterial}</span>
          </div>
          <div className="text-2xl text-gray-400 h-8 flex items-center space-x-1">
            {capturedPieces.white.sort(sortPieces).map((p, i) => 
              <span key={i} className="text-gray-400">{getPieceSymbol(p.type, 'black')}</span>
            )}
          </div>
        </div>

        <div className="text-center h-10 flex items-center justify-center">
            {materialAdvantage > 0 && <span className="text-3xl font-mono font-bold text-green-400">+{materialAdvantage}</span>}
            {materialAdvantage < 0 && <span className="text-3xl font-mono font-bold text-red-400">+{Math.abs(materialAdvantage)}</span>}
        </div>
        
        <div className="text-center p-3 rounded-lg bg-gray-800 shadow-lg">
          <p className="text-sm text-gray-400">
            {gameStatus === 'active' ? 'Current Turn:' : 'Game Over'}
          </p>
          <h2 className={`text-2xl font-bold ${gameStatus !== 'active' ? 'text-yellow-400' : ''}`}>
            {gameStatus === 'active' ? turn.toUpperCase() : gameStatus}
          </h2>
          {kingInCheck === turn && gameStatus === 'active' && (
            <p className="text-sm text-red-500 font-bold animate-pulse mt-1">CHECK!</p>
          )}
        </div>
        
        <div className="bg-gray-800 p-3 rounded-lg shadow-xl border-b-4 border-gray-700">
          <div className="font-bold text-lg flex justify-between items-center">
            <span className="text-white">White Player</span>
            <span className="text-red-400 font-mono text-xl">+{whiteMaterial}</span>
          </div>
          <div className="text-2xl text-gray-400 h-8 flex items-center space-x-1">
             {capturedPieces.black.sort(sortPieces).map((p, i) => 
              <span key={i} className="text-white">{getPieceSymbol(p.type, 'white')}</span>
            )}
          </div>
        </div>
      </div>
      
      {gameId && playerColor && (
        <div className="text-center p-2 rounded-lg bg-gray-800 shadow-inner">
          <p className="text-xs text-gray-400">Online Game Code: <span className="font-mono text-yellow-300">{gameId}</span></p>
          <p className="text-xs text-gray-400">You are playing as: <span className="font-bold">{playerColor.toUpperCase()}</span></p>
        </div>
      )}

      <h2 className="text-lg font-bold text-center text-gray-300 mt-4 mb-2">Volumetric Layers (Click to Play)</h2>
      <div className="grid grid-cols-2 gap-3 p-1">
        {Array.from({ length: 8 }).map((_, z) => (
          <LayerCanvas key={z} zLayer={z} boardState={boardState} selectedPiece={selectedPiece} validMoves={validMoves} onSquareClick={onSquareClick} onSquareHover={onSquareHover} />
        ))}
      </div>
      
      <div className="mt-auto pt-4 space-y-2">
        <button 
            onClick={onPlayWithFriendClick}
            disabled={!!gameId}
            className="block w-full text-center px-4 py-2 bg-green-500 text-white font-bold rounded-lg cursor-pointer hover:bg-green-600 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Play with a Friend
        </button>
        <label className={`block w-full text-center px-4 py-2 bg-pink-500 text-white font-bold rounded-lg transition-colors duration-200 ${gameId ? 'bg-gray-600 cursor-not-allowed' : 'cursor-pointer hover:bg-pink-600'}`}>
          Load Custom 3D Model (.obj)
          <input type="file" className="hidden" accept=".obj" onChange={handleFileChange} disabled={!!gameId} />
        </label>
        <div className="text-center text-xs text-gray-500">
          <p>Use 2D boards to select pieces and make moves.</p>
          <p>Use mouse on 3D board to rotate/zoom for visualization.</p>
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;