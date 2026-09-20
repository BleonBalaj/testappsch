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
import './Sidebar.css';

const SidebarItem = ({ icon: IconComponent, label, active, onClick, collapsed }) => {
  return (
    <motion.div
      className={`sidebar-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
      onClick={onClick}
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

const Sidebar = ({ currentPath, onNavigate, userRole = 'admin' }) => {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'classes', label: 'Classes', icon: Book },
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
    return currentPath === id;
  };

  const isAdmin = userRole === 'admin';
  const isStudent = userRole === 'student';

  const visibleMenuItems = menuItems.filter(item => {
    if (item.studentOnly && !isStudent) return false;
    if (isStudent) {
      return item.id !== 'students' && item.id !== 'staff' && item.id !== 'resources';
    }
    return true;
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
              LumiSchool
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
            <Avatar alt={isStudent ? 'Aria Montgomery' : isAdmin ? 'Admin User' : 'Prof. Wilson'} />
          </div>
          {!collapsed && (
            <div className="user-info">
              <p className="user-name">
                {isStudent ? 'Aria Montgomery' : isAdmin ? 'Admin User' : 'Prof. Wilson'}
              </p>
              <p className="user-role">
                {isStudent ? 'Grade 10 • Student' : isAdmin ? 'Super Admin' : 'Senior Teacher'}
              </p>
            </div>
          )}
          <button 
            type="button" 
            className="sidebar-logout-btn bouncy" 
            onClick={() => onNavigate && onNavigate('login')} 
            title="Go to Login / Sign In"
            aria-label="Login Page"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
