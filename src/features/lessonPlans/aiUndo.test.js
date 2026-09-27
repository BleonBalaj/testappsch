import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLessonAiUndoSnapshot, buildLessonAiUndoPatch } from './aiUndo.js';

test('undo restores every field changed by AI including replaced lists, period, and status', () => {
  const before = { id: 'plan-1', topic: 'Teacher topic', lessonOutcomes: ['Original outcome'], period: '', status: 'completed', reflection: 'Teacher note' };
  const after = { ...before, topic: 'AI topic', lessonOutcomes: ['Generated outcome'], period: '1', status: 'draft' };
  const snapshot = makeLessonAiUndoSnapshot(before, after, { schoolId: 'school-1', accountId: 'user-1' });
  const { patch, skipped } = buildLessonAiUndoPatch(after, snapshot);
  assert.deepEqual(patch, { topic: 'Teacher topic', lessonOutcomes: ['Original outcome'], period: '', status: 'completed' });
  assert.deepEqual(skipped, []);
  assert.equal(Object.hasOwn(patch, 'reflection'), false);
});

test('undo preserves fields edited manually after AI generation', () => {
  const before = { id: 'plan-1', topic: 'Original', methodology: 'Teacher method' };
  const after = { ...before, topic: 'AI topic', methodology: 'AI method' };
  const snapshot = makeLessonAiUndoSnapshot(before, after, { schoolId: 'school-1', accountId: 'user-1' });
  const current = { ...after, methodology: 'Teacher edited after AI' };
  const { patch, skipped } = buildLessonAiUndoPatch(current, snapshot);
  assert.deepEqual(patch, { topic: 'Original' });
  assert.deepEqual(skipped, ['methodology']);
});

test('undo never applies to another plan', () => {
  const snapshot = makeLessonAiUndoSnapshot({ id: 'plan-1', topic: '' }, { id: 'plan-1', topic: 'AI' }, { schoolId: 'school', accountId: 'user' });
  assert.deepEqual(buildLessonAiUndoPatch({ id: 'plan-2', topic: 'AI' }, snapshot).patch, {});
});
