import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Book, CheckSquare, Users, Plus, Search, Filter, 
  Download, Sparkles, BookOpen, Layers, X, Check,
  GraduationCap, Clock, MapPin, Edit3, Trash2, AlertTriangle
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { isStudentEnrolledInCourse } from '../features/enrollment';
import { parseWeeklySchedule } from '../features/courseSchedule';
import { stageForClass } from '../features/lessonPlans/catalog';
import { classGroupsById, homeroomTeacherInfo } from '../features/classGroups';
import { useStudentCounts } from '../features/students/studentData';
import ClassGroupsView from '../components/classGroups/ClassGroupsView';
import ClassGroupForm from '../components/classGroups/ClassGroupForm';
import './Classes.css';

const VIEW_STORAGE_KEY = 'lumi-classes-view';
const readStoredView = () => {
  try { return localStorage.getItem(VIEW_STORAGE_KEY) === 'groups' ? 'groups' : 'courses'; } catch { return 'courses'; }
};
const courseCountSpec = course => ({ kind: 'course', value: String(course.id), classGroupId: course.classGroupId ? String(course.classGroupId) : '' });
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const INITIAL_CLASSES = [];

const SWATCH_OPTIONS = [
  { label: 'Magenta', value: '--primary' },
  { label: 'Rose', value: '--accent' },
  { label: 'Cyan', value: '--chart-1' },
  { label: 'Emerald', value: '--chart-2' },
  { label: 'Amber', value: '--chart-4' },
  { label: 'Violet', value: '--chart-5' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const cardItemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' }
  }
};

export const CURRICULUM_STAGES = [
  { id: 'Shkalla I', labelSq: 'Shkalla I (Përgatitore, Klasa I - II)', labelEn: 'Stage I (Prep, Grades 1 - 2)' },
  { id: 'Shkalla II', labelSq: 'Shkalla II (Klasa III - V)', labelEn: 'Stage II (Grades 3 - 5)' },
  { id: 'Shkalla III', labelSq: 'Shkalla III (Klasa VI - VII)', labelEn: 'Stage III (Grades 6 - 7)' },
  { id: 'Shkalla IV', labelSq: 'Shkalla IV (Klasa VIII - IX)', labelEn: 'Stage IV (Grades 8 - 9)' },
  { id: 'Shkalla V', labelSq: 'Shkalla V (Klasa X - XI)', labelEn: 'Stage V (Grades 10 - 11)' },
  { id: 'Shkalla VI', labelSq: 'Shkalla VI (Klasa XII)', labelEn: 'Stage VI (Grade 12)' }
];

const ClassCard = ({ 
  classInfo, 
  onClick, 
  userRole = 'student', 
  isTaughtByMe, 
  isEnrolled, 
  isAlbanian,
  studentCount,
  classLabel,
  canManage,
  onEdit,
  onDelete
}) => {
  const isLead = isTaughtByMe !== undefined ? isTaughtByMe : Boolean(classInfo.taughtByMe);
  const enrolled = isEnrolled !== undefined ? isEnrolled : Boolean(classInfo.enrolled);

  return (
    <motion.div 
      className="class-card glass bouncy"
      onClick={() => onClick(classInfo)}
      layout
      variants={cardItemVariants}
      whileHover={{ y: -5, scale: 1.02 }}
      style={{ borderTop: `4px solid hsl(var(${classInfo.color || '--primary'}))` }}
    >
      <div className="class-card-header">
        <div className="class-icon" style={{ backgroundColor: `hsla(var(${classInfo.color || '--primary'}), 0.2)`, color: `hsl(var(${classInfo.color || '--primary'}))` }}>
          <Book size={24} />
        </div>
        <div className="class-title">
          <div className="class-title-top">
            <h3>{classInfo.name}</h3>
            {userRole === 'student' && (
              enrolled ? (
                <span className="class-enroll-badge enrolled" title={isAlbanian ? "Jeni të regjistruar në këtë lëndë" : "You are enrolled in this course"}>
                  <Check size={11} /> {isAlbanian ? 'I Regjistruar' : 'Enrolled'}
                </span>
              ) : (
                <span className="class-enroll-badge elective" title={isAlbanian ? "Lëndë me zgjedhje në kurrikulë" : "Elective course available in curriculum"}>
                  {isAlbanian ? 'Lëndë me Zgjedhje' : 'Open Elective'}
                </span>
              )
            )}
            {(userRole === 'teacher' || userRole === 'dept_head') && isLead && (
              <span className="class-enroll-badge instructor" title={isAlbanian ? "Ju jeni mësimdhënësi për këtë kurs" : "You are the lead instructor for this course"}>
                {isAlbanian ? 'Lënda Ime' : 'My Course'}
              </span>
            )}
          </div>
          <p>{[classInfo.code, classInfo.teacher].filter(Boolean).join(' • ')}</p>
        </div>

        {canManage && (
          <div className="class-card-actions" onClick={e => e.stopPropagation()}>
            <button 
              type="button" 
              className="class-card-action-btn edit" 
              onClick={(e) => {
                e.stopPropagation();
                if (onEdit) onEdit(classInfo);
              }} 
              title={isAlbanian ? "Ndrysho Lëndën" : "Edit Course"}
              aria-label={isAlbanian ? "Ndrysho Lëndën" : "Edit Course"}
            >
              <Edit3 size={15} />
            </button>
            <button 
              type="button" 
              className="class-card-action-btn delete" 
              onClick={(e) => {
                e.stopPropagation();
                if (onDelete) onDelete(classInfo);
              }} 
              title={isAlbanian ? "Fshij Lëndën" : "Delete Course"}
              aria-label={isAlbanian ? "Fshij Lëndën" : "Delete Course"}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      <div className="class-meta-row">
        <span className={`class-room-badge class-link-badge ${classLabel ? '' : 'is-open'}`} title={classLabel ? (isAlbanian ? 'Të gjithë nxënësit e kësaj klase janë të regjistruar' : 'Every student of this class is enrolled') : (isAlbanian ? 'Nxënësit shtohen një nga një' : 'Students are added one by one')}>
          <GraduationCap size={12} /> {classLabel ? `${isAlbanian ? 'Klasa' : 'Class'} ${classLabel}` : (isAlbanian ? 'Lëndë e hapur' : 'Open course')}
        </span>
        {classInfo.room && <span className="class-room-badge"><MapPin size={12} /> {classInfo.room}</span>}
        {classInfo.schedule && <span className="class-schedule-badge"><Clock size={12} /> {classInfo.schedule}</span>}
        {Number(classInfo.credits) > 0 && <span className="class-stage-badge">{classInfo.credits} {isAlbanian ? 'kredi' : 'credits'}</span>}
        {classInfo.curriculumStage && (
          <span className="class-stage-badge" title={isAlbanian ? 'Shkalla e Kurrikulës' : 'Curriculum Stage'}>
            🏷️ {classInfo.curriculumStage}
          </span>
        )}
        {classInfo.period && (
          <span className="class-period-badge glass">
            {classInfo.period}
          </span>
        )}
      </div>

      <div className="class-card-stats">
        <div className="stat">
          <CheckSquare size={16} />
          <span>{classInfo.progress || 0}% {isAlbanian ? 'Përfunduar' : 'Complete'}</span>
        </div>
        <div className="stat">
          <Users size={16} />
          <span>{studentCount === undefined ? '…' : studentCount} {isAlbanian ? 'Nxënës' : studentCount === 1 ? 'Student' : 'Students'}</span>
        </div>
      </div>
    </motion.div>
  );
};

const Classes = ({ onClassSelect, onOpenSchedule, userRole = 'student', addNotification, viewRequest = null }) => {
  const { 
    staffList = [], 
    classesList = [], 
    classGroups = [],
    myStudentRecord,
    studentsVersion,
    addClass,
    updateClass,
    deleteClass,
    rolePermissions
  } = useSchoolData();
  const { currentUser, activeSchoolId } = useAuth();
  const { t, isAlbanian } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [courseClassFilter, setCourseClassFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [groupForm, setGroupForm] = useState(null); // { mode: 'create' } | { mode: 'edit', group }
  const [view, setView] = useState(() => viewRequest?.view || readStoredView());
  const [handledViewRequest, setHandledViewRequest] = useState(viewRequest);
  if (viewRequest && viewRequest !== handledViewRequest) {
    setHandledViewRequest(viewRequest);
    setView(viewRequest.view);
  }
  const groupsById = useMemo(() => classGroupsById(classGroups), [classGroups]);
  const chooseView = next => {
    setView(next);
    try { localStorage.setItem(VIEW_STORAGE_KEY, next); } catch { /* Preference only. */ }
  };
  
  // Default tab for student and teacher is 'my-classes', for admin is 'all-classes'
  const [activeTab, setActiveTab] = useState(() => (userRole === 'admin' ? 'all-classes' : 'my-classes'));
  const [prevRole, setPrevRole] = useState(userRole);

  if (prevRole !== userRole) {
    setPrevRole(userRole);
    setActiveTab(userRole === 'admin' ? 'all-classes' : 'my-classes');
  }

  // Superadmins never have a personal "My Classes" view; strictly lock to full curriculum catalog
  const effectiveTab = userRole === 'admin' ? 'all-classes' : activeTab;

  const isAdmin = userRole === 'admin';
  const isTeacher = userRole === 'teacher' || userRole === 'dept_head';
  const canCreateClass = isAdmin || (isTeacher && (rolePermissions?.teacher?.classes ?? true));
  const teacherCanEditDelete = (rolePermissions?.teacher?.canEditDeleteClasses ?? true);
  const canManageClass = isAdmin || (isTeacher && canCreateClass && teacherCanEditDelete);
  // Moving students between classes is a student edit, so it follows those permissions.
  const canEditStudentMembership = isAdmin || (isTeacher && (rolePermissions?.teacher?.students ?? true) && (rolePermissions?.teacher?.canEditDeleteStudents ?? true));
  const showGroups = userRole !== 'student' && view === 'groups';

  // New Class Form State
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassDept, setNewClassDept] = useState('Science');
  const [newClassTeacher, setNewClassTeacher] = useState('');
  const [newClassRoom, setNewClassRoom] = useState('');
  const [newClassSchedule, setNewClassSchedule] = useState('');
  const [newClassCredits, setNewClassCredits] = useState('');
  const [newClassColor, setNewClassColor] = useState('--primary');
  const [newClassCurriculumStage, setNewClassCurriculumStage] = useState('Shkalla III');
  const [newClassGroupId, setNewClassGroupId] = useState('');
  const [newStageTouched, setNewStageTouched] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit Class Form State
  const [editingClass, setEditingClass] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    department: 'Science',
    teacher: '',
    room: '',
    schedule: '',
    color: '--primary',
    curriculumStage: 'Shkalla III',
    credits: '',
    description: '',
    classGroupId: ''
  });
  const [editStageTouched, setEditStageTouched] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  // Delete Class Confirmation State
  const [classToDelete, setClassToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenEdit = useCallback((cls) => {
    setEditingClass(cls);
    setEditForm({
      name: cls.name || '',
      code: cls.code || '',
      department: cls.department || 'Science',
      teacher: cls.teacher || staffList[0]?.name || currentUser?.displayName || '',
      room: cls.room || '',
      schedule: cls.schedule || '',
      color: cls.color || '--primary',
      curriculumStage: cls.curriculumStage || 'Shkalla III',
      credits: cls.credits ?? '',
      description: cls.description || '',
      classGroupId: cls.classGroupId && groupsById.has(String(cls.classGroupId)) ? String(cls.classGroupId) : ''
    });
    setEditStageTouched(Boolean(cls.curriculumStage));
    setEditFormError('');
  }, [staffList, currentUser, groupsById]);

  const handleSaveEditClass = async (e) => {
    e.preventDefault();
    if (!editingClass) return;
    if (!editForm.name.trim()) {
      setEditFormError(isAlbanian ? 'Ju lutem shënoni titullin e kursit.' : 'Please enter the course title.');
      return;
    }
    if (!editForm.code.trim()) {
      setEditFormError(isAlbanian ? 'Kodi i kursit është i detyrueshëm.' : 'Course code is required.');
      return;
    }
    if (editForm.credits !== '' && (!Number.isFinite(Number(editForm.credits)) || Number(editForm.credits) <= 0)) {
      setEditFormError(isAlbanian ? 'Kreditë duhet të jenë numër pozitiv.' : 'Credits must be a positive number.');
      return;
    }
    const scheduleChanged = editForm.schedule.trim() !== (editingClass.schedule || '').trim();
    const parsedSchedule = parseWeeklySchedule(editForm.schedule.trim());
    if (scheduleChanged && editForm.schedule.trim() && parsedSchedule.length === 0) {
      setEditFormError(isAlbanian ? 'Përdorni ditët dhe orën, p.sh. E Hënë, E Mërkurë 09:00.' : 'Enter weekday and time, for example Mon, Wed 09:00.');
      return;
    }

    const teacherName = editForm.teacher.trim();
    const matchedStaff = staffList.find(s => s.name === teacherName);
    const teacherId = matchedStaff?.id || (teacherName === currentUser?.displayName ? currentUser?.uid : editingClass.teacherId || '');
    const teacherEmail = matchedStaff?.email || (teacherName === currentUser?.displayName ? currentUser?.email : editingClass.teacherEmail || '');

    const updates = {
      name: editForm.name.trim(),
      code: editForm.code.trim().toUpperCase(),
      department: editForm.department,
      teacher: teacherName,
      teacherId,
      teacherEmail,
      room: editForm.room.trim(),
      schedule: editForm.schedule.trim(),
      ...(scheduleChanged ? { weeklySchedule: parsedSchedule } : {}),
      color: editForm.color || '--primary',
      curriculumStage: editForm.curriculumStage || 'Shkalla III',
      credits: editForm.credits === '' ? null : Number(editForm.credits),
      description: (editForm.description || '').trim(),
      classGroupId: editForm.classGroupId || '',
      classLabel: groupsById.get(String(editForm.classGroupId))?.label || ''
    };

    try {
      if (updateClass) {
        await updateClass(editingClass.id, updates);
      }
      if (addNotification) {
        addNotification('success', isAlbanian ? `Lënda "${updates.name}" u përditësua me sukses! ✨` : `Course "${updates.name}" updated successfully! ✨`);
      }
      setEditingClass(null);
    } catch (err) {
      console.error('Error updating class:', err);
      setEditFormError(err.message || 'Failed to update course');
    }
  };

  const handleConfirmDelete = async () => {
    if (!classToDelete) return;
    setIsDeleting(true);
    try {
      if (deleteClass) {
        await deleteClass(classToDelete.id);
      }
      if (addNotification) {
        addNotification('info', isAlbanian ? `Lënda "${classToDelete.name}" u fshi me sukses. 🗑️` : `Course "${classToDelete.name}" was deleted successfully. 🗑️`);
      }
      setClassToDelete(null);
    } catch (err) {
      console.error('Error deleting class:', err);
      if (addNotification) {
        addNotification('error', isAlbanian ? 'Gabim gjatë fshirjes së lëndës.' : 'Failed to delete course: ' + err.message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const departments = [
    { id: 'All', labelEn: 'All', labelSq: 'Të Gjitha' },
    { id: 'Science', labelEn: 'Science', labelSq: 'Shkencë' },
    { id: 'Mathematics', labelEn: 'Mathematics', labelSq: 'Matematikë' },
    { id: 'Humanities', labelEn: 'Humanities', labelSq: 'Shkenca Humane' },
    { id: 'Technology', labelEn: 'Technology', labelSq: 'Teknologji' }
  ];

  // Resolve current logged-in staff member or student record
  const currentStaff = useMemo(() => {
    return staffList.find(s => 
      s.id === currentUser?.uid || 
      (s.email && currentUser?.email && s.email.toLowerCase() === currentUser.email.toLowerCase())
    );
  }, [staffList, currentUser]);

  const currentStudent = myStudentRecord;
  const myClassGroup = currentStudent?.classGroupId ? groupsById.get(String(currentStudent.classGroupId)) : null;

  // Robust teacher matching
  const isClassTaughtByMe = useCallback((c) => {
    if (!c) return false;
    
    // 1. Direct ID / UID matches
    if (c.teacherId && (c.teacherId === currentUser?.uid || (currentStaff && (c.teacherId === currentStaff.id || c.teacherId === currentStaff.staffId)))) {
      return true;
    }
    if (c.createdByUid && c.createdByUid === currentUser?.uid) {
      return true;
    }

    // 2. Email matches
    const teacherEmail = (c.teacherEmail || '').toLowerCase().trim();
    const userEmail = (currentUser?.email || '').toLowerCase().trim();
    const staffEmail = (currentStaff?.email || '').toLowerCase().trim();
    if (teacherEmail && (teacherEmail === userEmail || teacherEmail === staffEmail)) {
      return true;
    }

    // 3. Name matches
    const classTeacher = (c.teacher || c.instructor || '').toLowerCase().trim();
    if (classTeacher) {
      const candidateNames = [
        currentUser?.displayName,
        currentUser?.name,
        currentStaff?.name
      ].filter(Boolean).map(n => n.toLowerCase().trim());

      for (const name of candidateNames) {
        if (name && (classTeacher === name || classTeacher.includes(name) || name.includes(classTeacher))) {
          return true;
        }
      }
    }

    // 4. Fallback for demo mock seed data
    return Boolean(c.taughtByMe);
  }, [currentUser, currentStaff]);

  // Robust student enrollment matching
  const isClassEnrolledByMe = useCallback((c) => {
    return isStudentEnrolledInCourse(currentStudent, c);
  }, [currentStudent]);

  // Calculate my classes count based on role
  const myClassesCount = useMemo(() => {
    if (isTeacher) {
      return classesList.filter(isClassTaughtByMe).length;
    }
    return classesList.filter(isClassEnrolledByMe).length;
  }, [classesList, isTeacher, isClassTaughtByMe, isClassEnrolledByMe]);

  // Classes filtered by tab first
  const tabFilteredClasses = useMemo(() => {
    if (effectiveTab === 'my-classes') {
      if (isTeacher) {
        return classesList.filter(isClassTaughtByMe);
      }
      return classesList.filter(isClassEnrolledByMe);
    }
    return classesList;
  }, [classesList, effectiveTab, isTeacher, isClassTaughtByMe, isClassEnrolledByMe]);

  const courseClassLabel = useCallback(course => (course?.classGroupId ? groupsById.get(String(course.classGroupId))?.label : '') || '', [groupsById]);

  // Classes filtered by search, department and class
  const filteredClasses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tabFilteredClasses.filter(c => {
      const matchesDept = selectedDept === 'All' || c.department === selectedDept;
      const label = courseClassLabel(c);
      const matchesClass = courseClassFilter === 'all' ||
        (courseClassFilter === 'open' ? !label : String(c.classGroupId || '') === courseClassFilter && Boolean(label));
      const matchesSearch = !query ||
        [c.name, c.code, c.teacher, label].some(value => String(value || '').toLowerCase().includes(query));
      return matchesDept && matchesClass && matchesSearch;
    });
  }, [tabFilteredClasses, selectedDept, searchQuery, courseClassFilter, courseClassLabel]);

  // Student counts come from the server, one aggregation per visible course.
  const countSpecs = useMemo(() => filteredClasses.map(courseCountSpec), [filteredClasses]);
  const studentCounts = useStudentCounts(activeSchoolId, view === 'courses' ? countSpecs : [], studentsVersion);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      setFormError(isAlbanian ? 'Ju lutem shënoni titullin e kursit.' : 'Please enter the course title.');
      return;
    }
    if (!newClassCode.trim()) {
      setFormError(isAlbanian ? 'Kodi i kursit është i detyrueshëm (p.sh. CS-101, CHEM-302).' : 'Course code is required (e.g. CS-101, CHEM-302).');
      return;
    }
    if (newClassCredits !== '' && (!Number.isFinite(Number(newClassCredits)) || Number(newClassCredits) <= 0)) {
      setFormError(isAlbanian ? 'Kreditë duhet të jenë numër pozitiv.' : 'Credits must be a positive number.');
      return;
    }
    const weeklySchedule = parseWeeklySchedule(newClassSchedule.trim());
    if (newClassSchedule.trim() && weeklySchedule.length === 0) {
      setFormError(isAlbanian ? 'Përdorni ditët dhe orën, p.sh. E Hënë, E Mërkurë 09:00.' : 'Enter weekday and time, for example Mon, Wed 09:00.');
      return;
    }

    setFormError('');

    const teacherName = newClassTeacher || staffList[0]?.name || currentStaff?.name || currentUser?.displayName || '';
    const selectedStaff = staffList.find(staff => staff.name === teacherName);
    const linkedGroup = newClassGroupId ? groupsById.get(String(newClassGroupId)) : null;
    const newClass = {
      name: newClassName.trim(),
      code: newClassCode.trim().toUpperCase(),
      department: newClassDept,
      teacher: teacherName,
      teacherId: selectedStaff?.id || (teacherName === currentUser?.displayName ? currentUser?.uid : ''),
      teacherEmail: selectedStaff?.email || (teacherName === currentUser?.displayName ? currentUser?.email : ''),
      createdByUid: currentUser?.uid || '',
      room: newClassRoom.trim(),
      schedule: newClassSchedule.trim(),
      weeklySchedule,
      credits: newClassCredits === '' ? null : Number(newClassCredits),
      color: newClassColor || '--primary',
      curriculumStage: newClassCurriculumStage || 'Shkalla III',
      classGroupId: linkedGroup?.id || '',
      classLabel: linkedGroup?.label || '',
      weights: { Homework: 20, Engagement: 15, Quiz: 20, Exam: 30, Project: 15 },
      gradingSettings: { homeworkMinusValue: 1, engagementPlusValue: 1, engagementMinusValue: 1 },
      students: 0,
      progress: 0,
      enrolled: true,
      taughtByMe: isTeacher || (!staffList.length && currentUser?.role !== 'student')
    };

    try {
      if (!addClass) throw new Error('Course saving is unavailable.');
      await addClass(newClass);
      setIsAddModalOpen(false);
      setNewClassName('');
      setNewClassCode('');
      setNewClassCredits('');
      setNewClassRoom('');
      setNewClassSchedule('');
      setNewClassCurriculumStage('Shkalla III');
      setNewClassGroupId('');
      setNewStageTouched(false);
      addNotification?.('success', isAlbanian ? `Lënda "${newClass.name}" u krijua.` : `Course "${newClass.name}" created.`);
    } catch (error) {
      setFormError(error.message || (isAlbanian ? 'Kursi nuk u ruajt.' : 'Course could not be saved.'));
    }
  };

  const downloadCsv = (fileName, header, rows) => {
    const content = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportClasses = () => {
    const date = new Date().toISOString().slice(0, 10);
    if (view === 'groups') {
      downloadCsv(`Classes_${date}.csv`,
        ['Class', 'Grade level', 'Section', 'Homeroom teacher', 'Room', 'Linked courses'],
        classGroups.map(group => [group.label, group.gradeLevel, group.section, homeroomTeacherInfo(group, staffList).name, group.room,
          classesList.filter(course => String(course.classGroupId || '') === String(group.id)).length]));
      return;
    }
    downloadCsv(`${userRole === 'admin' ? 'CurriculumCatalog' : (effectiveTab === 'my-classes' ? 'MyCourses' : 'AllCourses')}_${date}.csv`,
      ['ID', 'Course Name', 'Code', 'Class', 'Department', 'Teacher', 'Room', 'Schedule', 'Credits', 'Students'],
      filteredClasses.map(c => [c.id, c.name, c.code, courseClassLabel(c), c.department, c.teacher, c.room, c.schedule, c.credits ?? '',
        studentCounts.get(courseCountSpec(c)) ?? '']));
  };

  return (
    <motion.div 
      className="classes-page"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.header className="page-header" variants={cardItemVariants}>
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text">
              {t('classes.title')}
              <Book size={30} className="page-title-icon" aria-hidden="true" />
            </h1>
            <span className="count-pill glass">
              {showGroups
                ? `${classGroups.length} ${isAlbanian ? 'klasa' : classGroups.length === 1 ? 'class' : 'classes'}`
                : `${filteredClasses.length} ${isAlbanian ? 'kurse' : filteredClasses.length === 1 ? 'course' : 'courses'}`}
            </span>
          </div>
          <p>{showGroups
            ? (isAlbanian ? 'Klasat (p.sh. 10A) me mësimdhënësin kujdestar, nxënësit dhe lëndët e tyre.' : 'Classes (for example 10A) with their homeroom teacher, students and courses.')
            : t('classes.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary glass" onClick={handleExportClasses}>
            <Download size={16} />
            {isAlbanian ? 'Eksporto CSV' : 'Export CSV'}
          </button>
          {!showGroups && canCreateClass && (
            <button type="button" className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={18} />
              {t('classes.addClass')}
            </button>
          )}
          {showGroups && isAdmin && (
            <button type="button" className="btn-primary" onClick={() => setGroupForm({ mode: 'create' })}>
              <Plus size={18} />
              {isAlbanian ? 'Krijo Klasë' : 'Create Class'}
            </button>
          )}
        </div>
      </motion.header>

      {userRole !== 'student' && (
        <motion.div className="classes-view-switch" role="tablist" aria-label={isAlbanian ? 'Kurset ose klasat' : 'Courses or classes'} variants={cardItemVariants}>
          <button type="button" role="tab" aria-selected={!showGroups} className={`classes-view-tab ${!showGroups ? 'active' : ''}`} onClick={() => chooseView('courses')}>
            <BookOpen size={16} />
            <span>{isAlbanian ? 'Kurset' : 'Courses'}</span>
            <span className="tab-pill-counter">{classesList.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={showGroups} className={`classes-view-tab ${showGroups ? 'active' : ''}`} onClick={() => chooseView('groups')}>
            <GraduationCap size={16} />
            <span>{isAlbanian ? 'Klasat' : 'Classes'}</span>
            <span className="tab-pill-counter">{classGroups.length}</span>
          </button>
          <span className="classes-view-hint">{showGroups
            ? (isAlbanian ? 'Klasa: grupi i nxënësve me kujdestarin. Nuk ka orar.' : 'Class: a group of students with a homeroom teacher. No timetable.')
            : (isAlbanian ? 'Kursi: lënda në orar, me mësimdhënës dhe orë.' : 'Course: a subject on the timetable, with a teacher and times.')}</span>
        </motion.div>
      )}

      {showGroups ? (
        <ClassGroupsView
          userRole={userRole}
          canEditMembership={canEditStudentMembership}
          onOpenCourse={onClassSelect}
          onOpenSchedule={onOpenSchedule}
          onRequestCreate={() => setGroupForm({ mode: 'create' })}
          onRequestEdit={group => setGroupForm({ mode: 'edit', group })}
          addNotification={addNotification}
        />
      ) : (<>
      {/* Role-Based Tabs (My Classes vs All Classes) - ONLY for Students and Teachers */}
      {userRole !== 'admin' && (
        <motion.div className="classes-nav-tabs-bar glass" variants={cardItemVariants}>
          <div className="classes-nav-tabs">
            <button
              type="button"
              className={`classes-nav-tab ${effectiveTab === 'my-classes' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-classes')}
            >
              <BookOpen size={16} />
              <span>{isTeacher ? (isAlbanian ? 'Lëndët që Jap' : 'Courses I Teach') : (isAlbanian ? 'Lëndët e Mia' : 'My Courses')}</span>
              <span className="tab-pill-counter">{myClassesCount}</span>
            </button>
            <button
              type="button"
              className={`classes-nav-tab ${effectiveTab === 'all-classes' ? 'active' : ''}`}
              onClick={() => setActiveTab('all-classes')}
            >
              <Layers size={16} />
              <span>{isAlbanian ? 'Të Gjitha Lëndët' : 'All Courses'}</span>
              <span className="tab-pill-counter">{classesList.length}</span>
            </button>
          </div>

          {/* Info hint */}
          <div className="classes-tabs-hint">
            {effectiveTab === 'my-classes' ? (
              <span>
                {isTeacher
                  ? (isAlbanian ? 'Po shfaqen lëndët që jepni ju' : 'Showing courses you teach')
                  : (isAlbanian ? 'Po shfaqen lëndët ku jeni të regjistruar' : 'Showing courses you are enrolled in')}
              </span>
            ) : (
              <span>{isAlbanian ? 'Shfletoni katalogun e plotë kurrikular të shkollës' : 'Browsing full school curriculum catalog'}</span>
            )}
          </div>
        </motion.div>
      )}

      {/* Student Banner when in My Classes */}
      {userRole === 'student' && effectiveTab === 'my-classes' && (
        <motion.div className="student-classes-summary-strip glass" variants={cardItemVariants}>
          <div className="strip-info">
            <div className="strip-avatar-badge">
              <GraduationCap size={22} />
            </div>
            <div>
              <h4>{myClassGroup ? `${isAlbanian ? 'Klasa' : 'Class'} ${myClassGroup.label}` : (isAlbanian ? 'Ende pa klasë' : 'No class assigned yet')}</h4>
              <p>{tabFilteredClasses.length} {tabFilteredClasses.length === 1 ? (isAlbanian ? 'Lëndë Aktive e Regjistruar' : 'Active Subject Enrolled') : (isAlbanian ? 'Lëndë Aktive të Regjistruara' : 'Active Subjects Enrolled')}</p>
            </div>
          </div>
          <div className="strip-stats">
            <div className="strip-stat-item">
              <span className="strip-stat-label">{isAlbanian ? 'Kujdestari' : 'Homeroom teacher'}</span>
              <strong className="strip-stat-val">{myClassGroup ? homeroomTeacherInfo(myClassGroup, staffList, isAlbanian).name : '—'}</strong>
            </div>
          </div>
        </motion.div>
      )}

      {/* Teacher Banner when in My Classes */}
      {isTeacher && effectiveTab === 'my-classes' && (
        <motion.div className="student-classes-summary-strip glass" variants={cardItemVariants}>
          <div className="strip-info">
            <div className="strip-avatar-badge" style={{ background: 'hsla(var(--primary), 0.18)', color: 'hsl(var(--primary))' }}>
              <BookOpen size={22} />
            </div>
            <div>
              <h4>{currentUser?.displayName || currentUser?.name ? (isAlbanian ? `Kurset Mësimdhënëse të ${currentUser.displayName || currentUser.name}` : `${currentUser.displayName || currentUser.name}'s Teaching Schedule`) : (isAlbanian ? 'Kurset e Mia Mësimdhënëse' : 'My Teaching Schedule')}</h4>
              <p>{tabFilteredClasses.length} {tabFilteredClasses.length === 1 ? (isAlbanian ? 'Kurs Aktiv Mësimdhënës' : 'Active Course Taught') : (isAlbanian ? 'Kurse Aktive Mësimdhënëse' : 'Active Courses Taught')}</p>
            </div>
          </div>
          <div className="strip-stats">
            <div className="strip-stat-item">
              <span className="strip-stat-label">{isAlbanian ? 'Statusi i Mësimdhënies' : 'Teaching Status'}</span>
              <strong className="strip-stat-val text-success">{isAlbanian ? 'Aktiv / Në Orar' : 'Active / On Schedule'}</strong>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filter and Search Bar */}
      <motion.div className="classes-controls-bar" variants={cardItemVariants}>
        <div className="classes-search-box">
          <Search size={17} className="search-icon" />
          <input 
            type="text" 
            placeholder={t('classes.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="clear-btn" onClick={() => setSearchQuery('')}>
              <X size={15} />
            </button>
          )}
        </div>

        <div className="classes-filter-pills">
          {departments.map(dept => (
            <button
              key={dept.id}
              type="button"
              className={`dept-pill ${selectedDept === dept.id ? 'active' : ''}`}
              onClick={() => setSelectedDept(dept.id)}
            >
              {isAlbanian ? dept.labelSq : dept.labelEn}
            </button>
          ))}
          {classGroups.length > 0 && (
            <select className="custom-form-select cg-grade-filter" value={courseClassFilter} onChange={event => setCourseClassFilter(event.target.value)}
              aria-label={isAlbanian ? 'Filtro sipas klasës' : 'Filter by class'}>
              <option value="all">{isAlbanian ? 'Të gjitha klasat' : 'All classes'}</option>
              <option value="open">{isAlbanian ? 'Lëndë të hapura (pa klasë)' : 'Open courses (no class)'}</option>
              {classGroups.map(group => <option key={group.id} value={group.id}>{isAlbanian ? 'Klasa' : 'Class'} {group.label}</option>)}
            </select>
          )}
        </div>
      </motion.div>

      {/* Classes Grid */}
      <div className="classes-grid">
        <AnimatePresence mode="popLayout">
          {filteredClasses.length > 0 ? (
            filteredClasses.map((classItem) => (
              <ClassCard 
                key={classItem.id} 
                classInfo={classItem} 
                onClick={onClassSelect} 
                userRole={userRole}
                isTaughtByMe={isClassTaughtByMe(classItem)}
                isEnrolled={isClassEnrolledByMe(classItem)}
                isAlbanian={isAlbanian}
                studentCount={studentCounts.get(courseCountSpec(classItem))}
                classLabel={courseClassLabel(classItem)}
                canManage={canManageClass}
                onEdit={handleOpenEdit}
                onDelete={(cls) => setClassToDelete(cls)}
              />
            ))
          ) : (
            <motion.div 
              className="empty-classes-card glass"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="empty-icon-wrap">
                <BookOpen size={40} className="muted" />
              </div>
              <h3>{isAlbanian ? 'Nuk u gjet asnjë lëndë' : 'No courses found'}</h3>
              <p>
                {effectiveTab === 'my-classes'
                  ? (isAlbanian
                      ? (userRole === 'teacher'
                          ? 'Nuk ka kurse që ligjëroni që përputhen me kërkimin tuaj. Provoni të kaloni te "Të Gjitha Lëndët" për të shfletuar katalogun.'
                          : 'Nuk ka lëndë që përputhen me kërkimin tuaj në listën tuaj të regjistrimeve. Provoni të kaloni te "Të Gjitha Lëndët" për të shfletuar katalogun.')
                      : 'No courses match your search in your list. Switch to "All Courses" to browse other subjects.')
                  : (isAlbanian
                      ? 'Nuk ka lëndë që përputhen me kriteret aktuale të kërkimit ose filtrin e departamentit.'
                      : 'No courses match your search or filters.')}
              </p>
              {effectiveTab === 'my-classes' ? (
                <button type="button" className="btn-secondary glass btn-sm" onClick={() => setActiveTab('all-classes')}>
                  {isAlbanian ? 'Shfleto Të Gjitha Lëndët' : 'Browse All Courses'}
                </button>
              ) : (
                <button type="button" className="btn-secondary glass btn-sm" onClick={() => { setSearchQuery(''); setSelectedDept('All'); setCourseClassFilter('all'); }}>
                  {isAlbanian ? 'Pastro Filtrat' : 'Clear Filters'}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </>)}

      <AnimatePresence>
        {groupForm && (
          <ClassGroupForm
            key={groupForm.group?.id || 'new-class'}
            mode={groupForm.mode}
            group={groupForm.group}
            onClose={() => setGroupForm(null)}
            addNotification={addNotification}
          />
        )}
      </AnimatePresence>

      {/* ── MODAL: Add New Course ── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Shto Kurs të Ri' : 'Add New Course'}</h3>
                <p className="modal-subtitle">
                  {isAlbanian ? 'Krijoni një lëndë mësimore dhe caktoni mësimdhënësin kryesor.' : 'Create a curriculum subject and assign a lead instructor.'}
                </p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddModalOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateClass} className="modal-form">
                {formError && (
                  <div style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    background: 'hsla(var(--destructive), 0.15)',
                    border: '1px solid hsla(var(--destructive), 0.35)',
                    color: 'hsl(var(--destructive))',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem'
                  }}>
                    {formError}
                  </div>
                )}

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>
                      {isAlbanian ? 'Titulli i Kursit' : 'Course Title'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span>
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder={isAlbanian ? 'p.sh. Kimi Organike II' : 'e.g. Organic Chemistry II'}
                      value={newClassName}
                      onChange={(e) => { setNewClassName(e.target.value); if (formError) setFormError(''); }}
                    />
                  </div>

                  <div className="input-group">
                    <label>
                      {isAlbanian ? 'Kodi i Kursit' : 'Course Code'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'hsl(var(--primary))', marginLeft: '0.35rem' }}>
                        ({isAlbanian ? 'I Detyrueshëm' : 'Required'})
                      </span>
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. CHEM-302, MATH-101"
                      value={newClassCode}
                      onChange={(e) => { setNewClassCode(e.target.value); if (formError) setFormError(''); }}
                    />
                    <small style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.73rem', color: 'hsl(var(--muted-foreground))' }}>
                      {isAlbanian ? 'Kodi unik për orar dhe regjistër (p.sh. CS-101)' : 'Unique identifier for schedule and roster (e.g. CS-101)'}
                    </small>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>
                      {isAlbanian ? 'Departamenti' : 'Department'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span>
                    </label>
                    <select 
                      value={newClassDept}
                      onChange={(e) => setNewClassDept(e.target.value)}
                      className="custom-form-select"
                    >
                      <option value="Science">{isAlbanian ? 'Shkenca & Laboratore' : 'Science & Labs'}</option>
                      <option value="Mathematics">{isAlbanian ? 'Matematikë' : 'Mathematics'}</option>
                      <option value="Humanities">{isAlbanian ? 'Shkenca Shoqërore & Gjuhë' : 'Humanities & Languages'}</option>
                      <option value="Technology">{isAlbanian ? 'Teknologji & Informatikë' : 'Technology & Computer Science'}</option>
                      <option value="Arts">{isAlbanian ? 'Arte & Muzikë' : 'Fine Arts & Music'}</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>
                      {isAlbanian ? 'Mësimdhënësi Udhëheqës' : 'Lead Instructor'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span>
                    </label>
                    <select 
                      value={newClassTeacher || staffList[0]?.name || currentUser?.displayName || ''}
                      onChange={(e) => setNewClassTeacher(e.target.value)}
                      className="custom-form-select"
                    >
                      {staffList.length > 0 ? (
                        staffList.map(s => (
                          <option key={s.id} value={s.name}>{s.name} ({s.department || s.roleName || 'Faculty'})</option>
                        ))
                      ) : (
                        <option value={currentUser?.displayName || 'Lead Instructor'}>
                          {currentUser?.displayName || 'Lead Instructor'} (Instructor)
                        </option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Salla / Dhoma e Caktuar' : 'Assigned Room'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. Salla 104' : 'e.g. Chemistry Lab 3'}
                      value={newClassRoom}
                      onChange={(e) => setNewClassRoom(e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Orari & Dita' : 'Schedule & Time'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. E Martë, E Enjte 09:30' : 'e.g. Tue, Thu 09:30 AM'}
                      value={newClassSchedule}
                      onChange={(e) => setNewClassSchedule(e.target.value)}
                    />
                    <small>{isAlbanian ? 'P.sh. E Hënë, E Mërkurë 09:00 - 10:00. Shfaqet automatikisht në orar.' : 'For example: Mon, Wed 09:00 - 10:00. Appears automatically in Schedule.'}</small>
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="new-course-credits">{isAlbanian ? 'Kredite të Kursit' : 'Course Credits'}</label>
                  <input
                    id="new-course-credits"
                    type="number"
                    min="0.1"
                    step="any"
                    placeholder={isAlbanian ? 'Shëno numrin e krediteve' : 'Enter credit amount'}
                    value={newClassCredits}
                    onChange={(e) => setNewClassCredits(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="new-course-class">{isAlbanian ? 'Klasa' : 'Class'}</label>
                  <select
                    id="new-course-class"
                    value={newClassGroupId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setNewClassGroupId(next);
                      const label = groupsById.get(next)?.label;
                      if (label && !newStageTouched) setNewClassCurriculumStage(stageForClass(label) || newClassCurriculumStage);
                    }}
                    className="custom-form-select"
                  >
                    <option value="">{isAlbanian ? 'Lëndë e hapur (nxënësit shtohen një nga një)' : 'Open course (add students one by one)'}</option>
                    {classGroups.map(group => <option key={group.id} value={group.id}>{isAlbanian ? 'Klasa' : 'Class'} {group.label}</option>)}
                  </select>
                  <small>{newClassGroupId
                    ? (isAlbanian ? 'Të gjithë nxënësit e kësaj klase regjistrohen automatikisht, edhe ata që shtohen më vonë.' : 'Every student of this class is enrolled automatically, including students added later.')
                    : classGroups.length
                      ? (isAlbanian ? 'Zgjidhni një klasë kur lënda mësohet për një klasë të caktuar.' : 'Choose a class when the course is taught to one class.')
                      : (isAlbanian ? 'Krijoni klasat te "Klasat" për t\u0027i lidhur me lëndët.' : 'Create classes under "Classes" to link them to courses.')}</small>
                </div>

                <div className="input-group">
                  <label>{isAlbanian ? 'Shkalla e Kurrikulës' : 'Curriculum Stage'}</label>
                  <select
                    value={newClassCurriculumStage}
                    onChange={(e) => { setNewClassCurriculumStage(e.target.value); setNewStageTouched(true); }}
                    className="custom-form-select"
                  >
                    {CURRICULUM_STAGES.map(stage => (
                      <option key={stage.id} value={stage.id}>
                        {isAlbanian ? stage.labelSq : stage.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label>{isAlbanian ? 'Ngjyra e Kartelës' : 'Card Color Accent'}</label>
                  <div className="swatch-picker-row">
                    {SWATCH_OPTIONS.map(swatch => (
                      <button
                        key={swatch.value}
                        type="button"
                        className={`swatch-btn ${newClassColor === swatch.value ? 'selected' : ''}`}
                        style={{ backgroundColor: `hsl(var(${swatch.value}))` }}
                        onClick={() => setNewClassColor(swatch.value)}
                        title={swatch.label}
                      >
                        {newClassColor === swatch.value && <Check size={14} color="#fff" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setIsAddModalOpen(false); setFormError(''); }}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary">
                    {isAlbanian ? 'Krijo Kursin' : 'Create Course'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Edit Course ── */}
      <AnimatePresence>
        {editingClass && (
          <div className="modal-overlay" onClick={() => setEditingClass(null)}>
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Ndrysho Detajet e Kursit' : 'Edit Course Details'}</h3>
                <p className="modal-subtitle">
                  {isAlbanian 
                    ? 'Modifikoni emrin e kursit, mësimdhënësin kryesor, orarin dhe sallën.' 
                    : 'Modify course name, lead instructor, schedule, room, and attributes.'}
                </p>
                <button type="button" className="icon-btn-close" onClick={() => setEditingClass(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveEditClass} className="modal-form">
                {editFormError && (
                  <div style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    background: 'hsla(var(--destructive), 0.15)',
                    border: '1px solid hsla(var(--destructive), 0.35)',
                    color: 'hsl(var(--destructive))',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem'
                  }}>
                    {editFormError}
                  </div>
                )}

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>
                      {isAlbanian ? 'Titulli i Kursit' : 'Course Title'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span>
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder={isAlbanian ? 'p.sh. Kimi Organike II' : 'e.g. Organic Chemistry II'}
                      value={editForm.name}
                      onChange={(e) => { setEditForm({ ...editForm, name: e.target.value }); if (editFormError) setEditFormError(''); }}
                    />
                  </div>

                  <div className="input-group">
                    <label>
                      {isAlbanian ? 'Kodi i Kursit' : 'Course Code'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span>
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. CHEM-302, MATH-101"
                      value={editForm.code}
                      onChange={(e) => { setEditForm({ ...editForm, code: e.target.value }); if (editFormError) setEditFormError(''); }}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>
                      {isAlbanian ? 'Mësimdhënësi Udhëheqës' : 'Lead Instructor'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span>
                    </label>
                    <select 
                      value={editForm.teacher}
                      onChange={(e) => setEditForm({ ...editForm, teacher: e.target.value })}
                      className="custom-form-select"
                    >
                      {staffList.length > 0 ? (
                        staffList.map(s => (
                          <option key={s.id} value={s.name}>{s.name} ({s.department || s.roleName || 'Faculty'})</option>
                        ))
                      ) : (
                        <option value={editForm.teacher || currentUser?.displayName || 'Lead Instructor'}>
                          {editForm.teacher || currentUser?.displayName || 'Lead Instructor'}
                        </option>
                      )}
                      {editForm.teacher && !staffList.some(s => s.name === editForm.teacher) && (
                        <option value={editForm.teacher}>{editForm.teacher}</option>
                      )}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>
                      {isAlbanian ? 'Departamenti' : 'Department'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span>
                    </label>
                    <select 
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="Science">{isAlbanian ? 'Shkenca & Laboratore' : 'Science & Labs'}</option>
                      <option value="Mathematics">{isAlbanian ? 'Matematikë' : 'Mathematics'}</option>
                      <option value="Humanities">{isAlbanian ? 'Shkenca Shoqërore & Gjuhë' : 'Humanities & Languages'}</option>
                      <option value="Technology">{isAlbanian ? 'Teknologji & Informatikë' : 'Technology & Computer Science'}</option>
                      <option value="Arts">{isAlbanian ? 'Arte & Muzikë' : 'Fine Arts & Music'}</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Salla / Dhoma e Caktuar' : 'Assigned Room'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. Salla 104' : 'e.g. Chemistry Lab 3'}
                      value={editForm.room}
                      onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Orari & Dita' : 'Schedule & Time'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. E Martë, E Enjte 09:30' : 'e.g. Tue, Thu 09:30 AM'}
                      value={editForm.schedule}
                      onChange={(e) => setEditForm({ ...editForm, schedule: e.target.value })}
                    />
                    <small>{isAlbanian ? 'P.sh. E Hënë, E Mërkurë 09:00 - 10:00. Ndryshimet shfaqen në orar.' : 'For example: Mon, Wed 09:00 - 10:00. Changes appear in Schedule.'}</small>
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="edit-course-class">{isAlbanian ? 'Klasa' : 'Class'}</label>
                  <select
                    id="edit-course-class"
                    value={editForm.classGroupId || ''}
                    onChange={(e) => {
                      const next = e.target.value;
                      const label = groupsById.get(next)?.label;
                      setEditForm({ ...editForm, classGroupId: next, ...(label && !editStageTouched ? { curriculumStage: stageForClass(label) || editForm.curriculumStage } : {}) });
                    }}
                    className="custom-form-select"
                  >
                    <option value="">{isAlbanian ? 'Lëndë e hapur (nxënësit shtohen një nga një)' : 'Open course (add students one by one)'}</option>
                    {classGroups.map(group => <option key={group.id} value={group.id}>{isAlbanian ? 'Klasa' : 'Class'} {group.label}</option>)}
                  </select>
                  <small>{(editForm.classGroupId || '') !== String(editingClass.classGroupId || '')
                    ? (isAlbanian ? 'Ndryshimi i klasës ndryshon se cilët nxënës janë të regjistruar automatikisht. Notat e ruajtura nuk fshihen.' : 'Changing the class changes which students are enrolled automatically. Saved grades are kept.')
                    : editForm.classGroupId
                      ? (isAlbanian ? 'Të gjithë nxënësit e kësaj klase janë të regjistruar automatikisht.' : 'Every student of this class is enrolled automatically.')
                      : (isAlbanian ? 'Nxënësit shtohen një nga një te regjistri i lëndës.' : 'Students are added one by one in the course roster.')}</small>
                </div>

                <div className="input-group">
                  <label>{isAlbanian ? 'Shkalla e Kurrikulës' : 'Curriculum Stage'}</label>
                  <select
                    value={editForm.curriculumStage || 'Shkalla III'}
                    onChange={(e) => { setEditForm({ ...editForm, curriculumStage: e.target.value }); setEditStageTouched(true); }}
                    className="custom-form-select"
                  >
                    {CURRICULUM_STAGES.map(stage => (
                      <option key={stage.id} value={stage.id}>
                        {isAlbanian ? stage.labelSq : stage.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Kredite të Kursit' : 'Course Credits'}</label>
                    <input 
                      type="number" 
                      min="0.1"
                      step="any"
                      value={editForm.credits}
                      onChange={(e) => setEditForm({ ...editForm, credits: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Ngjyra e Kartelës' : 'Card Color Accent'}</label>
                    <div className="swatch-picker-row">
                      {SWATCH_OPTIONS.map(swatch => (
                        <button
                          key={swatch.value}
                          type="button"
                          className={`swatch-btn ${editForm.color === swatch.value ? 'selected' : ''}`}
                          style={{ backgroundColor: `hsl(var(${swatch.value}))` }}
                          onClick={() => setEditForm({ ...editForm, color: swatch.value })}
                          title={swatch.label}
                        >
                          {editForm.color === swatch.value && <Check size={14} color="#fff" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setEditingClass(null); setEditFormError(''); }}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary">
                    {isAlbanian ? 'Ruaj Ndryshimet' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Delete Course Confirmation ── */}
      <AnimatePresence>
        {classToDelete && (
          <div className="modal-overlay" onClick={() => !isDeleting && setClassToDelete(null)}>
            <motion.div 
              className="modal-content delete-class-modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--destructive))' }}>
                  <AlertTriangle size={20} />
                  {isAlbanian ? 'Fshij Lëndën' : 'Delete Course'}
                </h3>
                <p className="modal-subtitle">
                  {isAlbanian ? 'Konfirmoni heqjen e këtij kursi nga kurrikula shkollore.' : 'Confirm removal of this course from the school curriculum.'}
                </p>
                <button type="button" className="icon-btn-close" onClick={() => !isDeleting && setClassToDelete(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <div className="modal-form" style={{ gap: '1rem', display: 'flex', flexDirection: 'column' }}>
                <div className="delete-warning-banner">
                  <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>{isAlbanian ? 'Kujdes: Veprim i Pakthyeshëm' : 'Warning: Permanent Action'}</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.84rem' }}>
                      {isAlbanian 
                        ? 'Kjo lëndë do të fshihet përgjithmonë nga baza e të dhënave, oraret e mësimdhënësve dhe listat e nxënësve.'
                        : 'This course will be permanently removed from the database, faculty timetables, and student enrollment records.'}
                    </p>
                  </div>
                </div>

                <div className="delete-class-course-preview">
                  <div className="class-icon" style={{ backgroundColor: `hsla(var(${classToDelete.color || '--primary'}), 0.2)`, color: `hsl(var(${classToDelete.color || '--primary'}))` }}>
                    <Book size={20} />
                  </div>
                  <div>
                    <strong>{classToDelete.name}</strong>
                    <span>{classToDelete.code} • {classToDelete.teacher} ({classToDelete.room || 'Room 101'})</span>
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => setClassToDelete(null)}
                    disabled={isDeleting}
                  >
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button 
                    type="button" 
                    className="btn-destructive" 
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} />
                    {isDeleting 
                      ? (isAlbanian ? 'Duke fshirë...' : 'Deleting...') 
                      : (isAlbanian ? 'Po, Fshij Lëndën' : 'Yes, Delete Course')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Classes;
