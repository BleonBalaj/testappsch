import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, UserPlus, Mail, Phone, BookOpen, Clock, Star, 
  Shield, GraduationCap, HeartHandshake, Award, Briefcase, 
  Sparkles, Plus, Edit3, Trash2, X, Check, Lock, Filter, 
  Download, MapPin, Calendar, FileText, UserCheck, ChevronRight,
  UserSquare2
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
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

const StaffCard = ({ staff, roleInfo, isAdmin, onEditRole, onDelete, onSelectProfile, onMessage }) => {
  const badgeColor = roleInfo?.color || '270 35% 42%';

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
          <Avatar alt={staff.name} />
          <div className="rating-badge glass">
            <Star size={12} fill="hsl(var(--primary))" color="hsl(var(--primary))" />
            <span>{staff.rating || '5.0'}</span>
          </div>
        </div>

        <div className="staff-primary-details">
          <div className="staff-header-row">
            <div className="staff-title-group">
              <h3>{staff.name}</h3>
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

const Staff = ({ userRole = 'admin', onNavigate }) => {
  const { staffList, rolesList, addStaff, updateStaff, deleteStaff, addCustomRole, deleteCustomRole } = useSchoolData();
  const isAdmin = userRole === 'admin';

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');

  // Modals state
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);

  // New Staff Form State
  const [newStaffForm, setNewStaffForm] = useState({
    staffId: '',
    name: '',
    email: '',
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

  // Handle Add Staff Submit
  const handleAddStaffSubmit = (e) => {
    e.preventDefault();
    if (!newStaffForm.name || !newStaffForm.email) return;

    const matchedRole = rolesList.find(r => r.id === newStaffForm.roleId);
    const customStaffId = newStaffForm.staffId.trim() || `STF-${Math.floor(100 + Math.random() * 900)}`;

    addStaff({
      ...newStaffForm,
      staffId: customStaffId,
      roleName: matchedRole?.name || 'Staff Member',
      classes: Number(newStaffForm.classes) || 0
    });

    setIsAddStaffOpen(false);
    setNewStaffForm({
      staffId: '',
      name: '',
      email: '',
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
  };

  // Handle Edit / Role Reassignment Submit
  const handleEditStaffSubmit = (e) => {
    e.preventDefault();
    if (!editingStaff) return;

    const matchedRole = rolesList.find(r => r.id === editingStaff.roleId);
    updateStaff(editingStaff.id, {
      ...editingStaff,
      staffId: editingStaff.staffId || `STF-${100 + editingStaff.id}`,
      roleName: matchedRole?.name || editingStaff.roleName,
      classes: Number(editingStaff.classes) || 0
    });

    setEditingStaff(null);
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
    <div className="staff-page">
      {/* Header */}
      <header className="page-header">
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              Staff & Faculty Directory
              <UserSquare2 size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">{filteredStaff.length} Members</span>
          </div>
          <p>Explore educators, administrators, and specialized faculty supporting Noesis Horizon.</p>
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
                Add Staff
              </button>
            </>
          ) : (
            <div className="role-locked-badge glass" title="Only administrators can add staff or manage roles">
              <Lock size={15} />
              <span>Admin Mode Required to Edit</span>
            </div>
          )}
        </div>
      </header>

      {/* Role and Department Filters */}
      <div className="staff-controls-container glass">
        {/* Search Input */}
        <div className="search-bar-wrap">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by name, email, department, subject, or role..." 
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
      </div>

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
        <div className="staff-grid">
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
                  onDelete={(id) => deleteStaff(id)}
                  onSelectProfile={(member) => setSelectedProfile(member)}
                  onMessage={() => onNavigate && onNavigate('messages')}
                />
              );
            })}
          </AnimatePresence>
        </div>
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
                <h3>Register Staff Member</h3>
                <p className="modal-subtitle">Add faculty or staff to assign courses and custom permissions.</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddStaffOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddStaffSubmit} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Full Name *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Dr. Arthur Pendelton"
                      value={newStaffForm.name}
                      onChange={e => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Employee / Staff ID</label>
                    <input 
                      type="text" 
                      placeholder="e.g. STF-107 (Auto-generated if blank)"
                      value={newStaffForm.staffId}
                      onChange={e => setNewStaffForm({ ...newStaffForm, staffId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Email Address *</label>
                    <input 
                      type="email" 
                      required 
                      placeholder="e.g. arthur.p@lumischool.edu"
                      value={newStaffForm.email}
                      onChange={e => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="e.g. +1 (555) 019-283"
                      value={newStaffForm.phone}
                      onChange={e => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Assigned Role</label>
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

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Department</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Science / Math"
                      value={newStaffForm.department}
                      onChange={e => setNewStaffForm({ ...newStaffForm, department: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Subject / Specialty</label>
                    <input 
                      type="text" 
                      placeholder="e.g. AP Chemistry"
                      value={newStaffForm.subject}
                      onChange={e => setNewStaffForm({ ...newStaffForm, subject: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Office / Room #</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Science Lab 4"
                      value={newStaffForm.room}
                      onChange={e => setNewStaffForm({ ...newStaffForm, room: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Years of Experience</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 6 years"
                      value={newStaffForm.experience}
                      onChange={e => setNewStaffForm({ ...newStaffForm, experience: e.target.value })}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Professional Bio / Notes (Opt.)</label>
                  <textarea 
                    placeholder="Brief background, certifications, and teaching philosophy..."
                    rows={2}
                    value={newStaffForm.bio}
                    onChange={e => setNewStaffForm({ ...newStaffForm, bio: e.target.value })}
                  />
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddStaffOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Register Staff Member
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
                <h3>Edit Staff Member</h3>
                <p className="modal-subtitle">Update contact information, department, or reassign roles.</p>
                <button type="button" className="icon-btn-close" onClick={() => setEditingStaff(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleEditStaffSubmit} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Staff Member Full Name *</label>
                    <input 
                      type="text" 
                      required
                      value={editingStaff.name}
                      onChange={e => setEditingStaff({ ...editingStaff, name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Employee / Staff ID</label>
                    <input 
                      type="text" 
                      value={editingStaff.staffId || `STF-${100 + editingStaff.id}`}
                      onChange={e => setEditingStaff({ ...editingStaff, staffId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Assign Role & Privileges</label>
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
                    <label>Department</label>
                    <input 
                      type="text" 
                      value={editingStaff.department || ''}
                      onChange={e => setEditingStaff({ ...editingStaff, department: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Specialty / Subject</label>
                    <input 
                      type="text" 
                      value={editingStaff.subject || ''}
                      onChange={e => setEditingStaff({ ...editingStaff, subject: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      value={editingStaff.email || ''}
                      onChange={e => setEditingStaff({ ...editingStaff, email: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Phone</label>
                    <input 
                      type="tel" 
                      value={editingStaff.phone || ''}
                      onChange={e => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setEditingStaff(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    <Check size={18} />
                    Save & Update
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
                    <h3>Roles & Access Control</h3>
                    <p className="modal-subtitle">Define institution roles, assigned swatches, and view faculty counts.</p>
                  </div>
                </div>
                <button type="button" className="icon-btn-close" onClick={() => setIsRoleManagerOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="role-manager-layout">
                {/* Left side: Role List */}
                <div className="role-list-pane">
                  <h4>Active Roles in Noesis Horizon</h4>
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
                            <span className="member-count">{count} {count === 1 ? 'member' : 'members'}</span>
                          </div>
                          <p className="role-summary-desc">{role.description}</p>
                          {role.isCustom && (
                            <div className="role-custom-footer">
                              <span className="custom-indicator">Custom Role</span>
                              <button 
                                className="delete-role-btn"
                                onClick={() => deleteCustomRole(role.id)}
                                title="Delete Custom Role"
                              >
                                <Trash2 size={13} /> Delete Role
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
                  <h4>Create Custom Role ✨</h4>
                  <form onSubmit={handleAddCustomRoleSubmit} className="custom-role-form">
                    <div className="input-group">
                      <label>Role Name *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Dean of Students, Lab Coordinator"
                        value={newRoleForm.name}
                        onChange={e => setNewRoleForm({ ...newRoleForm, name: e.target.value })}
                      />
                    </div>

                    <div className="input-group">
                      <label>Category</label>
                      <select 
                        value={newRoleForm.category}
                        onChange={e => setNewRoleForm({ ...newRoleForm, category: e.target.value })}
                        className="custom-form-select"
                      >
                        <option value="Academic Leadership">Academic Leadership</option>
                        <option value="Administration">Administration</option>
                        <option value="Student Support">Student Support</option>
                        <option value="Operations & Tech">Operations & Tech</option>
                        <option value="Athletics & Arts">Athletics & Arts</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label>Badge Color Palette</label>
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
                      <label>Description & Scope</label>
                      <textarea 
                        rows={2}
                        placeholder="Specify key responsibilities and privileges..."
                        value={newRoleForm.description}
                        onChange={e => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                      />
                    </div>

                    <button type="submit" className="btn-primary create-role-btn">
                      <Plus size={16} />
                      Add Custom Role
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
                    <Avatar alt={selectedProfile.name} />
                  </div>
                  <div className="drawer-hero-info">
                    <h2>{selectedProfile.name}</h2>
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
                    <span className="p-stat-label">Rating</span>
                    <strong>⭐ {selectedProfile.rating || '5.0'} / 5.0</strong>
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
    </div>
  );
};

export default Staff;
