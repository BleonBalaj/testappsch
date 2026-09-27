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
import { useLanguage } from '../context/LanguageContext';
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
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'schedule', label: t('nav.schedule'), icon: Calendar },
    { id: 'classes', label: t('nav.classes'), icon: Book },
    { id: 'lesson-plans', label: t('nav.lessonPlans'), icon: BookOpen, teacherAndAdminOnly: true },
    { id: 'transcript', label: t('nav.transcript'), icon: GraduationCap, studentOnly: true },
    { id: 'tasks', label: t('nav.tasks'), icon: CheckSquare },
    { id: 'messages', label: t('nav.messages'), icon: MessageSquare },
    { id: 'students', label: t('nav.students'), icon: Users },
    { id: 'staff', label: t('nav.staff'), icon: UserSquare2 },
    { id: 'leaderboard', label: t('nav.leaderboard'), icon: Trophy },
    { id: 'events', label: t('nav.events'), icon: CalendarDays },
    { id: 'resources', label: t('nav.resources'), icon: Library },
    { id: 'mood-insights', label: t('nav.moodInsights'), icon: BarChart3 },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
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
            <motion.div 
              className="logo-text-group"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              <span className="logo-text gradient-text">
                Noesis Horizon
              </span>
              <span className="logo-author">by Bleon</span>
            </motion.div>
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
                {isStudent ? t('nav.student') : currentRole === 'teacher' ? t('nav.teacher') : t('nav.admin')}
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
            title={t('nav.signOut')}
            aria-label={t('nav.signOut')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
