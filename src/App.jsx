import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import StarryBackground from './components/StarryBackground';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentOverview from './pages/StudentOverview';
import Staff from './pages/Staff';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Messages from './pages/Messages';
import Classes from './pages/Classes';
import ClassOverview from './pages/ClassOverview';
import Tasks from './pages/Tasks';
import Leaderboard from './pages/Leaderboard';
import Events from './pages/Events';
import Resources from './pages/Resources';
import MoodInsights from './pages/MoodInsights';
import Transcript from './pages/Transcript';
import LessonPlans from './pages/LessonPlans';
import SearchOverlay from './components/SearchOverlay';
import NotificationContainer from './components/Notification';
import QuickAction from './components/QuickAction';
import Login from './pages/Login';
import { MoodProvider } from './context/MoodContext';
import { SchoolDataProvider } from './context/SchoolDataContext';
import { Calendar } from 'lucide-react';
import './App.css';

function App() {
  const getInitialPath = () => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (pathname === 'login' || window.location.hash === '#/login' || window.location.hash === '#login') {
        return 'login';
      }
    }
    return 'dashboard';
  };

  const [currentPath, setCurrentPath] = useState(getInitialPath);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [pendingScheduledLesson, setPendingScheduledLesson] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [userRole, setUserRole] = useState(() => localStorage.getItem('lumi-role') || 'student'); // 'student', 'teacher', or 'admin'
  const [lessonLanguage, setLessonLanguage] = useState(() => localStorage.getItem('lumi-lesson-language') === 'sq' ? 'sq' : 'en');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lumi-current-user') || 'null');
      return saved && typeof saved === 'object'
        ? { name: saved.name || '', email: saved.email || '' }
        : { name: '', email: '' };
    } catch {
      return { name: '', email: '' };
    }
  });
  const mainContentRef = useRef(null);

  const handleLogin = (user) => {
    if (user?.role) handleSetUserRole(user.role);
    const loginUser = { name: user?.name || '', email: user?.email || '' };
    setCurrentUser(loginUser);
    localStorage.setItem('lumi-current-user', JSON.stringify(loginUser));
    handleNavigate('dashboard');
  };

  const handleNavigate = (path) => {
    if (path !== 'lesson-plans') setPendingScheduledLesson(null);
    setCurrentPath(path);
    if (typeof window !== 'undefined') {
      if (path === 'login') {
        setCurrentUser({ name: '', email: '' });
        localStorage.removeItem('lumi-current-user');
        window.history.pushState({}, '', '/login');
      } else if (window.location.pathname.replace(/^\/+|\/+$/g, '') === 'login') {
        window.history.pushState({}, '', '/');
      }
    }
  };

  useEffect(() => {
    const handleUrlChange = () => {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (pathname === 'login' || window.location.hash === '#/login' || window.location.hash === '#login') {
        setCurrentPath('login');
      } else if (currentPath === 'login') {
        setCurrentPath('dashboard');
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, [currentPath]);

  const handleSetUserRole = (newRole) => {
    setUserRole(newRole);
    localStorage.setItem('lumi-role', newRole);
    if (newRole === 'student' && ['staff', 'teachers', 'students', 'student-overview', 'resources', 'lesson-plans', 'lesson-plans-settings'].includes(currentPath)) {
      setPendingScheduledLesson(null);
      setCurrentPath('dashboard');
    } else if (newRole !== 'student' && currentPath === 'transcript') {
      setCurrentPath('dashboard');
    }
  };

  const [studentReturnPath, setStudentReturnPath] = useState('students');

  useEffect(() => {
    const savedTheme = localStorage.getItem('lumi-theme');
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  // Reset scroll position on every page navigation
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentPath]);


  const addNotification = (type, message) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, type, message }]);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Mock data for search fallback
  const classes = [
    { id: 1, name: 'Advanced Mathematics', code: 'MATH-301', grade: '10A', teacher: 'Dr. Sarah Smith', students: 24 },
    { id: 2, name: 'World History', code: 'HIST-202', grade: '9B', teacher: 'Mr. David Clark', students: 18 },
    { id: 3, name: 'Digital Arts', code: 'ART-110', grade: '11C', teacher: 'Ms. Emily Brown', students: 15 },
    { id: 4, name: 'Physics 101', code: 'PHYS-401', grade: '12A', teacher: 'Prof. James Wilson', students: 20 },
  ];

  const events = [
    { id: 1, title: 'Annual Science Fair', date: '2026-10-15', location: 'Gymnasium' },
    { id: 2, title: 'Parent-Teacher Meeting', date: '2026-10-20', location: 'Hall A' },
    { id: 3, title: 'Basketball Finals', date: '2026-10-22', location: 'Sports Campus' },
    { id: 4, title: 'Winter Gala', date: '2026-12-05', location: 'Auditorium' },
  ];

  const renderPage = () => {
    // Role-based UI access. This local preview is not server-side authorization.
    if (userRole === 'student') {
      if (['staff', 'teachers', 'students', 'student-overview', 'resources', 'lesson-plans', 'lesson-plans-settings'].includes(currentPath)) {
        return <Dashboard onNavigate={setCurrentPath} userRole={userRole} />;
      }
    }

    switch (currentPath) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPath} userRole={userRole} />;
      case 'students':
        return (
          <Students 
            onStudentSelect={(s) => { 
              setSelectedStudent(s); 
              setStudentReturnPath('students');
              setCurrentPath('student-overview'); 
            }}
            userRole={userRole}
          />
        );
      case 'staff':
      case 'teachers':
        return <Staff userRole={userRole} onNavigate={setCurrentPath} />;
      case 'classes':
        return <Classes 
          userRole={userRole}
          onClassSelect={(classData) => {
            setSelectedClass(classData);
            setCurrentPath('class-overview');
          }} 
        />;
      case 'class-overview':
        return <ClassOverview 
          classData={selectedClass} 
          userRole={userRole}
          onBack={() => setCurrentPath('classes')}
          onStudentSelect={(s) => { 
            if (userRole !== 'student') {
              setSelectedStudent(s); 
              setStudentReturnPath('class-overview');
              setCurrentPath('student-overview'); 
            }
          }}
        />;
      case 'student-overview':
        return <StudentOverview
          student={selectedStudent}
          onBack={() => setCurrentPath(studentReturnPath || 'students')}
        />;
      case 'tasks':
        return <Tasks userRole={userRole} />;
      case 'lesson-plans':
      case 'lesson-plans-settings':
        return <LessonPlans key={currentPath} initialView={currentPath === 'lesson-plans-settings' ? 'settings' : 'plans'} userRole={userRole} currentUser={{ ...currentUser, role: userRole }} language={lessonLanguage} onLanguageChange={(next) => { setLessonLanguage(next); localStorage.setItem('lumi-lesson-language', next); }} scheduledLesson={currentPath === 'lesson-plans' ? pendingScheduledLesson : null} onScheduledLessonConsumed={() => setPendingScheduledLesson(null)} />;
      case 'transcript':
        return userRole === 'student' ? <Transcript userRole={userRole} /> : <Dashboard onNavigate={setCurrentPath} userRole={userRole} />;
      case 'leaderboard':
        return (
          <Leaderboard 
            userRole={userRole}
            onStudentSelect={(s) => {
              if (userRole !== 'student') {
                setSelectedStudent(s); 
                setStudentReturnPath('leaderboard');
                setCurrentPath('student-overview');
              }
            }} 
          />
        );
      case 'events':
        return <Events userRole={userRole} />;
      case 'schedule':
        return <Schedule userRole={userRole} lessonLanguage={lessonLanguage} onCreateLessonPlan={(scheduledLesson) => { setPendingScheduledLesson(scheduledLesson); setCurrentPath('lesson-plans'); }} />;
      case 'messages':
        return <Messages userRole={userRole} />;
      case 'settings':
        return (
          <Settings 
            addNotification={addNotification} 
            userRole={userRole} 
            lessonLanguage={lessonLanguage}
            setUserRole={handleSetUserRole} 
            onNavigate={handleNavigate}
            onLogout={() => handleNavigate('login')}
          />
        );
      case 'resources':
        return <Resources />;
      case 'mood-insights':
        return <MoodInsights />;
      case 'login':
        return (
          <Login 
            onLogin={handleLogin}
            onNavigate={handleNavigate}
            addNotification={addNotification}
          />
        );
      default:
        return <Dashboard onNavigate={handleNavigate} userRole={userRole} />;
    }
  };

  if (currentPath === 'login') {
    return (
      <SchoolDataProvider>
        <MoodProvider>
          <Login 
            onLogin={handleLogin}
            onNavigate={handleNavigate}
            addNotification={addNotification}
          />
          <NotificationContainer 
            notifications={notifications} 
            removeNotification={removeNotification} 
          />
        </MoodProvider>
      </SchoolDataProvider>
    );
  }

  return (
    <SchoolDataProvider>
      <MoodProvider>
        <div className="app-container">
          <StarryBackground />
          <Sidebar currentPath={currentPath} onNavigate={handleNavigate} userRole={userRole} lessonLanguage={lessonLanguage} />
          <main className="main-content" ref={mainContentRef}>
            {currentPath !== 'messages' && (
              <header className="main-header">
                <div className="header-search glass" onClick={() => setIsSearchOpen(true)}>
                  <input 
                    type="text" 
                    placeholder={userRole === 'student' ? 'Search your classes, assignments, campus events...' : 'Search for students, staff, classes, events...'} 
                    readOnly 
                  />
                </div>
                <div className="header-actions">
                  <button className="notification-btn bouncy" onClick={() => addNotification('info', userRole === 'student' ? 'No urgent homework alerts today ✨' : 'No new alerts at this time ✨')} title="Notifications">🔔</button>
                  <div className="date-display">
                    <Calendar size={15} className="date-icon" />
                    <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              </header>
            )}
            <div className={`page-container ${currentPath === 'messages' ? 'full-messages-view' : ''}`}>
              {renderPage()}
            </div>
          </main>


          <SearchOverlay 
            isOpen={isSearchOpen} 
            onClose={() => setIsSearchOpen(false)} 
            classes={classes}
            events={events}
            onNavigate={handleNavigate}
            userRole={userRole}
          />

          <NotificationContainer 
            notifications={notifications} 
            removeNotification={removeNotification} 
          />

          <QuickAction 
            addNotification={addNotification} 
            onNavigate={handleNavigate} 
            userRole={userRole} 
            currentPath={currentPath}
          />

        </div>
      </MoodProvider>
    </SchoolDataProvider>
  );
}

export default App;
