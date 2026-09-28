import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlatformAdminEmail } from './access.js';
import { parseAdminPath, adminPathFor } from './route.js';
import {
  rangeWindow, computeKpis, buildSignupSeries, buildRecency, filterUsers, sortUsers, buildSchoolActivity,
} from './metrics.js';
import { relativeTime } from './format.js';

const DAY = 86_400_000;
const NOW = new Date(2026, 8, 28, 15, 0).getTime(); // 28 Sep 2026, 15:00 local
const iso = ms => new Date(ms).toISOString();

test('client admin check mirrors the server list', () => {
  assert.equal(isPlatformAdminEmail('ADMIN@bleon.com'), true);
  assert.equal(isPlatformAdminEmail('someone@bleon.com'), false);
  assert.equal(isPlatformAdminEmail(undefined), false);
});

test('admin paths map to views; unknown sub-paths are not found; other paths are ignored', () => {
  assert.deepEqual(parseAdminPath('/admin'), { view: 'overview' });
  assert.deepEqual(parseAdminPath('/admin/'), { view: 'overview' });
  assert.deepEqual(parseAdminPath('/admin/users'), { view: 'users' });
  assert.deepEqual(parseAdminPath('/admin/schools/'), { view: 'schools' });
  assert.deepEqual(parseAdminPath('/admin/overview'), { view: null });
  assert.deepEqual(parseAdminPath('/admin/secrets'), { view: null });
  assert.equal(parseAdminPath('/administrator'), null);
  assert.equal(parseAdminPath('/'), null);
  assert.equal(parseAdminPath('/login'), null);
  assert.equal(adminPathFor('overview'), '/admin');
  assert.equal(adminPathFor('users'), '/admin/users');
});

test('range windows are calendar-aligned and chart buckets cover exactly the range', () => {
  const week = rangeWindow('7d', NOW);
  assert.equal(week.buckets.length, 7);
  assert.equal(week.start, new Date(2026, 8, 22).getTime());
  assert.equal(week.previousStart, new Date(2026, 8, 15).getTime());
  // Today's bucket runs to the next midnight so nothing from today falls outside it.
  assert.equal(week.buckets.at(-1).end, new Date(2026, 8, 29).getTime());
  for (let index = 1; index < week.buckets.length; index += 1) {
    assert.equal(week.buckets[index].start, week.buckets[index - 1].end);
  }
  const year = rangeWindow('12m', NOW);
  assert.equal(year.buckets.length, 12);
  assert.equal(year.start, new Date(2025, 9, 1).getTime());
  assert.equal(year.previousStart, new Date(2024, 9, 1).getTime());
});

test('kpis and the signup series agree on the same range', () => {
  const range = rangeWindow('7d', NOW);
  const users = [
    { uid: 'a', createdAt: iso(NOW - 1 * DAY), lastSeenAt: iso(NOW - 60_000), memberships: [{ schoolId: 's1', status: 'active' }] },
    { uid: 'b', createdAt: iso(NOW - 3 * DAY), lastSeenAt: iso(NOW - 10 * DAY), memberships: [] },
    { uid: 'c', createdAt: iso(NOW - 9 * DAY), lastSeenAt: null, memberships: [] },
    { uid: 'd', createdAt: iso(NOW - 40 * DAY), lastSeenAt: iso(NOW - 2 * DAY), memberships: [], createdSchools: ['s2'] },
  ];
  const snapshot = {
    users,
    schools: [{ id: 's1', createdAt: iso(NOW - 2 * DAY) }, { id: 's2', createdAt: iso(NOW - 100 * DAY) }, { id: 's3', createdAt: null }],
    totals: { users: 4, schools: 3 },
  };
  const kpis = computeKpis(snapshot, range, NOW);
  assert.equal(kpis.newSignups, 2);
  assert.equal(kpis.previousSignups, 1);
  assert.equal(kpis.activeUsers, 2);
  assert.equal(kpis.dau, 1);
  assert.equal(kpis.mau, 3);
  assert.equal(kpis.stickiness, 1 / 3);
  assert.equal(kpis.neverSignedIn, 1);
  assert.equal(kpis.newSchools, 1);
  assert.equal(kpis.activeSchools, 2);
  const series = buildSignupSeries(users, range);
  assert.equal(series.reduce((sum, bucket) => sum + bucket.signups, 0), kpis.newSignups);
});

test('recency groups every account exactly once', () => {
  const users = [
    { lastSeenAt: iso(NOW - 1000) }, { lastSeenAt: iso(NOW - 3 * DAY) }, { lastSeenAt: iso(NOW - 20 * DAY) },
    { lastSeenAt: iso(NOW - 60 * DAY) }, { lastSeenAt: iso(NOW - 400 * DAY) }, { lastSeenAt: null },
    { lastSeenAt: iso(NOW + 5000) },
  ];
  const recency = buildRecency(users, NOW);
  assert.deepEqual(recency.map(item => item.count), [2, 1, 1, 1, 1, 1]);
  assert.equal(recency.reduce((sum, item) => sum + item.count, 0), users.length);
});

test('school activity uses the most recent member and counts actives in the range', () => {
  const activity = buildSchoolActivity([
    { name: 'Old', lastSeenAt: iso(NOW - 20 * DAY), memberships: [{ schoolId: 's1', status: 'active' }] },
    { name: 'New', lastSeenAt: iso(NOW - DAY), memberships: [{ schoolId: 's1', status: 'active' }] },
    { name: 'Gone', lastSeenAt: iso(NOW), memberships: [{ schoolId: 's1', status: 'archived' }] },
  ], NOW - 7 * DAY);
  assert.deepEqual(activity.get('s1'), { lastActiveAt: iso(NOW - DAY), lastActiveName: 'New', activeMembers: 1 });
});

test('directory search is case-insensitive across name, email, uid and school', () => {
  const users = [
    { uid: 'u1', name: 'Ana Berisha', email: 'ana@school.com', lastSeenAt: iso(NOW), memberships: [{ schoolId: 's1', status: 'active' }] },
    { uid: 'u2', name: 'Ben', email: 'ben@x.com', lastSeenAt: null, memberships: [] },
    { uid: 'u3', name: 'Cara', email: 'cara@x.com', lastSeenAt: iso(NOW - 40 * DAY), memberships: [], disabled: true },
    { uid: 'p', name: 'Owner', email: 'admin@bleon.com', lastSeenAt: iso(NOW), memberships: [], isPlatformAdmin: true },
  ];
  const schoolNames = new Map([['s1', 'North High']]);
  const ids = options => filterUsers(users, { windowStart: NOW - 7 * DAY, schoolNames, ...options }).map(user => user.uid);
  assert.deepEqual(ids({ query: 'BERISHA' }), ['u1']);
  assert.deepEqual(ids({ query: 'north' }), ['u1']);
  assert.deepEqual(ids({ query: 'u2' }), ['u2']);
  assert.deepEqual(ids({ status: 'active' }), ['u1', 'p']);
  assert.deepEqual(ids({ status: 'inactive' }), ['u3']);
  assert.deepEqual(ids({ status: 'never' }), ['u2']);
  assert.deepEqual(ids({ status: 'noSchool' }), ['u2', 'u3']);
  assert.deepEqual(ids({ status: 'disabled' }), ['u3']);
});

test('sorting keeps never-seen accounts last and supports every sort key', () => {
  const users = [
    { uid: 'a', name: 'zed', lastSeenAt: null, createdAt: iso(NOW), memberships: [], aiGenerations: 0 },
    { uid: 'b', name: 'Amy', lastSeenAt: iso(NOW - DAY), createdAt: iso(NOW - 5 * DAY), memberships: [{ schoolId: 's', status: 'active' }], aiGenerations: 9 },
    { uid: 'c', name: 'bob', lastSeenAt: iso(NOW), createdAt: iso(NOW - 9 * DAY), memberships: [], aiGenerations: 2 },
  ];
  assert.deepEqual(sortUsers(users, 'lastSeen').map(user => user.uid), ['c', 'b', 'a']);
  assert.deepEqual(sortUsers(users, 'joined').map(user => user.uid), ['a', 'b', 'c']);
  assert.deepEqual(sortUsers(users, 'name').map(user => user.uid), ['b', 'c', 'a']);
  assert.deepEqual(sortUsers(users, 'schools').map(user => user.uid), ['b', 'c', 'a']);
  assert.deepEqual(sortUsers(users, 'ai').map(user => user.uid), ['b', 'c', 'a']);
});

test('relative times read naturally', () => {
  assert.equal(relativeTime(null, NOW), 'Never');
  assert.equal(relativeTime(iso(NOW - 10_000), NOW), 'Just now');
  assert.equal(relativeTime(iso(NOW - 5 * 60_000), NOW), '5 min ago');
  assert.equal(relativeTime(iso(NOW - 3 * 3_600_000), NOW), '3 h ago');
  assert.equal(relativeTime(iso(NOW - 30 * 3_600_000), NOW), 'Yesterday');
  assert.equal(relativeTime(iso(NOW - 4 * DAY), NOW), '4 days ago');
});

test('fast KPIs and chart buckets match the straightforward definitions on random data', () => {
  let seed = 7;
  const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const maybeIso = () => (random() < 0.15 ? null : iso(NOW - Math.floor(random() * 500 * DAY) + Math.floor(random() * 2 * DAY)));
  const users = Array.from({ length: 3000 }, (_, index) => ({
    uid: `u${index}`, createdAt: maybeIso(), lastSeenAt: maybeIso(), disabled: random() < 0.05, memberships: [],
  }));
  const parsed = value => (value ? Date.parse(value) : NaN);
  const since = (value, start) => Number.isFinite(parsed(value)) && parsed(value) >= start;
  const between = (value, start, end) => Number.isFinite(parsed(value)) && parsed(value) >= start && parsed(value) < end;
  for (const rangeId of ['7d', '30d', '90d', '12m']) {
    const range = rangeWindow(rangeId, NOW);
    const kpis = computeKpis({ users, schools: [], totals: { users: users.length, schools: 0 } }, range, NOW);
    assert.equal(kpis.activeUsers, users.filter(user => since(user.lastSeenAt, range.start)).length);
    assert.equal(kpis.newSignups, users.filter(user => since(user.createdAt, range.start)).length);
    assert.equal(kpis.previousSignups, users.filter(user => between(user.createdAt, range.previousStart, range.start)).length);
    assert.equal(kpis.dau, users.filter(user => since(user.lastSeenAt, NOW - DAY)).length);
    assert.equal(kpis.wau, users.filter(user => since(user.lastSeenAt, NOW - 7 * DAY)).length);
    assert.equal(kpis.mau, users.filter(user => since(user.lastSeenAt, NOW - 30 * DAY)).length);
    assert.equal(kpis.neverSignedIn, users.filter(user => !user.lastSeenAt).length);
    assert.equal(kpis.disabledUsers, users.filter(user => user.disabled).length);
    const series = buildSignupSeries(users, range);
    assert.deepEqual(series.map(bucket => bucket.signups),
      range.buckets.map(bucket => users.filter(user => between(user.createdAt, bucket.start, bucket.end)).length));
  }
  const byName = sortUsers(users.map((user, index) => ({ ...user, name: `Name ${(index * 7919) % 3000}` })), 'name');
  for (let index = 1; index < byName.length; index += 1) {
    assert.ok(byName[index - 1].name.localeCompare(byName[index].name, undefined, { sensitivity: 'base' }) <= 0);
  }
});
