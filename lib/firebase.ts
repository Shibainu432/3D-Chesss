import { initializeApp, FirebaseApp } from 'firebase/app';
// Explicitly import the database module for its side effects to ensure service registration.
import 'firebase/database';
import { getDatabase, ref, set, get, update, onValue, DataSnapshot, Database } from 'firebase/database';
import type { BoardState, Piece } from '../types';

// This is a placeholder configuration.
// To use the online multiplayer feature, you need to:
// 1. Create a new project on the Firebase website (it's free).
// 2. Go to Project settings -> General tab.
// 3. Under "Your apps", click the web icon (</>) to register a new web app.
// 4. Copy the `firebaseConfig` object you are given and paste it here.
// 5. In the Firebase console, go to Build -> Realtime Database.
// 6. Create a database and in the "Rules" tab, set .read and .write to "true" for this demo.
//    (For a real app, you would want more secure rules).
const firebaseConfig = {
  apiKey: "AIzaSyCOdQb8Su9wcFaxKjVKoWH35Asnc6yZP5M",
  authDomain: "d-chess-e4eae.firebaseapp.com",
  databaseURL: "https://d-chess-e4eae-default-rtdb.firebaseio.com",
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