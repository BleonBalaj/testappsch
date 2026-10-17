import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { compareActivity } from './reviewActivity.js';
test('activity ordering preserves timestamp precision before deterministic event-ID ties',()=>{
 assert.ok(compareActivity({at:new Timestamp(1000,200),id:'a'},{at:new Timestamp(1000,100),id:'z'})>0);
 assert.ok(compareActivity({at:new Timestamp(1000,200),id:'b'},{at:new Timestamp(1000,200),id:'a'})>0);
});
