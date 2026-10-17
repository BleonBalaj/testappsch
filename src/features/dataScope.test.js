import test from 'node:test';
import assert from 'node:assert/strict';
import { createResponseGate, dataScope, scopedUpdate } from './dataScope.js';
test('scope identity contains account, tenant and role without delimiter collisions',()=>{
 assert.notEqual(dataScope('a|b','c'),dataScope('a','b|c'));
 assert.notEqual(dataScope('a','school','admin'),dataScope('b','school','admin'));
});
test('late generations cannot publish after a replacement or disposal',()=>{
 const gate=createResponseGate(),first=gate.begin(),second=gate.begin();assert.equal(first(),false);assert.equal(second(),true);gate.cancel();assert.equal(second(),false);
});
test('functional updates never reuse the previous account data',()=>{
 const next=scopedUpdate({scope:'alice',value:{private:'Alice'}},'bob',{},old=>({...old,name:'Bob'}));assert.deepEqual(next,{scope:'bob',value:{name:'Bob'}});
});
