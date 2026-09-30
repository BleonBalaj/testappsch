import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  LogOut, Shield, GraduationCap, BookOpen, 
  Settings as SettingsIcon, Camera, Moon, Sun, Laptop,
  Calendar, Book, CheckSquare, MessageSquare, Users, UserSquare2,
  Trophy, CalendarDays, Library, BarChart3, CheckCircle2, RotateCcw, Trash2,
  KeyRound, Lock, Info, Mail, Sparkles, User, Edit3, Upload, Image as ImageIcon
} from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { compressImageFile } from '../services/imageUtils';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSchoolData, DEFAULT_ROLE_PERMISSIONS } from '../context/SchoolDataContext';
import './Settings.css';

const PERMISSIBLE_MODULES = [
  { id: 'schedule', label: 'Class Timetable', desc: 'Daily schedule and period timetable', icon: Calendar },
  { id: 'classes', label: 'Courses & Classes', desc: 'Courses, classes (e.g. 10A) and their rosters', icon: Book },
  { id: 'lesson-plans', label: 'Lesson Planning', desc: 'Lesson preparation & curriculum stages', icon: BookOpen },
  { id: 'tasks', label: 'Tasks & Homework', desc: 'Personal task manager and to-do lists', icon: CheckSquare },
  { id: 'messages', label: 'Campus Messages', desc: 'Direct messaging and announcement channels', icon: MessageSquare },
  { id: 'students', label: 'Student Directory', desc: 'Student enrollment list and profiles', icon: Users },
  { id: 'staff', label: 'Staff Directory', desc: 'Faculty list and staff contact details', icon: UserSquare2 },
  { id: 'leaderboard', label: 'Academic Leaderboard', desc: 'Class standings and top student rankings', icon: Trophy },
  { id: 'events', label: 'Events Calendar', desc: 'School assemblies, fairs, and sports matches', icon: CalendarDays },
  { id: 'resources', label: 'Study Resources Hub', desc: 'Worksheets, guides, and course materials', icon: Library },
  { id: 'transcript', label: 'Academic Transcripts', desc: 'Official student transcript records and GPA', icon: GraduationCap },
  { id: 'mood-insights', label: 'Mood & Wellness', desc: 'Emotional well-being analytics and logs', icon: BarChart3 },
];

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

const Settings = ({ addNotification, lessonLanguage = 'en', onNavigate, onLogout }) => {
  const { 
    currentUser, 
    activeSchool, 
    activeSchoolId,
    currentRole, 
    globalPreferences,
    schoolPreferences,
    logoutUser, 
    updateGlobalPreferences,
    updateSchoolPreferences,
    updateDisplayName,
    updateSchoolName,
    updateSchoolLogo,
    updateUserPhoto,
    changeUserPassword
  } = useAuth();
  const { rolePermissions, updateRolePermissions } = useSchoolData();
  const { language, changeLanguage, t, isAlbanian } = useLanguage();

  const isAdmin = currentRole === 'admin';

  // Password Change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Profile Picture state & input ref
  const avatarInputRef = useRef(null);
  const [userPhoto, setUserPhoto] = useState(currentUser?.photoURL || '');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // School Logo state & input ref
  const schoolLogoInputRef = useRef(null);
  const [schoolLogo, setSchoolLogo] = useState(activeSchool?.logo || activeSchool?.schoolLogo || schoolPreferences?.schoolLogo || '');
  const [isUploadingSchoolLogo, setIsUploadingSchoolLogo] = useState(false);

  // Permissions target tab: 'teacher' or 'student'
  const [permTargetRole, setPermTargetRole] = useState('teacher');
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  // Editable display name
  const [displayNameInput, setDisplayNameInput] = useState(currentUser?.displayName || '');
  const [isSavingName, setIsSavingName] = useState(false);

  // Editable school name (Admins only)
  const [schoolNameInput, setSchoolNameInput] = useState(activeSchool?.name || '');
  const [isSavingSchool, setIsSavingSchool] = useState(false);

  // Preferences (synced to cloud)
  const [notifications, setNotifications] = useState(true);
  const [animations, setAnimations] = useState(true);
  const [volume, setVolume] = useState(65);

  // Theme mode: 'dark', 'light', or 'system'
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('lumi-theme-mode') || (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  });

  useEffect(() => {
    if (currentUser?.displayName) {
      setDisplayNameInput(currentUser.displayName);
    }
  }, [currentUser?.displayName]);

  useEffect(() => {
    setUserPhoto(currentUser?.photoURL || '');
  }, [currentUser?.photoURL]);

  useEffect(() => {
    if (activeSchool?.name) {
      setSchoolNameInput(activeSchool.name);
    }
  }, [activeSchool?.name]);

  useEffect(() => {
    const currentLogo = activeSchool?.logo || activeSchool?.schoolLogo || schoolPreferences?.schoolLogo || '';
    setSchoolLogo(currentLogo);
  }, [activeSchool?.logo, activeSchool?.schoolLogo, schoolPreferences?.schoolLogo]);

  // Sync global preferences from cloud
  useEffect(() => {
    if (globalPreferences) {
      if (globalPreferences.notifications !== undefined) setNotifications(Boolean(globalPreferences.notifications));
      if (globalPreferences.animations !== undefined) setAnimations(Boolean(globalPreferences.animations));
      if (globalPreferences.volume !== undefined) setVolume(Number(globalPreferences.volume));
    }
  }, [globalPreferences]);

  useEffect(() => {
    const handleExternalTheme = (e) => {
      const mode = e?.detail?.mode || localStorage.getItem('lumi-theme-mode') || (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
      setThemeMode(mode);
    };
    window.addEventListener('themechange', handleExternalTheme);
    return () => window.removeEventListener('themechange', handleExternalTheme);
  }, []);

  const handleApplyTheme = async (mode) => {
    setThemeMode(mode);
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

    window.dispatchEvent(new CustomEvent('themechange', { detail: { mode, isLight } }));
    window.dispatchEvent(new Event('userSettingsChanged'));

    try {
      if (currentUser?.uid) {
        await updateGlobalPreferences({ theme: mode });
      }
    } catch (e) {
      console.warn('Could not update global preferences:', e);
    }

    if (addNotification) {
      addNotification('info', `Switched theme to ${mode.charAt(0).toUpperCase() + mode.slice(1)} ✨`);
    }
  };

  const handleTogglePreference = async (key, setter, state, label) => {
    const next = !state;
    setter(next);
    try {
      if (updateGlobalPreferences) {
        await updateGlobalPreferences({ [key]: next });
      }
    } catch (e) {
      console.warn('Could not save preference to cloud:', e);
    }
    addNotification('success', `${label} ${next ? 'enabled' : 'disabled'}! ✨`);
  };

  const handleSlider = async (e) => {
    const val = Number(e.target.value);
    setVolume(val);
    try {
      if (updateGlobalPreferences) {
        await updateGlobalPreferences({ volume: val });
      }
    } catch (e) {
      console.warn('Could not save volume to cloud:', e);
    }
  };

  const handleSchoolLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addNotification('error', 'Please choose a valid image file');
      return;
    }
    setIsUploadingSchoolLogo(true);
    try {
      const compressed = await compressImageFile(file, 512, 256, 0.85);
      setSchoolLogo(compressed);
      if (updateSchoolLogo) {
        await updateSchoolLogo(compressed);
      }
      addNotification('success', isAlbanian ? 'Logoja e shkollës u ruajt në re me sukses! ✨' : 'School logo saved to cloud successfully! ✨');
    } catch (err) {
      console.error('School logo upload error:', err);
      addNotification('error', 'Failed to save school logo: ' + err.message);
    } finally {
      setIsUploadingSchoolLogo(false);
      if (schoolLogoInputRef.current) schoolLogoInputRef.current.value = '';
    }
  };

  const handleRemoveSchoolLogo = async () => {
    setIsUploadingSchoolLogo(true);
    try {
      setSchoolLogo('');
      if (updateSchoolLogo) {
        await updateSchoolLogo('');
      }
      addNotification('success', isAlbanian ? 'Logoja e shkollës u hoq me sukses! ✨' : 'School logo removed successfully! ✨');
    } catch (err) {
      console.error('School logo removal error:', err);
      addNotification('error', 'Failed to remove school logo: ' + err.message);
    } finally {
      setIsUploadingSchoolLogo(false);
      if (schoolLogoInputRef.current) schoolLogoInputRef.current.value = '';
    }
  };

  // Center-crop and compress uploaded photo on canvas to 256x256 JPEG (~15KB)
  const compressAvatarImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to parse image data'));
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const targetSize = 256;
            canvas.width = targetSize;
            canvas.height = targetSize;

            const minDim = Math.min(img.width, img.height);
            const startX = (img.width - minDim) / 2;
            const startY = (img.height - minDim) / 2;

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);

            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            resolve(compressed);
          } catch (err) {
            reject(err);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addNotification('error', 'Please choose a valid image file');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      addNotification('error', 'Image size must be under 8MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const compressedDataUrl = await compressAvatarImage(file);
      setUserPhoto(compressedDataUrl);

      await updateUserPhoto(compressedDataUrl);
      addNotification('success', 'Profile picture updated and saved successfully! ✨');
    } catch (err) {
      console.error('Avatar upload error:', err);
      addNotification('error', 'Failed to save profile picture: ' + err.message);
    } finally {
      setIsUploadingPhoto(false);
      // Reset input value so selecting the same file triggers onChange
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploadingPhoto(true);
    try {
      setUserPhoto('');
      await updateUserPhoto('');
      addNotification('success', 'Profile picture removed successfully! ✨');
    } catch (err) {
      console.error('Avatar removal error:', err);
      addNotification('error', 'Failed to remove profile picture: ' + err.message);
    } finally {
      setIsUploadingPhoto(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleChangePassword = async (e) => {
    e?.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match. Please re-enter.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changeUserPassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess('Password changed successfully! ✨');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      if (addNotification) {
        addNotification('success', 'Password updated successfully! ✨');
      }
    } catch (err) {
      console.error('Password change error:', err);
      setPasswordError(err.message || 'Failed to update password.');
      if (addNotification) {
        addNotification('error', err.message || 'Failed to update password.');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleTogglePermission = async (role, moduleId, newStatus) => {
    if (!isAdmin) return;
    setIsSavingPerms(true);
    try {
      await updateRolePermissions(role, { [moduleId]: newStatus });
      addNotification('success', `Updated ${role === 'teacher' ? 'teachers' : 'students'} access for "${moduleId}"! ✨`);
    } catch (err) {
      console.error('Error updating permissions:', err);
      addNotification('error', 'Failed to update permissions: ' + err.message);
    } finally {
      setIsSavingPerms(false);
    }
  };

  const handleSaveDisplayName = async (e) => {
    e?.preventDefault();
    if (!displayNameInput.trim()) {
      addNotification('error', 'Display name cannot be empty');
      return;
    }
    if (displayNameInput.trim() === currentUser?.displayName) return;

    setIsSavingName(true);
    try {
      await updateDisplayName(displayNameInput.trim());
      addNotification('success', `Display name updated to "${displayNameInput.trim()}"! ✨`);
    } catch (err) {
      console.error('Error updating name:', err);
      addNotification('error', 'Failed to update name: ' + err.message);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveSchoolName = async (e) => {
    e?.preventDefault();
    if (!isAdmin || !schoolNameInput.trim()) return;
    if (schoolNameInput.trim() === activeSchool?.name) return;

    setIsSavingSchool(true);
    try {
      await updateSchoolName(schoolNameInput.trim());
      addNotification('success', `School organization updated to "${schoolNameInput.trim()}"! ✨`);
    } catch (err) {
      console.error('Error updating school name:', err);
      addNotification('error', 'Failed to update school name: ' + err.message);
    } finally {
      setIsSavingSchool(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      addNotification('info', 'Logged out successfully. See you soon! ✨');
      if (onLogout) onLogout();
      else if (onNavigate) onNavigate('login');
    } catch (err) {
      console.error('Logout error:', err);
      addNotification('error', 'Failed to log out cleanly');
    }
  };

  const email = currentUser?.email || 'user@noesishorizon.edu';

  return (
    <motion.div 
      className="settings-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <header className="page-header">
        <div>
          <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
            {t('settings.title')}
            <SettingsIcon size={32} style={{ color: 'hsl(var(--primary))' }} />
          </h1>
          <p>{t('settings.subtitle')}</p>
        </div>
      </header>

      {/* Hidden File Input for Avatar Upload */}
      <input 
        type="file" 
        ref={avatarInputRef} 
        onChange={handleAvatarFileChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />

      <div className="settings-grid">
        <section className="settings-section glass">
          <h3>{t('settings.userProfile')}</h3>
          <div className="profile-edit">
            <div className="avatar-edit-col">
              <div 
                className="avatar-large" 
                onClick={() => avatarInputRef.current?.click()}
                title={t('settings.changePhoto')}
              >
                <Avatar 
                  src={userPhoto || currentUser?.photoURL} 
                  alt={displayNameInput || email} 
                  size={104} 
                  iconSize={48} 
                />
                <button 
                  type="button" 
                  className="edit-badge" 
                  title={t('settings.changePhoto')} 
                  aria-label={t('settings.changePhoto')}
                  disabled={isUploadingPhoto}
                  onClick={(e) => {
                    e.stopPropagation();
                    avatarInputRef.current?.click();
                  }}
                >
                  <Camera size={16} />
                </button>
              </div>
              {(userPhoto || currentUser?.photoURL) && (
                <button
                  type="button"
                  className="btn-remove-avatar"
                  onClick={handleRemoveAvatar}
                  disabled={isUploadingPhoto}
                  title={t('settings.removePhoto')}
                >
                  <Trash2 size={13} />
                  <span>{t('settings.removePhoto')}</span>
                </button>
              )}
            </div>
            <div className="profile-inputs">
              {/* User display name - Fully Editable */}
              <div className="input-group">
                <label>{t('settings.displayName')}</label>
                <div className="settings-inline-field">
                  <input 
                    type="text" 
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="e.g. Bleon Balaj"
                    className="glass" 
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn-primary"
                    disabled={isSavingName || !displayNameInput.trim() || displayNameInput.trim() === currentUser?.displayName}
                    onClick={handleSaveDisplayName}
                    style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', height: '42px', flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    {isSavingName ? t('settings.saving') : t('settings.saveName')}
                  </button>
                </div>
              </div>

              {/* Email Address - Read only global UID */}
              <div className="input-group">
                <label>{t('settings.authEmail')}</label>
                <input 
                  type="email" 
                  value={email}
                  readOnly
                  className="glass" 
                />
              </div>

              {/* School Name - Editable for Admins */}
              <div className="input-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label>{t('settings.activeSchool')}</label>
                  {isAdmin ? (
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))', fontWeight: 700 }}>
                      🛡️ {t('settings.adminEditable')}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      {t('settings.adminOnly')}
                    </span>
                  )}
                </div>
                <div className="settings-inline-field">
                  <input 
                    type="text" 
                    value={schoolNameInput}
                    onChange={(e) => setSchoolNameInput(e.target.value)}
                    readOnly={!isAdmin}
                    className="glass" 
                    placeholder="e.g. Noesis Horizon Academy"
                    style={{ flex: 1 }}
                  />
                  {isAdmin && (
                    <button 
                      type="button" 
                      className="btn-primary"
                      disabled={isSavingSchool || !schoolNameInput.trim() || schoolNameInput.trim() === activeSchool?.name}
                      onClick={handleSaveSchoolName}
                      style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', height: '42px', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      {isSavingSchool ? t('settings.saving') : t('settings.saveSchool')}
                    </button>
                  )}
                </div>
              </div>

              {/* School Logo - Editable for Admins */}
              <div className="input-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label>{isAlbanian ? 'Logoja e Shkollës' : 'School Logo'}</label>
                  {isAdmin ? (
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))', fontWeight: 700 }}>
                      🛡️ {t('settings.adminEditable')}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      {t('settings.adminOnly')}
                    </span>
                  )}
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: 'hsla(var(--background), 0.5)',
                  padding: '0.85rem 1rem',
                  borderRadius: '16px',
                  border: '1px solid hsla(var(--border), 0.6)',
                  marginTop: '0.25rem'
                }}>
                  {schoolLogo ? (
                    <div style={{
                      width: '72px',
                      height: '48px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid hsla(var(--border), 0.6)',
                      flexShrink: 0
                    }}>
                      <img 
                        src={schoolLogo} 
                        alt="School Logo" 
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'hsla(var(--primary), 0.12)',
                      color: 'hsl(var(--primary))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <ImageIcon size={22} />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: '0.88rem', color: 'hsl(var(--foreground))' }}>
                      {schoolLogo ? (isAlbanian ? 'Logoja Aktive e Shkollës' : 'Active School Logo') : (isAlbanian ? 'Nuk ka logo të ngarkuar' : 'No school logo set')}
                    </strong>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.1rem' }}>
                      {isAlbanian ? 'Sinkronizohet në re për të gjithë stafin dhe shfaqet në planet mësimore' : 'Synced to cloud for all staff and displayed on lesson plan PDFs'}
                    </span>
                  </div>

                  {isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <input 
                        type="file" 
                        ref={schoolLogoInputRef}
                        accept="image/*" 
                        onChange={handleSchoolLogoChange}
                        style={{ display: 'none' }}
                        id="settings-school-logo-file"
                      />
                      <label 
                        htmlFor="settings-school-logo-file"
                        className="btn-secondary glass"
                        style={{ 
                          cursor: isUploadingSchoolLogo ? 'wait' : 'pointer', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.4rem',
                          padding: '0.5rem 0.9rem',
                          fontSize: '0.82rem',
                          borderRadius: '12px',
                          margin: 0
                        }}
                      >
                        <Upload size={14} />
                        <span>{isUploadingSchoolLogo ? (isAlbanian ? 'Duke ngarkuar...' : 'Uploading...') : (schoolLogo ? (isAlbanian ? 'Ndrysho' : 'Change') : (isAlbanian ? 'Ngarko Logo' : 'Upload Logo'))}</span>
                      </label>
                      {schoolLogo && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.82rem',
                            color: 'hsl(var(--destructive))',
                            borderRadius: '12px'
                          }}
                          disabled={isUploadingSchoolLogo}
                          onClick={handleRemoveSchoolLogo}
                          title={isAlbanian ? 'Hiq logon' : 'Remove logo'}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Role - STRICTLY READ-ONLY BADGE (Users CANNOT change role) */}
              <div className="input-group">
                <label>{t('settings.activeRole')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                  {currentRole === 'admin' ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.5rem 1rem',
                      borderRadius: '9999px',
                      background: 'hsla(335, 70%, 65%, 0.18)',
                      border: '1px solid hsla(335, 70%, 65%, 0.4)',
                      color: 'hsl(var(--primary))',
                      fontWeight: 700,
                      fontSize: '0.88rem'
                    }}>
                      <Shield size={15} /> {t('settings.adminRole')}
                    </span>
                  ) : currentRole === 'teacher' ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.5rem 1rem',
                      borderRadius: '9999px',
                      background: 'hsla(142, 70%, 45%, 0.18)',
                      border: '1px solid hsla(142, 70%, 45%, 0.4)',
                      color: 'hsl(142, 70%, 45%)',
                      fontWeight: 700,
                      fontSize: '0.88rem'
                    }}>
                      <GraduationCap size={15} /> {t('settings.teacherRole')}
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.5rem 1rem',
                      borderRadius: '9999px',
                      background: 'hsla(215, 85%, 60%, 0.18)',
                      border: '1px solid hsla(215, 85%, 60%, 0.4)',
                      color: 'hsl(215, 85%, 60%)',
                      fontWeight: 700,
                      fontSize: '0.88rem'
                    }}>
                      🎓 {t('settings.studentRole')}
                    </span>
                  )}
                  <span style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
                    {t('settings.roleNote')}
                  </span>
                </div>
              </div>

              {currentUser?.uid && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
                  Stable UID: <code style={{ color: 'hsl(var(--primary))' }}>{currentUser.uid}</code>
                </div>
              )}
            </div>
          </div>

          <div className="role-dashboard-notice glass">
            <span className="notice-icon">{currentRole === 'student' ? '🎓' : currentRole === 'teacher' ? '📚' : '🛡️'}</span>
            <div>
              <strong>Active Portal: {currentRole === 'student' ? t('nav.student') : currentRole === 'teacher' ? t('nav.teacher') : t('nav.admin')}</strong>
              <p>
                {currentRole === 'student' 
                  ? 'Access to enrolled courses, gradebook, transcripts, and personal tasks.'
                  : currentRole === 'teacher'
                  ? 'Access to lesson planning, gradebook, class notes, and student rosters.'
                  : 'Access to school-wide governance, curriculum policies, and staff invitations.'}
              </p>
            </div>
          </div>

          {currentRole !== 'student' && (
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

        {/* Security & Password Change */}
        <section className="settings-section glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <KeyRound size={22} style={{ color: 'hsl(var(--primary))' }} />
            <h3 style={{ margin: 0, border: 'none', padding: 0 }}>{t('settings.changePassword')}</h3>
          </div>
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
            {t('settings.passwordSubtitle')}
          </p>

          <form onSubmit={handleChangePassword} className="password-change-form">
            <div className="input-group">
              <label>{t('settings.currentPassword')}</label>
              <input 
                type="password" 
                required
                placeholder="Enter current password accurately"
                value={passwordForm.currentPassword}
                onChange={e => {
                  setPasswordError('');
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value });
                }}
                className="glass"
              />
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label>{t('settings.newPassword')}</label>
                <input 
                  type="password" 
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  value={passwordForm.newPassword}
                  onChange={e => {
                    setPasswordError('');
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                  }}
                  className="glass"
                />
              </div>

              <div className="input-group">
                <label>{t('settings.confirmPassword')}</label>
                <input 
                  type="password" 
                  required
                  minLength={6}
                  placeholder="Re-type new password"
                  value={passwordForm.confirmPassword}
                  onChange={e => {
                    setPasswordError('');
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                  }}
                  className="glass"
                />
              </div>
            </div>

            {passwordError && (
              <div className="password-feedback-error">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="password-feedback-success">
                {passwordSuccess}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={isUpdatingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                style={{ padding: '0.65rem 1.4rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <Lock size={15} />
                {isUpdatingPassword ? t('settings.saving') : t('settings.updatePassword')}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-section glass">
          <h3>{t('settings.preferences')}</h3>
          
          {/* Real-time Language Preference Selector */}
          <div className="input-group" style={{ marginBottom: '1.25rem' }}>
            <label>{t('settings.language')}</label>
            <p style={{ fontSize: '0.82rem', color: 'hsl(var(--muted-foreground))', margin: '0.2rem 0 0.6rem 0' }}>
              {t('settings.languageSubtitle')}
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'hsla(var(--background), 0.5)',
              border: '1px solid hsl(var(--border))',
              borderRadius: '9999px',
              padding: '0.35rem 0.5rem',
              width: 'fit-content'
            }}>
              <button
                type="button"
                className={`lang-dock-btn ${language === 'en' ? 'active' : ''}`}
                onClick={() => changeLanguage('en')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 1.1rem',
                  borderRadius: '9999px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: language === 'en' ? 'hsl(var(--primary))' : 'transparent',
                  color: language === 'en' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>🇬🇧 English</span>
              </button>
              <button
                type="button"
                className={`lang-dock-btn ${language === 'sq' ? 'active' : ''}`}
                onClick={() => changeLanguage('sq')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 1.1rem',
                  borderRadius: '9999px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: language === 'sq' ? 'hsl(var(--primary))' : 'transparent',
                  color: language === 'sq' ? (themeMode === 'light' ? '#ffffff' : 'hsl(var(--primary-foreground))') : 'hsl(var(--muted-foreground))',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>🇦🇱 Shqip (Albanian)</span>
              </button>
            </div>
          </div>

          {/* Real-time Theme Dock in Settings */}
          <div className="input-group" style={{ marginBottom: '1.25rem' }}>
            <label>{t('settings.interfaceTheme')}</label>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'hsla(var(--background), 0.5)',
              border: '1px solid hsl(var(--border))',
              borderRadius: '9999px',
              padding: '0.35rem 0.5rem',
              width: 'fit-content'
            }}>
              <button
                type="button"
                className={`theme-dock-btn ${themeMode === 'dark' ? 'active' : ''}`}
                onClick={() => handleApplyTheme('dark')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '9999px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: themeMode === 'dark' ? 'hsl(var(--primary))' : 'transparent',
                  color: themeMode === 'dark' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))'
                }}
              >
                <Moon size={15} />
                <span>{t('settings.dark')}</span>
              </button>
              <button
                type="button"
                className={`theme-dock-btn ${themeMode === 'light' ? 'active' : ''}`}
                onClick={() => handleApplyTheme('light')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '9999px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: themeMode === 'light' ? 'hsl(var(--primary))' : 'transparent',
                  color: themeMode === 'light' ? '#ffffff' : 'hsl(var(--muted-foreground))'
                }}
              >
                <Sun size={15} />
                <span>{t('settings.light')}</span>
              </button>
              <button
                type="button"
                className={`theme-dock-btn ${themeMode === 'system' ? 'active' : ''}`}
                onClick={() => handleApplyTheme('system')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '9999px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: themeMode === 'system' ? 'hsl(var(--primary))' : 'transparent',
                  color: themeMode === 'system' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))'
                }}
              >
                <Laptop size={15} />
                <span>{t('settings.auto')}</span>
              </button>
            </div>
          </div>

          <div className="toggles-list">
            <Toggle 
              label={t('settings.pushNotifications')} 
              active={notifications} 
              onToggle={() => handleTogglePreference('notifications', setNotifications, notifications, 'Notifications')} 
            />
            <Toggle 
              label={t('settings.enableAnimations')} 
              active={animations} 
              onToggle={() => handleTogglePreference('animations', setAnimations, animations, 'Animations')} 
            />
          </div>

          <div className="input-group" style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <label style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
                {isAlbanian ? 'Volumi i Efekteve Zanore' : 'Sound Effects Volume'}
              </label>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'hsl(var(--primary))' }}>{volume}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={volume} 
              onChange={handleSlider}
              style={{ width: '100%', accentColor: 'hsl(var(--primary))', cursor: 'pointer' }}
            />
          </div>
        </section>

        {/* ── About Us / Platform Architecture (Immediately after Preferences) ── */}
        <section className="settings-section glass about-us-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Sparkles size={22} style={{ color: 'hsl(var(--primary))' }} />
            <h3 style={{ margin: 0, border: 'none', padding: 0 }}>{t('settings.aboutUs')}</h3>
          </div>
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
            {t('settings.aboutSubtitle')}
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            marginTop: '0.5rem'
          }}>
            <div style={{
              background: 'hsla(var(--background), 0.6)',
              border: '1px solid hsla(var(--border), 0.6)',
              borderRadius: '16px',
              padding: '1.1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'hsla(var(--primary), 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'hsl(var(--primary))',
                flexShrink: 0
              }}>
                <User size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                  {t('settings.creator')}
                </span>
                <strong style={{ fontSize: '1.05rem', color: 'hsl(var(--foreground))', display: 'block', marginTop: '0.15rem' }}>
                  Bleon Balaj
                </strong>
              </div>
            </div>

            <div style={{
              background: 'hsla(var(--background), 0.6)',
              border: '1px solid hsla(var(--border), 0.6)',
              borderRadius: '16px',
              padding: '1.1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'hsla(var(--primary), 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'hsl(var(--primary))',
                flexShrink: 0
              }}>
                <Mail size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                  {t('settings.contact')}
                </span>
                <a 
                  href="mailto:b.balaj@hotmail.com" 
                  style={{ 
                    fontSize: '0.96rem', 
                    fontWeight: 700,
                    color: 'hsl(var(--primary))', 
                    textDecoration: 'none',
                    display: 'block',
                    marginTop: '0.15rem',
                    wordBreak: 'break-all'
                  }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                >
                  b.balaj@hotmail.com
                </a>
              </div>
            </div>

            <div style={{
              background: 'hsla(var(--background), 0.6)',
              border: '1px solid hsla(var(--border), 0.6)',
              borderRadius: '16px',
              padding: '1.1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'hsla(var(--primary), 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'hsl(var(--primary))',
                flexShrink: 0
              }}>
                <Info size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                  {t('settings.platform')}
                </span>
                <strong style={{ fontSize: '0.98rem', color: 'hsl(var(--foreground))', display: 'block', marginTop: '0.15rem' }}>
                  Noesis Horizon · v2.4.0
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* ── Admin Role Permissions & Feature Access Section ── */}
        {isAdmin && (
          <section className="settings-section glass role-permissions-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsla(var(--border), 0.5)', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, border: 'none', padding: 0 }}>{t('settings.rolePermissions')}</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
                  {t('settings.rolePermissionsSubtitle')}
                </p>
              </div>
              <div className="role-perm-tab-toggle glass">
                <button
                  type="button"
                  className={`perm-tab-btn ${permTargetRole === 'teacher' ? 'active' : ''}`}
                  onClick={() => setPermTargetRole('teacher')}
                >
                  <GraduationCap size={16} /> {t('settings.teachers')}
                </button>
                <button
                  type="button"
                  className={`perm-tab-btn ${permTargetRole === 'student' ? 'active' : ''}`}
                  onClick={() => setPermTargetRole('student')}
                >
                  <Users size={16} /> {t('settings.students')}
                </button>
              </div>
            </div>

            <div className="permissions-toggle-grid">
              {PERMISSIBLE_MODULES.map(mod => {
                const isEnabled = (rolePermissions?.[permTargetRole]?.[mod.id] ?? DEFAULT_ROLE_PERMISSIONS[permTargetRole]?.[mod.id]) ?? false;
                const IconComponent = mod.icon;
                const moduleKey = mod.id === 'classes' ? 'classes' : mod.id === 'lesson-plans' ? 'lessonPlans' : mod.id === 'mood-insights' ? 'moodInsights' : mod.id;
                const translatedLabel = t(`nav.${moduleKey}`, mod.label);
                return (
                  <div key={mod.id} className="permission-card glass">
                    <div className="permission-card-info">
                      <div className="permission-icon-box">
                        <IconComponent size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong>{translatedLabel}</strong>
                        <p>{mod.desc}</p>
                      </div>
                    </div>
                    <Toggle 
                      active={isEnabled}
                      onToggle={() => handleTogglePermission(permTargetRole, mod.id, !isEnabled)}
                      label=""
                    />
                  </div>
                );
              })}
            </div>

            {permTargetRole === 'teacher' && (
              <div className="teacher-actions-perm-section" style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid hsla(var(--border), 0.5)' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                    {isAlbanian ? 'Lejet e Veprimeve të Mësimdhënësve' : 'Teacher Action Privileges'}
                  </h4>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                    {isAlbanian 
                      ? 'Përcaktoni nëse mësimdhënësit kanë të drejtë të modifikojnë dhe fshijnë lëndët nga katalogu i shkollës.'
                      : 'Control whether teachers can edit course information and delete courses from the catalog.'}
                  </p>
                </div>

                <div className="permissions-toggle-grid">
                  <div className="permission-card glass">
                    <div className="permission-card-info">
                      <div className="permission-icon-box" style={{ background: 'hsla(var(--primary), 0.15)', color: 'hsl(var(--primary))' }}>
                        <Edit3 size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong>{isAlbanian ? 'Përpunimi & Fshirja e Lëndëve' : 'Edit & Delete Courses'}</strong>
                        <p>
                          {isAlbanian 
                            ? 'Lejon mësimdhënësit të ndryshojnë emrin e lëndës, arsimtarin, klasën, sallën, orarin dhe të fshijnë lëndët. Klasat (10A…) i menaxhojnë administratorët.' 
                            : 'Allow teachers to edit a course\'s name, teacher, class, schedule and room, and delete courses. Classes (10A…) are managed by administrators.'}
                        </p>
                      </div>
                    </div>
                    <Toggle 
                      active={(rolePermissions?.teacher?.canEditDeleteClasses ?? DEFAULT_ROLE_PERMISSIONS.teacher.canEditDeleteClasses) ?? true}
                      onToggle={() => {
                        const currentVal = (rolePermissions?.teacher?.canEditDeleteClasses ?? DEFAULT_ROLE_PERMISSIONS.teacher.canEditDeleteClasses) ?? true;
                        handleTogglePermission('teacher', 'canEditDeleteClasses', !currentVal);
                      }}
                      label=""
                    />
                  </div>

                  <div className="permission-card glass">
                    <div className="permission-card-info">
                      <div className="permission-icon-box" style={{ background: 'hsla(var(--accent), 0.15)', color: 'hsl(var(--accent))' }}>
                        <Users size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong>{isAlbanian ? 'Përpunimi & Fshirja e Nxënësve' : 'Edit & Delete Students'}</strong>
                        <p>
                          {isAlbanian 
                            ? 'Lejon mësimdhënësit të modifikojnë profilin e nxënësve, klasën, lëndët e caktuara dhe të fshijnë nxënës' 
                            : 'Allow teachers to edit student profiles, their class and course enrollments, and delete students'}
                        </p>
                      </div>
                    </div>
                    <Toggle 
                      active={(rolePermissions?.teacher?.canEditDeleteStudents ?? DEFAULT_ROLE_PERMISSIONS.teacher.canEditDeleteStudents) ?? true}
                      onToggle={() => {
                        const currentVal = (rolePermissions?.teacher?.canEditDeleteStudents ?? DEFAULT_ROLE_PERMISSIONS.teacher.canEditDeleteStudents) ?? true;
                        handleTogglePermission('teacher', 'canEditDeleteStudents', !currentVal);
                      }}
                      label=""
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="settings-section glass danger-zone">
          <h3 style={{ color: 'hsl(var(--destructive))' }}>{t('settings.dangerZone')}</h3>
          <p>{t('settings.dangerSubtitle')}</p>
          <div className="logout-section">
            <button 
              type="button" 
              className="logout-btn-large glass" 
              onClick={handleLogout}
            >
              <LogOut size={20} />
              <span>
                {isAlbanian 
                  ? `Dil nga ${activeSchool?.name?.trim() || schoolNameInput?.trim() || 'Noesis Horizon'}` 
                  : `Sign Out from ${activeSchool?.name?.trim() || schoolNameInput?.trim() || 'Noesis Horizon'}`}
              </span>
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
};

export default Settings;
