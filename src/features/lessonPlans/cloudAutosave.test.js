import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonCloudAutosave } from './cloudAutosave.js';

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
