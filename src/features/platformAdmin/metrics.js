const DAY_MS = 86_400_000;

export const RANGE_OPTIONS = Object.freeze([
  { id: '7d', label: 'Last 7 days', unit: 'day', count: 7 },
  { id: '30d', label: 'Last 30 days', unit: 'day', count: 30 },
  { id: '90d', label: 'Last 90 days', unit: 'day', count: 90 },
  { id: '12m', label: 'Last 12 months', unit: 'month', count: 12 },
]);

const toMs = iso => (iso ? Date.parse(iso) : NaN);
const since = (iso, startMs) => {
  const time = toMs(iso);
  return Number.isFinite(time) && time >= startMs;
};
const between = (iso, startMs, endMs) => {
  const time = toMs(iso);
  return Number.isFinite(time) && time >= startMs && time < endMs;
};

/**
 * Calendar-aligned range in the viewer's local time, so the headline numbers
 * and the chart buckets always cover exactly the same span. The previous
 * range is the same length immediately before it (for deltas).
 */
export function rangeWindow(rangeId, now = Date.now()) {
  const option = RANGE_OPTIONS.find(item => item.id === rangeId) || RANGE_OPTIONS[1];
  const today = new Date(now);
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const bucketStart = option.unit === 'month'
    ? index => new Date(y, m - (option.count - 1) + index, 1)
    : index => new Date(y, m, d - (option.count - 1) + index);
  const buckets = Array.from({ length: option.count }, (_, index) => ({
    start: bucketStart(index).getTime(),
    end: index === option.count - 1 ? Math.max(now, bucketStart(index + 1).getTime()) : bucketStart(index + 1).getTime(),
  }));
  const previousStart = option.unit === 'month'
    ? new Date(y, m - (option.count * 2 - 1), 1).getTime()
    : new Date(y, m, d - (option.count * 2 - 1)).getTime();
  return { option, start: buckets[0].start, end: now, previousStart, buckets };
}

/** Which schools each account belongs to (active memberships plus schools it created). */
export function userSchoolIds(user) {
  const ids = new Set((user.memberships || []).filter(item => item.status === 'active').map(item => item.schoolId));
  (user.createdSchools || []).forEach(id => ids.add(id));
  return ids;
}

export function buildSchoolActivity(users, windowStart) {
  const activity = new Map();
  for (const user of users) {
    for (const schoolId of userSchoolIds(user)) {
      const entry = activity.get(schoolId) || { lastActiveAt: null, lastActiveName: null, activeMembers: 0 };
      if (user.lastSeenAt && (!entry.lastActiveAt || user.lastSeenAt > entry.lastActiveAt)) {
        entry.lastActiveAt = user.lastSeenAt;
        entry.lastActiveName = user.name;
      }
      if (since(user.lastSeenAt, windowStart)) entry.activeMembers += 1;
      activity.set(schoolId, entry);
    }
  }
  return activity;
}

export function computeKpis(snapshot, range, now = Date.now()) {
  const users = snapshot.users || [];
  const schools = snapshot.schools || [];
  // One pass, parsing each timestamp once, so this stays fast with 50,000 accounts.
  let activeUsers = 0;
  let newSignups = 0;
  let previousSignups = 0;
  let dau = 0;
  let wau = 0;
  let mau = 0;
  let disabledUsers = 0;
  let neverSignedIn = 0;
  for (const user of users) {
    if (user.disabled) disabledUsers += 1;
    if (!user.lastSeenAt) neverSignedIn += 1;
    const seen = toMs(user.lastSeenAt);
    if (Number.isFinite(seen)) {
      if (seen >= range.start) activeUsers += 1;
      if (seen >= now - DAY_MS) dau += 1;
      if (seen >= now - 7 * DAY_MS) wau += 1;
      if (seen >= now - 30 * DAY_MS) mau += 1;
    }
    const created = toMs(user.createdAt);
    if (Number.isFinite(created)) {
      if (created >= range.start) newSignups += 1;
      else if (created >= range.previousStart) previousSignups += 1;
    }
  }
  const schoolActivity = buildSchoolActivity(users, range.start);
  const totalUsers = snapshot.totals?.users ?? users.length;
  return {
    totalUsers,
    disabledUsers,
    neverSignedIn,
    activeUsers,
    activeShare: totalUsers ? activeUsers / totalUsers : 0,
    newSignups,
    previousSignups,
    dau,
    wau,
    mau,
    // Share of monthly actives who also came back in the last day.
    stickiness: mau ? dau / mau : null,
    totalSchools: snapshot.totals?.schools ?? schools.length,
    newSchools: schools.filter(school => since(school.createdAt, range.start)).length,
    previousSchools: schools.filter(school => between(school.createdAt, range.previousStart, range.start)).length,
    activeSchools: schools.filter(school => (schoolActivity.get(school.id)?.activeMembers || 0) > 0).length,
  };
}

/** Sign-ups per chart bucket; each account is placed with a binary search. */
export function buildSignupSeries(users, range) {
  const { buckets } = range;
  const counts = new Array(buckets.length).fill(0);
  if (!buckets.length) return [];
  const first = buckets[0].start;
  const last = buckets[buckets.length - 1].end;
  for (const user of users) {
    const created = toMs(user.createdAt);
    if (!Number.isFinite(created) || created < first || created >= last) continue;
    let low = 0;
    let high = buckets.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (buckets[mid].start <= created) low = mid; else high = mid - 1;
    }
    if (created < buckets[low].end) counts[low] += 1;
  }
  return buckets.map((bucket, index) => ({ ...bucket, signups: counts[index] }));
}

export const RECENCY_BUCKETS = Object.freeze([
  { id: 'day', label: 'Within 24 hours', maxDays: 1 },
  { id: 'week', label: '1–7 days', maxDays: 7 },
  { id: 'month', label: '7–30 days', maxDays: 30 },
  { id: 'quarter', label: '30–90 days', maxDays: 90 },
  { id: 'older', label: 'Over 90 days', maxDays: Infinity },
  { id: 'never', label: 'Never signed in', maxDays: null },
]);

export function buildRecency(users, now = Date.now()) {
  const counts = Object.fromEntries(RECENCY_BUCKETS.map(bucket => [bucket.id, 0]));
  for (const user of users) {
    const seen = toMs(user.lastSeenAt);
    if (!Number.isFinite(seen)) {
      counts.never += 1;
      continue;
    }
    const ageDays = Math.max(0, now - seen) / DAY_MS;
    const bucket = RECENCY_BUCKETS.find(item => item.maxDays !== null && ageDays < item.maxDays);
    counts[bucket.id] += 1;
  }
  return RECENCY_BUCKETS.map(bucket => ({ id: bucket.id, label: bucket.label, count: counts[bucket.id] }));
}

export const USER_STATUS_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active in range' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'never', label: 'Never signed in' },
  { id: 'noSchool', label: 'No school' },
  { id: 'disabled', label: 'Disabled' },
]);

export function filterUsers(users, { query = '', status = 'all', windowStart = 0, schoolNames = new Map() } = {}) {
  const needle = query.trim().toLowerCase();
  return users.filter(user => {
    if (status === 'active' && !since(user.lastSeenAt, windowStart)) return false;
    if (status === 'inactive' && (!user.lastSeenAt || since(user.lastSeenAt, windowStart))) return false;
    if (status === 'never' && user.lastSeenAt) return false;
    if (status === 'noSchool' && (userSchoolIds(user).size > 0 || user.isPlatformAdmin)) return false;
    if (status === 'disabled' && !user.disabled) return false;
    if (!needle) return true;
    const haystack = [user.name, user.email, user.uid, ...[...userSchoolIds(user)].map(id => schoolNames.get(id))];
    return haystack.some(value => typeof value === 'string' && value.toLowerCase().includes(needle));
  });
}

export const USER_SORTS = Object.freeze([
  { id: 'lastSeen', label: 'Last seen' },
  { id: 'joined', label: 'Newest accounts' },
  { id: 'name', label: 'Name' },
  { id: 'schools', label: 'Most schools' },
  { id: 'ai', label: 'AI generations' },
]);

// ISO-8601 timestamps sort correctly as plain strings, much faster than localeCompare.
export const compareIsoDesc = (a, b) => {
  const x = a || '';
  const y = b || '';
  return x < y ? 1 : x > y ? -1 : 0;
};
const byIsoDesc = key => (a, b) => compareIsoDesc(a[key], b[key]);
const nameCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

export function sortUsers(users, sortId) {
  if (sortId === 'schools') {
    // Count each account's schools once instead of inside the comparator.
    return users.map(user => ({ user, schools: userSchoolIds(user).size }))
      .sort((a, b) => b.schools - a.schools || byIsoDesc('lastSeenAt')(a.user, b.user))
      .map(item => item.user);
  }
  const sorted = [...users];
  if (sortId === 'joined') sorted.sort(byIsoDesc('createdAt'));
  else if (sortId === 'name') sorted.sort((a, b) => nameCollator.compare(a.name || '', b.name || ''));
  else if (sortId === 'ai') sorted.sort((a, b) => (b.aiGenerations || 0) - (a.aiGenerations || 0) || byIsoDesc('lastSeenAt')(a, b));
  else sorted.sort((a, b) => byIsoDesc('lastSeenAt')(a, b) || byIsoDesc('createdAt')(a, b));
  return sorted;
}
