import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpsError } from 'firebase-functions/v2/https';
import { toClientError, reportErrors } from './callableErrors.js';

test('expected errors pass through unchanged', () => {
  const original = new HttpsError('permission-denied', 'Your school role does not allow creating this account.');
  assert.equal(toClientError(original), original);
});

test('unexpected errors keep their code and message instead of a bare INTERNAL', () => {
  const firestoreError = Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index.'), { code: 9 });
  const converted = toClientError(firestoreError);
  assert.equal(converted.code, 'internal');
  assert.match(converted.message, /\(9: 9 FAILED_PRECONDITION: The query requires an index\.\)/);
  assert.match(toClientError(new Error('x'.repeat(1000))).message.length.toString(), /^\d{3}$/);
  assert.equal(toClientError(undefined).message, 'The server could not finish this request.');
});

test('reportErrors returns results and converts thrown errors', async () => {
  assert.equal(await reportErrors('t', {}, async () => 42), 42);
  await assert.rejects(reportErrors('t', {}, async () => { throw new HttpsError('not-found', 'Nope'); }), { code: 'not-found', message: 'Nope' });
});
