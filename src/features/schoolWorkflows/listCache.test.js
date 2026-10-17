import test from 'node:test';
import assert from 'node:assert/strict';
import {createPagedList} from './listCache.js';
const doc=n=>({id:String(n).padStart(3,'0'),data:()=>({rank:n})});
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(pages){const reads=[],listeners=[];const store=createPagedList({read:async args=>{reads.push(args);return pages.shift()||[];},listen:(bounds,next,error)=>{const item={bounds,next,error,stopped:false};listeners.push(item);return()=>{item.stopped=true;};},compare:(a,b)=>a.rank-b.rank,denied:error=>error.code==='permission-denied'},{pageSize:3});return{store,reads,listeners};}
test('verified pages survive navigation; remount revalidates without a full loader or another first-page fetch',async()=>{
 const f=fixture([[doc(1),doc(2),doc(3),doc(4)]]),off=f.store.subscribe(()=>{});await flush();assert.equal(f.reads.length,1);assert.equal(f.store.snapshot().loading,false);
 off();const again=f.store.subscribe(()=>{});assert.equal(f.store.snapshot().rows.length,4);assert.equal(f.store.snapshot().loading,false);assert.equal(f.reads.length,1);
 f.listeners.at(-1).next({docs:[doc(1)],cached:true});assert.equal(f.store.snapshot().rows.length,4);
 f.listeners.at(-1).next({docs:[doc(0),doc(1),doc(2),doc(3),doc(4)],cached:false});assert.equal(f.store.snapshot().rows[0].rank,0);again();
});
test('loading older rows uses the last cursor, deduplicates overlap and retains prior pages',async()=>{
 const f=fixture([[doc(1),doc(2),doc(3),doc(4)],[doc(4),doc(5)]]),off=f.store.subscribe(()=>{});await flush();await f.store.loadMore();
 assert.equal(f.reads[1].after.id,'003');assert.deepEqual(f.store.snapshot().rows.map(row=>row.rank),[1,2,3,4,5]);assert.equal(f.store.snapshot().more,false);off();
});
test('live complete queries include new tail records and switch back to pagination when the limit is reached',async()=>{
 const f=fixture([[doc(1)]]),off=f.store.subscribe(()=>{});await flush();const live=f.listeners.at(-1);assert.equal(live.bounds.limit,4);
 live.next({docs:[doc(1),doc(2),doc(3),doc(4)],cached:false});await flush();assert.equal(f.store.snapshot().more,true);assert.equal(f.listeners.at(-1).bounds.anchor.id,'004');assert.equal(f.listeners.at(-1).bounds.limit,null);off();
});
test('permission denial clears cached records and stops late callbacks from restoring them',async()=>{
 const f=fixture([[doc(1)]]),off=f.store.subscribe(()=>{});await flush();const previous=f.listeners.at(-1);previous.error({code:'permission-denied'});assert.deepEqual(f.store.snapshot().rows,[]);off();previous.next({docs:[doc(1)],cached:false});assert.deepEqual(f.store.snapshot().rows,[]);
});
test('disposed scopes cannot publish an outstanding request into the next account',async()=>{
 let resolve;const store=createPagedList({read:()=>new Promise(done=>{resolve=done;}),listen:()=>()=>{},compare:()=>0,denied:()=>false});const off=store.subscribe(()=>{});store.dispose();resolve([doc(1)]);await flush();assert.deepEqual(store.snapshot().rows,[]);off();
});
test('cached empty results never become a final empty state during return-visit refresh',async()=>{
 const f=fixture([[]]);let off=f.store.subscribe(()=>{});await flush();off();
 assert.equal(f.store.snapshot().refreshing,true);off=f.store.subscribe(()=>{});
 f.listeners.at(-1).next({docs:[],cached:true});assert.equal(f.store.snapshot().refreshing,true);
 f.listeners.at(-1).next({docs:[],pending:true});assert.equal(f.store.snapshot().refreshing,true);
 f.listeners.at(-1).next({docs:[doc(1)],cached:false});assert.equal(f.store.snapshot().rows.length,1);assert.equal(f.store.snapshot().refreshing,false);off();
});
test('an older-page response cannot revive a row deleted by the live listener while it was pending',async()=>{
 let resolve,next,count=0;const store=createPagedList({read:async()=>++count===1?[doc(1),doc(2),doc(3),doc(4)]:new Promise(done=>{resolve=done;}),listen:(_bounds,receive)=>{next=receive;return()=>{};},compare:(a,b)=>a.rank-b.rank,denied:()=>false},{pageSize:3});
 const off=store.subscribe(()=>{});await flush();const pending=store.loadMore();next({docs:[doc(1),doc(2),doc(3)]});resolve([doc(4),doc(5)]);await pending;
 assert.deepEqual(store.snapshot().rows.map(row=>row.rank),[1,2,3,5]);off();
});
