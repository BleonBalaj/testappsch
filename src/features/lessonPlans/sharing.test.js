import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSharedPlans, changedPlanFields, inboxRecord } from './sharing.js';
import { createLessonPlanRepository } from './repository.js';
const records = [
  { planId: '1', ownerUid: 'a', ownerName: 'Shqipe', ownerEmail: 'q@school.test', subject: 'Matematikë', lessonUnit: 'Bashkësitë', lessonDate: '2026-10-15', sharedAt: '2026-10-16T12:00:00Z' },
  { planId: '2', ownerUid: 'b', ownerName: 'Besart', ownerEmail: 'b@school.test', subject: 'English', lessonUnit: 'Grammar', lessonDate: '2026-10-16', sharedAt: '2026-10-15T12:00:00Z' },
];
test('shared-plan filters combine authors, subjects, accent-insensitive full search and distinct date bases', () => {
  assert.deepEqual(filterSharedPlans(records, { search: 'bashkesite', ownerUid: 'a', subject: 'Matematikë' }).map(row => row.planId), ['1']);
  assert.equal(filterSharedPlans(records, { search: 'q@school.test' }).length, 1);
  assert.equal(filterSharedPlans(records, { search: 'Shqipe', ownerUid: 'b' }).length, 0);
  const date = { date: 'today', now: new Date('2026-10-16T12:00:00Z') };
  assert.equal(filterSharedPlans(records, date)[0].planId, '2');
  assert.equal(filterSharedPlans(records, { ...date, dateBasis: 'shared' })[0].planId, '1');
  assert.equal(filterSharedPlans(records, { date: 'custom', from: '2026-10-16' }).length, 1);
  assert.equal(filterSharedPlans(records, { date: 'custom', to: '2026-10-15' }).length, 1);
  assert.equal(filterSharedPlans(records, { date: 'custom', from: '2026-10-17', to: '2026-10-15' }).length, 0);
});
test('inbox metadata starts a fresh review without changing the author plan status', () => {
  const plan = { id: '1', lessonUnit: 'Sets', status: 'completed' };
  const record = inboxRecord(plan, { ownerUid: 'a', ownerName: 'A', ownerEmail: 'a@school.test', shareToken: 's', revisionId: 'r', shareCycle: 2 });
  assert.equal(record.reviewStatus, 'pending');
  assert.equal(record.shareCycle, 2);
  assert.equal(plan.status, 'completed');
});
test('history diffs include added and removed content and ignore autosave timestamps', () => {
  assert.deepEqual(changedPlanFields({ lessonUnit: 'Old', homework: 'A', updatedAt: '1' }, { lessonUnit: 'New', resources: ['Book'], updatedAt: '2' }), ['lessonUnit', 'homework', 'resources']);
  assert.deepEqual(changedPlanFields({ successCriteria: ['A'] }, { successCriteria: ['A'] }), []);
});
test('repository uses stable ownership across email changes and rejects another UID even with the same email', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const repo = createLessonPlanRepository('new@school.test', { ownerUid: 'u', storage });
  assert.equal(repo.mergeCloudPlan({ id: '1', status: 'draft', ownerUid: 'u', teacherId: 'old@school.test', updatedAt: '2026-10-16' }), true);
  assert.equal(repo.getPlan('1').teacherId, 'new@school.test');
  assert.equal(repo.savePlan(repo.getPlan('1')).ownerUid, 'u');
  assert.equal(repo.mergeCloudPlan({ id: '2', status: 'draft', ownerUid: 'other', teacherId: 'new@school.test' }), false);
  assert.throws(() => repo.savePlan({ id: '2', status: 'draft', ownerUid: 'other', teacherId: 'new@school.test' }), /another teacher/);
});
