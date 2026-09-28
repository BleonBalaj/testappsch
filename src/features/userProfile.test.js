import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfileBackfill } from './userProfile.js';

const account = { uid: 'u1', email: 'Teacher@School.com', displayName: 'Ana Teacher' };

test('a missing profile gets every base field', () => {
  assert.deepEqual(buildProfileBackfill(account, null), {
    fields: { uid: 'u1', email: 'teacher@school.com', displayName: 'Ana Teacher', name: 'Ana Teacher' },
    needsCreatedAt: true,
  });
});

test('a complete profile needs nothing', () => {
  const profile = { uid: 'u1', email: 'teacher@school.com', displayName: 'Ana', name: 'Ana', createdAt: {} };
  assert.equal(buildProfileBackfill(account, profile), null);
});

test('partial legacy profiles are completed without overwriting chosen names or photos', () => {
  const legacy = { displayName: 'Chosen Name', photoURL: 'data:image/png;base64,AA', updatedAt: {} };
  assert.deepEqual(buildProfileBackfill(account, legacy), {
    fields: { uid: 'u1', email: 'teacher@school.com', name: 'Chosen Name' },
    needsCreatedAt: true,
  });
});

test('email follows the account and name falls back to the email handle', () => {
  const result = buildProfileBackfill({ uid: 'u2', email: 'new@x.com' }, { uid: 'u2', email: 'old@x.com', createdAt: {} });
  assert.deepEqual(result, { fields: { email: 'new@x.com', displayName: 'new', name: 'new' }, needsCreatedAt: false });
  assert.equal(buildProfileBackfill(null, null), null);
});
