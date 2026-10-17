import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryReader } from './historyReader.js';
import { groupHistoryEvents } from './historySessions.js';
import { filterHistoryGroups, HISTORY_FILTER_DEFAULTS } from './historyFilters.js';
import {emptyReadReady} from '../liveResource.js';

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
  return { reader, docs, calls, get state() { return state; }, get closed() { return closed; }, emit: docs => next(docs), deny: () => fail(Object.assign(new Error('permission-denied'),{code:'permission-denied'})), offline: value => { rejectPage = value; } };
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
  assert.equal(f.state.pageError.message, 'offline'); assert.equal(f.state.loadingMore, false); assert.equal(f.state.rows.length, 3);
  f.offline(false); await f.reader.loadMore();
  assert.equal(f.state.pageError, null); assert.equal(f.state.rows.length, 5);
  assert.equal(f.calls[1].after, f.calls[2].after);
});

test('denied live access clears retained history and stops further pagination', async () => {
  const f = fixture(); await f.reader.start(); f.deny();
  assert.equal(f.state.error.code, 'permission-denied'); assert.deepEqual(f.state.rows, []);
  await f.reader.loadMore(); assert.equal(f.calls.length, 1);
});

test('disposing during the initial request prevents stale plan data and subscription setup', async () => {
  let finish, updates = 0, subscriptions = 0;
  const reader = createHistoryReader({ read: () => new Promise(resolve => { finish = resolve; }), listen: () => { subscriptions += 1; return () => {}; } }, () => { updates += 1; });
  const pending = reader.start(); reader.dispose(); finish([doc('old-plan', 1)]); await pending;
  assert.equal(updates, 0); assert.equal(subscriptions, 0);
});

test('return visits retain all verified pages and cursor while a fresh listener catches intervening edits',async()=>{
 const f=fixture();await f.reader.start();await f.reader.loadMore();f.reader.pause();
 assert.equal(f.reader.snapshot().rows.length,5);assert.equal(f.reader.snapshot().refreshing,true);
 await f.reader.start();assert.equal(f.calls.length,2);assert.equal(f.reader.snapshot().loading,false);
 f.emit({docs:[],cached:true});assert.equal(f.reader.snapshot().rows.length,5);assert.equal(f.reader.snapshot().refreshing,true);
 f.emit({docs:[doc('while-closed',12),...f.docs.slice(0,3)]});assert.equal(f.reader.snapshot().rows[0].eventId,'while-closed');assert.equal(f.reader.snapshot().refreshing,false);
 await f.reader.loadMore();assert.equal(f.calls.at(-1).after,'e4');f.reader.dispose();
});
test('verified empty history remains pending on reopening until a server snapshot arrives',async()=>{
 let next,reads=0;const reader=createHistoryReader({read:async()=>{reads++;return[];},listen:(_anchor,receive)=>{next=receive;return()=>{};}});
 await reader.start();assert.equal(emptyReadReady(reader.snapshot()),true);reader.pause();await reader.start();
 assert.equal(reads,1);assert.equal(emptyReadReady(reader.snapshot()),false);
 next({docs:[],cached:true});assert.equal(emptyReadReady(reader.snapshot()),false);
 next({docs:[],pending:true});assert.equal(emptyReadReady(reader.snapshot()),false);
 next({docs:[]});assert.equal(emptyReadReady(reader.snapshot()),true);reader.dispose();
});
test('closing during pagination cancels the old response; reopening retries that cursor safely',async()=>{
 let resolve,next;const docs=[doc('3',3),doc('2',2),doc('1',1)];let count=0;
 const reader=createHistoryReader({read:async()=>++count===1?docs:new Promise(done=>{resolve=done;}),listen:(_anchor,receive)=>{next=receive;return()=>{};}},undefined,{pageSize:2});
 await reader.start();const pending=reader.loadMore();reader.pause();resolve([doc('late',0)]);await pending;
 assert.equal(reader.snapshot().rows.length,3);await reader.start();next({docs});assert.equal(reader.snapshot().loadingMore,false);reader.dispose();
});
test('access revocation during pagination clears history and rejects a late successful response',async()=>{
 let resolve,deny;const reader=createHistoryReader({read:async({after})=>after?new Promise(done=>{resolve=done;}):[doc('3',3),doc('2',2),doc('1',1)],listen:(_anchor,_next,error)=>{deny=error;return()=>{};}},undefined,{pageSize:2});
 await reader.start();const pending=reader.loadMore();deny({code:'permission-denied'});resolve([doc('late',0)]);await pending;
 assert.deepEqual(reader.snapshot().rows,[]);assert.equal(reader.snapshot().hasLoaded,false);reader.dispose();
});
test('transient live failure keeps verified history and retry reconnects without reloading pages',async()=>{
 const f=fixture();await f.reader.start();const rows=f.reader.snapshot().rows;
 f.deny();assert.equal(f.reader.snapshot().rows.length,0);f.reader.dispose();
 let next,fail,reads=0;const reader=createHistoryReader({read:async()=>{reads++;return[doc('1',1)];},listen:(_anchor,receive,error)=>{next=receive;fail=error;return()=>{};}});
 await reader.start();fail({code:'unavailable'});assert.equal(reader.snapshot().rows.length,1);assert.equal(emptyReadReady(reader.snapshot()),false);
 reader.refresh();assert.equal(reads,1);next({docs:[doc('2',2)]});assert.equal(reader.snapshot().rows.length,2);assert.ok(rows.length);reader.dispose();
});
test('retained history is bounded when closed and pagination resumes at the last retained cursor',async()=>{
 const f=fixture();await f.reader.start();await f.reader.loadMore();await f.reader.loadMore();
 // Use the same adapter with a small bound to exercise cursor restoration.
 const calls=[];const reader=createHistoryReader({read:async({after,limit})=>{calls.push(after?.id);return f.docs.slice(after?f.docs.findIndex(d=>d.id===after.id)+1:0).slice(0,limit);},listen:()=>()=>{}},undefined,{pageSize:2,maxCachedRows:4});
 await reader.start();await reader.loadMore();await reader.loadMore();reader.pause();assert.equal(reader.snapshot().rows.length,5);
 await reader.start();await reader.loadMore();assert.equal(calls.at(-1),'e4');assert.equal(reader.snapshot().rows.length,7);reader.dispose();f.reader.dispose();
});
