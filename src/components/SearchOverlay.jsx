import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, X, GraduationCap, ArrowRight, Calendar, BookOpen, Users } from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from './Avatar';
import { classGroupsById, homeroomTeacherInfo, studentClassLabel } from '../features/classGroups';
import { useStudentSearch } from '../features/students/studentData';
import './SearchOverlay.css';

const GROUP_LIMIT = 4;

const SearchOverlay = ({ isOpen, onClose, classes = [], events = [], onNavigate, onOpenStudent, onOpenCourse, onOpenClassGroup, userRole = 'admin' }) => {
  const { staffList = [], rolesList = [], classGroups = [] } = useSchoolData();
  const { activeSchoolId } = useAuth();
  const { isAlbanian } = useLanguage();
  const [query, setQuery] = useState('');
  const isStudent = userRole === 'student';
  const groupsById = useMemo(() => classGroupsById(classGroups), [classGroups]);
  // Students are searched on the server; the app never loads them all.
  const studentSearch = useStudentSearch(activeSchoolId, query, { max: GROUP_LIMIT, enabled: isOpen && !isStudent });

  const results = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    if (!lowerQuery) return { staff: [], courses: [], classGroups: [], events: [] };
    const has = value => String(value || '').toLowerCase().includes(lowerQuery);
    return {
      staff: isStudent ? [] : staffList.filter(member => [member.name, member.subject, member.department, member.roleName, member.email].some(has)).slice(0, GROUP_LIMIT),
      courses: classes.filter(course => [course.name, course.subject, course.code, course.teacher, groupsById.get(String(course.classGroupId || ''))?.label].some(has)).slice(0, GROUP_LIMIT),
      classGroups: classGroups.filter(group => [group.label, `${isAlbanian ? 'klasa' : 'class'} ${group.label}`, group.homeroomTeacherName, group.room].some(has)).slice(0, GROUP_LIMIT),
      events: events.filter(event => [event.title, event.location].some(has)).slice(0, GROUP_LIMIT),
    };
  }, [query, staffList, classes, classGroups, groupsById, events, isStudent, isAlbanian]);

  const close = () => { setQuery(''); onClose(); };
  const go = action => { action(); close(); };

  if (!isOpen) return null;

  const students = studentSearch.results;
  const hasQuery = query.trim() !== '';
  const hasAnyResults = students.length > 0 || Object.values(results).some(list => list.length > 0);
  const stillSearching = studentSearch.loading;

  return (
    <motion.div
      className="search-overlay-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={close}
    >
      <motion.div
        className="search-modal glass"
        initial={{ scale: 0.9, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: -20 }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isAlbanian ? 'Kërko' : 'Search'}
      >
        <div className="search-input-wrapper">
          <Search className="search-icon" size={24} />
          <input
            autoFocus
            type="text"
            placeholder={isStudent
              ? (isAlbanian ? 'Kërko lëndët, klasat ose ngjarjet…' : 'Search courses, classes or events…')
              : (isAlbanian ? 'Kërko nxënës, staf, lëndë, klasa ose ngjarje…' : 'Search students, staff, courses, classes or events…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={isAlbanian ? 'Kërko' : 'Search'}
          />
          <button className="close-btn" onClick={close} aria-label={isAlbanian ? 'Mbyll' : 'Close'}>
            <X size={20} />
          </button>
        </div>

        <div className="search-results">
          {hasQuery && !hasAnyResults ? (
            <div className="no-results">
              <p>{stillSearching
                ? (isAlbanian ? 'Duke kërkuar…' : 'Searching…')
                : (isAlbanian ? `Asnjë rezultat për "${query}"` : `No results found for "${query}"`)}</p>
            </div>
          ) : (
            <div className="results-grid">
              {students.length > 0 && (
                <div className="results-group">
                  <h4>{isAlbanian ? 'Nxënësit' : 'Students'}</h4>
                  {students.map(student => (
                    <button type="button" key={student.id} className="result-item bouncy"
                      onClick={() => go(() => (onOpenStudent ? onOpenStudent(student) : onNavigate('students')))}>
                      <div className="avatar-xs">
                        <Avatar alt={student.name} />
                      </div>
                      <div className="result-info">
                        <span className="name">{student.name}</span>
                        <span className="meta">{[studentClassLabel(student, groupsById) && `${isAlbanian ? 'Klasa' : 'Class'} ${studentClassLabel(student, groupsById)}`, student.studentId].filter(Boolean).join(' • ') || student.email}</span>
                      </div>
                      <ArrowRight size={14} className="arrow" />
                    </button>
                  ))}
                  {studentSearch.capped && (
                    <button type="button" className="result-more" onClick={() => go(() => onNavigate('students'))}>
                      {isAlbanian ? 'Më shumë te Regjistri i Nxënësve' : 'More in the Students directory'}
                    </button>
                  )}
                </div>
              )}

              {results.staff.length > 0 && (
                <div className="results-group">
                  <h4>{isAlbanian ? 'Stafi' : 'Staff & Faculty'}</h4>
                  {results.staff.map(member => {
                    const role = rolesList.find(r => r.id === member.roleId);
                    return (
                      <button type="button" key={member.id} className="result-item bouncy" onClick={() => go(() => onNavigate('staff'))}>
                        <div className="avatar-xs">
                          <Avatar alt={member.name} />
                        </div>
                        <div className="result-info">
                          <span className="name">{member.name}</span>
                          <span className="meta">{member.roleName || role?.name || member.department}</span>
                        </div>
                        <ArrowRight size={14} className="arrow" />
                      </button>
                    );
                  })}
                </div>
              )}

              {results.classGroups.length > 0 && (
                <div className="results-group">
                  <h4>{isAlbanian ? 'Klasat' : 'Classes'}</h4>
                  {results.classGroups.map(group => (
                    <button type="button" key={group.id} className="result-item bouncy"
                      onClick={() => go(() => (onOpenClassGroup ? onOpenClassGroup(group) : onNavigate('classes')))}>
                      <div className="avatar-xs icon-avatar">
                        <Users size={20} />
                      </div>
                      <div className="result-info">
                        <span className="name">{isAlbanian ? 'Klasa' : 'Class'} {group.label}</span>
                        <span className="meta">{isAlbanian ? 'Kujdestari' : 'Homeroom'}: {homeroomTeacherInfo(group, staffList, isAlbanian).name}</span>
                      </div>
                      <ArrowRight size={14} className="arrow" />
                    </button>
                  ))}
                </div>
              )}

              {results.courses.length > 0 && (
                <div className="results-group">
                  <h4>{isAlbanian ? 'Lëndët' : 'Courses'}</h4>
                  {results.courses.map(course => (
                    <button type="button" key={course.id} className="result-item bouncy"
                      onClick={() => go(() => (onOpenCourse ? onOpenCourse(course) : onNavigate('classes')))}>
                      <div className="avatar-xs icon-avatar">
                        <BookOpen size={20} />
                      </div>
                      <div className="result-info">
                        <span className="name">{course.name || course.subject}</span>
                        <span className="meta">{[course.code, groupsById.get(String(course.classGroupId || ''))?.label && `${isAlbanian ? 'Klasa' : 'Class'} ${groupsById.get(String(course.classGroupId)).label}`, course.teacher].filter(Boolean).join(' • ')}</span>
                      </div>
                      <ArrowRight size={14} className="arrow" />
                    </button>
                  ))}
                </div>
              )}

              {results.events.length > 0 && (
                <div className="results-group">
                  <h4>{isAlbanian ? 'Ngjarjet' : 'Events'}</h4>
                  {results.events.map(event => (
                    <button type="button" key={event.id} className="result-item bouncy" onClick={() => go(() => onNavigate('events'))}>
                      <div className="avatar-xs icon-avatar">
                        <Calendar size={20} />
                      </div>
                      <div className="result-info">
                        <span className="name">{event.title}</span>
                        <span className="meta">{event.location}</span>
                      </div>
                      <ArrowRight size={14} className="arrow" />
                    </button>
                  ))}
                </div>
              )}
              {hasQuery && stillSearching && hasAnyResults && (
                <p className="search-hint">{isAlbanian ? 'Duke kërkuar nxënës…' : 'Searching students…'}</p>
              )}
            </div>
          )}

          {!hasQuery && (
            <div className="search-shortcuts">
              <p>{isAlbanian ? 'Kërkoni sipas emrit, email-it, ID-së, lëndës, klasës ose ngjarjes.' : 'Search by name, email, ID, course, class or event.'}</p>
              {classGroups.length > 0 && (
                <div className="shortcuts-row">
                  {classGroups.slice(0, 6).map(group => (
                    <button type="button" key={group.id} className="shortcut-chip glass" onClick={() => setQuery(group.label)}>
                      <GraduationCap size={13} /> {group.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SearchOverlay;
