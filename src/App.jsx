import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import PlatformAdminRoute from './pages/PlatformAdminRoute';
import NotFound from './pages/NotFound';
import { parseAdminPath } from './features/platformAdmin/route';
import { detailParent, pageFromLocation, pathForPage } from './features/navigation/pageRoutes';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { MoodProvider } from './context/MoodContext';
import { SchoolDataProvider, useSchoolData, DEFAULT_ROLE_PERMISSIONS } from './context/SchoolDataContext';
import { TasksProvider } from './context/TasksContext';
import { Calendar, Sparkles, School, Plus, LogOut } from 'lucide-react';
import './App.css';

function AppContent() {
  const { currentUser, currentRole, roleReady, activeSchoolId, activeSchool, authLoading, schoolLinks, schoolLinksLoaded, createNewSchool, logoutUser } = useAuth();
  const { language, t } = useLanguage();
  const { classesList = [], classesLoaded, studentsList = [], loading: schoolDataLoading, eventsList = [], rolePermissions } = useSchoolData();

  // The page in the address bar when the app opened (see features/navigation/pageRoutes).
  const [initialRoute] = useState(() => pageFromLocation(window.location.pathname, window.location.hash) || { page: 'not-found' });
  const [currentPath, setCurrentPath] = useState(() => detailParent(initialRoute.page) || initialRoute.page);
  // A /classes/<id> or /students/<id> link waiting for its record to load.
  const [pendingDetail, setPendingDetail] = useState(() => (initialRoute.id !== undefined ? initialRoute : null));
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
  const previousSchoolIdRef = useRef(activeSchoolId);

  useEffect(() => {
    if (previousSchoolIdRef.current && previousSchoolIdRef.current !== activeSchoolId) {
      setSelectedClass(null);
      setSelectedStudent(null);
      setCurrentPath('dashboard');
    }
    previousSchoolIdRef.current = activeSchoolId;
  }, [activeSchoolId]);

  useEffect(() => {
    if (currentPath === 'class-overview' && selectedClass && classesLoaded &&
        !classesList.some(course => String(course.id) === String(selectedClass.id))) {
      setSelectedClass(null);
      setCurrentPath('classes');
    }
  }, [currentPath, selectedClass, classesLoaded, classesList]);

  // The active role strictly tracks currentRole attached to active school membership
  const userRole = currentRole || 'student';
  // Until the membership loads the role reads as 'student'; don't redirect on it.
  const roleSettled = Boolean(schoolLinksLoaded && roleReady);

  const canAccessPath = useCallback((path) => {
    if (path === 'login' || path === 'settings' || path === 'not-found') return true;
    if (path === 'lesson-plans-settings') return userRole === 'admin';
    if (path === 'transcript') return userRole === 'student' && Boolean(rolePermissions?.student?.transcript ?? DEFAULT_ROLE_PERMISSIONS.student.transcript);
    const moduleByPath = { 'class-overview': 'classes', 'student-overview': 'students', teachers: 'staff' };
    const moduleId = moduleByPath[path] || path;
    if (moduleId === 'lesson-plans' && !['admin', 'teacher', 'dept_head'].includes(userRole)) return false;
    if (userRole === 'admin') return true;
    const permissionRole = userRole === 'student' ? 'student' : 'teacher';
    return Boolean(rolePermissions?.[permissionRole]?.[moduleId] ?? DEFAULT_ROLE_PERMISSIONS[permissionRole]?.[moduleId]);
  }, [userRole, rolePermissions]);

  // Redirects (sign-in, role guard, first load) replace the address instead of
  // adding a history entry, so Back never lands on a page that bounces again.
  const replaceUrlRef = useRef(true);
  // Page to open after signing in when the app was opened on a link while signed out.
  const deepLinkRef = useRef(['login', 'dashboard', 'not-found'].includes(initialRoute.page) ? null : initialRoute);
  const authResolvedRef = useRef(false);

  // Route protection based on role
  useEffect(() => {
    if (!roleSettled) return;
    if (!canAccessPath(currentPath)) {
      setPendingScheduledLesson(null);
      replaceUrlRef.current = true;
      setCurrentPath(canAccessPath('dashboard') ? 'dashboard' : 'settings');
    }
  }, [currentPath, canAccessPath, roleSettled]);

  const handleNavigate = (path) => {
    if (path !== 'lesson-plans') setPendingScheduledLesson(null);
    setPendingDetail(null);
    setCurrentPath(path);
  };

  const [studentReturnPath, setStudentReturnPath] = useState('students');

  const openRoute = useCallback((route) => {
    if (route.id !== undefined) {
      setCurrentPath(detailParent(route.page));
      setPendingDetail(route);
    } else {
      setPendingDetail(null);
      setCurrentPath(route.page);
    }
  }, []);

  // After signing in: the link the app was opened on, otherwise the dashboard.
  // Only acts while still on the sign-in page, so a second call is harmless.
  const openAfterLogin = useCallback(() => {
    const route = deepLinkRef.current;
    deepLinkRef.current = null;
    replaceUrlRef.current = true;
    setPendingScheduledLesson(null);
    if (route?.id !== undefined) {
      setCurrentPath(prev => (prev === 'login' ? detailParent(route.page) : prev));
      setPendingDetail(route);
    } else {
      setCurrentPath(prev => (prev === 'login' ? route?.page || 'dashboard' : prev));
    }
  }, []);

  // Handle redirect if not logged in
  useEffect(() => {
    if (authLoading) return;
    if (!authResolvedRef.current) {
      authResolvedRef.current = true;
      // Already signed in: the link is open now, nothing to restore later.
      if (currentUser) deepLinkRef.current = null;
    }
    if (!currentUser && currentPath !== 'login') {
      replaceUrlRef.current = true;
      handleNavigate('login');
    } else if (currentUser && currentPath === 'login') {
      openAfterLogin();
    }
  }, [currentUser, authLoading, currentPath, openAfterLogin]);

  // Open /classes/<id> and /students/<id> once their records have loaded.
  useEffect(() => {
    if (!pendingDetail || !currentUser) return;
    if (pendingDetail.page === 'class-overview') {
      if (!classesLoaded) return;
      const course = classesList.find(item => String(item.id) === String(pendingDetail.id));
      setPendingDetail(null);
      if (course) {
        setSelectedClass(course);
        setCurrentPath('class-overview');
      } else {
        replaceUrlRef.current = true;
      }
    } else if (pendingDetail.page === 'student-overview') {
      if (schoolDataLoading) return;
      const student = studentsList.find(item => String(item.id) === String(pendingDetail.id));
      setPendingDetail(null);
      if (student) {
        setSelectedStudent(student);
        setStudentReturnPath('students');
        setCurrentPath('student-overview');
      } else {
        replaceUrlRef.current = true;
      }
    }
  }, [pendingDetail, currentUser, classesLoaded, classesList, schoolDataLoading, studentsList]);

  // Keep the address bar in step with the page being shown.
  useEffect(() => {
    if (authLoading || pendingDetail || currentPath === 'not-found') return;
    // Wait while a redirect is about to happen.
    if (!currentUser ? currentPath !== 'login' : currentPath === 'login') return;
    if (roleSettled && !canAccessPath(currentPath)) return;
    const recordId = currentPath === 'class-overview' ? selectedClass?.id
      : currentPath === 'student-overview' ? selectedStudent?.id : undefined;
    const target = pathForPage(currentPath, recordId);
    if (target && window.location.pathname !== target) {
      window.history[replaceUrlRef.current ? 'replaceState' : 'pushState']({}, '', target);
    }
    replaceUrlRef.current = false;
  }, [authLoading, pendingDetail, currentPath, currentUser, roleSettled, canAccessPath, selectedClass?.id, selectedStudent?.id]);

  // Back / Forward buttons.
  useEffect(() => {
    const handleUrlChange = () => {
      openRoute(pageFromLocation(window.location.pathname, window.location.hash) || { page: 'not-found' });
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, [openRoute]);

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
    return <Login onLogin={openAfterLogin} onNavigate={handleNavigate} addNotification={addNotification} />;
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

  // An address that matches no page.
  if (currentPath === 'not-found') {
    return <NotFound onGoHome={() => handleNavigate('dashboard')} />;
  }

  const renderPage = () => {
    // While the role is still loading, render nothing rather than a wrong fallback.
    if (!canAccessPath(currentPath)) return roleSettled ? <Settings addNotification={addNotification} lessonLanguage={lessonLanguage} onNavigate={handleNavigate} onLogout={logoutUser} /> : null;

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
          classData={classesList.find(course => String(course.id) === String(selectedClass?.id)) || selectedClass}
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
        return <Schedule userRole={userRole} lessonLanguage={language} onOpenCourses={() => setCurrentPath('classes')} onCreateLessonPlan={(scheduledLesson) => { setPendingScheduledLesson(scheduledLesson); setCurrentPath('lesson-plans'); }} />;
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
        return <Resources userRole={userRole} />;
      case 'mood-insights':
        return <MoodInsights />;
      case 'login':
        return (
          <Login 
            onLogin={openAfterLogin}
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
          onLogin={openAfterLogin}
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

function useAdminRoute() {
  const [route, setRoute] = useState(() => parseAdminPath(window.location.pathname));
  useEffect(() => {
    const sync = () => setRoute(parseAdminPath(window.location.pathname));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  return route;
}

export default function App() {
  const adminRoute = useAdminRoute();
  return (
    <AuthProvider>
      <LanguageProvider>
        {adminRoute ? (
          <PlatformAdminRoute view={adminRoute.view} />
        ) : (
          <SchoolDataProvider>
            <TasksProvider>
              <MoodProvider>
                <AppContent />
              </MoodProvider>
            </TasksProvider>
          </SchoolDataProvider>
        )}
      </LanguageProvider>
    </AuthProvider>
  );
}
