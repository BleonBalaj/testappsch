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
import SearchOverlay from './components/SearchOverlay';
import NotificationContainer from './components/Notification';
import QuickAction from './components/QuickAction';
import { MoodProvider } from './context/MoodContext';
import { SchoolDataProvider } from './context/SchoolDataContext';
import { Calendar } from 'lucide-react';
import './App.css';

function App() {
  const [currentPath, setCurrentPath] = useState('dashboard');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [userRole, setUserRole] = useState('admin'); // 'admin' or 'teacher'
  const mainContentRef = useRef(null);

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
        return <Classes onClassSelect={(classData) => {
          setSelectedClass(classData);
          setCurrentPath('class-overview');
        }} />;
      case 'class-overview':
        return <ClassOverview 
          classData={selectedClass} 
          onBack={() => setCurrentPath('classes')}
          onStudentSelect={(s) => { 
            setSelectedStudent(s); 
            setStudentReturnPath('class-overview');
            setCurrentPath('student-overview'); 
          }}
        />;
      case 'student-overview':
        return <StudentOverview
          student={selectedStudent}
          onBack={() => setCurrentPath(studentReturnPath || 'students')}
        />;
      case 'tasks':
        return <Tasks />;
      case 'leaderboard':
        return (
          <Leaderboard 
            onStudentSelect={(s) => {
              setSelectedStudent(s);
              setStudentReturnPath('leaderboard');
              setCurrentPath('student-overview');
            }} 
          />
        );
      case 'events':
        return <Events />;
      case 'schedule':
        return <Schedule />;
      case 'messages':
        return <Messages userRole={userRole} />;
      case 'settings':
        return <Settings addNotification={addNotification} userRole={userRole} setUserRole={setUserRole} />;
      case 'resources':
        return <Resources />;
      case 'mood-insights':
        return <MoodInsights />;
      default:
        return <Dashboard onNavigate={setCurrentPath} userRole={userRole} />;
    }
  };

  return (
    <SchoolDataProvider>
      <MoodProvider>
        <div className="app-container">
          <StarryBackground />
          <Sidebar currentPath={currentPath} onNavigate={setCurrentPath} userRole={userRole} />
          <main className="main-content" ref={mainContentRef}>
            {currentPath !== 'messages' && (
              <header className="main-header">
                <div className="header-search glass" onClick={() => setIsSearchOpen(true)}>
                  <input type="text" placeholder="Search for students, staff, classes, events..." readOnly />
                </div>
                <div className="header-actions">
                  <button className="notification-btn bouncy" onClick={() => addNotification('info', 'No new alerts at this time ✨')} title="Notifications">🔔</button>
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
            onNavigate={setCurrentPath}
          />

          <NotificationContainer 
            notifications={notifications} 
            removeNotification={removeNotification} 
          />

          <QuickAction 
            addNotification={addNotification} 
            onNavigate={setCurrentPath} 
            userRole={userRole} 
            currentPath={currentPath}
          />

        </div>
      </MoodProvider>
    </SchoolDataProvider>
  );
}

export default App;
