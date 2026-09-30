import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, GraduationCap, Calendar, TrendingUp, Star, 
  Coffee, Plus, Trash2, Clock, MapPin, GripVertical, 
  Target, Smile, Meh, Frown, X, Send, BookOpen, 
  CheckCircle2, AlertCircle, LayoutDashboard,
  Presentation, Rocket, Megaphone, BellRing, Sparkles,
  Check, ArrowRight, Book, Flame, ShieldAlert, Award
} from 'lucide-react';
import { useTasks } from '../context/TasksContext';
import { useMood } from '../context/MoodContext';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from '../components/Avatar';
import { db } from '../services/firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { isStudentEnrolledInCourse } from '../features/enrollment';
import { courseResult } from '../features/gradebook/schoolResults';
import { useCourseRecords } from '../features/gradebook/useCourseRecords';
import { useStudentCounts } from '../features/students/studentData';
import './Dashboard.css';

const StatCard = ({ icon: IconComponent, label, value, color, delay, subtext }) => (
  <motion.div 
    className="stat-card glass bouncy"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <div className="stat-icon-wrapper" style={{ backgroundColor: `hsla(var(${color}), 0.2)`, color: `hsl(var(${color}))` }}>
      {React.createElement(IconComponent, { size: 24 })}
    </div>
    <div className="stat-info">
      <h3>{value}</h3>
      <p>{label}</p>
    </div>
    <div className="stat-trend">
      {subtext && <span>{subtext}</span>}
    </div>
  </motion.div>
);

const QUOTES = [
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" }
];

const QUOTES_SQ = [
  { text: "E bukura e të mësuarit është se askush nuk mund të ta marrë atë.", author: "B.B. King" },
  { text: "Suksesi është shuma e përpjekjeve të vogla, të përsëritura ditë pas dite.", author: "Robert Collier" },
  { text: "Arsimi është arma më e fuqishme që mund të përdorni për të ndryshuar botën.", author: "Nelson Mandela" },
  { text: "Beso se mundesh dhe je tashmë në gjysmë të rrugës.", author: "Theodore Roosevelt" }
];

const Dashboard = ({ onNavigate, userRole = 'student' }) => {
  const [note, setNote] = useState('');
  const { moodHistory, addMoodEntry, getTodayMood } = useMood();
  const { staffList = [], classesList = [], classGroups = [], eventsList = [], myStudentRecord, studentsVersion } = useSchoolData();
  const { currentUser, activeSchool, activeSchoolId } = useAuth();
  const { language, isAlbanian, t } = useLanguage();
  const todayEntry = getTodayMood();
  
  const [vibe, setVibe] = useState(todayEntry?.mood || '');
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);
  const [moodNote, setMoodNote] = useState(todayEntry?.note || '');
  const [pendingMood, setPendingMood] = useState(null);

  useEffect(() => {
    if (todayEntry?.mood) {
      setVibe(todayEntry.mood);
    }
    if (todayEntry?.note !== undefined) {
      setMoodNote(todayEntry.note);
    }
  }, [todayEntry?.mood, todayEntry?.note]);

  const isStudent = userRole === 'student';
  const isAdmin = userRole === 'admin';

  // Student specific tasks & interactive state
  const [studentTasks, setStudentTasks] = useState([]);
  const [newStudentTaskText, setNewStudentTaskText] = useState('');
  const [savedNotes, setSavedNotes] = useState([]);
  const { tasks, moveTask } = useTasks();

  useEffect(() => {
    if (!currentUser?.uid) return;

    const tasksCol = collection(db, 'users', currentUser.uid, 'studentTasks');
    const unsubTasks = onSnapshot(tasksCol, (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      items.sort((a, b) => (b.createdAt?.toMillis?.() || b.rawTimestamp || 0) - (a.createdAt?.toMillis?.() || a.rawTimestamp || 0));
      setStudentTasks(items);
    }, (err) => {
      console.warn('Notice listening to studentTasks:', err.message);
    });

    const notesCol = collection(db, 'users', currentUser.uid, 'dashboardNotes');
    const unsubNotes = onSnapshot(notesCol, (snapshot) => {
      const notes = [];
      snapshot.forEach(docSnap => {
        notes.push({ id: docSnap.id, ...docSnap.data() });
      });
      notes.sort((a, b) => (b.createdAt?.toMillis?.() || b.rawTimestamp || 0) - (a.createdAt?.toMillis?.() || a.rawTimestamp || 0));
      setSavedNotes(notes);
    }, (err) => {
      console.warn('Notice listening to dashboardNotes:', err.message);
    });

    return () => {
      unsubTasks();
      unsubNotes();
    };
  }, [currentUser?.uid]);

  const toggleStudentTask = async (id) => {
    const task = studentTasks.find(t => t.id === id);
    if (!task) return;
    const nextCompleted = !task.completed;
    if (currentUser?.uid) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'studentTasks', String(id)), {
          completed: nextCompleted
        });
      } catch (err) {
        console.warn('Error updating student task:', err.message);
      }
    } else {
      setStudentTasks(prev => prev.map(t => t.id === id ? { ...t, completed: nextCompleted } : t));
    }
  };

  const handleAddStudentTask = async (e) => {
    if (e) e.preventDefault();
    if (!newStudentTaskText.trim()) return;

    const taskId = `stask_${Date.now()}`;
    const newTask = {
      id: taskId,
      text: newStudentTaskText.trim(),
      category: 'homework',
      priority: 'medium',
      due: 'Upcoming',
      completed: false,
      rawTimestamp: Date.now(),
      createdAt: serverTimestamp()
    };

    setNewStudentTaskText('');

    if (currentUser?.uid) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'studentTasks', taskId), newTask);
      } catch (err) {
        console.warn('Error creating student task in Firestore:', err.message);
      }
    } else {
      setStudentTasks(prev => [newTask, ...prev]);
    }
  };

  const deleteStudentTask = async (id) => {
    if (currentUser?.uid) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'studentTasks', String(id)));
      } catch (err) {
        console.warn('Error deleting student task:', err.message);
      }
    } else {
      setStudentTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  const currentQuote = isAlbanian ? QUOTES_SQ[0] : QUOTES[0];

  const [announcements, setAnnouncements] = useState([]);

  const getMoodPrompt = () => {
    const activeMood = pendingMood || vibe;
    switch(activeMood) {
      case 'happy': return t('dashboard.happyPrompt');
      case 'neutral': return t('dashboard.neutralPrompt');
      case 'sad': return t('dashboard.sadPrompt');
      default: return t('dashboard.howsYourDay');
    }
  };

  const handleMoodSelect = (selectedMood) => {
    setVibe(selectedMood);
    setPendingMood(selectedMood);
    // Immediately persist selected mood to Firestore Cloud & local state!
    const existingNote = todayEntry?.note || '';
    addMoodEntry(selectedMood, existingNote);
    if (existingNote) {
      setMoodNote(existingNote);
    }
    setIsMoodModalOpen(true);
  };

  const submitMoodNote = () => {
    const activeVibe = pendingMood || vibe;
    if (activeVibe) addMoodEntry(activeVibe, moodNote);
    setIsMoodModalOpen(false);
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('taskId', id.toString());
  };

  const handleDrop = (e, status) => {
    const id = e.dataTransfer.getData('taskId');
    if (id) moveTask(parseInt(id), status);
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    const noteText = note.trim();
    setNote('');

    const newId = `note_${Date.now()}`;
    const newNote = {
      id: newId,
      text: noteText,
      time: 'Just now',
      rawTimestamp: Date.now(),
      createdAt: serverTimestamp()
    };

    if (currentUser?.uid) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'dashboardNotes', newId), newNote);
      } catch (err) {
        console.warn('Error saving note to Firestore:', err.message);
      }
    } else {
      setSavedNotes(prev => [newNote, ...prev]);
    }
  };

  const deleteNote = async (id) => {
    if (currentUser?.uid) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'dashboardNotes', String(id)));
      } catch (err) {
        console.warn('Error deleting note from Firestore:', err.message);
      }
    } else {
      setSavedNotes(prev => prev.filter(n => n.id !== id));
    }
  };

  // Academic Calendar Milestones dynamically derived from school events
  const academicCalendarEvents = useMemo(() => {
    return eventsList.map((e, idx) => {
      const eventDate = e.date ? new Date(e.date) : null;
      const validDate = eventDate && !Number.isNaN(eventDate.getTime());
      return {
        id: e.id || idx,
        month: validDate ? eventDate.toLocaleString('default', { month: 'short' }).toUpperCase() : '—',
        day: validDate ? String(eventDate.getDate()) : '—',
        title: e.title,
        time: e.time || '',
        location: e.location || '',
        tag: e.type || 'Academic',
        color: e.color || '--primary'
      };
    });
  }, [eventsList]);

  // Resolve current staff and student for accurate matching
  const currentStaff = useMemo(() => {
    return staffList.find(s => 
      s.id === currentUser?.uid || 
      (s.email && currentUser?.email && s.email.toLowerCase() === currentUser.email.toLowerCase())
    );
  }, [staffList, currentUser]);

  const currentStudent = myStudentRecord;

  const isClassTaughtByMe = useCallback((c) => {
    if (!c) return false;
    if (c.teacherId && (c.teacherId === currentUser?.uid || (currentStaff && (c.teacherId === currentStaff.id || c.teacherId === currentStaff.staffId)))) return true;
    if (c.createdByUid && c.createdByUid === currentUser?.uid) return true;
    const teacherEmail = (c.teacherEmail || '').toLowerCase().trim();
    const userEmail = (currentUser?.email || '').toLowerCase().trim();
    const staffEmail = (currentStaff?.email || '').toLowerCase().trim();
    if (teacherEmail && (teacherEmail === userEmail || teacherEmail === staffEmail)) return true;
    const classTeacher = (c.teacher || c.instructor || '').toLowerCase().trim();
    if (classTeacher) {
      const candidateNames = [currentUser?.displayName, currentUser?.name, currentStaff?.name].filter(Boolean).map(n => n.toLowerCase().trim());
      for (const name of candidateNames) {
        if (name && (classTeacher === name || classTeacher.includes(name) || name.includes(classTeacher))) return true;
      }
    }
    return Boolean(c.taughtByMe);
  }, [currentUser, currentStaff]);

  const isClassEnrolledByMe = useCallback((c) => {
    return isStudentEnrolledInCourse(currentStudent, c);
  }, [currentStudent]);

  const taughtCourses = useMemo(() => (isStudent ? [] : classesList.filter(isClassTaughtByMe)), [classesList, isClassTaughtByMe, isStudent]);
  // Counts come from the server; the dashboard never loads the student list.
  const countSpecs = useMemo(() => [
    ...(isStudent ? [] : [{ kind: 'status', value: 'active' }]),
    ...taughtCourses.map(course => ({ kind: 'course', value: String(course.id), classGroupId: course.classGroupId ? String(course.classGroupId) : '' })),
  ], [isStudent, taughtCourses]);
  const studentCounts = useStudentCounts(activeSchoolId, countSpecs, studentsVersion);
  const totalStudents = isStudent ? undefined : studentCounts.get({ kind: 'status', value: 'active' });
  const teacherClasses = useMemo(() => taughtCourses.map(c => ({
    id: c.id,
    name: c.name,
    time: c.schedule || '',
    room: c.room || '',
    classLabel: c.classGroupId ? classGroups.find(group => group.id === c.classGroupId)?.label || '' : '',
    students: studentCounts.get({ kind: 'course', value: String(c.id), classGroupId: c.classGroupId ? String(c.classGroupId) : '' }),
  })), [taughtCourses, classGroups, studentCounts]);
  const myHomerooms = useMemo(() => classGroups.filter(group => group.homeroomTeacherId && String(group.homeroomTeacherId) === String(currentUser?.uid)), [classGroups, currentUser?.uid]);

  const studentScheduleToday = useMemo(() => {
    return classesList.filter(isClassEnrolledByMe).map((c, idx) => ({
      id: c.id || idx,
      period: c.period || c.code || '',
      time: c.schedule || '',
      name: c.name,
      teacher: c.teacher || '',
      room: c.room || ''
    }));
  }, [classesList, isClassEnrolledByMe]);
  const studentCourses = useMemo(() => classesList.filter(isClassEnrolledByMe), [classesList, isClassEnrolledByMe]);
  const { records: studentGradeRecords, loading: studentGradesLoading, error: studentGradesError } = useCourseRecords(isStudent ? activeSchoolId : null, studentCourses);
  const studentCourseGrades = studentGradesLoading || studentGradesError || !currentStudent ? [] : studentCourses
    .map(course => courseResult(currentStudent.id, course, studentGradeRecords[String(course.id)]))
    .filter(Number.isFinite);
  const studentGradeAverage = studentCourseGrades.length ? Math.round(studentCourseGrades.reduce((sum, grade) => sum + grade, 0) / studentCourseGrades.length * 10) / 10 : null;

  const completedStudentTasksCount = studentTasks.filter(t => t.completed).length;
  const pendingStudentTasksCount = studentTasks.filter(t => !t.completed).length;
  const studentTaskProgressPercent = studentTasks.length > 0 
    ? Math.round((completedStudentTasksCount / studentTasks.length) * 100) 
    : 0;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <motion.div 
      className="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <header className="dashboard-hero">
        <motion.div className="hero-welcome" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="gradient-text">
            {`${t('dashboard.welcome', 'Welcome')}${currentUser?.displayName || currentUser?.name ? `, ${currentUser.displayName || currentUser.name}` : ''}! ${isStudent ? '🎓✨' : '✨'}`}
          </h1>
          <p>
            {isStudent 
              ? (isAlbanian 
                ? `${activeSchool?.name || 'Shkolla'} • Portali i Nxënësit • ${studentCourses.length} lëndë të regjistruara`
                : `${activeSchool?.name || 'School'} ${t('nav.student')} Portal • ${studentCourses.length} ${studentCourses.length === 1 ? 'class' : 'classes'} enrolled`)
              : isAdmin 
              ? (isAlbanian 
                ? `Ja çfarë po ndodh sot në ${activeSchool?.name || 'shkollë'}.`
                : `Here's what's happening across ${activeSchool?.name || 'the school'} today.`)
              : (isAlbanian
                ? `Keni ${teacherClasses.length} ${teacherClasses.length === 1 ? 'lëndë të caktuar' : 'lëndë të caktuara'} në planprogram.`
                : `You have ${teacherClasses.length} assigned ${teacherClasses.length === 1 ? 'class' : 'classes'} in curriculum.`)}
          </p>
        </motion.div>
        
        <div className="hero-right">
          <motion.div className="mood-widget glass bouncy" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="mood-label">{isStudent ? t('dashboard.dailyVibe') : t('dashboard.todaysVibe')}</span>
            <div className="mood-options">
              <button className={vibe === 'happy' ? 'active' : ''} onClick={() => handleMoodSelect('happy')} title={t('dashboard.great')}><Smile size={20} /></button>
              <button className={vibe === 'neutral' ? 'active' : ''} onClick={() => handleMoodSelect('neutral')} title={t('dashboard.okay')}><Meh size={20} /></button>
              <button className={vibe === 'sad' ? 'active' : ''} onClick={() => handleMoodSelect('sad')} title={t('dashboard.tough')}><Frown size={20} /></button>
            </div>
          </motion.div>
          <motion.button 
            className="btn-primary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('schedule')}
          >
            <Calendar size={20} />
            {isStudent ? t('dashboard.myClassTimetable') : t('dashboard.viewFullSchedule')}
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {isMoodModalOpen && (
          <div className="modal-overlay">
            <motion.div 
              className="modal-content glass"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
              <div className="modal-header">
                <h3 style={{ color: 'hsl(var(--primary))' }}>
                  {t('dashboard.howsYourDay')}
                </h3>
                <button type="button" onClick={() => setIsMoodModalOpen(false)} aria-label={isAlbanian ? 'Mbyll' : 'Close'}><X size={20} /></button>
              </div>
              <p>{getMoodPrompt()}</p>
              <textarea 
                className="glass" 
                placeholder={t('dashboard.shareThoughts')}
                value={moodNote}
                onChange={(e) => setMoodNote(e.target.value)}
              />
              <div className="modal-actions">
                <button className="text-btn" onClick={() => setIsMoodModalOpen(false)}>{t('common.skip')}</button>
                <button className="btn-primary" onClick={submitMoodNote}>
                  <Send size={18} />
                  {t('dashboard.saveNote')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="focus-section">
        <motion.div 
          className="focus-card glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="focus-header">
            <Rocket size={20} className="icon-pulse" />
            <h3>{t('dashboard.dailyMotivation')}</h3>
          </div>
          <div className="quote-content">
            <p className="quote-text">"{currentQuote.text}"</p>
            <span className="quote-author">— {currentQuote.author}</span>
          </div>
        </motion.div>
      </section>

      {/* Metrics Cards Grid tailored to role */}
      <section className="stats-grid">
        {isStudent ? (
          <>
            <StatCard icon={Star} label={isAlbanian ? 'Mesatarja aktuale' : 'Current grade average'} value={studentGradesLoading ? '…' : studentGradeAverage === null ? '—' : `${studentGradeAverage}%`} color="--primary" delay={0.1} subtext={studentGradesError ? (isAlbanian ? 'Notat nuk mund të ngarkohen' : 'Grades unavailable') : `${studentCourseGrades.length} ${isAlbanian ? 'lëndë me nota' : 'graded courses'}`} />
            <StatCard icon={BookOpen} label={t('dashboard.enrolledClasses')} value={`${studentCourses.length} ${isAlbanian ? 'Lëndë' : 'Courses'}`} color="--accent" delay={0.2} subtext={studentCourses.length ? (isAlbanian ? 'Lëndët ku jeni regjistruar' : 'Your enrolled courses') : (isAlbanian ? 'Nuk ka lëndë të regjistruara' : 'No enrolled courses')} />
            <StatCard icon={CheckCircle2} label={t('dashboard.personalTasks')} value={`${pendingStudentTasksCount} ${t('common.pending')}`} color="--chart-1" delay={0.3} subtext={`${completedStudentTasksCount} ${t('common.completed')}`} />
            <StatCard icon={Target} label={t('dashboard.academicEvents')} value={`${eventsList.length} ${isAlbanian ? 'Të Planifikuara' : 'Scheduled'}`} color="--chart-2" delay={0.4} subtext={t('dashboard.campusCalendar')} />
          </>
        ) : isAdmin ? (
          <>
            <StatCard icon={GraduationCap} label={t('dashboard.studentsEnrolled')} value={totalStudents === undefined ? '…' : totalStudents.toLocaleString()} color="--primary" delay={0.1} subtext={t('dashboard.activeStudents')} />
            <StatCard icon={Users} label={t('dashboard.staffFaculty')} value={staffList.length} color="--accent" delay={0.2} subtext={t('dashboard.facultyRoster')} />
            <StatCard icon={Star} label={t('dashboard.campusEvents')} value={eventsList.length} color="--chart-1" delay={0.3} subtext={isAlbanian ? 'E Planifikuar' : 'Scheduled'} />
            <StatCard icon={Coffee} label={t('dashboard.activeClasses')} value={classesList.length} color="--chart-2" delay={0.4} subtext={isAlbanian ? `${classGroups.length} klasa` : `${classGroups.length} ${classGroups.length === 1 ? 'class' : 'classes'}`} />
          </>
        ) : (
          <>
            <StatCard icon={BookOpen} label={t('dashboard.myClasses')} value={teacherClasses.length} color="--primary" delay={0.1} subtext={myHomerooms.length ? `${isAlbanian ? 'Kujdestar i' : 'Homeroom'} ${myHomerooms.map(group => group.label).join(', ')}` : t('dashboard.taughtByYou')} />
            <StatCard icon={Users} label={t('dashboard.totalStudents')} value={totalStudents === undefined ? '…' : totalStudents.toLocaleString()} color="--accent" delay={0.2} subtext={t('dashboard.enrolledRoster')} />
            <StatCard icon={Presentation} label={t('dashboard.curriculumCourses')} value={classesList.length} color="--chart-1" delay={0.3} subtext={t('dashboard.fullDepartment')} />
            <StatCard icon={CheckCircle2} label={t('dashboard.upcomingEvents')} value={eventsList.length} color="--mood-happy" delay={0.4} subtext={t('dashboard.schoolCalendar')} />
          </>
        )}
      </section>

      {/* Campus Bulletins & Announcements Banner (Retained as requested) */}
      <section className="bulletin-section">
        <div className="bulletin-card glass">
          <div className="bulletin-header">
            <div className="bulletin-title">
              <Megaphone size={20} className="megaphone-icon" />
              <h3>{t('dashboard.campusBulletins')}</h3>
            </div>
            <span className="bulletin-badge glass">📢 {t('dashboard.liveBroadcasts')}</span>
          </div>
          <div className="bulletin-list">
            {announcements.length === 0 ? (
              <div style={{ padding: '1rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                {t('dashboard.noNotices')}
              </div>
            ) : (
              announcements.map(a => (
                <div key={a.id} className="bulletin-item glass bouncy">
                  <span className={`bulletin-tag-pill ${a.priority}`}>{a.tag}</span>
                  <p className="bulletin-text">{a.title}</p>
                  <div className="bulletin-meta">
                    <span>{a.author}</span> • <span>{a.date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Dashboard Middle Grid: Tasks / Activity / Schedule */}
      <div className="dashboard-content-grid">
        {isStudent ? (
          /* Student: Personal Tasks & Homework Checklist */
          <motion.div 
            className="content-card glass student-tasks-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="card-header">
              <div>
                <h3>{t('dashboard.myTasksHomework')}</h3>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                  {pendingStudentTasksCount} {t('common.pending')} • {completedStudentTasksCount} {t('common.completed')}
                </span>
              </div>
              <button className="text-btn" onClick={() => onNavigate('tasks')}>{t('dashboard.fullBoard')}</button>
            </div>

            {/* Task completion progress bar */}
            <div className="student-progress-container">
              <div className="student-progress-labels">
                <span>{t('dashboard.taskCompletion')}</span>
                <span>{studentTaskProgressPercent}% ({completedStudentTasksCount}/{studentTasks.length})</span>
              </div>
              <div className="student-progress-track">
                <div 
                  className="student-progress-fill" 
                  style={{ width: `${studentTaskProgressPercent}%` }}
                />
              </div>
            </div>

            {/* Quick add task */}
            <form className="student-task-input-bar" onSubmit={handleAddStudentTask}>
              <input 
                type="text" 
                placeholder={t('dashboard.addHomeworkGoal')} 
                value={newStudentTaskText}
                onChange={(e) => setNewStudentTaskText(e.target.value)}
              />
              <button type="submit" className="icon-btn bouncy" title="Add Task">
                <Plus size={18} />
              </button>
            </form>

            {/* Interactive Tasks Checklist */}
            <div className="student-tasks-list">
              <AnimatePresence>
                {studentTasks.map((t) => (
                  <motion.div 
                    key={t.id} 
                    className={`student-task-item bouncy ${t.completed ? 'completed' : ''}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <div className="student-task-left">
                      <button 
                        className={`student-task-checkbox ${t.completed ? 'checked' : ''}`}
                        onClick={() => toggleStudentTask(t.id)}
                        aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                      >
                        {t.completed && <Check size={14} />}
                      </button>
                      <div className="student-task-details">
                        <span className="student-task-title">{t.text}</span>
                        <div className="student-task-meta">
                          <span className={`student-tag-pill ${t.category}`}>{t.category}</span>
                          <span className={`priority-dot ${t.priority}`} title={`Priority: ${t.priority}`} />
                          <span><Clock size={12} style={{ display: 'inline', marginRight: 3 }} />{t.due}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      className="delete-btn" 
                      onClick={() => deleteStudentTask(t.id)} 
                      title="Delete task"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          /* Admin / Teacher: Activity & Submissions */
          <motion.div 
            className="content-card glass"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="card-header">
              <h3>{isAdmin ? t('dashboard.schoolWideActivity') : t('dashboard.studentSubmissions')}</h3>
              <button className="text-btn" onClick={() => onNavigate('students')}>{t('common.viewAll')}</button>
            </div>
            <div className="activity-list">
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                {t('dashboard.noActivity')}
              </div>
            </div>
          </motion.div>
        )}

        {/* Right column of middle grid */}
        {isStudent ? (
          /* Student: Today's Enrolled Classes */
          <motion.div 
            className="content-card glass"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="card-header">
              <div>
                <h3>{isAlbanian ? 'Lëndët e mia' : 'My enrolled courses'}</h3>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                  {studentScheduleToday.length} {isAlbanian ? 'lëndë' : studentScheduleToday.length === 1 ? 'course' : 'courses'}
                </span>
              </div>
              <button className="text-btn" onClick={() => onNavigate('schedule')}>{t('dashboard.fullTimetable')}</button>
            </div>
            <div className="student-classes-list">
              {studentScheduleToday.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                  {t('dashboard.noClassesEnrolled')}
                </div>
              ) : (
                studentScheduleToday.map((cls) => (
                  <div 
                    key={cls.id} 
                    className="student-class-card bouncy"
                    onClick={() => onNavigate('classes')}
                    title="Click to view class syllabus"
                  >
                    <div className="student-class-time-block">
                      <span className="student-class-period">{cls.period}</span>
                      {cls.time && <span className="student-class-time">{cls.time}</span>}
                    </div>
                    <div className="student-class-main">
                      <h4 className="student-class-title">{cls.name}</h4>
                      <div className="student-class-sub">
                        {cls.room && <span><MapPin size={13} style={{ display: 'inline', marginRight: 3 }} />{cls.room}</span>}
                        {cls.room && cls.teacher && <span>•</span>}
                        {cls.teacher && <span>{cls.teacher}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : !isAdmin ? (
          /* Teacher Classes */
          <motion.div 
            className="content-card glass"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="card-header">
              <h3>{isAlbanian ? 'Lëndët e mia' : 'My courses'}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="text-btn" onClick={() => onNavigate('lesson-plans')}>{t('dashboard.lessonPlanning')}</button>
                <button className="text-btn" onClick={() => onNavigate('schedule')}>{t('dashboard.fullTimetable')}</button>
              </div>
            </div>
            <div className="classes-today-list">
              {teacherClasses.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                  {t('dashboard.noClassesAssigned')}
                </div>
              ) : (
                teacherClasses.map(cls => (
                  <div key={cls.id} className="class-row glass bouncy">
                    {cls.time && <div className="class-time">{cls.time}</div>}
                    <div className="class-info">
                      <h4>{cls.name}</h4>
                      <span>{[cls.classLabel && `${isAlbanian ? 'Klasa' : 'Class'} ${cls.classLabel}`, cls.room].filter(Boolean).join(' • ')}{(cls.classLabel || cls.room) ? ' • ' : ''}{cls.students === undefined ? '…' : cls.students} {isAlbanian ? 'nxënës' : cls.students === 1 ? 'student' : 'students'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          /* Admin Tasks Kanban */
          <motion.div 
            className="content-card glass"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="card-header">
              <h3>{t('dashboard.adminTasksTracker')}</h3>
              <button className="text-btn" onClick={() => onNavigate('tasks')}>{t('dashboard.manage')}</button>
            </div>
            <div className="kanban-board">
              {['todo', 'inprogress'].map((column) => (
                <div 
                  key={column} 
                  className="kanban-column"
                  onDrop={(e) => handleDrop(e, column)}
                  onDragOver={handleDragOver}
                >
                  <div className="kanban-column-header">
                    <h4>
                      {column === 'todo' && `${t('dashboard.toDo')} ⏱️`}
                      {column === 'inprogress' && `${t('dashboard.inProgress')} 🚀`}
                    </h4>
                    <span className="task-count">{tasks.filter(t => t.status === column).length}</span>
                  </div>
                  <div className="kanban-column-body">
                    <AnimatePresence>
                      {tasks.filter(t => t.status === column).map(task => (
                        <motion.div
                          key={task.id}
                          className="kanban-task bouncy glass"
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          layout
                        >
                          <GripVertical size={16} className="drag-handle" />
                          <span className="task-content-text">{task.content}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Dashboard Bottom Grid: Personal Notes + Academic Calendar */}
      <div className="dashboard-bottom-grid">
        <motion.div 
          className="content-card glass quick-notes-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="card-header">
            <h3>{isStudent ? t('dashboard.personalStudyNotes') : t('dashboard.personalWorknotes')}</h3>
            <span className="badge">{savedNotes.length} {t('common.saved')}</span>
          </div>
          <div className="notes-input-area">
            <input 
              type="text" 
              placeholder={isStudent ? t('dashboard.jotDownPrompt') : t('dashboard.jotSomething')} 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <button className="icon-btn bouncy" onClick={handleAddNote} title={t('dashboard.saveNote')}>
              <Plus size={18} />
            </button>
          </div>
          <div className="notes-list">
            {savedNotes.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
                {t('dashboard.noNotesSaved')}
              </div>
            ) : (
              <AnimatePresence>
                {savedNotes.map((n) => (
                  <motion.div 
                    key={n.id} 
                    className="note-item bouncy"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="note-content">
                      <p>{n.text}</p>
                      <span>{n.time}</span>
                    </div>
                    <button className="delete-btn" onClick={() => deleteNote(n.id)} title="Delete Note">
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* Academic Calendar (Retained and tailored for student view) */}
        <motion.div 
          className="content-card glass upcoming-events-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <div className="card-header">
            <div>
              <h3>{t('dashboard.academicCalendarKeyDates')}</h3>
              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                {t('dashboard.upcomingExams')}
              </span>
            </div>
            <button className="text-btn" onClick={() => onNavigate('events')}>{t('common.seeAll')}</button>
          </div>
          <div className="events-list">
            {academicCalendarEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                {t('dashboard.noUpcomingEvents')}
              </div>
            ) : (
              academicCalendarEvents.map((event) => (
                <div 
                  key={event.id} 
                  className="academic-calendar-event bouncy" 
                  onClick={() => onNavigate('events')}
                  title="Click to view details in Events Center"
                >
                  <div className="academic-event-date-badge">
                    <span className="academic-event-month">{event.month}</span>
                    <span className="academic-event-day">{event.day}</span>
                  </div>
                  <div className="academic-event-body">
                    <h4>{event.title}</h4>
                    <div className="academic-event-meta">
                      {event.time && <span><Clock size={13} style={{ display: 'inline', marginRight: 3 }} />{event.time}</span>}
                      {event.time && event.location && <span>•</span>}
                      {event.location && <span><MapPin size={13} style={{ display: 'inline', marginRight: 3 }} />{event.location}</span>}
                    </div>
                  </div>
                  <span 
                    className="academic-tag-pill"
                    style={{ 
                      backgroundColor: `hsla(var(${event.color}), 0.15)`,
                      color: `hsl(var(${event.color}))`
                    }}
                  >
                    {event.tag}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
