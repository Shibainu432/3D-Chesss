// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp } from "firebase/app";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    update, 
    onValue,
    type Database,
    type DataSnapshot
} from "firebase/database";
import type { Piece, BoardState } from '../types';


// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCOdQb8Su9wcFaxKjVKoWH35Asnc6yZP5M",
  authDomain: "d-chess-e4eae.firebaseapp.com",
  projectId: "d-chess-e4eae",
  storageBucket: "d-chess-e4eae.firebasestorage.app",
  messagingSenderId: "364334786915",
  appId: "1:364334786915:web:aadab2029ea64062f1cb56",
  measurementId: "G-PT52806K9W"
};

const isPlaceholderConfig = firebaseConfig.apiKey === "AIzaSyCOdQb8Su9wcFaxKjVKoWH35Asnc6yZP5M";
const NOT_CONFIGURED_ERROR = "Firebase is not configured. To use multiplayer, please follow the setup instructions in the comments of the `lib/firebase.ts` file.";

let app: FirebaseApp | null = null;
let database: Database | null = null;

export interface GameState {
  boardState: BoardState;
  turn: 'white' | 'black';
  capturedPieces: { white: Piece[], black: Piece[] };
  gameStatus: string;
  kingInCheck: 'white' | 'black' | null;
  playerCount: number;
}

function getDb(): Database {
    if (isPlaceholderConfig) {
        throw new Error(NOT_CONFIGURED_ERROR);
    }
    
    // Initialize on first call to prevent race conditions
    if (!database) {
        app = initializeApp(firebaseConfig);
        database = getDatabase(app);
    }

    if (!database) {
        throw new Error("Firebase Database service is not available. Initialization might have failed.");
    }
    
    return database;
}

export async function createGameInDb(gameId: string, initialState: GameState): Promise<void> {
  const db = getDb();
  const gameRef = ref(db, 'games/' + gameId);
  await set(gameRef, initialState);
}

export async function joinGameInDb(gameId: string): Promise<GameState | null> {
    const db = getDb();
    const gameRef = ref(db, 'games/' + gameId);
    const snapshot = await get(gameRef);
    if (snapshot.exists()) {
        const gameState = snapshot.val() as GameState;
        if (gameState.playerCount < 2) {
            await update(gameRef, { playerCount: 2 });
            return gameState;
        } else {
            throw new Error("Game is full.");
        }
    }
    return null;
}

export async function updateGameStateInDb(gameId: string, newState: Partial<GameState>): Promise<void> {
  const db = getDb();
  const gameRef = ref(db, 'games/' + gameId);
  await update(gameRef, newState);
}

export function onGameStateUpdate(gameId: string, callback: (state: GameState) => void): () => void {
  const db = getDb();
  const gameRef = ref(db, 'games/' + gameId);
  const unsubscribe = onValue(gameRef, (snapshot: DataSnapshot) => {
    const state = snapshot.val();
    if (state) {
      callback(state);
    }
  });

  // Return a function to detach the listener
  return unsubscribe;
}