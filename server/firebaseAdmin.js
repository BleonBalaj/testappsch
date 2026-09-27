import { initializeApp, getApps, getApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import os from 'os';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'noesis-horizon-sch';

function getCliCredential() {
  try {
    const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data?.tokens?.access_token) {
        return {
          getAccessToken: async () => {
            try {
              const fresh = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              return {
                access_token: fresh.tokens.access_token,
                expires_in: 3600
              };
            } catch {
              return {
                access_token: data.tokens.access_token,
                expires_in: 3600
              };
            }
          }
        };
      }
    }
  } catch (err) {
    console.warn('Could not read firebase-tools configstore:', err.message);
  }
  return null;
}

let app;

if (!getApps().length) {
  let credential = undefined;

  // 1. Service account JSON via env var or file
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY.startsWith('{')) {
        credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
      } else if (fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) {
        const fileContent = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'utf8'));
        credential = cert(fileContent);
      }
    } catch (e) {
      console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
    }
  }

  // 2. Emulator support
  if (process.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    const host = process.env.VITE_EMULATOR_HOST || 'localhost';
    process.env.FIRESTORE_EMULATOR_HOST = `${host}:${process.env.VITE_FIRESTORE_EMULATOR_PORT || 8080}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `${host}:${process.env.VITE_AUTH_EMULATOR_PORT || 9099}`;
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = `${host}:${process.env.VITE_STORAGE_EMULATOR_PORT || 9199}`;
    console.log('Firebase Admin connected to local emulators');
  }

  // 3. Fallback to CLI authenticated token if local dev without explicit service account
  if (!credential && !process.env.FIRESTORE_EMULATOR_HOST) {
    const cliCred = getCliCredential();
    if (cliCred) {
      credential = cliCred;
    }
  }

  try {
    if (credential) {
      app = initializeApp({ projectId, credential });
    } else {
      try {
        app = initializeApp({ projectId, credential: applicationDefault() });
      } catch {
        app = initializeApp({ projectId });
      }
    }
  } catch (err) {
    console.error('Error initializing Firebase Admin app:', err.message);
    app = getApps().length > 0 ? getApp() : null;
  }
} else {
  app = getApp();
}

export const auth = app ? getAuth(app) : null;
export let db = null;
try {
  db = app ? getFirestore(app) : null;
} catch (e) {
  console.warn('Notice: Firestore Admin initialized without direct certificate:', e.message);
}
export { FieldValue };
export default app;
