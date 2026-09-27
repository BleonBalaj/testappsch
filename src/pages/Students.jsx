import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, UserPlus, Filter, MoreVertical, Mail, Phone, 
  MapPin, X, Check, Download, Trash2, Edit3, Award, Star, 
  GraduationCap, BookOpen, ShieldAlert, Archive, ArchiveRestore,
  AlertTriangle, AlertCircle, CheckCircle2, RotateCcw, Users
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { Avatar } from '../components/Avatar';
import './Students.css';

const StudentCard = ({ student, index, onSelect, onRequestDelete, onToggleArchive, isAdmin }) => {
  const isArchived = student.status === 'archived';
  const isUnassigned = !isArchived && (!student.assignedClasses || student.assignedClasses.length === 0);

  return (
    <motion.div 
      className={`student-card bouncy ${isArchived ? 'is-archived' : ''}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.04 }}
      layout
      onClick={() => onSelect && onSelect(student)}
      style={{ cursor: 'pointer' }}
    >
      <div className="student-card-header">
        <div className="student-avatar-large">
          <Avatar alt={student.name} />
          <div className="student-points-badge bouncy">
            👑 {student.points || 500}
          </div>
        </div>
        <div className="header-actions-right" onClick={e => e.stopPropagation()}>
          {/* Status Badges */}
          {isArchived ? (
            <span className="student-status-badge archived">
              <Archive size={12} /> Archived
            </span>
          ) : isUnassigned ? (
            <span className="student-status-badge unassigned" title="Student is active but not assigned to any classes yet">
              <AlertTriangle size={12} /> No Classes
            </span>
          ) : (
            <span className="student-status-badge active">
              <CheckCircle2 size={12} /> Active
            </span>
          )}
          
          {isAdmin && (
            <div className="admin-card-actions">
              <button 
                type="button"
                className="archive-student-card-btn" 
                title={isArchived ? 'Restore / Unarchive Student' : 'Archive Student'}
                onClick={() => onToggleArchive && onToggleArchive(student.id)}
              >
                {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              </button>
              <button 
                type="button"
                className="delete-student-card-btn" 
                title="Permanently Delete Student"
                onClick={() => onRequestDelete && onRequestDelete(student)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="student-card-body">
        <div className="student-card-title-row">
          <h3>{student.name}</h3>
          <span className="student-id-badge">{student.studentId || `STU-${1000 + student.id}`}</span>
        </div>
        <p className="student-grade">Grade {student.grade} • GPA {student.gpa || '3.8'}</p>
        
        {/* Enrolled Classes Badges */}
        <div className="student-classes-list">
          {student.assignedClasses && student.assignedClasses.length > 0 ? (
            student.assignedClasses.map(cls => (
              <span key={cls} className="student-class-pill">
                <BookOpen size={11} /> {cls}
              </span>
            ))
          ) : (
            <span className="student-class-pill unassigned-pill">
              <AlertTriangle size={11} /> No Active Classes Enrolled
            </span>
          )}
        </div>
      </div>
      <div className="student-card-footer">
        <div className="contact-item">
          <Mail size={13} />
          <span>{student.email}</span>
        </div>
        <div className="contact-item">
          <Phone size={13} />
          <span>{student.phone}</span>
        </div>
      </div>
    </motion.div>
  );
};

const Students = ({ onStudentSelect, userRole = 'admin', addNotification }) => {
  const { studentsList, addStudent, deleteStudent, toggleArchiveStudent } = useSchoolData();
  const isAdmin = userRole === 'admin';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'archived', 'unassigned'
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);

  // Form State
  const [studentForm, setStudentForm] = useState({
    studentId: '',
    name: '',
    grade: '10A',
    email: '',
    password: '',
    phone: '',
    guardian: '',
    gpa: '3.85',
    points: 1000,
    attendance: 98,
    assignedClassInput: 'Advanced Math (MATH-301)'
  });

  const grades = useMemo(() => {
    const uniqueGrades = Array.from(new Set(studentsList.map(s => s.grade).filter(Boolean)));
    return ['all', ...uniqueGrades];
  }, [studentsList]);

  // Counts for status tabs
  const statusCounts = useMemo(() => {
    const active = studentsList.filter(s => s.status !== 'archived').length;
    const archived = studentsList.filter(s => s.status === 'archived').length;
    const unassigned = studentsList.filter(s => s.status !== 'archived' && (!s.assignedClasses || s.assignedClasses.length === 0)).length;
    return { all: studentsList.length, active, archived, unassigned };
  }, [studentsList]);

  const filteredStudents = useMemo(() => {
    return studentsList.filter(s => {
      // 1. Search Query
      const query = searchTerm.toLowerCase();
      const matchesSearch = 
        s.name.toLowerCase().includes(query) ||
        (s.studentId && s.studentId.toLowerCase().includes(query)) ||
        s.grade.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        (s.assignedClasses && s.assignedClasses.some(c => c.toLowerCase().includes(query)));

      // 2. Grade Filter
      const matchesGrade = selectedGrade === 'all' || s.grade === selectedGrade;

      // 3. Status Filter
      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = s.status !== 'archived';
      } else if (statusFilter === 'archived') {
        matchesStatus = s.status === 'archived';
      } else if (statusFilter === 'unassigned') {
        matchesStatus = s.status !== 'archived' && (!s.assignedClasses || s.assignedClasses.length === 0);
      }

      return matchesSearch && matchesGrade && matchesStatus;
    });
  }, [studentsList, searchTerm, selectedGrade, statusFilter]);

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    if (!studentForm.name || !studentForm.email) return;

    if (!studentForm.password || studentForm.password.length < 6) {
      if (addNotification) addNotification('error', 'Initial password must be at least 6 characters long.');
      return;
    }

    const classesArray = studentForm.assignedClassInput
      ? [studentForm.assignedClassInput]
      : [];

    const customId = studentForm.studentId.trim() || `STU-${Math.floor(1000 + Math.random() * 9000)}`;

    setIsSubmittingStudent(true);
    try {
      await addStudent({
        ...studentForm,
        studentId: customId,
        status: 'active',
        assignedClasses: classesArray,
        points: Number(studentForm.points) || 500,
        gpa: Number(studentForm.gpa) || 3.8,
        attendance: Number(studentForm.attendance) || 100
      });

      if (addNotification) {
        addNotification('success', `Student ${studentForm.name} registered as a Firebase user! ✨`);
      }

      setIsAddStudentOpen(false);
      setStudentForm({
        studentId: '',
        name: '',
        grade: '10A',
        email: '',
        password: '',
        phone: '',
        guardian: '',
        gpa: '3.85',
        points: 1000,
        attendance: 98,
        assignedClassInput: 'Advanced Math (MATH-301)'
      });
    } catch (err) {
      console.error('Failed to enroll student:', err);
      if (addNotification) {
        addNotification('error', err.message || 'Failed to register student in Firebase.');
      }
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (studentToDelete && isAdmin) {
      const target = studentToDelete;
      setStudentToDelete(null);
      try {
        await deleteStudent(target.id);
        if (addNotification) addNotification('success', `${target.name || 'Student'} removed from school. Their access has been revoked.`);
      } catch (err) {
        console.error('Failed to remove student:', err);
        if (addNotification) addNotification('error', err.message || 'Failed to remove student.');
      }
    }
  };

  const handleArchiveInstead = () => {
    if (studentToDelete) {
      toggleArchiveStudent(studentToDelete.id);
      setStudentToDelete(null);
    }
  };

  const handleExportStudents = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      ["Name,Grade,Status,ClassesEnrolled,Email,Phone,GPA,Points,Guardian,Tags"].join(",") + "\n" +
      filteredStudents.map(s => `"${s.name}","${s.grade}","${s.status || 'active'}","${s.assignedClasses?.length || 0}","${s.email}","${s.phone}","${s.gpa || ''}","${s.points || ''}","${s.guardian || ''}","${(s.tags || []).join('; ')}"`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NoesisHorizon_Students_Roster_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="students-page">
      <header className="page-header">
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              Students Directory
              <Users size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">{filteredStudents.length} Shown</span>
          </div>
          <p>Track academic standing, status lifecycle, class assignments, and student profiles.</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary glass" onClick={handleExportStudents} title="Export Student Directory">
            <Download size={18} />
            Export Roster
          </button>
          <button className="btn-primary" onClick={() => setIsAddStudentOpen(true)}>
            <UserPlus size={20} />
            Add Student
          </button>
        </div>
      </header>

      {/* Status & Grade Filters & Search */}
      <div className="students-controls-container glass">
        {/* Search Bar */}
        <div className="search-bar-wrap">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by student name, grade, email, or interests..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Status Filter Bar */}
        <div className="status-filter-pills-row">
          <span className="filter-label">Status:</span>
          <div className="status-pills">
            <button 
              className={`status-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({statusCounts.all})
            </button>
            <button 
              className={`status-pill active-status ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active ({statusCounts.active})
            </button>
            <button 
              className={`status-pill archived-status ${statusFilter === 'archived' ? 'active' : ''}`}
              onClick={() => setStatusFilter('archived')}
            >
              <Archive size={13} /> Archived ({statusCounts.archived})
            </button>
            <button 
              className={`status-pill unassigned-status ${statusFilter === 'unassigned' ? 'active' : ''}`}
              onClick={() => setStatusFilter('unassigned')}
            >
              <AlertTriangle size={13} /> No Classes ({statusCounts.unassigned})
            </button>
          </div>
        </div>

        {/* Grade Filter Bar */}
        <div className="grade-pills-row">
          <span className="filter-label">Grade Filter:</span>
          <div className="grade-pills">
            {grades.map(grade => (
              <button 
                key={grade}
                className={`grade-pill ${selectedGrade === grade ? 'active' : ''}`}
                onClick={() => setSelectedGrade(grade)}
              >
                {grade === 'all' ? `All Grades` : `Grade ${grade}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <motion.div className="students-grid" layout>
        <AnimatePresence>
          {filteredStudents.length === 0 ? (
            <div className="students-empty-state glass">
              <AlertCircle size={32} />
              <h3>No Students Match Filters</h3>
              <p>Try clearing your search query, or switch status filter to All.</p>
              <button 
                className="btn-secondary btn-sm" 
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); setSelectedGrade('all'); }}
              >
                <RotateCcw size={14} /> Reset Filters
              </button>
            </div>
          ) : (
            filteredStudents.map((student, index) => (
              <StudentCard 
                key={student.id} 
                student={student} 
                index={index} 
                onSelect={onStudentSelect}
                onRequestDelete={setStudentToDelete}
                onToggleArchive={toggleArchiveStudent}
                isAdmin={isAdmin}
              />
            ))
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── MODAL: Delete Confirmation ── */}
      <AnimatePresence>
        {studentToDelete && (
          <div className="modal-overlay" onClick={() => setStudentToDelete(null)}>
            <motion.div 
              className="modal-content delete-confirm-modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="delete-modal-title-row">
                  <div className="destructive-icon-bubble">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3>Delete Student Record?</h3>
                    <p className="modal-subtitle">Permanent directory removal confirmation.</p>
                  </div>
                </div>
                <button type="button" className="icon-btn-close" onClick={() => setStudentToDelete(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <div className="delete-modal-body">
                <p>
                  Are you sure you want to permanently remove <strong>{studentToDelete.name}</strong> (Grade {studentToDelete.grade}) from this school?
                </p>
                <div className="delete-warning-callout">
                  <ShieldAlert size={16} />
                  <span>Their school login access will be revoked immediately. If they have no other school memberships, they will see a "not part of any school" screen on next login. Academic history will also be removed.</span>
                </div>
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-secondary" onClick={() => setStudentToDelete(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-secondary archive-instead-btn" onClick={handleArchiveInstead}>
                  <Archive size={14} /> Archive Instead
                </button>
                <button type="button" className="btn-destructive-solid" onClick={handleConfirmDelete}>
                  <Trash2 size={14} /> Delete Permanently
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Add New Student ── */}
      <AnimatePresence>
        {isAddStudentOpen && (
          <div className="modal-overlay" onClick={() => setIsAddStudentOpen(false)}>
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Enroll New Student</h3>
                <p className="modal-subtitle">Enroll student to assign grade sections, classes, and track grades.</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddStudentOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddStudentSubmit} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Student Full Name</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Maya Lin"
                      value={studentForm.name}
                      onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Official Student ID</label>
                    <input 
                      type="text" 
                      placeholder="e.g. STU-1007 (Auto-generated if blank)"
                      value={studentForm.studentId}
                      onChange={e => setStudentForm({ ...studentForm, studentId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Grade / Section</label>
                    <select 
                      value={studentForm.grade}
                      onChange={e => setStudentForm({ ...studentForm, grade: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="9A">Grade 9A</option>
                      <option value="9B">Grade 9B</option>
                      <option value="10A">Grade 10A</option>
                      <option value="10B">Grade 10B</option>
                      <option value="11A">Grade 11A</option>
                      <option value="11C">Grade 11C</option>
                      <option value="12A">Grade 12A</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Student Email *</label>
                    <input 
                      type="email" 
                      required 
                      placeholder="e.g. maya.lin@student.edu"
                      value={studentForm.email}
                      onChange={e => setStudentForm({ ...studentForm, email: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Initial Login Password *</label>
                    <input 
                      type="password" 
                      required 
                      minLength={6}
                      placeholder="Min. 6 characters for first login"
                      value={studentForm.password || ''}
                      onChange={e => setStudentForm({ ...studentForm, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Phone / Contact</label>
                    <input 
                      type="tel" 
                      placeholder="e.g. +1 (555) 345-099"
                      value={studentForm.phone}
                      onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Guardian / Parent Contact</label>
                    <input 
                      type="text" 
                      placeholder="e.g. David Lin (Father - +1 555-900-12)"
                      value={studentForm.guardian}
                      onChange={e => setStudentForm({ ...studentForm, guardian: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Initial GPA Target</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0.0"
                      max="4.0"
                      placeholder="e.g. 3.85"
                      value={studentForm.gpa}
                      onChange={e => setStudentForm({ ...studentForm, gpa: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Initial Course Enrollment</label>
                    <select
                      className="custom-form-select"
                      value={studentForm.assignedClassInput}
                      onChange={e => setStudentForm({ ...studentForm, assignedClassInput: e.target.value })}
                    >
                      <option value="Advanced Math (MATH-301)">Advanced Math (MATH-301)</option>
                      <option value="Physics 101 (PHYS-401)">Physics 101 (PHYS-401)</option>
                      <option value="World History (HIST-202)">World History (HIST-202)</option>
                      <option value="Digital Arts (ART-110)">Digital Arts (ART-110)</option>
                      <option value="">Unassigned (Enroll Later)</option>
                    </select>
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddStudentOpen(false)} disabled={isSubmittingStudent}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSubmittingStudent}>
                    {isSubmittingStudent ? 'Creating User in Firebase...' : 'Enroll Student'}
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

export default Students;
