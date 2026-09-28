import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { ensureDefaultApp } from './adminApp.js';

const require = createRequire(import.meta.url);

async function reset() {
  await Promise.all(getApps().map(app => deleteApp(app)));
}

// Recreates production: firebase-functions (CommonJS) creates its named app to
// verify the caller's ID token before our handler runs.
function simulateFunctionsSdkApp() {
  require('firebase-admin/app').initializeApp({ projectId: 'demo-test' }, '__FIREBASE_FUNCTIONS_SDK__');
}

test('the old "any app exists" check leaves no default app in production', async () => {
  await reset();
  simulateFunctionsSdkApp();
  if (!getApps().length) initializeApp();
  assert.throws(() => getFirestore(), { code: 'app/no-app' });
  await reset();
});

test('ensureDefaultApp creates the default app even when the SDK app exists', async () => {
  await reset();
  simulateFunctionsSdkApp();
  const app = ensureDefaultApp();
  assert.equal(app.name, '[DEFAULT]');
  assert.doesNotThrow(() => getFirestore());
  assert.doesNotThrow(() => getAuth());
  assert.equal(ensureDefaultApp(), app, 'reuses the same app on later calls');
  await reset();
});
