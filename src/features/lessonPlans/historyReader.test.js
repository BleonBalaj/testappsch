import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryReader } from './historyReader.js';
import { groupHistoryEvents } from './historySessions.js';
import { filterHistoryGroups, HISTORY_FILTER_DEFAULTS } from './historyFilters.js';

const doc = (id, minute) => ({ id, data: () => ({ at: new Date(Date.UTC(2026, 9, 16, 8, minute)), action: 'update', actorUid: 'a', shareToken: 's', reviewStatus: 'pending', plan: { lessonUnit: id } }) });
function fixture() {
  const docs = Array.from({ length: 7 }, (_, i) => doc(`e${7 - i}`, 7 - i));
  const calls = [];
  let state, next, fail, closed = false, rejectPage = false;
  const reader = createHistoryReader({
    read: async ({ after, limit }) => {
      calls.push({ after: after?.id, limit });
      if (rejectPage && after) throw new Error('offline');
      return docs.slice(after ? docs.findIndex(d => d.id === after.id) + 1 : 0).slice(0, limit);
    },
    listen: (anchor, receive, error) => {
      assert.equal(anchor.id, 'e5'); next = receive; fail = error;
      return () => { closed = true; };
    },
  }, value => { state = value; }, { pageSize: 2 });
  return { reader, docs, calls, get state() { return state; }, get closed() { return closed; }, emit: docs => next(docs), deny: () => fail(new Error('permission-denied')), offline: value => { rejectPage = value; } };
}

test('cursor pages retain one baseline record without duplicates, gaps or refetching previous pages', async () => {
  const f = fixture();
  await f.reader.start();
  assert.equal(f.state.rows.length, 3); assert.equal(f.state.hasMore, true);
  await Promise.all([f.reader.loadMore(), f.reader.loadMore()]);
  assert.equal(f.state.rows.length, 5);
  await f.reader.loadMore();
  assert.equal(f.state.rows.length, 7); assert.equal(f.state.hasMore, true);
  await f.reader.loadMore();
  assert.equal(f.state.hasMore, false); assert.equal(f.state.rows.length, 7);
  assert.deepEqual(f.calls.map(call => call.after), [undefined, 'e6', 'e4', 'e2']);
  assert.equal(new Set(f.state.rows.map(row => row.eventId)).size, 7);
  f.reader.dispose(); assert.equal(f.closed, true);
});

test('a burst of live events preserves the anchored older cursor and older records', async () => {
  const f = fixture(); await f.reader.start(); await f.reader.loadMore();
  f.emit([doc('live3', 10), doc('live2', 9), doc('live1', 8), ...f.docs.slice(0, 3)]);
  assert.equal(f.state.rows.length, 8);
  await f.reader.loadMore(); await f.reader.loadMore();
  assert.deepEqual(f.state.rows.map(row => row.eventId), ['live3', 'live2', 'live1', 'e7', 'e6', 'e5', 'e4', 'e3', 'e2', 'e1']);
});

test('searching older pages eventually finds records beyond the first page with the correct session baseline', async () => {
  const f = fixture(); await f.reader.start();
  const filters = { ...HISTORY_FILTER_DEFAULTS, search: 'e1' };
  const matches = () => filterHistoryGroups(groupHistoryEvents(f.state.rows, { count: f.state.rows.length - (f.state.hasMore ? 1 : 0) }), filters);
  assert.equal(matches().length, 0);
  while (f.state.hasMore) await f.reader.loadMore();
  assert.equal(matches().length, 1);
  assert.equal(matches()[0].events.length, 7);
});

test('failed older-page loads retain records and cursor, then retry without duplicates', async () => {
  const f = fixture(); await f.reader.start(); f.offline(true);
  await f.reader.loadMore();
  assert.equal(f.state.pageError, true); assert.equal(f.state.loadingMore, false); assert.equal(f.state.rows.length, 3);
  f.offline(false); await f.reader.loadMore();
  assert.equal(f.state.pageError, false); assert.equal(f.state.rows.length, 5);
  assert.equal(f.calls[1].after, f.calls[2].after);
});

test('denied live access clears retained history and stops further pagination', async () => {
  const f = fixture(); await f.reader.start(); f.deny();
  assert.equal(f.state.error, true); assert.deepEqual(f.state.rows, []);
  await f.reader.loadMore(); assert.equal(f.calls.length, 1);
});

test('disposing during the initial request prevents stale plan data and subscription setup', async () => {
  let finish, updates = 0, subscriptions = 0;
  const reader = createHistoryReader({ read: () => new Promise(resolve => { finish = resolve; }), listen: () => { subscriptions += 1; return () => {}; } }, () => { updates += 1; });
  const pending = reader.start(); reader.dispose(); finish([doc('old-plan', 1)]); await pending;
  assert.equal(updates, 0); assert.equal(subscriptions, 0);
});
