import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  LogOut, Bell, Shield, Palette, Sparkles, Volume2, 
  GraduationCap, CheckCircle2, Eye, BookOpen, Lock, 
  Calendar, CheckSquare, Settings as SettingsIcon, Camera
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import './Settings.css';

const Toggle = ({ active, onToggle, label }) => (
  <div className="toggle-wrapper" onClick={onToggle}>
    <span className="toggle-label">{label}</span>
    <div className={`toggle-track ${active ? 'active' : ''}`}>
      <motion.div 
        className="toggle-thumb"
        animate={{ x: active ? 22 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </div>
  </div>
);

const Settings = ({ addNotification, userRole, lessonLanguage = 'en', setUserRole, onNavigate, onLogout }) => {
  const [notifications, setNotifications] = useState(true);
  const [animations, setAnimations] = useState(true);
  const [cuteMode, setCuteMode] = useState(true);
  const [lightTheme, setLightTheme] = useState(document.documentElement.getAttribute('data-theme') === 'light');
  const [volume, setVolume] = useState(65);

  const handleToggle = (setter, state, label) => {
    setter(!state);
    addNotification('success', `${label} ${!state ? 'enabled' : 'disabled'}! ✨`);
  };

  const handleStudentModeToggle = () => {
    if (userRole === 'student') {
      setUserRole('admin');
      addNotification('info', 'Student Mode exited. Switched to Super Admin 🛠️');
    } else {
      setUserRole('student');
      addNotification('success', 'Student Mode enabled! Previewing student dashboard 🎓✨');
    }
  };

  const handleThemeToggle = () => {
    const newTheme = !lightTheme;
    setLightTheme(newTheme);
    if (newTheme) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('lumi-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('lumi-theme', 'dark');
    }
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: newTheme ? 'light' : 'dark' } }));
    window.dispatchEvent(new Event('userSettingsChanged'));
    addNotification('info', `Theme set to ${newTheme ? 'Light ☀️' : 'Dark 🌙'}`);
  };

  const handleSlider = (e) => {
    setVolume(e.target.value);
  };

  return (
    <motion.div 
      className="settings-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <header className="page-header">
        <div>
          <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
            Settings
            <SettingsIcon size={32} style={{ color: 'hsl(var(--primary))' }} />
          </h1>
          <p>Personalize your Noesis Horizon experience and switch role previews.</p>
        </div>
      </header>

      {/* ── Student Mode Preview Hero Card ── */}
      <section className={`student-preview-hero-card glass ${userRole === 'student' ? 'preview-active' : ''}`}>
        <div className="preview-hero-content">
          <div className="preview-hero-icon-badge">
            <GraduationCap size={28} />
          </div>
          <div className="preview-hero-text">
            <div className="preview-hero-title-row">
              <h3>Student Mode Preview</h3>
              <span className={`preview-badge-status ${userRole === 'student' ? 'active' : ''}`}>
                {userRole === 'student' ? '● Active Student Preview' : 'Inactive'}
              </span>
            </div>
            <p>
              Toggle Student Mode to preview the tailored student experience. While active, navigation to Staff Directory, Student Directory, and Resource Hub is hidden, and the dashboard prioritizes personal homework tasks, enrolled timetable, campus notices, and the "My Classes" curriculum.
            </p>
            <div className="preview-feature-tags">
              <span className="preview-pill"><CheckCircle2 size={12} /> Student Dashboard Only</span>
              <span className="preview-pill"><Lock size={12} /> Hidden Staff / Student Directories</span>
              <span className="preview-pill"><BookOpen size={12} /> "My Classes" Default Tab</span>
              <span className="preview-pill"><Calendar size={12} /> Academic Calendar & Notices</span>
              <span className="preview-pill"><CheckSquare size={12} /> Personal Tasks & Homework</span>
            </div>
          </div>
        </div>

        <div className="preview-hero-action">
          <button 
            type="button" 
            className={`btn-student-toggle ${userRole === 'student' ? 'active' : ''}`}
            onClick={handleStudentModeToggle}
          >
            <Eye size={17} />
            <span>{userRole === 'student' ? 'Exit Student Mode' : 'Enter Student Mode'}</span>
          </button>
        </div>
      </section>

      <div className="settings-grid">
        <section className="settings-section glass">
          <h3>Profile Settings</h3>
          <div className="profile-edit">
            <div className="avatar-large">
              <Avatar alt="User Profile" />
              <button className="edit-badge" title="Change Profile Picture" aria-label="Change Profile Picture">
                <Camera size={13} />
              </button>
            </div>
            <div className="profile-inputs">
              <div className="input-group">
                <label>Display Name</label>
                <input 
                  type="text" 
                  key={`name-${userRole}`}
                  defaultValue={userRole === 'student' ? 'Aria Montgomery' : 'Noesis'}
                  className="glass" 
                />
              </div>
              <div className="input-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  key={`email-${userRole}`}
                  defaultValue={userRole === 'student' ? 'aria.montgomery@lumischool.edu' : userRole === 'teacher' ? 'j.wilson@lumischool.edu' : 'admin@lumischool.edu'} 
                  className="glass" 
                />
              </div>
              <div className="input-group">
                <label>{userRole === 'student' ? 'Grade & Program' : 'School'}</label>
                <input 
                  type="text" 
                  key={`info-${userRole}`}
                  defaultValue={userRole === 'student' ? 'Grade 10 Honors • Science & Arts' : 'Noesis Horizon'}
                  className="glass" 
                />
              </div>
              <div className="input-group">
                <label>Active Role / View Mode</label>
                <div className="role-pills glass">
                  <button 
                    className={`role-pill ${userRole === 'admin' ? 'active' : ''}`}
                    onClick={() => {
                      setUserRole('admin');
                      addNotification('info', 'Switched to Super Admin Mode 🛠️');
                    }}
                  >
                    Super Admin
                  </button>
                  <button 
                    className={`role-pill ${userRole === 'teacher' ? 'active' : ''}`}
                    onClick={() => {
                      setUserRole('teacher');
                      addNotification('info', 'Switched to Teacher Mode 👨‍🏫');
                    }}
                  >
                    Teacher
                  </button>
                  <button 
                    className={`role-pill ${userRole === 'student' ? 'active' : ''}`}
                    onClick={() => {
                      setUserRole('student');
                      addNotification('success', 'Switched to Student Mode 🎓');
                    }}
                  >
                    Student
                  </button>
                  <motion.div 
                    className="role-pill-bg"
                    layoutId="role-pill-bg"
                    initial={false}
                    animate={{ x: userRole === 'admin' ? '0%' : userRole === 'teacher' ? '100%' : '200%' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="role-dashboard-notice glass">
            <span className="notice-icon">{userRole === 'student' ? '🎓' : userRole === 'teacher' ? '📚' : '🏗️'}</span>
            <div>
              <strong>Role-Based Mode: {userRole === 'student' ? 'Student Mode (Preview Active)' : userRole === 'teacher' ? 'Teacher Mode' : 'Super Admin Mode'}</strong>
              <p>
                {userRole === 'student' 
                  ? 'You are previewing the dedicated Student experience. Navigation to Staff Directory, Student Directory, and Resource Hub is hidden and access-restricted.'
                  : userRole === 'teacher'
                  ? 'You are viewing the Teacher dashboard with grading queues, assigned classes, and student submissions.'
                  : 'You are viewing the Super Admin dashboard with school-wide analytics, staff management, and system operations.'}
              </p>
            </div>
          </div>
          {userRole !== 'student' && (
            <button
              type="button"
              className="btn-secondary glass"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => onNavigate('lesson-plans-settings')}
            >
              <BookOpen size={18} />
              {lessonLanguage === 'sq' ? 'Cilësimet e planifikimit' : 'Planning settings'}
            </button>
          )}
        </section>

        <section className="settings-section glass">
          <h3>Preferences</h3>
          <div className="toggles-list">
            <Toggle 
              label="Light Theme ☀️" 
              active={lightTheme} 
              onToggle={handleThemeToggle} 
            />
            <Toggle 
              label="Push Notifications" 
              active={notifications} 
              onToggle={() => handleToggle(setNotifications, notifications, 'Notifications')} 
            />
            <Toggle 
              label="Enable Animations" 
              active={animations} 
              onToggle={() => handleToggle(setAnimations, animations, 'Animations')} 
            />
            <Toggle 
              label="Enhanced Cute Mode" 
              active={cuteMode} 
              onToggle={() => handleToggle(setCuteMode, cuteMode, 'Enhanced Cute Mode')} 
            />
          </div>
          <div className="slider-group">
            <div className="slider-header">
              <label>UI Bubble Intensity</label>
              <span>{volume}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={volume} 
              onChange={handleSlider}
              className="cute-slider"
            />
          </div>
        </section>

        <section className="settings-section glass danger-zone">
          <h3 style={{ color: 'hsl(var(--destructive))' }}>Account Security</h3>
          <p>Manage your account security and data.</p>
          <div className="actions-row">
            <button className="btn-secondary glass">Change Password</button>
            <button className="btn-primary" style={{ background: 'hsl(var(--destructive))', boxShadow: '0 4px 15px hsla(var(--destructive), 0.4)' }}>
              Deactivate Account
            </button>
          </div>
          <div className="logout-section">
            <button 
              type="button"
              className="logout-btn-large glass" 
              onClick={() => {
                if (onLogout) {
                  onLogout();
                } else {
                  addNotification('info', 'Logging out... ✌️');
                }
              }}
            >
              <LogOut size={20} />
              <span>Logout from Noesis Horizon</span>
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
};

export default Settings;
