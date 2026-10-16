import { HttpsError } from 'firebase-functions/v2/https';

export function canPrepareLessonPlans(uid, school, member) {
  return school?.creatorUid === uid || (member?.status === 'active' && (
    member.role === 'admin' || (['teacher', 'dept_head'].includes(member.role) && (school?.rolePermissions?.teacher?.['lesson-plans'] ?? true) === true)
  ));
}
export function canClaimLegacyPlan(plan, uid, email) {
  return !plan?.ownerUid && typeof plan?.teacherId === 'string' && typeof email === 'string' && Boolean(email) && plan.teacherId.toLowerCase() === email.toLowerCase() && Boolean(uid);
}

export async function prepareOwnership(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { schoolId, teacherId } = request.data || {};
  if (typeof schoolId !== 'string' || !schoolId || schoolId.includes('/') || schoolId.length > 128) throw new HttpsError('invalid-argument', 'Choose a valid school.');
  const [{ ensureDefaultApp }, { getFirestore, FieldPath, FieldValue }, { getAuth }] = await Promise.all([
    import('./adminApp.js'), import('firebase-admin/firestore'), import('firebase-admin/auth'),
  ]);
  ensureDefaultApp();
  const uid = request.auth.uid, db = getFirestore(), schoolRef = db.doc(`schools/${schoolId}`);
  const [schoolSnapshot, memberSnapshot, account] = await Promise.all([schoolRef.get(), schoolRef.collection('members').doc(uid).get(), getAuth().getUser(uid)]);
  if (!schoolSnapshot.exists || !canPrepareLessonPlans(uid, schoolSnapshot.data(), memberSnapshot.data())) throw new HttpsError('permission-denied', 'Lesson planner access is required.');
  const email = account.email || '';
  if (!email || (teacherId && (typeof teacherId !== 'string' || teacherId.toLowerCase() !== email.toLowerCase()))) throw new HttpsError('permission-denied', 'Account identity does not match.');
  const marker = schoolRef.collection('lessonPlanOwnership').doc(uid);
  const previous = await marker.get();
  if (previous.data()?.version === 1 && previous.data()?.email === email.toLowerCase()) return { ready: true };
  const candidates = [...new Set([email, email.toLowerCase(), teacherId].filter(Boolean))];
  let cursor = null;
  for (;;) {
    let query = schoolRef.collection('lessonPlans').where('teacherId', 'in', candidates).orderBy(FieldPath.documentId()).limit(150);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (let offset = 0; offset < page.docs.length; offset += 12) await Promise.all(page.docs.slice(offset, offset + 12).map(entry => db.runTransaction(async transaction => {
      const current = await transaction.get(entry.ref);
      if (current.exists && canClaimLegacyPlan(current.data(), uid, email)) transaction.update(entry.ref, { ownerUid: uid });
    })));
    cursor = page.docs.at(-1);
    if (page.size < 150) break;
  }
  await marker.set({ version: 1, email: email.toLowerCase(), completedAt: FieldValue.serverTimestamp() });
  return { ready: true };
}
