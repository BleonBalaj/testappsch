import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Bell, Shield, Palette, Sparkles, Volume2 } from 'lucide-react';
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

const Settings = ({ addNotification, userRole, setUserRole }) => {
  const [notifications, setNotifications] = useState(true);
  const [animations, setAnimations] = useState(true);
  const [cuteMode, setCuteMode] = useState(true);
  const [lightTheme, setLightTheme] = useState(document.documentElement.getAttribute('data-theme') === 'light');
  const [volume, setVolume] = useState(65);

  const handleToggle = (setter, state, label) => {
    setter(!state);
    addNotification('success', `${label} ${!state ? 'enabled' : 'disabled'}! ✨`);
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
          <h1 className="gradient-text">Settings ⚙️</h1>
          <p>Personalize your LumiSchool experience.</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-section glass">
          <h3>Profile Settings</h3>
          <div className="profile-edit">
            <div className="avatar-large">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
              <button className="edit-badge">📷</button>
            </div>
            <div className="profile-inputs">
              <div className="input-group">
                <label>Display Name</label>
                <input type="text" defaultValue="Admin User" className="glass" />
              </div>
              <div className="input-group">
                <label>Email Address</label>
                <input type="email" defaultValue="admin@lumischool.edu" className="glass" />
              </div>
              <div className="input-group">
                <label>School</label>
                <input type="text" defaultValue="LumiSchool Academy" className="glass" />
              </div>
              <div className="input-group">
                <label>Active Role</label>
                <div className="role-pills glass">
                  <button 
                    className={`role-pill ${userRole === 'admin' ? 'active' : ''}`}
                    onClick={() => setUserRole('admin')}
                  >
                    Super Admin
                  </button>
                  <button 
                    className={`role-pill ${userRole === 'teacher' ? 'active' : ''}`}
                    onClick={() => setUserRole('teacher')}
                  >
                    Teacher
                  </button>
                  <motion.div 
                    className="role-pill-bg"
                    layoutId="role-pill-bg"
                    initial={false}
                    animate={{ x: userRole === 'admin' ? '0%' : '100%' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="role-dashboard-notice glass">
            <span className="notice-icon">🏗️</span>
            <div>
              <strong>Role-Based Dashboards</strong>
              <p>You are currently viewing the {userRole === 'admin' ? 'Admin' : 'Teacher'} dashboard. Switch roles to see personalized views.</p>
            </div>
          </div>
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
            <button className="logout-btn-large glass" onClick={() => addNotification('info', 'Logging out... ✌️')}>
              <LogOut size={20} />
              <span>Logout from LumiSchool</span>
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
};

export default Settings;
