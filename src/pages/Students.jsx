import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, UserPlus, Filter, MoreVertical, Mail, Phone, 
  MapPin, X, Check, Download, Trash2, Edit3, Award, Star, 
  GraduationCap, BookOpen, ShieldAlert, Archive, ArchiveRestore,
  AlertTriangle, AlertCircle, CheckCircle2, RotateCcw, Users, ChevronDown
} from 'lucide-react';
import { useSchoolData, DEFAULT_ROLE_PERMISSIONS } from '../context/SchoolDataContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from '../components/Avatar';
import './Students.css';

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

const SearchableCourseSelector = ({ 
  classesList = [], 
  selectedClasses = [], 
  onChange, 
  isAlbanian
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

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

  const filteredCourses = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return classesList;
    return classesList.filter(c => 
      (c.name || '').toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q) ||
      (c.teacher || '').toLowerCase().includes(q) ||
      (c.department || '').toLowerCase().includes(q)
    );
  }, [classesList, search]);

  const handleToggle = (courseString) => {
    if (selectedClasses.includes(courseString)) {
      onChange(selectedClasses.filter(c => c !== courseString));
    } else {
      onChange([...selectedClasses, courseString]);
    }
  };

  const handleRemove = (courseString, e) => {
    e.stopPropagation();
    onChange(selectedClasses.filter(c => c !== courseString));
  };

  return (
    <div className="searchable-course-dropdown" ref={dropdownRef}>
      {/* Selected Tags Chips */}
      {selectedClasses.length > 0 && (
        <div className="selected-course-tags-row">
          {selectedClasses.map(clsStr => (
            <span key={clsStr} className="selected-course-tag">
              <BookOpen size={12} />
              <span>{clsStr}</span>
              <button 
                type="button" 
                className="selected-course-tag-remove" 
                onClick={(e) => handleRemove(clsStr, e)}
                title={isAlbanian ? "Hiq lëndën" : "Remove course"}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger Button */}
      <button 
        type="button" 
        className={`searchable-dropdown-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ color: selectedClasses.length > 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
          {selectedClasses.length === 0 
            ? (isAlbanian ? 'Zgjidhni lëndët nga lista...' : 'Select courses from school catalog...') 
            : (isAlbanian ? `+ Shto / Ndrysho lëndë (${selectedClasses.length} të zgjedhura)` : `+ Add / Change courses (${selectedClasses.length} selected)`)}
        </span>
        <ChevronDown size={16} style={{ color: 'hsl(var(--muted-foreground))', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="searchable-dropdown-menu">
          <div className="dropdown-search-input-wrap">
            <Search size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
            <input 
              type="text" 
              autoFocus
              className="dropdown-search-input"
              placeholder={isAlbanian ? 'Kërko lëndë (p.sh. Matematikë, BIO-101)...' : 'Search courses (e.g. Physics, CS-101)...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="dropdown-course-list">
            {classesList.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.84rem' }}>
                {isAlbanian ? 'Nuk ka lëndë aktive në shkollë. Krijoni lëndë te "Kurset & Klasat".' : 'No courses created in school yet. Add courses in "Courses & Classes".'}
              </div>
            ) : filteredCourses.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.84rem' }}>
                {isAlbanian ? 'Asnjë lëndë nuk përputhet me kërkimin.' : 'No courses match your search.'}
              </div>
            ) : (
              filteredCourses.map(course => {
                const courseIdentifier = `${course.name} (${course.code || 'CLS'})`;
                const isSelected = selectedClasses.includes(courseIdentifier);
                return (
                  <button
                    key={course.id || course.code}
                    type="button"
                    className={`dropdown-course-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggle(courseIdentifier)}
                  >
                    <div className="dropdown-course-item-info">
                      <span className="dropdown-course-item-title">
                        {course.name} <code style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))' }}>{course.code}</code>
                      </span>
                      <span className="dropdown-course-item-meta">
                        {course.department || 'Academic'} • {course.teacher || 'Faculty'} {course.room ? `• ${course.room}` : ''}
                      </span>
                    </div>
                    {isSelected && <Check size={16} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const StudentCard = ({ student, index, onSelect, onEdit, onRequestDelete, onToggleArchive, canManage, isAlbanian }) => {
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
        </div>
        <div className="header-actions-right" onClick={e => e.stopPropagation()}>
          {/* Status Badges */}
          {isArchived ? (
            <span className="student-status-badge archived">
              <Archive size={12} /> {isAlbanian ? 'I Arkivuar' : 'Archived'}
            </span>
          ) : isUnassigned ? (
            <span className="student-status-badge unassigned" title={isAlbanian ? "Nxënësi nuk është regjistruar në asnjë lëndë ende" : "Student is active but not assigned to any classes yet"}>
              <AlertTriangle size={12} /> {isAlbanian ? 'Pa Lëndë' : 'No Classes'}
            </span>
          ) : (
            <span className="student-status-badge active">
              <CheckCircle2 size={12} /> {isAlbanian ? 'Aktiv' : 'Active'}
            </span>
          )}
          
          {canManage && (
            <div className="admin-card-actions">
              <button 
                type="button"
                className="edit-student-card-btn" 
                title={isAlbanian ? 'Ndrysho Profilin e Nxënësit' : 'Edit Student Profile'}
                onClick={() => onEdit && onEdit(student)}
              >
                <Edit3 size={14} />
              </button>
              <button 
                type="button"
                className="archive-student-card-btn" 
                title={isArchived ? (isAlbanian ? 'Rikthe Nxënësin' : 'Restore / Unarchive Student') : (isAlbanian ? 'Arkivo Nxënësin' : 'Archive Student')}
                onClick={() => onToggleArchive && onToggleArchive(student.id)}
              >
                {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              </button>
              <button 
                type="button"
                className="delete-student-card-btn" 
                title={isAlbanian ? 'Fshij Përgjithmonë Nxënësin' : 'Permanently Delete Student'}
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
        <p className="student-grade">Grade {student.grade}{student.gpa != null && student.gpa !== '' ? ` • GPA ${student.gpa}` : ''}</p>
        
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
              <AlertTriangle size={11} /> {isAlbanian ? 'Pa Lëndë të Regjistruara' : 'No Active Classes Enrolled'}
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
  const { 
    studentsList, 
    classesList = [], 
    addStudent, 
    updateStudent, 
    deleteStudent, 
    toggleArchiveStudent,
    rolePermissions
  } = useSchoolData();
  const { language, t, isAlbanian } = useLanguage();
  const isAdmin = userRole === 'admin';
  const isTeacher = userRole === 'teacher';
  const teacherCanManage = (rolePermissions?.teacher?.canEditDeleteStudents ?? DEFAULT_ROLE_PERMISSIONS.teacher.canEditDeleteStudents) ?? true;
  const canManage = isAdmin || (isTeacher && teacherCanManage);

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
    gpa: '',
    assignedClasses: []
  });

  // Edit Student Form State
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentForm, setEditStudentForm] = useState({
    name: '',
    studentId: '',
    grade: '10A',
    email: '',
    phone: '',
    guardian: '',
    gpa: '',
    assignedClasses: [],
    status: 'active'
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const handleOpenEditStudent = useCallback((s) => {
    setEditingStudent(s);
    setEditStudentForm({
      name: s.name || '',
      studentId: s.studentId || '',
      grade: s.grade || '10A',
      email: s.email || '',
      phone: s.phone || '',
      guardian: s.guardian || '',
      gpa: s.gpa ?? '',
      assignedClasses: Array.isArray(s.assignedClasses) ? [...s.assignedClasses] : (s.assignedClasses ? [s.assignedClasses] : []),
      status: s.status || 'active'
    });
  }, []);

  const handleSaveEditStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editStudentForm.name.trim() || !editStudentForm.email.trim()) return;

    setIsSubmittingEdit(true);
    try {
      if (updateStudent) {
        await updateStudent(editingStudent.id, {
          name: editStudentForm.name.trim(),
          studentId: editStudentForm.studentId.trim(),
          grade: editStudentForm.grade.trim(),
          email: editStudentForm.email.trim(),
          phone: editStudentForm.phone.trim(),
          guardian: editStudentForm.guardian.trim(),
          ...(editStudentForm.gpa !== '' ? { gpa: Number(editStudentForm.gpa) } : {}),
          assignedClasses: editStudentForm.assignedClasses || [],
          status: editStudentForm.status || 'active'
        });
      }

      if (addNotification) {
        addNotification('success', isAlbanian ? `Profili i nxënësit "${editStudentForm.name}" u përditësua me sukses! ✨` : `Student profile "${editStudentForm.name}" updated successfully! ✨`);
      }
      setEditingStudent(null);
    } catch (err) {
      console.error('Failed to update student:', err);
      if (addNotification) {
        addNotification('error', err.message || 'Failed to update student profile.');
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

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

    const classesArray = Array.isArray(studentForm.assignedClasses)
      ? studentForm.assignedClasses
      : (studentForm.assignedClassInput ? [studentForm.assignedClassInput] : []);

    const customId = studentForm.studentId.trim() || `STU-${Math.floor(1000 + Math.random() * 9000)}`;

    setIsSubmittingStudent(true);
    try {
      await addStudent({
        ...studentForm,
        studentId: customId,
        status: 'active',
        assignedClasses: classesArray,
        ...(studentForm.gpa !== '' ? { gpa: Number(studentForm.gpa) } : {})
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
        gpa: '',
        assignedClasses: []
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
      ["Name,Grade,Status,ClassesEnrolled,Email,Phone,GPA,Guardian,Tags"].join(",") + "\n" +
      filteredStudents.map(s => `"${s.name}","${s.grade}","${s.status || 'active'}","${s.assignedClasses?.length || 0}","${s.email}","${s.phone}","${s.gpa || ''}","${s.guardian || ''}","${(s.tags || []).join('; ')}"`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NoesisHorizon_Students_Roster_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div className="students-page" variants={containerVariants} initial="hidden" animate="visible">
      <motion.header className="page-header" variants={itemVariants}>
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              {t('students.title')}
              <Users size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">{`${filteredStudents.length} ${t('common.total')}`}</span>
          </div>
          <p>{t('students.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary glass" onClick={handleExportStudents} title={isAlbanian ? "Eksporto Regjistrin e Nxënësve" : "Export Student Directory"}>
            <Download size={18} />
            {isAlbanian ? 'Eksporto Regjistrin' : 'Export Roster'}
          </button>
          <button className="btn-primary" onClick={() => setIsAddStudentOpen(true)}>
            <UserPlus size={20} />
            {t('students.addStudent')}
          </button>
        </div>
      </motion.header>

      {/* Status & Grade Filters & Search */}
      <motion.div className="students-controls-container glass" variants={itemVariants}>
        {/* Search Bar */}
        <div className="search-bar-wrap">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={t('students.search')} 
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
          <span className="filter-label">{isAlbanian ? 'Statusi:' : 'Status:'}</span>
          <div className="status-pills">
            <button 
              className={`status-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              {isAlbanian ? 'Të Gjithë' : 'All'} ({statusCounts.all})
            </button>
            <button 
              className={`status-pill active-status ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              {isAlbanian ? 'Aktivë' : 'Active'} ({statusCounts.active})
            </button>
            <button 
              className={`status-pill archived-status ${statusFilter === 'archived' ? 'active' : ''}`}
              onClick={() => setStatusFilter('archived')}
            >
              <Archive size={13} /> {isAlbanian ? 'Të Arkivuar' : 'Archived'} ({statusCounts.archived})
            </button>
            <button 
              className={`status-pill unassigned-status ${statusFilter === 'unassigned' ? 'active' : ''}`}
              onClick={() => setStatusFilter('unassigned')}
            >
              <AlertTriangle size={13} /> {isAlbanian ? 'Pa Lëndë' : 'No Classes'} ({statusCounts.unassigned})
            </button>
          </div>
        </div>

        {/* Grade Filter Bar */}
        <div className="grade-pills-row">
          <span className="filter-label">{isAlbanian ? 'Filtro Klasën:' : 'Grade Filter:'}</span>
          <div className="grade-pills">
            {grades.map(grade => (
              <button 
                key={grade}
                className={`grade-pill ${selectedGrade === grade ? 'active' : ''}`}
                onClick={() => setSelectedGrade(grade)}
              >
                {grade === 'all' ? (isAlbanian ? 'Të Gjitha Klasat' : 'All Grades') : (isAlbanian ? `Klasa ${grade}` : `Grade ${grade}`)}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div className="students-grid" layout variants={itemVariants}>
        <AnimatePresence>
          {filteredStudents.length === 0 ? (
            <div className="students-empty-state glass">
              <AlertCircle size={32} />
              <h3>{isAlbanian ? 'Asnjë Nxënës Nuk Përputhet' : 'No Students Match Filters'}</h3>
              <p>{isAlbanian ? 'Provoni të pastroni kërkimin ose zgjidhni statusin Të Gjithë.' : 'Try clearing your search query, or switch status filter to All.'}</p>
              <button 
                className="btn-secondary btn-sm" 
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); setSelectedGrade('all'); }}
              >
                <RotateCcw size={14} /> {isAlbanian ? 'Pastro Filtrat' : 'Reset Filters'}
              </button>
            </div>
          ) : (
            filteredStudents.map((student, index) => (
              <StudentCard 
                key={student.id} 
                student={student} 
                index={index} 
                onSelect={onStudentSelect}
                onEdit={handleOpenEditStudent}
                onRequestDelete={setStudentToDelete}
                onToggleArchive={toggleArchiveStudent}
                canManage={canManage}
                isAlbanian={isAlbanian}
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
                    <h3>{isAlbanian ? 'Fshi të Dhënat e Studentit?' : 'Delete Student Record?'}</h3>
                    <p className="modal-subtitle">{isAlbanian ? 'Konfirmim për heqjen e përhershme nga regjistri.' : 'Permanent directory removal confirmation.'}</p>
                  </div>
                </div>
                <button type="button" className="icon-btn-close" onClick={() => setStudentToDelete(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <div className="delete-modal-body">
                <p>
                  {isAlbanian ? (
                    <>A jeni të sigurt që dëshironi të hiqni përgjithmonë <strong>{studentToDelete.name}</strong> (Klasa {studentToDelete.grade}) nga kjo shkollë?</>
                  ) : (
                    <>Are you sure you want to permanently remove <strong>{studentToDelete.name}</strong> (Grade {studentToDelete.grade}) from this school?</>
                  )}
                </p>
                <div className="delete-warning-callout">
                  <ShieldAlert size={16} />
                  <span>
                    {isAlbanian 
                      ? 'Qasja e tyre në shkollë do të revokohet menjëherë. Nëse nuk kanë anëtarësim në shkolla të tjera, do të shohin ekranin "nuk jeni pjesë e asnjë shkolle".' 
                      : 'Their school login access will be revoked immediately. If they have no other school memberships, they will see a "not part of any school" screen on next login. Academic history will also be removed.'}
                  </span>
                </div>
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-secondary" onClick={() => setStudentToDelete(null)}>
                  {isAlbanian ? 'Anulo' : 'Cancel'}
                </button>
                <button type="button" className="btn-secondary archive-instead-btn" onClick={handleArchiveInstead}>
                  <Archive size={14} /> {isAlbanian ? 'Arkivo Në Vend të Fshirjes' : 'Archive Instead'}
                </button>
                <button type="button" className="btn-destructive-solid" onClick={handleConfirmDelete}>
                  <Trash2 size={14} /> {isAlbanian ? 'Fshi Përgjithmonë' : 'Delete Permanently'}
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
                <h3>{isAlbanian ? 'Regjistro Student të Ri' : 'Enroll New Student'}</h3>
                <p className="modal-subtitle">
                  {isAlbanian ? 'Regjistroni studentin për të caktuar klasat, lëndët dhe për të ndjekur notat.' : 'Enroll student to assign grade sections, classes, and track grades.'}
                </p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddStudentOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddStudentSubmit} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Emri i Plotë i Studentit *' : 'Student Full Name *'}</label>
                    <input 
                      type="text" 
                      required 
                      placeholder={isAlbanian ? 'p.sh. Era Berisha' : 'e.g. Maya Lin'}
                      value={studentForm.name}
                      onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'ID Zyrtare e Studentit' : 'Official Student ID'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. STU-1007 (Gjenerohet vetvetiu nëse lihet bosh)' : 'e.g. STU-1007 (Auto-generated if blank)'}
                      value={studentForm.studentId}
                      onChange={e => setStudentForm({ ...studentForm, studentId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Klasa / Paralelja' : 'Grade / Section'}</label>
                    <select 
                      value={studentForm.grade}
                      onChange={e => setStudentForm({ ...studentForm, grade: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="9A">{isAlbanian ? 'Klasa 9A' : 'Grade 9A'}</option>
                      <option value="9B">{isAlbanian ? 'Klasa 9B' : 'Grade 9B'}</option>
                      <option value="10A">{isAlbanian ? 'Klasa 10A' : 'Grade 10A'}</option>
                      <option value="10B">{isAlbanian ? 'Klasa 10B' : 'Grade 10B'}</option>
                      <option value="11A">{isAlbanian ? 'Klasa 11A' : 'Grade 11A'}</option>
                      <option value="11C">{isAlbanian ? 'Klasa 11C' : 'Grade 11C'}</option>
                      <option value="12A">{isAlbanian ? 'Klasa 12A' : 'Grade 12A'}</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Email-i i Studentit *' : 'Student Email *'}</label>
                    <input 
                      type="email" 
                      required 
                      placeholder={isAlbanian ? 'p.sh. era.b@student.edu' : 'e.g. maya.lin@student.edu'}
                      value={studentForm.email}
                      onChange={e => setStudentForm({ ...studentForm, email: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Fjalëkalimi Fillestar i Hyrjes *' : 'Initial Login Password *'}</label>
                    <input 
                      type="password" 
                      required 
                      minLength={6}
                      placeholder={isAlbanian ? 'Min. 6 karaktere për hyrjen e parë' : 'Min. 6 characters for first login'}
                      value={studentForm.password || ''}
                      onChange={e => setStudentForm({ ...studentForm, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Telefoni / Kontakti' : 'Phone / Contact'}</label>
                    <input 
                      type="tel" 
                      placeholder="e.g. +383 44 123 456"
                      value={studentForm.phone}
                      onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Kontakti i Prindit / Kujdestarit' : 'Guardian / Parent Contact'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. Besnik Berisha (Babai - +383 44 123 456)' : 'e.g. David Lin (Father - +1 555-900-12)'}
                      value={studentForm.guardian}
                      onChange={e => setStudentForm({ ...studentForm, guardian: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Synimi Fillestar i Notës Mesatare (GPA)' : 'Initial GPA Target'}</label>
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
                    <label>{isAlbanian ? 'Regjistrimi Fillestar në Lëndë' : 'Initial Course Enrollment'}</label>
                    <SearchableCourseSelector 
                      classesList={classesList}
                      selectedClasses={studentForm.assignedClasses || []}
                      onChange={(nextClasses) => setStudentForm({ ...studentForm, assignedClasses: nextClasses })}
                      isAlbanian={isAlbanian}
                    />
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddStudentOpen(false)} disabled={isSubmittingStudent}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSubmittingStudent}>
                    {isSubmittingStudent 
                      ? (isAlbanian ? 'Duke krijuar llogarinë në Firebase...' : 'Creating User in Firebase...') 
                      : (isAlbanian ? 'Regjistro Studentin' : 'Enroll Student')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Edit Student Profile ── */}
      <AnimatePresence>
        {editingStudent && (
          <div className="modal-overlay" onClick={() => !isSubmittingEdit && setEditingStudent(null)}>
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Ndrysho Profilin e Nxënësit' : 'Edit Student Profile'}</h3>
                <p className="modal-subtitle">
                  {isAlbanian 
                    ? `Përditësoni të dhënat akademike dhe regjistrimet për ${editingStudent.name}.` 
                    : `Update academic profile, credentials, and course enrollments for ${editingStudent.name}.`}
                </p>
                <button type="button" className="icon-btn-close" onClick={() => !isSubmittingEdit && setEditingStudent(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveEditStudent} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Emri i Plotë' : 'Full Name'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span></label>
                    <input 
                      type="text" 
                      required 
                      value={editStudentForm.name}
                      onChange={e => setEditStudentForm({ ...editStudentForm, name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'ID e Nxënësit' : 'Student ID'}</label>
                    <input 
                      type="text" 
                      value={editStudentForm.studentId}
                      onChange={e => setEditStudentForm({ ...editStudentForm, studentId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Klasa / Niveli' : 'Grade / Class'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span></label>
                    <input 
                      type="text" 
                      required 
                      value={editStudentForm.grade}
                      onChange={e => setEditStudentForm({ ...editStudentForm, grade: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Email Zyrtar' : 'Official Email'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span></label>
                    <input 
                      type="email" 
                      required 
                      value={editStudentForm.email}
                      onChange={e => setEditStudentForm({ ...editStudentForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Telefoni / Kontakti' : 'Phone / Contact'}</label>
                    <input 
                      type="tel" 
                      value={editStudentForm.phone}
                      onChange={e => setEditStudentForm({ ...editStudentForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Kujdestari / Prindi' : 'Guardian / Parent'}</label>
                    <input 
                      type="text" 
                      value={editStudentForm.guardian}
                      onChange={e => setEditStudentForm({ ...editStudentForm, guardian: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Nota Mesatare (GPA)' : 'GPA Target'}</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0.0"
                      max="4.0"
                      value={editStudentForm.gpa}
                      onChange={e => setEditStudentForm({ ...editStudentForm, gpa: e.target.value })}
                    />
                  </div>

                </div>

                <div className="form-grid-2">

                  <div className="input-group">
                    <label>{isAlbanian ? 'Statusi' : 'Status'}</label>
                    <select 
                      className="custom-form-select"
                      value={editStudentForm.status}
                      onChange={e => setEditStudentForm({ ...editStudentForm, status: e.target.value })}
                    >
                      <option value="active">{isAlbanian ? 'Aktiv' : 'Active'}</option>
                      <option value="archived">{isAlbanian ? 'I Arkivuar' : 'Archived'}</option>
                    </select>
                  </div>
                </div>

                {/* Searchable Course Enrollment */}
                <div className="input-group">
                  <label>{isAlbanian ? 'Lëndët & Kurset e Regjistruara' : 'Enrolled Courses & Classes'}</label>
                  <SearchableCourseSelector 
                    classesList={classesList}
                    selectedClasses={editStudentForm.assignedClasses || []}
                    onChange={(nextClasses) => setEditStudentForm({ ...editStudentForm, assignedClasses: nextClasses })}
                    isAlbanian={isAlbanian}
                  />
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setEditingStudent(null)} disabled={isSubmittingEdit}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSubmittingEdit}>
                    {isSubmittingEdit 
                      ? (isAlbanian ? 'Duke ruajtur ndryshimet...' : 'Saving Changes...') 
                      : (isAlbanian ? 'Ruaj Ndryshimet' : 'Save Changes')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Students;
