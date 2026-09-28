import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  arrayUnion,
  collection, 
  doc, 
  getDoc,
  limit,
  onSnapshot, 
  query,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  where,
  writeBatch,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { functions } from '../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from './AuthContext';
import { provisionNewUser } from '../services/userProvisioningService';
import { classGroupLabel, cleanSection, sortClassGroups } from '../features/classGroups';
import { explicitCourseAssignments } from '../features/enrollment';
import { studentSearchFields } from '../features/students/studentSearch';

// Keep in step with DIRECTORY_VERSION in functions/schoolDirectory.js.
const DIRECTORY_VERSION = 1;
const WRITE_CHUNK = 400;
const STAFF_ROLES = ['admin', 'teacher', 'dept_head'];

async function commitInChunks(operations) {
  for (let index = 0; index < operations.length; index += WRITE_CHUNK) {
    const batch = writeBatch(db);
    operations.slice(index, index + WRITE_CHUNK).forEach(apply => apply(batch));
    await batch.commit();
  }
}

const INITIAL_ROLES = [
  { id: 'admin', name: 'Administrator', category: 'Administration', color: '335 70% 65%', icon: 'Shield', description: 'Full access to school systems, staff management & policies' },
  { id: 'teacher', name: 'Teacher', category: 'Academic', color: '142 70% 45%', icon: 'GraduationCap', description: 'Curriculum delivery, student assessments, class management' },
  { id: 'counselor', name: 'Academic Counselor', category: 'Student Support', color: '270 65% 60%', icon: 'HeartHandshake', description: 'Student guidance, mental wellness, academic planning' },
  { id: 'dept_head', name: 'Head of Department', category: 'Academic Leadership', color: '215 85% 60%', icon: 'Award', description: 'Department curriculum supervision and faculty leadership' },
  { id: 'support', name: 'Staff / Specialist', category: 'Support', color: '38 92% 50%', icon: 'Briefcase', description: 'Operational support, lab management, and student services' }
];

export const DEFAULT_ROLE_PERMISSIONS = {
  student: {
    dashboard: true,
    schedule: true,
    classes: true,
    transcript: true,
    tasks: true,
    messages: true,
    leaderboard: true,
    events: true,
    resources: false,
    'mood-insights': true,
    students: false,
    staff: false,
    'lesson-plans': false,
  },
  teacher: {
    dashboard: true,
    schedule: true,
    classes: true,
    'lesson-plans': true,
    tasks: true,
    messages: true,
    students: true,
    staff: true,
    leaderboard: true,
    events: true,
    resources: true,
    'mood-insights': true,
    transcript: false,
    canEditDeleteClasses: true,
    canEditDeleteStudents: true,
  }
};

const SchoolDataContext = createContext(null);

export const SchoolDataProvider = ({ children }) => {
  const { activeSchoolId, activeSchool, currentUser, currentRole, roleReady } = useAuth();

  const [staffList, setStaffList] = useState([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [rolesList, setRolesList] = useState(INITIAL_ROLES);
  const [classesList, setClassesList] = useState([]);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [classesError, setClassesError] = useState(null);
  const [classGroups, setClassGroups] = useState([]);
  const [classGroupsLoaded, setClassGroupsLoaded] = useState(false);
  const [classGroupsError, setClassGroupsError] = useState(null);
  const [eventsList, setEventsList] = useState([]);
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);
  // Bumped after this browser changes students so server-side counts refresh.
  const [studentsVersion, setStudentsVersion] = useState(0);
  const [myStudentState, setMyStudentState] = useState({ key: '', record: null });
  const [directoryState, setDirectoryState] = useState({ schoolId: null, status: 'idle' });

  const isSeedingRolesRef = useRef(false);
  const preparedSchoolsRef = useRef(new Set());
  const bumpStudentsVersion = useCallback(() => setStudentsVersion(version => version + 1), []);

  // Realtime listeners partitioned strictly by activeSchoolId
  useEffect(() => {
    if (!activeSchoolId) {
      setStaffList([]);
      setStaffLoaded(true);
      setClassesList([]);
      setClassesLoaded(true);
      setClassesError(null);
      setClassGroups([]);
      setClassGroupsLoaded(true);
      setClassGroupsError(null);
      setEventsList([]);
      setRolesList(INITIAL_ROLES);
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      return;
    }

    setStaffList([]);
    setStaffLoaded(false);
    setClassesList([]);
    setClassesLoaded(false);
    setClassesError(null);
    setClassGroups([]);
    setClassGroupsLoaded(false);
    setClassGroupsError(null);
    setEventsList([]);
    setRolesList(INITIAL_ROLES);
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);

    const handleSnapshotError = (colName) => (err) => {
      console.warn(`Snapshot listener notice for ${colName}:`, err.message);
      if (colName === 'classes') { setClassesLoaded(true); setClassesError(err.message || 'Course data is unavailable.'); }
      if (colName === 'classGroups') { setClassGroupsLoaded(true); setClassGroupsError(err.message || 'Class data is unavailable.'); }
      if (colName === 'staff') setStaffLoaded(true);
    };

    // 1. Roles Listener
    const rolesCol = collection(db, 'schools', activeSchoolId, 'roles');
    const unsubRoles = onSnapshot(rolesCol, async (snapshot) => {
      if (snapshot.empty && !isSeedingRolesRef.current) {
        // Seed default roles schema if completely missing
        isSeedingRolesRef.current = true;
        try {
          const batch = writeBatch(db);
          for (const r of INITIAL_ROLES) {
            batch.set(doc(rolesCol, r.id), { ...r, createdAt: serverTimestamp() });
          }
          await batch.commit();
        } catch (e) {
          console.warn('Could not seed school roles:', e.message);
        } finally {
          isSeedingRolesRef.current = false;
        }
      } else {
        const roles = [];
        snapshot.forEach(docSnap => {
          roles.push({ id: docSnap.id, ...docSnap.data() });
        });
        setRolesList(roles.length ? roles : INITIAL_ROLES);
      }
    }, handleSnapshotError('roles'));

    // 2. Staff Listener (Live production data from Firestore, empty initially)
    const staffCol = collection(db, 'schools', activeSchoolId, 'staff');
    const unsubStaff = onSnapshot(staffCol, async (snapshot) => {
      const staff = [];
      snapshot.forEach(docSnap => {
        staff.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Self-heal: if the school creator (admin) has no staff doc yet, write one now
      const schoolSnap = await import('firebase/firestore').then(({ getDoc }) =>
        getDoc(doc(db, 'schools', activeSchoolId))
      ).catch(() => null);
      if (schoolSnap?.exists()) {
        const schoolData = schoolSnap.data();
        const creatorUid = schoolData?.creatorUid;

        const computeAdminName = (currentDocName, email) => {
          if (currentDocName && currentDocName.toLowerCase() !== 'administrator' && currentDocName.toLowerCase() !== 'admin') {
            return currentDocName;
          }
          if (currentUser?.uid === creatorUid && currentUser?.displayName) {
            return currentUser.displayName;
          }
          if (schoolData.creatorName && schoolData.creatorName.toLowerCase() !== 'administrator' && schoolData.creatorName.toLowerCase() !== 'admin') {
            return schoolData.creatorName;
          }
          const userEmail = email || (currentUser?.uid === creatorUid ? currentUser?.email : schoolData.creatorEmail) || '';
          if (userEmail) {
            const prefix = userEmail.split('@')[0];
            return prefix.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          }
          return 'Administrator';
        };

        if (creatorUid && !staff.some(s => String(s.id) === String(creatorUid))) {
          const adminEmail = schoolData.creatorEmail || (currentUser?.uid === creatorUid ? currentUser?.email : '');
          const adminName = computeAdminName(null, adminEmail);
          const adminStaffDoc = {
            id: creatorUid,
            staffId: 'STF-001',
            name: adminName,
            email: adminEmail,
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
            createdAt: serverTimestamp()
          };
          try {
            await setDoc(doc(db, 'schools', activeSchoolId, 'staff', creatorUid), adminStaffDoc);
            // The snapshot listener will re-fire and include this doc — return early
            return;
          } catch (e) {
            console.warn('Could not auto-create admin staff doc:', e.message);
            // Fall through and show what we have
            staff.push({ ...adminStaffDoc, createdAt: null });
          }
        } else {
          // If admin doc already exists in staff, check if name is generic 'Administrator' and heal it
          for (const s of staff) {
            if (s.roleId === 'admin' || String(s.id) === String(creatorUid)) {
              if (!s.name || s.name.toLowerCase() === 'administrator' || s.name.toLowerCase() === 'admin') {
                const betterName = computeAdminName(s.name, s.email);
                if (betterName && betterName.toLowerCase() !== 'administrator' && betterName.toLowerCase() !== 'admin') {
                  s.name = betterName;
                  try {
                    await updateDoc(doc(db, 'schools', activeSchoolId, 'staff', s.id), { name: betterName });
                  } catch (error) { console.warn('Could not update the school creator name:', error); }
                }
              }
            }
          }
        }
      }

      setStaffList(staff);
      setStaffLoaded(true);
    }, handleSnapshotError('staff'));

    // 3. Homeroom classes (10A, 10B...). A school has tens of these, so one
    // live listener serves every page. Student records are never loaded in
    // bulk; pages query the students they show (see features/students).
    const classGroupsCol = collection(db, 'schools', activeSchoolId, 'classGroups');
    const unsubClassGroups = onSnapshot(classGroupsCol, (snapshot) => {
      setClassGroups(sortClassGroups(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))));
      setClassGroupsLoaded(true);
      setClassGroupsError(null);
    }, handleSnapshotError('classGroups'));

    // 4. Classes Listener (Live production data from Firestore, empty initially)
    const classesCol = collection(db, 'schools', activeSchoolId, 'classes');
    const unsubClasses = onSnapshot(classesCol, (snapshot) => {
      const cls = [];
      snapshot.forEach(docSnap => {
        cls.push({ id: docSnap.id, ...docSnap.data() });
      });
      setClassesList(cls);
      setClassesLoaded(true);
      setClassesError(null);
    }, handleSnapshotError('classes'));

    // 5. Events Listener (Live production data from Firestore, empty initially)
    const eventsCol = collection(db, 'schools', activeSchoolId, 'events');
    const unsubEvents = onSnapshot(eventsCol, (snapshot) => {
      const evs = [];
      snapshot.forEach(docSnap => {
        evs.push({ id: docSnap.id, ...docSnap.data() });
      });
      setEventsList(evs);
    }, handleSnapshotError('events'));

    // 6. School Document Listener (rolePermissions)
    const schoolDocRef = doc(db, 'schools', activeSchoolId);
    const unsubSchool = onSnapshot(schoolDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.rolePermissions) {
          setRolePermissions({
            student: { ...DEFAULT_ROLE_PERMISSIONS.student, ...(data.rolePermissions.student || {}) },
            teacher: { ...DEFAULT_ROLE_PERMISSIONS.teacher, ...(data.rolePermissions.teacher || {}) },
          });
        }
      }
    }, handleSnapshotError('school'));

    return () => {
      unsubRoles();
      unsubStaff();
      unsubClassGroups();
      unsubClasses();
      unsubEvents();
      unsubSchool();
    };
  }, [activeSchoolId]);

  // The signed-in person's own student record (none for staff).
  const myStudentKey = activeSchoolId && currentUser?.uid ? `${activeSchoolId}|${currentUser.uid}` : '';
  const isStudentRole = roleReady && currentRole === 'student';
  const userEmail = (currentUser?.email || '').toLowerCase();
  useEffect(() => {
    if (!myStudentKey) return undefined;
    const students = collection(db, 'schools', activeSchoolId, 'students');
    let fallbackUnsubscribe = null;
    const unsubscribe = onSnapshot(doc(students, currentUser.uid), (snapshot) => {
      if (snapshot.exists()) {
        fallbackUnsubscribe?.();
        fallbackUnsubscribe = null;
        setMyStudentState({ key: myStudentKey, record: { id: snapshot.id, ...snapshot.data() } });
        return;
      }
      // Older records may be keyed by something other than the account id.
      if (isStudentRole && userEmail && !fallbackUnsubscribe) {
        fallbackUnsubscribe = onSnapshot(query(students, where('email', '==', userEmail), limit(1)),
          (result) => setMyStudentState({ key: myStudentKey, record: result.empty ? null : { id: result.docs[0].id, ...result.docs[0].data() } }),
          () => setMyStudentState({ key: myStudentKey, record: null }));
        return;
      }
      if (!fallbackUnsubscribe) setMyStudentState({ key: myStudentKey, record: null });
    }, () => setMyStudentState({ key: myStudentKey, record: null }));
    return () => { unsubscribe(); fallbackUnsubscribe?.(); };
  }, [myStudentKey, activeSchoolId, currentUser?.uid, isStudentRole, userEmail]);
  const myStudentRecord = myStudentState.key === myStudentKey ? myStudentState.record : null;
  const myStudentLoaded = !myStudentKey || myStudentState.key === myStudentKey;

  // One-time upgrade of older student records (search and sort fields) so the
  // directory can page and search on the server. Staff sessions trigger it.
  const schoolDocCurrent = activeSchool?.id === activeSchoolId;
  const directoryReady = schoolDocCurrent && Number(activeSchool?.directoryVersion || 0) >= DIRECTORY_VERSION;
  const canPrepareDirectory = roleReady && STAFF_ROLES.includes(currentRole);
  useEffect(() => {
    if (!activeSchoolId || !schoolDocCurrent || directoryReady || !canPrepareDirectory) return undefined;
    if (preparedSchoolsRef.current.has(activeSchoolId)) return undefined;
    preparedSchoolsRef.current.add(activeSchoolId);
    const schoolId = activeSchoolId;
    let active = true;
    Promise.resolve()
      .then(() => { if (active) setDirectoryState({ schoolId, status: 'preparing' }); })
      .then(() => httpsCallable(functions, 'prepareSchoolDirectory')({ schoolId }))
      .then(() => { setDirectoryState({ schoolId, status: 'done' }); setStudentsVersion(version => version + 1); })
      .catch((error) => {
        console.warn('Could not prepare the student directory:', error?.message || error);
        preparedSchoolsRef.current.delete(schoolId);
        setDirectoryState({ schoolId, status: 'error' });
      });
    return () => { active = false; };
  }, [activeSchoolId, schoolDocCurrent, directoryReady, canPrepareDirectory]);
  const directoryStatus = directoryReady ? 'ready'
    : directoryState.schoolId === activeSchoolId && directoryState.status !== 'idle' ? directoryState.status : 'pending';

  // Staff Handlers
  const addStaff = useCallback(async (newStaff) => {
    if (!activeSchoolId) throw new Error('Select a school first.');
    if (!newStaff.email) throw new Error('A staff email is required to create an account.');
    return provisionNewUser({
      email: newStaff.email,
      password: newStaff.password,
      name: newStaff.name,
      role: newStaff.roleId || 'teacher',
      schoolId: activeSchoolId,
      schoolName: activeSchool?.name || '',
      extraData: newStaff
    });
  }, [activeSchoolId, activeSchool?.name]);

  const updateStaff = useCallback(async (id, updates) => {
    if (!activeSchoolId) throw new Error('Select a school first.');
    await httpsCallable(functions, 'updateSchoolStaff')({ schoolId: activeSchoolId, staffUid: String(id), updates });
  }, [activeSchoolId]);

  const deleteStaff = useCallback(async (id) => {
    if (!activeSchoolId) return;
    const uid = String(id);
    const batch = writeBatch(db);
    // Remove staff record
    batch.delete(doc(db, 'schools', activeSchoolId, 'staff', uid));
    // Remove school membership (so the user can no longer authenticate as a member)
    batch.delete(doc(db, 'schools', activeSchoolId, 'members', uid));
    await batch.commit();
    // Remove the user's school link (best-effort, non-critical)
    try {
      await deleteDoc(doc(db, 'users', uid, 'schoolLinks', activeSchoolId));
    } catch (e) {
      console.warn('Could not remove schoolLink for', uid, e.message);
    }
  }, [activeSchoolId]);

  // Custom Roles Handlers
  const addCustomRole = useCallback(async (roleData) => {
    if (!activeSchoolId) return;
    const roleId = roleData.id || `custom_${Date.now()}`;
    const roleDocRef = doc(db, 'schools', activeSchoolId, 'roles', roleId);
    const newRole = {
      ...roleData,
      id: roleId,
      isCustom: true,
      createdAt: serverTimestamp()
    };
    await setDoc(roleDocRef, newRole);
    return newRole;
  }, [activeSchoolId]);

  const deleteCustomRole = useCallback(async (roleId) => {
    if (!activeSchoolId) return;
    const roleDocRef = doc(db, 'schools', activeSchoolId, 'roles', roleId);
    await deleteDoc(roleDocRef);
  }, [activeSchoolId]);

  // Student Handlers
  const addStudent = useCallback(async (newStudent) => {
    if (!activeSchoolId) throw new Error('Select a school first.');
    if (!newStudent.email) throw new Error('A student email is required to create an account.');
    try {
      return await provisionNewUser({
        email: newStudent.email,
        password: newStudent.password,
        name: newStudent.name,
        role: 'student',
        schoolId: activeSchoolId,
        schoolName: activeSchool?.name || '',
        extraData: newStudent
      });
    } finally {
      bumpStudentsVersion();
    }
  }, [activeSchoolId, activeSchool?.name, bumpStudentsVersion]);

  // Keeps the stored class label and search fields in step with the edit.
  const updateStudent = useCallback(async (id, updates) => {
    if (!activeSchoolId) throw new Error('Select a school first.');
    const studentDocRef = doc(db, 'schools', activeSchoolId, 'students', String(id));
    const patch = { ...updates };
    if ('classGroupId' in patch) {
      patch.classGroupId = String(patch.classGroupId || '');
      patch.grade = classGroups.find(group => group.id === patch.classGroupId)?.label || '';
    }
    if ('name' in patch || 'email' in patch || 'studentId' in patch) {
      const needsCurrent = !('name' in patch && 'email' in patch && 'studentId' in patch);
      const current = needsCurrent ? (await getDoc(studentDocRef)).data() || {} : {};
      Object.assign(patch, studentSearchFields({ ...current, ...patch }));
    }
    await updateDoc(studentDocRef, { ...patch, updatedAt: serverTimestamp() });
    bumpStudentsVersion();
  }, [activeSchoolId, classGroups, bumpStudentsVersion]);

  const deleteStudent = useCallback(async (id) => {
    if (!activeSchoolId) throw new Error('Select a school first.');
    await httpsCallable(functions, 'removeSchoolStudent')({ schoolId: activeSchoolId, studentUid: String(id) });
    bumpStudentsVersion();
  }, [activeSchoolId, bumpStudentsVersion]);

  // Accepts the student record (preferred) or an id.
  const toggleArchiveStudent = useCallback(async (studentOrId) => {
    if (!activeSchoolId) throw new Error('Select a school first.');
    const id = String(typeof studentOrId === 'object' ? studentOrId?.id : studentOrId);
    const studentDocRef = doc(db, 'schools', activeSchoolId, 'students', id);
    const status = typeof studentOrId === 'object' && studentOrId?.status !== undefined
      ? studentOrId.status : (await getDoc(studentDocRef)).data()?.status;
    await updateDoc(studentDocRef, { status: status === 'archived' ? 'active' : 'archived', updatedAt: serverTimestamp() });
    bumpStudentsVersion();
  }, [activeSchoolId, bumpStudentsVersion]);

  // ── Homeroom classes ──────────────────────────────────────────────────
  const classGroupFields = useCallback((draft) => {
    const gradeLevel = Number(draft.gradeLevel);
    const section = cleanSection(draft.section);
    const teacher = staffList.find(member => String(member.id) === String(draft.homeroomTeacherId));
    return {
      gradeLevel,
      section,
      label: classGroupLabel({ gradeLevel, section }),
      homeroomTeacherId: String(draft.homeroomTeacherId || ''),
      homeroomTeacherName: String(teacher?.name || draft.homeroomTeacherName || '').slice(0, 200),
      homeroomTeacherEmail: String(teacher?.email || draft.homeroomTeacherEmail || '').slice(0, 320),
      room: String(draft.room || '').trim().slice(0, 100),
    };
  }, [staffList]);

  const addClassGroup = useCallback(async (draft) => {
    if (!activeSchoolId || !currentUser?.uid) throw new Error('Select a school first.');
    const ref = doc(collection(db, 'schools', activeSchoolId, 'classGroups'));
    const payload = { id: ref.id, ...classGroupFields(draft), createdByUid: currentUser.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await setDoc(ref, payload);
    return payload;
  }, [activeSchoolId, currentUser?.uid, classGroupFields]);

  // Renaming a class (e.g. promoting 10A to 11A) updates the label stored on
  // its students and linked courses; screens also resolve labels by id.
  const updateClassGroup = useCallback(async (id, draft) => {
    if (!activeSchoolId) throw new Error('Select a school first.');
    const fields = classGroupFields(draft);
    const previous = classGroups.find(group => group.id === id);
    await updateDoc(doc(db, 'schools', activeSchoolId, 'classGroups', String(id)), { ...fields, updatedAt: serverTimestamp() });
    if (previous && previous.label !== fields.label) {
      const members = await getDocs(query(collection(db, 'schools', activeSchoolId, 'students'), where('classGroupId', '==', String(id))));
      const linkedCourses = classesList.filter(course => String(course.classGroupId || '') === String(id));
      await commitInChunks([
        ...members.docs.map(member => batch => batch.update(member.ref, { grade: fields.label, updatedAt: serverTimestamp() })),
        ...linkedCourses.map(course => batch => batch.update(doc(db, 'schools', activeSchoolId, 'classes', String(course.id)), { classLabel: fields.label, updatedAt: serverTimestamp() })),
      ]);
      bumpStudentsVersion();
    }
    return fields;
  }, [activeSchoolId, classGroups, classesList, classGroupFields, bumpStudentsVersion]);

  // Students leave the class first, so a failure never leaves them pointing at
  // a deleted class. keepCourseEnrollment turns "enrolled through the class"
  // into stored course assignments.
  const deleteClassGroup = useCallback(async (id, { keepCourseEnrollment = true } = {}) => {
    if (!activeSchoolId) throw new Error('Select a school first.');
    const schoolRef = doc(db, 'schools', activeSchoolId);
    const members = await getDocs(query(collection(schoolRef, 'students'), where('classGroupId', '==', String(id))));
    const linkedCourseIds = classesList.filter(course => String(course.classGroupId || '') === String(id)).map(course => String(course.id));
    const slots = await getDocs(query(collection(schoolRef, 'scheduleEntries'), where('classGroupId', '==', String(id)))).catch(() => null);
    await commitInChunks([
      ...members.docs.map(member => batch => batch.update(member.ref, {
        classGroupId: '', grade: '', updatedAt: serverTimestamp(),
        ...(keepCourseEnrollment && linkedCourseIds.length ? { assignedClasses: arrayUnion(...linkedCourseIds) } : {}),
      })),
      ...linkedCourseIds.map(courseId => batch => batch.update(doc(schoolRef, 'classes', courseId), { classGroupId: '', classLabel: '', updatedAt: serverTimestamp() })),
      ...(slots?.docs || []).map(slot => batch => batch.update(slot.ref, { classGroupId: '' })),
    ]);
    await deleteDoc(doc(schoolRef, 'classGroups', String(id)));
    bumpStudentsVersion();
    return { students: members.size, courses: linkedCourseIds.length };
  }, [activeSchoolId, classesList, bumpStudentsVersion]);

  // Puts students into a class (or none). Course assignments that the class
  // now covers, or that belonged to the class they left, are dropped.
  const setStudentsClassGroup = useCallback(async (students, classGroupId) => {
    if (!activeSchoolId) throw new Error('Select a school first.');
    const targetId = String(classGroupId || '');
    const label = targetId ? classGroups.find(group => group.id === targetId)?.label || '' : '';
    if (targetId && !label) throw new Error('That class no longer exists.');
    await commitInChunks(students.map(student => batch => batch.update(doc(db, 'schools', activeSchoolId, 'students', String(student.id)), {
      classGroupId: targetId,
      grade: label,
      assignedClasses: explicitCourseAssignments(student.assignedClasses, classesList, targetId, student.classGroupId),
      updatedAt: serverTimestamp(),
    })));
    bumpStudentsVersion();
  }, [activeSchoolId, classGroups, classesList, bumpStudentsVersion]);

  // Class Handlers
  const addClass = useCallback(async (newClass) => {
    if (!activeSchoolId) throw new Error('Select a school before creating a course.');
    const classId = newClass.id || `cls_${Date.now()}`;
    const classDocRef = doc(db, 'schools', activeSchoolId, 'classes', String(classId));
    const payload = {
      ...newClass,
      id: classId,
      students: newClass.students || 0,
      progress: newClass.progress || 0,
      enrolled: Boolean(newClass.enrolled),
      createdAt: serverTimestamp(),
    };
    await setDoc(classDocRef, payload);
    return payload;
  }, [activeSchoolId]);

  const updateClass = useCallback(async (id, updates) => {
    if (!activeSchoolId) throw new Error('Select a school before editing a course.');
    const classDocRef = doc(db, 'schools', activeSchoolId, 'classes', String(id));
    await updateDoc(classDocRef, { ...updates, updatedAt: serverTimestamp() });
  }, [activeSchoolId]);

  const deleteClass = useCallback(async (id) => {
    if (!activeSchoolId) return;
    const classDocRef = doc(db, 'schools', activeSchoolId, 'classes', String(id));
    await deleteDoc(classDocRef);
  }, [activeSchoolId]);

  // Event Handlers
  const addEvent = useCallback(async (newEvent) => {
    if (!activeSchoolId) return;
    const eventId = newEvent.id || `ev_${Date.now()}`;
    const eventDocRef = doc(db, 'schools', activeSchoolId, 'events', String(eventId));
    const payload = {
      ...newEvent,
      id: eventId,
      attendees: newEvent.attendees || 0,
      starred: Boolean(newEvent.starred),
      createdAt: serverTimestamp(),
    };
    await setDoc(eventDocRef, payload);
    return payload;
  }, [activeSchoolId]);

  const updateEvent = useCallback(async (id, updates) => {
    if (!activeSchoolId) return;
    const eventDocRef = doc(db, 'schools', activeSchoolId, 'events', String(id));
    await updateDoc(eventDocRef, { ...updates, updatedAt: serverTimestamp() });
  }, [activeSchoolId]);

  const deleteEvent = useCallback(async (id) => {
    if (!activeSchoolId) return;
    const eventDocRef = doc(db, 'schools', activeSchoolId, 'events', String(id));
    await deleteDoc(eventDocRef);
  }, [activeSchoolId]);

  // Role Permissions Handler (Admin only)
  const updateRolePermissions = useCallback(async (role, permissions) => {
    if (!activeSchoolId) throw new Error('Select a school first.');
    if (!['teacher', 'student'].includes(role) || Object.keys(permissions).some(key => !Object.hasOwn(DEFAULT_ROLE_PERMISSIONS[role], key))) {
      throw new Error('Invalid role permission.');
    }
    const schoolDocRef = doc(db, 'schools', activeSchoolId);
    const fields = Object.fromEntries(Object.entries(permissions).map(([key, value]) => [`rolePermissions.${role}.${key}`, Boolean(value)]));
    await updateDoc(schoolDocRef, { ...fields, updatedAt: serverTimestamp() });
  }, [activeSchoolId]);

  return (
    <SchoolDataContext.Provider value={{
      staffList,
      staffLoaded,
      rolesList,
      classesList,
      classesLoaded,
      classesError,
      classGroups,
      classGroupsLoaded,
      classGroupsError,
      eventsList,
      rolePermissions,
      loading: !staffLoaded || !classesLoaded || !classGroupsLoaded,
      myStudentRecord,
      myStudentLoaded,
      studentsVersion,
      directoryReady,
      directoryStatus,
      addStaff,
      updateStaff,
      deleteStaff,
      addCustomRole,
      deleteCustomRole,
      addStudent,
      updateStudent,
      deleteStudent,
      toggleArchiveStudent,
      addClass,
      updateClass,
      deleteClass,
      addClassGroup,
      updateClassGroup,
      deleteClassGroup,
      setStudentsClassGroup,
      addEvent,
      updateEvent,
      deleteEvent,
      updateRolePermissions
    }}>
      {children}
    </SchoolDataContext.Provider>
  );
};

export const useSchoolData = () => {
  const ctx = useContext(SchoolDataContext);
  if (!ctx) {
    return {
      staffList: [],
      staffLoaded: false,
      rolesList: [],
      classesList: [],
      classesLoaded: false,
      classesError: null,
      classGroups: [],
      classGroupsLoaded: false,
      classGroupsError: null,
      eventsList: [],
      rolePermissions: DEFAULT_ROLE_PERMISSIONS,
      loading: false,
      myStudentRecord: null,
      myStudentLoaded: false,
      studentsVersion: 0,
      directoryReady: false,
      directoryStatus: 'pending',
      addStaff: () => {},
      updateStaff: () => {},
      deleteStaff: () => {},
      addCustomRole: () => {},
      deleteCustomRole: () => {},
      addStudent: () => {},
      updateStudent: () => {},
      deleteStudent: () => {},
      toggleArchiveStudent: () => {},
      addClass: () => {},
      updateClass: () => {},
      deleteClass: () => {},
      addClassGroup: () => {},
      updateClassGroup: () => {},
      deleteClassGroup: () => {},
      setStudentsClassGroup: () => {},
      addEvent: () => {},
      updateEvent: () => {},
      deleteEvent: () => {},
      updateRolePermissions: () => {}
    };
  }
  return ctx;
};
