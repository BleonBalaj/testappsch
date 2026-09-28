import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateInvitation, invitationIndexId } from './invitations.js';

const now = Date.parse('2026-09-28T00:00:00Z');
const invite = (overrides = {}) => ({
  email: 'teacher@school.com', status: 'pending', role: 'teacher', expiresAt: '2026-10-01T00:00:00.000Z', ...overrides,
});

test('only the addressee can act on a pending, unexpired invitation', () => {
  assert.deepEqual(evaluateInvitation(invite(), 'teacher@school.com', now), { ok: true, role: 'teacher' });
  assert.equal(evaluateInvitation(invite({ email: 'Teacher@School.com' }), 'teacher@school.com', now).ok, true);
  assert.equal(evaluateInvitation(invite(), 'other@school.com', now).code, 'permission-denied');
  assert.equal(evaluateInvitation(invite(), '', now).code, 'permission-denied');
  assert.equal(evaluateInvitation(null, 'teacher@school.com', now).code, 'not-found');
});

test('closed, expired, or malformed invitations are refused', () => {
  assert.equal(evaluateInvitation(invite({ status: 'accepted' }), 'teacher@school.com', now).code, 'failed-precondition');
  assert.equal(evaluateInvitation(invite({ expiresAt: '2026-09-01T00:00:00.000Z' }), 'teacher@school.com', now).code, 'failed-precondition');
  assert.equal(evaluateInvitation(invite({ expiresAt: 'soon' }), 'teacher@school.com', now).code, 'failed-precondition');
  assert.equal(evaluateInvitation(invite({ role: 'owner' }), 'teacher@school.com', now).code, 'failed-precondition');
  assert.equal(evaluateInvitation(invite({ role: 'custom_lab_tech' }), 'teacher@school.com', now).ok, true);
});

test('the addressee check runs before status so other accounts learn nothing', () => {
  assert.equal(evaluateInvitation(invite({ status: 'accepted' }), 'other@school.com', now).code, 'permission-denied');
});

test('index ids match the format the previous API wrote', () => {
  assert.equal(invitationIndexId('a+b@x.com', 'sch_1'), 'a%2Bb%40x.com_sch_1');
});
