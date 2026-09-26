import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const INITIAL_ROLES = [
  { id: 'admin', name: 'Administrator', category: 'Administration', color: '335 70% 65%', icon: 'Shield', description: 'Full access to school systems, staff management & policies' },
  { id: 'teacher', name: 'Teacher', category: 'Academic', color: '142 70% 45%', icon: 'GraduationCap', description: 'Curriculum delivery, student assessments, class management' },
  { id: 'counselor', name: 'Academic Counselor', category: 'Student Support', color: '270 65% 60%', icon: 'HeartHandshake', description: 'Student guidance, mental wellness, academic planning' },
  { id: 'dept_head', name: 'Head of Department', category: 'Academic Leadership', color: '215 85% 60%', icon: 'Award', description: 'Department curriculum supervision and faculty leadership' },
  { id: 'support', name: 'Staff / Specialist', category: 'Support', color: '38 92% 50%', icon: 'Briefcase', description: 'Operational support, lab management, and student services' }
];

const INITIAL_STAFF = [
  {
    id: 1,
    staffId: 'STF-101',
    name: 'Dr. Sarah Smith',
    roleId: 'dept_head',
    roleName: 'Head of Department',
    department: 'Mathematics',
    subject: 'Advanced Mathematics',
    classes: 5,
    experience: '12 years',
    rating: 4.9,
    email: 'sarah.smith@lumischool.edu',
    phone: '+1 (555) 234-001',
    status: 'active',
    room: 'Room 302 (Math Wing)',
    bio: 'Doctorate in Applied Mathematics from MIT. Passionate about calculus, competition math, and data modeling.',
    joinDate: '2016-08-15'
  },
  {
    id: 2,
    staffId: 'STF-102',
    name: 'Prof. James Wilson',
    roleId: 'teacher',
    roleName: 'Senior Teacher',
    department: 'Science',
    subject: 'Physics Mechanics',
    classes: 4,
    experience: '15 years',
    rating: 4.8,
    email: 'james.wilson@lumischool.edu',
    phone: '+1 (555) 234-002',
    status: 'active',
    room: 'Lab B (Science Center)',
    bio: 'Former research fellow in Quantum Optics. Believes in hands-on inquiry and experimental physics demonstrations.',
    joinDate: '2014-09-01'
  },
  {
    id: 3,
    staffId: 'STF-103',
    name: 'Ms. Emily Brown',
    roleId: 'counselor',
    roleName: 'Academic Counselor',
    department: 'Student Affairs',
    subject: 'Counseling & Guidance',
    classes: 6,
    experience: '8 years',
    rating: 4.9,
    email: 'emily.brown@lumischool.edu',
    phone: '+1 (555) 234-003',
    status: 'active',
    room: 'Guidance Suite 104',
    bio: 'Specialist in adolescent psychology and college prep advising. Leads peer mentorship initiatives.',
    joinDate: '2019-01-10'
  },
  {
    id: 4,
    staffId: 'STF-104',
    name: 'Mr. David Clark',
    roleId: 'teacher',
    roleName: 'Teacher',
    department: 'Humanities',
    subject: 'World History & Civics',
    classes: 3,
    experience: '10 years',
    rating: 4.6,
    email: 'david.clark@lumischool.edu',
    phone: '+1 (555) 234-004',
    status: 'active',
    room: 'Room 205 (Arts Wing)',
    bio: 'Historian and debate coach. Dedicated to interactive historical simulations and civic engagement.',
    joinDate: '2018-08-20'
  },
  {
    id: 5,
    staffId: 'STF-105',
    name: 'Elena Rostova',
    roleId: 'admin',
    roleName: 'Dean of Academics',
    department: 'Administration',
    subject: 'Academic Operations',
    classes: 0,
    experience: '18 years',
    rating: 5.0,
    email: 'elena.rostova@lumischool.edu',
    phone: '+1 (555) 234-005',
    status: 'active',
    room: 'Admin Suite A1',
    bio: 'Oversees school-wide academic standards, accreditation, and teacher professional development.',
    joinDate: '2012-05-14'
  },
  {
    id: 6,
    staffId: 'STF-106',
    name: 'Marcus Vance',
    roleId: 'support',
    roleName: 'IT & Media Director',
    department: 'Technology',
    subject: 'Digital Learning Systems',
    classes: 2,
    experience: '7 years',
    rating: 4.7,
    email: 'marcus.vance@lumischool.edu',
    phone: '+1 (555) 234-006',
    status: 'active',
    room: 'Tech Hub 102',
    bio: 'Manages Noesis Horizon cloud infrastructure, student device portals, and digital robotics lab.',
    joinDate: '2021-03-01'
  }
];

const INITIAL_STUDENTS = [
  { id: 1, studentId: 'STU-1001', name: 'Luna Star', grade: '10A', email: 'luna.star@student.edu', phone: '+1 (555) 345-001', points: 1250, guardian: 'Elena Star (Mother - +1 555-888-01)', gpa: 3.9, attendance: 98, status: 'active', assignedClasses: ['Advanced Math (MATH-301)', 'Physics 101 (PHYS-401)', 'Digital Arts (ART-110)'] },
  { id: 2, studentId: 'STU-1002', name: 'Oliver Twist', grade: '9B', email: 'oliver.twist@student.edu', phone: '+1 (555) 345-002', points: 980, guardian: 'Arthur Twist (Father - +1 555-888-02)', gpa: 3.7, attendance: 100, status: 'active', assignedClasses: ['Advanced Math (MATH-301)', 'World History (HIST-202)'] },
  { id: 3, studentId: 'STU-1003', name: 'Sophie Miller', grade: '11C', email: 'sophie.miller@student.edu', phone: '+1 (555) 345-003', points: 1100, guardian: 'Claire Miller (Mother - +1 555-888-03)', gpa: 3.85, attendance: 94, status: 'active', assignedClasses: ['Physics 101 (PHYS-401)', 'World History (HIST-202)'] },
  { id: 4, studentId: 'STU-1004', name: 'Felix Cat', grade: '12A', email: 'felix.cat@student.edu', phone: '+1 (555) 345-004', points: 850, guardian: 'Thomas Cat (Father - +1 555-888-04)', gpa: 3.5, attendance: 92, status: 'archived', assignedClasses: [] },
  { id: 5, studentId: 'STU-1005', name: 'Bella Blue', grade: '10B', email: 'bella.blue@student.edu', phone: '+1 (555) 345-005', points: 1420, guardian: 'Sarah Blue (Mother - +1 555-888-05)', gpa: 4.0, attendance: 99, status: 'active', assignedClasses: ['Advanced Math (MATH-301)', 'Digital Arts (ART-110)'] },
  { id: 6, studentId: 'STU-1006', name: 'Leo Lion', grade: '11A', email: 'leo.lion@student.edu', phone: '+1 (555) 345-006', points: 1050, guardian: 'Mark Lion (Father - +1 555-888-06)', gpa: 3.65, attendance: 95, status: 'active', assignedClasses: [] },
];

const SchoolDataContext = createContext(null);

export const SchoolDataProvider = ({ children }) => {
  // Staff State
  const [staffList, setStaffList] = useState(() => {
    try {
      const saved = localStorage.getItem('lumi-staff-list');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map(st => {
          const defaultMatch = INITIAL_STAFF.find(init => init.id === st.id);
          return {
            ...st,
            staffId: st.staffId || (defaultMatch ? defaultMatch.staffId : `STF-${100 + Number(st.id || 1)}`)
          };
        });
      }
      return INITIAL_STAFF;
    } catch {
      return INITIAL_STAFF;
    }
  });

  // Roles State
  const [rolesList, setRolesList] = useState(() => {
    try {
      const saved = localStorage.getItem('lumi-roles-list');
      return saved ? JSON.parse(saved) : INITIAL_ROLES;
    } catch {
      return INITIAL_ROLES;
    }
  });

  // Students State
  const [studentsList, setStudentsList] = useState(() => {
    try {
      const saved = localStorage.getItem('lumi-students-list');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map(s => {
          const defaultMatch = INITIAL_STUDENTS.find(init => init.id === s.id);
          const assignedClasses = (s.assignedClasses && s.assignedClasses.length > 0)
            ? s.assignedClasses
            : (defaultMatch ? defaultMatch.assignedClasses : []);
          return {
            ...s,
            studentId: s.studentId || (defaultMatch ? defaultMatch.studentId : `STU-${1000 + Number(s.id || 1)}`),
            status: s.status || (defaultMatch ? defaultMatch.status : 'active'),
            assignedClasses
          };
        });
      }
      return INITIAL_STUDENTS;
    } catch {
      return INITIAL_STUDENTS;
    }
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lumi-staff-list', JSON.stringify(staffList));
    } catch (e) {
      console.error(e);
    }
  }, [staffList]);

  useEffect(() => {
    try {
      localStorage.setItem('lumi-roles-list', JSON.stringify(rolesList));
    } catch (e) {
      console.error(e);
    }
  }, [rolesList]);

  useEffect(() => {
    try {
      localStorage.setItem('lumi-students-list', JSON.stringify(studentsList));
    } catch (e) {
      console.error(e);
    }
  }, [studentsList]);

  // Staff Handlers
  const addStaff = useCallback((newStaff) => {
    setStaffList(prev => [
      {
        ...newStaff,
        id: Date.now(),
        staffId: newStaff.staffId || `STF-${Math.floor(100 + Math.random() * 900)}`,
        rating: newStaff.rating || 5.0,
        status: newStaff.status || 'active',
        joinDate: newStaff.joinDate || new Date().toISOString().split('T')[0]
      },
      ...prev
    ]);
  }, []);

  const updateStaff = useCallback((id, updates) => {
    setStaffList(prev => prev.map(member => member.id === id ? { ...member, ...updates } : member));
  }, []);

  const deleteStaff = useCallback((id) => {
    setStaffList(prev => prev.filter(member => member.id !== id));
  }, []);

  // Custom Roles Handlers
  const addCustomRole = useCallback((roleData) => {
    const newRole = {
      ...roleData,
      id: roleData.id || `custom_${Date.now()}`,
      isCustom: true
    };
    setRolesList(prev => [...prev, newRole]);
    return newRole;
  }, []);

  const deleteCustomRole = useCallback((roleId) => {
    setRolesList(prev => prev.filter(r => r.id !== roleId));
    // Reassign any staff who had this role to standard teacher/support
    setStaffList(prev => prev.map(staff => {
      if (staff.roleId === roleId) {
        return {
          ...staff,
          roleId: 'support',
          roleName: 'Staff / Specialist'
        };
      }
      return staff;
    }));
  }, []);

  // Student Handlers
  const addStudent = useCallback((newStudent) => {
    setStudentsList(prev => [
      {
        ...newStudent,
        id: Date.now(),
        studentId: newStudent.studentId || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
        status: newStudent.status || 'active',
        assignedClasses: newStudent.assignedClasses || [],
        points: newStudent.points || 500,
        attendance: newStudent.attendance || 100,
        gpa: newStudent.gpa || 3.8
      },
      ...prev
    ]);
  }, []);

  const updateStudent = useCallback((id, updates) => {
    setStudentsList(prev => prev.map(student => student.id === id ? { ...student, ...updates } : student));
  }, []);

  const deleteStudent = useCallback((id) => {
    setStudentsList(prev => prev.filter(student => student.id !== id));
  }, []);

  const toggleArchiveStudent = useCallback((id) => {
    setStudentsList(prev => prev.map(student => {
      if (student.id === id) {
        const nextStatus = student.status === 'archived' ? 'active' : 'archived';
        return { ...student, status: nextStatus };
      }
      return student;
    }));
  }, []);

  return (
    <SchoolDataContext.Provider value={{
      staffList,
      rolesList,
      studentsList,
      addStaff,
      updateStaff,
      deleteStaff,
      addCustomRole,
      deleteCustomRole,
      addStudent,
      updateStudent,
      deleteStudent,
      toggleArchiveStudent
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
      addStaff: () => {},
      updateStaff: () => {},
      deleteStaff: () => {},
      addCustomRole: () => {},
      deleteCustomRole: () => {},
      addStudent: () => {},
      updateStudent: () => {},
      deleteStudent: () => {},
      toggleArchiveStudent: () => {}
    };
  }
  return ctx;
};
