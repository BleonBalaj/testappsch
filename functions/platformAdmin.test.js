import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPlatformAdminEmail, assertPlatformAdmin, buildPlatformSnapshot, deriveConversationMemberIds, toIso,
} from './platformAdmin.js';

const authUser = (uid, email, { created = '2026-01-01T00:00:00Z', signIn = null, refresh = null, ...rest } = {}) => ({
  uid, email, displayName: rest.displayName ?? null, photoURL: rest.photoURL ?? null,
  disabled: Boolean(rest.disabled), emailVerified: false,
  metadata: { creationTime: created, lastSignInTime: signIn, lastRefreshTime: refresh },
});

test('only the hardcoded platform email passes, case-insensitively', () => {
  assert.equal(isPlatformAdminEmail('admin@bleon.com'), true);
  assert.equal(isPlatformAdminEmail(' Admin@Bleon.com '), true);
  assert.equal(isPlatformAdminEmail('admin@bleon.co'), false);
  assert.equal(isPlatformAdminEmail('teacher@school.com'), false);
  assert.equal(isPlatformAdminEmail(null), false);
});

test('non-admins get not-found and signed-out callers get unauthenticated', () => {
  assert.throws(() => assertPlatformAdmin({}), { code: 'unauthenticated' });
  assert.throws(() => assertPlatformAdmin({ auth: { uid: 'u1', token: { email: 'teacher@school.com' } } }), { code: 'not-found' });
  assert.throws(() => assertPlatformAdmin({ auth: { uid: 'u1', token: {} } }), { code: 'not-found' });
  assert.doesNotThrow(() => assertPlatformAdmin({ auth: { uid: 'u1', token: { email: 'admin@bleon.com' } } }));
});

test('last seen is the later of sign-in and token refresh; never-signed-in stays null', () => {
  const snapshot = buildPlatformSnapshot({
    authUsers: [
      authUser('a', 'a@x.com', { signIn: '2026-09-01T10:00:00Z', refresh: '2026-09-20T08:00:00Z' }),
      authUser('b', 'b@x.com', { signIn: '2026-09-25T10:00:00Z', refresh: '2026-09-02T08:00:00Z' }),
      authUser('c', 'c@x.com'),
    ],
  });
  const byUid = Object.fromEntries(snapshot.users.map(user => [user.uid, user]));
  assert.equal(byUid.a.lastSeenAt, '2026-09-20T08:00:00.000Z');
  assert.equal(byUid.b.lastSeenAt, '2026-09-25T10:00:00.000Z');
  assert.equal(byUid.c.lastSeenAt, null);
  assert.deepEqual(snapshot.users.map(user => user.uid), ['b', 'a', 'c']);
});

test('schools count active members by role and flag deleted-account memberships', () => {
  const snapshot = buildPlatformSnapshot({
    authUsers: [authUser('owner', 'owner@x.com'), authUser('t1', 't1@x.com'), authUser('s1', 's1@x.com')],
    schools: [{ id: 'sch1', name: 'North', creatorUid: 'owner', creatorEmail: 'Owner@x.com' }],
    memberships: [
      { schoolId: 'sch1', uid: 'owner', role: 'admin', status: 'active' },
      { schoolId: 'sch1', uid: 't1', role: 'teacher', status: 'active' },
      { schoolId: 'sch1', uid: 's1', role: 'student', status: 'archived' },
      { schoolId: 'sch1', uid: 'gone', role: 'student', status: 'active', email: 'gone@x.com' },
      { schoolId: 'deleted-school', uid: 't1', role: 'teacher', status: 'active' },
    ],
    profileIds: new Set(['owner', 't1', 's1']),
    schoolCounts: { sch1: { courses: 3, classGroups: 2, lessonPlans: 7 } },
  });
  const [school] = snapshot.schools;
  assert.deepEqual(school.members, { total: 4, active: 2, byRole: { admin: 1, teacher: 1 } });
  assert.equal(school.courses, 3);
  assert.equal(school.classGroups, 2);
  assert.equal(school.creatorEmail, 'owner@x.com');
  const health = Object.fromEntries(snapshot.health.map(item => [item.id, item]));
  assert.equal(health.orphanMemberships.count, 1);
  assert.equal(health.strayMemberships.count, 1);
  // s1 is archived, so it has no active school access.
  assert.deepEqual(health.usersWithoutSchool.sample.map(item => item.id), ['s1']);
  assert.equal(health.missingProfiles.count, 0);
  assert.equal(health.missingProfiles.severity, 'ok');
  assert.equal(health.schoolsWithoutAdmin.count, 0);
});

test('a school whose creator is gone and has no active admin is critical', () => {
  const snapshot = buildPlatformSnapshot({
    authUsers: [authUser('t1', 't1@x.com')],
    schools: [{ id: 'sch1', name: 'Lost', creatorUid: 'gone' }],
    memberships: [{ schoolId: 'sch1', uid: 't1', role: 'teacher', status: 'active' }],
  });
  const check = snapshot.health.find(item => item.id === 'schoolsWithoutAdmin');
  assert.equal(check.severity, 'critical');
  assert.equal(check.count, 1);
});

test('missing profiles and an unbuilt conversation index are fixable checks', () => {
  const pending = buildPlatformSnapshot({ authUsers: [authUser('a', 'a@x.com')] });
  const health = Object.fromEntries(pending.health.map(item => [item.id, item]));
  assert.equal(health.missingProfiles.fix, 'createMissingProfiles');
  assert.equal(health.conversationIndex.fix, 'indexConversations');
  const done = buildPlatformSnapshot({ authUsers: [], conversationIndex: { completedAt: '2026-09-01T00:00:00.000Z' } });
  assert.equal(done.health.find(item => item.id === 'conversationIndex').severity, 'ok');
});

test('the platform admin is not reported as lacking a school; creators count as school access', () => {
  const snapshot = buildPlatformSnapshot({
    authUsers: [authUser('p', 'admin@bleon.com'), authUser('c', 'creator@x.com')],
    schools: [{ id: 'sch1', creatorUid: 'c' }],
  });
  const users = Object.fromEntries(snapshot.users.map(user => [user.uid, user]));
  assert.equal(users.p.isPlatformAdmin, true);
  assert.deepEqual(users.c.createdSchools, ['sch1']);
  assert.equal(snapshot.health.find(item => item.id === 'usersWithoutSchool').count, 0);
});

test('only http(s) photo URLs are forwarded and user rows respect the limit', () => {
  const snapshot = buildPlatformSnapshot({
    authUsers: [
      authUser('a', 'a@x.com', { photoURL: 'data:image/png;base64,AAAA' }),
      authUser('b', 'b@x.com', { photoURL: 'https://example.com/b.png' }),
    ],
    userLimit: 1,
  });
  assert.equal(snapshot.users.length, 1);
  assert.equal(snapshot.usersTruncated, true);
  assert.equal(snapshot.totals.users, 2);
  const all = buildPlatformSnapshot({ authUsers: [authUser('a', 'a@x.com', { photoURL: 'data:image/png;base64,AAAA' })] });
  assert.equal(all.users[0].photoURL, null);
});

test('AI usage totals only count positive integer usage', () => {
  const snapshot = buildPlatformSnapshot({
    authUsers: [authUser('a', 'a@x.com')],
    aiUsage: [{ uid: 'a', used: 4 }, { uid: 'b', used: 0 }, { uid: 'c', used: 'x' }],
  });
  assert.deepEqual(snapshot.ai, { totalGenerations: 4, users: 1 });
  assert.equal(snapshot.users[0].aiGenerations, 4);
});

test('conversation members come from the DM id, else from the members list', () => {
  assert.deepEqual(deriveConversationMemberIds('dm_aaa_bbb', {}), ['aaa', 'bbb']);
  assert.deepEqual(deriveConversationMemberIds('grp_1', { members: [{ id: 'x' }, { id: 'y' }, { id: 'x' }, {}, { id: 'a/b' }] }), ['x', 'y']);
  assert.deepEqual(deriveConversationMemberIds('dm_only', { members: [{ id: 'p' }, { id: 'q' }] }), ['p', 'q']);
  assert.deepEqual(deriveConversationMemberIds('grp_2', {}), []);
});

test('toIso accepts Timestamps, strings and rejects junk', () => {
  assert.equal(toIso({ toDate: () => new Date('2026-02-03T04:05:06Z') }), '2026-02-03T04:05:06.000Z');
  assert.equal(toIso('Tue, 01 Sep 2026 10:00:00 GMT'), '2026-09-01T10:00:00.000Z');
  assert.equal(toIso('not a date'), null);
  assert.equal(toIso(null), null);
});
