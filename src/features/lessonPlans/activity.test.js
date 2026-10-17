import test from 'node:test';
import assert from 'node:assert/strict';
import {activityHead,activitySeen,compareCursors,hasUnreadActivity} from './activity.js';
test('history and comment read markers are independent and timestamp ties use event IDs',()=>{
 const at=new Date('2026-10-16T12:00Z'),state={historyAt:at,historyEventId:'b',feedbackAt:at,feedbackEventId:'a',seenhistoryAt:at,seenhistoryEventId:'a',seenfeedbackAt:at,seenfeedbackEventId:'a'};
 assert.equal(hasUnreadActivity(state,'history'),true);assert.equal(hasUnreadActivity(state,'feedback'),false);
 assert.equal(compareCursors(activityHead(state,'history'),activitySeen(state,'history')),1);
 assert.equal(hasUnreadActivity({...state,seenhistoryEventId:'b'},'history'),false);
});
test('acknowledging an older rendered event never clears newer history or feedback',()=>{
 const state={historyAt:new Date('2026-10-16T12:02Z'),historyEventId:'new',seenhistoryAt:new Date('2026-10-16T12:01Z'),seenhistoryEventId:'old'};
 assert.equal(hasUnreadActivity(state,'history'),true);assert.equal(hasUnreadActivity(null,'feedback'),false);
});
test('submillisecond event order outranks ID order',()=>{
 const at=n=>({toMillis:()=>1000,nanoseconds:n});
 assert.ok(compareCursors({at:at(200),id:'a'},{at:at(100),id:'z'})>0);
});
