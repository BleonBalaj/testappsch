import React, { useState, useRef } from 'react';
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
  Sparkles, 
  X, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import ThemePicker from '../components/theme/ThemePicker';
import StarryBackground from '../components/StarryBackground';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export const Login = ({ onLogin, onNavigate, addNotification }) => {
  const { 
    currentUser,
    loginUser, 
    registerNewUserAndSchool, 
    resetUserPassword
  } = useAuth();

  // Temporarily hide sign up (toggle to true when ready to re-enable)
  const SHOW_SIGNUP = false;
  // Active tab: 'signin' or 'signup'
  const [activeTab, setActiveTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [schoolName, setSchoolName] = useState('Noesis Horizon Academy');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const forgotRequest = useRef(0);

  // Sign In Handler
  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginUser(cleanEmail, password);
      if (addNotification) {
        addNotification('success', `Welcome back, ${user.displayName || user.email}! ✨`);
      }
      if (onLogin) onLogin(user);
      else if (onNavigate) onNavigate('dashboard');
    } catch (err) {
      console.error('Sign in error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMessage('Incorrect password. Please verify your credentials or recover your password.');
      } else if (err.code === 'auth/user-not-found') {
        setErrorMessage(SHOW_SIGNUP ? 'Account not found. Please verify your email or switch to Sign Up.' : 'Account not found. Please verify your email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMessage('Access temporarily blocked due to multiple failed attempts. Please reset password or wait a moment.');
      } else {
        setErrorMessage(err.message || 'Failed to sign in. Please verify your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up Handler (Enforces email-first check)
  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (!schoolName.trim()) {
      setErrorMessage('Please enter a name for your school organization.');
      return;
    }

    setIsLoading(true);
    try {
      // Firebase Auth rejects an existing email (auth/email-already-in-use),
      // which the catch below turns into the "sign in instead" message.
      const { user, school } = await registerNewUserAndSchool({
        email: cleanEmail,
        password,
        fullName: fullName.trim(),
        schoolName: schoolName.trim()
      });

      if (addNotification) {
        addNotification('success', `Welcome to Noesis Horizon! Created ${school.schoolName || schoolName} as Administrator. 🚀`);
      }
      if (onLogin) onLogin(user);
      else if (onNavigate) onNavigate('dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setActiveTab('signin');
        setInfoMessage('This account already exists in another school. Sign in or recover your account to continue.');
      } else {
        setErrorMessage(err.message || 'Failed to complete registration.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Password reset
  const closeForgotModal = () => {
    forgotRequest.current += 1;
    setForgotLoading(false);
    setIsForgotModalOpen(false);
  };
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (forgotLoading) return;
    const cleanForgotEmail = forgotEmail.trim().toLowerCase();
    setForgotError('');
    setForgotSubmitted(false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanForgotEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    const requestId = ++forgotRequest.current;
    setForgotLoading(true);
    try {
      await resetUserPassword(cleanForgotEmail);
      if (requestId !== forgotRequest.current) return;
      setForgotEmail(cleanForgotEmail);
      setForgotSubmitted(true);
      if (addNotification) {
        addNotification('info', `Password recovery link dispatched to ${cleanForgotEmail} 💌`);
      }
    } catch (err) {
      if (requestId !== forgotRequest.current) return;
      setForgotError(err.message || 'Failed to send password recovery email.');
    } finally { if (requestId === forgotRequest.current) setForgotLoading(false); }
  };

  // Feature highlights
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
      title: 'Gradebook & Grade Reports',
      desc: 'Review live course grades and print current grade reports.',
    },
    {
      id: 4,
      icon: GraduationCap,
      title: 'Multi-School Architecture',
      desc: 'Access multiple institutions with one identity. Teachers, admins, and students in harmony.',
    },
    {
      id: 5,
      icon: MessageSquare,
      title: 'Secure Messages & Announcements',
      desc: 'Stay informed with school-wide updates and direct faculty-student messaging channels.',
    },
  ];

  return (
    <div className="login-viewport" id="login-auth-viewport">
      <StarryBackground />

      <div className="screen-fade-top" aria-hidden="true" />
      <div className="screen-fade-bottom" aria-hidden="true" />

      <main className="login-container">
        {/* ──────── LEFT COLUMN: BRANDING & FEATURES ──────── */}
        <section className="login-left-col" id="login-left-column">
          <div className="login-brand-header">
            <div className="login-logo-badge">
              <School size={28} />
            </div>
            <div className="brand-title-wrap">
              <h2 className="brand-title gradient-text">Noesis Horizon</h2>
              <span className="login-brand-credit">By Bleon Balaj</span>
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

          <ThemePicker compact />
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
            {/* Signature Cursive Welcome Header */}
            <header className="auth-card-header">
              <h1 className="login-welcome-cursive">Welcome</h1>
              <p className="auth-card-subtitle">
                {SHOW_SIGNUP && activeTab === 'signup' ? 'Create your account & provision your school' : 'Sign in to access your school portal'}
              </p>
            </header>

            {/* Pill Tab Switcher: Sign In vs Sign Up (Temporarily hidden) */}
            {SHOW_SIGNUP && (
              <div className="auth-tab-pill-container" id="auth-tab-selector">
                <button
                  type="button"
                  id="tab-signin-btn"
                  className={`auth-tab-button ${activeTab === 'signin' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('signin');
                    setErrorMessage('');
                    setInfoMessage('');
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  id="tab-signup-btn"
                  className={`auth-tab-button ${activeTab === 'signup' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('signup');
                    setErrorMessage('');
                    setInfoMessage('');
                  }}
                >
                  Sign Up
                </button>
                <motion.div 
                  className="auth-tab-slider" 
                  layoutId="auth-tab-slider"
                  animate={{ x: activeTab === 'signup' ? '100%' : '0%' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              </div>
            )}

            {/* Error & Info Callouts */}
            {errorMessage && (
              <motion.div 
                className="auth-alert-box error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'hsla(0, 75%, 55%, 0.15)',
                  border: '1px solid hsla(0, 75%, 55%, 0.4)',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  color: 'hsl(var(--destructive))',
                  fontSize: '0.88rem',
                  marginBottom: '1rem'
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </motion.div>
            )}

            {infoMessage && (
              <motion.div 
                className="auth-alert-box info"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'hsla(var(--primary), 0.12)',
                  border: '1px solid hsla(var(--primary), 0.35)',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  color: 'hsl(var(--card-foreground))',
                  fontSize: '0.88rem',
                  marginBottom: '1rem',
                  lineHeight: '1.4'
                }}
              >
                <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'hsl(var(--primary))' }} />
                <span>{infoMessage}</span>
              </motion.div>
            )}

            {/* ──────── SIGN IN FORM ──────── */}
            {activeTab === 'signin' && (
              <form className="auth-form-fields" onSubmit={handleSignIn} id="login-signin-form">
                <div className="auth-input-group">
                  <label className="auth-input-label" htmlFor="input-signin-email">Email Address</label>
                  <div className="auth-input-wrapper">
                    <Mail size={18} className="auth-field-icon" />
                    <input
                      id="input-signin-email"
                      type="email"
                      className="auth-text-input has-icon"
                      placeholder="name@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label" htmlFor="input-signin-password">Password</label>
                  <div className="auth-input-wrapper">
                    <Lock size={18} className="auth-field-icon" />
                    <input
                      id="input-signin-password"
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
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotSubmitted(false);
                      setForgotError('');
                      setIsForgotModalOpen(true);
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  id="submit-auth-btn"
                  className="btn-primary-auth"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Sparkles size={18} className="animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ──────── SIGN UP FORM (Temporarily hidden) ──────── */}
            {SHOW_SIGNUP && activeTab === 'signup' && (
              <form className="auth-form-fields" onSubmit={handleSignUp} id="login-signup-form">
                <div className="auth-input-group">
                  <label className="auth-input-label" htmlFor="input-signup-email">Email Address</label>
                  <div className="auth-input-wrapper">
                    <Mail size={18} className="auth-field-icon" />
                    <input
                      id="input-signup-email"
                      type="email"
                      className="auth-text-input has-icon"
                      placeholder="name@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label" htmlFor="input-fullname">Full Name</label>
                  <div className="auth-input-wrapper">
                    <User size={18} className="auth-field-icon" />
                    <input
                      id="input-fullname"
                      type="text"
                      className="auth-text-input has-icon"
                      placeholder="e.g. Dr. Sarah Smith"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label" htmlFor="input-schoolname">School Organization Name</label>
                  <div className="auth-input-wrapper">
                    <School size={18} className="auth-field-icon" />
                    <input
                      id="input-schoolname"
                      type="text"
                      className="auth-text-input has-icon"
                      placeholder="e.g. Noesis Horizon Academy"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      required
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '4px' }}>
                    You will be provisioned as Administrator of this school.
                  </span>
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label" htmlFor="input-signup-password">Create Password</label>
                  <div className="auth-input-wrapper">
                    <Lock size={18} className="auth-field-icon" />
                    <input
                      id="input-signup-password"
                      type={showPassword ? 'text' : 'password'}
                      className="auth-text-input has-icon has-toggle"
                      placeholder="Min 6 characters"
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

                <button
                  type="submit"
                  id="submit-auth-btn"
                  className="btn-primary-auth"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Sparkles size={18} className="animate-spin" />
                      <span>Setting up school...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account & School</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </section>
      </main>

      {/* ──────── FORGOT PASSWORD MODAL (AGENTS.md Compliant) ──────── */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <div className="modal-overlay" onClick={closeForgotModal}>
            <motion.div 
              className="modal-content auth-dialog" 
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{ maxWidth: '440px' }}
            >
              <div className="modal-header">
                <h3>Password Recovery</h3>
                <p className="modal-subtitle">
                  Enter your account email to receive a password reset link.
                </p>
                <button
                  type="button"
                  className="icon-btn-close"
                  onClick={closeForgotModal}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {forgotSubmitted ? (
                <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>
                  <CheckCircle2 size={42} style={{ color: 'hsl(var(--mood-happy))', margin: '0 auto 1rem' }} />
                  <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Check Your Email</h4>
                  <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                    A password reset email has been requested for <strong>{forgotEmail}</strong>. Check your inbox and spam folder.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: '1.5rem', width: '100%' }}
                    onClick={closeForgotModal}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="modal-form">
                  <div className="input-group">
                    <label htmlFor="password-recovery-email">Account Email</label>
                    <input
                      id="password-recovery-email"
                      type="email"
                      required
                      placeholder="name@school.edu"
                      value={forgotEmail}
                      onChange={(e) => { setForgotEmail(e.target.value); setForgotError(''); }}
                      disabled={forgotLoading}
                      aria-invalid={Boolean(forgotError)}
                      aria-describedby={forgotError ? 'password-recovery-error' : undefined}
                      autoFocus
                    />
                  </div>

                  {forgotError && <p id="password-recovery-error" className="password-recovery-error" role="alert">{forgotError}</p>}

                  <div className="modal-footer-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={closeForgotModal}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={forgotLoading}>
                      {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
