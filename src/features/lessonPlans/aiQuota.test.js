import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonAiQuotaRefreshDelay, lessonAiQuotaExhausted } from './aiQuota.js';

test('quota reset timing follows the server even when the device clock is wrong', () => {
  const quota = { serverTime: '2026-10-15T21:59:00.000Z', resetsAt: '2026-10-15T22:00:00.000Z' };
  for (const now of [0, Date.parse('2030-01-01')]) assert.equal(lessonAiQuotaRefreshDelay(quota, now), 60100);
  assert.equal(lessonAiQuotaRefreshDelay({ ...quota, serverTime: '2026-10-15T22:00:02.000Z' }), 1000);
  assert.equal(lessonAiQuotaRefreshDelay(null), null);
  assert.equal(lessonAiQuotaRefreshDelay({ ...quota, remaining: 0, reserved: 1 }), 15000);
});

test('a fresh daily allowance enables generation after an exhausted previous day', () => {
  assert.equal(lessonAiQuotaExhausted({ limit: 50, used: 50, remaining: 0 }), true);
  assert.equal(lessonAiQuotaExhausted({ limit: 50, used: 0, remaining: 50 }), false);
  assert.equal(lessonAiQuotaExhausted({ limit: 50, used: 49, reserved: 1, remaining: 0 }), true);
  assert.equal(lessonAiQuotaExhausted(null), false);
});
