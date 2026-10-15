import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSON_AI_LIMIT, LessonAiQuotaError, getLessonAiQuota, reserveLessonAiQuota,
  completeLessonAiQuota, releaseLessonAiQuota, lessonAiDayWindow,
} from './lessonAiQuota.js';

function fakeFirestore(initial = []) {
  const records = new Map(initial);
  let tail = Promise.resolve();
  const snapshot = (path) => ({ data: () => records.has(path) ? structuredClone(records.get(path)) : undefined });
  return {
    doc: (path) => ({ path, get: async () => snapshot(path) }),
    runTransaction(callback) {
      const operation = tail.then(async () => {
        const writes = [];
        const transaction = {
          get: async (ref) => snapshot(ref.path),
          set: (ref, value, options) => writes.push(() => records.set(ref.path, structuredClone(options?.merge ? { ...records.get(ref.path), ...value } : value))),
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

const beforeMidnight = Date.parse('2026-10-15T21:59:59.000Z');
const afterMidnight = Date.parse('2026-10-15T22:00:01.000Z');

test('50 successful generations exhaust only that day; midnight restores all 50 across schools', async () => {
  const db = fakeFirestore();
  for (let index = 0; index < 50; index++) {
    const input = request(index, { now: beforeMidnight });
    await reserveLessonAiQuota(db, input);
    await completeLessonAiQuota(db, { ...input, result: { topic: `Unit ${index}` } });
  }
  const exhausted = await getLessonAiQuota(db, 'teacher-1', beforeMidnight);
  assert.equal(exhausted.used, 50);
  assert.equal(exhausted.remaining, 0);
  assert.equal(exhausted.period, 'day');
  await assert.rejects(reserveLessonAiQuota(db, request(51, { now: beforeMidnight, schoolId: 'school-b' })), error => {
    assert.equal(error.code, 'resource-exhausted');
    assert.equal(error.details.resetsAt, '2026-10-15T22:00:00.000Z');
    return true;
  });
  const tomorrow = await getLessonAiQuota(db, 'teacher-1', afterMidnight);
  assert.equal(tomorrow.day, '2026-10-16');
  assert.equal(tomorrow.used, 0);
  assert.equal(tomorrow.remaining, 50);
  const next = request(52, { now: afterMidnight, schoolId: 'school-b' });
  await reserveLessonAiQuota(db, next);
  assert.equal((await completeLessonAiQuota(db, { ...next, result: {} })).quota.used, 1);
  assert.equal((await db.doc('lessonAiUsage/teacher-1').get()).data().used, 51);
});

test('previous lifetime limits do not block the daily allowance, and historical totals remain intact', async () => {
  const db = fakeFirestore([['lessonAiUsage/teacher-1', { used: 50, legacy: true }]]);
  assert.equal((await getLessonAiQuota(db, 'teacher-1', beforeMidnight)).remaining, 50);
  const input = request(1, { now: beforeMidnight });
  await reserveLessonAiQuota(db, input);
  const result = await completeLessonAiQuota(db, { ...input, result: {} });
  assert.equal(result.quota.used, 1);
  assert.deepEqual((await db.doc('lessonAiUsage/teacher-1').get()).data(), { used: 51, legacy: true, updatedAt: new Date(beforeMidnight).toISOString() });
});

test('a generation crossing midnight is charged once to its start day and preserves new-day reservations', async () => {
  const db = fakeFirestore();
  const yesterday = request(1, { now: beforeMidnight });
  await reserveLessonAiQuota(db, yesterday);
  const today = request(2, { now: afterMidnight });
  await reserveLessonAiQuota(db, today);
  await assert.rejects(reserveLessonAiQuota(db, { ...yesterday, now: afterMidnight }), { code: 'aborted' });
  const completed = await completeLessonAiQuota(db, { ...yesterday, now: afterMidnight, result: { topic: 'Yesterday' } });
  assert.equal(completed.quota.used, 0);
  assert.equal(completed.quota.reserved, 1);
  assert.equal(completed.quota.remaining, 49);
  assert.equal((await getLessonAiQuota(db, yesterday.uid, beforeMidnight)).used, 1);
  assert.equal((await completeLessonAiQuota(db, { ...today, result: {} })).quota.used, 1);
  assert.equal((await db.doc('lessonAiUsage/teacher-1').get()).data().used, 2);
});

test('retrying a successful request tomorrow returns the cached result without consuming a new slot', async () => {
  const db = fakeFirestore();
  const input = request(1, { now: beforeMidnight });
  await reserveLessonAiQuota(db, input);
  await completeLessonAiQuota(db, { ...input, result: { topic: 'Same result' } });
  const replay = await reserveLessonAiQuota(db, { ...input, now: afterMidnight });
  assert.deepEqual(replay.replay, { topic: 'Same result' });
  assert.equal(replay.quota.used, 0);
  assert.equal(replay.quota.remaining, 50);
  const completeReplay = await completeLessonAiQuota(db, { ...input, now: afterMidnight, result: {} });
  assert.deepEqual(completeReplay.result, replay.replay);
  assert.equal(completeReplay.quota.used, 0);
  assert.equal((await db.doc('lessonAiUsage/teacher-1').get()).data().used, 1);
});

test('a failed generation crossing midnight releases its old slot, without changing today', async () => {
  const db = fakeFirestore();
  const yesterday = request(1, { now: beforeMidnight });
  const today = request(2, { now: afterMidnight });
  await reserveLessonAiQuota(db, yesterday);
  await reserveLessonAiQuota(db, today);
  await releaseLessonAiQuota(db, { ...yesterday, now: afterMidnight });
  assert.equal((await getLessonAiQuota(db, yesterday.uid, beforeMidnight)).remaining, 50);
  assert.equal((await getLessonAiQuota(db, today.uid, afterMidnight)).remaining, 49);
  await assert.rejects(completeLessonAiQuota(db, { ...yesterday, now: afterMidnight, result: {} }), { code: 'aborted' });
});

test('an expired attempt cannot exceed the cap by finishing after its slot was reclaimed', async () => {
  const db = fakeFirestore();
  const input = request(1);
  await reserveLessonAiQuota(db, input);
  await assert.rejects(completeLessonAiQuota(db, { ...input, now: 1000 + 11 * 60000, result: {} }), { code: 'aborted' });
  assert.equal((await getLessonAiQuota(db, input.uid, 1000 + 11 * 60000)).used, 0);
});

test('daily reset follows local midnight, including 23-hour and 25-hour daylight-saving days', () => {
  const cases = [
    ['2026-03-28T23:00:00.000Z', '2026-03-29', '2026-03-29T22:00:00.000Z', 23],
    ['2026-10-24T22:00:00.000Z', '2026-10-25', '2026-10-25T23:00:00.000Z', 25],
    ['2026-12-31T23:00:00.000Z', '2027-01-01', '2027-01-01T23:00:00.000Z', 24],
  ];
  for (const [start, day, reset, hours] of cases) {
    const window = lessonAiDayWindow(Date.parse(start));
    assert.equal(window.day, day);
    assert.equal(window.resetsAt, reset);
    assert.equal((Date.parse(window.resetsAt) - Date.parse(start)) / 3600000, hours);
    assert.equal(lessonAiDayWindow(Date.parse(reset) - 1).day, day);
    assert.notEqual(lessonAiDayWindow(Date.parse(reset)).day, day);
  }
});
