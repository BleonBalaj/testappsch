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
import SchoolSwitcher from './components/SchoolSwitcher';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { MoodProvider } from './context/MoodContext';
import { SchoolDataProvider, useSchoolData } from './context/SchoolDataContext';
import { TasksProvider } from './context/TasksContext';
import { Calendar, Sparkles, School, Plus, LogOut } from 'lucide-react';
import './App.css';

function AppContent() {
  const { currentUser, currentRole, activeSchoolId, activeSchool, authLoading, schoolLinks, schoolLinksLoaded, createNewSchool, logoutUser } = useAuth();
  const { language, t } = useLanguage();
  const { classesList = [], eventsList = [] } = useSchoolData();

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
  const [lessonLanguage, setLessonLanguage] = useState(() => localStorage.getItem('lumi-lesson-language') === 'sq' ? 'sq' : 'en');
  
  useEffect(() => {
    if (language) {
      setLessonLanguage(language);
    }
  }, [language]);

  const mainContentRef = useRef(null);

  // The active role strictly tracks currentRole attached to active school membership
  const userRole = currentRole || 'student';

  // Route protection based on role
  useEffect(() => {
    if (userRole === 'student' && ['staff', 'teachers', 'students', 'student-overview', 'resources', 'lesson-plans', 'lesson-plans-settings'].includes(currentPath)) {
      setPendingScheduledLesson(null);
      setCurrentPath('dashboard');
    }
  }, [userRole, currentPath]);

  const handleNavigate = (path) => {
    if (path !== 'lesson-plans') setPendingScheduledLesson(null);
    setCurrentPath(path);
    if (typeof window !== 'undefined') {
      if (path === 'login') {
        window.history.pushState({}, '', '/login');
      } else if (window.location.pathname.replace(/^\/+|\/+$/g, '') === 'login') {
        window.history.pushState({}, '', '/');
      }
    }
  };

  // Handle redirect if not logged in
  useEffect(() => {
    if (!authLoading && !currentUser && currentPath !== 'login') {
      handleNavigate('login');
    } else if (!authLoading && currentUser && currentPath === 'login') {
      handleNavigate('dashboard');
    }
  }, [currentUser, authLoading, currentPath]);

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

  const [studentReturnPath, setStudentReturnPath] = useState('students');

  useEffect(() => {
    const savedTheme = localStorage.getItem('lumi-theme');
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  // Reset scroll position on every page navigation (AGENTS.md)
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

  // 1. Initial loading screen (auth resolving or waiting for initial school links)
  if (authLoading || (currentUser && !schoolLinksLoaded && schoolLinks.length === 0)) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        gap: '1rem'
      }}>
        <Sparkles size={36} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Connecting to Noesis Horizon Cloud...</span>
      </div>
    );
  }

  // 2. Unauthenticated user
  if (!currentUser) {
    return <Login onLogin={() => handleNavigate('dashboard')} onNavigate={handleNavigate} addNotification={addNotification} />;
  }

  // 3. No-school screen: user is logged in, school links definitively verified loaded, and strictly 0 schools
  if (currentPath !== 'login' && schoolLinksLoaded && schoolLinks.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        gap: '1.5rem',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <StarryBackground />
        <div style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsla(var(--border), 0.75)',
          borderRadius: '1.5rem',
          padding: '2.5rem 2rem',
          maxWidth: '440px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
          position: 'relative',
          zIndex: 10
        }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: '1rem',
            background: 'hsla(var(--primary), 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <School size={32} style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              You're not part of any school
            </h2>
            <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Your account ({currentUser.email}) is not currently connected to any school organization.
              This can happen if you were removed from a school by an administrator.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', display: 'flex', alignItems: 'center' }}
              onClick={async () => {
                const name = prompt('Enter a name for your new school organization:');
                if (!name?.trim()) return;
                try {
                  await createNewSchool(name.trim());
                } catch (e) {
                  alert('Failed to create school: ' + e.message);
                }
              }}
            >
              <Plus size={18} />
              Create a New School
            </button>
            <button
              className="btn-secondary glass"
              style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', display: 'flex', alignItems: 'center' }}
              onClick={async () => {
                if (logoutUser) await logoutUser();
                handleNavigate('login');
              }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
        <NotificationContainer notifications={notifications} removeNotification={removeNotification} />
      </div>
    );
  }

  const renderPage = () => {
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
            addNotification={addNotification}
          />
        );
      case 'staff':
      case 'teachers':
        return <Staff userRole={userRole} onNavigate={setCurrentPath} addNotification={addNotification} />;
      case 'classes':
        return <Classes 
          userRole={userRole}
          addNotification={addNotification}
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
        return (
          <LessonPlans 
            key={`${currentPath}-${activeSchoolId}`} 
            initialView={currentPath === 'lesson-plans-settings' ? 'settings' : 'plans'} 
            userRole={userRole} 
            currentUser={{ uid: currentUser?.uid, name: currentUser?.displayName, email: currentUser?.email, role: userRole }} 
            language={lessonLanguage} 
            onLanguageChange={(next) => { setLessonLanguage(next); localStorage.setItem('lumi-lesson-language', next); }} 
            scheduledLesson={currentPath === 'lesson-plans' ? pendingScheduledLesson : null} 
            onScheduledLessonConsumed={() => setPendingScheduledLesson(null)} 
          />
        );
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
        return <Schedule userRole={userRole} lessonLanguage={language} onCreateLessonPlan={(scheduledLesson) => { setPendingScheduledLesson(scheduledLesson); setCurrentPath('lesson-plans'); }} />;
      case 'messages':
        return <Messages userRole={userRole} />;
      case 'settings':
        return (
          <Settings 
            addNotification={addNotification} 
            userRole={userRole} 
            lessonLanguage={language}
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
            onLogin={() => handleNavigate('dashboard')}
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
      <div className="login-root-container">
        <Login 
          onLogin={() => handleNavigate('dashboard')}
          onNavigate={handleNavigate}
          addNotification={addNotification}
        />
        <NotificationContainer 
          notifications={notifications} 
          removeNotification={removeNotification} 
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      <StarryBackground />
      <Sidebar 
        currentPath={currentPath} 
        onNavigate={handleNavigate} 
        userRole={userRole} 
        lessonLanguage={language} 
      />
      <main className="main-content" ref={mainContentRef}>
        {currentPath !== 'messages' && (
          <header className="main-header">
            <div className="header-search glass" onClick={() => setIsSearchOpen(true)}>
              <input 
                type="text" 
                placeholder={t('header.searchPlaceholder')} 
                readOnly 
              />
            </div>
            <div className="header-actions">
              <SchoolSwitcher addNotification={addNotification} />
              <button 
                type="button" 
                className="notification-btn bouncy" 
                onClick={() => addNotification('info', userRole === 'student' ? 'No urgent homework alerts today ✨' : 'No new alerts at this time ✨')} 
                title="Notifications"
              >
                🔔
              </button>
              <div className="date-display">
                <Calendar size={15} className="date-icon" />
                <span>
                  {language === 'sq' ? (() => {
                    const d = new Date();
                    const albanianDays = ['E Diel', 'E Hënë', 'E Martë', 'E Mërkurë', 'E Enjte', 'E Premte', 'E Shtunë'];
                    const albanianMonths = ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Korr', 'Gush', 'Sht', 'Tet', 'Nën', 'Dhj'];
                    return `${albanianDays[d.getDay()]}, ${d.getDate()} ${albanianMonths[d.getMonth()]}`;
                  })() : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
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
        classes={classesList}
        events={eventsList}
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <SchoolDataProvider>
          <TasksProvider>
            <MoodProvider>
              <AppContent />
            </MoodProvider>
          </TasksProvider>
        </SchoolDataProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
