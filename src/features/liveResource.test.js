import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveResource,compareReadValues,emptyReadReady,trimInactiveStores,verifiedSnapshot} from './liveResource.js';
function fixture(){const listeners=[];const store=createLiveResource({empty:{rows:[]},listen:(next,error)=>{const item={next,error,stopped:false};listeners.push(item);return()=>{item.stopped=true;};}});return{store,listeners};}
test('first render and empty disk snapshots stay loading until the server confirms empty',()=>{
 const f=fixture();assert.equal(f.store.snapshot().loading,true);const off=f.store.subscribe(()=>{});
 f.listeners[0].next({data:{rows:[]},cached:true});assert.equal(f.store.snapshot().loading,true);assert.equal(emptyReadReady(f.store.snapshot()),false);
 f.listeners[0].next({data:{rows:[]},cached:false});assert.equal(emptyReadReady(f.store.snapshot()),true);off();
});
test('reopening restores verified rows immediately, marks refresh, ignores disk rollback and accepts server deletion',()=>{
 const f=fixture();let off=f.store.subscribe(()=>{});f.listeners[0].next({data:{rows:[{id:'a'}]}});off();off=f.store.subscribe(()=>{});
 assert.deepEqual(f.store.snapshot().rows,[{id:'a'}]);assert.equal(f.store.snapshot().refreshing,true);assert.equal(f.store.snapshot().loading,false);
 f.listeners[1].next({data:{rows:[]},cached:true});assert.equal(f.store.snapshot().rows.length,1);
 f.listeners[1].next({data:{rows:[]}});assert.equal(emptyReadReady(f.store.snapshot()),true);assert.equal(f.store.snapshot().rows.length,0);off();
});
test('cached empty results are pending during revalidation, not an asserted empty state',()=>{
 const f=fixture();const off=f.store.subscribe(()=>{});f.listeners[0].next({data:{rows:[]}});off();const again=f.store.subscribe(()=>{});
 assert.equal(emptyReadReady(f.store.snapshot()),false);f.listeners[1].next({data:{rows:[{id:'new'}]}});assert.equal(f.store.snapshot().rows.length,1);again();
});
test('transient errors keep verified rows; access errors clear them and late callbacks cannot resurrect them',()=>{
 const f=fixture();const off=f.store.subscribe(()=>{});f.listeners[0].next({data:{rows:[{id:'a'}]}});f.listeners[0].error({code:'unavailable'});
 assert.equal(f.store.snapshot().rows.length,1);assert.equal(emptyReadReady(f.store.snapshot()),false);f.store.refresh();
 f.listeners[1].error({code:'permission-denied'});assert.deepEqual(f.store.snapshot().rows,[]);assert.equal(f.store.snapshot().hasLoaded,false);
 f.listeners[1].next({data:{rows:[{id:'a'}]}});assert.deepEqual(f.store.snapshot().rows,[]);off();
});
test('scope disposal and unsubscribe invalidate callbacks while a new subscriber gets an independent lifecycle',()=>{
 const f=fixture();let off=f.store.subscribe(()=>{});off();f.listeners[0].next({data:{rows:[{id:'late'}]}});assert.deepEqual(f.store.snapshot().rows,[]);
 off=f.store.subscribe(()=>{});f.store.dispose();f.listeners[1].next({data:{rows:[{id:'stale-account'}]}});assert.deepEqual(f.store.snapshot().rows,[]);off();
});
test('cache eviction protects active stores and metadata verification excludes optimistic writes',()=>{
 const active=fixture(),old=fixture(),map=new Map([['old',old.store],['active',active.store]]);const off=active.store.subscribe(()=>{});trimInactiveStores(map,1);
 assert.equal(map.has('active'),true);assert.equal(map.has('old'),false);off();
 assert.equal(verifiedSnapshot({metadata:{fromCache:true}}),false);assert.equal(verifiedSnapshot({metadata:{fromCache:false,hasPendingWrites:true}}),false);assert.equal(verifiedSnapshot({metadata:{fromCache:false,hasPendingWrites:false}}),true);
});
test('timestamp ordering retains nanoseconds and does not collapse distinct cursor values',()=>{
 assert.equal(compareReadValues({seconds:1,nanoseconds:9},{seconds:1,nanoseconds:8}),1);
 assert.equal(compareReadValues({seconds:2,nanoseconds:0},{seconds:1,nanoseconds:999999999}),1);
 assert.equal(compareReadValues('z','a'),1);
});
test('synchronous subscription failures become retryable errors instead of escaping render',()=>{
 let fails=true;const store=createLiveResource({empty:{value:null},listen:next=>{if(fails)throw new Error('offline');next({data:{value:{id:'ok'}}});return()=>{};}});
 const off=store.subscribe(()=>{});assert.equal(store.snapshot().error.message,'offline');assert.equal(store.snapshot().loading,false);
 fails=false;store.refresh();assert.equal(store.snapshot().value.id,'ok');assert.equal(store.snapshot().error,null);off();
});
