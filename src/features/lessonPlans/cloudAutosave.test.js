import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonCloudAutosave } from './cloudAutosave.js';
import { setImmediate } from 'node:timers';

test('app update waits for every cloud edit, including one queued during an earlier write', async () => {
  const pending = [];
  const writes = [];
  const autosave = createLessonCloudAutosave({ delay: 60_000, onStatus() {}, write: plan => {
    writes.push(plan.text);
    return new Promise(resolve => pending.push(resolve));
  } });
  autosave.enqueue({ id: 'p1', text: 'first' }, 'school');
  let complete = false;
  const operation = autosave.flushAndWait().then(() => { complete = true; });
  autosave.enqueue({ id: 'p1', text: 'latest' }, 'school');
  assert.equal(complete, false);
  pending.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(writes, ['first', 'latest']);
  assert.equal(complete, false);
  pending.shift()();
  await operation;
  assert.equal(complete, true);
  assert.equal(autosave.hasUnconfirmed('school', 'p1'), false);
});

test('app update stops when a cloud save fails and retains the edit for retry', async () => {
  let fail = true;
  const autosave = createLessonCloudAutosave({ onStatus() {}, write: async () => { if (fail) throw new Error('offline'); } });
  autosave.enqueue({ id: 'p1', text: 'keep this' }, 'school');
  await assert.rejects(autosave.flushAndWait(), /offline/);
  assert.equal(autosave.hasUnconfirmed('school', 'p1'), true);
  fail = false;
  await autosave.flushAndWait();
  assert.equal(autosave.hasUnconfirmed('school', 'p1'), false);
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('cloud autosave sends the latest edit and reports saved only after acknowledgement', async () => {
  const writes = [];
  const states = [];
  let acknowledge;
  const autosave = createLessonCloudAutosave({
    write: (plan, schoolId) => {
      writes.push([plan.topic, schoolId]);
      return new Promise((resolve) => { acknowledge = resolve; });
    },
    onStatus: (_id, _school, state) => states.push(state),
    delay: 1000
  });
  autosave.enqueue({ id: 'p1', topic: 'first' }, 'school');
  autosave.enqueue({ id: 'p1', topic: 'latest' }, 'school');
  assert.deepEqual(writes, []);
  assert.equal(autosave.hasUnconfirmed('school', 'p1'), true);
  autosave.flush('school', 'p1');
  await tick();
  assert.deepEqual(writes, [['latest', 'school']]);
  assert.equal(states.includes('saved'), false);
  acknowledge();
  await tick();
  assert.equal(states.at(-1), 'saved');
  assert.equal(autosave.hasUnconfirmed('school', 'p1'), false);
});

test('cloud autosave keeps a failed edit for retry', async () => {
  let attempts = 0;
  const states = [];
  const autosave = createLessonCloudAutosave({
    write: async () => { if (++attempts === 1) throw new Error('offline'); },
    onStatus: (_id, _school, state) => states.push(state)
  });
  autosave.enqueue({ id: 'p1' }, 'school', true);
  await tick();
  assert.equal(states.at(-1), 'error');
  assert.equal(autosave.hasUnconfirmed('school', 'p1'), true);
  autosave.flush();
  await tick();
  assert.equal(states.at(-1), 'saved');
  assert.equal(attempts, 2);
});

test('cloud autosave serializes writes so an older acknowledgement cannot overwrite a newer edit', async () => {
  const writes = [];
  const resolutions = [];
  const autosave = createLessonCloudAutosave({
    write: (plan) => {
      writes.push(plan.topic);
      return new Promise((resolve) => resolutions.push(resolve));
    },
    onStatus: () => {}
  });
  autosave.enqueue({ id: 'p1', topic: 'older' }, 'school', true);
  await tick();
  autosave.enqueue({ id: 'p1', topic: 'newer' }, 'school', true);
  assert.deepEqual(writes, ['older']);
  resolutions[0]();
  await tick();
  assert.deepEqual(writes, ['older', 'newer']);
  resolutions[1]();
  await tick();
  assert.equal(autosave.hasUnconfirmed('school', 'p1'), false);
});
