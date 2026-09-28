import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const BUILTIN_ROLES = new Set(['admin', 'teacher', 'dept_head', 'counselor', 'support', 'student']);
const safeString = (value, limit = 200) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const safeList = value => Array.isArray(value) ? value.filter(item => typeof item === 'string').map(item => item.trim().slice(0, 150)).filter(Boolean).slice(0, 100) : [];

export function canProvision({ creatorUid, callerUid, member, school, role }) {
  if (callerUid === creatorUid) return true;
  if (member?.status !== 'active') return false;
  if (member.role === 'admin') return true;
  if (role !== 'student' || !['teacher', 'dept_head'].includes(member.role)) return false;
  return school?.rolePermissions?.teacher?.students !== false;
}

export function canEditStudentCourses({ creatorUid, callerUid, member, school }) {
  if (callerUid === creatorUid) return true;
  if (member?.status !== 'active') return false;
  if (member.role === 'admin') return true;
  return ['teacher', 'dept_head'].includes(member.role) &&
    school?.rolePermissions?.teacher?.students !== false &&
    school?.rolePermissions?.teacher?.canEditDeleteStudents !== false;
}

function roleData({ role, uid, email, name, extra }) {
  if (role === 'student') return {
    id: uid, studentId: safeString(extra.studentId, 50) || `STU-${uid.slice(0, 8).toUpperCase()}`,
    name, email, role, status: 'active', grade: safeString(extra.grade, 40) || '10A',
    phone: safeString(extra.phone, 60), guardian: safeString(extra.guardian),
    assignedClasses: safeList(extra.assignedClasses),
  };
  return {
    id: uid, staffId: safeString(extra.staffId, 50) || `STF-${uid.slice(0, 8).toUpperCase()}`,
    name, email, role, roleId: role, roleName: safeString(extra.roleName, 100) || role,
    status: 'active', phone: safeString(extra.phone, 60), department: safeString(extra.department, 100),
    subject: safeString(extra.subject, 100), room: safeString(extra.room, 100), bio: safeString(extra.bio, 2000),
    experience: safeString(extra.experience, 100), joinDate: safeString(extra.joinDate, 30),
    classes: Number.isFinite(Number(extra.classes)) ? Math.max(0, Number(extra.classes)) : 0,
  };
}

export async function provisionUser(request) {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in before adding a school account.');
  const data = request.data || {};
  const schoolId = safeString(data.schoolId, 128);
  const email = safeString(data.email, 320).toLowerCase();
  const name = safeString(data.name);
  const role = safeString(data.role, 80) || 'student';
  const password = typeof data.password === 'string' ? data.password : '';
  const extra = data.extraData && typeof data.extraData === 'object' && !Array.isArray(data.extraData) ? data.extraData : {};
  if (!schoolId || schoolId.includes('/') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
    throw new HttpsError('invalid-argument', 'Enter a valid school, email, and name.');
  }
  if (!BUILTIN_ROLES.has(role) && !/^custom_[A-Za-z0-9_-]{1,72}$/.test(role)) {
    throw new HttpsError('invalid-argument', 'Choose a valid school role.');
  }
  if (!getApps().length) initializeApp();
  const db = getFirestore();
  const auth = getAuth();
  const schoolRef = db.doc(`schools/${schoolId}`);
  const [schoolSnap, callerMemberSnap] = await Promise.all([
    schoolRef.get(), schoolRef.collection('members').doc(callerUid).get(),
  ]);
  if (!schoolSnap.exists) throw new HttpsError('not-found', 'The selected school does not exist.');
  const school = schoolSnap.data();
  if (!canProvision({ creatorUid: school.creatorUid, callerUid, member: callerMemberSnap.data(), school, role })) {
    throw new HttpsError('permission-denied', 'Your school role does not allow creating this account.');
  }
  if (role !== 'student' && !BUILTIN_ROLES.has(role)) {
    const roleSnap = await schoolRef.collection('roles').doc(role).get();
    if (!roleSnap.exists) throw new HttpsError('invalid-argument', 'The selected custom role does not exist.');
  }
  let user;
  let createdAuthUser = false;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw new HttpsError('internal', 'Could not check the account email.');
  }
  if (!user) {
    if (password.length < 6 || password.length > 128) {
      throw new HttpsError('invalid-argument', 'An initial password of 6 to 128 characters is required for a new account.');
    }
    try {
      user = await auth.createUser({ email, password, displayName: name });
      createdAuthUser = true;
    } catch (error) {
      if (error.code === 'auth/email-already-exists') user = await auth.getUserByEmail(email);
      else throw new HttpsError('invalid-argument', 'Could not create the account. Check the email and password.');
    }
  }
  const uid = user.uid;
  const memberRef = schoolRef.collection('members').doc(uid);
  const [existingMember, existingProfile] = await Promise.all([memberRef.get(), db.doc(`users/${uid}`).get()]);
  if (existingMember.exists) {
    const existing = existingMember.data();
    if (existing.role !== role) throw new HttpsError('already-exists', 'This account already belongs to the school with a different role. Edit its membership instead.');
    if (existing.status === 'active') {
      if (role !== 'student') return { uid, email, name: existing.name || name, role, isExisting: true, alreadyMember: true };
      const requestedClasses = safeList(extra.assignedClasses);
      if (requestedClasses.length && !canEditStudentCourses({ creatorUid: school.creatorUid, callerUid, member: callerMemberSnap.data(), school })) {
        throw new HttpsError('permission-denied', 'This student already belongs to the school. Editing their courses is disabled for teachers.');
      }
      const studentRef = schoolRef.collection('students').doc(uid);
      const studentSnap = await studentRef.get();
      if (!studentSnap.exists || requestedClasses.length) {
        const batch = db.batch();
        if (!studentSnap.exists) {
          batch.set(studentRef, { ...roleData({ role, uid, email, name, extra }), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        } else {
          const existingClasses = studentSnap.data()?.assignedClasses;
          const assignedClasses = Array.isArray(existingClasses)
            ? FieldValue.arrayUnion(...requestedClasses)
            : [...new Set([...(typeof existingClasses === 'string' && existingClasses.trim() ? [existingClasses.trim()] : []), ...requestedClasses])];
          batch.update(studentRef, { assignedClasses, updatedAt: FieldValue.serverTimestamp() });
        }
        await batch.commit();
      }
      return { uid, email, name: existing.name || name, role, isExisting: true, alreadyMember: true, updatedEnrollment: requestedClasses.length > 0 };
    }
  }
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  if (!existingProfile.exists) {
    batch.set(db.doc(`users/${uid}`), { uid, email, displayName: user.displayName || name, name: user.displayName || name, createdAt: now, updatedAt: now });
  }
  batch.set(memberRef, { uid, email, name, role, status: 'active', joinedAt: existingMember.data()?.joinedAt || now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`users/${uid}/schoolLinks/${schoolId}`), {
    schoolId, schoolName: safeString(school.name, 200) || 'School', role, status: 'active', joinedAt: now,
  }, { merge: true });
  const record = roleData({ role, uid, email, name, extra });
  const directory = role === 'student' ? 'students' : 'staff';
  batch.set(schoolRef.collection(directory).doc(uid), { ...record, createdAt: now, updatedAt: now }, { merge: true });
  try {
    await batch.commit();
  } catch (error) {
    if (createdAuthUser) await auth.deleteUser(uid).catch(deleteError => console.error('Could not clean up newly created account:', deleteError));
    console.error('Account provisioning failed:', error);
    throw new HttpsError('internal', 'Could not link the account to the school. Please retry.');
  }
  return { uid, email, name, role, isExisting: !createdAuthUser, alreadyMember: false };
}

export async function removeStudent(request) {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in before removing a student.');
  const schoolId = safeString(request.data?.schoolId, 128);
  const studentUid = safeString(request.data?.studentUid, 128);
  if (!schoolId || schoolId.includes('/') || !studentUid || studentUid.includes('/') || callerUid === studentUid) {
    throw new HttpsError('invalid-argument', 'Choose a valid student and school.');
  }
  if (!getApps().length) initializeApp();
  const db = getFirestore();
  const schoolRef = db.doc(`schools/${schoolId}`);
  const [schoolSnap, callerSnap, studentSnap, targetMemberSnap] = await Promise.all([
    schoolRef.get(), schoolRef.collection('members').doc(callerUid).get(),
    schoolRef.collection('students').doc(studentUid).get(), schoolRef.collection('members').doc(studentUid).get(),
  ]);
  if (!schoolSnap.exists || !studentSnap.exists) throw new HttpsError('not-found', 'Student or school not found.');
  if (targetMemberSnap.exists && targetMemberSnap.data().role !== 'student') throw new HttpsError('permission-denied', 'This account is not a student in this school.');
  const school = schoolSnap.data();
  const caller = callerSnap.data();
  const isAdmin = callerUid === school.creatorUid || (caller?.status === 'active' && caller.role === 'admin');
  const teacherMayDelete = caller?.status === 'active' && ['teacher', 'dept_head'].includes(caller.role) &&
    school.rolePermissions?.teacher?.students !== false && school.rolePermissions?.teacher?.canEditDeleteStudents !== false;
  if (!isAdmin && !teacherMayDelete) throw new HttpsError('permission-denied', 'Your role cannot remove students.');
  const batch = db.batch();
  batch.delete(studentSnap.ref);
  if (targetMemberSnap.exists) batch.delete(targetMemberSnap.ref);
  batch.delete(db.doc(`users/${studentUid}/schoolLinks/${schoolId}`));
  await batch.commit();
  return { removed: true };
}

export async function updateStaffMember(request) {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in before editing staff.');
  const schoolId = safeString(request.data?.schoolId, 128);
  const staffUid = safeString(request.data?.staffUid, 128);
  const updates = request.data?.updates;
  if (!schoolId || schoolId.includes('/') || !staffUid || staffUid.includes('/') || !updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new HttpsError('invalid-argument', 'Choose a valid staff member and school.');
  }
  if (!getApps().length) initializeApp();
  const db = getFirestore();
  const schoolRef = db.doc(`schools/${schoolId}`);
  const [schoolSnap, callerSnap, staffSnap, targetSnap] = await Promise.all([
    schoolRef.get(), schoolRef.collection('members').doc(callerUid).get(),
    schoolRef.collection('staff').doc(staffUid).get(), schoolRef.collection('members').doc(staffUid).get(),
  ]);
  if (!schoolSnap.exists || !staffSnap.exists || !targetSnap.exists) throw new HttpsError('not-found', 'School staff membership not found.');
  const school = schoolSnap.data();
  const caller = callerSnap.data();
  if (callerUid !== school.creatorUid && !(caller?.status === 'active' && caller.role === 'admin')) {
    throw new HttpsError('permission-denied', 'Only administrators can edit staff roles.');
  }
  const role = safeString(updates.roleId, 80) || targetSnap.data().role;
  if (role === 'student' || (!BUILTIN_ROLES.has(role) && !/^custom_[A-Za-z0-9_-]{1,72}$/.test(role))) {
    throw new HttpsError('invalid-argument', 'Choose a valid staff role.');
  }
  if (staffUid === school.creatorUid && role !== 'admin') throw new HttpsError('permission-denied', 'The school creator must remain an administrator.');
  if (!BUILTIN_ROLES.has(role) && !(await schoolRef.collection('roles').doc(role).get()).exists) {
    throw new HttpsError('invalid-argument', 'The custom role no longer exists.');
  }
  const now = FieldValue.serverTimestamp();
  const staffUpdates = {
    name: safeString(updates.name) || staffSnap.data().name,
    staffId: safeString(updates.staffId, 50) || staffSnap.data().staffId,
    role, roleId: role, roleName: safeString(updates.roleName, 100) || role,
    phone: safeString(updates.phone, 60), department: safeString(updates.department, 100),
    subject: safeString(updates.subject, 100), room: safeString(updates.room, 100),
    bio: safeString(updates.bio, 2000), experience: safeString(updates.experience, 100),
    classes: Number.isFinite(Number(updates.classes)) ? Math.max(0, Number(updates.classes)) : 0,
    updatedAt: now,
  };
  const batch = db.batch();
  batch.update(staffSnap.ref, staffUpdates);
  batch.update(targetSnap.ref, { role, name: staffUpdates.name, updatedAt: now });
  batch.set(db.doc(`users/${staffUid}/schoolLinks/${schoolId}`), { schoolId, schoolName: safeString(school.name) || 'School', role, status: 'active', updatedAt: now }, { merge: true });
  await batch.commit();
  return { updated: true, role };
}
