import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';
import { 
  doc, 
  collection, 
  onSnapshot, 
  setDoc, 
  getDoc,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [schoolLinks, setSchoolLinks] = useState([]);
  const [activeSchoolId, setActiveSchoolId] = useState(() => localStorage.getItem('lumi-active-school-id') || null);
  const [activeSchoolDoc, setActiveSchoolDoc] = useState(null);
  const [globalPreferences, setGlobalPreferences] = useState({ theme: 'dark', language: 'en' });
  const [schoolPreferences, setSchoolPreferences] = useState({});
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [userDocData, setUserDocData] = useState(null);

  // Helper to get fresh ID token
  const getIdTokenSafe = useCallback(async () => {
    if (!auth.currentUser) return null;
    const token = await auth.currentUser.getIdToken(true);
    setIdToken(token);
    return token;
  }, []);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setIdToken(token);
        } catch (e) {
          console.error('Error fetching token:', e);
        }
      } else {
        setIdToken(null);
        setSchoolLinks([]);
        setActiveSchoolDoc(null);
        setPendingInvitations([]);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Listen to user's school links in real-time: users/{uid}/schoolLinks
  useEffect(() => {
    if (!currentUser?.uid) {
      setSchoolLinks([]);
      return;
    }

    const linksCol = collection(db, 'users', currentUser.uid, 'schoolLinks');
    const unsubscribe = onSnapshot(linksCol, (snapshot) => {
      const links = [];
      snapshot.forEach((docSnap) => {
        links.push({ id: docSnap.id, ...docSnap.data() });
      });
      setSchoolLinks(links);

      // Auto-select school if none selected or if previously selected is invalid
      if (links.length > 0) {
        const storedId = localStorage.getItem('lumi-active-school-id');
        const match = links.find(l => l.schoolId === storedId);
        if (match) {
          setActiveSchoolId(match.schoolId);
        } else if (!activeSchoolId || !links.some(l => l.schoolId === activeSchoolId)) {
          const defaultSchoolId = links[0].schoolId;
          setActiveSchoolId(defaultSchoolId);
          localStorage.setItem('lumi-active-school-id', defaultSchoolId);
        }
      } else {
        setActiveSchoolId(null);
        localStorage.removeItem('lumi-active-school-id');
      }
    }, (err) => {
      console.error('Error listening to school links:', err);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, activeSchoolId]);

  // 3. Listen to active school details
  useEffect(() => {
    if (!activeSchoolId) {
      setActiveSchoolDoc(null);
      return;
    }

    const schoolRef = doc(db, 'schools', activeSchoolId);
    const unsubscribe = onSnapshot(schoolRef, (docSnap) => {
      if (docSnap.exists()) {
        setActiveSchoolDoc({ id: docSnap.id, ...docSnap.data() });
      } else {
        setActiveSchoolDoc(null);
      }
    }, (err) => {
      console.warn('Notice listening to active school doc:', err.message);
    });

    return () => unsubscribe();
  }, [activeSchoolId]);

  // 3b. Listen to user profile document in Firestore: users/{uid}
  useEffect(() => {
    if (!currentUser?.uid) {
      setUserDocData(null);
      return;
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        setUserDocData(snap.data());
      }
    }, (err) => {
      console.warn('Notice listening to user doc:', err.message);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // 4. Listen to global user preferences: users/{uid}/preferences/app
  useEffect(() => {
    if (!currentUser?.uid) return;

    const prefRef = doc(db, 'users', currentUser.uid, 'preferences', 'app');
    const unsubscribe = onSnapshot(prefRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGlobalPreferences(prev => ({ ...prev, ...data }));
        
        // Sync theme with document attribute
        if (data.theme) {
          const isLight = data.theme === 'light';
          if (isLight) {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('lumi-theme', 'light');
          } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('lumi-theme', 'dark');
          }
          localStorage.setItem('lumi-theme-mode', data.theme);
        }
      }
    }, (err) => {
      console.warn('Notice listening to global preferences:', err.message);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // 5. Listen to per-school user preferences: users/{uid}/schoolPreferences/{schoolId}
  useEffect(() => {
    if (!currentUser?.uid || !activeSchoolId) {
      setSchoolPreferences({});
      return;
    }

    const schoolPrefRef = doc(db, 'users', currentUser.uid, 'schoolPreferences', activeSchoolId);
    const unsubscribe = onSnapshot(schoolPrefRef, (docSnap) => {
      if (docSnap.exists()) {
        setSchoolPreferences(docSnap.data());
      } else {
        setSchoolPreferences({});
      }
    }, (err) => {
      console.warn('Notice listening to school preferences:', err.message);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, activeSchoolId]);

  // 6. Fetch pending invitations for user
  const refreshPendingInvitations = useCallback(async () => {
    if (!currentUser) return;
    try {
      setInvitationsLoading(true);
      const token = await getIdTokenSafe();
      const res = await fetch('/api/invitations/my-invitations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingInvitations(data.invitations || []);
      }
    } catch (e) {
      console.warn('Error fetching pending invitations:', e);
    } finally {
      setInvitationsLoading(false);
    }
  }, [currentUser, getIdTokenSafe]);

  useEffect(() => {
    if (currentUser?.email) {
      refreshPendingInvitations();
    }
  }, [currentUser?.email, refreshPendingInvitations]);

  // Derive current role strictly from the active school membership!
  const currentRole = useMemo(() => {
    if (!activeSchoolId || !schoolLinks.length) return 'student';
    const link = schoolLinks.find(l => l.schoolId === activeSchoolId);
    return link ? link.role : 'student';
  }, [activeSchoolId, schoolLinks]);

  // Email existence pre-check (Strict email-first signup flow)
  const checkEmailExists = async (email) => {
    const res = await fetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to check email status');
    }
    const data = await res.json();
    return data.exists;
  };

  // Sign in existing user
  const loginUser = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  };

const DEFAULT_SCHOOL_ROLES = [
  { id: 'admin', name: 'Administrator', category: 'Administration', color: '335 70% 65%', icon: 'Shield', description: 'Full access to school systems, staff management & policies' },
  { id: 'teacher', name: 'Teacher', category: 'Academic', color: '142 70% 45%', icon: 'GraduationCap', description: 'Curriculum delivery, student assessments, class management' },
  { id: 'counselor', name: 'Academic Counselor', category: 'Student Support', color: '270 65% 60%', icon: 'HeartHandshake', description: 'Student guidance, mental wellness, academic planning' },
  { id: 'dept_head', name: 'Head of Department', category: 'Academic Leadership', color: '215 85% 60%', icon: 'Award', description: 'Department curriculum supervision and faculty leadership' },
  { id: 'support', name: 'Staff / Specialist', category: 'Support', color: '38 92% 50%', icon: 'Briefcase', description: 'Operational support, lab management, and student services' }
];

  // Sign up new user and provision new school where user is admin
  const registerNewUserAndSchool = async ({ email, password, fullName, schoolName }) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const user = userCredential.user;

    if (fullName) {
      await updateProfile(user, { displayName: fullName.trim() });
    }

    const schoolId = `sch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = serverTimestamp();
    const cleanSchoolName = schoolName.trim();
    const userName = fullName?.trim() || email.trim().split('@')[0];

    // 1. School doc
    await setDoc(doc(db, 'schools', schoolId), {
      id: schoolId,
      name: cleanSchoolName,
      creatorUid: user.uid,
      creatorEmail: email.trim(),
      academicYear: '2024-2025',
      createdAt: now,
      updatedAt: now,
      settings: {
        branding: { primaryColor: '335 70% 70%' },
        timezone: 'America/New_York'
      }
    });

    // 2. Member doc
    await setDoc(doc(db, 'schools', schoolId, 'members', user.uid), {
      uid: user.uid,
      email: email.trim(),
      name: userName,
      role: 'admin',
      status: 'active',
      joinedAt: now
    });

    // 2b. Staff doc — admin must appear in the Staff Directory
    await setDoc(doc(db, 'schools', schoolId, 'staff', user.uid), {
      id: user.uid,
      staffId: `STF-001`,
      name: userName,
      email: email.trim(),
      phone: '',
      roleId: 'admin',
      roleName: 'Administrator',
      department: 'Administration',
      subject: 'School Management',
      classes: 0,
      experience: '',
      room: '',
      bio: '',
      rating: '5.0',
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0],
      createdAt: now
    });

    // 3. User school link
    await setDoc(doc(db, 'users', user.uid, 'schoolLinks', schoolId), {
      schoolId,
      schoolName: cleanSchoolName,
      role: 'admin',
      status: 'active',
      joinedAt: now
    });

    // 4. Default roles
    for (const r of DEFAULT_SCHOOL_ROLES) {
      await setDoc(doc(db, 'schools', schoolId, 'roles', r.id), {
        ...r,
        createdAt: now
      });
    }

    // 5. Global preferences
    await setDoc(doc(db, 'users', user.uid, 'preferences', 'app'), {
      theme: localStorage.getItem('lumi-theme-mode') || 'dark',
      language: 'en'
    }, { merge: true });

    // 6. School preferences
    await setDoc(doc(db, 'users', user.uid, 'schoolPreferences', schoolId), {
      schoolId,
      lessonInterval: 15,
      rememberLastUsed: false,
      updatedAt: now
    }, { merge: true });

    setActiveSchoolId(schoolId);
    localStorage.setItem('lumi-active-school-id', schoolId);

    return { user, school: { schoolId, schoolName: cleanSchoolName } };
  };

  // Create a brand new school from switcher (for existing user)
  const createNewSchool = async (schoolName, academicYear = '2024-2025') => {
    if (!currentUser?.uid) throw new Error('Must be authenticated');
    const schoolId = `sch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = serverTimestamp();
    const cleanSchoolName = schoolName.trim();
    const userName = currentUser.displayName || currentUser.email.split('@')[0];

    // 1. School doc
    await setDoc(doc(db, 'schools', schoolId), {
      id: schoolId,
      name: cleanSchoolName,
      creatorUid: currentUser.uid,
      creatorEmail: currentUser.email,
      academicYear: academicYear.trim(),
      createdAt: now,
      updatedAt: now,
      settings: {
        branding: { primaryColor: '335 70% 70%' },
        timezone: 'America/New_York'
      }
    });

    // 2. Member doc
    await setDoc(doc(db, 'schools', schoolId, 'members', currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      name: userName,
      role: 'admin',
      status: 'active',
      joinedAt: now
    });

    // 2b. Staff doc — admin must appear in the Staff Directory
    await setDoc(doc(db, 'schools', schoolId, 'staff', currentUser.uid), {
      id: currentUser.uid,
      staffId: `STF-001`,
      name: userName,
      email: currentUser.email,
      phone: '',
      roleId: 'admin',
      roleName: 'Administrator',
      department: 'Administration',
      subject: 'School Management',
      classes: 0,
      experience: '',
      room: '',
      bio: '',
      rating: '5.0',
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0],
      createdAt: now
    });

    // 3. User school link
    await setDoc(doc(db, 'users', currentUser.uid, 'schoolLinks', schoolId), {
      schoolId,
      schoolName: cleanSchoolName,
      role: 'admin',
      status: 'active',
      joinedAt: now
    });

    // 4. Default roles
    for (const r of DEFAULT_SCHOOL_ROLES) {
      await setDoc(doc(db, 'schools', schoolId, 'roles', r.id), {
        ...r,
        createdAt: now
      });
    }

    // 5. School preferences
    await setDoc(doc(db, 'users', currentUser.uid, 'schoolPreferences', schoolId), {
      schoolId,
      lessonInterval: 15,
      rememberLastUsed: false,
      updatedAt: now
    }, { merge: true });

    setActiveSchoolId(schoolId);
    localStorage.setItem('lumi-active-school-id', schoolId);

    return { schoolId, schoolName: cleanSchoolName };
  };

  // Update school name (Admin only)
  const updateSchoolName = async (newName) => {
    if (!activeSchoolId || !newName.trim()) return;
    const clean = newName.trim();
    const schoolRef = doc(db, 'schools', activeSchoolId);
    await updateDoc(schoolRef, {
      name: clean,
      updatedAt: serverTimestamp()
    });
    if (currentUser?.uid) {
      const linkRef = doc(db, 'users', currentUser.uid, 'schoolLinks', activeSchoolId);
      await setDoc(linkRef, {
        schoolName: clean
      }, { merge: true });
    }
  };

  // Accept school invitation
  const acceptInvitation = async (schoolId, invitationId) => {
    const token = await getIdTokenSafe();
    const res = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ schoolId, invitationId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to accept invitation');
    }

    const data = await res.json();
    await refreshPendingInvitations();
    setActiveSchoolId(schoolId);
    localStorage.setItem('lumi-active-school-id', schoolId);
    return data;
  };

  // Decline school invitation
  const declineInvitation = async (schoolId, invitationId) => {
    const token = await getIdTokenSafe();
    const res = await fetch('/api/invitations/decline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ schoolId, invitationId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to decline invitation');
    }

    await refreshPendingInvitations();
  };

  // Switch school
  const switchSchool = useCallback((schoolId) => {
    const target = schoolLinks.find(l => l.schoolId === schoolId);
    if (!target) {
      console.warn('Cannot switch to school: user is not a verified member of', schoolId);
      return;
    }
    setActiveSchoolId(schoolId);
    localStorage.setItem('lumi-active-school-id', schoolId);
  }, [schoolLinks]);

  // Update global preferences (users/{uid}/preferences/app)
  const updateGlobalPreferences = async (patch) => {
    if (!currentUser?.uid) return;
    const prefRef = doc(db, 'users', currentUser.uid, 'preferences', 'app');
    await setDoc(prefRef, patch, { merge: true });
  };

  // Update per-school lesson plan & workflow preferences (users/{uid}/schoolPreferences/{schoolId})
  const updateSchoolPreferences = async (patch) => {
    if (!currentUser?.uid || !activeSchoolId) return;
    const schoolPrefRef = doc(db, 'users', currentUser.uid, 'schoolPreferences', activeSchoolId);
    await setDoc(schoolPrefRef, patch, { merge: true });
  };

  // Forgot password
  const resetUserPassword = async (email) => {
    return sendPasswordResetEmail(auth, email.trim());
  };

  // Sign out
  const logoutUser = async () => {
    await signOut(auth);
    localStorage.removeItem('lumi-active-school-id');
    setActiveSchoolId(null);
  };

  // Update user display name in Firebase Auth and Firestore
  const updateDisplayName = async (newName) => {
    if (!currentUser || !newName.trim()) return;
    const cleanName = newName.trim();
    // 1. Firebase Auth profile
    await updateProfile(auth.currentUser, { displayName: cleanName });
    // 2. Firestore users/{uid}
    await setDoc(doc(db, 'users', currentUser.uid), {
      displayName: cleanName,
      updatedAt: serverTimestamp()
    }, { merge: true });
    // 3. Firestore schools/{schoolId}/members/{uid} if active school exists
    if (activeSchoolId) {
      const memberRef = doc(db, 'schools', activeSchoolId, 'members', currentUser.uid);
      await setDoc(memberRef, {
        name: cleanName
      }, { merge: true });
    }
    // Refresh currentUser state
    setCurrentUser({ ...auth.currentUser, displayName: cleanName });
  };

  // Update user profile photo in Firestore and local state
  const updateUserPhoto = async (photoDataUrl) => {
    if (!currentUser?.uid) return;
    
    // 1. Save to local storage for instant sync across tabs and reloads
    try {
      if (photoDataUrl) {
        localStorage.setItem('lumi-user-avatar', photoDataUrl);
      } else {
        localStorage.removeItem('lumi-user-avatar');
      }
    } catch (e) {
      console.warn('LocalStorage avatar notice:', e);
    }

    // 2. Save to Firestore users/{uid}
    await setDoc(doc(db, 'users', currentUser.uid), {
      photoURL: photoDataUrl || null,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 3. Update member record in active school if exists
    if (activeSchoolId) {
      const memberRef = doc(db, 'schools', activeSchoolId, 'members', currentUser.uid);
      await setDoc(memberRef, {
        photoURL: photoDataUrl || null
      }, { merge: true });
    }

    // 4. Update Firebase Auth profile (clear if empty, or update if short non-base64 URL)
    if (auth.currentUser) {
      if (photoDataUrl && !photoDataUrl.startsWith('data:')) {
        try {
          await updateProfile(auth.currentUser, { photoURL: photoDataUrl });
        } catch (e) {
          console.warn('Firebase Auth updateProfile photoURL notice:', e.message);
        }
      } else if (!photoDataUrl) {
        try {
          await updateProfile(auth.currentUser, { photoURL: '' });
        } catch (e) {
          console.warn('Firebase Auth clear photoURL notice:', e.message);
        }
      }
    }

    // 5. Update local state
    setUserDocData(prev => ({ ...(prev || {}), photoURL: photoDataUrl || null }));
  };

  const effectiveUser = useMemo(() => {
    if (!currentUser) return null;
    const localAvatar = typeof localStorage !== 'undefined' ? localStorage.getItem('lumi-user-avatar') : null;
    let photoURL = null;
    if (userDocData && userDocData.photoURL !== undefined) {
      photoURL = userDocData.photoURL;
    } else if (localAvatar) {
      photoURL = localAvatar;
    } else {
      photoURL = currentUser.photoURL || null;
    }
    return {
      ...currentUser,
      ...(userDocData || {}),
      displayName: userDocData?.displayName || userDocData?.name || currentUser.displayName,
      name: userDocData?.name || userDocData?.displayName || currentUser.displayName,
      photoURL
    };
  }, [currentUser, userDocData]);

  // Change password with accurate current password verification
  const changeUserPassword = async (currentPassword, newPassword) => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('No active user session found.');
    }
    if (!currentPassword) {
      throw new Error('Current password is required.');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    try {
      await reauthenticateWithCredential(auth.currentUser, credential);
    } catch (authErr) {
      if (
        authErr.code === 'auth/wrong-password' || 
        authErr.code === 'auth/invalid-credential' || 
        authErr.code === 'auth/invalid-login-credentials'
      ) {
        throw new Error('Current password is incorrect. Please re-enter your current password.');
      }
      throw authErr;
    }

    await updatePassword(auth.currentUser, newPassword);
  };

  const value = {
    currentUser: effectiveUser,
    idToken,
    authLoading,
    schoolLinks,
    activeSchoolId,
    activeSchool: activeSchoolDoc,
    currentRole,
    globalPreferences,
    schoolPreferences,
    pendingInvitations,
    invitationsLoading,
    checkEmailExists,
    loginUser,
    registerNewUserAndSchool,
    createNewSchool,
    updateSchoolName,
    updateDisplayName,
    updateUserPhoto,
    changeUserPassword,
    acceptInvitation,
    declineInvitation,
    switchSchool,
    updateGlobalPreferences,
    updateSchoolPreferences,
    resetUserPassword,
    logoutUser,
    refreshPendingInvitations,
    getIdTokenSafe
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
