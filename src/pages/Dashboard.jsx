import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, GraduationCap, Calendar, TrendingUp, Star, 
  Coffee, Plus, Trash2, Clock, MapPin, GripVertical, 
  Target, Smile, Meh, Frown, X, Send, BookOpen, 
  CheckCircle2, AlertCircle, LayoutDashboard,
  Presentation, Rocket, Megaphone, BellRing, Sparkles
} from 'lucide-react';
import { useTasks } from '../context/TasksContext';
import { useMood } from '../context/MoodContext';
import { useSchoolData } from '../context/SchoolDataContext';
import './Dashboard.css';

const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div 
    className="stat-card glass bouncy"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <div className="stat-icon-wrapper" style={{ backgroundColor: `hsla(var(${color}), 0.2)`, color: `hsl(var(${color}))` }}>
      <Icon size={24} />
    </div>
    <div className="stat-info">
      <h3>{value}</h3>
      <p>{label}</p>
    </div>
    <div className="stat-trend">
      <TrendingUp size={16} />
      <span>+5%</span>
    </div>
  </motion.div>
);

const Dashboard = ({ onNavigate, userRole = 'admin' }) => {
  const [note, setNote] = useState('');
  const { moodHistory, addMoodEntry, getTodayMood } = useMood();
  const { staffList, studentsList } = useSchoolData();
  const todayEntry = getTodayMood();
  
  const [vibe, setVibe] = useState(todayEntry?.mood || '');
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);
  const [moodNote, setMoodNote] = useState('');
  const [pendingMood, setPendingMood] = useState(null);

  const [savedNotes, setSavedNotes] = useState([
    { id: 1, text: 'Remind class about the Science fair tomorrow!', time: '10 mins ago' },
    { id: 2, text: 'Need to grade the math quizzes by Friday.', time: '2 hours ago' }
  ]);
  const { tasks, moveTask } = useTasks();

  const quotes = [
    { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
    { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
    { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" }
  ];

  const [currentQuote] = useState(quotes[Math.floor(Math.random() * quotes.length)]);

  const [announcements, setAnnouncements] = useState([
    { id: 1, tag: 'Academic', title: 'Mid-term evaluation reports submission deadline is this Friday', author: 'Principal Office', date: 'Today, 08:30 AM', priority: 'high' },
    { id: 2, tag: 'Campus Life', title: 'Annual Robotics & Science Exhibition setup begins in Main Gymnasium', author: 'Science Dept', date: 'Yesterday', priority: 'medium' },
    { id: 3, tag: 'Faculty', title: 'Quarterly Staff & Curriculum Alignment workshop next Monday', author: 'Admin Operations', date: '2 days ago', priority: 'low' }
  ]);

  const getMoodPrompt = () => {
    const activeMood = pendingMood || vibe;
    switch(activeMood) {
      case 'happy': return "What made your school day awesome? ✨";
      case 'neutral': return "Any small wins or thoughts from today? 📝";
      case 'sad': return "It's okay to have off days. Want to talk about what happened? 💜";
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

  const upcomingEvents = [
    { id: 1, title: 'Science Fair 2026', time: 'Tomorrow, 09:00 AM', location: 'Main Hall', color: '--primary' },
    { id: 2, title: 'Staff Meeting', time: 'Friday, 15:00 PM', location: 'Room 402', color: '--accent' },
    { id: 3, title: 'Parent-Teacher Conf.', time: 'Next Monday', location: 'Virtual', color: '--chart-2' },
  ];

  const teacherClasses = [
    { id: 1, name: 'Advanced Mathematics', time: '09:00 - 10:30', room: '302', students: 24, status: 'Completed' },
    { id: 2, name: 'Physics Mechanics', time: '11:00 - 12:30', room: 'Lab B', students: 18, status: 'Next' },
    { id: 3, name: 'Applied Calculus', time: '14:00 - 15:30', room: '304', students: 22, status: 'Upcoming' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const isAdmin = userRole === 'admin';

  return (
    <motion.div 
      className="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <header className="dashboard-hero">
        <motion.div className="hero-welcome" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="gradient-text">Welcome back, {isAdmin ? 'Admin Lumi' : 'Prof. Wilson'}! ✨</h1>
          <p>{isAdmin ? "Here's what's happening across LumiSchool today." : "You have 3 classes scheduled for today."}</p>
        </motion.div>
        
        <div className="hero-right">
          <motion.div className="mood-widget glass bouncy" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="mood-label">Today's Vibe</span>
            <div className="mood-options">
              <button className={vibe === 'happy' ? 'active' : ''} onClick={() => handleMoodSelect('happy')}><Smile size={20} /></button>
              <button className={vibe === 'neutral' ? 'active' : ''} onClick={() => handleMoodSelect('neutral')}><Meh size={20} /></button>
              <button className={vibe === 'sad' ? 'active' : ''} onClick={() => handleMoodSelect('sad')}><Frown size={20} /></button>
            </div>
          </motion.div>
          <motion.button 
            className="btn-primary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('schedule')}
          >
            <Calendar size={20} />
            View Full Schedule
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
                <h3 style={{ color: 'hsl(var(--primary))' }}>How's your day, {isAdmin ? 'Lumi' : 'Professor'}? ✍️</h3>
                <button onClick={() => setIsMoodModalOpen(false)}><X size={20} /></button>
              </div>
              <p>{getMoodPrompt()}</p>
              <textarea 
                className="glass" 
                placeholder="Share your thoughts..."
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

      <section className="stats-grid">
        {isAdmin ? (
          <>
            <StatCard icon={GraduationCap} label="Students Enrolled" value={studentsList.length || 6} color="--primary" delay={0.1} />
            <StatCard icon={Users} label="Staff & Faculty" value={staffList.length || 6} color="--accent" delay={0.2} />
            <StatCard icon={Star} label="Avg GPA" value="3.82" color="--chart-1" delay={0.3} />
            <StatCard icon={Coffee} label="Active Classes" value="48" color="--chart-2" delay={0.4} />
          </>
        ) : (
          <>
            <StatCard icon={BookOpen} label="My Classes" value="4" color="--primary" delay={0.1} />
            <StatCard icon={AlertCircle} label="Pending Grades" value="12" color="--mood-sad" delay={0.2} />
            <StatCard icon={Presentation} label="Today's Lessons" value="3" color="--accent" delay={0.3} />
            <StatCard icon={CheckCircle2} label="Class Attendance" value="98%" color="--mood-happy" delay={0.4} />
          </>
        )}
      </section>

      {/* Campus Bulletins & Announcements Banner */}
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
            {announcements.map(a => (
              <div key={a.id} className="bulletin-item glass bouncy">
                <span className={`bulletin-tag-pill ${a.priority}`}>{a.tag}</span>
                <p className="bulletin-text">{a.title}</p>
                <div className="bulletin-meta">
                  <span>{a.author}</span> • <span>{a.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="dashboard-content-grid">
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
            {(isAdmin ? [1, 2, 3] : [1, 2]).map((i) => (
              <div key={i} className="activity-item">
                <div className="avatar-small">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${isAdmin ? i : i+10}`} alt="User" />
                </div>
                <div className="activity-details">
                  <p>
                    <strong>{isAdmin ? 'Emma Wilson' : 'Oliver Twist'}</strong> {isAdmin ? 'submitted Calculus Problem Set #3' : 'turned in "Physics Lab Report #4"'}
                  </p>
                  <span>{i} hour{i > 1 ? 's' : ''} ago</span>
                </div>
                {!isAdmin && <button className="grade-btn glass bouncy" onClick={() => onNavigate('classes')}>Grade</button>}
              </div>
            ))}
          </div>
        </motion.div>

        {!isAdmin ? (
          <motion.div 
            className="content-card glass"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="card-header">
              <h3>My Classes Today</h3>
              <button className="text-btn" onClick={() => onNavigate('schedule')}>Full Schedule</button>
            </div>
            <div className="classes-today-list">
              {teacherClasses.map(cls => (
                <div key={cls.id} className={`class-row glass bouncy ${cls.status.toLowerCase()}`}>
                  <div className="class-time">{cls.time}</div>
                  <div className="class-info">
                    <h4>{cls.name}</h4>
                    <span>Room {cls.room} • {cls.students} Students</span>
                  </div>
                  <div className="class-status-badge">{cls.status}</div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
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

      <div className="dashboard-bottom-grid">
        <motion.div 
          className="content-card glass quick-notes-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="card-header">
            <h3>Personal Worknotes</h3>
            <span className="badge">{savedNotes.length} saved</span>
          </div>
          <div className="notes-input-area">
            <input 
              type="text" 
              placeholder="Jot something down..." 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <button className="icon-btn bouncy" onClick={handleAddNote}>
              <Plus size={18} />
            </button>
          </div>
          <div className="notes-list">
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
                  <button className="delete-btn" onClick={() => deleteNote(n.id)}>
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div 
          className="content-card glass upcoming-events-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <div className="card-header">
            <h3>Academic Calendar</h3>
            <button className="text-btn" onClick={() => onNavigate('events')}>See All</button>
          </div>
          <div className="events-list">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="event-item glass bouncy" style={{ borderLeft: `4px solid hsl(var(${event.color}))` }}>
                <div className="event-info">
                  <h4>{event.title}</h4>
                  <div className="event-meta">
                    <span className="meta-item"><Clock size={14} /> {event.time}</span>
                    <span className="meta-item"><MapPin size={14} /> {event.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
