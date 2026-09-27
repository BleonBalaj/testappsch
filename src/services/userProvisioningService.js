import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile, 
  signOut, 
  connectAuthEmulator 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { firebaseConfig, db as primaryDb } from './firebase';

const SECONDARY_APP_NAME = 'LumiSchoolSecondaryAuth';

function getSecondaryAuth() {
  let secondaryApp = getApps().find(app => app.name === SECONDARY_APP_NAME);
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  }

  const secondaryAuth = getAuth(secondaryApp);

  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    const host = import.meta.env.VITE_EMULATOR_HOST || 'localhost';
    const authPort = Number(import.meta.env.VITE_AUTH_EMULATOR_PORT) || 9099;
    try {
      connectAuthEmulator(secondaryAuth, `http://${host}:${authPort}`, { disableWarnings: true });
    } catch {
      // Already connected
    }
  }

  return { secondaryApp, secondaryAuth };
}

/**
 * Creates a new user in Firebase Auth and provisions their Firestore documents
 * without disturbing the currently logged-in administrator session.
 */
export async function provisionNewUser({
  email,
  password,
  name,
  role = 'student',
  schoolId,
  schoolName = '',
  extraData = {}
}) {
  if (!email || !email.includes('@')) {
    throw new Error('A valid email address is required.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (name || cleanEmail.split('@')[0]).trim();

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  if (!schoolId) {
    throw new Error('Active school ID is required to provision a user.');
  }

  const { secondaryAuth } = getSecondaryAuth();

  let uid = null;
  let isExisting = false;

  try {
    // 1. Create user in Firebase Authentication on isolated secondary app
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
    const newUser = userCredential.user;
    uid = newUser.uid;

    if (cleanName) {
      try {
        await updateProfile(newUser, { displayName: cleanName });
      } catch (profileErr) {
        console.warn('Could not update profile displayName:', profileErr);
      }
    }

    // Immediately sign out the secondary session so no credentials linger
    await signOut(secondaryAuth).catch(() => {});
  } catch (error) {
    // If email already in use, verify if it was created with this password (e.g. previous attempt)
    if (error.code === 'auth/email-already-in-use') {
      try {
        const cred = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, password);
        uid = cred.user.uid;
        isExisting = true;
        if (cleanName && (!cred.user.displayName || cred.user.displayName !== cleanName)) {
          await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
        }
        await signOut(secondaryAuth).catch(() => {});
      } catch (signInErr) {
        // Different password or disabled; try finding UID from Firestore users
        try {
          const usersQuery = query(collection(primaryDb, 'users'), where('email', '==', cleanEmail));
          const userSnap = await getDocs(usersQuery);
          if (!userSnap.empty) {
            uid = userSnap.docs[0].id;
            isExisting = true;
          } else {
            throw new Error(`The email "${cleanEmail}" is already registered in Firebase with a different password. Please use their existing credentials.`);
          }
        } catch (findErr) {
          throw new Error(findErr.message || `The email "${cleanEmail}" already exists in Firebase.`);
        }
      }
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use at least 6 characters.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.');
    } else {
      console.error('Error in secondary user creation:', error);
      throw new Error(error.message || 'Failed to create user in Firebase Authentication.');
    }
  }

  if (!uid) {
    throw new Error('Could not resolve user UID in Firebase.');
  }

  // 2. Provision all Firestore documents using primaryDb (authenticated as school admin)
  const now = serverTimestamp();

  // 2a. Global users/{uid} profile document
  const userDocRef = doc(primaryDb, 'users', uid);
  await setDoc(userDocRef, {
    uid,
    email: cleanEmail,
    displayName: cleanName,
    name: cleanName,
    role,
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  // 2b. School membership document (schools/{schoolId}/members/{uid})
  const memberRef = doc(primaryDb, 'schools', schoolId, 'members', uid);
  await setDoc(memberRef, {
    uid,
    email: cleanEmail,
    name: cleanName,
    role,
    status: 'active',
    joinedAt: now
  }, { merge: true });

  // 2c. User's school link (users/{uid}/schoolLinks/{schoolId})
  const linkRef = doc(primaryDb, 'users', uid, 'schoolLinks', schoolId);
  await setDoc(linkRef, {
    schoolId,
    schoolName: schoolName || 'School',
    role,
    status: 'active',
    joinedAt: now
  }, { merge: true });

  // 2d. Role-specific collection (students or staff)
  if (role === 'student') {
    const studentRef = doc(primaryDb, 'schools', schoolId, 'students', uid);
    await setDoc(studentRef, {
      ...extraData,
      id: uid,
      studentId: extraData.studentId || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: cleanName,
      email: cleanEmail,
      role: 'student',
      status: extraData.status || 'active',
      grade: extraData.grade || '10A',
      phone: extraData.phone || '',
      guardian: extraData.guardian || '',
      assignedClasses: extraData.assignedClasses || (extraData.assignedClassInput ? [extraData.assignedClassInput] : []),
      points: Number(extraData.points) || 500,
      gpa: Number(extraData.gpa) || 3.8,
      attendance: Number(extraData.attendance) || 100,
      createdAt: now,
      updatedAt: now
    }, { merge: true });
  } else {
    // Staff / Teacher
    const staffRef = doc(primaryDb, 'schools', schoolId, 'staff', uid);
    await setDoc(staffRef, {
      ...extraData,
      id: uid,
      staffId: extraData.staffId || `STF-${Math.floor(100 + Math.random() * 900)}`,
      name: cleanName,
      email: cleanEmail,
      role: role || extraData.roleId || 'teacher',
      roleId: extraData.roleId || role || 'teacher',
      roleName: extraData.roleName || (role === 'admin' ? 'Administrator' : 'Teacher'),
      status: extraData.status || 'active',
      phone: extraData.phone || '',
      department: extraData.department || 'General',
      subject: extraData.subject || '',
      classes: Number(extraData.classes) || 0,
      experience: extraData.experience || '1 year',
      room: extraData.room || '',
      bio: extraData.bio || '',
      joinDate: extraData.joinDate || new Date().toISOString().split('T')[0],
      createdAt: now,
      updatedAt: now
    }, { merge: true });
  }

  return {
    uid,
    email: cleanEmail,
    name: cleanName,
    role,
    isExisting
  };
}
