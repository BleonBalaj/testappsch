import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  UserSquare2, 
  Calendar, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  School,
  MessageSquare,
  Book,
  BookOpen,
  Trophy,
  CalendarDays,
  CheckSquare,
  Library,
  BarChart3,
  GraduationCap,
  LogOut
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { useAuth } from '../context/AuthContext';
import { useSchoolData, DEFAULT_ROLE_PERMISSIONS } from '../context/SchoolDataContext';
import './Sidebar.css';

const SidebarItem = ({ icon: IconComponent, label, active, onClick, collapsed }) => {
  return (
    <motion.div
      className={`sidebar-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={label}
      whileHover={{ scale: 1.02, x: 5 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="icon-wrapper">
        {React.createElement(IconComponent, { size: 22 })}
      </div>
      {!collapsed && <span className="label">{label}</span>}
      {active && <motion.div className="active-indicator" layoutId="active-pill" />}
    </motion.div>
  );
};

const Sidebar = ({ currentPath, onNavigate, userRole = 'admin', lessonLanguage = 'en' }) => {
  const { currentUser, currentRole, activeSchool, logoutUser } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'classes', label: 'Classes', icon: Book },
    { id: 'lesson-plans', label: lessonLanguage === 'sq' ? 'Planifikimi mësimor' : 'Lesson planning', icon: BookOpen, teacherAndAdminOnly: true },
    { id: 'transcript', label: 'Transcript', icon: GraduationCap, studentOnly: true },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'staff', label: 'Staff Directory', icon: UserSquare2 },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'events', label: 'Events Center', icon: CalendarDays },
    { id: 'resources', label: 'Resource Hub', icon: Library },
    { id: 'mood-insights', label: 'Mood Insights', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isItemActive = (id) => {
    if (id === 'staff') return currentPath === 'staff' || currentPath === 'teachers';
    if (id === 'students') return currentPath === 'students' || currentPath === 'student-overview';
    if (id === 'classes') return currentPath === 'classes' || currentPath === 'class-overview';
    if (id === 'lesson-plans') return currentPath === 'lesson-plans' || currentPath === 'lesson-plans-settings';
    return currentPath === id;
  };

  const { rolePermissions } = useSchoolData();
  const isAdmin = userRole === 'admin';
  const isStudent = userRole === 'student';

  const visibleMenuItems = menuItems.filter(item => {
    // Settings is always accessible to manage profile
    if (item.id === 'settings') return true;
    
    // Admins always see all management and school areas
    if (isAdmin) {
      if (item.studentOnly) return false;
      return true;
    }

    if (isStudent) {
      const allowed = rolePermissions?.student?.[item.id] ?? DEFAULT_ROLE_PERMISSIONS.student[item.id];
      return Boolean(allowed);
    }

    // Teacher
    const allowed = rolePermissions?.teacher?.[item.id] ?? DEFAULT_ROLE_PERMISSIONS.teacher[item.id];
    return Boolean(allowed);
  });

  return (
    <motion.aside 
      className={`sidebar glass ${collapsed ? 'collapsed' : ''}`}
      animate={{ width: collapsed ? 80 : 250 }}
      transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
    >
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon bouncy">
            <School size={28} color="hsl(var(--primary))" />
          </div>
          {!collapsed && (
            <motion.span 
              className="logo-text gradient-text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Noesis Horizon
            </motion.span>
          )}
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <div className="sidebar-nav-wrap">
        <nav className="sidebar-nav">
          {visibleMenuItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={isItemActive(item.id)}
              onClick={() => onNavigate(item.id)}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar">
            <Avatar 
              src={currentUser?.photoURL} 
              alt={currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'User')} 
            />
          </div>
          {!collapsed && (
            <div className="user-info">
              <p className="user-name">
                {currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'User')}
              </p>
              <p className="user-role">
                {isStudent ? 'Student' : currentRole === 'teacher' ? 'Teacher' : 'Administrator'}
              </p>
            </div>
          )}
          <button 
            type="button" 
            className="sidebar-logout-btn bouncy" 
            onClick={async () => {
              if (logoutUser) await logoutUser();
              if (onNavigate) onNavigate('login');
            }} 
            title="Sign Out / Switch Account"
            aria-label="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
