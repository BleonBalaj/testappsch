import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import { provisionNewUser } from '../services/userProvisioningService';

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
  const { activeSchoolId, activeSchool, currentUser } = useAuth();

  const [staffList, setStaffList] = useState([]);
  const [rolesList, setRolesList] = useState(INITIAL_ROLES);
  const [studentsList, setStudentsList] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [eventsList, setEventsList] = useState([]);
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const isSeedingRolesRef = useRef(false);

  // Realtime listeners partitioned strictly by activeSchoolId
  useEffect(() => {
    if (!activeSchoolId) {
      setStaffList([]);
      setStudentsList([]);
      setClassesList([]);
      setEventsList([]);
      setRolesList(INITIAL_ROLES);
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      setLoading(false);
      return;
    }

    setLoading(true);

    const handleSnapshotError = (colName) => (err) => {
      console.warn(`Snapshot listener notice for ${colName}:`, err.message);
      setLoading(false);
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
                    updateDoc(doc(db, 'schools', activeSchoolId, 'staff', s.id), { name: betterName });
                  } catch (e) {}
                }
              }
            }
          }
        }
      }

      setStaffList(staff);
    }, handleSnapshotError('staff'));

    // 3. Students Listener (Live production data from Firestore, empty initially)
    const studentsCol = collection(db, 'schools', activeSchoolId, 'students');
    const unsubStudents = onSnapshot(studentsCol, (snapshot) => {
      const students = [];
      snapshot.forEach(docSnap => {
        students.push({ id: docSnap.id, ...docSnap.data() });
      });
      setStudentsList(students);
      setLoading(false);
    }, handleSnapshotError('students'));

    // 4. Classes Listener (Live production data from Firestore, empty initially)
    const classesCol = collection(db, 'schools', activeSchoolId, 'classes');
    const unsubClasses = onSnapshot(classesCol, (snapshot) => {
      const cls = [];
      snapshot.forEach(docSnap => {
        cls.push({ id: docSnap.id, ...docSnap.data() });
      });
      setClassesList(cls);
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
      unsubStudents();
      unsubClasses();
      unsubEvents();
      unsubSchool();
    };
  }, [activeSchoolId]);

  // Staff Handlers
  const addStaff = useCallback(async (newStaff) => {
    if (!activeSchoolId) return;

    // If an email and password are provided, create as full Firebase user
    if (newStaff.email && newStaff.password) {
      return await provisionNewUser({
        email: newStaff.email,
        password: newStaff.password,
        name: newStaff.name,
        role: newStaff.roleId || 'teacher',
        schoolId: activeSchoolId,
        schoolName: activeSchool?.name || '',
        extraData: newStaff
      });
    }

    // Fallback: direct doc creation if no password provided
    const staffId = newStaff.id || `stf_${Date.now()}`;
    const staffDocRef = doc(db, 'schools', activeSchoolId, 'staff', String(staffId));
    const payload = {
      ...newStaff,
      id: staffId,
      staffId: newStaff.staffId || `STF-${Math.floor(100 + Math.random() * 900)}`,
      status: newStaff.status || 'active',
      joinDate: newStaff.joinDate || new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp()
    };
    await setDoc(staffDocRef, payload);
  }, [activeSchoolId, activeSchool?.name]);

  const updateStaff = useCallback(async (id, updates) => {
    if (!activeSchoolId) return;
    const staffDocRef = doc(db, 'schools', activeSchoolId, 'staff', String(id));
    await updateDoc(staffDocRef, { ...updates, updatedAt: serverTimestamp() });
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
    if (!activeSchoolId) return;

    // If an email and password are provided, create as full Firebase user
    if (newStudent.email && newStudent.password) {
      return await provisionNewUser({
        email: newStudent.email,
        password: newStudent.password,
        name: newStudent.name,
        role: 'student',
        schoolId: activeSchoolId,
        schoolName: activeSchool?.name || '',
        extraData: newStudent
      });
    }

    // Fallback: direct doc creation if no password provided
    const studentId = newStudent.id || `stu_${Date.now()}`;
    const studentDocRef = doc(db, 'schools', activeSchoolId, 'students', String(studentId));
    const payload = {
      ...newStudent,
      id: studentId,
      studentId: newStudent.studentId || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
      status: newStudent.status || 'active',
      assignedClasses: newStudent.assignedClasses || [],
      createdAt: serverTimestamp()
    };
    await setDoc(studentDocRef, payload);
  }, [activeSchoolId, activeSchool?.name]);

  const updateStudent = useCallback(async (id, updates) => {
    if (!activeSchoolId) return;
    const studentDocRef = doc(db, 'schools', activeSchoolId, 'students', String(id));
    await updateDoc(studentDocRef, { ...updates, updatedAt: serverTimestamp() });
  }, [activeSchoolId]);

  const deleteStudent = useCallback(async (id) => {
    if (!activeSchoolId) return;
    const uid = String(id);
    const batch = writeBatch(db);
    // Remove student record
    batch.delete(doc(db, 'schools', activeSchoolId, 'students', uid));
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

  const toggleArchiveStudent = useCallback(async (id) => {
    if (!activeSchoolId) return;
    const student = studentsList.find(s => String(s.id) === String(id));
    const nextStatus = student?.status === 'archived' ? 'active' : 'archived';
    const studentDocRef = doc(db, 'schools', activeSchoolId, 'students', String(id));
    await updateDoc(studentDocRef, { status: nextStatus, updatedAt: serverTimestamp() });
  }, [activeSchoolId, studentsList]);

  // Class Handlers
  const addClass = useCallback(async (newClass) => {
    if (!activeSchoolId) return;
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
    if (!activeSchoolId) return;
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
    if (!activeSchoolId) return;
    const schoolDocRef = doc(db, 'schools', activeSchoolId);
    const updated = {
      ...rolePermissions,
      [role]: { ...(rolePermissions[role] || {}), ...permissions }
    };
    setRolePermissions(updated);
    await updateDoc(schoolDocRef, {
      rolePermissions: updated,
      updatedAt: serverTimestamp()
    });
  }, [activeSchoolId, rolePermissions]);

  return (
    <SchoolDataContext.Provider value={{
      staffList,
      rolesList,
      studentsList,
      classesList,
      eventsList,
      rolePermissions,
      loading,
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
      rolesList: [],
      studentsList: [],
      classesList: [],
      eventsList: [],
      rolePermissions: DEFAULT_ROLE_PERMISSIONS,
      loading: false,
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
      addEvent: () => {},
      updateEvent: () => {},
      deleteEvent: () => {},
      updateRolePermissions: () => {}
    };
  }
  return ctx;
};
