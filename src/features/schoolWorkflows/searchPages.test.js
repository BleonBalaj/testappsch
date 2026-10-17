import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchPages } from './searchPages.js';
const tick = () => new Promise(resolve => setTimeout(resolve,0));
const response = (ids, cursor, more) => ({ rows: ids.map(id=>({id})), cursors: ids.map(id=>id), cursor, more, scanned: 800 });
test('global search continues past empty source batches and paginates matches without skipping the lookahead', async () => {
  const calls=[];
  const store=createSearchPages({read:async args=>{calls.push(args);return !args.cursor?response([],800,true):args.cursor===800?response([801,802,803],803,true):response([803,804],804,false);},denied:()=>false},{size:2});
  const off=store.subscribe(()=>{});await tick();assert.deepEqual(store.snapshot().rows.map(row=>row.id),[801,802]);assert.equal(store.snapshot().more,true);
  await store.next();assert.equal(calls.at(-1).cursor,802);assert.deepEqual(store.snapshot().rows.map(row=>row.id),[803,804]);assert.equal(store.snapshot().more,false);off();
});
test('no matches is final only after the full scoped query is exhausted; remount retains verified results',async()=>{
  let count=0;const store=createSearchPages({read:async()=>++count===1?response([],800,true):response([],900,false),denied:()=>false});
  const off=store.subscribe(()=>{});await tick();assert.equal(count,2);assert.equal(store.snapshot().loading,false);assert.equal(store.snapshot().more,false);off();
  const again=store.subscribe(()=>{});assert.equal(store.snapshot().loading,false);assert.equal(store.snapshot().refreshing,true);again();
});
test('changing scope cancels a search continuation; access denial clears all retained results',async()=>{
  let resolve;const store=createSearchPages({read:()=>new Promise(done=>{resolve=done;}),denied:()=>true});const off=store.subscribe(()=>{});store.dispose();resolve(response([1],1,false));await tick();assert.deepEqual(store.snapshot().rows,[]);off();
  let fail=false;const cache=createSearchPages({read:async()=>{if(fail)throw new Error('access');return response([1],1,false);},denied:()=>true});const close=cache.subscribe(()=>{});await tick();fail=true;await cache.refresh();assert.deepEqual(cache.snapshot().rows,[]);close();
});

test('returning to a cached search resets to the first page without an empty loading flash',async()=>{
 const store=createSearchPages({read:async({cursor})=>cursor?response([3],3,false):response([1,2,3],3,true),denied:()=>false},{size:2});
 const off=store.subscribe(()=>{});await tick();await store.next();assert.equal(store.snapshot().page,1);off();
 const again=store.subscribe(()=>{});assert.equal(store.snapshot().page,0);assert.equal(store.snapshot().loading,false);assert.deepEqual(store.snapshot().rows.map(row=>row.id),[1,2]);await tick();again();
});
