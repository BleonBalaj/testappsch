import { HttpsError } from 'firebase-functions/v2/https';
import { BUILTIN_ROLES, roleData } from './provisionSchoolUser.js';

const BUILTIN_ROLE_NAMES = {
  admin: 'Administrator', teacher: 'Teacher', counselor: 'Academic Counselor',
  dept_head: 'Head of Department', support: 'Staff / Specialist', student: 'Student',
};

const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const safeString = (value, limit = 200) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const safeId = value => {
  const id = safeString(value, 128);
  return id && !id.includes('/') ? id : '';
};

/** Recipient lookup key used by the pendingInvitations index collection. */
export const invitationIndexId = (email, schoolId) => `${encodeURIComponent(email)}_${schoolId}`;

/** Decides whether `email` may act on an invitation; pure for testing. */
export function evaluateInvitation(invite, email, now = Date.now()) {
  if (!invite) return { ok: false, code: 'not-found', message: 'Invitation not found.' };
  // Check the addressee first so other accounts learn nothing about its state.
  if (!email || normalizeEmail(invite.email) !== email) {
    return { ok: false, code: 'permission-denied', message: 'This invitation was sent to a different email address.' };
  }
  if (invite.status !== 'pending') {
    return { ok: false, code: 'failed-precondition', message: `This invitation is already ${invite.status || 'closed'}.` };
  }
  const expiresAt = Date.parse(invite.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return { ok: false, code: 'failed-precondition', message: 'This invitation has expired.' };
  }
  const role = safeString(invite.role, 80).toLowerCase();
  if (!BUILTIN_ROLES.has(role) && !/^custom_[a-z0-9_-]{1,72}$/.test(role)) {
    return { ok: false, code: 'failed-precondition', message: 'This invitation has an invalid role.' };
  }
  return { ok: true, role };
}

async function services() {
  const [{ ensureDefaultApp }, { getFirestore, FieldValue }] = await Promise.all([
    import('./adminApp.js'), import('firebase-admin/firestore'),
  ]);
  ensureDefaultApp();
  return { db: getFirestore(), FieldValue };
}

function requireCaller(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to manage invitations.');
  return { uid: request.auth.uid, email: normalizeEmail(request.auth.token?.email) };
}

function requireTarget(data) {
  const schoolId = safeId(data?.schoolId);
  const invitationId = safeId(data?.invitationId);
  if (!schoolId || !invitationId) throw new HttpsError('invalid-argument', 'Choose a valid invitation.');
  return { schoolId, invitationId };
}

export async function listMyInvitations(request) {
  const { email } = requireCaller(request);
  if (!email) return { invitations: [] };
  const { db } = await services();
  const snap = await db.collection('pendingInvitations')
    .where('email', '==', email)
    .where('status', '==', 'pending')
    .get();
  const now = Date.now();
  const invitations = snap.docs
    .map(doc => doc.data())
    .filter(data => Date.parse(data.expiresAt) > now)
    .map(data => ({
      id: data.id,
      schoolId: data.schoolId,
      schoolName: data.schoolName,
      role: data.role,
      invitedByEmail: data.invitedByEmail || null,
      expiresAt: data.expiresAt,
    }));
  return { invitations };
}

export async function acceptInvitation(request) {
  const { uid, email } = requireCaller(request);
  const { schoolId, invitationId } = requireTarget(request.data);
  const { db, FieldValue } = await services();
  const schoolRef = db.doc(`schools/${schoolId}`);
  const inviteRef = schoolRef.collection('invitations').doc(invitationId);
  const memberRef = schoolRef.collection('members').doc(uid);
  const userRef = db.doc(`users/${uid}`);
  const prefsRef = userRef.collection('schoolPreferences').doc(schoolId);

  return db.runTransaction(async (tx) => {
    const [schoolSnap, inviteSnap, memberSnap, profileSnap, prefsSnap] = await Promise.all([
      tx.get(schoolRef), tx.get(inviteRef), tx.get(memberRef), tx.get(userRef), tx.get(prefsRef),
    ]);
    if (!schoolSnap.exists) throw new HttpsError('not-found', 'This school no longer exists.');
    const verdict = evaluateInvitation(inviteSnap.exists ? inviteSnap.data() : null, email);
    if (!verdict.ok) throw new HttpsError(verdict.code, verdict.message);
    const { role } = verdict;

    let roleName = BUILTIN_ROLE_NAMES[role];
    if (!roleName) {
      const roleSnap = await tx.get(schoolRef.collection('roles').doc(role));
      if (!roleSnap.exists) throw new HttpsError('failed-precondition', 'The invited role no longer exists.');
      roleName = safeString(roleSnap.data().name, 100) || role;
    }
    const existing = memberSnap.data();
    if (existing?.status === 'active' && existing.role !== role) {
      throw new HttpsError('already-exists', 'You already belong to this school with a different role.');
    }
    const directoryRef = schoolRef.collection(role === 'student' ? 'students' : 'staff').doc(uid);
    const directorySnap = await tx.get(directoryRef);

    const invite = inviteSnap.data();
    const school = schoolSnap.data();
    const schoolName = safeString(school.name) || safeString(invite.schoolName) || 'School';
    const name = safeString(invite.targetName) || safeString(request.auth.token?.name) || email.split('@')[0];
    const now = FieldValue.serverTimestamp();

    tx.update(inviteRef, { status: 'accepted', acceptedAt: now, acceptedByUid: uid });
    tx.delete(db.doc(`pendingInvitations/${invitationIndexId(email, schoolId)}`));
    tx.set(memberRef, { uid, email, name, role, status: 'active', joinedAt: existing?.joinedAt || now, updatedAt: now }, { merge: true });
    tx.set(userRef.collection('schoolLinks').doc(schoolId), { schoolId, schoolName, role, status: 'active', joinedAt: now }, { merge: true });
    if (!prefsSnap.exists) tx.set(prefsRef, { schoolId, lessonInterval: 15, rememberLastUsed: false, updatedAt: now });
    // Invited members appear in the Staff/Students directory like provisioned ones.
    if (!directorySnap.exists) {
      tx.set(directoryRef, { ...roleData({ role, uid, email, name, extra: { roleName } }), createdAt: now, updatedAt: now });
    }
    if (!profileSnap.exists) tx.set(userRef, { uid, email, displayName: name, name, createdAt: now, updatedAt: now });
    return { success: true, schoolId, schoolName, role };
  });
}

export async function declineInvitation(request) {
  const { email } = requireCaller(request);
  const { schoolId, invitationId } = requireTarget(request.data);
  const { db, FieldValue } = await services();
  const inviteRef = db.doc(`schools/${schoolId}/invitations/${invitationId}`);
  await db.runTransaction(async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    const verdict = evaluateInvitation(inviteSnap.exists ? inviteSnap.data() : null, email);
    if (!verdict.ok) throw new HttpsError(verdict.code, verdict.message);
    tx.update(inviteRef, { status: 'declined', declinedAt: FieldValue.serverTimestamp() });
    tx.delete(db.doc(`pendingInvitations/${invitationIndexId(email, schoolId)}`));
  });
  return { success: true };
}
