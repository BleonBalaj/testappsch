import test from 'node:test';
import assert from 'node:assert/strict';
import { entriesInRange, localDateKey, moodEntryDate, summarizeMoods } from './moods.js';

const entries = [
  { date: '2026-09-28', mood: 'happy' },
  { date: '2026-09-27', mood: 'sad' },
  { date: '2026-09-22', mood: 'neutral' },
  { date: '2026-09-21', mood: 'happy' },
  { date: '2026-08-01', mood: 'sad' },
  { date: 'bad', mood: 'happy' },
  { date: '2026-09-26', mood: 'unknown' },
];

test('no logged moods means no dominant mood, never a "happy" placeholder', () => {
  assert.deepEqual(summarizeMoods([]), { counts: { happy: 0, neutral: 0, sad: 0 }, total: 0, dominant: null, share: 0 });
});

test('the dominant mood is the most frequent one; ties are reported as mixed', () => {
  assert.equal(summarizeMoods([{ mood: 'sad' }, { mood: 'sad' }, { mood: 'happy' }]).dominant, 'sad');
  assert.equal(summarizeMoods([{ mood: 'sad' }, { mood: 'happy' }]).dominant, 'mixed');
  assert.equal(summarizeMoods([{ mood: 'neutral' }]).share, 1);
});

test('ranges use whole local days and ignore malformed entries', () => {
  const today = '2026-09-28';
  assert.deepEqual(entriesInRange(entries, '7days', { today }).map(e => e.date), ['2026-09-28', '2026-09-27', '2026-09-22']);
  assert.equal(entriesInRange(entries, '30days', { today }).length, 4);
  assert.equal(entriesInRange(entries, 'alltime', { today }).length, 5);
  assert.deepEqual(entriesInRange(entries, 'custom', { today, start: '2026-09-27', end: '2026-09-21' }).map(e => e.date),
    ['2026-09-27', '2026-09-22', '2026-09-21']);
  assert.equal(entriesInRange(entries, 'custom', { today, start: '2026-09-27' }).length, 2);
});

test('day keys are local and display at noon so they never slip a day', () => {
  assert.equal(localDateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(moodEntryDate('2026-01-05').getDate(), 5);
});
