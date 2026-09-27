import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  School, 
  ChevronDown, 
  Check, 
  Plus, 
  Shield, 
  GraduationCap, 
  UserCheck, 
  Clock, 
  CheckCircle2, 
  XCircle,
  X,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './SchoolSwitcher.css';

export const SchoolSwitcher = ({ addNotification }) => {
  const { 
    currentUser, 
    schoolLinks, 
    activeSchoolId, 
    activeSchool, 
    currentRole, 
    switchSchool, 
    createNewSchool, 
    pendingInvitations, 
    acceptInvitation, 
    declineInvitation,
    refreshPendingInvitations 
  } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newAcademicYear, setNewAcademicYear] = useState('2024-2025');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);

  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const activeLink = schoolLinks.find(l => l.schoolId === activeSchoolId) || {
    schoolName: activeSchool?.name || 'School Organization',
    role: currentRole || 'student'
  };

  const getRoleBadge = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return <span className="role-pill role-admin"><Shield size={12} /> Admin</span>;
      case 'teacher':
        return <span className="role-pill role-teacher"><GraduationCap size={12} /> Teacher</span>;
      case 'counselor':
        return <span className="role-pill role-counselor"><UserCheck size={12} /> Counselor</span>;
      case 'dept_head':
        return <span className="role-pill role-dept"><Shield size={12} /> Dept Head</span>;
      case 'support':
        return <span className="role-pill role-support">Staff</span>;
      default:
        return <span className="role-pill role-student">🎓 Student</span>;
    }
  };

  const handleSelectSchool = (schoolId) => {
    if (schoolId === activeSchoolId) {
      setIsOpen(false);
      return;
    }
    switchSchool(schoolId);
    setIsOpen(false);
    if (addNotification) {
      const target = schoolLinks.find(s => s.schoolId === schoolId);
      addNotification('info', `Switched to ${target?.schoolName || 'School'}. Role: ${target?.role || 'member'}`);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await createNewSchool(newSchoolName.trim(), newAcademicYear.trim());
      setIsCreateModalOpen(false);
      setNewSchoolName('');
      setIsOpen(false);
      if (addNotification) {
        addNotification('success', `Created ${created.schoolName} as Administrator! 🚀`);
      }
    } catch (err) {
      console.error('Error creating new school:', err);
      if (addNotification) {
        addNotification('error', err.message || 'Failed to create school');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptInvite = async (schoolId, inviteId, schoolName) => {
    setActionInProgress(inviteId);
    try {
      await acceptInvitation(schoolId, inviteId);
      if (addNotification) {
        addNotification('success', `Joined ${schoolName}! 🎉`);
      }
    } catch (err) {
      if (addNotification) {
        addNotification('error', err.message || 'Failed to accept invitation');
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeclineInvite = async (schoolId, inviteId) => {
    setActionInProgress(inviteId);
    try {
      await declineInvitation(schoolId, inviteId);
      if (addNotification) {
        addNotification('info', 'Invitation declined.');
      }
    } catch (err) {
      if (addNotification) {
        addNotification('error', err.message || 'Failed to decline invitation');
      }
    } finally {
      setActionInProgress(null);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="school-switcher-container" ref={dropdownRef}>
      {/* Switcher Trigger Button */}
      <button 
        type="button" 
        className={`school-switcher-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="school-switcher-icon-wrap">
          <School size={16} />
        </div>
        <div className="school-switcher-info">
          <span className="school-switcher-name" title={activeLink.schoolName}>
            {activeLink.schoolName || 'Select School'}
          </span>
          <div className="school-switcher-role-row">
            {getRoleBadge(activeLink.role)}
          </div>
        </div>
        {pendingInvitations.length > 0 && (
          <span className="pending-badge-count" title={`${pendingInvitations.length} pending invitation(s)`}>
            {pendingInvitations.length}
          </span>
        )}
        <ChevronDown size={14} className={`school-switcher-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {/* Switcher Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="school-switcher-dropdown"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <div className="dropdown-section-title">
              <span>Your Schools ({schoolLinks.length})</span>
            </div>

            <div className="school-list-scroller">
              {schoolLinks.length === 0 ? (
                <div className="school-empty-state">
                  <span>No schools found. Create one below to begin.</span>
                </div>
              ) : (
                schoolLinks.map((link) => {
                  const isCurrent = link.schoolId === activeSchoolId;
                  return (
                    <button
                      key={link.schoolId}
                      type="button"
                      className={`school-item-btn ${isCurrent ? 'selected' : ''}`}
                      onClick={() => handleSelectSchool(link.schoolId)}
                    >
                      <div className="school-item-left">
                        <div className="school-item-icon">
                          <School size={15} />
                        </div>
                        <div className="school-item-text">
                          <span className="school-item-name">{link.schoolName}</span>
                          <span className="school-item-role">{getRoleBadge(link.role)}</span>
                        </div>
                      </div>
                      {isCurrent && (
                        <div className="school-item-check">
                          <Check size={16} />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Pending Invitations Section */}
            {pendingInvitations.length > 0 && (
              <div className="invitations-section">
                <div className="dropdown-section-title">
                  <span>Pending Invitations ({pendingInvitations.length})</span>
                </div>
                <div className="invitation-items-list">
                  {pendingInvitations.map((inv) => (
                    <div key={inv.id} className="invitation-card-item">
                      <div className="invitation-info">
                        <span className="invitation-school-name">{inv.schoolName}</span>
                        <div className="invitation-role-tag">
                          <span>Role: <strong>{inv.role}</strong></span>
                        </div>
                      </div>
                      <div className="invitation-actions">
                        <button
                          type="button"
                          className="btn-inv-accept"
                          disabled={actionInProgress === inv.id}
                          onClick={() => handleAcceptInvite(inv.schoolId, inv.id, inv.schoolName)}
                          title="Accept Invitation"
                        >
                          <CheckCircle2 size={15} />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          className="btn-inv-decline"
                          disabled={actionInProgress === inv.id}
                          onClick={() => handleDeclineInvite(inv.schoolId, inv.id)}
                          title="Decline"
                        >
                          <XCircle size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="dropdown-footer">
              <button
                type="button"
                className="btn-create-school"
                onClick={() => {
                  setIsOpen(false);
                  setIsCreateModalOpen(true);
                }}
              >
                <Plus size={15} />
                <span>Create New School</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──────── CREATE NEW SCHOOL MODAL (AGENTS.md Compliant) ──────── */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '480px' }}
            >
              <div className="modal-header">
                <h3>Create New School</h3>
                <p className="modal-subtitle">
                  Set up a new institution tenant. You will be assigned as Administrator.
                </p>
                <button
                  type="button"
                  className="icon-btn-close"
                  onClick={() => setIsCreateModalOpen(false)}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="modal-form">
                <div className="input-group">
                  <label>School Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. St. Jude International Academy"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="input-group">
                  <label>Academic Year</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2024-2025"
                    value={newAcademicYear}
                    onChange={(e) => setNewAcademicYear(e.target.value)}
                  />
                </div>

                <div className="modal-footer-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsCreateModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Sparkles size={15} className="animate-spin" />
                        <span>Provisioning...</span>
                      </>
                    ) : (
                      <span>Create School</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SchoolSwitcher;
