import { HttpsError } from 'firebase-functions/v2/https';
import { studentSearchFields } from './studentSearch.js';

// Bump when student records need new derived fields; each school upgrades once.
export const DIRECTORY_VERSION = 1;
const PAGE_SIZE = 400;
const PAGE_ATTEMPTS = 3;
const STAFF_ROLES = new Set(['admin', 'teacher', 'dept_head']);

const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const referenceText = reference => {
  if (typeof reference === 'string' || typeof reference === 'number') return String(reference);
  if (reference && typeof reference === 'object') return reference.id || reference.code || reference.name || '';
  return '';
};

// Same matching the web app uses (src/features/enrollment.js) for older
// assignments stored as a name, a code or "Name (CODE)".
export function courseMatchesReference(course, reference) {
  if (!course || !reference) return false;
  if (typeof reference === 'object') {
    return [reference.id, reference.code, reference.name].filter(Boolean).some(value => courseMatchesReference(course, String(value)));
  }
  const value = clean(referenceText(reference));
  if (!value) return false;
  const code = clean(course.code);
  const name = clean(course.name);
  if (value === clean(course.id) || (code && value === code) || (name && value === name)) return true;
  const legacy = value.match(/^.+\s\(([^()]+)\)$/);
  return Boolean(legacy && code && clean(legacy[1]) === code);
}

const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * The fields to write so an older student record works with directory
 * queries: search fields, a status, a class link (possibly empty) and course
 * assignments stored as course IDs. Empty when the record is already current.
 */
export function directoryPatch(student = {}, courses = [], docId = '') {
  const patch = {};
  const search = studentSearchFields({ name: student.name, email: student.email, studentId: student.studentId });
  if (student.nameLower !== search.nameLower) patch.nameLower = search.nameLower;
  if (!sameList(student.searchTokens, search.searchTokens)) patch.searchTokens = search.searchTokens;
  if (student.status !== 'active' && student.status !== 'archived') patch.status = 'active';
  if (typeof student.classGroupId !== 'string') patch.classGroupId = '';
  if (typeof student.grade !== 'string') patch.grade = student.grade == null ? '' : String(student.grade).slice(0, 40);

  const stored = Array.isArray(student.assignedClasses)
    ? student.assignedClasses
    : typeof student.assignedClasses === 'string' && student.assignedClasses.trim() ? [student.assignedClasses] : null;
  let courseIds;
  if (stored) {
    courseIds = [...new Set(stored.map(reference => {
      const course = courses.find(item => courseMatchesReference(item, reference));
      return course ? String(course.id) : referenceText(reference).trim();
    }).filter(Boolean))];
  } else {
    // Very old records listed students on the course instead.
    const ids = [docId, student.id, student.uid, student.studentId].filter(Boolean).map(clean);
    courseIds = courses
      .filter(course => Array.isArray(course.enrolledStudentIds) && course.enrolledStudentIds.some(value => ids.includes(clean(value))))
      .map(course => String(course.id));
  }
  if (!sameList(student.assignedClasses, courseIds)) patch.assignedClasses = courseIds;
  return patch;
}

const isPreconditionFailure = error => error?.code === 9 || /FAILED_PRECONDITION|precondition/i.test(String(error?.message || ''));

export async function prepareDirectory(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const schoolId = typeof request.data?.schoolId === 'string' ? request.data.schoolId.trim() : '';
  if (!schoolId || schoolId.length > 128 || schoolId.includes('/')) throw new HttpsError('invalid-argument', 'Choose a valid school.');

  const [{ ensureDefaultApp }, { getFirestore, FieldValue, FieldPath }] = await Promise.all([
    import('./adminApp.js'), import('firebase-admin/firestore'),
  ]);
  ensureDefaultApp();
  const db = getFirestore();
  const schoolRef = db.doc(`schools/${schoolId}`);
  const [schoolSnap, memberSnap] = await Promise.all([schoolRef.get(), schoolRef.collection('members').doc(uid).get()]);
  if (!schoolSnap.exists) throw new HttpsError('not-found', 'School not found.');
  const school = schoolSnap.data();
  const member = memberSnap.data();
  if (school.creatorUid !== uid && !(member?.status === 'active' && STAFF_ROLES.has(member.role))) {
    throw new HttpsError('permission-denied', 'Only school staff can prepare the student directory.');
  }
  if (Number(school.directoryVersion) >= DIRECTORY_VERSION) return { ready: true, scanned: 0, updated: 0 };

  const coursesSnap = await schoolRef.collection('classes').select('name', 'code', 'enrolledStudentIds').get();
  const courses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  let scanned = 0;
  let updated = 0;
  let cursor = null;
  for (;;) {
    let page;
    let writes = 0;
    for (let attempt = 1; ; attempt += 1) {
      let pageQuery = schoolRef.collection('students').orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
      if (cursor) pageQuery = pageQuery.startAfter(cursor);
      page = await pageQuery.get();
      const batch = db.batch();
      writes = 0;
      for (const doc of page.docs) {
        const patch = directoryPatch(doc.data(), courses, doc.id);
        if (Object.keys(patch).length === 0) continue;
        // Skip the write if someone edited this student since it was read.
        batch.update(doc.ref, patch, { lastUpdateTime: doc.updateTime });
        writes += 1;
      }
      try {
        if (writes) await batch.commit();
        break;
      } catch (error) {
        if (!isPreconditionFailure(error) || attempt >= PAGE_ATTEMPTS) throw error;
      }
    }
    scanned += page.size;
    updated += writes;
    if (page.size < PAGE_SIZE) break;
    cursor = page.docs[page.docs.length - 1].id;
  }
  await schoolRef.update({ directoryVersion: DIRECTORY_VERSION, directoryPreparedAt: FieldValue.serverTimestamp() });
  return { ready: true, scanned, updated };
}
