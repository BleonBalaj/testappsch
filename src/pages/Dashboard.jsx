import React, { useState, useMemo } from 'react';
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
import { Avatar } from '../components/Avatar';
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
      <TrendingUp size={16} />
      <span>{subtext || '+5%'}</span>
    </div>
  </motion.div>
);

const QUOTES = [
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" }
];

const Dashboard = ({ onNavigate, userRole = 'student' }) => {
  const [note, setNote] = useState('');
  const { moodHistory, addMoodEntry, getTodayMood } = useMood();
  const { staffList = [], studentsList = [], classesList = [], eventsList = [] } = useSchoolData();
  const { currentUser, activeSchool } = useAuth();
  const todayEntry = getTodayMood();
  
  const [vibe, setVibe] = useState(todayEntry?.mood || '');
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);
  const [moodNote, setMoodNote] = useState('');
  const [pendingMood, setPendingMood] = useState(null);

  const isStudent = userRole === 'student';
  const isAdmin = userRole === 'admin';

  // Student specific tasks & interactive state
  const [studentTasks, setStudentTasks] = useState([]);
  const [newStudentTaskText, setNewStudentTaskText] = useState('');

  const toggleStudentTask = (id) => {
    setStudentTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleAddStudentTask = (e) => {
    if (e) e.preventDefault();
    if (newStudentTaskText.trim()) {
      setStudentTasks(prev => [
        {
          id: Date.now(),
          text: newStudentTaskText.trim(),
          category: 'homework',
          priority: 'medium',
          due: 'Upcoming',
          completed: false
        },
        ...prev
      ]);
      setNewStudentTaskText('');
    }
  };

  const deleteStudentTask = (id) => {
    setStudentTasks(prev => prev.filter(t => t.id !== id));
  };

  const [savedNotes, setSavedNotes] = useState([]);
  const { tasks, moveTask } = useTasks();

  const [currentQuote] = useState(() => QUOTES[0]);

  const [announcements, setAnnouncements] = useState([]);

  const getMoodPrompt = () => {
    const activeMood = pendingMood || vibe;
    switch(activeMood) {
      case 'happy': return isStudent ? "What made your classes great today? 🌟" : "What made your school day awesome? ✨";
      case 'neutral': return isStudent ? "Any study goals or reflections for today? 📝" : "Any small wins or thoughts from today? 📝";
      case 'sad': return isStudent ? "Studying can get stressful. Need a breath or break? 💜" : "It's okay to have off days. Want to talk about what happened? 💜";
      default: return "How's your day going?";
    }
  };

  const handleMoodSelect = (selectedMood) => {
    setVibe(selectedMood);
    if (!todayEntry || !todayEntry.note) {
      setPendingMood(selectedMood);
      setIsMoodModalOpen(true);
    } else {
      addMoodEntry(selectedMood, todayEntry.note);
    }
  };

  const submitMoodNote = () => {
    addMoodEntry(pendingMood || vibe, moodNote);
    setIsMoodModalOpen(false);
    setMoodNote('');
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('taskId', id.toString());
  };

  const handleDrop = (e, status) => {
    const id = e.dataTransfer.getData('taskId');
    if (id) moveTask(parseInt(id), status);
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  const handleAddNote = () => {
    if (note.trim()) {
      setSavedNotes([{ id: Date.now(), text: note, time: 'Just now' }, ...savedNotes]);
      setNote('');
    }
  };

  const deleteNote = (id) => {
    setSavedNotes(savedNotes.filter(n => n.id !== id));
  };

  // Academic Calendar Milestones dynamically derived from school events
  const academicCalendarEvents = useMemo(() => {
    return eventsList.map((e, idx) => ({
      id: e.id || idx,
      month: new Date(e.date || Date.now()).toLocaleString('default', { month: 'short' }).toUpperCase(),
      day: String(new Date(e.date || Date.now()).getDate()),
      title: e.title,
      time: e.time || '10:00 AM',
      location: e.location || 'Campus',
      tag: e.type || 'Academic',
      color: e.color || '--primary'
    }));
  }, [eventsList]);

  const teacherClasses = useMemo(() => {
    return classesList.filter(c => c.taughtByMe).map(c => ({
      id: c.id,
      name: c.name,
      time: c.schedule || 'Scheduled',
      room: c.room || 'Room 301',
      students: c.students || 0,
      status: 'Upcoming'
    }));
  }, [classesList]);

  const studentScheduleToday = useMemo(() => {
    return classesList.filter(c => c.enrolled).map((c, idx) => ({
      id: c.id || idx,
      period: c.period || `Period ${idx + 1}`,
      time: c.schedule || 'Scheduled',
      name: c.name,
      teacher: c.teacher || 'Instructor',
      room: c.room || 'Main Hall',
      status: 'upcoming'
    }));
  }, [classesList]);

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
            {`Welcome back${currentUser?.name ? `, ${currentUser.name}` : ''}! ${isStudent ? '🎓✨' : '✨'}`}
          </h1>
          <p>
            {isStudent 
              ? `${activeSchool?.name || 'School'} Student Portal • ${studentScheduleToday.length} ${studentScheduleToday.length === 1 ? 'class' : 'classes'} enrolled` 
              : isAdmin 
              ? `Here's what's happening across ${activeSchool?.name || 'the school'} today.`
              : `You have ${teacherClasses.length} assigned ${teacherClasses.length === 1 ? 'class' : 'classes'} in curriculum.`}
          </p>
        </motion.div>
        
        <div className="hero-right">
          <motion.div className="mood-widget glass bouncy" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="mood-label">{isStudent ? 'Daily Vibe' : "Today's Vibe"}</span>
            <div className="mood-options">
              <button className={vibe === 'happy' ? 'active' : ''} onClick={() => handleMoodSelect('happy')} title="Great"><Smile size={20} /></button>
              <button className={vibe === 'neutral' ? 'active' : ''} onClick={() => handleMoodSelect('neutral')} title="Okay"><Meh size={20} /></button>
              <button className={vibe === 'sad' ? 'active' : ''} onClick={() => handleMoodSelect('sad')} title="Tough"><Frown size={20} /></button>
            </div>
          </motion.div>
          <motion.button 
            className="btn-primary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('schedule')}
          >
            <Calendar size={20} />
            {isStudent ? 'My Class Timetable' : 'View Full Schedule'}
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
                  {isStudent ? "How's your day, Aria? ✍️" : "How's your day, Noesis? ✍️"}
                </h3>
                <button onClick={() => setIsMoodModalOpen(false)}><X size={20} /></button>
              </div>
              <p>{getMoodPrompt()}</p>
              <textarea 
                className="glass" 
                placeholder={isStudent ? "Share what you learned or how you feel..." : "Share your thoughts..."}
                value={moodNote}
                onChange={(e) => setMoodNote(e.target.value)}
              />
              <div className="modal-actions">
                <button className="text-btn" onClick={() => setIsMoodModalOpen(false)}>Skip</button>
                <button className="btn-primary" onClick={submitMoodNote}>
                  <Send size={18} />
                  Save Note
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
            <h3>Daily Motivation</h3>
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
            <StatCard icon={Star} label="Academic Standing" value="Good Standing" color="--primary" delay={0.1} subtext="Active Enrollment" />
            <StatCard icon={BookOpen} label="Enrolled Classes" value={`${studentScheduleToday.length} Courses`} color="--accent" delay={0.2} subtext={studentScheduleToday[0] ? `Next: ${studentScheduleToday[0].name}` : 'No classes today'} />
            <StatCard icon={CheckCircle2} label="Personal Tasks" value={`${pendingStudentTasksCount} Pending`} color="--chart-1" delay={0.3} subtext={`${completedStudentTasksCount} Completed`} />
            <StatCard icon={Target} label="Academic Events" value={`${eventsList.length} Scheduled`} color="--chart-2" delay={0.4} subtext="Campus Calendar" />
          </>
        ) : isAdmin ? (
          <>
            <StatCard icon={GraduationCap} label="Students Enrolled" value={studentsList.length} color="--primary" delay={0.1} subtext="Active Students" />
            <StatCard icon={Users} label="Staff & Faculty" value={staffList.length} color="--accent" delay={0.2} subtext="Faculty Roster" />
            <StatCard icon={Star} label="Campus Events" value={eventsList.length} color="--chart-1" delay={0.3} subtext="Scheduled" />
            <StatCard icon={Coffee} label="Active Classes" value={classesList.length} color="--chart-2" delay={0.4} subtext="Curriculum Catalog" />
          </>
        ) : (
          <>
            <StatCard icon={BookOpen} label="My Classes" value={teacherClasses.length} color="--primary" delay={0.1} subtext="Taught by you" />
            <StatCard icon={Users} label="Total Students" value={studentsList.length} color="--accent" delay={0.2} subtext="Enrolled roster" />
            <StatCard icon={Presentation} label="Curriculum Courses" value={classesList.length} color="--chart-1" delay={0.3} subtext="Full department" />
            <StatCard icon={CheckCircle2} label="Upcoming Events" value={eventsList.length} color="--mood-happy" delay={0.4} subtext="School calendar" />
          </>
        )}
      </section>

      {/* Campus Bulletins & Announcements Banner (Retained as requested) */}
      <section className="bulletin-section">
        <div className="bulletin-card glass">
          <div className="bulletin-header">
            <div className="bulletin-title">
              <Megaphone size={20} className="megaphone-icon" />
              <h3>Campus Bulletins & Notices</h3>
            </div>
            <span className="bulletin-badge glass">📢 Live Broadcasts</span>
          </div>
          <div className="bulletin-list">
            {announcements.length === 0 ? (
              <div style={{ padding: '1rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                No active campus notices or broadcasts at this time.
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
                <h3>My Personal Tasks & Homework</h3>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                  {pendingStudentTasksCount} pending • {completedStudentTasksCount} done
                </span>
              </div>
              <button className="text-btn" onClick={() => onNavigate('tasks')}>Full Board</button>
            </div>

            {/* Task completion progress bar */}
            <div className="student-progress-container">
              <div className="student-progress-labels">
                <span>Task Completion</span>
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
                placeholder="Add a new homework or study goal..." 
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
              <h3>{isAdmin ? 'School-wide Activity' : 'Student Submissions'}</h3>
              <button className="text-btn" onClick={() => onNavigate('students')}>View All</button>
            </div>
            <div className="activity-list">
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                No recent activity or submissions to display.
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
                <h3>Today's Enrolled Classes</h3>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                  {studentScheduleToday.length} {studentScheduleToday.length === 1 ? 'Period' : 'Periods'} Scheduled
                </span>
              </div>
              <button className="text-btn" onClick={() => onNavigate('schedule')}>Full Timetable</button>
            </div>
            <div className="student-classes-list">
              {studentScheduleToday.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                  No classes enrolled for today. Browse the curriculum in Classes to enroll.
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
                      <span className="student-class-time">{(cls.time || '').split(' - ')[0]}</span>
                    </div>
                    <div className="student-class-main">
                      <h4 className="student-class-title">{cls.name}</h4>
                      <div className="student-class-sub">
                        <span><MapPin size={13} style={{ display: 'inline', marginRight: 3 }} />{cls.room}</span>
                        <span>•</span>
                        <span>{cls.teacher}</span>
                      </div>
                    </div>
                    <div className="student-class-badge upcoming">
                      Upcoming
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
              <h3>My Classes Today</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="text-btn" onClick={() => onNavigate('lesson-plans')}>Lesson planning</button>
                <button className="text-btn" onClick={() => onNavigate('schedule')}>Full Schedule</button>
              </div>
            </div>
            <div className="classes-today-list">
              {teacherClasses.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                  No classes assigned to you today.
                </div>
              ) : (
                teacherClasses.map(cls => (
                  <div key={cls.id} className={`class-row glass bouncy ${(cls.status || '').toLowerCase()}`}>
                    <div className="class-time">{cls.time}</div>
                    <div className="class-info">
                      <h4>{cls.name}</h4>
                      <span>Room {cls.room} • {cls.students} Students</span>
                    </div>
                    <div className="class-status-badge">{cls.status}</div>
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
              <h3>Admin Tasks Tracker</h3>
              <button className="text-btn" onClick={() => onNavigate('tasks')}>Manage</button>
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
                      {column === 'todo' && 'To Do ⏱️'}
                      {column === 'inprogress' && 'In Progress 🚀'}
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
            <h3>{isStudent ? 'Personal Study Notes' : 'Personal Worknotes'}</h3>
            <span className="badge">{savedNotes.length} saved</span>
          </div>
          <div className="notes-input-area">
            <input 
              type="text" 
              placeholder={isStudent ? "Jot down a study reminder, formula, or question..." : "Jot something down..."} 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <button className="icon-btn bouncy" onClick={handleAddNote} title="Save Note">
              <Plus size={18} />
            </button>
          </div>
          <div className="notes-list">
            {savedNotes.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
                No notes saved yet. Type above to add one.
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
              <h3>Academic Calendar & Key Dates</h3>
              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                Upcoming Exams, Deadlines & Events
              </span>
            </div>
            <button className="text-btn" onClick={() => onNavigate('events')}>See All</button>
          </div>
          <div className="events-list">
            {academicCalendarEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                No upcoming events scheduled on the calendar.
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
                      <span><Clock size={13} style={{ display: 'inline', marginRight: 3 }} />{event.time}</span>
                      <span>•</span>
                      <span><MapPin size={13} style={{ display: 'inline', marginRight: 3 }} />{event.location}</span>
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
