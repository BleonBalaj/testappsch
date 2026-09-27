import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSON_AI_LIMIT, LessonAiQuotaError, getLessonAiQuota, reserveLessonAiQuota,
  completeLessonAiQuota, releaseLessonAiQuota,
} from './lessonAiQuota.js';

function fakeFirestore() {
  const records = new Map();
  let tail = Promise.resolve();
  const snapshot = (path) => ({ data: () => records.has(path) ? structuredClone(records.get(path)) : undefined });
  return {
    doc: (path) => ({ path, get: async () => snapshot(path) }),
    runTransaction(callback) {
      const operation = tail.then(async () => {
        const writes = [];
        const transaction = {
          get: async (ref) => snapshot(ref.path),
          set: (ref, value) => writes.push(() => records.set(ref.path, structuredClone(value))),
          delete: (ref) => writes.push(() => records.delete(ref.path)),
        };
        const result = await callback(transaction);
        writes.forEach((write) => write());
        return result;
      });
      tail = operation.catch(() => {});
      return operation;
    },
  };
}

const request = (number, extra = {}) => ({
  uid: 'teacher-1', schoolId: 'school-a', contextHash: `context-${number}`,
  requestId: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  now: 1000,
  ...extra,
});

test('quota reserves at most 50 concurrent calls for one account across schools', async () => {
  const db = fakeFirestore();
  const attempts = await Promise.allSettled(Array.from({ length: 55 }, (_, index) =>
    reserveLessonAiQuota(db, request(index, { schoolId: index % 2 ? 'school-b' : 'school-a' }))));
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, LESSON_AI_LIMIT);
  assert.equal(attempts.filter((item) => item.status === 'rejected' && item.reason instanceof LessonAiQuotaError && item.reason.code === 'resource-exhausted').length, 5);
  assert.equal((await getLessonAiQuota(db, 'teacher-1', 1000)).remaining, 0);
  assert.equal((await getLessonAiQuota(db, 'other-teacher', 1000)).remaining, 50);
});

test('only successful generations consume quota; replay returns the same result without another charge', async () => {
  const db = fakeFirestore();
  const first = request(1);
  await reserveLessonAiQuota(db, first);
  await releaseLessonAiQuota(db, first);
  assert.equal((await getLessonAiQuota(db, first.uid, 1000)).used, 0);
  await reserveLessonAiQuota(db, first);
  const completed = await completeLessonAiQuota(db, { ...first, result: { topic: 'Specific lesson' } });
  assert.equal(completed.quota.used, 1);
  const replay = await reserveLessonAiQuota(db, first);
  assert.deepEqual(replay.replay, { topic: 'Specific lesson' });
  assert.equal(replay.quota.used, 1);
  await assert.rejects(reserveLessonAiQuota(db, { ...first, contextHash: 'different-context' }), { code: 'invalid-argument' });
});

test('expired reservations are reclaimed, while an active duplicate cannot launch twice', async () => {
  const db = fakeFirestore();
  const first = request(1);
  await reserveLessonAiQuota(db, first);
  await assert.rejects(reserveLessonAiQuota(db, first), { code: 'aborted' });
  assert.equal((await getLessonAiQuota(db, first.uid, 1000 + 11 * 60 * 1000)).remaining, 50);
  const retried = await reserveLessonAiQuota(db, { ...first, now: 1000 + 11 * 60 * 1000 });
  assert.equal(retried.quota.remaining, 49);
});
