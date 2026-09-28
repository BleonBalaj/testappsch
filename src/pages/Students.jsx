import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, UserPlus, Mail, Phone, X, Check, Download, Trash2, Edit3,
  BookOpen, ShieldAlert, Archive, ArchiveRestore,
  AlertTriangle, AlertCircle, CheckCircle2, RotateCcw, Users, ChevronDown, GraduationCap
} from 'lucide-react';
import { useSchoolData, DEFAULT_ROLE_PERMISSIONS } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from '../components/Avatar';
import {
  courseMatchesReference, displayCourse, enrolledCoursesForStudent, explicitCourseAssignments, normalizeAssignedCourseIds,
} from '../features/enrollment';
import { classGroupsById, findClassGroupByLabel, hasValidClass, studentClassLabel } from '../features/classGroups';
import { fetchStudentsForExport, useStudentCounts, useStudentDirectory } from '../features/students/studentData';
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

const STATUS_COUNT_SPECS = [{ kind: 'all' }, { kind: 'status', value: 'active' }, { kind: 'status', value: 'archived' }, { kind: 'unassigned' }];
const EMPTY_STUDENT_FORM = {
  studentId: '',
  name: '',
  classGroupId: '',
  email: '',
  password: '',
  phone: '',
  guardian: '',
  gpa: '',
  assignedClasses: []
};
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

const SearchableCourseSelector = ({
  classesList = [],
  selectedClasses = [],
  onChange,
  isAlbanian,
  lockedClassGroupId = '',
  lockedClassLabel = ''
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

  // Courses linked to the chosen class are included automatically.
  const isLocked = course => Boolean(lockedClassGroupId) && String(course.classGroupId || '') === String(lockedClassGroupId);
  const lockedCourses = classesList.filter(isLocked);
  const chips = selectedClasses.filter(reference => {
    const course = classesList.find(item => courseMatchesReference(item, reference));
    return !course || !isLocked(course);
  });

  const query = search.toLowerCase().trim();
  const filteredCourses = !query ? classesList : classesList.filter(c =>
    (c.name || '').toLowerCase().includes(query) ||
    (c.code || '').toLowerCase().includes(query) ||
    (c.teacher || '').toLowerCase().includes(query) ||
    (c.department || '').toLowerCase().includes(query)
  );

  const handleToggle = (course) => {
    if (isLocked(course)) return;
    if (selectedClasses.some(reference => courseMatchesReference(course, reference))) {
      onChange(selectedClasses.filter(reference => !courseMatchesReference(course, reference)));
    } else {
      onChange([...selectedClasses, String(course.id)]);
    }
  };

  const handleRemove = (courseString, e) => {
    e.stopPropagation();
    onChange(selectedClasses.filter(c => c !== courseString));
  };

  return (
    <div className="searchable-course-dropdown" ref={dropdownRef}>
      {lockedCourses.length > 0 && (
        <p className="student-locked-courses">
          <GraduationCap size={13} /> {isAlbanian ? `Përmes klasës ${lockedClassLabel}:` : `Through class ${lockedClassLabel}:`} {lockedCourses.map(displayCourse).join(', ')}
        </p>
      )}
      {chips.length > 0 && (
        <div className="selected-course-tags-row">
          {chips.map(clsStr => {
            const course = classesList.find(item => courseMatchesReference(item, clsStr));
            return <span key={clsStr} className="selected-course-tag">
              <BookOpen size={12} />
              <span>{course ? displayCourse(course) : clsStr}</span>
              <button
                type="button"
                className="selected-course-tag-remove"
                onClick={(e) => handleRemove(clsStr, e)}
                title={isAlbanian ? "Hiq lëndën" : "Remove course"}
                aria-label={isAlbanian ? "Hiq lëndën" : "Remove course"}
              >
                <X size={12} />
              </button>
            </span>;
          })}
        </div>
      )}

      <button
        type="button"
        className={`searchable-dropdown-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ color: chips.length > 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
          {chips.length === 0
            ? (isAlbanian ? 'Shto lëndë të tjera (opsionale)…' : 'Add other courses (optional)…')
            : (isAlbanian ? `+ Shto / Ndrysho lëndë (${chips.length} të zgjedhura)` : `+ Add / Change courses (${chips.length} selected)`)}
        </span>
        <ChevronDown size={16} style={{ color: 'hsl(var(--muted-foreground))', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

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
              <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }} aria-label={isAlbanian ? 'Pastro' : 'Clear'}>
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
                const locked = isLocked(course);
                const isSelected = locked || selectedClasses.some(reference => courseMatchesReference(course, reference));
                return (
                  <button
                    key={course.id || course.code}
                    type="button"
                    className={`dropdown-course-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggle(course)}
                    disabled={locked}
                    title={locked ? (isAlbanian ? `Përfshihet përmes klasës ${lockedClassLabel}` : `Included through class ${lockedClassLabel}`) : undefined}
                  >
                    <div className="dropdown-course-item-info">
                      <span className="dropdown-course-item-title">
                        {course.name} <code style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))' }}>{course.code}</code>
                      </span>
                      <span className="dropdown-course-item-meta">
                        {locked ? (isAlbanian ? `Përmes klasës ${lockedClassLabel}` : `Through class ${lockedClassLabel}`) : [course.department, course.teacher, course.room].filter(Boolean).join(' • ')}
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

const ClassSelect = ({ id, value, onChange, classGroups, isAlbanian, allowNone = true }) => (
  <select id={id} className="custom-form-select" value={value} onChange={event => onChange(event.target.value)}>
    {allowNone && <option value="">{isAlbanian ? 'Pa klasë tani për tani' : 'No class yet'}</option>}
    {classGroups.map(group => (
      <option key={group.id} value={group.id}>{isAlbanian ? 'Klasa' : 'Class'} {group.label}</option>
    ))}
  </select>
);

const StudentCard = ({ student, classesList, classesLoaded, groupsById, index, onSelect, onEdit, onRequestDelete, onToggleArchive, canManage, isAlbanian }) => {
  const isArchived = student.status === 'archived';
  const enrolledCourses = enrolledCoursesForStudent(student, classesList);
  const noCourses = classesLoaded && !isArchived && enrolledCourses.length === 0;
  const classLabel = studentClassLabel(student, groupsById);
  const linked = hasValidClass(student, groupsById);

  return (
    <motion.div
      className={`student-card bouncy ${isArchived ? 'is-archived' : ''}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index, 11) * 0.03, duration: 0.2 }}
      onClick={() => onSelect && onSelect(student)}
      style={{ cursor: 'pointer' }}
    >
      <div className="student-card-header">
        <div className="student-avatar-large">
          <Avatar alt={student.name} />
        </div>
        <div className="header-actions-right" onClick={e => e.stopPropagation()}>
          {isArchived ? (
            <span className="student-status-badge archived">
              <Archive size={12} /> {isAlbanian ? 'I Arkivuar' : 'Archived'}
            </span>
          ) : noCourses ? (
            <span className="student-status-badge unassigned" title={isAlbanian ? "Nxënësi nuk është regjistruar në asnjë lëndë ende" : "Student is active but not enrolled in any course yet"}>
              <AlertTriangle size={12} /> {isAlbanian ? 'Pa Lëndë' : 'No Courses'}
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
                aria-label={isAlbanian ? 'Ndrysho Profilin e Nxënësit' : 'Edit Student Profile'}
                onClick={() => onEdit && onEdit(student)}
              >
                <Edit3 size={14} />
              </button>
              <button
                type="button"
                className="archive-student-card-btn"
                title={isArchived ? (isAlbanian ? 'Rikthe Nxënësin' : 'Restore / Unarchive Student') : (isAlbanian ? 'Arkivo Nxënësin' : 'Archive Student')}
                aria-label={isArchived ? (isAlbanian ? 'Rikthe Nxënësin' : 'Restore Student') : (isAlbanian ? 'Arkivo Nxënësin' : 'Archive Student')}
                onClick={() => onToggleArchive && onToggleArchive(student)}
              >
                {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              </button>
              <button
                type="button"
                className="delete-student-card-btn"
                title={isAlbanian ? 'Fshij Përgjithmonë Nxënësin' : 'Permanently Delete Student'}
                aria-label={isAlbanian ? 'Fshij Përgjithmonë Nxënësin' : 'Permanently Delete Student'}
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
          <span className="student-id-badge">{student.studentId || student.id}</span>
        </div>
        <p className={`student-grade ${linked ? '' : 'is-unlinked'}`}>
          {linked
            ? `${isAlbanian ? 'Klasa' : 'Class'} ${classLabel}`
            : classLabel
              ? (isAlbanian ? `${classLabel} · pa lidhje me klasë` : `${classLabel} · not linked to a class`)
              : (isAlbanian ? 'Pa klasë' : 'No class')}
          {student.gpa != null && student.gpa !== '' ? ` • GPA ${student.gpa}` : ''}
        </p>

        <div className="student-classes-list">
          {!classesLoaded ? (
            <span className="student-class-pill">{isAlbanian ? 'Po ngarkohen lëndët…' : 'Loading courses…'}</span>
          ) : enrolledCourses.length > 0 ? (
            enrolledCourses.map(course => (
              <span key={course.id} className="student-class-pill">
                <BookOpen size={11} /> {displayCourse(course)}
              </span>
            ))
          ) : (
            <span className="student-class-pill unassigned-pill">
              <AlertTriangle size={11} /> {isAlbanian ? 'Pa Lëndë të Regjistruara' : 'No Courses Enrolled'}
            </span>
          )}
        </div>
      </div>
      <div className="student-card-footer">
        <div className="contact-item">
          <Mail size={13} />
          <span>{student.email || '—'}</span>
        </div>
        <div className="contact-item">
          <Phone size={13} />
          <span>{student.phone || '—'}</span>
        </div>
      </div>
    </motion.div>
  );
};

const Students = ({ onStudentSelect, userRole = 'admin', addNotification }) => {
  const {
    classesList = [],
    classesLoaded,
    classGroups = [],
    classGroupsLoaded,
    studentsVersion,
    directoryReady,
    directoryStatus,
    addStudent,
    updateStudent,
    deleteStudent,
    toggleArchiveStudent,
    rolePermissions
  } = useSchoolData();
  const { activeSchoolId } = useAuth();
  const { t, isAlbanian } = useLanguage();
  const isAdmin = userRole === 'admin';
  const isTeacher = userRole === 'teacher' || userRole === 'dept_head';
  const teacherCanViewStudents = rolePermissions?.teacher?.students ?? DEFAULT_ROLE_PERMISSIONS.teacher.students;
  const teacherCanManage = (rolePermissions?.teacher?.canEditDeleteStudents ?? DEFAULT_ROLE_PERMISSIONS.teacher.canEditDeleteStudents) ?? true;
  const canCreate = isAdmin || (isTeacher && teacherCanViewStudents);
  const canManage = isAdmin || (isTeacher && teacherCanViewStudents && teacherCanManage);
  const groupsById = useMemo(() => classGroupsById(classGroups), [classGroups]);

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'archived', 'unassigned'
  const [classFilter, setClassFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [studentForm, setStudentForm] = useState(EMPTY_STUDENT_FORM);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentForm, setEditStudentForm] = useState({ ...EMPTY_STUDENT_FORM, status: 'active' });
  const [editClassHint, setEditClassHint] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const sentinelRef = useRef(null);

  // Search waits for a short pause in typing before querying.
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const validClassFilter = classFilter && groupsById.has(classFilter) ? classFilter : '';
  const selectedCourse = courseFilter ? classesList.find(course => String(course.id) === courseFilter) : null;
  const directory = useStudentDirectory({
    schoolId: activeSchoolId,
    search: searchTerm,
    status: statusFilter,
    classGroupId: statusFilter === 'unassigned' ? '' : validClassFilter,
    courseId: selectedCourse ? String(selectedCourse.id) : '',
    courseClassGroupId: selectedCourse?.classGroupId ? String(selectedCourse.classGroupId) : '',
    ordered: directoryReady,
  });
  const statusCounts = useStudentCounts(activeSchoolId, STATUS_COUNT_SPECS, studentsVersion);
  const countFor = spec => statusCounts.get(spec);
  const totalCount = countFor(STATUS_COUNT_SPECS[0]);
  const students = directory.students;
  const filtersActive = Boolean(searchTerm.trim() || statusFilter !== 'all' || validClassFilter || selectedCourse);

  // Load the next page as the end of the list scrolls into view.
  const { hasMore, loadingMore, loadMore } = directory;
  useEffect(() => {
    const target = sentinelRef.current;
    if (!hasMore || loadingMore || !target || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) loadMore();
    }, { rootMargin: '600px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  const resetFilters = () => { setSearchInput(''); setSearchTerm(''); setStatusFilter('all'); setClassFilter(''); setCourseFilter(''); };

  const handleOpenEditStudent = useCallback((s) => {
    const linkedId = hasValidClass(s, groupsById) ? String(s.classGroupId) : '';
    const legacyMatch = !linkedId && s.grade ? findClassGroupByLabel(classGroups, s.grade) : null;
    setEditingStudent(s);
    setEditClassHint(!linkedId && s.grade
      ? (legacyMatch
        ? (isAlbanian ? `U gjet klasa ${legacyMatch.label} nga vlera e vjetër "${s.grade}". Ruani për ta lidhur.` : `Matched class ${legacyMatch.label} from the old value "${s.grade}". Save to link it.`)
        : (isAlbanian ? `Vlera e vjetër: "${s.grade}". Zgjidhni klasën përkatëse.` : `Old value: "${s.grade}". Choose the matching class.`))
      : '');
    setEditStudentForm({
      name: s.name || '',
      studentId: s.studentId || '',
      classGroupId: linkedId || legacyMatch?.id || '',
      email: s.email || '',
      password: '',
      phone: s.phone || '',
      guardian: s.guardian || '',
      gpa: s.gpa ?? '',
      assignedClasses: normalizeAssignedCourseIds(s.assignedClasses ?? [], classesList),
      status: s.status || 'active'
    });
  }, [classesList, classGroups, groupsById, isAlbanian]);

  const handleSaveEditStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editStudentForm.name.trim() || !editStudentForm.email.trim()) return;

    setIsSubmittingEdit(true);
    try {
      await updateStudent(editingStudent.id, {
        name: editStudentForm.name.trim(),
        studentId: editStudentForm.studentId.trim(),
        email: editStudentForm.email.trim(),
        phone: editStudentForm.phone.trim(),
        guardian: editStudentForm.guardian.trim(),
        ...(editStudentForm.gpa !== '' ? { gpa: Number(editStudentForm.gpa) } : {}),
        classGroupId: editStudentForm.classGroupId,
        assignedClasses: explicitCourseAssignments(editStudentForm.assignedClasses, classesList, editStudentForm.classGroupId, editingStudent.classGroupId),
        status: editStudentForm.status || 'active'
      });
      addNotification?.('success', isAlbanian ? `Profili i nxënësit "${editStudentForm.name}" u përditësua me sukses! ✨` : `Student profile "${editStudentForm.name}" updated successfully! ✨`);
      setEditingStudent(null);
    } catch (err) {
      console.error('Failed to update student:', err);
      addNotification?.('error', err.message || (isAlbanian ? 'Profili nuk u përditësua.' : 'Failed to update student profile.'));
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const openAddStudent = () => {
    setStudentForm({ ...EMPTY_STUDENT_FORM, classGroupId: validClassFilter });
    setIsAddStudentOpen(true);
  };

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate) return;
    if (!studentForm.name || !studentForm.email) return;

    if (studentForm.password && studentForm.password.length < 6) {
      addNotification?.('error', isAlbanian ? 'Fjalëkalimi fillestar duhet të ketë të paktën 6 karaktere.' : 'Initial password must be at least 6 characters long when provided.');
      return;
    }

    const classGroupId = studentForm.classGroupId && groupsById.has(studentForm.classGroupId) ? studentForm.classGroupId : '';
    const customId = studentForm.studentId.trim() || `STU-${Math.floor(1000 + Math.random() * 9000)}`;

    setIsSubmittingStudent(true);
    try {
      const result = await addStudent({
        ...studentForm,
        studentId: customId,
        status: 'active',
        classGroupId,
        grade: groupsById.get(classGroupId)?.label || '',
        assignedClasses: explicitCourseAssignments(studentForm.assignedClasses, classesList, classGroupId),
        ...(studentForm.gpa !== '' ? { gpa: Number(studentForm.gpa) } : {})
      });

      addNotification?.('success', result?.alreadyMember
        ? result?.updatedEnrollment
          ? (isAlbanian ? `Lëndët e zgjedhura iu shtuan profilit ekzistues të ${studentForm.name}.` : `${studentForm.name}'s selected courses were added to their existing school profile.`)
          : (isAlbanian ? `${studentForm.name} është tashmë në këtë shkollë.` : `${studentForm.name} already belongs to this school.`)
        : result?.isExisting
          ? (isAlbanian ? `Llogaria ekzistuese e ${studentForm.name} u lidh me shkollën.` : `${studentForm.name}'s existing account was linked to this school.`)
          : (isAlbanian ? `Nxënësi ${studentForm.name} u regjistrua! ✨` : `Student ${studentForm.name} registered! ✨`));

      setIsAddStudentOpen(false);
      setStudentForm(EMPTY_STUDENT_FORM);
    } catch (err) {
      console.error('Failed to enroll student:', err);
      addNotification?.('error', err.message || (isAlbanian ? 'Nxënësi nuk u regjistrua.' : 'Failed to register student.'));
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (studentToDelete && canManage) {
      const target = studentToDelete;
      setStudentToDelete(null);
      try {
        await deleteStudent(target.id);
        addNotification?.('success', isAlbanian ? `${target.name || 'Nxënësi'} u hoq nga shkolla.` : `${target.name || 'Student'} removed from school. Their access has been revoked.`);
      } catch (err) {
        console.error('Failed to remove student:', err);
        addNotification?.('error', err.message || (isAlbanian ? 'Nxënësi nuk u hoq.' : 'Failed to remove student.'));
      }
    }
  };

  const handleToggleArchive = async (student) => {
    try {
      await toggleArchiveStudent(student);
    } catch (err) {
      addNotification?.('error', err.message || (isAlbanian ? 'Statusi nuk u ndryshua.' : 'Could not change the status.'));
    }
  };

  const handleArchiveInstead = () => {
    if (studentToDelete) {
      handleToggleArchive(studentToDelete);
      setStudentToDelete(null);
    }
  };

  // Exports every student matching the filters (read from the server page by
  // page), or the current search results when searching.
  const handleExportStudents = async () => {
    setIsExporting(true);
    try {
      const rows = searchTerm.trim() ? students : await fetchStudentsForExport(activeSchoolId, {
        status: statusFilter,
        classGroupId: statusFilter === 'unassigned' ? '' : validClassFilter,
        courseId: selectedCourse ? String(selectedCourse.id) : '',
        courseClassGroupId: selectedCourse?.classGroupId ? String(selectedCourse.classGroupId) : '',
      });
      const header = ['Name', 'Student ID', 'Class', 'Status', 'Courses', 'Email', 'Phone', 'GPA', 'Guardian'];
      const lines = [header, ...rows.map(s => [s.name, s.studentId, studentClassLabel(s, groupsById), s.status || 'active',
        enrolledCoursesForStudent(s, classesList).map(displayCourse).join('; '), s.email, s.phone, s.gpa ?? '', s.guardian])];
      const blob = new Blob(['\ufeff' + lines.map(line => line.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Students_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      addNotification?.('error', err.message || (isAlbanian ? 'Eksportimi dështoi.' : 'Export failed.'));
    } finally {
      setIsExporting(false);
    }
  };

  const statusPill = (id, label, spec, extraClass = '', icon = null) => {
    const value = countFor(spec);
    return (
      <button type="button" className={`status-pill ${extraClass} ${statusFilter === id ? 'active' : ''}`} onClick={() => setStatusFilter(id)} aria-pressed={statusFilter === id}>
        {icon} {label} ({value === undefined ? '…' : value.toLocaleString()})
      </button>
    );
  };

  const resultSummary = directory.loading ? '' : directory.mode === 'search'
    ? (directory.capped
      ? (isAlbanian ? `Po shfaqen ${students.length} përputhjet e para. Shkruani më shumë për t'i ngushtuar.` : `Showing the first ${students.length} matches. Type more to narrow them down.`)
      : (isAlbanian ? `${students.length} përputhje` : `${students.length} match${students.length === 1 ? '' : 'es'}`))
    : directory.mode === 'paged'
      ? (isAlbanian ? `Po shfaqen ${students.length.toLocaleString()} nxënës` : `Showing ${students.length.toLocaleString()} student${students.length === 1 ? '' : 's'}`) +
        (!filtersActive && totalCount !== undefined ? (isAlbanian ? ` nga ${totalCount.toLocaleString()}` : ` of ${totalCount.toLocaleString()}`) : '')
      : (isAlbanian ? `${students.length} nxënës` : `${students.length} student${students.length === 1 ? '' : 's'}`);

  const addFormGroup = studentForm.classGroupId ? groupsById.get(studentForm.classGroupId) : null;
  const editFormGroup = editStudentForm.classGroupId ? groupsById.get(editStudentForm.classGroupId) : null;
  const noClassesHint = classGroupsLoaded && classGroups.length === 0 ? (
    <small>{isAlbanian
      ? 'Ende nuk ka klasa. Krijojini te "Kurset & Klasat" → "Klasat".'
      : 'No classes yet. Create them under "Courses & Classes" → "Classes".'}</small>
  ) : null;

  return (
    <motion.div className="students-page" variants={containerVariants} initial="hidden" animate="visible">
      <motion.header className="page-header" variants={itemVariants}>
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text">
              {t('students.title')}
              <Users size={30} className="page-title-icon" aria-hidden="true" />
            </h1>
            <span className="count-pill glass">{`${totalCount === undefined ? '…' : totalCount.toLocaleString()} ${t('common.total')}`}</span>
          </div>
          <p>{t('students.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary glass" onClick={handleExportStudents} disabled={isExporting} title={isAlbanian ? "Eksporto Regjistrin e Nxënësve" : "Export Student Directory"}>
            <Download size={18} />
            {isExporting ? (isAlbanian ? 'Duke eksportuar…' : 'Exporting…') : (isAlbanian ? 'Eksporto Regjistrin' : 'Export Roster')}
          </button>
          {canCreate && <button className="btn-primary" onClick={openAddStudent}>
            <UserPlus size={20} />
            {t('students.addStudent')}
          </button>}
        </div>
      </motion.header>

      {directoryStatus === 'preparing' && (
        <div className="students-notice" role="status">
          {isAlbanian ? 'Po përgatitet regjistri i nxënësve për kërkim të shpejtë. Kjo ndodh vetëm një herë.' : 'Preparing the student directory for fast search. This happens only once.'}
        </div>
      )}
      {directoryStatus === 'error' && (
        <div className="students-notice is-warning" role="alert">
          {isAlbanian ? 'Disa nxënës më të vjetër mund të mos shfaqen në kërkim derisa të përfundojë përditësimi. Rifreskoni faqen për ta provuar sërish.' : 'Some older student records may not show in search until the directory update finishes. Refresh the page to retry.'}
        </div>
      )}

      <motion.div className="students-controls-container glass" variants={itemVariants}>
        <div className="search-bar-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={isAlbanian ? 'Kërko sipas emrit, email-it ose ID-së…' : 'Search by name, email or student ID…'}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label={isAlbanian ? 'Kërko nxënës' : 'Search students'}
          />
          {searchInput && (
            <button className="clear-search-btn" onClick={() => { setSearchInput(''); setSearchTerm(''); }} aria-label={isAlbanian ? 'Pastro kërkimin' : 'Clear search'}>
              <X size={15} />
            </button>
          )}
        </div>

        <div className="status-filter-pills-row">
          <span className="filter-label">{isAlbanian ? 'Statusi:' : 'Status:'}</span>
          <div className="status-pills">
            {statusPill('all', isAlbanian ? 'Të Gjithë' : 'All', STATUS_COUNT_SPECS[0])}
            {statusPill('active', isAlbanian ? 'Aktivë' : 'Active', STATUS_COUNT_SPECS[1], 'active-status')}
            {statusPill('archived', isAlbanian ? 'Të Arkivuar' : 'Archived', STATUS_COUNT_SPECS[2], 'archived-status', <Archive size={13} />)}
            {statusPill('unassigned', isAlbanian ? 'Pa Klasë' : 'No Class', STATUS_COUNT_SPECS[3], 'unassigned-status', <AlertTriangle size={13} />)}
          </div>
        </div>

        <div className="grade-pills-row students-filter-selects">
          <label className="filter-label" htmlFor="students-class-filter">{isAlbanian ? 'Klasa:' : 'Class:'}</label>
          <select id="students-class-filter" className="custom-form-select" value={validClassFilter} disabled={statusFilter === 'unassigned'}
            onChange={e => setClassFilter(e.target.value)}>
            <option value="">{isAlbanian ? 'Të gjitha klasat' : 'All classes'}</option>
            {classGroups.map(group => <option key={group.id} value={group.id}>{isAlbanian ? 'Klasa' : 'Class'} {group.label}</option>)}
          </select>
          <label className="filter-label" htmlFor="students-course-filter">{isAlbanian ? 'Lënda:' : 'Course:'}</label>
          <select id="students-course-filter" className="custom-form-select" value={selectedCourse ? String(selectedCourse.id) : ''} onChange={e => setCourseFilter(e.target.value)}>
            <option value="">{isAlbanian ? 'Të gjitha lëndët' : 'All courses'}</option>
            {classesList.map(course => <option key={course.id} value={course.id}>{displayCourse(course)}</option>)}
          </select>
          {filtersActive && (
            <button type="button" className="btn-secondary btn-sm" onClick={resetFilters}><RotateCcw size={14} /> {isAlbanian ? 'Pastro' : 'Reset'}</button>
          )}
        </div>
      </motion.div>

      {resultSummary && <p className="students-result-summary" aria-live="polite">{resultSummary}</p>}

      <motion.div className="students-grid" variants={itemVariants}>
        {directory.loading ? (
          <div className="students-empty-state glass" role="status">
            <Users size={32} />
            <h3>{isAlbanian ? 'Po ngarkohen nxënësit…' : 'Loading students…'}</h3>
          </div>
        ) : directory.error ? (
          <div className="students-empty-state glass" role="alert">
            <AlertCircle size={32} />
            <h3>{isAlbanian ? 'Nxënësit nuk mund të ngarkohen' : 'Students could not be loaded'}</h3>
            <p>{isAlbanian ? 'Kontrolloni lidhjen dhe lejet, pastaj provoni sërish.' : 'Check your connection and permissions, then try again.'}</p>
            <button className="btn-secondary btn-sm" onClick={resetFilters}><RotateCcw size={14} /> {isAlbanian ? 'Provo sërish' : 'Try again'}</button>
          </div>
        ) : students.length === 0 ? (
          <div className="students-empty-state glass">
            <AlertCircle size={32} />
            <h3>{filtersActive ? (isAlbanian ? 'Asnjë Nxënës Nuk Përputhet' : 'No Students Match Filters') : (isAlbanian ? 'Ende nuk ka nxënës' : 'No students yet')}</h3>
            <p>{filtersActive
              ? (isAlbanian ? 'Provoni të pastroni kërkimin ose filtrat.' : 'Try clearing your search or filters.')
              : (isAlbanian ? 'Regjistroni nxënësin e parë me butonin "Regjistro Nxënës".' : 'Add the first student with the "Add Student" button.')}</p>
            {filtersActive && (
              <button className="btn-secondary btn-sm" onClick={resetFilters}>
                <RotateCcw size={14} /> {isAlbanian ? 'Pastro Filtrat' : 'Reset Filters'}
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {students.map((student, index) => (
              <StudentCard
                key={student.id}
                student={student}
                classesList={classesList}
                classesLoaded={classesLoaded}
                groupsById={groupsById}
                index={index}
                onSelect={onStudentSelect}
                onEdit={handleOpenEditStudent}
                onRequestDelete={setStudentToDelete}
                onToggleArchive={handleToggleArchive}
                canManage={canManage}
                isAlbanian={isAlbanian}
              />
            ))}
          </AnimatePresence>
        )}
      </motion.div>

      {!directory.loading && directory.hasMore && (
        <div className="students-load-more" ref={sentinelRef}>
          <button type="button" className="btn-secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? (isAlbanian ? 'Duke ngarkuar…' : 'Loading…') : (isAlbanian ? 'Shfaq më shumë' : 'Show more')}
          </button>
        </div>
      )}
      {directory.capped && directory.mode !== 'search' && (
        <p className="students-result-summary">{isAlbanian ? 'Lista është shumë e gjatë; përdorni kërkimin për ta ngushtuar.' : 'This list is very long; use search to narrow it down.'}</p>
      )}

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
                    <h3>{isAlbanian ? 'Fshi të Dhënat e Nxënësit?' : 'Delete Student Record?'}</h3>
                    <p className="modal-subtitle">{isAlbanian ? 'Konfirmim për heqjen e përhershme nga regjistri.' : 'Permanent directory removal confirmation.'}</p>
                  </div>
                </div>
                <button type="button" className="icon-btn-close" onClick={() => setStudentToDelete(null)} aria-label={isAlbanian ? 'Mbyll' : 'Close'}>
                  <X size={16} />
                </button>
              </div>

              <div className="delete-modal-body">
                <p>
                  {isAlbanian ? (
                    <>A jeni të sigurt që dëshironi të hiqni përgjithmonë <strong>{studentToDelete.name}</strong>{studentClassLabel(studentToDelete, groupsById) ? ` (Klasa ${studentClassLabel(studentToDelete, groupsById)})` : ''} nga kjo shkollë?</>
                  ) : (
                    <>Are you sure you want to permanently remove <strong>{studentToDelete.name}</strong>{studentClassLabel(studentToDelete, groupsById) ? ` (Class ${studentClassLabel(studentToDelete, groupsById)})` : ''} from this school?</>
                  )}
                </p>
                <div className="delete-warning-callout">
                  <ShieldAlert size={16} />
                  <span>
                    {isAlbanian
                      ? 'Qasja e tyre në shkollë do të revokohet menjëherë. Nëse nuk kanë anëtarësim në shkolla të tjera, do të shohin ekranin "nuk jeni pjesë e asnjë shkolle".'
                      : 'Their access to this school and directory record will be removed. Other school memberships remain active; historical grades may remain in course records.'}
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
          <div className="modal-overlay" onClick={() => !isSubmittingStudent && setIsAddStudentOpen(false)}>
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Regjistro Nxënës të Ri' : 'Enroll New Student'}</h3>
                <p className="modal-subtitle">
                  {isAlbanian ? 'Krijoni llogarinë, caktoni klasën dhe lëndët.' : 'Create the account and assign the class and courses.'}
                </p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddStudentOpen(false)} aria-label={isAlbanian ? 'Mbyll' : 'Close'} disabled={isSubmittingStudent}>
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddStudentSubmit} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="new-student-name">{isAlbanian ? 'Emri i Plotë i Nxënësit *' : 'Student Full Name *'}</label>
                    <input
                      id="new-student-name"
                      type="text"
                      required
                      placeholder={isAlbanian ? 'p.sh. Era Berisha' : 'e.g. Maya Lin'}
                      value={studentForm.name}
                      onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="new-student-id">{isAlbanian ? 'ID Zyrtare e Nxënësit' : 'Official Student ID'}</label>
                    <input
                      id="new-student-id"
                      type="text"
                      placeholder={isAlbanian ? 'p.sh. STU-1007 (krijohet vetë nëse lihet bosh)' : 'e.g. STU-1007 (auto-generated if blank)'}
                      value={studentForm.studentId}
                      onChange={e => setStudentForm({ ...studentForm, studentId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="new-student-class">{isAlbanian ? 'Klasa / Paralelja' : 'Class'}</label>
                  <ClassSelect id="new-student-class" value={studentForm.classGroupId} classGroups={classGroups} isAlbanian={isAlbanian}
                    onChange={classGroupId => setStudentForm({ ...studentForm, classGroupId })} />
                  {noClassesHint || (addFormGroup && (
                    <small>{isAlbanian
                      ? `Nxënësi regjistrohet automatikisht në lëndët e klasës ${addFormGroup.label}.`
                      : `The student is enrolled automatically in class ${addFormGroup.label}'s courses.`}</small>
                  ))}
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="new-student-email">{isAlbanian ? 'Email-i i Nxënësit *' : 'Student Email *'}</label>
                    <input
                      id="new-student-email"
                      type="email"
                      required
                      placeholder={isAlbanian ? 'p.sh. era.b@student.edu' : 'e.g. maya.lin@student.edu'}
                      value={studentForm.email}
                      onChange={e => setStudentForm({ ...studentForm, email: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="new-student-password">{isAlbanian ? 'Fjalëkalimi Fillestar i Hyrjes' : 'Initial Login Password'}</label>
                    <input
                      id="new-student-password"
                      type="password"
                      minLength={6}
                      autoComplete="new-password"
                      placeholder={isAlbanian ? 'Kërkohet vetëm për llogari të reja (min. 6)' : 'Needed only for new accounts (min. 6)'}
                      value={studentForm.password || ''}
                      onChange={e => setStudentForm({ ...studentForm, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="new-student-phone">{isAlbanian ? 'Telefoni / Kontakti' : 'Phone / Contact'}</label>
                    <input
                      id="new-student-phone"
                      type="tel"
                      placeholder="e.g. +383 44 123 456"
                      value={studentForm.phone}
                      onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="new-student-guardian">{isAlbanian ? 'Kontakti i Prindit / Kujdestarit' : 'Guardian / Parent Contact'}</label>
                    <input
                      id="new-student-guardian"
                      type="text"
                      placeholder={isAlbanian ? 'p.sh. Besnik Berisha (Babai - +383 44 123 456)' : 'e.g. David Lin (Father - +1 555-900-12)'}
                      value={studentForm.guardian}
                      onChange={e => setStudentForm({ ...studentForm, guardian: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="new-student-gpa">{isAlbanian ? 'Synimi Fillestar i Notës Mesatare (GPA)' : 'Initial GPA Target'}</label>
                    <input
                      id="new-student-gpa"
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
                    <label>{isAlbanian ? 'Lëndë të Tjera' : 'Other Courses'}</label>
                    <SearchableCourseSelector
                      classesList={classesList}
                      selectedClasses={studentForm.assignedClasses || []}
                      onChange={(nextClasses) => setStudentForm({ ...studentForm, assignedClasses: nextClasses })}
                      isAlbanian={isAlbanian}
                      lockedClassGroupId={addFormGroup?.id || ''}
                      lockedClassLabel={addFormGroup?.label || ''}
                    />
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddStudentOpen(false)} disabled={isSubmittingStudent}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSubmittingStudent}>
                    {isSubmittingStudent
                      ? (isAlbanian ? 'Duke krijuar llogarinë…' : 'Creating account…')
                      : (isAlbanian ? 'Regjistro Nxënësin' : 'Enroll Student')}
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
                    ? `Përditësoni të dhënat, klasën dhe lëndët për ${editingStudent.name}.`
                    : `Update details, class and courses for ${editingStudent.name}.`}
                </p>
                <button type="button" className="icon-btn-close" onClick={() => !isSubmittingEdit && setEditingStudent(null)} aria-label={isAlbanian ? 'Mbyll' : 'Close'}>
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveEditStudent} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="edit-student-name">{isAlbanian ? 'Emri i Plotë' : 'Full Name'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span></label>
                    <input
                      id="edit-student-name"
                      type="text"
                      required
                      value={editStudentForm.name}
                      onChange={e => setEditStudentForm({ ...editStudentForm, name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="edit-student-id">{isAlbanian ? 'ID e Nxënësit' : 'Student ID'}</label>
                    <input
                      id="edit-student-id"
                      type="text"
                      value={editStudentForm.studentId}
                      onChange={e => setEditStudentForm({ ...editStudentForm, studentId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="edit-student-class">{isAlbanian ? 'Klasa / Paralelja' : 'Class'}</label>
                    <ClassSelect id="edit-student-class" value={editStudentForm.classGroupId} classGroups={classGroups} isAlbanian={isAlbanian}
                      onChange={classGroupId => setEditStudentForm({ ...editStudentForm, classGroupId })} />
                    {noClassesHint || (editClassHint && <small>{editClassHint}</small>)}
                  </div>

                  <div className="input-group">
                    <label htmlFor="edit-student-email">{isAlbanian ? 'Email Zyrtar' : 'Official Email'} <span style={{ color: 'hsl(var(--destructive))', fontWeight: 800 }}>*</span></label>
                    <input
                      id="edit-student-email"
                      type="email"
                      required
                      value={editStudentForm.email}
                      onChange={e => setEditStudentForm({ ...editStudentForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="edit-student-phone">{isAlbanian ? 'Telefoni / Kontakti' : 'Phone / Contact'}</label>
                    <input
                      id="edit-student-phone"
                      type="tel"
                      value={editStudentForm.phone}
                      onChange={e => setEditStudentForm({ ...editStudentForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="edit-student-guardian">{isAlbanian ? 'Kujdestari / Prindi' : 'Guardian / Parent'}</label>
                    <input
                      id="edit-student-guardian"
                      type="text"
                      value={editStudentForm.guardian}
                      onChange={e => setEditStudentForm({ ...editStudentForm, guardian: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="edit-student-gpa">{isAlbanian ? 'Nota Mesatare (GPA)' : 'GPA Target'}</label>
                    <input
                      id="edit-student-gpa"
                      type="number"
                      step="0.01"
                      min="0.0"
                      max="4.0"
                      value={editStudentForm.gpa}
                      onChange={e => setEditStudentForm({ ...editStudentForm, gpa: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="edit-student-status">{isAlbanian ? 'Statusi' : 'Status'}</label>
                    <select
                      id="edit-student-status"
                      className="custom-form-select"
                      value={editStudentForm.status}
                      onChange={e => setEditStudentForm({ ...editStudentForm, status: e.target.value })}
                    >
                      <option value="active">{isAlbanian ? 'Aktiv' : 'Active'}</option>
                      <option value="archived">{isAlbanian ? 'I Arkivuar' : 'Archived'}</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label>{isAlbanian ? 'Lëndë të Tjera' : 'Other Courses'}</label>
                  <SearchableCourseSelector
                    classesList={classesList}
                    selectedClasses={editStudentForm.assignedClasses || []}
                    onChange={(nextClasses) => setEditStudentForm({ ...editStudentForm, assignedClasses: nextClasses })}
                    isAlbanian={isAlbanian}
                    lockedClassGroupId={editFormGroup?.id || ''}
                    lockedClassLabel={editFormGroup?.label || ''}
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
