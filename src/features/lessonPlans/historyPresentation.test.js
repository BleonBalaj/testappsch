import test from 'node:test';
import assert from 'node:assert/strict';
import {historyEntryKind,historyHasPlanVersion,historyFieldLabel,historyFieldValue} from './historyPresentation.js';
test('history gives curriculum flags, classes and plan states readable localized labels and values',()=>{
 assert.equal(historyFieldLabel('classLabel','sq'),'Klasa');
 assert.equal(historyFieldLabel('areaManual','sq'),'Përzgjedhja e fushës kurrikulare');
 assert.equal(historyFieldValue(false,'areaManual','sq'),'Automatike');
 assert.equal(historyFieldValue(true,'stageManual','en'),'Chosen by the author');
 assert.equal(historyFieldValue('draft','status','sq'),'Draft');
 assert.equal(historyFieldValue([], 'lessonOutcomes','sq'),'—');
 assert.equal(historyFieldValue(['A','B'],'lessonOutcomes','en'),'A\nB');
 assert.equal(historyFieldValue('User-written text','homework','sq'),'User-written text');
});

test('review administration, comments and system actions never offer a plan version even when legacy events contain a snapshot',()=>{
 for(const action of ['review','reviewer_assign','reviewer_reassign','reviewer_release','comment','feedback','reply','auto_reopen','unshare'])assert.equal(historyHasPlanVersion({action,plan:{lessonUnit:'Snapshot'}}),false,action);
 for(const action of ['share','reshare','update','resubmit']){
  assert.equal(historyHasPlanVersion({action,plan:{lessonUnit:'Saved content'}}),true,action);
  assert.equal(historyHasPlanVersion({action}),false,action);
 }
 assert.equal(historyEntryKind('review'),'review');assert.equal(historyEntryKind('reviewer_assign'),'review');
 assert.equal(historyEntryKind('comment'),'comment');assert.equal(historyEntryKind('auto_reopen'),'system');assert.equal(historyEntryKind('update'),'plan');
});
