import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, Clock, MapPin, User, Search, 
  Filter, Calendar, Download, Plus, X, Check, BookOpen, 
  Sparkles, RotateCcw, Tag, Layers, GraduationCap, CheckCircle2,
  Trash2
} from 'lucide-react';
import ClassDetail from '../components/ClassDetail';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../services/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Avatar } from '../components/Avatar';
import { SUBJECTS } from '../features/lessonPlans/catalog';
import { translateCatalogValue } from '../features/lessonPlans/i18n';
import { courseMatchesReference, isStudentEnrolledInCourse } from '../features/enrollment';
import { classGroupForItem, classGroupsById } from '../features/classGroups';
import { normalizeSearchText } from '../features/students/studentSearch';
import { mergeCourseSchedule, scheduleStartMinutes, weeklyScheduleForCourse } from '../features/courseSchedule';
import './Schedule.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' }
  }
};

const ScheduleItem = ({ item, delay, onClick, activeTab, userRole, onDeleteSlot, isAlbanian, isMine }) => {
  const isEnrolledOrTaught = isMine !== undefined ? isMine : Boolean(item.enrolled);

  return (
    <motion.div 
      className={`schedule-item glass bouncy ${item.isEvent ? 'event-type' : ''}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay }}
      onClick={() => onClick(item)}
      layout
    >
      <div className="time-strip" style={{ backgroundColor: `hsl(var(${item.color || '--primary'}))` }}></div>
      <div className="schedule-content">
        <div className="schedule-header">
          <div className="header-left" style={{ flexWrap: 'wrap' }}>
            <span className="class-time">{item.time}</span>
            {item.isEvent && (
              <span className="event-tag">
                <Calendar size={11} /> {isAlbanian ? 'Ngjarje' : 'Event'}
              </span>
            )}
            {item.classLabel && !item.isEvent && (
              <span className="category-tag glass">{isAlbanian ? `Klasa ${item.classLabel}` : `Class ${item.classLabel}`}{item.period ? ` · P${item.period}` : ''}</span>
            )}
            {item.subjectCategory && !item.isEvent && !item.classLabel && (
              <span className="category-tag glass">{item.subjectCategory}</span>
            )}
            {activeTab === 'all-schedule' && userRole !== 'admin' && isEnrolledOrTaught && !item.isEvent && (
              <span className="enrolled-status-pill">
                <CheckCircle2 size={11} /> {userRole === 'teacher' ? (isAlbanian ? 'Lënda Ime' : 'My Class') : (isAlbanian ? 'I Regjistruar' : 'Enrolled')}
              </span>
            )}
          </div>
          {item.room && <span className="class-room"><MapPin size={12} /> {item.room}</span>}
        </div>
        <h3>{item.subject}</h3>
        <div className="schedule-footer">
          {(item.isEvent || item.teacher) && <div className="teacher-small">
            <div className="avatar-xs">
              {item.isEvent ? (
                <div className="icon-avatar-xs" style={{ background: `hsla(var(${item.color}), 0.2)`, color: `hsl(var(${item.color}))` }}>
                  <Clock size={15} />
                </div>
              ) : (
                <Avatar alt={item.teacher} />
              )}
            </div>
            <span className="teacher-name">{item.isEvent ? (item.attendees == null ? (isAlbanian ? 'Ngjarje e shkollës' : 'School event') : (isAlbanian ? `${item.attendees} Të Regjistruar` : `${item.attendees} Registered`)) : item.teacher}</span>
          </div>}
          {['admin', 'teacher', 'dept_head'].includes(userRole) && !item.isEvent && item.source !== 'course' && onDeleteSlot && (
            <button 
              type="button" 
              className="icon-action-btn delete glass"
              style={{ marginLeft: 'auto', padding: '4px', opacity: 0.7 }}
              onClick={(e) => { e.stopPropagation(); onDeleteSlot(item.id); }}
              title={isAlbanian ? 'Fshij Orën' : 'Delete Slot'}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const LEGACY_LABEL_PREFIX = 'label:';

// A course named like a curriculum subject ("Matematikë") can start a lesson plan directly.
function catalogSubjectFor(name) {
  const needle = normalizeSearchText(name);
  if (!needle) return '';
  const match = SUBJECTS.find(subject => [subject.name, ...subject.aliases].some(value => normalizeSearchText(value) === needle));
  return match?.name || '';
}

const EMPTY_SLOT_FORM = {
  day: 'Monday',
  time: '',
  courseId: '',
  subject: '',
  curriculumSubject: '',
  classGroupId: '',
  classLabel: '',
  period: '',
  subjectCategory: 'Academic',
  room: '',
  teacher: '',
  isEvent: false,
  color: '--primary'
};

function mondayForWeek(weekOffset) {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() + (today.getDay() === 0 ? -6 : 1 - today.getDay()) + weekOffset * 7);
  return monday;
}

function dateForDay(monday, day) {
  const date = new Date(monday);
  date.setDate(date.getDate() + DAYS.indexOf(day));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const Schedule = ({ userRole = 'student', lessonLanguage = 'en', onCreateLessonPlan, onOpenCourses, initialFilter = null, onInitialFilterConsumed }) => {
  const { staffList = [], classesList = [], classesLoaded, classesError, classGroups = [], myStudentRecord } = useSchoolData();
  const { activeSchoolId, currentUser } = useAuth();
  const { t, isAlbanian } = useLanguage();
  const [savedSchedule, setSavedSchedule] = useState({ schoolId: null, entries: [], error: null, loaded: false });
  const groupsById = useMemo(() => classGroupsById(classGroups), [classGroups]);
  // Every lesson carries its class: the course's linked class, the slot's own
  // link, or an older free-text label matched to a class by grade and section.
  const scheduleState = useMemo(() => {
    const merged = mergeCourseSchedule(classesLoaded ? classesList : [], savedSchedule.schoolId === activeSchoolId ? savedSchedule.entries : []);
    const coursesById = new Map(classesList.map(course => [String(course.id), course]));
    return Object.fromEntries(Object.entries(merged).map(([day, items]) => [day, items.map(item => {
      if (item.isEvent) return item;
      const course = item.courseId ? coursesById.get(String(item.courseId)) : null;
      const group = classGroupForItem(course?.classGroupId ? { classGroupId: course.classGroupId, classLabel: item.classLabel } : item, classGroups, groupsById);
      return { ...item, classGroupId: group?.id || '', classLabel: group?.label || item.classLabel || course?.classLabel || '' };
    })]));
  }, [classesLoaded, classesList, savedSchedule, activeSchoolId, classGroups, groupsById]);
  const scheduleError = savedSchedule.schoolId === activeSchoolId ? savedSchedule.error : null;
  const scheduleLoading = !classesLoaded || (activeSchoolId && (savedSchedule.schoolId !== activeSchoolId || !savedSchedule.loaded));

  useEffect(() => {
    if (!activeSchoolId) return undefined;
    let active = true;

    const entriesCol = collection(db, 'schools', activeSchoolId, 'scheduleEntries');
    const unsubscribe = onSnapshot(entriesCol, (snapshot) => {
      if (!active) return;
      setSavedSchedule({ schoolId: activeSchoolId, entries: snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })), error: null, loaded: true });
    }, (err) => {
      if (!active) return;
      console.warn('Notice listening to schedule entries:', err.message);
      setSavedSchedule({ schoolId: activeSchoolId, entries: [], error: err, loaded: true });
    });

    return () => { active = false; unsubscribe(); };
  }, [activeSchoolId]);

  // The filter a page opened this timetable with is applied once at mount.
  useEffect(() => {
    if (initialFilter) onInitialFilterConsumed?.();
  }, [initialFilter, onInitialFilterConsumed]);

  const handleDeleteSlot = async (slotId) => {
    if (!activeSchoolId || String(slotId).startsWith('course:')) return;
    try {
      await deleteDoc(doc(db, 'schools', activeSchoolId, 'scheduleEntries', String(slotId)));
    } catch (err) {
      console.warn('Error deleting schedule entry:', err.message);
    }
  };

  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedClass, setSelectedClass] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddSlotOpen, setIsAddSlotOpen] = useState(false);
  const [slotError, setSlotError] = useState('');

  // Default tab for student and teacher is 'my-schedule', for admin is 'all-schedule'.
  // Opening a class's timetable from Courses & Classes starts on the whole school.
  const [activeTab, setActiveTab] = useState(() => (userRole === 'admin' || initialFilter ? 'all-schedule' : 'my-schedule'));
  const [prevRole, setPrevRole] = useState(userRole);

  if (prevRole !== userRole) {
    setPrevRole(userRole);
    setActiveTab(userRole === 'admin' ? 'all-schedule' : 'my-schedule');
  }

  // Superadmins NEVER have a personal schedule tab; strictly locked to master campus schedule
  const effectiveTab = userRole === 'admin' ? 'all-schedule' : activeTab;

  // Resolve staff & student records
  const currentStaff = useMemo(() => {
    return staffList.find(s => 
      s.id === currentUser?.uid || 
      (s.email && currentUser?.email && s.email.toLowerCase() === currentUser.email.toLowerCase())
    );
  }, [staffList, currentUser]);

  const currentStudent = myStudentRecord;

  const defaultTeacherName = useMemo(() => {
    return currentStaff?.name || currentUser?.displayName || currentUser?.name || (staffList[0]?.name || 'Teacher');
  }, [currentStaff, currentUser, staffList]);

  // Week navigation state
  const [weekOffset, setWeekOffset] = useState(0);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'classes', 'events'
  const [classFilter, setClassFilter] = useState(() => initialFilter?.classGroupId ? String(initialFilter.classGroupId) : 'all');
  const [courseFilter, setCourseFilter] = useState(() => initialFilter?.courseId ? String(initialFilter.courseId) : 'all');

  // Add Slot Form State
  const [newSlotForm, setNewSlotForm] = useState(EMPTY_SLOT_FORM);

  const days = DAYS;

  const weekMonday = useMemo(() => mondayForWeek(weekOffset), [weekOffset]);

  // A selected weekday is resolved against the displayed week, including week navigation.
  const weekDateString = useMemo(() => {
    const friday = new Date(weekMonday);
    friday.setDate(friday.getDate() + 4);

    if (isAlbanian) {
      const albanianMonths = ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Korr', 'Gush', 'Sht', 'Tet', 'Nën', 'Dhj'];
      const startMonth = albanianMonths[weekMonday.getMonth()];
      const endMonth = albanianMonths[friday.getMonth()];
      const startDay = weekMonday.getDate();
      const endDay = friday.getDate();
      const year = friday.getFullYear();

      if (startMonth === endMonth) {
        return `${startDay} – ${endDay} ${startMonth}, ${year}`;
      }
      return `${startDay} ${startMonth} – ${endDay} ${endMonth}, ${year}`;
    }

    const startMonth = weekMonday.toLocaleString('en-US', { month: 'short' });
    const endMonth = friday.toLocaleString('en-US', { month: 'short' });
    const startDay = weekMonday.getDate();
    const endDay = friday.getDate();
    const year = friday.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  }, [weekMonday, isAlbanian]);

  // Determine if an item belongs in My Schedule
  const isItemInMySchedule = useCallback((item) => {
    if (!item) return false;
    if (item.isEvent) return true;

    if (userRole === 'teacher' || userRole === 'dept_head') {
      // 1. Direct creator / teacher ID match
      if (item.createdByUid && item.createdByUid === currentUser?.uid) return true;
      if (item.teacherId && (item.teacherId === currentUser?.uid || (currentStaff && (item.teacherId === currentStaff.id || item.teacherId === currentStaff.staffId)))) return true;

      // 2. Teacher name match
      const itemTeacher = (item.teacher || '').toLowerCase().trim();
      if (itemTeacher) {
        const candidateNames = [
          currentUser?.displayName,
          currentUser?.name,
          currentStaff?.name
        ].filter(Boolean).map(n => n.toLowerCase().trim());

        for (const name of candidateNames) {
          if (name && (itemTeacher === name || itemTeacher.includes(name) || name.includes(itemTeacher))) {
            return true;
          }
        }
      }

      // 3. Match subject to classes taught by this teacher in classesList
      if (classesList.length > 0) {
        const itemSubject = (item.subject || item.curriculumSubject || '').toLowerCase().trim();
        const myTaughtClasses = classesList.filter(c => {
          const cTeacher = (c.teacher || '').toLowerCase();
          const candidateNames = [currentUser?.displayName, currentUser?.name, currentStaff?.name].filter(Boolean).map(n => n.toLowerCase());
          return (c.teacherId && c.teacherId === currentUser?.uid) || candidateNames.some(n => n && (cTeacher.includes(n) || n.includes(cTeacher)));
        });
        if (myTaughtClasses.some(c => {
          const cName = (c.name || '').toLowerCase();
          const cCode = (c.code || '').toLowerCase();
          return (cName && itemSubject.includes(cName)) || (cCode && itemSubject.includes(cCode));
        })) {
          return true;
        }
      }

      // Older records can still identify ownership without a linked course.
      return Boolean(item.taughtByMe);
    }

    const course = classesList.find(candidate =>
      [item.courseId, item.classId, item.subject, item.curriculumSubject]
        .some(reference => courseMatchesReference(candidate, reference))
    );
    if (course) return isStudentEnrolledInCourse(currentStudent, course);
    // A period set for the student's class belongs to their timetable.
    if (item.classGroupId && currentStudent?.classGroupId && String(item.classGroupId) === String(currentStudent.classGroupId)) return true;

    // Older schedule entries can carry direct student IDs without a course link.
    const studentIds = [currentUser?.uid, currentStudent?.id, currentStudent?.studentId].filter(Boolean);
    return Array.isArray(item.enrolledStudentIds) && item.enrolledStudentIds.some(id => studentIds.includes(id));
  }, [userRole, currentUser, currentStaff, currentStudent, classesList]);

  const unscheduledCourses = useMemo(() => classesLoaded ? classesList.filter(course => weeklyScheduleForCourse(course).length === 0)
    .filter(course => effectiveTab === 'all-schedule' || isItemInMySchedule({ courseId: course.id, subject: course.name, teacher: course.teacher, teacherId: course.teacherId, createdByUid: course.createdByUid })) : [],
  [classesLoaded, classesList, effectiveTab, isItemInMySchedule]);

  // Day counts for My Schedule vs All Schedule
  const myScheduleCount = useMemo(() => {
    const dayItems = scheduleState[selectedDay] || [];
    return dayItems.filter(isItemInMySchedule).length;
  }, [scheduleState, selectedDay, isItemInMySchedule]);

  const allScheduleCount = useMemo(() => {
    const dayItems = scheduleState[selectedDay] || [];
    return dayItems.length;
  }, [scheduleState, selectedDay]);

  // Extract unique teachers and categories for filters
  const teachersList = useMemo(() => {
    const list = new Set();
    Object.values(scheduleState).forEach(dayItems => {
      dayItems.forEach(item => {
        if (item.teacher) list.add(item.teacher);
      });
    });
    // Also include from staff context if available
    staffList.forEach(s => { if (s.name) list.add(s.name); });
    return ['all', ...Array.from(list)];
  }, [scheduleState, staffList]);

  const categoriesList = useMemo(() => {
    const list = new Set();
    Object.values(scheduleState).forEach(dayItems => {
      dayItems.forEach(item => {
        if (item.subjectCategory) list.add(item.subjectCategory);
      });
    });
    return ['all', ...Array.from(list)];
  }, [scheduleState]);

  // Older periods may carry a class label that matches no class yet.
  const legacyClassLabels = useMemo(() => {
    const labels = new Set();
    Object.values(scheduleState).forEach(dayItems => dayItems.forEach(item => {
      if (!item.isEvent && !item.classGroupId && item.classLabel) labels.add(item.classLabel);
    }));
    return [...labels].sort((a, b) => a.localeCompare(b, 'sq', { numeric: true }));
  }, [scheduleState]);

  const matchesClassAndCourse = useCallback((item) => {
    if (classFilter === 'all' && courseFilter === 'all') return true;
    // A class or course timetable lists lessons only.
    if (item.isEvent) return false;
    if (courseFilter !== 'all' && String(item.courseId || '') !== courseFilter) return false;
    if (classFilter === 'all') return true;
    if (classFilter.startsWith(LEGACY_LABEL_PREFIX)) return !item.classGroupId && item.classLabel === classFilter.slice(LEGACY_LABEL_PREFIX.length);
    return String(item.classGroupId || '') === classFilter;
  }, [classFilter, courseFilter]);
  const selectedFilterClass = classFilter !== 'all' && !classFilter.startsWith(LEGACY_LABEL_PREFIX) ? groupsById.get(classFilter) : null;

  // Filter current schedule for the selected day and active tab
  const currentSchedule = useMemo(() => {
    const dayItems = scheduleState[selectedDay] || [];
    return dayItems.filter(item => {
      // Tab filter
      if (effectiveTab === 'my-schedule' && !isItemInMySchedule(item)) {
        return false;
      }
      if (!matchesClassAndCourse(item)) return false;

      const query = searchTerm.toLowerCase();
      const matchesSearch = 
        (item.subject || '').toLowerCase().includes(query) ||
        (item.room && item.room.toLowerCase().includes(query)) ||
        (item.teacher && item.teacher.toLowerCase().includes(query)) ||
        (item.classLabel && item.classLabel.toLowerCase().includes(query));

      const matchesTeacher = teacherFilter === 'all' || item.teacher === teacherFilter;
      const matchesCategory = categoryFilter === 'all' || item.subjectCategory === categoryFilter;
      
      let matchesType = true;
      if (typeFilter === 'classes') matchesType = !item.isEvent;
      if (typeFilter === 'events') matchesType = !!item.isEvent;

      return matchesSearch && matchesTeacher && matchesCategory && matchesType;
    }).sort((a, b) => scheduleStartMinutes(a.time) - scheduleStartMinutes(b.time) || String(a.subject || '').localeCompare(String(b.subject || '')));
  }, [scheduleState, selectedDay, effectiveTab, isItemInMySchedule, matchesClassAndCourse, searchTerm, teacherFilter, categoryFilter, typeFilter]);

  const handleClassClick = (item) => {
    if (item.isEvent) return;
    setSelectedClass({ ...item, scheduledDate: dateForDay(weekMonday, selectedDay) });
    setIsDetailOpen(true);
  };

  const lessonSubjectFor = item => item?.curriculumSubject || catalogSubjectFor(item?.subject) || String(item?.subject || '').trim();
  const handleCreateLessonPlan = () => {
    const subject = lessonSubjectFor(selectedClass);
    if (!selectedClass?.classLabel || !subject || !onCreateLessonPlan) return;
    onCreateLessonPlan({
      date: selectedClass.scheduledDate,
      classLabel: selectedClass.classLabel,
      subject,
      period: selectedClass.period,
    });
    setIsDetailOpen(false);
  };

  const handleAddSlotSubmit = async (e) => {
    e.preventDefault();
    if (!activeSchoolId) { setSlotError(isAlbanian ? 'Zgjidhni një shkollë së pari.' : 'Select a school first.'); return; }
    const slotGroup = newSlotForm.classGroupId ? groupsById.get(newSlotForm.classGroupId) : null;
    const slotClassLabel = slotGroup?.label || newSlotForm.classLabel.trim();
    if (!newSlotForm.subject.trim() || !newSlotForm.time.trim() || (!newSlotForm.isEvent && (!slotClassLabel || !newSlotForm.curriculumSubject || !newSlotForm.period))) {
      setSlotError(isAlbanian ? 'Plotësoni fushat e kërkuara të orës.' : 'Complete the required schedule fields.');
      return;
    }

    const slotId = `slot_${Date.now()}`;
    const linkedCourse = classesList.find(course => String(course.id) === String(newSlotForm.courseId));
    const selectedTeacher = staffList.find(staff => staff.name === newSlotForm.teacher);
    const newItem = {
      ...newSlotForm,
      classGroupId: newSlotForm.isEvent ? '' : slotGroup?.id || '',
      classLabel: newSlotForm.isEvent ? '' : slotClassLabel,
      id: slotId,
      teacher: newSlotForm.teacher.trim() || linkedCourse?.teacher || defaultTeacherName,
      teacherId: linkedCourse?.teacherId || selectedTeacher?.id || (newSlotForm.teacher === currentUser?.displayName ? currentUser?.uid : ''),
      createdByUid: currentUser?.uid || '',
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'schools', activeSchoolId, 'scheduleEntries', slotId), newItem);
    } catch (err) {
      console.warn('Error saving schedule entry to Firestore:', err.message);
      setSlotError(err.message || (isAlbanian ? 'Ora nuk u ruajt.' : 'Schedule entry could not be saved.'));
      return;
    }

    setIsAddSlotOpen(false);
    setSlotError('');
    setNewSlotForm({ ...EMPTY_SLOT_FORM, day: selectedDay });
  };

  // Export Timetable
  const handleExportTimetable = () => {
    const isMy = effectiveTab === 'my-schedule';
    const rows = [["Day", "Time", "Subject", "Class", "Teacher", "Room", "Type", "Source"]];
    days.forEach(day => {
      const dayItems = scheduleState[day] || [];
      const filtered = dayItems.filter(item => (!isMy || isItemInMySchedule(item)) && matchesClassAndCourse(item));
      filtered.forEach(item => {
        rows.push([
          day,
          item.time,
          item.subject,
          item.isEvent ? '' : item.classLabel || '',
          item.teacher || '',
          item.room || '',
          item.isEvent ? 'Campus Event' : (item.subjectCategory || 'Lesson'),
          item.source === 'course' ? 'Course timetable' : 'Schedule entry'
        ]);
      });
    });

    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const prefix = selectedFilterClass ? `Class_${selectedFilterClass.label}` : isMy ? 'My_Schedule' : 'School_Schedule';
    link.setAttribute("download", `${prefix.replace(/[^a-zA-Z0-9_]/g, '_')}_${weekDateString.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters = searchTerm !== '' || teacherFilter !== 'all' || categoryFilter !== 'all' || typeFilter !== 'all' || classFilter !== 'all' || courseFilter !== 'all';
  const resetFilters = () => {
    setSearchTerm('');
    setTeacherFilter('all');
    setCategoryFilter('all');
    setTypeFilter('all');
    setClassFilter('all');
    setCourseFilter('all');
  };

  return (
    <motion.div 
      className="schedule-page"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.header className="page-header" variants={itemVariants}>
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text">
              {t('schedule.title')}
              <Calendar size={30} className="page-title-icon" aria-hidden="true" />
            </h1>
            <span className="count-pill glass">
              {`${currentSchedule.length} ${t('common.total')}`}
            </span>
          </div>
          <p>{selectedFilterClass
            ? (isAlbanian ? `Orari i klasës ${selectedFilterClass.label}` : `Timetable for class ${selectedFilterClass.label}`)
            : t('schedule.subtitle')}</p>
        </div>

        <div className="header-actions">
          {/* Segmented Schedule View Switcher - ONLY for Students and Teachers */}
          {userRole !== 'admin' && (
            <div className="schedule-segmented-toggle glass">
              <button
                type="button"
                className={`segmented-tab ${effectiveTab === 'my-schedule' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-schedule')}
                title={userRole === 'student' ? (isAlbanian ? 'Shfaq Lëndët & Ngjarjet e Mia' : 'Show My Enrolled Classes & Events') : (isAlbanian ? 'Shfaq Orarin Tim Mësimor' : 'Show My Teaching Timetable')}
              >
                <Calendar size={14} />
                <span>{userRole === 'student' ? (isAlbanian ? 'Orari Im' : 'My Schedule') : (isAlbanian ? 'Orari Im Mësimor' : 'My Timetable')}</span>
                <span className="segmented-counter">{myScheduleCount}</span>
              </button>
              <button
                type="button"
                className={`segmented-tab ${effectiveTab === 'all-schedule' ? 'active' : ''}`}
                onClick={() => setActiveTab('all-schedule')}
                title={isAlbanian ? 'Shfaq Orarin Kryesor të Shkollës' : 'Show Master Campus Schedule'}
              >
                <Layers size={14} />
                <span>{isAlbanian ? 'I Gjithë Kampusi' : 'All Campus'}</span>
                <span className="segmented-counter">{allScheduleCount}</span>
              </button>
            </div>
          )}

          {/* Interactive Week Navigator */}
          <div className="week-selector-card glass">
            <button 
              className="week-nav-btn glass" 
              onClick={() => setWeekOffset(prev => prev - 1)}
              title={isAlbanian ? 'Java e Kaluar' : 'Previous Week'}
              aria-label="Previous Week"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="week-date-info">
              <span className="week-label">{weekDateString}</span>
              {weekOffset === 0 ? (
                <span className="current-week-tag">{isAlbanian ? 'Java Aktuale' : 'Current Week'}</span>
              ) : (
                <button 
                  className="reset-week-btn" 
                  onClick={() => setWeekOffset(0)}
                  title={isAlbanian ? 'Kthehu te java aktuale' : 'Jump to current week'}
                >
                  <RotateCcw size={11} /> {isAlbanian ? 'Rivendos' : 'Reset'}
                </button>
              )}
            </div>

            <button 
              className="week-nav-btn glass" 
              onClick={() => setWeekOffset(prev => prev + 1)}
              title={isAlbanian ? 'Java e Ardhshme' : 'Next Week'}
              aria-label="Next Week"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button className="btn-secondary glass" onClick={handleExportTimetable} title={isAlbanian ? 'Eksporto Orarin CSV' : 'Export CSV Timetable'}>
            <Download size={16} />
            <span className="export-btn-text">{isAlbanian ? 'Eksporto Orarin' : (userRole === 'admin' || effectiveTab === 'all-schedule' ? 'Export Master' : 'Export Timetable')}</span>
          </button>
          
          {['admin', 'teacher', 'dept_head'].includes(userRole) && (
            <button className="btn-primary" onClick={() => {
              setSlotError('');
              // Start from the day and class being viewed.
              setNewSlotForm(previous => ({ ...previous, day: selectedDay, ...(selectedFilterClass && !previous.isEvent ? { classGroupId: selectedFilterClass.id, classLabel: selectedFilterClass.label } : {}) }));
              setIsAddSlotOpen(true);
            }}>
              <Plus size={16} />
              <span>{t('schedule.addEntry')}</span>
            </button>
          )}
        </div>
      </motion.header>

      {scheduleError && <div role="alert" className="schedule-source-notice glass">
        {isAlbanian ? 'Orët e ruajtura veçmas nuk mund të ngarkohen. Orari i lëndëve vazhdon të shfaqet.' : 'Separate schedule entries could not be loaded. Course timetable entries are still shown.'}
      </div>}
      {classesError && <div role="alert" className="schedule-source-notice glass">
        {isAlbanian ? 'Lëndët nuk mund të ngarkohen për këtë shkollë. Kontrolloni lejet e qasjes.' : 'Courses could not be loaded for this school. Check course access permissions.'}
      </div>}

      {unscheduledCourses.length > 0 && <section className="schedule-unscheduled glass">
        <div>
          <h3>{isAlbanian ? 'Lëndë pa orar të lexueshëm' : 'Courses needing a timetable'}</h3>
          <p>{isAlbanian ? 'Shtoni ditën dhe orën te lënda që të shfaqet në ditët përkatëse.' : 'Add weekdays and a time in each course to place it on the schedule.'}</p>
          <ul>{unscheduledCourses.map(course => <li key={course.id}><strong>{course.name}</strong>{course.schedule ? ` · ${course.schedule}` : ''}</li>)}</ul>
        </div>
        {onOpenCourses && <button type="button" className="btn-secondary glass" onClick={onOpenCourses}>{isAlbanian ? 'Hap Lëndët' : 'Open Courses'}</button>}
      </section>}

      {/* Filter Controls Bar */}
      <motion.div className="schedule-filters-container glass" variants={itemVariants}>
        {/* Search Bar */}
        <div className="search-bar-wrap">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={effectiveTab === 'my-schedule' ? (isAlbanian ? 'Kërko në orarin tim, sallat, apo mësimdhënësit...' : 'Search within my scheduled classes, rooms, or teachers...') : (isAlbanian ? 'Kërko të gjitha lëndët, mësimdhënësit, sallat, apo ngjarjet...' : 'Search all classes, teachers, subjects, rooms, or events...')} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter Dropdowns & Pills Row */}
        <div className="filters-flex-row">
          <div className="filter-group-item">
            <label><User size={13} /> {isAlbanian ? 'MËSIMDHËNËSI:' : 'Teacher:'}</label>
            <select 
              value={teacherFilter} 
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="schedule-filter-select glass"
            >
              {teachersList.map(t => (
                <option key={t} value={t}>
                  {t === 'all' ? (isAlbanian ? 'Të Gjithë Mësimdhënësit' : 'All Teachers & Faculty') : t}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group-item">
            <label><Tag size={13} /> {isAlbanian ? 'LËNDA / KATEGORIA:' : 'Subject / Category:'}</label>
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="schedule-filter-select glass"
            >
              {categoriesList.map(c => {
                const categoryTranslations = {
                  'Math': 'Matematikë',
                  'Science': 'Shkencë',
                  'Humanities': 'Shkenca Shoqërore',
                  'Technology': 'Teknologji',
                  'Arts': 'Arte',
                  'Athletics': 'Edukim Fizik',
                  'Event': 'Ngjarje'
                };
                const displayCategory = isAlbanian && categoryTranslations[c] ? categoryTranslations[c] : c;
                return (
                  <option key={c} value={c}>
                    {c === 'all' ? (isAlbanian ? 'Të Gjitha Lëndët & Fushat' : 'All Subjects & Domains') : displayCategory}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="filter-group-item">
            <label htmlFor="schedule-class-filter"><GraduationCap size={13} /> {isAlbanian ? 'KLASA:' : 'Class:'}</label>
            <select id="schedule-class-filter" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="schedule-filter-select glass">
              <option value="all">{isAlbanian ? 'Të gjitha klasat' : 'All classes'}</option>
              {classGroups.map(group => <option key={group.id} value={group.id}>{isAlbanian ? 'Klasa' : 'Class'} {group.label}</option>)}
              {legacyClassLabels.length > 0 && (
                <optgroup label={isAlbanian ? 'Etiketa pa klasë të krijuar' : 'Labels without a class'}>
                  {legacyClassLabels.map(label => <option key={label} value={`${LEGACY_LABEL_PREFIX}${label}`}>{label}</option>)}
                </optgroup>
              )}
            </select>
          </div>

          <div className="filter-group-item">
            <label htmlFor="schedule-course-filter"><BookOpen size={13} /> {isAlbanian ? 'KURSI:' : 'Course:'}</label>
            <select id="schedule-course-filter" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="schedule-filter-select glass">
              <option value="all">{isAlbanian ? 'Të gjitha kurset' : 'All courses'}</option>
              {classesList.map(course => (
                <option key={course.id} value={String(course.id)}>
                  {course.name}{course.classGroupId && groupsById.get(String(course.classGroupId)) ? ` · ${groupsById.get(String(course.classGroupId)).label}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="type-toggle-pills glass">
            <button 
              className={`type-pill ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              {isAlbanian ? 'Të Gjitha' : 'All'}
            </button>
            <button 
              className={`type-pill ${typeFilter === 'classes' ? 'active' : ''}`}
              onClick={() => setTypeFilter('classes')}
            >
              {isAlbanian ? 'Orët' : 'Lessons'}
            </button>
            <button 
              className={`type-pill ${typeFilter === 'events' ? 'active' : ''}`}
              onClick={() => setTypeFilter('events')}
            >
              {isAlbanian ? 'Ngjarjet' : 'Events'}
            </button>
          </div>

          {hasActiveFilters && (
            <button 
              className="reset-filters-btn glass"
              onClick={resetFilters}
            >
              <RotateCcw size={13} /> {isAlbanian ? 'Pastro Filtrat' : 'Clear Filters'}
            </button>
          )}
        </div>
      </motion.div>

      {/* Day Selector with Clean Shadows */}
      <motion.div className="day-selector-container" variants={itemVariants}>
        {days.map(day => {
          const count = (scheduleState[day] || []).filter(item => effectiveTab === 'my-schedule' ? isItemInMySchedule(item) : true).length;
          return (
            <button 
              key={day}
              className={`day-btn ${selectedDay === day ? 'active glass' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              <span className="day-name">{t(`schedule.${day.toLowerCase()}`, day)}</span>
              <span className="day-count-badge">{count}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Timeline and Schedule List */}
      <motion.div className="schedule-timeline" variants={itemVariants}>
        <div className="timeline-labels">
          <span>08:00 AM</span>
          <span>10:00 AM</span>
          <span>12:00 PM</span>
          <span>02:00 PM</span>
          <span>04:00 PM</span>
        </div>

        <div className="schedule-list">
          {scheduleLoading ? <div className="empty-schedule-card glass"><p>{isAlbanian ? 'Po ngarkohet orari...' : 'Loading schedule...'}</p></div> : currentSchedule.length === 0 ? (
            <div className="empty-schedule-card glass">
              <div className="empty-icon-wrap glass">
                <Calendar size={32} />
              </div>
              <h3>
                {effectiveTab === 'my-schedule'
                  ? (isAlbanian ? `Nuk ka lëndë të planifikuara në orarin tuaj për ${t('schedule.' + selectedDay.toLowerCase(), selectedDay)}` : `No classes scheduled in your personal timetable for ${selectedDay}`)
                  : (isAlbanian ? `Nuk u gjetën orë të planifikuara për ${t('schedule.' + selectedDay.toLowerCase(), selectedDay)}` : `No scheduled periods found for ${selectedDay}`)}
              </h3>
              <p>
                {effectiveTab === 'my-schedule'
                  ? (isAlbanian ? 'Kontrolloni një ditë tjetër ose kaloni te orari i gjithë shkollës.' : 'Check another weekday or switch to the campus timetable.')
                  : (isAlbanian ? 'Provoni ditë të tjera, rregulloni filtrat, ose caktoni orarin e lëndës.' : 'Try another weekday, adjust filters, or set the course timetable.')}
              </p>
              {effectiveTab === 'my-schedule' && userRole !== 'admin' ? (
                <button 
                  className="btn-secondary glass btn-small"
                  onClick={() => setActiveTab('all-schedule')}
                >
                  {isAlbanian ? 'Eksploro Orarin e Shkollës' : 'Browse All Campus Schedule'}
                </button>
              ) : hasActiveFilters ? (
                <button 
                  className="btn-secondary glass btn-small"
                  onClick={resetFilters}
                >
                  {isAlbanian ? 'Rivendos Filtrat' : 'Reset Active Filters'}
                </button>
              ) : null}
            </div>
          ) : (
            <AnimatePresence>
              {currentSchedule.map((item, index) => (
                <ScheduleItem 
                  key={item.id} 
                  item={item} 
                  delay={index * 0.05} 
                  onClick={handleClassClick}
                  activeTab={effectiveTab}
                  userRole={userRole}
                  onDeleteSlot={handleDeleteSlot}
                  isAlbanian={isAlbanian}
                  isMine={isItemInMySchedule(item)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      {/* ── MODAL: Add Period / Event ── */}
      <AnimatePresence>
        {isAddSlotOpen && (
          <div className="modal-overlay" onClick={() => setIsAddSlotOpen(false)}>
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Shto Orë ose Ngjarje' : 'Add Period or Event'}</h3>
                <p className="modal-subtitle">{isAlbanian ? 'Planifikoni një orë mësimore, sesion laboratori, ose ngjarje të shkollës.' : 'Schedule a class period, laboratory session, or campus event.'}</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddSlotOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddSlotSubmit} className="modal-form">
                {slotError && <div role="alert" className="schedule-form-error">{slotError}</div>}
                <label className="schedule-event-toggle">
                  <input type="checkbox" checked={newSlotForm.isEvent} onChange={e => setNewSlotForm(previous => ({ ...previous, isEvent: e.target.checked, courseId: e.target.checked ? '' : previous.courseId, classGroupId: e.target.checked ? '' : previous.classGroupId, classLabel: e.target.checked ? '' : previous.classLabel, period: e.target.checked ? '' : previous.period, curriculumSubject: e.target.checked ? '' : previous.curriculumSubject, subjectCategory: e.target.checked ? 'Event' : 'Academic' }))} />
                  {isAlbanian ? 'Ngjarje e shkollës' : 'School event'}
                </label>
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Dita e Javës' : 'Day of Week'}</label>
                    <select 
                      value={newSlotForm.day}
                      onChange={e => setNewSlotForm({ ...newSlotForm, day: e.target.value })}
                      className="custom-form-select"
                    >
                      {days.map(d => (
                        <option key={d} value={d}>{t(`schedule.${d.toLowerCase()}`, d)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Orari' : 'Time Slot'}</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. 09:00 - 10:30"
                      value={newSlotForm.time}
                      onChange={e => setNewSlotForm({ ...newSlotForm, time: e.target.value })}
                    />
                  </div>
                </div>

                {!newSlotForm.isEvent && <div className="input-group">
                  <label htmlFor="schedule-course-link">{isAlbanian ? 'Lidhe me lëndën ekzistuese' : 'Link to an existing course'}</label>
                  <select id="schedule-course-link" className="custom-form-select" value={newSlotForm.courseId} onChange={event => {
                    const course = classesList.find(item => String(item.id) === event.target.value);
                    const courseGroup = course?.classGroupId ? groupsById.get(String(course.classGroupId)) : null;
                    setNewSlotForm(previous => ({ ...previous, courseId: event.target.value, subject: course?.name || previous.subject, teacher: course?.teacher || previous.teacher, room: course?.room || previous.room, subjectCategory: course?.department || previous.subjectCategory, color: course?.color || previous.color, classGroupId: courseGroup?.id || previous.classGroupId, classLabel: courseGroup?.label || previous.classLabel, curriculumSubject: previous.curriculumSubject || catalogSubjectFor(course?.name) }));
                  }}>
                    <option value="">{isAlbanian ? 'Ora e pavarur' : 'Independent period'}</option>
                    {classesList.map(course => <option key={course.id} value={course.id}>{course.name}{course.code ? ` (${course.code})` : ''}</option>)}
                  </select>
                </div>}

                <div className="input-group">
                  <label>{isAlbanian ? 'Titulli i Lëndës / Ngjarjes' : 'Subject / Event Title'}</label>
                  <input 
                    type="text" 
                    required 
                    placeholder={isAlbanian ? 'p.sh. Kalkulus i Avancuar, Punëtori Robotike' : 'e.g. Advanced Calculus, Robotics Workshop'}
                    value={newSlotForm.subject}
                    onChange={e => setNewSlotForm({ ...newSlotForm, subject: e.target.value })}
                  />
                </div>

                {!newSlotForm.isEvent && <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="schedule-class-label">{isAlbanian ? 'Klasa' : 'Class'}</label>
                    {classGroups.length > 0 ? (
                      <select
                        id="schedule-class-label"
                        className="custom-form-select"
                        required
                        value={newSlotForm.classGroupId}
                        onChange={e => setNewSlotForm({ ...newSlotForm, classGroupId: e.target.value, classLabel: groupsById.get(e.target.value)?.label || '' })}
                      >
                        <option value="">{isAlbanian ? 'Zgjidhni klasën' : 'Choose a class'}</option>
                        {classGroups.map(group => <option key={group.id} value={group.id}>{isAlbanian ? 'Klasa' : 'Class'} {group.label}</option>)}
                      </select>
                    ) : (
                      <input
                        id="schedule-class-label"
                        type="text"
                        required
                        placeholder="e.g. VII/1"
                        value={newSlotForm.classLabel}
                        onChange={e => setNewSlotForm({ ...newSlotForm, classLabel: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="input-group">
                    <label htmlFor="schedule-period">{isAlbanian ? 'Ora Mësimore' : 'Period'}</label>
                    <input
                      id="schedule-period"
                      type="number"
                      min="1"
                      max="12"
                      required
                      placeholder="e.g. 2"
                      value={newSlotForm.period}
                      onChange={e => setNewSlotForm({ ...newSlotForm, period: e.target.value })}
                    />
                  </div>
                </div>}

                {!newSlotForm.isEvent && <div className="input-group">
                  <label htmlFor="schedule-curriculum-subject">{isAlbanian ? 'Lënda kurrikulare për planin mësimor' : 'Curriculum subject for lesson planning'}</label>
                  <select
                    id="schedule-curriculum-subject"
                    className="custom-form-select"
                    required
                    value={newSlotForm.curriculumSubject}
                    onChange={e => setNewSlotForm({ ...newSlotForm, curriculumSubject: e.target.value })}
                  >
                    <option value="">{isAlbanian ? 'Zgjidh lëndën' : 'Select subject'}</option>
                    {SUBJECTS.map(subject => (
                      <option key={subject.name} value={subject.name}>{translateCatalogValue(lessonLanguage, subject.name)}</option>
                    ))}
                  </select>
                </div>}

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Mësimdhënësi / Organizatori' : 'Instructor / Host'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. Dr. Sarah Smith' : 'e.g. Dr. Sarah Smith'}
                      value={newSlotForm.teacher}
                      onChange={e => setNewSlotForm({ ...newSlotForm, teacher: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Salla / Lokacioni' : 'Room / Location'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. Salla 302, Palestra' : 'e.g. Room 302, Main Gym'}
                      value={newSlotForm.room}
                      onChange={e => setNewSlotForm({ ...newSlotForm, room: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Kategoria' : 'Category'}</label>
                    <select 
                      value={newSlotForm.subjectCategory}
                      onChange={e => setNewSlotForm({ ...newSlotForm, subjectCategory: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="Academic">{isAlbanian ? 'Akademike' : 'Academic'}</option>
                      <option value="Math">{isAlbanian ? 'Matematikë' : 'Mathematics'}</option>
                      <option value="Science">{isAlbanian ? 'Shkencë & Laboratore' : 'Science & Labs'}</option>
                      <option value="Humanities">{isAlbanian ? 'Shkenca Shoqërore & Gjuhë' : 'Humanities & Languages'}</option>
                      <option value="Technology">{isAlbanian ? 'Teknologji & TIK' : 'Technology & CS'}</option>
                      <option value="Arts">{isAlbanian ? 'Art & Muzikë' : 'Arts & Music'}</option>
                      <option value="Athletics">{isAlbanian ? 'Edukim Fizik & Sport' : 'Athletics & PE'}</option>
                      <option value="Event">{isAlbanian ? 'Ngjarje Shkollore' : 'Campus Event'}</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Ngjyra e Theksit' : 'Color Accent'}</label>
                    <select 
                      value={newSlotForm.color}
                      onChange={e => setNewSlotForm({ ...newSlotForm, color: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="--primary">{isAlbanian ? 'Tema Kryesore (Vjollcë)' : 'Primary Theme (Purple)'}</option>
                      <option value="--accent">{isAlbanian ? 'Vjollcë e Çelët' : 'Accent Violet'}</option>
                      <option value="--chart-1">{isAlbanian ? 'Rozë' : 'Chart Rose'}</option>
                      <option value="--chart-2">{isAlbanian ? 'Indigo' : 'Chart Indigo'}</option>
                      <option value="--chart-3">{isAlbanian ? 'Cian' : 'Chart Cyan'}</option>
                      <option value="--mood-happy">{isAlbanian ? 'E Gjelbër Smerald' : 'Emerald Green'}</option>
                    </select>
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddSlotOpen(false)}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary">
                    {isAlbanian ? 'Ruaj në Orar' : 'Save to Schedule'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ClassDetail 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
        classInfo={selectedClass} 
        userRole={userRole}
        onCreateLessonPlan={selectedClass && selectedClass.classLabel && lessonSubjectFor(selectedClass) && (userRole === 'admin' || (['teacher', 'dept_head'].includes(userRole) && isItemInMySchedule(selectedClass))) ? handleCreateLessonPlan : undefined}
        lessonLanguage={lessonLanguage}
      />
    </motion.div>
  );
};

export default Schedule;

