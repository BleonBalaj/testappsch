import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  CheckSquare, 
  BarChart3, 
  GraduationCap, 
  MessageSquare, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  School, 
  Lock, 
  Mail, 
  User, 
  Moon, 
  Sun, 
  Laptop, 
  Sparkles,
  ArrowLeft,
  X,
  KeyRound
} from 'lucide-react';
import StarryBackground from '../components/StarryBackground';
import './Login.css';

export const Login = ({ onLogin, onNavigate, addNotification }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  // Real theme mode: 'dark', 'light', or 'system'
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('lumi-theme-mode') || (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  });

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState('student');

  useEffect(() => {
    const handleExternalTheme = () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      setCurrentTheme(isLight ? 'light' : 'dark');
    };
    window.addEventListener('themechange', handleExternalTheme);
    return () => window.removeEventListener('themechange', handleExternalTheme);
  }, []);

  const handleApplyTheme = (mode) => {
    setCurrentTheme(mode);
    localStorage.setItem('lumi-theme-mode', mode);

    let isLight = false;
    if (mode === 'system') {
      isLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    } else {
      isLight = mode === 'light';
    }

    if (isLight) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('lumi-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('lumi-theme', 'dark');
    }

    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: isLight ? 'light' : 'dark' } }));
    window.dispatchEvent(new Event('userSettingsChanged'));

    if (addNotification) {
      addNotification('info', `Switched theme to ${mode.charAt(0).toUpperCase() + mode.slice(1)} ✨`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const user = {
        name: fullName.trim() || (selectedRole === 'student' ? 'Aria Montgomery' : 'Prof. Wilson'),
        email: email.trim() || (selectedRole === 'student' ? 'aria.montgomery@lumischool.edu' : 'j.wilson@lumischool.edu'),
        role: selectedRole,
      };

      if (addNotification) {
        addNotification('success', `Welcome back, ${user.name}! ✨ Successfully signed in.`);
      }
      if (onLogin) {
        onLogin(user);
      } else if (onNavigate) {
        onNavigate('dashboard');
      }
    }, 550);
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    if (addNotification) {
      addNotification('info', `Password recovery link dispatched to ${forgotEmail} 💌`);
    }
    setIsForgotModalOpen(false);
    setForgotEmail('');
  };

  // Real LumiSchool features present in the app
  const appFeatures = [
    {
      id: 1,
      icon: Calendar,
      title: 'Interactive Schedule',
      desc: 'Follow live period timings, countdowns, and classroom room assignments seamlessly.',
    },
    {
      id: 2,
      icon: CheckSquare,
      title: 'Smart Task Management',
      desc: 'Organize to-dos, prioritize homework assignments, and meet all your deadlines.',
    },
    {
      id: 3,
      icon: BarChart3,
      title: 'Mood Insights & Wellness',
      desc: 'Track daily emotional well-being, log reflections, and monitor campus health trends.',
    },
    {
      id: 4,
      icon: GraduationCap,
      title: 'Academic Transcripts',
      desc: 'Monitor GPA progression, subject credits, and official academic report cards.',
    },
    {
      id: 5,
      icon: MessageSquare,
      title: 'Campus Messages & Notices',
      desc: 'Direct communication with faculty advisors, study groups, and campus announcements.',
    },
  ];

  return (
    <div className="login-viewport" id="login-page-view">
      {/* Background Stars Canvas */}
      <StarryBackground />

      {/* Top & Bottom Screen Fade Out Effects */}
      <div className="screen-fade-top" aria-hidden="true" />
      <div className="screen-fade-bottom" aria-hidden="true" />

      <main className="login-container" id="login-main-container">
        {/* ──────── LEFT COLUMN: BRANDING & GLOWING GLASSY FEATURE CARD ──────── */}
        <section className="login-left-col" id="login-left-column">
          {/* Header Branding */}
          <div className="login-brand-header">
            <div className="login-logo-badge bouncy">
              <School size={28} />
            </div>
            <div className="brand-title-wrap">
              <span className="brand-title gradient-text">LumiSchool</span>
            </div>
          </div>

          {/* Glassy Feature Showcase Card with Refracting Ambient Orbs */}
          <div className="features-card-wrapper" id="login-features-wrapper">
            <div className="features-glass-glow-wrap" aria-hidden="true">
              <div className="glass-orb orb-pink" />
              <div className="glass-orb orb-purple" />
              <div className="glass-orb orb-cyan" />
            </div>

            <motion.div 
              className="login-features-card"
              id="login-showcase-card"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <div className="features-card-header">
                <h2 className="features-headline">
                  Chart Your Learning, Ignite Your Potential.
                </h2>
                <p className="features-subhead">
                  Your command center for academic excellence & student life.
                </p>
              </div>

              <div className="features-items-list">
                {appFeatures.map((feat) => {
                  const IconComponent = feat.icon;
                  return (
                    <div key={feat.id} className="feature-item-row">
                      <div className="feature-icon-pill">
                        <IconComponent size={19} />
                      </div>
                      <div className="feature-item-content">
                        <span className="feature-title-bold">{feat.title}: </span>
                        <span className="feature-desc-text">{feat.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* Functional Theme Selector Dock (Left Bottom) */}
          <div className="login-theme-dock" id="login-theme-selector-dock" title="Select Theme">
            <button
              type="button"
              id="theme-dark-btn"
              className={`theme-dock-btn ${currentTheme === 'dark' ? 'active' : ''}`}
              onClick={() => handleApplyTheme('dark')}
              title="Dark Cosmic Theme"
              aria-label="Dark Theme"
            >
              <Moon size={16} />
              <span>Dark</span>
            </button>
            <button
              type="button"
              id="theme-light-btn"
              className={`theme-dock-btn ${currentTheme === 'light' ? 'active' : ''}`}
              onClick={() => handleApplyTheme('light')}
              title="Light Lilac Theme"
              aria-label="Light Theme"
            >
              <Sun size={16} />
              <span>Light</span>
            </button>
            <button
              type="button"
              id="theme-system-btn"
              className={`theme-dock-btn ${currentTheme === 'system' ? 'active' : ''}`}
              onClick={() => handleApplyTheme('system')}
              title="System Default Theme"
              aria-label="System Theme"
            >
              <Laptop size={16} />
              <span>Auto</span>
            </button>
          </div>
        </section>

        {/* ──────── RIGHT COLUMN: AUTHENTICATION CARD ──────── */}
        <section className="login-right-col" id="login-right-column">
          <motion.div 
            className="login-auth-card glass"
            id="login-auth-details-card"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          >
            {/* Glowing Cursive Welcome Header */}
            <header className="auth-card-header">
              <h1 className="login-welcome-cursive">Welcome</h1>
              <p className="auth-card-subtitle">
                {isSignUp ? 'Create your school account to get started' : 'Sign in or create an account to continue'}
              </p>
            </header>

            {/* Pill Tab Switcher: Sign In vs Sign Up */}
            <div className="auth-tab-pill-container" id="auth-tab-selector">
              <button
                type="button"
                id="tab-signin-btn"
                className={`auth-tab-button ${!isSignUp ? 'active' : ''}`}
                onClick={() => setIsSignUp(false)}
              >
                Sign In
              </button>
              <button
                type="button"
                id="tab-signup-btn"
                className={`auth-tab-button ${isSignUp ? 'active' : ''}`}
                onClick={() => setIsSignUp(true)}
              >
                Sign Up
              </button>
              <motion.div 
                className="auth-tab-slider"
                animate={{ x: isSignUp ? '100%' : '0%' }}
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            </div>

            {/* Form */}
            <form className="auth-form-fields" onSubmit={handleSubmit} id="login-auth-form">
              {isSignUp && (
                <>
                  <div className="auth-input-group">
                    <label className="auth-input-label" htmlFor="input-fullname">Full Name</label>
                    <div className="auth-input-wrapper">
                      <User size={18} className="auth-field-icon" />
                      <input
                        id="input-fullname"
                        type="text"
                        className="auth-text-input has-icon"
                        placeholder="e.g. Aria Montgomery"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={isSignUp}
                      />
                    </div>
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-input-label">Select Account Role</label>
                    <div className="auth-role-chips-row">
                      <button
                        type="button"
                        className={`auth-role-chip ${selectedRole === 'student' ? 'selected' : ''}`}
                        onClick={() => setSelectedRole('student')}
                      >
                        🎓 Student
                      </button>
                      <button
                        type="button"
                        className={`auth-role-chip ${selectedRole === 'teacher' ? 'selected' : ''}`}
                        onClick={() => setSelectedRole('teacher')}
                      >
                        👨‍🏫 Teacher
                      </button>
                      <button
                        type="button"
                        className={`auth-role-chip ${selectedRole === 'admin' ? 'selected' : ''}`}
                        onClick={() => setSelectedRole('admin')}
                      >
                        🛡️ Admin
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="auth-input-group">
                <label className="auth-input-label" htmlFor="input-email">Email</label>
                <div className="auth-input-wrapper">
                  <Mail size={18} className="auth-field-icon" />
                  <input
                    id="input-email"
                    type="email"
                    className="auth-text-input has-icon"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-input-label" htmlFor="input-password">Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={18} className="auth-field-icon" />
                  <input
                    id="input-password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-text-input has-icon has-toggle"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-reveal-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {!isSignUp && (
                <div className="auth-options-row">
                  <label className="remember-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="auth-checkbox"
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="forgot-link-btn"
                    onClick={() => setIsForgotModalOpen(true)}
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                id="submit-auth-btn"
                className="btn-primary-auth"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Sparkles size={18} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {/* Back / Navigation to Dashboard Link */}
            <div className="auth-back-nav">
              <button
                type="button"
                className="back-dashboard-btn"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('dashboard');
                  } else {
                    window.location.href = '/';
                  }
                }}
              >
                <ArrowLeft size={16} />
                <span>Return to School Dashboard</span>
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ──────── FORGOT PASSWORD MODAL ──────── */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <div className="modal-overlay" onClick={() => setIsForgotModalOpen(false)}>
            <div className="modal-content auth-dialog" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsForgotModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>

              <div className="dialog-header-row">
                <div className="dialog-icon-badge">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="dialog-title">Reset Password</h3>
                  <p className="dialog-subtitle">
                    Enter your school email address to receive password reset instructions.
                  </p>
                </div>
              </div>

              <form onSubmit={handleForgotSubmit} className="auth-form-fields" style={{ marginTop: '1.25rem' }}>
                <div className="auth-input-group">
                  <label className="auth-input-label">Email Address</label>
                  <div className="auth-input-wrapper">
                    <Mail size={18} className="auth-field-icon" />
                    <input
                      type="email"
                      className="auth-text-input has-icon"
                      placeholder="name@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="dialog-actions-row">
                  <button
                    type="button"
                    className="btn-cancel-dialog"
                    onClick={() => setIsForgotModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-auth"
                    style={{ width: 'auto', padding: '0.75rem 1.6rem', marginTop: 0 }}
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
