import React, { useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import type { Piece, BoardState, Move } from './types';
import { calculateLegalMoves, initializeBoardState, isCheckmate, isStalemate, isKingInCheck } from './lib/gameLogic';
import InfoPanel from './components/InfoPanel';
import ThreeScene from './components/ThreeScene';
import PromotionModal from './components/PromotionModal';
import MultiplayerModal from './components/MultiplayerModal';
import { GoogleGenAI, Type } from "@google/genai";
import { loadAssets } from './lib/threeUtils';
import { onGameStateUpdate, updateGameStateInDb, GameState } from './lib/firebase';

const App: React.FC = () => {
  const [boardState, setBoardState] = useState<BoardState>(() => initializeBoardState());
  const [turn, setTurn] = useState<'white' | 'black'>('white');
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [capturedPieces, setCapturedPieces] = useState<{ white: Piece[], black: Piece[] }>({ white: [], black: [] });
  const [gameStatus, setGameStatus] = useState('active');
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [promotionData, setPromotionData] = useState<{ piece: Piece, x: number, y: number, z: number } | null>(null);
  const [pieceModels, setPieceModels] = useState<Record<string, THREE.Object3D> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading Default 3D Models...');
  const [hoveredSquare, setHoveredSquare] = useState<{ x: number, y: number, z: number } | null>(null);
  const [kingInCheck, setKingInCheck] = useState<'white' | 'black' | null>(null);
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  
  // Multiplayer state
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);


  // Effect for initial default model load
  useEffect(() => {
    const loadDefaultModels = async () => {
      try {
        const defaultMapping: Record<Piece['type'], string> = {
          P: 'Modern_Pawn', R: 'Modern_Rook', N: 'Modern_Knight',
          B: 'Modern_Bishop', Q: 'Modern_Queen', K: 'Modern_King'
        };
        const models = await loadAssets(undefined, defaultMapping);
        setPieceModels(models);
      } catch (error) {
        console.error("Failed to load default 3D assets:", error);
        alert("A critical error occurred while loading default 3D models. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    };
    loadDefaultModels();
  }, []);

  // Effect to listen for real-time game state updates from Firebase
  useEffect(() => {
    if (!gameId) return;

    const unsubscribe = onGameStateUpdate(gameId, (newState) => {
      setBoardState(newState.boardState);
      setTurn(newState.turn);
      setCapturedPieces(newState.capturedPieces);
      setGameStatus(newState.gameStatus);
      setKingInCheck(newState.kingInCheck);
    });
    
    // Cleanup listener on component unmount or gameId change
    return () => unsubscribe();
  }, [gameId]);

  // Local calculation for valid moves when a piece is selected
  useEffect(() => {
    if (selectedPiece) {
      setValidMoves(calculateLegalMoves(selectedPiece, boardState));
    } else {
      setValidMoves([]);
    }
  }, [selectedPiece, boardState]);
  
  // Game state checks (checkmate, stalemate) - only run by the current player to avoid redundant checks
  useEffect(() => {
    if (gameStatus !== 'active' || (gameId && playerColor !== turn)) return;

    const playerToMove = turn;
    
    if (isCheckmate(playerToMove, boardState)) {
      const winner = playerToMove === 'white' ? 'BLACK' : 'WHITE';
      const newStatus = `CHECKMATE! ${winner} WINS!`;
      if(gameId) updateGameStateInDb(gameId, { gameStatus: newStatus, kingInCheck: null });
      else { setGameStatus(newStatus); setKingInCheck(null); }
      return;
    }
    
    if (isStalemate(playerToMove, boardState)) {
      const newStatus = 'STALEMATE! Game is a draw.';
      if (gameId) updateGameStateInDb(gameId, { gameStatus: newStatus, kingInCheck: null });
      else { setGameStatus(newStatus); setKingInCheck(null); }
      return;
    }

    const inCheck = isKingInCheck(playerToMove, boardState);
    if ((inCheck && kingInCheck !== playerToMove) || (!inCheck && kingInCheck !== null)) {
      const newKingInCheck = inCheck ? playerToMove : null;
      if (gameId) updateGameStateInDb(gameId, { kingInCheck: newKingInCheck });
      else setKingInCheck(newKingInCheck);
    }
  }, [turn, boardState, gameStatus, gameId, playerColor, kingInCheck]);
  
  const resetGame = useCallback((isOnline = false) => {
    const initialState = initializeBoardState();
    setBoardState(initialState);
    setTurn('white');
    setSelectedPiece(null);
    setValidMoves([]);
    setCapturedPieces({ white: [], black: [] });
    setGameStatus('active');
    setKingInCheck(null);
    setPromotionData(null);
    setShowMultiplayerModal(false);
    
    if (!isOnline) {
      setGameId(null);
      setPlayerColor(null);
    }
  }, []);

  const handleGameStart = ({ gameId, playerColor }: { gameId: string, playerColor: 'white' | 'black' }) => {
    resetGame(true);
    setGameId(gameId);
    setPlayerColor(playerColor);
    setShowMultiplayerModal(false);
  };

  const executeMove = useCallback((piece: Piece, targetX: number, targetY: number, targetZ: number, move: Move) => {
    const { color } = piece;

    // Handle Pawn Promotion
    const promotionRank = color === 'white' ? 7 : 0;
    if (piece.type === 'P' && targetZ === promotionRank) {
        setPromotionData({ piece, x: targetX, y: targetY, z: targetZ });
        // Don't change turn yet, wait for promotion choice
        return;
    }
    
    const newBoardState = JSON.parse(JSON.stringify(boardState));
    const newCapturedPieces = JSON.parse(JSON.stringify(capturedPieces));
    
    // Logic for capturing a piece
    const targetPiece = newBoardState[targetX][targetY][targetZ];
    if (targetPiece) {
        const opponentColor = color === 'white' ? 'black' : 'white';
        newCapturedPieces[opponentColor].push(targetPiece);
    }

    // Move the piece
    newBoardState[piece.x][piece.y][piece.z] = null;
    const movedPiece = { ...piece, x: targetX, y: targetY, z: targetZ, hasMoved: true };
    newBoardState[targetX][targetY][targetZ] = movedPiece;
    
    // Handle Castling
    if (move.castle) {
        if (move.castle === 'king') {
            const rook = newBoardState[7][targetY][targetZ];
            if(rook) {
                newBoardState[7][targetY][targetZ] = null;
                rook.x = targetX - 1;
                rook.hasMoved = true;
                newBoardState[targetX - 1][targetY][targetZ] = rook;
            }
        } else { // Queenside
            const rook = newBoardState[0][targetY][targetZ];
            if(rook) {
                newBoardState[0][targetY][targetZ] = null;
                rook.x = targetX + 1;
                rook.hasMoved = true;
                newBoardState[targetX + 1][targetY][targetZ] = rook;
            }
        }
    }
    
    const nextTurn = turn === 'white' ? 'black' : 'white';
    
    // Update state
    if (gameId) {
      const newState: Partial<GameState> = {
        boardState: newBoardState,
        capturedPieces: newCapturedPieces,
        turn: nextTurn,
      };
      updateGameStateInDb(gameId, newState);
    } else {
      setBoardState(newBoardState);
      setCapturedPieces(newCapturedPieces);
      setTurn(nextTurn);
    }

    setSelectedPiece(null);
  }, [boardState, capturedPieces, turn, gameId]);


  const handleSquareClick = useCallback((x: number, y: number, z: number) => {
    if (gameStatus !== 'active' || promotionData) return;
    // For online games, only allow moves if it's your turn
    if (gameId && playerColor !== turn) return;

    const clickedPiece = boardState[x][y][z];

    if (selectedPiece) {
        const move = validMoves.find(m => m.x === x && m.y === y && m.z === z);
        if (move) {
            executeMove(selectedPiece, x, y, z, move);
            return;
        }

        if (clickedPiece && clickedPiece.color === turn) {
            setSelectedPiece(clickedPiece);
        } else {
            setSelectedPiece(null);
        }
    } else {
        if (clickedPiece && clickedPiece.color === turn) {
            setSelectedPiece(clickedPiece);
        }
    }
  }, [boardState, selectedPiece, validMoves, turn, executeMove, gameStatus, promotionData, gameId, playerColor]);
  
  const handlePromotion = (promotedTo: Piece['type']) => {
    if (!promotionData) return;
    const { piece, x, y, z } = promotionData;
    
    const newBoardState = JSON.parse(JSON.stringify(boardState));
    const newCapturedPieces = JSON.parse(JSON.stringify(capturedPieces));

    newBoardState[piece.x][piece.y][piece.z] = null;
    
    const targetPiece = newBoardState[x][y][z];
    if (targetPiece) {
        const opponentColor = piece.color === 'white' ? 'black' : 'white';
        newCapturedPieces[opponentColor].push(targetPiece);
    }
    
    newBoardState[x][y][z] = { type: promotedTo, color: piece.color, x, y, z, hasMoved: true };
    const nextTurn = turn === 'white' ? 'black' : 'white';

    if (gameId) {
      updateGameStateInDb(gameId, {
        boardState: newBoardState,
        capturedPieces: newCapturedPieces,
        turn: nextTurn,
      });
    } else {
      setBoardState(newBoardState);
      setCapturedPieces(newCapturedPieces);
      setTurn(nextTurn);
    }
    
    setSelectedPiece(null);
    setPromotionData(null);
  };

  const handleCustomModelLoad = async (fileContent: string) => {
    setIsLoading(true);
    setLoadingMessage('Analyzing 3D Model with AI...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const prompt = `Analyze the following .obj file content. Your task is to identify the object names for each of the 6 standard chess pieces: Pawn, Rook, Knight, Bishop, Queen, and King. The object names are on lines starting with "o ".
Your response must be a valid JSON object.
The keys of the JSON must be the standard one-letter abbreviations (P, R, N, B, Q, K).
The values must be the corresponding object names found in the file, but WITHOUT the leading "o " prefix.
Do not include any markdown, explanations, or any text other than the single, valid JSON object.
FILE CONTENT:
${fileContent}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', contents: prompt, config: {
          responseMimeType: 'application/json', responseSchema: {
            type: Type.OBJECT, properties: {
              'P': { type: Type.STRING }, 'R': { type: Type.STRING }, 'N': { type: Type.STRING },
              'B': { type: Type.STRING }, 'Q': { type: Type.STRING }, 'K': { type: Type.STRING },
            }, required: ['P', 'R', 'N', 'B', 'Q', 'K']
          }
        }
      });
      
      const mapping = JSON.parse(response.text);
      setLoadingMessage('Slicing file and loading models...');
      const models = await loadAssets(fileContent, mapping);
      setPieceModels(models);

    } catch (error) {
      console.error("AI analysis or model loading failed:", error);
      alert("AI analysis or model loading failed:\n" + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const startX = mouseDownEvent.clientX;
    const startWidth = sidebarWidth;
    const doDrag = (mouseMoveEvent: MouseEvent) => {
      const newWidth = startWidth + mouseMoveEvent.clientX - startX;
      if (newWidth > 280 && newWidth < 600) setSidebarWidth(newWidth);
    };
    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  }, [sidebarWidth]);

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen bg-gray-900 text-white overflow-hidden">
      {promotionData && <PromotionModal color={promotionData.piece.color} onPromote={handlePromotion} />}
      {showMultiplayerModal && <MultiplayerModal onGameStart={handleGameStart} onClose={() => setShowMultiplayerModal(false)} />}

      <div style={{ width: `${sidebarWidth}px` }} className="flex-shrink-0 h-full">
        <InfoPanel 
          turn={turn}
          capturedPieces={capturedPieces}
          boardState={boardState}
          selectedPiece={selectedPiece}
          validMoves={validMoves}
          onSquareClick={handleSquareClick}
          onSquareHover={setHoveredSquare}
          onCustomModelLoad={handleCustomModelLoad}
          gameStatus={gameStatus}
          kingInCheck={kingInCheck}
          onPlayWithFriendClick={() => setShowMultiplayerModal(true)}
          gameId={gameId}
          playerColor={playerColor}
        />
      </div>
      
      <div 
        className="w-2 cursor-col-resize bg-gray-700 hover:bg-pink-400 transition-colors duration-200 flex-shrink-0"
        onMouseDown={startResizing}
        aria-label="Resize sidebar"
        role="separator"
      />

      <div className="flex-grow h-full relative">
        <ThreeScene 
            boardState={boardState}
            selectedPiece={selectedPiece}
            validMoves={validMoves}
            pieceModels={pieceModels}
            isLoading={isLoading}
            loadingMessage={loadingMessage}
            hoveredSquare={hoveredSquare}
            kingInCheck={kingInCheck}
        />
      </div>
    </div>
  );
};

export default App;