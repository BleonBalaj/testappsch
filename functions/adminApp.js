import { getApps, initializeApp } from 'firebase-admin/app';

/**
 * The default Admin SDK app, created on first use.
 *
 * Don't test `getApps().length` instead: in production, firebase-functions
 * verifies callable ID tokens with its own named app ("__FIREBASE_FUNCTIONS_SDK__"),
 * so an app can exist while the default one does not. getAuth()/getFirestore()
 * then fail with "app/no-app". The emulator hides this because it skips that step.
 */
export function ensureDefaultApp() {
  return getApps().find(app => app.name === '[DEFAULT]') ?? initializeApp();
}
