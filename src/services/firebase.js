import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  connectAuthEmulator, 
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { 
  getFirestore, 
  connectFirestoreEmulator, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const functions = getFunctions(app, 'us-central1');

// Initialize Auth with persistent local session
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn('Could not set browserLocalPersistence on Firebase Auth:', err);
});

// Initialize Firestore with multi-tab persistent cache
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  db = getFirestore(app);
}

// Storage
let storage = null;
try {
  storage = getStorage(app);
} catch (e) {
  console.warn('Firebase Storage initialization notice:', e.message);
}

// Emulators support
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  const host = import.meta.env.VITE_EMULATOR_HOST || 'localhost';
  const authPort = Number(import.meta.env.VITE_AUTH_EMULATOR_PORT) || 9099;
  const firestorePort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT) || 8080;
  const storagePort = Number(import.meta.env.VITE_STORAGE_EMULATOR_PORT) || 9199;
  const functionsPort = Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT) || 5002;

  try {
    connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, firestorePort);
    connectFunctionsEmulator(functions, host, functionsPort);
    if (storage) {
      connectStorageEmulator(storage, host, storagePort);
    }
    console.info(`Connected client Firebase SDK to local emulators on ${host}`);
  } catch (err) {
    console.warn('Error connecting to Firebase emulators (they may already be connected):', err.message);
  }
}

export { app, auth, db, storage, functions, firebaseConfig };
