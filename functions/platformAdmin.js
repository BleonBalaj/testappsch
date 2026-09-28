import { HttpsError } from 'firebase-functions/v2/https';

// The platform owner account. Hardcoded on purpose for now. This server check is
// the only thing that grants access: the matching list in the web app only
// decides what to render, and Firestore rules grant this email nothing extra.
export const PLATFORM_ADMIN_EMAILS = Object.freeze(['admin@bleon.com']);

// Rows sent to the browser, which searches, filters and sorts them locally.
// Totals and health checks always cover every account.
export const USER_ROW_LIMIT = 50000;
const SAMPLE_LIMIT = 12;
const COUNT_CONCURRENCY = 8;
const WRITE_CHUNK = 400;
export const CONVERSATION_INDEX_DOC = 'platformMaintenance/conversationMemberIndex';

const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

export function isPlatformAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized) && PLATFORM_ADMIN_EMAILS.includes(normalized);
}

export function assertPlatformAdmin(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  // Answer like a missing endpoint so the admin surface is not advertised.
  if (!isPlatformAdminEmail(request.auth.token?.email)) throw new HttpsError('not-found', 'Not found.');
}

export function toIso(value) {
  if (!value) return null;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ISO-8601 strings from toISOString() sort chronologically as plain strings.
const laterIso = (a, b) => (!a ? b : !b ? a : (a > b ? a : b));

function safePhotoUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) && value.length <= 2048 ? value : null;
}

/** Stable member list for a conversation document, used as its access index. */
export function deriveConversationMemberIds(conversationId, data = {}) {
  if (typeof conversationId === 'string' && conversationId.startsWith('dm_')) {
    const parts = conversationId.slice(3).split('_');
    // Direct-message ids are `dm_<uidA>_<uidB>` with the pair sorted.
    if (parts.length === 2 && parts.every(Boolean) && parts[0] !== parts[1]) return parts;
  }
  const ids = Array.isArray(data.members)
    ? data.members.map(member => member?.id).filter(id => typeof id === 'string' && id && !id.includes('/'))
    : [];
  return [...new Set(ids)];
}

function sample(items, toEntry) {
  return items.slice(0, SAMPLE_LIMIT).map(toEntry);
}

function check(id, severity, title, description, items, toEntry, fix = null) {
  return {
    id,
    severity: items.length ? severity : 'ok',
    title,
    description,
    count: items.length,
    sample: sample(items, toEntry),
    fix: items.length ? fix : null,
  };
}

/**
 * Joins Firebase Auth accounts (the only complete user list) with school
 * memberships and usage records into the overview the admin page renders.
 * Pure so it can be tested without Firebase.
 */
export function buildPlatformSnapshot({
  authUsers = [],
  schools = [],
  memberships = [],
  profileIds = new Set(),
  aiUsage = [],
  schoolCounts = {},
  conversationIndex = null,
  now = Date.now(),
  userLimit = USER_ROW_LIMIT,
}) {
  const authById = new Map(authUsers.map(user => [user.uid, user]));
  const schoolById = new Map(schools.map(school => [school.id, school]));
  const memberStats = new Map(schools.map(school => [school.id, { total: 0, active: 0, byRole: {} }]));
  const membershipsByUid = new Map();
  const memberNameByUid = new Map();
  const orphanMemberships = [];
  const strayMemberships = [];

  for (const membership of memberships) {
    if (!schoolById.has(membership.schoolId)) {
      strayMemberships.push(membership);
      continue;
    }
    const stats = memberStats.get(membership.schoolId);
    stats.total += 1;
    if (!authById.has(membership.uid)) {
      orphanMemberships.push(membership);
      continue;
    }
    if (membership.status === 'active') {
      stats.active += 1;
      const role = membership.role || 'unknown';
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;
    }
    if (!membershipsByUid.has(membership.uid)) membershipsByUid.set(membership.uid, []);
    membershipsByUid.get(membership.uid).push({ schoolId: membership.schoolId, role: membership.role || null, status: membership.status || null });
    if (membership.name && !memberNameByUid.has(membership.uid)) memberNameByUid.set(membership.uid, membership.name);
  }

  // The school creator is treated as an administrator even without a member doc.
  const schoolAccessUids = new Set();
  for (const [uid, list] of membershipsByUid) if (list.some(item => item.status === 'active')) schoolAccessUids.add(uid);
  for (const school of schools) if (school.creatorUid && authById.has(school.creatorUid)) schoolAccessUids.add(school.creatorUid);

  const aiByUid = new Map(aiUsage.map(item => [item.uid, Number.isInteger(item.used) && item.used > 0 ? item.used : 0]));
  const createdByUid = new Map();
  for (const school of schools) {
    if (!school.creatorUid) continue;
    if (!createdByUid.has(school.creatorUid)) createdByUid.set(school.creatorUid, []);
    createdByUid.get(school.creatorUid).push(school.id);
  }

  const users = authUsers.map(user => {
    const email = normalizeEmail(user.email) || null;
    const createdAt = toIso(user.metadata?.creationTime);
    const lastSignInAt = toIso(user.metadata?.lastSignInTime);
    return {
      uid: user.uid,
      email,
      name: user.displayName || memberNameByUid.get(user.uid) || (email ? email.split('@')[0] : 'Unnamed account'),
      photoURL: safePhotoUrl(user.photoURL),
      disabled: Boolean(user.disabled),
      emailVerified: Boolean(user.emailVerified),
      createdAt,
      lastSignInAt,
      // Token refreshes happen about hourly while the app is open, so this is
      // "last seen" at roughly one-hour resolution. Users cannot write it.
      lastSeenAt: laterIso(lastSignInAt, toIso(user.metadata?.lastRefreshTime)),
      hasProfile: profileIds.has(user.uid),
      memberships: membershipsByUid.get(user.uid) || [],
      createdSchools: createdByUid.get(user.uid) || [],
      aiGenerations: aiByUid.get(user.uid) || 0,
      isPlatformAdmin: isPlatformAdminEmail(email),
    };
  });
  users.sort((a, b) => (b.lastSeenAt || '').localeCompare(a.lastSeenAt || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const schoolRows = schools.map(school => {
    const stats = memberStats.get(school.id);
    const counts = schoolCounts[school.id] || {};
    return {
      id: school.id,
      name: school.name || 'Untitled school',
      creatorUid: school.creatorUid || null,
      creatorEmail: normalizeEmail(school.creatorEmail) || null,
      creatorExists: Boolean(school.creatorUid && authById.has(school.creatorUid)),
      createdAt: toIso(school.createdAt),
      academicYear: typeof school.academicYear === 'string' ? school.academicYear : null,
      members: stats,
      courses: Number.isInteger(counts.courses) ? counts.courses : null,
      classGroups: Number.isInteger(counts.classGroups) ? counts.classGroups : null,
      lessonPlans: Number.isInteger(counts.lessonPlans) ? counts.lessonPlans : null,
    };
  });

  const userLabel = user => ({ id: user.uid, label: user.email || user.uid, detail: user.displayName || null });
  const membershipLabel = item => ({ id: `${item.schoolId}/${item.uid}`, label: item.email || item.uid, detail: schoolById.get(item.schoolId)?.name || item.schoolId });
  const schoolLabel = school => ({ id: school.id, label: school.name || school.id, detail: school.creatorEmail || null });

  const missingProfiles = authUsers.filter(user => !profileIds.has(user.uid));
  const withoutSchool = authUsers.filter(user => !user.disabled && !schoolAccessUids.has(user.uid) && !isPlatformAdminEmail(user.email));
  const schoolsWithActiveAdmin = new Set(memberships
    .filter(item => item.role === 'admin' && item.status === 'active' && authById.has(item.uid))
    .map(item => item.schoolId));
  const withoutAdmin = schools.filter(school => !(school.creatorUid && authById.has(school.creatorUid)) && !schoolsWithActiveAdmin.has(school.id));
  const emptySchools = schools.filter(school => memberStats.get(school.id).active === 0 && !(school.creatorUid && authById.has(school.creatorUid)));
  const conversationIndexPending = conversationIndex?.completedAt ? [] : [{ id: 'conversations', label: 'Conversation access index has not been built yet' }];

  const health = [
    check('schoolsWithoutAdmin', 'critical', 'Schools nobody can administer',
      'The creator account is gone and no active administrator remains, so nobody can manage these schools.',
      withoutAdmin, schoolLabel),
    check('conversationIndex', 'warning', 'Message access index',
      'Conversations are visible only to their members. Older conversations need their member list indexed once, or members will not see them.',
      conversationIndexPending, item => item, 'indexConversations'),
    check('missingProfiles', 'warning', 'Accounts without a profile record',
      'These accounts exist in Firebase Authentication but have no users/{uid} profile document.',
      missingProfiles, userLabel, 'createMissingProfiles'),
    check('orphanMemberships', 'warning', 'Memberships for deleted accounts',
      'School member records whose login account no longer exists. They still count toward school rosters.',
      orphanMemberships, membershipLabel),
    check('strayMemberships', 'warning', 'Memberships in missing schools',
      'Member records stored under a school document that no longer exists.',
      strayMemberships, membershipLabel),
    check('usersWithoutSchool', 'info', 'Accounts not in any school',
      'These people can sign in but only see the "not part of any school" screen.',
      withoutSchool, userLabel),
    check('emptySchools', 'info', 'Schools with no active members',
      'No active members and no creator account.',
      emptySchools, schoolLabel),
  ];

  const totalGenerations = [...aiByUid.values()].reduce((sum, used) => sum + used, 0);

  return {
    generatedAt: new Date(now).toISOString(),
    totals: { users: authUsers.length, schools: schools.length, memberships: memberships.length },
    users: users.slice(0, userLimit),
    usersTruncated: users.length > userLimit,
    schools: schoolRows,
    ai: { totalGenerations, users: [...aiByUid.values()].filter(used => used > 0).length },
    health,
  };
}

function pickAuthFields(user) {
  return {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    disabled: Boolean(user.disabled),
    emailVerified: Boolean(user.emailVerified),
    metadata: {
      creationTime: user.metadata?.creationTime || null,
      lastSignInTime: user.metadata?.lastSignInTime || null,
      lastRefreshTime: user.metadata?.lastRefreshTime || null,
    },
  };
}

export async function listAllAuthUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users.map(pickAuthFields));
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/**
 * Every school id, including ids whose school document is gone but whose
 * subcollections remain. Uses only per-collection reads, which Firestore
 * always indexes, so nothing has to be configured before deploying.
 */
async function loadSchoolIds(db) {
  const [schoolsSnap, refs] = await Promise.all([
    // select() keeps large fields such as base64 logos out of the response.
    db.collection('schools').select('name', 'creatorUid', 'creatorEmail', 'createdAt', 'academicYear').get(),
    db.collection('schools').listDocuments(),
  ]);
  const schools = schoolsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const existing = new Set(schools.map(school => school.id));
  return { schools, allIds: [...existing, ...refs.map(ref => ref.id).filter(id => !existing.has(id))] };
}

async function loadPlatformData(db, auth) {
  const [authUsers, { schools, allIds }, profilesSnap, aiSnap, indexSnap] = await Promise.all([
    listAllAuthUsers(auth),
    loadSchoolIds(db),
    db.collection('users').select().get(),
    db.collection('lessonAiUsage').select('used').get(),
    db.doc(CONVERSATION_INDEX_DOC).get(),
  ]);
  const existing = new Set(schools.map(school => school.id));
  const perSchool = await mapLimit(allIds, COUNT_CONCURRENCY, async schoolId => {
    const ref = db.collection('schools').doc(schoolId);
    const exists = existing.has(schoolId);
    const [members, courses, classGroups, lessonPlans] = await Promise.all([
      ref.collection('members').select('role', 'status', 'name', 'email').get(),
      exists ? ref.collection('classes').count().get() : null,
      exists ? ref.collection('classGroups').count().get() : null,
      exists ? ref.collection('lessonPlans').count().get() : null,
    ]);
    return {
      schoolId,
      memberships: members.docs.map(doc => ({ schoolId, uid: doc.id, ...doc.data() })),
      // "classes" is the course collection; homeroom classes live in classGroups.
      counts: exists ? { courses: courses.data().count, classGroups: classGroups.data().count, lessonPlans: lessonPlans.data().count } : null,
    };
  });
  return {
    authUsers,
    schools,
    memberships: perSchool.flatMap(item => item.memberships),
    profileIds: new Set(profilesSnap.docs.map(doc => doc.id)),
    aiUsage: aiSnap.docs.map(doc => ({ uid: doc.id, used: doc.data().used })),
    schoolCounts: Object.fromEntries(perSchool.filter(item => item.counts).map(item => [item.schoolId, item.counts])),
    conversationIndex: indexSnap.exists ? { completedAt: toIso(indexSnap.data().completedAt) } : null,
  };
}

async function adminServices() {
  const [{ ensureDefaultApp }, { getAuth }, { getFirestore, FieldValue, Timestamp }, logger] = await Promise.all([
    import('./adminApp.js'), import('firebase-admin/auth'), import('firebase-admin/firestore'), import('firebase-functions/logger'),
  ]);
  ensureDefaultApp();
  return { auth: getAuth(), db: getFirestore(), FieldValue, Timestamp, logger };
}

export async function getPlatformOverview(request) {
  assertPlatformAdmin(request);
  const { auth, db, logger } = await adminServices();
  logger.info('Platform admin overview requested', { uid: request.auth.uid });
  try {
    return buildPlatformSnapshot({ ...(await loadPlatformData(db, auth)), now: Date.now() });
  } catch (error) {
    logger.error('Platform admin overview failed', error);
    throw new HttpsError('internal', 'Could not build the platform overview. Check the function logs.');
  }
}

async function commitInChunks(db, operations) {
  for (let index = 0; index < operations.length; index += WRITE_CHUNK) {
    const batch = db.batch();
    operations.slice(index, index + WRITE_CHUNK).forEach(apply => apply(batch));
    await batch.commit();
  }
}

async function createMissingProfiles({ auth, db, FieldValue, Timestamp }) {
  const [authUsers, profilesSnap] = await Promise.all([listAllAuthUsers(auth), db.collection('users').select().get()]);
  const existing = new Set(profilesSnap.docs.map(doc => doc.id));
  const missing = authUsers.filter(user => !existing.has(user.uid));
  await commitInChunks(db, missing.map(user => batch => {
    const created = user.metadata.creationTime ? new Date(user.metadata.creationTime) : null;
    const name = user.displayName || (user.email ? user.email.split('@')[0] : 'Member');
    // merge keeps anything a concurrent client write already stored.
    batch.set(db.doc(`users/${user.uid}`), {
      uid: user.uid,
      email: normalizeEmail(user.email) || null,
      displayName: name,
      name,
      createdAt: created && !Number.isNaN(created.getTime()) ? Timestamp.fromDate(created) : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }));
  return { scanned: authUsers.length, updated: missing.length, skipped: 0 };
}

async function indexConversations({ db, FieldValue }, adminUid) {
  const { allIds } = await loadSchoolIds(db);
  const snaps = await mapLimit(allIds, COUNT_CONCURRENCY, schoolId =>
    db.collection('schools').doc(schoolId).collection('conversations').select('members', 'memberIds').get());
  const docs = snaps.flatMap(snap => snap.docs);
  const updates = [];
  let skipped = 0;
  for (const doc of docs) {
    const current = doc.get('memberIds');
    if (Array.isArray(current) && current.length >= 2) continue;
    const memberIds = deriveConversationMemberIds(doc.id, { members: doc.get('members') });
    if (memberIds.length < 2) {
      skipped += 1;
      continue;
    }
    updates.push(batch => batch.update(doc.ref, { memberIds }));
  }
  await commitInChunks(db, updates);
  await db.doc(CONVERSATION_INDEX_DOC).set({
    completedAt: FieldValue.serverTimestamp(),
    completedByUid: adminUid,
    scanned: docs.length,
    updated: updates.length,
    skipped,
  });
  return { scanned: docs.length, updated: updates.length, skipped };
}

export const REPAIR_ACTIONS = Object.freeze(['createMissingProfiles', 'indexConversations']);

export async function runPlatformRepair(request) {
  assertPlatformAdmin(request);
  const action = request.data?.action;
  if (!REPAIR_ACTIONS.includes(action)) throw new HttpsError('invalid-argument', 'Unknown repair action.');
  const services = await adminServices();
  services.logger.info('Platform admin repair requested', { uid: request.auth.uid, action });
  try {
    const result = action === 'createMissingProfiles'
      ? await createMissingProfiles(services)
      : await indexConversations(services, request.auth.uid);
    return { action, ...result };
  } catch (error) {
    services.logger.error('Platform admin repair failed', { action, error });
    throw new HttpsError('internal', 'The repair did not finish. It is safe to run again.');
  }
}
