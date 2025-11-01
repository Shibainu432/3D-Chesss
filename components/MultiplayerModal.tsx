import React, { useState } from 'react';
import { initializeBoardState } from '../lib/gameLogic';
import { createGameInDb, joinGameInDb } from '../lib/firebase';
import type { GameState } from '../lib/firebase';

interface MultiplayerModalProps {
  onGameStart: (details: { gameId: string, playerColor: 'white' | 'black' }) => void;
  onClose: () => void;
}

const MultiplayerModal: React.FC<MultiplayerModalProps> = ({ onGameStart, onClose }) => {
  const [view, setView] = useState<'initial' | 'create' | 'join'>('initial');
  const [gameCode, setGameCode] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [copyButtonText, setCopyButtonText] = useState('Copy Code');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateGameCode = async (): Promise<string> => {
    const randomValue = window.crypto.getRandomValues(new Uint32Array(1))[0];
    const encoder = new TextEncoder();
    const data = encoder.encode(randomValue.toString());
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8).toUpperCase();
  };

  const handleCreateGame = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const code = await generateGameCode();
      const initialState: GameState = {
        boardState: initializeBoardState(),
        turn: 'white',
        capturedPieces: { white: [], black: [] },
        gameStatus: 'active',
        kingInCheck: null,
        playerCount: 1,
      };
      await createGameInDb(code, initialState);
      setGameCode(code);
      setView('create');
    } catch (e) {
      setError((e as Error).message || "Could not create game.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(gameCode);
    setCopyButtonText('Copied!');
    setTimeout(() => setCopyButtonText('Copy Code'), 2000);
  };
  
  const handleJoinGame = async () => {
    if (joinCode.trim().length === 0) {
      setError("Please enter a game code.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const gameState = await joinGameInDb(joinCode);
      if (gameState) {
        onGameStart({ gameId: joinCode, playerColor: 'black' });
      } else {
        setError("Game code not found.");
      }
    } catch (e: any) {
      setError(e.message || "Could not join game.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const renderInitialView = () => (
    <>
      <h2 className="text-2xl font-bold text-white mb-6">Play with a Friend</h2>
      <div className="flex flex-col space-y-4 w-full">
        <button onClick={handleCreateGame} disabled={isLoading} className="w-full text-center px-4 py-3 bg-pink-500 text-white font-bold rounded-lg cursor-pointer hover:bg-pink-600 transition-colors duration-200 disabled:bg-gray-600">
          {isLoading ? 'Creating...' : 'Create Game'}
        </button>
        <button onClick={() => setView('join')} disabled={isLoading} className="w-full text-center px-4 py-3 bg-gray-600 text-white font-bold rounded-lg cursor-pointer hover:bg-gray-700 transition-colors duration-200">
          Join Game
        </button>
      </div>
    </>
  );

  const renderCreateView = () => (
    <>
      <h2 className="text-2xl font-bold text-white mb-4">Your Game Code</h2>
      <p className="text-gray-400 text-center mb-6">Share this code with your friend. They can use it to join your game.</p>
      <div className="bg-gray-900 p-4 rounded-lg flex items-center justify-between w-full mb-6">
        <span className="text-3xl font-mono text-yellow-300 tracking-widest">{gameCode}</span>
        <button onClick={handleCopyToClipboard} className="px-4 py-2 bg-pink-500 rounded-md hover:bg-pink-600 transition-colors">
          {copyButtonText}
        </button>
      </div>
       <button onClick={() => onGameStart({ gameId: gameCode, playerColor: 'white' })} className="w-full text-center px-4 py-3 bg-green-500 text-white font-bold rounded-lg cursor-pointer hover:bg-green-600 transition-colors duration-200">
        Start Playing
      </button>
    </>
  );

  const renderJoinView = () => (
    <>
      <h2 className="text-2xl font-bold text-white mb-6">Join a Friend's Game</h2>
      <div className="flex flex-col space-y-4 w-full">
        <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Enter Game Code" className="w-full p-3 bg-gray-900 border-2 border-gray-600 rounded-lg text-center font-mono text-xl focus:border-pink-500 focus:outline-none" />
        <button onClick={handleJoinGame} disabled={isLoading} className="w-full text-center px-4 py-3 bg-pink-500 text-white font-bold rounded-lg cursor-pointer hover:bg-pink-600 transition-colors duration-200 disabled:bg-gray-600">
          {isLoading ? 'Joining...' : 'Join & Play'}
        </button>
      </div>
    </>
  );

  return (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="relative bg-gray-800 p-8 rounded-lg shadow-2xl flex flex-col items-center w-full max-w-md">
        <button onClick={isLoading ? undefined : (view === 'initial' ? onClose : () => { setView('initial'); setError(null); })} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors" aria-label={view === 'initial' ? "Close" : "Back"}>
          {view === 'initial' ? ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> ) 
                           : ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> )}
        </button>

        {view === 'initial' && renderInitialView()}
        {view === 'create' && renderCreateView()}
        {view === 'join' && renderJoinView()}
        
        {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
      </div>
    </div>
  );
};

export default MultiplayerModal;