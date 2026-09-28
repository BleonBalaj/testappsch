// Firestore security rules tests. Run against the emulator:
//   npm run test:rules
import test, { after, before, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, serverTimestamp, writeBatch,
} from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
let env;

// uids chosen so direct-message ids sort predictably: dm_<smaller>_<larger>.
const OWNER = 'owner';
const TEACHER = 'teacher1';
const STUDENT_A = 'studentA';
const STUDENT_B = 'studentB';
const OTHER_OWNER = 'otherOwner';
const PLATFORM = 'platformAdmin';
const DM_TEACHER_STUDENT = `dm_${[TEACHER, STUDENT_A].sort().join('_')}`;

const as = (uid, email = `${uid.toLowerCase()}@school.test`) => env.authenticatedContext(uid, { email }).firestore();
const asPlatformAdmin = () => as(PLATFORM, 'admin@bleon.com');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-testappsch',
    firestore: { rules: readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8'), host, port: Number(port) },
  });
});

after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const member = (school, uid, role) => setDoc(doc(db, 'schools', school, 'members', uid), { uid, role, status: 'active' });
    await setDoc(doc(db, 'schools/sch1'), { name: 'North', creatorUid: OWNER });
    await setDoc(doc(db, 'schools/sch2'), { name: 'South', creatorUid: OTHER_OWNER });
    await member('sch1', OWNER, 'admin');
    await member('sch1', TEACHER, 'teacher');
    await member('sch1', STUDENT_A, 'student');
    await member('sch1', STUDENT_B, 'student');
    await member('sch2', OTHER_OWNER, 'admin');
    await setDoc(doc(db, 'users', STUDENT_B), { uid: STUDENT_B, email: 'studentb@school.test', displayName: 'B', legacyField: true });
    await setDoc(doc(db, 'schools/sch1/conversations', DM_TEACHER_STUDENT), {
      id: DM_TEACHER_STUDENT, isGroup: false, memberIds: DM_TEACHER_STUDENT.slice(3).split('_'), lastMessage: 'hello',
    });
    await setDoc(doc(db, 'schools/sch1/conversations', DM_TEACHER_STUDENT, 'messages', 'm1'), {
      senderUid: TEACHER, text: 'hello', reactions: [],
    });
    await setDoc(doc(db, 'schools/sch1/conversations/grp_legacy'), { isGroup: true, members: [{ id: TEACHER }, { id: STUDENT_A }] });
    await setDoc(doc(db, 'schools/sch1/conversations', `dm_${[OWNER, STUDENT_B].sort().join('_')}`), { isGroup: false, lastMessage: 'old' });
    await setDoc(doc(db, 'schools/sch1/moodEntries', `${STUDENT_B}_2026-09-27`), { userId: STUDENT_B, mood: 'happy' });
    await setDoc(doc(db, 'pendingInvitations/x'), { email: 'studenta@school.test' });
    await setDoc(doc(db, 'platformMaintenance/conversationMemberIndex'), { completedAt: 1 });
  });
});

// ── users/{uid} profiles ────────────────────────────────────────────────
test('a user can create their own complete profile', async () => {
  await assertSucceeds(setDoc(doc(as(STUDENT_A), 'users', STUDENT_A), {
    uid: STUDENT_A, email: 'studenta@school.test', displayName: 'A', name: 'A',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
});

test('name and photo updates keep working, including on profiles with legacy fields', async () => {
  await assertSucceeds(setDoc(doc(as(STUDENT_A), 'users', STUDENT_A), { displayName: 'New', updatedAt: serverTimestamp() }, { merge: true }));
  await assertSucceeds(setDoc(doc(as(STUDENT_B), 'users', STUDENT_B), { photoURL: 'data:image/png;base64,AAAA', updatedAt: serverTimestamp() }, { merge: true }));
  await assertSucceeds(setDoc(doc(as(STUDENT_B), 'users', STUDENT_B), { photoURL: null, updatedAt: serverTimestamp() }, { merge: true }));
});

test('profiles cannot carry privilege fields, spoofed emails, or foreign uids', async () => {
  const db = as(STUDENT_A);
  await assertFails(setDoc(doc(db, 'users', STUDENT_A), { uid: STUDENT_A, role: 'admin' }));
  await assertFails(setDoc(doc(db, 'users', STUDENT_A), { uid: STUDENT_A, email: 'admin@bleon.com' }));
  await assertFails(setDoc(doc(db, 'users', STUDENT_A), { uid: 'someoneElse' }));
  await assertFails(setDoc(doc(db, 'users', STUDENT_A), { createdAt: new Date('2020-01-01') }));
  await assertFails(setDoc(doc(as(STUDENT_B), 'users', STUDENT_B), { isPlatformAdmin: true }, { merge: true }));
});

test('createdAt can be filled in once but never rewritten', async () => {
  const db = as(STUDENT_B);
  await assertSucceeds(setDoc(doc(db, 'users', STUDENT_B), { createdAt: serverTimestamp() }, { merge: true }));
  await assertFails(setDoc(doc(db, 'users', STUDENT_B), { createdAt: serverTimestamp() }, { merge: true }));
});

test('sign-up and the sign-in profile check converge in either order', async () => {
  const db = as(STUDENT_A);
  const ref = doc(db, 'users', STUDENT_A);
  // Sign-up writes names first; the profile check then adds uid and createdAt.
  await assertSucceeds(setDoc(ref, { email: 'studenta@school.test', displayName: 'Ana', name: 'Ana', updatedAt: serverTimestamp() }, { merge: true }));
  await assertSucceeds(setDoc(ref, { uid: STUDENT_A, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
  // Or the check lands first and sign-up only renames afterwards.
  await assertSucceeds(setDoc(ref, { displayName: 'Ana B', name: 'Ana B', updatedAt: serverTimestamp() }, { merge: true }));
  await assertFails(setDoc(ref, { uid: STUDENT_B }, { merge: true }));
});

test('profiles are private, including from the platform admin email', async () => {
  await assertFails(getDoc(doc(as(STUDENT_A), 'users', STUDENT_B)));
  await assertFails(getDoc(doc(asPlatformAdmin(), 'users', STUDENT_B)));
  await assertFails(setDoc(doc(as(STUDENT_A), 'users', STUDENT_B), { displayName: 'x' }, { merge: true }));
  await assertSucceeds(getDoc(doc(as(STUDENT_B), 'users', STUDENT_B)));
});

// ── conversations & messages ────────────────────────────────────────────
test('members list only their own conversations; wider reads are denied', async () => {
  const teacher = as(TEACHER);
  const mine = await assertSucceeds(getDocs(query(collection(teacher, 'schools/sch1/conversations'), where('memberIds', 'array-contains', TEACHER))));
  if (mine.size !== 1) throw new Error(`expected 1 conversation, got ${mine.size}`);
  await assertFails(getDocs(collection(teacher, 'schools/sch1/conversations')));
  await assertFails(getDoc(doc(as(STUDENT_B), 'schools/sch1/conversations', DM_TEACHER_STUDENT)));
  await assertFails(getDocs(collection(as(STUDENT_B), `schools/sch1/conversations/${DM_TEACHER_STUDENT}/messages`)));
  await assertFails(getDoc(doc(asPlatformAdmin(), 'schools/sch1/conversations', DM_TEACHER_STUDENT)));
  await assertSucceeds(getDocs(collection(as(STUDENT_A), `schools/sch1/conversations/${DM_TEACHER_STUDENT}/messages`)));
});

test('a first message creates its direct conversation in one batch', async () => {
  const db = as(STUDENT_A);
  const id = `dm_${[STUDENT_A, STUDENT_B].sort().join('_')}`;
  const batch = writeBatch(db);
  batch.set(doc(db, 'schools/sch1/conversations', id), { id, memberIds: id.slice(3).split('_'), lastMessage: 'hi' }, { merge: true });
  batch.set(doc(db, 'schools/sch1/conversations', id, 'messages', 'm1'), { senderUid: STUDENT_A, text: 'hi', reactions: [] });
  await assertSucceeds(batch.commit());
});

test('nobody can open a DM for others or with a member list that does not match the id', async () => {
  const db = as(STUDENT_A);
  const others = `dm_${[TEACHER, STUDENT_B].sort().join('_')}`;
  await assertFails(setDoc(doc(db, 'schools/sch1/conversations', others), { memberIds: others.slice(3).split('_') }));
  const mine = `dm_${[STUDENT_A, STUDENT_B].sort().join('_')}`;
  await assertFails(setDoc(doc(db, 'schools/sch1/conversations', mine), { memberIds: [STUDENT_A, TEACHER] }));
  await assertFails(setDoc(doc(db, 'schools/sch1/conversations', mine), { lastMessage: 'no members' }));
});

test('groups need the creator as a member; a creator-only group is allowed', async () => {
  const teacher = as(TEACHER);
  await assertSucceeds(setDoc(doc(teacher, 'schools/sch1/conversations/grp_1'), { isGroup: true, memberIds: [TEACHER, STUDENT_A, STUDENT_B] }));
  await assertSucceeds(setDoc(doc(teacher, 'schools/sch1/conversations/grp_2'), { isGroup: true, memberIds: [TEACHER] }));
  await assertFails(setDoc(doc(teacher, 'schools/sch1/conversations/grp_3'), { isGroup: true, memberIds: [STUDENT_A, STUDENT_B] }));
});

test('members can update a conversation but not change who is in it', async () => {
  const student = as(STUDENT_A);
  const ref = doc(student, 'schools/sch1/conversations', DM_TEACHER_STUDENT);
  await assertSucceeds(updateDoc(ref, { pinnedMessage: 'Read chapter 2', starred: true }));
  await assertFails(updateDoc(ref, { memberIds: [STUDENT_A, STUDENT_B] }));
  await assertFails(updateDoc(doc(as(STUDENT_B), 'schools/sch1/conversations', DM_TEACHER_STUDENT), { starred: true }));
  await assertFails(deleteDoc(ref));
});

test('a legacy DM can be indexed by a participant, never by an outsider', async () => {
  const id = `dm_${[OWNER, STUDENT_B].sort().join('_')}`;
  const memberIds = id.slice(3).split('_');
  await assertFails(setDoc(doc(as(STUDENT_A), 'schools/sch1/conversations', id), { memberIds }, { merge: true }));
  await assertSucceeds(setDoc(doc(as(STUDENT_B), 'schools/sch1/conversations', id), { memberIds, lastMessage: 'new' }, { merge: true }));
  // Legacy groups are only indexed by the admin repair (server side).
  await assertFails(setDoc(doc(as(TEACHER), 'schools/sch1/conversations/grp_legacy'), { memberIds: [TEACHER, STUDENT_A] }, { merge: true }));
});

test('messages: sender identity, reactions only, and who may delete', async () => {
  const path = `schools/sch1/conversations/${DM_TEACHER_STUDENT}/messages`;
  await assertFails(setDoc(doc(as(STUDENT_A), path, 'spoof'), { senderUid: TEACHER, text: 'x' }));
  await assertSucceeds(setDoc(doc(as(STUDENT_A), path, 'm2'), { senderUid: STUDENT_A, text: 'mine', reactions: [] }));
  await assertSucceeds(updateDoc(doc(as(STUDENT_A), path, 'm1'), { reactions: ['👍'] }));
  await assertFails(updateDoc(doc(as(STUDENT_A), path, 'm1'), { text: 'edited' }));
  await assertFails(deleteDoc(doc(as(STUDENT_A), path, 'm1')));
  await assertSucceeds(deleteDoc(doc(as(STUDENT_A), path, 'm2')));
  await assertSucceeds(deleteDoc(doc(as(TEACHER), path, 'm1')));
});

// ── moods ───────────────────────────────────────────────────────────────
test('members write only their own mood entries; admins may read them', async () => {
  const student = as(STUDENT_A);
  await assertSucceeds(setDoc(doc(student, 'schools/sch1/moodEntries', `${STUDENT_A}_2026-09-28`), { userId: STUDENT_A, mood: 'calm' }, { merge: true }));
  await assertFails(setDoc(doc(student, 'schools/sch1/moodEntries', `${STUDENT_B}_2026-09-28`), { userId: STUDENT_B, mood: 'sad' }));
  await assertFails(setDoc(doc(student, 'schools/sch1/moodEntries', `${STUDENT_A}_2026-09-29`), { userId: STUDENT_B }));
  await assertFails(getDoc(doc(student, 'schools/sch1/moodEntries', `${STUDENT_B}_2026-09-27`)));
  await assertSucceeds(getDoc(doc(as(OWNER), 'schools/sch1/moodEntries', `${STUDENT_B}_2026-09-27`)));
});

// ── tenants, provisioning paths, server-only data ──────────────────────
test('schools stay isolated; the platform admin email has no client access', async () => {
  await assertFails(getDoc(doc(as(STUDENT_A), 'schools/sch2')));
  await assertFails(getDocs(collection(as(OWNER), 'schools/sch2/members')));
  await assertFails(getDoc(doc(asPlatformAdmin(), 'schools/sch1')));
  await assertFails(getDocs(collection(asPlatformAdmin(), 'schools')));
  await assertSucceeds(getDoc(doc(as(STUDENT_A), 'schools/sch1')));
});

test('account records still come only from the provisioning function', async () => {
  // Students and staff are created by the provisionSchoolUser callable (Admin SDK),
  // which bypasses rules; direct client creation stays blocked as before.
  await assertFails(setDoc(doc(as(TEACHER), 'schools/sch1/students/new1'), { name: 'x' }));
  await assertFails(setDoc(doc(as(OWNER), 'schools/sch1/staff/new2'), { name: 'x', roleId: 'teacher' }));
  await assertFails(setDoc(doc(as(TEACHER), 'schools/sch1/members/new3'), { role: 'student', status: 'active' }));
  await assertSucceeds(setDoc(doc(as(OWNER), 'schools/sch1/members/new4'), { role: 'teacher', status: 'active' }));
});

test('server-only collections are closed to every client', async () => {
  await assertFails(getDoc(doc(as(STUDENT_A), 'pendingInvitations/x')));
  await assertFails(getDoc(doc(asPlatformAdmin(), 'platformMaintenance/conversationMemberIndex')));
  await assertFails(setDoc(doc(asPlatformAdmin(), 'platformMaintenance/conversationMemberIndex'), { completedAt: 2 }));
});

// ── homeroom classes, student search fields, materials ─────────────────
const classGroup = (overrides = {}) => ({
  id: 'cg1', gradeLevel: 10, section: 'A', label: '10A', homeroomTeacherId: TEACHER, homeroomTeacherName: 'Teacher One',
  homeroomTeacherEmail: 'teacher1@school.test', room: '104', createdByUid: OWNER, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  ...overrides,
});

test('only school administrators create, edit and delete classes; every member reads them', async () => {
  const ref = db => doc(db, 'schools/sch1/classGroups/cg1');
  await assertFails(setDoc(ref(as(TEACHER)), classGroup({ createdByUid: TEACHER })));
  await assertFails(setDoc(ref(as(STUDENT_A)), classGroup({ createdByUid: STUDENT_A })));
  await assertSucceeds(setDoc(ref(as(OWNER)), classGroup()));
  await assertSucceeds(getDoc(ref(as(STUDENT_A))));
  await assertSucceeds(getDocs(collection(as(TEACHER), 'schools/sch1/classGroups')));
  await assertFails(getDoc(ref(as(OTHER_OWNER))));
  await assertSucceeds(updateDoc(ref(as(OWNER)), { section: 'B', label: '10B', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref(as(OWNER)), { createdByUid: TEACHER }));
  await assertFails(updateDoc(ref(as(TEACHER)), { room: '1' }));
  await assertFails(deleteDoc(ref(as(TEACHER))));
  await assertSucceeds(deleteDoc(ref(as(OWNER))));
});

test('class records are validated: grade 0-12, known fields, matching id and creator', async () => {
  const owner = as(OWNER);
  const ref = doc(owner, 'schools/sch1/classGroups/cg1');
  await assertFails(setDoc(ref, classGroup({ gradeLevel: 13 })));
  await assertFails(setDoc(ref, classGroup({ gradeLevel: '10' })));
  await assertFails(setDoc(ref, classGroup({ label: '' })));
  await assertFails(setDoc(ref, classGroup({ section: 'ABCDEFGHIJK' })));
  await assertFails(setDoc(ref, classGroup({ id: 'other' })));
  await assertFails(setDoc(ref, classGroup({ createdByUid: TEACHER })));
  await assertFails(setDoc(ref, classGroup({ schedule: 'Mon 9:00' })));
  const { homeroomTeacherId: _omit, ...withoutTeacher } = classGroup();
  await assertFails(setDoc(ref, withoutTeacher));
  await assertSucceeds(setDoc(ref, classGroup({ gradeLevel: 0, section: '', label: 'Përgatitore', room: '' })));
});

test('students may rename themselves with fresh search fields but nothing else', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'schools/sch1/students', STUDENT_A), { name: 'A', classGroupId: '', status: 'active' });
  });
  const ref = doc(as(STUDENT_A), 'schools/sch1/students', STUDENT_A);
  await assertSucceeds(setDoc(ref, { name: 'Ana', nameLower: 'ana', searchTokens: ['a', 'an', 'ana'] }, { merge: true }));
  await assertSucceeds(setDoc(ref, { name: 'Ana B' }, { merge: true }));
  await assertFails(setDoc(ref, { name: 'Ana', classGroupId: 'cg1' }, { merge: true }));
  await assertFails(setDoc(ref, { status: 'archived' }, { merge: true }));
  await assertFails(setDoc(ref, { name: 'Ana', searchTokens: 'ana' }, { merge: true }));
  await assertFails(setDoc(doc(as(STUDENT_B), 'schools/sch1/students', STUDENT_A), { name: 'Hacked' }, { merge: true }));
  await assertSucceeds(updateDoc(doc(as(TEACHER), 'schools/sch1/students', STUDENT_A), { classGroupId: 'cg1', grade: '10A' }));
});

test('material bookmarks are private to each person', async () => {
  await assertSucceeds(setDoc(doc(as(STUDENT_A), 'users', STUDENT_A, 'resourceBookmarks', 'sch1'), { resourceIds: ['r1'] }));
  await assertSucceeds(getDoc(doc(as(STUDENT_A), 'users', STUDENT_A, 'resourceBookmarks', 'sch1')));
  await assertFails(getDoc(doc(as(STUDENT_B), 'users', STUDENT_A, 'resourceBookmarks', 'sch1')));
  await assertFails(setDoc(doc(as(OWNER), 'users', STUDENT_A, 'resourceBookmarks', 'sch1'), { resourceIds: [] }));
});

test('shared materials and course materials accept web links only', async () => {
  const teacher = as(TEACHER);
  await assertSucceeds(setDoc(doc(teacher, 'schools/sch1/resources/r1'), { title: 'Guide', url: 'https://drive.google.com/file/1' }));
  await assertSucceeds(setDoc(doc(teacher, 'schools/sch1/resources/r2'), { title: 'Old', url: '' }));
  await assertSucceeds(setDoc(doc(teacher, 'schools/sch1/resources/r3'), { title: 'No link' }));
  await assertFails(setDoc(doc(teacher, 'schools/sch1/resources/r4'), { title: 'Bad', url: 'javascript:alert(1)' }));
  await assertFails(setDoc(doc(teacher, 'schools/sch1/resources/r5'), { title: 'Bad', url: 'data:text/html,hi' }));
  await assertSucceeds(deleteDoc(doc(teacher, 'schools/sch1/resources/r1')));
  await assertFails(setDoc(doc(as(STUDENT_A), 'schools/sch1/resources/r6'), { title: 'x', url: 'https://x.test' }));
  await assertSucceeds(setDoc(doc(teacher, 'schools/sch1/classes/c1/materials/m1'), { title: 'Slides', url: 'HTTPS://example.com/a.pdf' }));
  await assertFails(setDoc(doc(teacher, 'schools/sch1/classes/c1/materials/m2'), { title: 'Bad', url: 'javascript:void(0)' }));
  await assertSucceeds(setDoc(doc(teacher, 'schools/sch1/classes/c1/grades/g1'), { scores: {} }));
  await assertSucceeds(deleteDoc(doc(teacher, 'schools/sch1/classes/c1/materials/m1')));
});
