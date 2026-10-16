import test from 'node:test';
import assert from 'node:assert/strict';
import { canPrepareLessonPlans, canClaimLegacyPlan } from './lessonPlanOwnership.js';
test('lesson ownership preparation follows active school membership and module permission', () => {
  assert.equal(canPrepareLessonPlans('u', { creatorUid: 'u' }, null), true);
  assert.equal(canPrepareLessonPlans('u', {}, { role: 'admin', status: 'active' }), true);
  for (const role of ['teacher', 'dept_head']) {
    assert.equal(canPrepareLessonPlans('u', {}, { role, status: 'active' }), true);
    assert.equal(canPrepareLessonPlans('u', { rolePermissions: { teacher: { 'lesson-plans': false } } }, { role, status: 'active' }), false);
    assert.equal(canPrepareLessonPlans('u', {}, { role, status: 'inactive' }), false);
  }
  assert.equal(canPrepareLessonPlans('u', {}, { role: 'student', status: 'active' }), false);
  assert.equal(canPrepareLessonPlans('u', {}, null), false);
});
test('legacy migration only claims matching authoritative email and never replaces an existing UID', () => {
  assert.equal(canClaimLegacyPlan({ teacherId: 'Teacher@School.test' }, 'u', 'teacher@school.test'), true);
  assert.equal(canClaimLegacyPlan({ teacherId: 'other@school.test' }, 'u', 'teacher@school.test'), false);
  assert.equal(canClaimLegacyPlan({ teacherId: 'teacher@school.test', ownerUid: 'other' }, 'u', 'teacher@school.test'), false);
  for (const value of [null, {}, { teacherId: 2 }]) assert.equal(canClaimLegacyPlan(value, 'u', null), false);
});
