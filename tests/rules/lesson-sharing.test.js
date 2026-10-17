import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc, orderBy, limit, writeBatch, Timestamp } from 'firebase/firestore';
import { writeOwnedLessonPlan, setPlanShared, reviewSharedPlan } from '../../src/features/lessonPlans/sharingStore.js';
import { createCloudHistoryReader } from '../../src/features/lessonPlans/historyCloud.js';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
let env;
const teacher = { uid: 'teacher', email: 'teacher@school.test', name: 'Teacher' };
const admin = { uid: 'admin', email: 'admin@school.test', name: 'Administrator' };
const as = user => env.authenticatedContext(user.uid, { email: user.email }).firestore();
const ref = (db, kind, id = 'p1') => doc(db, 'schools', 's1', kind, id);
const plan = { id: 'p1', ownerUid: teacher.uid, teacherId: teacher.email, teacherName: 'Educator name', status: 'draft', date: '2026-10-16', subject: 'Matematikë', lessonUnit: 'Sets', topic: 'Elements', updatedAt: '2026-10-16T12:00:00Z' };
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-testappsch-sharing', firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') } }); });
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'schools/s1'), { creatorUid: admin.uid });
    for (const [uid, role] of [['teacher', 'teacher'], ['admin', 'admin'], ['student', 'student'], ['teacher2', 'teacher']]) await setDoc(doc(db, 'schools/s1/members', uid), { uid, role, status: 'active' });
    await setDoc(doc(db, 'schools/s2'), { creatorUid: 'foreign' });
    await setDoc(doc(db, 'schools/s2/members/foreign'), { uid: 'foreign', role: 'admin', status: 'active' });
  });
});
async function setupShared() {
  const db = as(teacher);
  await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'schools/s1/lessonPlanReviews/p1'),{ownerUid:'teacher',reviewerUid:'admin',reviewerName:'Administrator',reviewerEmail:'admin@school.test',revision:1}));
  await writeOwnedLessonPlan(db, plan, 's1', teacher);
  await setPlanShared(db, 's1', plan.id, teacher, true);
  return { db, adb: as(admin), record: (await getDoc(ref(as(admin), 'lessonPlanInbox'))).data() };
}

test('undated plans can be saved and shared, and clearing a selected date updates the inbox and preserves both immutable versions',async()=>{
 const db=as(teacher),adb=as(admin),undated={...plan,date:''};
 await assertSucceeds(writeOwnedLessonPlan(db,undated,'s1',teacher));
 await assertSucceeds(setPlanShared(db,'s1',plan.id,teacher,true));
 assert.equal((await getDoc(ref(adb,'lessonPlanInbox'))).data().lessonDate,'');
 await assertSucceeds(writeOwnedLessonPlan(db,{...plan,date:'2026-10-17'},'s1',teacher));
 assert.equal((await getDoc(ref(adb,'lessonPlanInbox'))).data().lessonDate,'2026-10-17');
 await assertSucceeds(writeOwnedLessonPlan(db,undated,'s1',teacher));
 assert.equal((await getDoc(ref(adb,'lessonPlanInbox'))).data().lessonDate,'');
 const versions=await getDocs(collection(db,'schools/s1/lessonPlanReviewHistory/p1/events'));
 assert.equal(versions.size,3);assert.equal(versions.docs.filter(row=>row.data().plan.date==='').length,2);
 assert.equal(versions.docs.filter(row=>row.data().plan.date==='2026-10-17').length,1);
});

test('author and admin history readers paginate equal timestamps accurately and receive new live events after loading older pages', { timeout: 15000 }, async () => {
  await setupShared();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore(), batch = writeBatch(db);
    for (let i = 0; i < 104; i++) batch.set(doc(db, `schools/s1/lessonPlanReviewHistory/p1/events/history-${String(i).padStart(3, '0')}`), {
      action: 'update', actorUid: teacher.uid, at: Timestamp.fromDate(new Date('2040-01-01T12:00:00Z')), plan,
    });
    await batch.commit();
  });
  for (const user of [teacher, admin]) {
    const db = as(user), events = collection(db, 'schools/s1/lessonPlanReviewHistory/p1/events');
    const expected = (await getDocs(query(events, orderBy('at', 'desc')))).docs.map(entry => entry.id);
    let state, resolveLive;
    const reader = createCloudHistoryReader(db, 's1', 'p1', value => {
      state = value;
      if (state.rows.some(row => row.eventId === `live-${user.uid}`)) resolveLive?.();
    });
    try {
      await reader.start();
      assert.equal(state.rows.length, 101); assert.equal(state.hasMore, true);
      await reader.loadMore();
      assert.equal(state.hasMore, false);
      assert.deepEqual(state.rows.map(row => row.eventId), expected);
      const received = new Promise(resolve => { resolveLive = resolve; });
      await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), `schools/s1/lessonPlanReviewHistory/p1/events/live-${user.uid}`), {
        action: 'review', actorUid: admin.uid, at: Timestamp.fromDate(new Date('2050-01-01T12:00:00Z')), plan,
      }));
      let timeout;
      try { await Promise.race([received, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('No live history update')), 5000); })]); }
      finally { clearTimeout(timeout); }
      assert.equal(state.rows.length, expected.length + 1);
      assert.equal(new Set(state.rows.map(row => row.eventId)).size, state.rows.length);
      // A closed drawer retains verified pages and reconnects to events that
      // arrived while it was closed, for both author and administrator.
      reader.pause();const retained=reader.snapshot().rows.length;
      assert.equal(reader.snapshot().refreshing,true);
      const closedId=`closed-${user.uid}`;
      await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),`schools/s1/lessonPlanReviewHistory/p1/events/${closedId}`),{
        action:'update',actorUid:teacher.uid,at:new Timestamp(2600000000,123456000),plan,
      }));
      const reopened=new Promise(resolve=>{resolveLive=()=>{if(state.rows.some(row=>row.eventId===closedId))resolve();};});
      await reader.start();assert.equal(reader.snapshot().loading,false);assert.equal(reader.snapshot().rows.length,retained);
      try{await Promise.race([reopened,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('No history update after reopening')),5000);})]);}
      finally{clearTimeout(timeout);}
      assert.equal(state.rows.length,retained+1);
      assert.equal(state.rows.find(row=>row.eventId===closedId).at.nanoseconds,123456000);
    } finally { reader.dispose(); }
  }
});

test('private ownership queries work; admins, students and other teachers cannot read or edit unshared plans', async () => {
  const db = as(teacher);
  await assertSucceeds(writeOwnedLessonPlan(db, plan, 's1', teacher));
  await assertSucceeds(getDocs(query(collection(db, 'schools/s1/lessonPlans'), where('ownerUid', '==', teacher.uid))));
  for (const account of [admin, { uid: 'student', email: 's@school.test' }, { uid: 'teacher2', email: 't2@school.test' }, { uid: 'foreign', email: 'f@school.test' }]) {
    const other = as(account);
    await assertFails(getDoc(ref(other, 'lessonPlans')));
    await assertFails(updateDoc(ref(other, 'lessonPlans'), { lessonUnit: 'Overwritten' }));
  }
  await assertFails(updateDoc(ref(db, 'lessonPlans'), { ownerUid: admin.uid }));
});
test('actual share transaction publishes an inbox item and immutable history; admin reads content but cannot change it', async () => {
  const { db, adb } = await setupShared();
  await assertSucceeds(getDoc(ref(adb, 'lessonPlans')));
  await assertSucceeds(getDocs(query(collection(adb, 'schools/s1/lessonPlanInbox'), where('reviewStatus', 'in', ['pending', 'reviewing']))));
  await assertSucceeds(getDocs(query(collection(db, 'schools/s1/lessonPlanShares'), where('ownerUid', '==', teacher.uid))));
  await assertSucceeds(getDocs(query(collection(db, 'schools/s1/lessonPlanReviewHistory'), where('ownerUid', '==', teacher.uid))));
  const events = await getDocs(query(collection(db, 'schools/s1/lessonPlanReviewHistory/p1/events'), orderBy('at', 'desc'), limit(31)));
  assert.equal(events.size, 1);
  assert.equal(events.docs[0].data().action, 'share');
  await assertFails(updateDoc(events.docs[0].ref, { actorUid: admin.uid }));
  await assertFails(deleteDoc(events.docs[0].ref));
  await assertFails(updateDoc(ref(adb, 'lessonPlans'), { lessonUnit: 'No' }));
  await assertFails(deleteDoc(ref(adb, 'lessonPlans')));
  await assertFails(updateDoc(ref(adb, 'lessonPlanInbox'), { subject: 'Forged metadata' }));
  await assertFails(updateDoc(ref(db, 'lessonPlanInbox'), { reviewStatus: 'archived' }));
});
test('archive, unshare, reshare automatically reopens the inbox and logs the user and system separately', async () => {
  const { db, adb, record } = await setupShared();
  await reviewSharedPlan(adb, 's1', record, admin, 'reviewing');
  await reviewSharedPlan(adb, 's1', record, admin, 'archived');
  assert.equal((await getDoc(ref(adb, 'lessonPlanInbox'))).data().reviewStatus, 'archived');
  assert.equal((await getDoc(ref(db, 'lessonPlans'))).data().status, 'draft');
  await setPlanShared(db, 's1', plan.id, teacher, false);
  assert.equal((await getDoc(ref(adb, 'lessonPlanInbox'))).exists(), false);
  await assertFails(getDoc(ref(adb, 'lessonPlans')));
  const before = await getDocs(collection(db, 'schools/s1/lessonPlanReviewHistory/p1/events'));
  assert.equal(before.size, 4);
  await setPlanShared(db, 's1', plan.id, teacher, true);
  const newRecord = (await getDoc(ref(adb, 'lessonPlanInbox'))).data();
  assert.equal(newRecord.reviewStatus, 'pending');
  assert.equal(newRecord.shareCycle, 2);
  assert.notEqual(newRecord.shareToken, record.shareToken);
  const events = (await getDocs(collection(db, 'schools/s1/lessonPlanReviewHistory/p1/events'))).docs.map(entry => entry.data());
  assert.equal(events.find(entry => entry.action === 'reshare').actorUid, teacher.uid);
  assert.equal(events.find(entry => entry.action === 'auto_reopen').actorUid, 'system');
  assert.equal(events.find(entry => entry.action === 'review').actorUid, admin.uid);
  await assert.rejects(reviewSharedPlan(adb, 's1', record, admin, 'archived'), /sharing.changed/);
});
test('editing a shared archived plan reopens review and records the exact new version; stale reviews cannot archive it', async () => {
  const { db, adb, record } = await setupShared();
  await reviewSharedPlan(adb, 's1', record, admin, 'reviewing');
  await reviewSharedPlan(adb, 's1', record, admin, 'archived');
  const changed = { ...plan, lessonUnit: 'Counting sets', updatedAt: '2026-10-16T12:30:00Z' };
  await writeOwnedLessonPlan(db, changed, 's1', teacher);
  assert.equal((await getDoc(ref(adb, 'lessonPlanInbox'))).data().reviewStatus, 'pending');
  const events = (await getDocs(collection(db, 'schools/s1/lessonPlanReviewHistory/p1/events'))).docs.map(entry => entry.data());
  assert.deepEqual(events.find(entry => entry.action === 'update').plan, changed);
  assert.equal(events.filter(entry => entry.action === 'auto_reopen').length, 1);
  await assert.rejects(reviewSharedPlan(adb, 's1', record, admin, 'archived'), /sharing.changed/);
  await assertFails(updateDoc(ref(db, 'lessonPlans'), { lessonUnit: 'Unaudited edit' }));
});
test('unsharing stops further edit logging, preserves history, and duplicate share clicks do not reset a review', async () => {
  const { db, adb, record } = await setupShared();
  await reviewSharedPlan(adb, 's1', record, admin, 'reviewing');
  await setPlanShared(db, 's1', plan.id, teacher, true);
  assert.equal((await getDoc(ref(adb, 'lessonPlanInbox'))).data().reviewStatus, 'reviewing');
  await setPlanShared(db, 's1', plan.id, teacher, false);
  await writeOwnedLessonPlan(db, { ...plan, lessonUnit: 'Private change' }, 's1', teacher);
  const events = await getDocs(collection(db, 'schools/s1/lessonPlanReviewHistory/p1/events'));
  assert.equal(events.size, 3);
  await assertSucceeds(getDocs(collection(adb, 'schools/s1/lessonPlanReviewHistory/p1/events')));
  for (const user of [{ uid: 'teacher2', email: 't2@school.test' }, { uid: 'foreign', email: 'f@school.test' }, { uid: 'student', email: 's@school.test' }]) await assertFails(getDocs(collection(as(user), 'schools/s1/lessonPlanReviewHistory/p1/events')));
});
test('admins can share their own plans and no role can forge an unaudited share', async () => {
  const adb = as(admin), ownPlan = { ...plan, ownerUid: admin.uid, teacherId: admin.email };
  await writeOwnedLessonPlan(adb, ownPlan, 's1', admin);
  await setPlanShared(adb, 's1', plan.id, admin, true);
  await assertSucceeds(getDoc(ref(adb, 'lessonPlanInbox')));
  await assertFails(deleteDoc(ref(adb, 'lessonPlanShares')));
  await assertFails(updateDoc(ref(adb, 'lessonPlanShares'), { shareCycle: 99 }));
});
test('a concurrent autosave and unshare never resurrect the admin inbox or lose the private edit', async () => {
  const { db, adb } = await setupShared();
  await Promise.all([
    writeOwnedLessonPlan(db, { ...plan, lessonUnit: 'Final edit', updatedAt: '2026-10-16T13:00:00Z' }, 's1', teacher),
    setPlanShared(db, 's1', plan.id, teacher, false),
  ]);
  assert.equal((await getDoc(ref(adb, 'lessonPlanInbox'))).exists(), false);
  assert.equal((await getDoc(ref(db, 'lessonPlanShares'))).exists(), false);
  assert.equal((await getDoc(ref(db, 'lessonPlans'))).data().lessonUnit, 'Final edit');
  await assertFails(getDoc(ref(adb, 'lessonPlans')));
});
test('an owner cannot erase history or another user reuse a deleted plan ID to take over its history', async () => {
  const { db } = await setupShared();
  await setPlanShared(db, 's1', plan.id, teacher, false);
  await assertFails(deleteDoc(ref(db, 'lessonPlanReviewHistory')));
  await deleteDoc(ref(db, 'lessonPlans'));
  const other = { uid: 'teacher2', email: 't2@school.test', name: 'Other' };
  await assertFails(writeOwnedLessonPlan(as(other), { ...plan, ownerUid: other.uid, teacherId: other.email }, 's1', other));
});
