import test from 'node:test';
import assert from 'node:assert/strict';
import { canProvision } from './provisionSchoolUser.js';

const school = { rolePermissions: { teacher: { students: true } } };

test('teachers may add students only while active and permitted', () => {
  const base = { creatorUid: 'owner', callerUid: 'teacher', member: { status: 'active', role: 'teacher' }, school };
  assert.equal(canProvision({ ...base, role: 'student' }), true);
  assert.equal(canProvision({ ...base, role: 'admin' }), false);
  assert.equal(canProvision({ ...base, role: 'teacher' }), false);
  assert.equal(canProvision({ ...base, member: { status: 'archived', role: 'teacher' }, role: 'student' }), false);
  assert.equal(canProvision({ ...base, school: { rolePermissions: { teacher: { students: false } } }, role: 'student' }), false);
});

test('administrators can add staff and students; unrelated members cannot', () => {
  assert.equal(canProvision({ creatorUid: 'owner', callerUid: 'owner', member: null, school, role: 'teacher' }), true);
  assert.equal(canProvision({ creatorUid: 'owner', callerUid: 'admin', member: { status: 'active', role: 'admin' }, school, role: 'student' }), true);
  assert.equal(canProvision({ creatorUid: 'owner', callerUid: 'student', member: { status: 'active', role: 'student' }, school, role: 'student' }), false);
});
