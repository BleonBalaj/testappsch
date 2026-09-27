import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, UserPlus, Mail, Phone, BookOpen, Clock, 
  Shield, GraduationCap, HeartHandshake, Award, Briefcase, 
  Sparkles, Plus, Edit3, Trash2, X, Check, Lock, Filter, 
  Download, MapPin, Calendar, FileText, UserCheck, ChevronRight,
  UserSquare2
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from '../components/Avatar';
import './Staff.css';

// Helper for rendering role icon
export const getRoleIcon = (iconName, size = 14) => {
  switch (iconName) {
    case 'Shield': return <Shield size={size} />;
    case 'GraduationCap': return <GraduationCap size={size} />;
    case 'HeartHandshake': return <HeartHandshake size={size} />;
    case 'Award': return <Award size={size} />;
    case 'Briefcase': return <Briefcase size={size} />;
    default: return <Sparkles size={size} />;
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' }
  }
};

const StaffCard = ({ staff, roleInfo, isAdmin, onEditRole, onDelete, onSelectProfile, onMessage, currentUser }) => {
  const badgeColor = roleInfo?.color || '270 35% 42%';

  const displayStaffName = useMemo(() => {
    if (staff.name && staff.name.toLowerCase() !== 'administrator' && staff.name.toLowerCase() !== 'admin') {
      return staff.name;
    }
    if (currentUser?.uid === staff.id && currentUser?.displayName) {
      return currentUser.displayName;
    }
    if (staff.email) {
      const prefix = staff.email.split('@')[0];
      return prefix.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return staff.name || 'Administrator';
  }, [staff.name, staff.id, staff.email, currentUser?.uid, currentUser?.displayName]);

  return (
    <motion.div 
      className="staff-card glass bouncy"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
    >
      <div className="staff-card-top">
        <div className="staff-avatar-wrap">
          <Avatar alt={displayStaffName} />
        </div>

        <div className="staff-primary-details">
          <div className="staff-header-row">
            <div className="staff-title-group">
              <h3>{displayStaffName}</h3>
              <span className="staff-id-badge">{staff.staffId || `STF-${100 + staff.id}`}</span>
            </div>
            {/* Dynamic Role Badge */}
            <span 
              className="role-badge glass"
              style={{
                background: `hsla(${badgeColor}, 0.15)`,
                color: `hsl(${badgeColor})`,
                borderColor: `hsla(${badgeColor}, 0.35)`
              }}
            >
              {getRoleIcon(roleInfo?.icon, 13)}
              <span>{roleInfo?.name || staff.roleName || 'Staff Member'}</span>
            </span>
          </div>

          <p className="staff-subject">{staff.subject || staff.department}</p>
          
          <div className="staff-meta">
            <div className="meta-item">
              <BookOpen size={14} />
              <span>{staff.classes > 0 ? `${staff.classes} Classes` : staff.department}</span>
            </div>
            <div className="meta-item">
              <Clock size={14} />
              <span>{staff.experience} Exp.</span>
            </div>
            {staff.room && (
              <div className="meta-item room-meta">
                <MapPin size={14} />
                <span>{staff.room}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="staff-contact-grid">
        <a href={`mailto:${staff.email}`} className="contact-pill glass">
          <Mail size={13} />
          <span>{staff.email}</span>
        </a>
        <a href={`tel:${staff.phone}`} className="contact-pill glass">
          <Phone size={13} />
          <span>{staff.phone}</span>
        </a>
      </div>

      <div className="staff-footer-actions">
        <div className="primary-actions">
          <button className="btn-secondary glass btn-small" onClick={() => onSelectProfile(staff)}>
            Profile Details
          </button>
          <button className="btn-primary btn-small" onClick={() => onMessage && onMessage(staff)}>
            Message
          </button>
        </div>

        {isAdmin && (
          <div className="admin-actions-menu">
            <button 
              className="icon-action-btn edit glass" 
              title="Edit Member / Assign Role"
              onClick={() => onEditRole(staff)}
            >
              <Edit3 size={15} />
            </button>
            <button 
              className="icon-action-btn delete glass" 
              title="Remove Staff"
              onClick={() => onDelete(staff.id)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const Staff = ({ userRole = 'admin', onNavigate, addNotification }) => {
  const { staffList, rolesList, addStaff, updateStaff, deleteStaff, addCustomRole, deleteCustomRole } = useSchoolData();
  const { activeSchoolId, getIdTokenSafe, currentUser } = useAuth();
  const { language, t, isAlbanian } = useLanguage();
  const isAdmin = userRole === 'admin';

  const getResolvedStaffName = useCallback((s) => {
    if (!s) return '';
    if (s.name && s.name.toLowerCase() !== 'administrator' && s.name.toLowerCase() !== 'admin') {
      return s.name;
    }
    if (currentUser?.uid === s.id && currentUser?.displayName) {
      return currentUser.displayName;
    }
    if (s.email) {
      const prefix = s.email.split('@')[0];
      return prefix.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return s.name || 'Administrator';
  }, [currentUser]);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');

  // Modals state
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState(null); // confirm-delete state

  // New Staff Form State
  const [newStaffForm, setNewStaffForm] = useState({
    staffId: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    roleId: 'teacher',
    department: 'Mathematics',
    subject: '',
    classes: 3,
    experience: '5 years',
    room: '',
    bio: '',
    avatarSeed: ''
  });

  // New Custom Role Form State
  const [newRoleForm, setNewRoleForm] = useState({
    name: '',
    category: 'Academic Leadership',
    color: '335 70% 65%',
    icon: 'Sparkles',
    description: ''
  });

  const COLOR_PALETTE = [
    { label: 'Rose Purple', value: '335 70% 65%' },
    { label: 'Emerald Green', value: '142 70% 45%' },
    { label: 'Electric Blue', value: '215 85% 60%' },
    { label: 'Sunset Amber', value: '38 92% 50%' },
    { label: 'Violet Dream', value: '270 65% 60%' },
    { label: 'Ruby Red', value: '350 75% 58%' },
    { label: 'Cyan Aqua', value: '185 80% 45%' },
    { label: 'Midnight Indigo', value: '240 60% 60%' }
  ];

  const departments = useMemo(() => {
    const depts = new Set(staffList.map(s => s.department).filter(Boolean));
    return ['all', ...Array.from(depts)];
  }, [staffList]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter(s => {
      const query = searchTerm.toLowerCase();
      const matchesSearch = 
        s.name.toLowerCase().includes(query) ||
        (s.staffId && s.staffId.toLowerCase().includes(query)) ||
        s.email.toLowerCase().includes(query) ||
        (s.subject && s.subject.toLowerCase().includes(query)) ||
        (s.department && s.department.toLowerCase().includes(query));

      const matchesRole = selectedRoleFilter === 'all' || s.roleId === selectedRoleFilter;
      const matchesDept = selectedDeptFilter === 'all' || s.department === selectedDeptFilter;

      return matchesSearch && matchesRole && matchesDept;
    });
  }, [staffList, searchTerm, selectedRoleFilter, selectedDeptFilter]);

  // Handle Add Staff Submit with Firebase Auth user provisioning
  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    if (!newStaffForm.name || !newStaffForm.email) return;

    if (newStaffForm.password && newStaffForm.password.length < 6) {
      if (addNotification) addNotification('error', 'Initial password must be at least 6 characters long when provided.');
      return;
    }

    const matchedRole = rolesList.find(r => r.id === newStaffForm.roleId);
    const customStaffId = newStaffForm.staffId.trim() || `STF-${Math.floor(100 + Math.random() * 900)}`;

    setIsSubmittingStaff(true);
    try {
      const result = await addStaff({
        ...newStaffForm,
        staffId: customStaffId,
        roleName: matchedRole?.name || 'Staff Member',
        classes: Number(newStaffForm.classes) || 0
      });

      if (addNotification) {
        addNotification('success', result?.alreadyMember
          ? `${newStaffForm.name} already belongs to this school.`
          : result?.isExisting
            ? `${newStaffForm.name}'s existing account was linked to this school.`
            : `Staff member ${newStaffForm.name} registered as a Firebase user! ✨`);
      }

      setIsAddStaffOpen(false);
      setNewStaffForm({
        staffId: '',
        name: '',
        email: '',
        password: '',
        phone: '',
        roleId: 'teacher',
        department: 'Mathematics',
        subject: '',
        classes: 3,
        experience: '5 years',
        room: '',
        bio: '',
        avatarSeed: ''
      });
    } catch (err) {
      console.error('Failed to add staff:', err);
      if (addNotification) {
        addNotification('error', err.message || 'Failed to register staff in Firebase.');
      }
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // Handle Edit / Role Reassignment Submit
  const handleEditStaffSubmit = async (e) => {
    e.preventDefault();
    if (!editingStaff) return;

    const matchedRole = rolesList.find(r => r.id === editingStaff.roleId);
    try {
      await updateStaff(editingStaff.id, {
        ...editingStaff,
        staffId: editingStaff.staffId || `STF-${100 + editingStaff.id}`,
        roleName: matchedRole?.name || editingStaff.roleName,
        classes: Number(editingStaff.classes) || 0
      });
      setEditingStaff(null);
      addNotification?.('success', isAlbanian ? 'Të dhënat dhe roli i stafit u ruajtën.' : 'Staff details and role saved.');
    } catch (error) {
      addNotification?.('error', error.message || 'Could not update staff.');
    }
  };

  // Handle Add Custom Role Submit
  const handleAddCustomRoleSubmit = (e) => {
    e.preventDefault();
    if (!newRoleForm.name) return;

    addCustomRole(newRoleForm);
    setNewRoleForm({
      name: '',
      category: 'Academic Leadership',
      color: '335 70% 65%',
      icon: 'Sparkles',
      description: ''
    });
  };

  // Export Staff Directory
  const handleExportDirectory = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      ["Name,Role,Department,Subject,Email,Phone,Experience,Room"].join(",") + "\n" +
      filteredStaff.map(s => `"${s.name}","${s.roleName || ''}","${s.department || ''}","${s.subject || ''}","${s.email}","${s.phone}","${s.experience}","${s.room || ''}"`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NoesisHorizon_Staff_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      className="staff-page"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.header className="page-header" variants={itemVariants}>
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              {t('staff.title')}
              <UserSquare2 size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">{`${filteredStaff.length} ${t('common.total')}`}</span>
          </div>
          <p>{t('staff.subtitle')}</p>
        </div>

        <div className="header-actions">
          <button className="btn-secondary glass" onClick={handleExportDirectory} title="Export CSV Directory">
            <Download size={18} />
            Export
          </button>

          {isAdmin ? (
            <>
              <button className="btn-secondary glass" onClick={() => setIsRoleManagerOpen(true)}>
                <Shield size={18} />
                Manage Roles
              </button>
              <button className="btn-primary" onClick={() => setIsAddStaffOpen(true)}>
                <UserPlus size={18} />
                {t('staff.inviteStaff')}
              </button>
            </>
          ) : (
            <div className="role-locked-badge glass" title="Only administrators can add staff or manage roles">
              <Lock size={15} />
              <span>Admin Mode Required to Edit</span>
            </div>
          )}
        </div>
      </motion.header>

      {/* Role and Department Filters */}
      <motion.div className="staff-controls-container glass" variants={itemVariants}>
        {/* Search Input */}
        <div className="search-bar-wrap">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={t('staff.search')} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Role Filter Pills */}
        <div className="role-filter-row">
          <div className="filter-label">
            <Filter size={14} />
            <span>Role:</span>
          </div>
          <div className="filter-pills-scroll">
            <button 
              className={`filter-pill ${selectedRoleFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedRoleFilter('all')}
            >
              All Staff ({staffList.length})
            </button>
            {rolesList.map(role => {
              const count = staffList.filter(s => s.roleId === role.id).length;
              return (
                <button
                  key={role.id}
                  className={`filter-pill ${selectedRoleFilter === role.id ? 'active' : ''}`}
                  onClick={() => setSelectedRoleFilter(role.id)}
                  style={{
                    borderColor: selectedRoleFilter === role.id ? `hsl(${role.color})` : undefined
                  }}
                >
                  <span className="pill-dot" style={{ backgroundColor: `hsl(${role.color})` }} />
                  {role.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Department Quick Filter */}
        <div className="dept-filter-row">
          <span className="filter-label-sub">Department:</span>
          <div className="dept-tags">
            {departments.map(dept => (
              <button
                key={dept}
                className={`dept-tag ${selectedDeptFilter === dept ? 'active' : ''}`}
                onClick={() => setSelectedDeptFilter(dept)}
              >
                {dept === 'all' ? 'All Departments' : dept}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Staff Grid */}
      {filteredStaff.length === 0 ? (
        <div className="empty-staff-state glass">
          <div className="empty-icon-box glass">
            <Search size={32} />
          </div>
          <h3>No staff members found</h3>
          <p>Try refining your search query or clear the active role and department filters.</p>
          <button 
            className="btn-secondary glass btn-small"
            onClick={() => { setSearchTerm(''); setSelectedRoleFilter('all'); setSelectedDeptFilter('all'); }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <motion.div className="staff-grid" variants={itemVariants}>
          <AnimatePresence>
            {filteredStaff.map(staff => {
              const roleInfo = rolesList.find(r => r.id === staff.roleId);
              return (
                <StaffCard
                  key={staff.id}
                  staff={staff}
                  roleInfo={roleInfo}
                  isAdmin={isAdmin}
                  onEditRole={(member) => setEditingStaff({ ...member })}
                  onDelete={(id) => setStaffToDelete(staffList.find(s => String(s.id) === String(id)) || { id })}
                  onSelectProfile={(member) => setSelectedProfile(member)}
                  onMessage={() => onNavigate && onNavigate('messages')}
                  currentUser={currentUser}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── MODAL: Add Staff Member ── */}
      <AnimatePresence>
        {isAddStaffOpen && (
          <div className="modal-overlay" onClick={() => setIsAddStaffOpen(false)}>
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Regjistro Anëtar të Stafit' : 'Register Staff Member'}</h3>
                <p className="modal-subtitle">
                  {isAlbanian ? 'Shtoni fakultet ose staf për të caktuar kurse dhe leje të personalizuara.' : 'Add faculty or staff to assign courses and custom permissions.'}
                </p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddStaffOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddStaffSubmit} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Emri i Plotë *' : 'Full Name *'}</label>
                    <input 
                      type="text" 
                      required 
                      placeholder={isAlbanian ? 'p.sh. Dr. Agim Krasniqi' : 'e.g. Dr. Arthur Pendelton'}
                      value={newStaffForm.name}
                      onChange={e => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'ID e Punonjësit / Stafit' : 'Employee / Staff ID'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. STF-107 (Gjenerohet vetvetiu nëse lihet bosh)' : 'e.g. STF-107 (Auto-generated if blank)'}
                      value={newStaffForm.staffId}
                      onChange={e => setNewStaffForm({ ...newStaffForm, staffId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Adresa e Email-it *' : 'Email Address *'}</label>
                    <input 
                      type="email" 
                      required 
                      placeholder={isAlbanian ? 'p.sh. agim.k@lumischool.edu' : 'e.g. arthur.p@lumischool.edu'}
                      value={newStaffForm.email}
                      onChange={e => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Fjalëkalimi Fillestar i Hyrjes' : 'Initial Login Password'}</label>
                    <input 
                      type="password" 
                      minLength={6}
                      placeholder={isAlbanian ? 'Kërkohet vetëm për llogari të reja (min. 6)' : 'Needed only for new accounts (min. 6)'}
                      value={newStaffForm.password || ''}
                      onChange={e => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Roli i Caktuar' : 'Assigned Role'}</label>
                    <select 
                      value={newStaffForm.roleId}
                      onChange={e => setNewStaffForm({ ...newStaffForm, roleId: e.target.value })}
                      className="custom-form-select"
                    >
                      {rolesList.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Numri i Telefonit' : 'Phone Number'}</label>
                    <input 
                      type="tel" 
                      placeholder="e.g. +383 44 123 456"
                      value={newStaffForm.phone}
                      onChange={e => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Departamenti' : 'Department'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. Shkencë / Matematikë' : 'e.g. Science / Math'}
                      value={newStaffForm.department}
                      onChange={e => setNewStaffForm({ ...newStaffForm, department: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Lënda / Specialiteti' : 'Subject / Specialty'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. Kimi e Avancuar' : 'e.g. AP Chemistry'}
                      value={newStaffForm.subject}
                      onChange={e => setNewStaffForm({ ...newStaffForm, subject: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Zyra / Salla #' : 'Office / Room #'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. Laboratori 4' : 'e.g. Science Lab 4'}
                      value={newStaffForm.room}
                      onChange={e => setNewStaffForm({ ...newStaffForm, room: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Vite Përvoje' : 'Years of Experience'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. 6 vite' : 'e.g. 6 years'}
                      value={newStaffForm.experience}
                      onChange={e => setNewStaffForm({ ...newStaffForm, experience: e.target.value })}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>{isAlbanian ? 'Biografia Profesionale / Shënime (Ops.)' : 'Professional Bio / Notes (Opt.)'}</label>
                  <textarea 
                    placeholder={isAlbanian ? 'Përshkrim i shkurtër, certifikime dhe filozofia e mësimdhënies...' : 'Brief background, certifications, and teaching philosophy...'}
                    rows={2}
                    value={newStaffForm.bio}
                    onChange={e => setNewStaffForm({ ...newStaffForm, bio: e.target.value })}
                  />
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddStaffOpen(false)} disabled={isSubmittingStaff}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSubmittingStaff}>
                    {isSubmittingStaff 
                      ? (isAlbanian ? 'Duke krijuar llogarinë në Firebase...' : 'Creating User in Firebase...') 
                      : (isAlbanian ? 'Regjistro Anëtarin e Stafit' : 'Register Staff Member')}
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Edit Member / Reassign Role ── */}
      <AnimatePresence>
        {editingStaff && (
          <div className="modal-overlay" onClick={() => setEditingStaff(null)}>
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Ndrysho Anëtarin e Stafit' : 'Edit Staff Member'}</h3>
                <p className="modal-subtitle">
                  {isAlbanian ? 'Përditësoni të dhënat e kontaktit, departamentin ose ndryshoni rolet.' : 'Update contact information, department, or reassign roles.'}
                </p>
                <button type="button" className="icon-btn-close" onClick={() => setEditingStaff(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleEditStaffSubmit} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Emri i Plotë i Anëtarit *' : 'Staff Member Full Name *'}</label>
                    <input 
                      type="text" 
                      required
                      value={editingStaff.name}
                      onChange={e => setEditingStaff({ ...editingStaff, name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'ID e Punonjësit / Stafit' : 'Employee / Staff ID'}</label>
                    <input 
                      type="text" 
                      value={editingStaff.staffId || `STF-${100 + editingStaff.id}`}
                      onChange={e => setEditingStaff({ ...editingStaff, staffId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>{isAlbanian ? 'Cakto Rolin & Privilegjet' : 'Assign Role & Privileges'}</label>
                  <div className="roles-selector-grid">
                    {rolesList.map(r => (
                      <div 
                        key={r.id}
                        className={`role-option-card ${editingStaff.roleId === r.id ? 'selected' : ''}`}
                        style={{
                          borderColor: editingStaff.roleId === r.id ? `hsl(${r.color})` : undefined
                        }}
                        onClick={() => setEditingStaff({ ...editingStaff, roleId: r.id, roleName: r.name })}
                      >
                        <div className="role-option-top">
                          <span 
                            className="role-badge-preview"
                            style={{ background: `hsla(${r.color}, 0.2)`, color: `hsl(${r.color})` }}
                          >
                            {getRoleIcon(r.icon, 14)}
                            <strong>{r.name}</strong>
                          </span>
                          {editingStaff.roleId === r.id && <Check size={16} color={`hsl(${r.color})`} />}
                        </div>
                        <p className="role-option-desc">{r.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Departamenti' : 'Department'}</label>
                    <input 
                      type="text" 
                      value={editingStaff.department || ''}
                      onChange={e => setEditingStaff({ ...editingStaff, department: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>{isAlbanian ? 'Specialiteti / Lënda' : 'Specialty / Subject'}</label>
                    <input 
                      type="text" 
                      value={editingStaff.subject || ''}
                      onChange={e => setEditingStaff({ ...editingStaff, subject: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Adresa e Email-it (identiteti i hyrjes)' : 'Email Address (login identity)'}</label>
                    <input 
                      type="email" 
                      value={editingStaff.email || ''}
                      readOnly
                    />
                  </div>
                  <div className="input-group">
                    <label>{isAlbanian ? 'Numri i Telefonit' : 'Phone'}</label>
                    <input 
                      type="tel" 
                      value={editingStaff.phone || ''}
                      onChange={e => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setEditingStaff(null)}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary">
                    <Check size={18} />
                    {isAlbanian ? 'Ruaj & Përditëso' : 'Save & Update'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Custom Role Manager ── */}
      <AnimatePresence>
        {isRoleManagerOpen && (
          <div className="modal-overlay" onClick={() => setIsRoleManagerOpen(false)}>
            <motion.div 
              className="modal-content role-manager-modal"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-title-wrap">
                  <Shield className="modal-icon-header" size={22} />
                  <div>
                    <h3>{isAlbanian ? 'Rolet & Kontrolli i Qasjes' : 'Roles & Access Control'}</h3>
                    <p className="modal-subtitle">
                      {isAlbanian ? 'Përcaktoni rolet e institucionit, ngjyrat e caktuara dhe shikoni numrin e stafit.' : 'Define institution roles, assigned swatches, and view faculty counts.'}
                    </p>
                  </div>
                </div>
                <button type="button" className="icon-btn-close" onClick={() => setIsRoleManagerOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="role-manager-layout">
                {/* Left side: Role List */}
                <div className="role-list-pane">
                  <h4>{isAlbanian ? 'Rolet Aktive në Shkollë' : 'Active Roles in Noesis Horizon'}</h4>
                  <div className="role-cards-container">
                    {rolesList.map(role => {
                      const count = staffList.filter(s => s.roleId === role.id).length;
                      return (
                        <div key={role.id} className="role-summary-card glass">
                          <div className="role-summary-top">
                            <span 
                              className="role-badge glass"
                              style={{ background: `hsla(${role.color}, 0.2)`, color: `hsl(${role.color})` }}
                            >
                              {getRoleIcon(role.icon, 14)}
                              <span>{role.name}</span>
                            </span>
                            <span className="member-count">
                              {count} {isAlbanian ? (count === 1 ? 'anëtar' : 'anëtarë') : (count === 1 ? 'member' : 'members')}
                            </span>
                          </div>
                          <p className="role-summary-desc">{role.description}</p>
                          {role.isCustom && (
                            <div className="role-custom-footer">
                              <span className="custom-indicator">{isAlbanian ? 'Rol i Personalizuar' : 'Custom Role'}</span>
                              <button 
                                className="delete-role-btn"
                                onClick={() => deleteCustomRole(role.id)}
                                title={isAlbanian ? 'Fshi Rolin e Personalizuar' : 'Delete Custom Role'}
                              >
                                <Trash2 size={13} /> {isAlbanian ? 'Fshi Rolin' : 'Delete Role'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right side: Add New Custom Role */}
                <div className="role-create-pane glass">
                  <h4>{isAlbanian ? 'Krijo Rol të Ri ✨' : 'Create Custom Role ✨'}</h4>
                  <form onSubmit={handleAddCustomRoleSubmit} className="custom-role-form">
                    <div className="input-group">
                      <label>{isAlbanian ? 'Emri i Rolit *' : 'Role Name *'}</label>
                      <input 
                        type="text" 
                        required 
                        placeholder={isAlbanian ? 'p.sh. Dekan i Studentëve, Koordinator' : 'e.g. Dean of Students, Lab Coordinator'}
                        value={newRoleForm.name}
                        onChange={e => setNewRoleForm({ ...newRoleForm, name: e.target.value })}
                      />
                    </div>

                    <div className="input-group">
                      <label>{isAlbanian ? 'Kategoria' : 'Category'}</label>
                      <select 
                        value={newRoleForm.category}
                        onChange={e => setNewRoleForm({ ...newRoleForm, category: e.target.value })}
                        className="custom-form-select"
                      >
                        <option value="Academic Leadership">{isAlbanian ? 'Udhëheqje Akademike' : 'Academic Leadership'}</option>
                        <option value="Administration">{isAlbanian ? 'Administratë' : 'Administration'}</option>
                        <option value="Student Support">{isAlbanian ? 'Mbështetje e Studentëve' : 'Student Support'}</option>
                        <option value="Operations & Tech">{isAlbanian ? 'Operacione & Teknologji' : 'Operations & Tech'}</option>
                        <option value="Athletics & Arts">{isAlbanian ? 'Sport & Arte' : 'Athletics & Arts'}</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label>{isAlbanian ? 'Ngjyra e Shenjës' : 'Badge Color Palette'}</label>
                      <div className="color-palette-grid">
                        {COLOR_PALETTE.map(c => (
                          <button
                            key={c.value}
                            type="button"
                            className={`color-swatch ${newRoleForm.color === c.value ? 'selected' : ''}`}
                            style={{ backgroundColor: `hsl(${c.value})` }}
                            onClick={() => setNewRoleForm({ ...newRoleForm, color: c.value })}
                            title={c.label}
                          >
                            {newRoleForm.color === c.value && <Check size={14} color="#fff" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="input-group">
                      <label>{isAlbanian ? 'Përshkrimi & Fushëveprimi' : 'Description & Scope'}</label>
                      <textarea 
                        rows={2}
                        placeholder={isAlbanian ? 'Përcaktoni përgjegjësitë dhe privilegjet kryesore...' : 'Specify key responsibilities and privileges...'}
                        value={newRoleForm.description}
                        onChange={e => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                      />
                    </div>

                    <button type="submit" className="btn-primary create-role-btn">
                      <Plus size={16} />
                      {isAlbanian ? 'Shto Rolin e Personalizuar' : 'Add Custom Role'}
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Staff Profile Detail Drawer ── */}
      <AnimatePresence>
        {selectedProfile && (
          <div className="modal-overlay" onClick={() => setSelectedProfile(null)}>
            <motion.div 
              className="modal-content staff-profile-modal glass"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Staff Profile Card</h3>
                <button className="icon-btn-close" onClick={() => setSelectedProfile(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="profile-drawer-body">
                <div className="profile-drawer-hero glass">
                  <div className="drawer-avatar">
                    <Avatar alt={getResolvedStaffName(selectedProfile)} />
                  </div>
                  <div className="drawer-hero-info">
                    <h2>{getResolvedStaffName(selectedProfile)}</h2>
                    <span 
                      className="role-badge glass"
                      style={{
                        background: `hsla(${rolesList.find(r => r.id === selectedProfile.roleId)?.color || '270 35% 42%'}, 0.2)`,
                        color: `hsl(${rolesList.find(r => r.id === selectedProfile.roleId)?.color || '270 35% 42%'})`
                      }}
                    >
                      {getRoleIcon(rolesList.find(r => r.id === selectedProfile.roleId)?.icon, 14)}
                      <span>{selectedProfile.roleName}</span>
                    </span>
                    <p className="drawer-subject-text">{selectedProfile.department} • {selectedProfile.subject}</p>
                  </div>
                </div>

                <div className="profile-stats-grid">
                  <div className="p-stat glass">
                    <span className="p-stat-label">Employee ID</span>
                    <strong>{selectedProfile.staffId || `STF-${100 + selectedProfile.id}`}</strong>
                  </div>
                  <div className="p-stat glass">
                    <span className="p-stat-label">{isAlbanian ? 'Departamenti' : 'Department'}</span>
                    <strong>{selectedProfile.department || (isAlbanian ? 'Fakultet i Përgjithshëm' : 'General Faculty')}</strong>
                  </div>
                  <div className="p-stat glass">
                    <span className="p-stat-label">Classes</span>
                    <strong>{selectedProfile.classes} Courses</strong>
                  </div>
                  <div className="p-stat glass">
                    <span className="p-stat-label">Tenure</span>
                    <strong>{selectedProfile.experience}</strong>
                  </div>
                  <div className="p-stat glass">
                    <span className="p-stat-label">Office</span>
                    <strong>{selectedProfile.room || 'General Faculty'}</strong>
                  </div>
                </div>

                <div className="drawer-bio-box glass">
                  <h4>Biography & Specialization</h4>
                  <p>{selectedProfile.bio || 'Dedicated educator and staff member committed to student success at Noesis Horizon.'}</p>
                </div>

                <div className="drawer-contact-box glass">
                  <h4>Direct Contacts</h4>
                  <div className="contacts-list">
                    <a href={`mailto:${selectedProfile.email}`} className="contact-row">
                      <Mail size={16} />
                      <span>{selectedProfile.email}</span>
                    </a>
                    <a href={`tel:${selectedProfile.phone}`} className="contact-row">
                      <Phone size={16} />
                      <span>{selectedProfile.phone}</span>
                    </a>
                  </div>
                </div>

                <div className="modal-actions">
                  <button className="btn-secondary glass" onClick={() => setSelectedProfile(null)}>
                    Close
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={() => {
                      setSelectedProfile(null);
                      onNavigate && onNavigate('messages');
                    }}
                  >
                    <Mail size={16} />
                    Send Direct Message
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Confirm Delete Staff Member ── */}
      <AnimatePresence>
        {staffToDelete && (
          <div className="modal-overlay" onClick={() => setStaffToDelete(null)}>
            <motion.div
              className="modal-content"
              style={{ maxWidth: '420px' }}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Largo Anëtarin e Stafit?' : 'Remove Staff Member?'}</h3>
                <p className="modal-subtitle">{isAlbanian ? 'Ky veprim nuk mund të kthehet prapa.' : 'This action cannot be undone.'}</p>
                <button type="button" className="icon-btn-close" onClick={() => setStaffToDelete(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <div className="modal-form" style={{ gap: '1rem' }}>
                <div style={{
                  background: 'hsla(0, 75%, 65%, 0.1)',
                  border: '1px solid hsla(0, 75%, 65%, 0.3)',
                  borderRadius: '12px',
                  padding: '1rem',
                  color: 'hsl(var(--foreground))',
                  fontSize: '0.9rem',
                  lineHeight: 1.55
                }}>
                  <strong style={{ display: 'block', marginBottom: '0.4rem' }}>
                    {staffToDelete.name || (isAlbanian ? 'Ky anëtar i stafit' : 'This staff member')}
                  </strong>
                  {isAlbanian 
                    ? 'do të fshihet përgjithmonë nga kjo shkollë. Qasja e tyre e hyrjes do të revokohet menjëherë.' 
                    : 'will be permanently removed from this school. Their login access will be revoked immediately. If they have no other school memberships they will see a "not part of any school" screen on next login.'}
                </div>
                <div className="modal-footer-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setStaffToDelete(null)}
                  >
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: 'hsl(0, 75%, 60%)', borderColor: 'hsl(0, 75%, 55%)' }}
                    onClick={async () => {
                      const target = staffToDelete;
                      setStaffToDelete(null);
                      try {
                        await deleteStaff(target.id);
                        if (addNotification) addNotification('success', isAlbanian ? `${target.name || 'Anëtari i stafit'} u largua nga shkolla.` : `${target.name || 'Staff member'} removed from school.`);
                      } catch (err) {
                        console.error('Failed to remove staff:', err);
                        if (addNotification) addNotification('error', err.message || (isAlbanian ? 'Dështoi largimi i anëtarit të stafit.' : 'Failed to remove staff member.'));
                      }
                    }}
                  >
                    <Trash2 size={15} />
                    {isAlbanian ? 'Po, Largoje' : 'Yes, Remove'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Staff;
