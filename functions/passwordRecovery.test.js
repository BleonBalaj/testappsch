import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordRecoveryEmail, recoveryRateState, reserveRecoveryCheck, verifyRecoveryAccount } from './passwordRecovery.js';

test('recovery normalizes email and rejects invalid input before querying Auth', () => {
  assert.equal(passwordRecoveryEmail('  TEACHER@School.com  '), 'teacher@school.com');
  for (const value of ['', 'bad', 'bad@', 'a @school.com', {}, `${'a'.repeat(250)}@s.com`]) {
    assert.throws(() => passwordRecoveryEmail(value), error => error.code === 'invalid-argument');
  }
});

test('missing Firebase Auth account is explicitly not-found', async () => {
  const auth = { async getUserByEmail() { throw Object.assign(new Error('missing'), { code: 'auth/user-not-found' }); } };
  await assert.rejects(verifyRecoveryAccount('missing@school.com', auth), error => error.code === 'not-found' && /Email not found/.test(error.message));
});

test('existing and provisioned accounts can recover without exposing schools or role data', async () => {
  for (const providerData of [[{ providerId: 'password' }], []]) {
    const auth = { async getUserByEmail() { return { uid: 'private', disabled: false, providerData, email: 'teacher@school.com' }; } };
    assert.deepEqual(await verifyRecoveryAccount('teacher@school.com', auth), { verified: true });
  }
});

test('disabled accounts and Auth outages fail honestly', async () => {
  await assert.rejects(verifyRecoveryAccount('disabled@school.com', { getUserByEmail: async () => ({ disabled: true }) }), error => error.code === 'failed-precondition');
  await assert.rejects(verifyRecoveryAccount('user@school.com', { getUserByEmail: async () => { throw new Error('connection'); } }), error => error.code === 'unavailable');
});

test('recovery request limits apply through the window and reset after expiry', () => {
  const state = recoveryRateState({ count: 4, expiresAt: 2000 }, 1000, 5);
  assert.deepEqual(state, { count: 5, expiresAt: 2000 });
  assert.throws(() => recoveryRateState(state, 1500, 5), error => error.code === 'resource-exhausted');
  assert.deepEqual(recoveryRateState(state, 2000, 5), { count: 1, expiresAt: 902000 });
});

test('limits reserve both email and network in one transaction using hashed keys', async () => {
  const writes = [];
  const db = {
    doc: path => ({ path }),
    runTransaction: async run => run({
      getAll: async (...refs) => refs.map(() => ({ data: () => undefined })),
      set: (ref, state) => writes.push({ path: ref.path, state }),
    }),
  };
  await reserveRecoveryCheck(db, 'teacher@school.com', '192.0.2.1', 1000);
  assert.equal(writes.length, 2);
  for (const write of writes) {
    assert.match(write.path, /^passwordRecoveryLimits\/[a-f0-9]{64}$/);
    assert.equal(write.state.count, 1);
  }
});
