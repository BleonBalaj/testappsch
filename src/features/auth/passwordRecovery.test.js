import test from 'node:test';
import assert from 'node:assert/strict';
import { requestVerifiedPasswordReset } from './passwordRecovery.js';

test('unknown email is never sent a reset request or treated as success', async () => {
  let sent = false;
  await assert.rejects(requestVerifiedPasswordReset('unknown@school.com', {
    verifyAccount: async () => { throw Object.assign(new Error(), { code: 'functions/not-found' }); },
    sendReset: async () => { sent = true; },
  }), /Email not found/);
  assert.equal(sent, false);
});

test('registered email is normalized, verified and sent in that order', async () => {
  const events = [];
  await requestVerifiedPasswordReset('  TEACHER@SCHOOL.COM ', {
    verifyAccount: async input => { events.push(['verify', input.email]); return { data: { verified: true } }; },
    sendReset: async email => { events.push(['send', email]); },
  });
  assert.deepEqual(events, [['verify', 'teacher@school.com'], ['send', 'teacher@school.com']]);
});

test('lookup timeout or malformed response cannot trigger a reset email', async () => {
  let sent = 0;
  for (const verifyAccount of [async () => { throw new Error('network'); }, async () => ({ data: {} })]) {
    await assert.rejects(requestVerifiedPasswordReset('user@school.com', { verifyAccount, sendReset: async () => sent++ }), /Could not send/);
  }
  assert.equal(sent, 0);
});

test('an email sending failure remains an error even after account verification', async () => {
  await assert.rejects(requestVerifiedPasswordReset('user@school.com', {
    verifyAccount: async () => ({ data: { verified: true } }),
    sendReset: async () => { throw Object.assign(new Error(), { code: 'auth/user-not-found' }); },
  }), /Email not found/);
});

test('disabled-account and throttling errors are actionable and do not show success', async () => {
  for (const [code, message] of [['functions/failed-precondition', /disabled/], ['functions/resource-exhausted', /15 minutes/]]) {
    await assert.rejects(requestVerifiedPasswordReset('user@school.com', {
      verifyAccount: async () => { throw Object.assign(new Error(), { code }); },
      sendReset: async () => assert.fail('must not send'),
    }), message);
  }
});
