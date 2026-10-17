import test,{before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment,assertFails,assertSucceeds } from '@firebase/rules-unit-testing';
import { doc,getDoc,getDocs,collection,query,where,setDoc,updateDoc,deleteDoc,orderBy,Timestamp } from 'firebase/firestore';
import { executeSchoolWorkflow } from '../../functions/schoolWorkflows.js';
import { processReviewEvent } from '../../functions/reviewActivity.js';
import { groupHistoryEvents } from '../../src/features/lessonPlans/historySessions.js';
import { hasUnreadActivity } from '../../src/features/lessonPlans/activity.js';
import { studentSearchFields } from '../../functions/studentSearch.js';
import { writeOwnedLessonPlan,setPlanShared,reviewSharedPlan } from '../../src/features/lessonPlans/sharingStore.js';
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore,FieldValue}=require('firebase-admin/firestore');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Workflow integration tests require the Firestore emulator.');
const projectId='demo-testappsch-workflows';let env,app,adminDb;
const identities=Object.fromEntries(['admin','admin2','teacher','teacher2','sub','student','foreign'].map(uid=>[uid,{uid,email:`${uid}@school.test`,name:uid}]));
const as=uid=>env.authenticatedContext(uid,{email:identities[uid].email}).firestore();
const ref=(db,path)=>doc(db,`schools/s1/${path}`);
const stored=async path=>(await adminDb.doc(`schools/s1/${path}`).get()).data();
const run=(uid,action,fields={},commandId=randomUUID())=>executeSchoolWorkflow(adminDb,{auth:{uid},data:{schoolId:'s1',action,commandId,...fields}},identities[uid],()=>FieldValue.serverTimestamp());
const rejectKey=(promise,key)=>assert.rejects(promise,error=>error.key===key);
const supply={type:'supply',title:'Chairs for 10A',classGroupId:'g1',priority:'normal',items:[{id:'chairs',name:'Chairs',needed:4,provided:0}]};
before(async()=>{const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');env=await initializeTestEnvironment({projectId,firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});app=initializeApp({projectId},'workflow-tests');adminDb=getFirestore(app);});
after(async()=>{await adminDb?.terminate();await deleteApp(app);await env?.cleanup();});
beforeEach(async()=>{
 await env.clearFirestore();const batch=adminDb.batch();
 batch.set(adminDb.doc('schools/s1'),{creatorUid:'admin',rolePermissions:{student:{'school-requests':true,coverage:true}}});
 batch.set(adminDb.doc('schools/s2'),{creatorUid:'foreign'});
 for(const [uid,role]of[['admin','admin'],['admin2','admin'],['teacher','teacher'],['teacher2','teacher'],['sub','teacher'],['student','student']]){
  batch.set(adminDb.doc(`schools/s1/members/${uid}`),{uid,role,status:'active',name:uid});
  if(role!=='student')batch.set(adminDb.doc(`schools/s1/staff/${uid}`),{id:uid,name:uid,email:identities[uid].email});
 }
 batch.set(adminDb.doc('schools/s2/members/foreign'),{uid:'foreign',role:'admin',status:'active'});
 batch.set(adminDb.doc('schools/s1/classGroups/g1'),{label:'10A',homeroomTeacherId:'teacher',room:'204'});
 batch.set(adminDb.doc('schools/s1/classGroups/g2'),{label:'10B',homeroomTeacherId:'teacher2'});
 batch.set(adminDb.doc('schools/s1/classes/c1'),{name:'Math',teacherId:'teacher',classGroupId:'g1',classLabel:'10A',weeklySchedule:[{day:'Monday',time:'09:00–09:45'}]});
 await batch.commit();
});
test('students cannot read, list, create or mutate supply/repair requests even if settings or old participation allow it',async()=>{
 const {id}=await run('teacher','requestCreate',{input:supply});const student=as('student');
 await adminDb.doc(`schools/s1/schoolRequests/${id}`).update({participantUids:['teacher','student']});
 await adminDb.doc(`schools/s1/schoolRequests/${id}/photos/p`).set({type:'image/jpeg',base64:'private'});
 for(const path of [`schoolRequests/${id}`,`schoolRequests/${id}/photos/p`])await assertFails(getDoc(ref(student,path)));
 await assertFails(getDocs(query(collection(student,'schools/s1/schoolRequests'),where('participantUids','array-contains','student'))));
 await assertFails(getDocs(collection(student,`schools/s1/schoolRequests/${id}/events`)));
 for(const type of ['supply','repair'])await rejectKey(run('student','requestCreate',{input:{...supply,type}}),'access');
 await rejectKey(run('student','workflowDirectory',{module:'school-requests'}),'access');
 await rejectKey(run('student','requestComment',{recordId:id,expectedRevision:1,input:{note:'No'}}),'access');
 await assertFails(setDoc(ref(student,'schoolRequests/forged'),{...supply,createdByUid:'student'}));
 await assertFails(updateDoc(ref(student,`schoolRequests/${id}`),{status:'completed'}));
 await rejectKey(run('foreign','requestCreate',{input:supply}),'access');
});
test('requests enforce ownership, class links, quantities, repair resolution, history and idempotent retries',async()=>{
 const command=randomUUID(), created=await run('teacher','requestCreate',{input:supply},command);
 assert.deepEqual(await run('teacher','requestCreate',{input:supply},command),created);
 await rejectKey(run('teacher','requestCreate',{input:{...supply,title:'Different'}},command),'retryMismatch');
 await rejectKey(run('teacher','requestCreate',{input:{...supply,classGroupId:'g2'}}),'classAccess');
 await rejectKey(run('teacher','requestCreate',{input:{...supply,items:[{...supply.items[0],provided:1}]}}),'access');
 await assertSucceeds(getDoc(ref(as('teacher'),`schoolRequests/${created.id}`)));
 await assertFails(getDoc(ref(as('teacher2'),`schoolRequests/${created.id}`)));
 await assertFails(updateDoc(ref(as('admin'),`schoolRequests/${created.id}`),{status:'completed'}));
 await rejectKey(run('admin','requestArchive',{recordId:created.id,expectedRevision:1,input:{archived:true}}),'archive');
 await run('admin','requestUpdate',{recordId:created.id,expectedRevision:1,input:{...supply,assigneeUid:'sub',items:[{...supply.items[0],provided:2}]}});
 let record=await stored(`schoolRequests/${created.id}`);assert.equal(record.status,'partial');
 await assertSucceeds(getDoc(ref(as('sub'),`schoolRequests/${created.id}`)));
 await rejectKey(run('teacher','requestUpdate',{recordId:created.id,expectedRevision:2,input:supply}),'managed');
 await rejectKey(run('admin','requestUpdate',{recordId:created.id,expectedRevision:1,input:supply}),'changed');
 await rejectKey(run('admin','requestUpdate',{recordId:created.id,expectedRevision:2,input:{...supply,items:[{...supply.items[0],provided:5}]}}),'quantities');
 await run('admin','requestUpdate',{recordId:created.id,expectedRevision:2,input:{...supply,items:[{...supply.items[0],provided:4}]}});
 await run('admin','requestArchive',{recordId:created.id,expectedRevision:3,input:{archived:true}});
 record=await stored(`schoolRequests/${created.id}`);assert.equal(record.status,'completed');assert.equal(record.archived,true);
 assert.equal((await adminDb.collection(`schools/s1/schoolRequests/${created.id}/events`).get()).size,4);
 await assertFails(deleteDoc(ref(as('admin'),`schoolRequests/${created.id}/events/${command}`)));
 await rejectKey(run('admin','requestCreate',{input:{type:'repair',title:'Leak',status:'completed'}}),'resolution');
 const repaired=await run('admin','requestCreate',{input:{type:'repair',title:'Leak',status:'completed',resolution:'Pipe replaced'}});
 assert.equal((await stored(`schoolRequests/${repaired.id}`)).status,'completed');
});
test('concurrent request updates cannot silently overwrite each other',async()=>{
 const {id}=await run('teacher','requestCreate',{input:supply});
 const results=await Promise.allSettled(['First','Second'].map(title=>run('admin','requestUpdate',{recordId:id,expectedRevision:1,input:{...supply,title}})));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.key,'changed');
});
test('role changes revoke old request participation, absence notes and notifications',async()=>{
 const {id}=await run('teacher','requestCreate',{input:supply});
 await run('admin','absenceCreate',{input:{teacherUid:'teacher',from:'2020-01-06',to:'2020-01-06',reason:'Private reason'}});
 await adminDb.doc('schools/s1/members/teacher').update({role:'student'});
 await assertFails(getDoc(ref(as('teacher'),`schoolRequests/${id}`)));
 await assertFails(getDocs(query(collection(as('teacher'),'schools/s1/teacherAbsences'),where('teacherUid','==','teacher'))));
 await assertFails(getDocs(query(collection(as('teacher'),'schools/s1/workflowNotices'),where('recipientUids','array-contains','teacher'))));
 await rejectKey(run('teacher','requestComment',{recordId:id,expectedRevision:1,input:{note:'No'}}),'access');
});
test('feedback binds exact shared versions, preserves author content, and remains compatible with autosave, archive, unshare and reshare',async()=>{
 const plan={id:'p1',ownerUid:'teacher',teacherId:identities.teacher.email,teacherName:'Teacher',lessonUnit:'Sets',subject:'Math',date:'2026-10-19',updatedAt:'2026-10-16T12:00:00Z',status:'draft'};
 const teacher=as('teacher'),admin=as('admin');
 await writeOwnedLessonPlan(teacher,plan,'s1',identities.teacher);await setPlanShared(teacher,'s1','p1',identities.teacher,true);
 let share=await stored('lessonPlanShares/p1');
 const fields={planId:'p1',shareToken:share.shareToken,revisionId:share.revisionId,message:'Please explain the exercise.',outcome:'changes_requested'};
 await rejectKey(run('teacher2','feedbackReply',fields),'access');await rejectKey(run('student','feedbackReview',fields),'access');
 await rejectKey(run('admin','feedbackReview',{...fields,revisionId:'stale'}),'changed');
 await rejectKey(run('admin','feedbackReview',fields),'reviewerOnly');
 await run('admin','reviewAssign',{planId:'p1',shareToken:share.shareToken,revisionId:share.revisionId,reviewRevision:0});
 await run('admin','feedbackReview',fields);assert.deepEqual(await stored('lessonPlans/p1'),plan);
 await assertSucceeds(getDocs(collection(teacher,'schools/s1/lessonPlanFeedback/p1/messages')));
 await assertFails(setDoc(ref(teacher,'lessonPlanFeedback/p1/messages/forged'),{message:'Forged'}));
 await assertFails(getDocs(collection(as('student'),'schools/s1/lessonPlanFeedback/p1/messages')));
 await run('teacher','feedbackReply',{...fields,message:'I will update it.'});
 const updated={...plan,lessonUnit:'Sets updated',updatedAt:'2026-10-16T12:05:00Z'};await writeOwnedLessonPlan(teacher,updated,'s1',identities.teacher);
 share=await stored('lessonPlanShares/p1');assert.notEqual((await stored('lessonPlanFeedback/p1')).revisionId,share.revisionId);
 const inbox=(await getDoc(ref(admin,'lessonPlanInbox/p1'))).data();await reviewSharedPlan(admin,'s1',inbox,identities.admin,'reviewing');await reviewSharedPlan(admin,'s1',inbox,identities.admin,'archived');
 await run('teacher','feedbackResubmit',{...fields,revisionId:share.revisionId,message:'Updated exercise.'});
 assert.equal((await stored('lessonPlanInbox/p1')).reviewStatus,'pending');
 assert.ok((await adminDb.collection('schools/s1/lessonPlanReviewHistory/p1/events').get()).docs.some(event=>event.data().action==='auto_reopen'));
 await setPlanShared(teacher,'s1','p1',identities.teacher,false);await rejectKey(run('admin','feedbackReview',{...fields,revisionId:share.revisionId}),'notShared');
 await assertSucceeds(getDocs(collection(teacher,'schools/s1/lessonPlanFeedback/p1/messages')));
 await setPlanShared(teacher,'s1','p1',identities.teacher,true);await writeOwnedLessonPlan(teacher,{...updated,topic:'New'},'s1',identities.teacher);
});
test('coverage derives actual dated lessons, checks conflicts and keeps private absence notes out of the timetable',async()=>{
 await rejectKey(run('teacher','absenceCreate',{input:{teacherUid:'teacher',from:'2020-01-06',to:'2020-01-06'}}),'access');
 const absence=await run('admin','absenceCreate',{input:{teacherUid:'teacher',from:'2020-01-06',to:'2020-01-06',reason:'Private medical note'}});
 assert.equal(absence.lessonCount,1);let cover=(await adminDb.collection('schools/s1/lessonCoverage').get()).docs[0].data();
 assert.equal(cover.reason,undefined);assert.equal(cover.startTime,'09:00');
 await assertSucceeds(getDoc(ref(as('student'),`lessonCoverage/${cover.id}`)));
 await assertFails(getDoc(ref(as('student'),`teacherAbsences/${absence.id}`)));
 await assertFails(getDoc(ref(as('sub'),`teacherAbsences/${absence.id}`)));
 const fields={absenceId:absence.id,recordId:cover.id,expectedRevision:1,input:{status:'assigned',substituteUid:'sub',startTime:'09:00',endTime:'09:45'}};
 await rejectKey(run('student','coverageUpdate',fields),'access');await rejectKey(run('teacher','coverageUpdate',fields),'access');
 await rejectKey(run('admin','coverageUpdate',{...fields,input:{...fields.input,substituteUid:'teacher'}}),'sameTeacher');
 await adminDb.doc('schools/s1/scheduleEntries/sub-slot').set({id:'sub-slot',day:'Monday',time:'09:30–10:15',teacherId:'sub',subject:'Other'});
 await rejectKey(run('admin','coverageUpdate',fields),'timetableConflict');
 await adminDb.doc('schools/s1/scheduleEntries/sub-slot').delete();
 await run('admin','coverageUpdate',fields);cover=await stored(`lessonCoverage/${cover.id}`);assert.equal(cover.status,'assigned');
 await assertSucceeds(getDocs(query(collection(as('sub'),'schools/s1/lessonCoverage'),where('participantUids','array-contains','sub'),orderBy('date','asc'))));
 await run('admin','coverageUpdate',{...fields,expectedRevision:2,input:{...fields.input,status:'covered'}});
 await run('admin','absenceCancel',{absenceId:absence.id,expectedRevision:1,input:{note:'Returned'}});
 assert.equal((await stored(`lessonCoverage/${cover.id}`)).status,'covered');
});
test('concurrent cover assignments cannot double-book one substitute; cancelling absence restores weekly lessons',async()=>{
 await adminDb.doc('schools/s1/classes/c2').set({name:'Science',teacherId:'teacher2',classGroupId:'g2',weeklySchedule:[{day:'Monday',time:'09:00–09:45'}]});
 const a=await run('admin','absenceCreate',{input:{teacherUid:'teacher',from:'2020-01-06',to:'2020-01-06'}}),b=await run('admin','absenceCreate',{input:{teacherUid:'teacher2',from:'2020-01-06',to:'2020-01-06'}});
 const covers=(await adminDb.collection('schools/s1/lessonCoverage').get()).docs.map(doc=>doc.data());
 const results=await Promise.allSettled(covers.map(cover=>run('admin','coverageUpdate',{absenceId:cover.absenceId,recordId:cover.id,expectedRevision:1,input:{status:'assigned',substituteUid:'sub',startTime:'09:00',endTime:'09:45'}})));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.key,'coverConflict');
 for(const absence of[a,b])await run('admin','absenceCancel',{absenceId:absence.id,expectedRevision:1,input:{note:'Returned'}});
 for(const cover of covers){const record=await stored(`lessonCoverage/${cover.id}`);assert.equal(record.restoredWeekly,true);assert.equal(record.substituteUid,'');}
});
test('substitute plan reads require active assignment and current sharing; notifications permit only own read markers',async()=>{
 const plan={id:'p1',ownerUid:'teacher',teacherId:identities.teacher.email,lessonUnit:'Sets',subject:'Math',status:'draft',date:'2020-01-06',updatedAt:'2026-10-16T12:00:00Z'};
 await writeOwnedLessonPlan(as('teacher'),plan,'s1',identities.teacher);await setPlanShared(as('teacher'),'s1','p1',identities.teacher,true);
 const absence=await run('admin','absenceCreate',{input:{teacherUid:'teacher',from:'2020-01-06',to:'2020-01-06'}}),cover=(await adminDb.collection('schools/s1/lessonCoverage').get()).docs[0].data();
 await run('admin','coverageUpdate',{absenceId:absence.id,recordId:cover.id,expectedRevision:1,input:{status:'assigned',substituteUid:'sub',startTime:'09:00',endTime:'09:45',planId:'p1'}});
 assert.equal((await run('sub','coveragePlan',{recordId:cover.id})).plan.lessonUnit,'Sets');
 await rejectKey(run('teacher2','coveragePlan',{recordId:cover.id}),'access');await rejectKey(run('student','coveragePlan',{recordId:cover.id}),'access');
 await assertFails(updateDoc(ref(as('sub'),'lessonPlans/p1'),{lessonUnit:'No edit'}));
 await setPlanShared(as('teacher'),'s1','p1',identities.teacher,false);await rejectKey(run('sub','coveragePlan',{recordId:cover.id}),'planUnavailable');
 const notices=await getDocs(query(collection(as('sub'),'schools/s1/workflowNotices'),where('recipientUids','array-contains','sub')));assert.ok(notices.size);
 const notice=notices.docs[0].ref;await assertSucceeds(updateDoc(notice,{'readBy.sub':true}));
 await assertFails(updateDoc(notice,{'readBy.teacher':true}));await assertFails(updateDoc(notice,{title:'Forged'}));
 await assertFails(getDoc(ref(as('student'),`workflowNotices/${notice.id}`)));
});

async function sharedReview() {
 const plan={id:'p1',ownerUid:'teacher',teacherId:identities.teacher.email,teacherName:'Teacher',lessonUnit:'Sets',subject:'Math',date:'2026-10-19',updatedAt:'2026-10-16T12:00:00Z',status:'draft'};
 await writeOwnedLessonPlan(as('teacher'),plan,'s1',identities.teacher);await setPlanShared(as('teacher'),'s1','p1',identities.teacher,true);
 const share=await stored('lessonPlanShares/p1');return {plan,fields:{planId:'p1',shareToken:share.shareToken,revisionId:share.revisionId,reviewRevision:0}};
}
async function deliverEvents() {
 const events=(await adminDb.collection('schools/s1/lessonPlanReviewHistory/p1/events').orderBy('at').get()).docs;
 for(const event of events)await processReviewEvent(adminDb,'s1','p1',event.id,event.data());
 return events;
}
test('only one admin can claim a plan; other admins cannot review it without an explicit audited takeover',async()=>{
 const {fields}=await sharedReview();
 await rejectKey(run('admin','reviewStatus',{...fields,reviewStatus:'reviewing'}),'reviewerOnly');
 await rejectKey(run('teacher','reviewAssign',fields),'access');await rejectKey(run('student','reviewAssign',fields),'access');
 const contenders=await Promise.allSettled(['admin','admin2'].map(uid=>run(uid,'reviewAssign',fields)));
 assert.equal(contenders.filter(result=>result.status==='fulfilled').length,1);
 const review=await stored('lessonPlanReviews/p1'),winner=review.reviewerUid,other=winner==='admin'?'admin2':'admin';
 assert.equal(review.revision,1);assert.equal(contenders.find(result=>result.status==='rejected').reason.key,'reviewChanged');
 await rejectKey(run(other,'reviewStatus',{...fields,reviewRevision:1,reviewStatus:'reviewing'}),'reviewerOnly');
 await rejectKey(run(other,'feedbackReview',{...fields,message:'No',outcome:'reviewed'}),'reviewerOnly');
 await rejectKey(run(other,'reviewAssign',{...fields,reviewRevision:1}),'reviewAssigned');
 await rejectKey(run(other,'reviewAssign',{...fields,reviewRevision:1,takeover:true,note:''}),'invalid');
 await run(other,'reviewAssign',{...fields,reviewRevision:1,takeover:true,note:'Covering the review during leave.'});
 assert.equal((await stored('lessonPlanReviews/p1')).reviewerUid,other);
 const event=(await adminDb.collection('schools/s1/lessonPlanReviewHistory/p1/events').where('action','==','reviewer_reassign').get()).docs[0].data();
 assert.equal(event.actorUid,other);assert.equal(event.previousReviewerUid,winner);assert.equal(event.reviewer.uid,other);assert.ok(event.note);
 await assertFails(updateDoc(ref(as(winner),'lessonPlanReviews/p1'),{reviewerUid:winner}));
});

test('plain comments preserve review status, allow author-first conversations and keep exact named history and unread notices',async()=>{
 const {plan,fields}=await sharedReview();
 const first=randomUUID();
 await run('teacher','feedbackComment',{...fields,message:'Please check the activity.'},first);
 await run('teacher','feedbackComment',{...fields,message:'Please check the activity.'},first);
 assert.equal((await adminDb.collection('schools/s1/lessonPlanFeedback/p1/messages').get()).size,1);
 assert.equal((await stored('lessonPlanInbox/p1')).reviewStatus,'pending');
 await rejectKey(run('admin','feedbackComment',{...fields,message:'Before assignment'}),'reviewerOnly');
 await rejectKey(run('teacher2','feedbackComment',{...fields,message:'Unrelated teacher'}),'access');
 await rejectKey(run('student','feedbackComment',{...fields,message:'Student'}),'access');
 await rejectKey(run('foreign','feedbackComment',{...fields,message:'Other school'}),'access');
 await run('admin','reviewAssign',fields);
 await run('admin','feedbackComment',{...fields,message:'Thanks, I will look.'});
 assert.equal((await stored('lessonPlanInbox/p1')).reviewStatus,'pending');
 await rejectKey(run('admin2','feedbackComment',{...fields,message:'Not the reviewer'}),'reviewerOnly');
 await rejectKey(run('teacher','feedbackComment',{...fields,message:' ' }),'invalid');
 await rejectKey(run('teacher','feedbackComment',{...fields,revisionId:'old',message:'A stale version'}),'changed');
 await run('admin','reviewStatus',{...fields,reviewRevision:1,reviewStatus:'reviewing'});
 await run('admin','reviewStatus',{...fields,reviewRevision:2,reviewStatus:'archived'});
 const command=randomUUID();
 await run('admin','feedbackComment',{...fields,message:'Archived review, still a normal comment.'},command);
 assert.equal((await stored('lessonPlanInbox/p1')).reviewStatus,'archived');
 assert.equal((await stored('lessonPlanReviews/p1')).reviewStatus,'archived');
 assert.deepEqual(await stored('lessonPlans/p1'),plan);
 const audit=await stored('lessonPlanReviewHistory/p1/events/'+command);
 assert.equal(audit.action,'comment');assert.equal(audit.actorName,'admin');assert.equal(audit.feedback.message,'Archived review, still a normal comment.');assert.deepEqual(audit.plan,plan);
 await deliverEvents();
 const author=await stored('lessonPlanActivity/teacher/plans/p1');assert.equal(hasUnreadActivity(author,'history'),true);assert.equal(hasUnreadActivity(author,'feedback'),true);
 const notice=(await adminDb.collection('schools/s1/workflowNotices').where('eventId','==',command).get()).docs[0].data();assert.equal(notice.kind,'plan_feedback');assert.ok(notice.recipientUids.includes('teacher'));
 const authorCommand=randomUUID();await run('teacher','feedbackComment',{...fields,message:'Thank you.'},authorCommand);await deliverEvents();
 const reply=(await adminDb.collection('schools/s1/workflowNotices').where('eventId','==',authorCommand).get()).docs[0].data();assert.equal(reply.kind,'plan_reply');assert.ok(reply.recipientUids.includes('admin'));
 await setPlanShared(as('teacher'),'s1','p1',identities.teacher,false);
 await rejectKey(run('teacher','feedbackComment',{...fields,message:'After unsharing'}),'notShared');
 await assertSucceeds(getDoc(ref(as('teacher'),'lessonPlanFeedback/p1/messages/'+command)));
});
test('review completion archives only the admin review; a completed review cannot be started again without restoring it',async()=>{
 const {plan,fields}=await sharedReview();await run('admin','reviewAssign',fields);
 await rejectKey(run('admin','reviewStatus',{...fields,reviewRevision:1,reviewStatus:'archived'}),'reviewTransition');
 await run('admin','feedbackReview',{...fields,message:'Reviewed and complete.',outcome:'reviewed'});
 assert.equal((await stored('lessonPlanInbox/p1')).reviewStatus,'archived');assert.deepEqual(await stored('lessonPlans/p1'),plan);
 await rejectKey(run('admin','reviewStatus',{...fields,reviewRevision:1,reviewStatus:'reviewing'}),'reviewTransition');
 await rejectKey(run('admin','feedbackReview',{...fields,message:'Again',outcome:'reviewed'}),'reviewArchived');
 await run('admin','reviewStatus',{...fields,reviewRevision:1,reviewStatus:'pending'});
 assert.equal((await stored('lessonPlanReviews/p1')).reviewerUid,'admin');
 await run('admin','reviewRelease',{...fields,reviewRevision:2});assert.equal((await stored('lessonPlanReviews/p1')).reviewerUid,'');
});
test('feedback and author replies appear as distinct named entries with their exact text in both users’ history',async()=>{
 const {fields}=await sharedReview();await run('admin','reviewAssign',fields);
 await run('admin','feedbackReview',{...fields,message:'Please add a worked example.',outcome:'changes_requested'});
 await run('teacher','feedbackReply',{...fields,message:'Added the example in the saved plan.'});
 for(const uid of ['teacher','admin']){
  const events=await getDocs(query(collection(as(uid),'schools/s1/lessonPlanReviewHistory/p1/events'),orderBy('at','desc')));
  const groups=groupHistoryEvents(events.docs.map(doc=>({...doc.data(),eventId:doc.id})));
  const feedback=groups.find(group=>group.latest.action==='feedback').latest,reply=groups.find(group=>group.latest.action==='reply').latest;
  assert.equal(feedback.actorName,'admin');assert.equal(feedback.feedback.message,'Please add a worked example.');
  assert.equal(reply.actorName,'teacher');assert.equal(reply.feedback.message,'Added the example in the saved plan.');
 }
});
test('durable activity delivery is idempotent and sends feedback and reply notifications to author and assigned reviewer',async()=>{
 const {fields}=await sharedReview();await run('admin','reviewAssign',fields);
 await run('admin','feedbackReview',{...fields,message:'Please clarify the task.',outcome:'changes_requested'});
 let events=await deliverEvents(),teacherActivity=await stored('lessonPlanActivity/teacher/plans/p1');
 assert.equal(hasUnreadActivity(teacherActivity,'history'),true);assert.equal(hasUnreadActivity(teacherActivity,'feedback'),true);
 const firstCount=(await adminDb.collection('schools/s1/workflowNotices').get()).size;await deliverEvents();assert.equal((await adminDb.collection('schools/s1/workflowNotices').get()).size,firstCount);
 const feedbackNotice=(await adminDb.collection('schools/s1/workflowNotices').where('kind','==','plan_feedback').get()).docs[0].data();assert.ok(feedbackNotice.recipientUids.includes('teacher'));assert.equal(feedbackNotice.actorName,'admin');
 await run('teacher','feedbackReply',{...fields,message:'I have clarified it.'});events=await deliverEvents();
 const adminActivity=await stored('lessonPlanActivity/admin/plans/p1');assert.equal(hasUnreadActivity(adminActivity,'feedback'),true);
 const replyNotice=(await adminDb.collection('schools/s1/workflowNotices').where('kind','==','plan_reply').get()).docs[0].data();assert.ok(replyNotice.recipientUids.includes('admin'));assert.ok(!replyNotice.recipientUids.includes('teacher'));
 const latest=await stored('lessonPlanActivity/teacher/plans/p1');const feedbackEvent=events.find(event=>event.data().action==='feedback');assert.equal(latest.feedbackEventId,feedbackEvent.id);
});
test('read acknowledgements are per user and per stream, bounded to visible event cursors, and cannot hide newer updates',async()=>{
 const {fields}=await sharedReview();await run('admin','reviewAssign',fields);await run('admin','feedbackReview',{...fields,message:'First feedback',outcome:'feedback_provided'});await deliverEvents();
 const target=ref(as('teacher'),'lessonPlanActivity/teacher/plans/p1'),activity=(await getDoc(target)).data();
 await assertSucceeds(updateDoc(target,{seenhistoryAt:activity.historyAt,seenhistoryEventId:activity.historyEventId}));
 let state=(await getDoc(target)).data();assert.equal(hasUnreadActivity(state,'history'),false);assert.equal(hasUnreadActivity(state,'feedback'),true);
 await assertFails(updateDoc(ref(as('admin'),'lessonPlanActivity/teacher/plans/p1'),{seenfeedbackAt:activity.feedbackAt,seenfeedbackEventId:activity.feedbackEventId}));
 await assertFails(updateDoc(target,{historyEventId:'forged'}));
 const future=Timestamp.fromMillis(activity.feedbackAt.toMillis()+10000);
 await assertFails(updateDoc(target,{seenfeedbackAt:future,seenfeedbackEventId:'future'}));
 await assertFails(getDocs(collection(as('student'),'schools/s1/lessonPlanActivity/teacher/plans')));
 await run('admin','feedbackReview',{...fields,message:'Second feedback',outcome:'feedback_provided'});await deliverEvents();
 await assertSucceeds(updateDoc(target,{seenfeedbackAt:activity.feedbackAt,seenfeedbackEventId:activity.feedbackEventId}));state=(await getDoc(target)).data();assert.equal(hasUnreadActivity(state,'feedback'),true);
});
test('bootstrap repairs missing feedback audit mirrors and initializes only the current user’s unread state',async()=>{
 const {fields}=await sharedReview();await run('admin','reviewAssign',fields);const command=randomUUID();
 await run('admin','feedbackReview',{...fields,message:'Recover this feedback in history.',outcome:'feedback_provided'},command);
 await adminDb.doc(`schools/s1/lessonPlanReviewHistory/p1/events/${command}`).delete();
 await run('teacher','reviewBootstrap');const repaired=await stored(`lessonPlanReviewHistory/p1/events/${command}`);
 assert.equal(repaired.feedback.message,'Recover this feedback in history.');assert.equal(repaired.actorUid,'admin');assert.equal(repaired.backfilled,true);
 const activity=await stored('lessonPlanActivity/teacher/plans/p1');assert.equal(hasUnreadActivity(activity,'feedback'),true);
 assert.equal(await stored('lessonPlanActivity/admin2/plans/p1'),undefined);
 await run('teacher2','reviewBootstrap');assert.equal(await stored('lessonPlanActivity/teacher2/plans/p1'),undefined);
});

test('request search covers matches beyond 800 source records, applies every filter before pagination, and preserves staff-only scope',async()=>{
 const Stamp=require('firebase-admin/firestore').Timestamp,at=Stamp.fromMillis(123456);
 for(let offset=0;offset<900;offset+=300){const batch=adminDb.batch();for(let i=offset;i<offset+300;i++)batch.set(adminDb.doc(`schools/s1/schoolRequests/r${String(i).padStart(4,'0')}`),{
  title:i===0?'Needle përfundim':'Other item',type:i%2?'repair':'supply',status:i===0?'completed':'needed',archived:i===0,classGroupId:i===0?'g1':'g2',participantUids:i===0?['teacher']:['teacher2'],items:[],updatedAt:at,
 });await batch.commit();}
 const search=(uid,filters,cursor=null)=>run(uid,'workflowSearch',{module:'school-requests',kind:'requests',filters,cursor});
 const first=await search('admin',{status:'all',search:'needle perfundim'});assert.equal(first.rows.length,0);assert.equal(first.more,true);assert.equal(first.scanned,800);
 const last=await search('admin',{status:'all',search:'needle perfundim'},first.cursor);assert.deepEqual(last.rows.map(row=>row.id),['r0000']);assert.equal(last.more,false);
 const combined=await search('admin',{classId:'g1',type:'supply',status:'archived',search:'needle'});assert.deepEqual(combined.rows.map(row=>row.id),['r0000']);
 assert.equal((await search('admin',{classId:'g1',type:'repair',status:'archived'})).rows.length,0);
 assert.equal((await search('admin',{status:'active',search:'needle'})).rows.length,0);
 assert.deepEqual((await search('teacher',{status:'all',search:'needle'})).rows.map(row=>row.id),['r0000']);
 assert.equal((await search('teacher2',{status:'all',search:'needle'})).rows.length,0);
 await rejectKey(search('student',{status:'all'}),'access');await rejectKey(search('foreign',{status:'all'}),'access');
 await rejectKey(run('teacher','workflowSearch',{module:'school-requests',kind:'absences',filters:{}}),'invalid');
});

test('filtered request pages use timestamp plus ID cursors without duplicates at identical timestamps',async()=>{
 const at=require('firebase-admin/firestore').Timestamp.fromMillis(1000),batch=adminDb.batch();
 for(let i=0;i<97;i++)batch.set(adminDb.doc(`schools/s1/schoolRequests/r${String(i).padStart(3,'0')}`),{title:'Desk',type:'repair',status:'needed',archived:false,participantUids:['teacher'],items:[],updatedAt:at});await batch.commit();
 const search=cursor=>run('teacher','workflowSearch',{module:'school-requests',kind:'requests',filters:{type:'repair',status:'needed'},cursor});
 const first=await search(null),second=await search(first.cursors[39]),third=await search(second.cursors[39]);
 const all=[...first.rows.slice(0,40),...second.rows.slice(0,40),...third.rows];assert.equal(all.length,97);assert.equal(new Set(all.map(row=>row.id)).size,97);assert.equal(third.more,false);
});

test('coverage search finds older matches and date-overlapping absences across the full authorized period',async()=>{
 const batch=adminDb.batch();for(let i=0;i<95;i++)batch.set(adminDb.doc(`schools/s1/lessonCoverage/c${String(i).padStart(3,'0')}`),{date:'2026-10-16',status:i===94?'covered':'needs_cover',subject:i===94?'Needle algebra':'Other',participantUids:['teacher'],teacherUid:'teacher'});
 batch.set(adminDb.doc('schools/s1/teacherAbsences/a1'),{teacherUid:'teacher',teacherName:'Teacher',from:'2026-10-01',to:'2026-10-20',status:'active'});await batch.commit();
 const filters={from:'2026-10-16',to:'2026-10-16',status:'covered',search:'needle algebra'};
 const result=await run('teacher','workflowSearch',{module:'coverage',kind:'lessons',filters});assert.deepEqual(result.rows.map(row=>row.id),['c094']);
 assert.equal((await run('teacher2','workflowSearch',{module:'coverage',kind:'lessons',filters})).rows.length,0);
 const absences=await run('teacher','workflowSearch',{module:'coverage',kind:'absences',filters:{from:'2026-10-16',to:'2026-10-16',status:'active'}});assert.deepEqual(absences.rows.map(row=>row.id),['a1']);
 await rejectKey(run('student','workflowSearch',{module:'coverage',kind:'lessons',filters}),'access');
});

test('student search combines all terms and filters before paging, including matches beyond a scan batch',async()=>{
 for(let offset=0;offset<900;offset+=300){const batch=adminDb.batch();for(let i=offset;i<offset+300;i++){
  const name=i===899?'Common Unique':'Common Person '+String(i).padStart(3,'0'),record={name,status:i===899?'archived':'active',classGroupId:'g1',assignedClasses:i===899?['c1']:[],...studentSearchFields({name})};
  batch.set(adminDb.doc('schools/s1/students/s'+String(i).padStart(4,'0')),record);
 }await batch.commit();}
 const search=(uid,filters,cursor=null)=>run(uid,'workflowSearch',{module:'students',kind:'students',filters,cursor});
 const first=await search('teacher',{search:'common uni',status:'archived',classId:'g1'});assert.equal(first.rows.length,0);assert.equal(first.more,true);
 const last=await search('teacher',{search:'common uni',status:'archived',classId:'g1'},first.cursor);assert.deepEqual(last.rows.map(row=>row.id),['s0899']);assert.equal(last.more,false);
 let course=await search('admin',{search:'unique',status:'all',courseId:'c1'});const courseRows=[...course.rows];while(course.more){course=await search('admin',{search:'unique',status:'all',courseId:'c1'},course.cursor);courseRows.push(...course.rows);}assert.deepEqual(courseRows.map(row=>row.id),['s0899']);
 let student=await search('student',{search:'common unique',status:'all'});const studentRows=[...student.rows];while(student.more){student=await search('student',{search:'common unique',status:'all'},student.cursor);studentRows.push(...student.rows);}assert.deepEqual(studentRows.map(row=>row.id),['s0899']);
 await rejectKey(search('foreign',{search:'common'}),'access');
 await adminDb.doc('schools/s1').update({'rolePermissions.student':{students:false,classes:false,messages:false,leaderboard:false}});
 await rejectKey(search('student',{search:'common'}),'access');
});
