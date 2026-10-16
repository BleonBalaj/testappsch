import test from 'node:test';
import assert from 'node:assert/strict';
import { groupHistoryEvents } from './historySessions.js';
const event = (id, minute, action = 'update', extra = {}) => ({ eventId: id, at: new Date(Date.UTC(2026, 9, 16, 8, minute)), actorUid: 'a', shareToken: 's', action, plan: { lessonUnit: id }, ...extra });
test('thirty autosaves become one session with a combined field list and a true before/after baseline', () => {
  const rows = Array.from({ length: 30 }, (_, i) => event(String(30 - i), 30 - i, 'update', { plan: { lessonUnit: `Unit ${30 - i}`, homework: i < 15 ? 'New' : 'Old' } }));
  rows.push(event('first-share', 0, 'share', { plan: { lessonUnit: 'Before', homework: 'Old' } }));
  const groups = groupHistoryEvents(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].events.length, 30);
  assert.deepEqual(groups[0].changes.map(change => change.field), ['lessonUnit', 'homework']);
  assert.equal(groups[0].changes[0].before, 'Before');
  assert.equal(groups[0].changes[0].after, 'Unit 30');
  assert.equal(groups[0].changes[0].steps.length, 30);
});
test('sessions stop at thirty minutes, another actor, review actions, and a new sharing lifecycle', () => {
  assert.equal(groupHistoryEvents([event('a', 59), event('b', 40), event('c', 20)]).length, 2);
  assert.equal(groupHistoryEvents([event('a', 10), event('b', 9, 'update', { actorUid: 'b' })]).length, 2);
  assert.equal(groupHistoryEvents([event('a', 10), event('b', 9, 'update', { shareToken: 'other' })]).length, 2);
  const actions = ['update', 'review', 'update', 'unshare', 'reshare', 'auto_reopen'];
  assert.equal(groupHistoryEvents(actions.map((action, i) => event(String(i), 20 - i, action))).length, actions.length);
});
test('reverted changes remain visible and pagination marks an unfinished session without duplicating it', () => {
  const rows = [event('a', 3, 'update', { plan: { homework: 'A' } }), event('b', 2, 'update', { plan: { homework: 'B' } }), event('c', 1, 'share', { plan: { homework: 'A' } })];
  const [group] = groupHistoryEvents(rows);
  assert.equal(group.changes.length, 1);
  assert.equal(group.changes[0].before, 'A'); assert.equal(group.changes[0].after, 'A');
  assert.equal(group.changes[0].steps.length, 2);
  assert.equal(groupHistoryEvents(rows, { count: 1 })[0].partial, true);
  assert.equal(groupHistoryEvents(rows, { count: 2 })[0].partial, false);
});
