import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, User, GraduationCap, ArrowRight, UserCheck, Shield, Calendar, Sparkles } from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { Avatar } from './Avatar';
import './SearchOverlay.css';

const SearchOverlay = ({ isOpen, onClose, classes = [], events = [], onNavigate, userRole = 'admin' }) => {
  const { studentsList, staffList, rolesList } = useSchoolData();
  const [query, setQuery] = useState('');
  const isStudent = userRole === 'student';

  const results = useMemo(() => {
    if (query.trim() === '') {
      return { students: [], staff: [], classes: [], events: [] };
    }

    const lowerQuery = query.toLowerCase();
    
    return {
      students: isStudent ? [] : studentsList.filter(s => 
        s.name.toLowerCase().includes(lowerQuery) || 
        s.grade.toLowerCase().includes(lowerQuery) ||
        (s.tags && s.tags.some(t => t.toLowerCase().includes(lowerQuery)))
      ).slice(0, 3),
      staff: isStudent ? [] : staffList.filter(t => 
        t.name.toLowerCase().includes(lowerQuery) || 
        (t.subject && t.subject.toLowerCase().includes(lowerQuery)) ||
        (t.department && t.department.toLowerCase().includes(lowerQuery)) ||
        (t.roleName && t.roleName.toLowerCase().includes(lowerQuery))
      ).slice(0, 3),
      classes: classes.filter(c => 
        c.name.toLowerCase().includes(lowerQuery) || 
        (c.code && c.code.toLowerCase().includes(lowerQuery)) ||
        (c.teacher && c.teacher.toLowerCase().includes(lowerQuery))
      ).slice(0, 3),
      events: events.filter(e => 
        e.title.toLowerCase().includes(lowerQuery) || 
        (e.location && e.location.toLowerCase().includes(lowerQuery))
      ).slice(0, 3)
    };
  }, [query, studentsList, staffList, classes, events, isStudent]);

  const handleResultClick = (path) => {
    onNavigate(path);
    onClose();
  };

  if (!isOpen) return null;

  const hasAnyResults = Object.values(results).some(arr => arr.length > 0);

  return (
    <motion.div 
      className="search-overlay-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="search-modal glass"
        initial={{ scale: 0.9, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: -20 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="search-input-wrapper">
          <Search className="search-icon" size={24} />
          <input 
            autoFocus
            type="text" 
            placeholder={isStudent ? "Search your classes, timetable, campus events..." : "Search students, staff & faculty, classes, or events..."} 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="search-results">
          {query.trim() !== '' && !hasAnyResults ? (
            <div className="no-results">
              <p>No results found for "{query}" 🔎</p>
            </div>
          ) : (
            <div className="results-grid">
              {results.staff.length > 0 && (
                <div className="results-group">
                  <h4>Staff & Faculty</h4>
                  {results.staff.map(member => {
                    const role = rolesList.find(r => r.id === member.roleId);
                    return (
                      <div key={member.id} className="result-item bouncy" onClick={() => handleResultClick('staff')}>
                        <div className="avatar-xs">
                          <Avatar alt={member.name} />
                        </div>
                        <div className="result-info">
                          <span className="name">{member.name}</span>
                          <span className="meta">{member.roleName || role?.name || member.department}</span>
                        </div>
                        <ArrowRight size={14} className="arrow" />
                      </div>
                    );
                  })}
                </div>
              )}

              {results.students.length > 0 && (
                <div className="results-group">
                  <h4>Students</h4>
                  {results.students.map(student => (
                    <div key={student.id} className="result-item bouncy" onClick={() => handleResultClick('students')}>
                      <div className="avatar-xs">
                        <Avatar alt={student.name} />
                      </div>
                      <div className="result-info">
                        <span className="name">{student.name}</span>
                        <span className="meta">Grade {student.grade} • GPA {student.gpa || '3.8'}</span>
                      </div>
                      <ArrowRight size={14} className="arrow" />
                    </div>
                  ))}
                </div>
              )}

              {results.classes.length > 0 && (
                <div className="results-group">
                  <h4>Classes</h4>
                  {results.classes.map(cls => (
                    <div key={cls.id} className="result-item bouncy" onClick={() => handleResultClick('classes')}>
                      <div className="avatar-xs icon-avatar">
                        <GraduationCap size={20} />
                      </div>
                      <div className="result-info">
                        <span className="name">{cls.name}</span>
                        <span className="meta">{cls.code || 'Class'} • {cls.teacher}</span>
                      </div>
                      <ArrowRight size={14} className="arrow" />
                    </div>
                  ))}
                </div>
              )}

              {results.events.length > 0 && (
                <div className="results-group">
                  <h4>Events</h4>
                  {results.events.map(event => (
                    <div key={event.id} className="result-item bouncy" onClick={() => handleResultClick('events')}>
                      <div className="avatar-xs icon-avatar">
                        <Calendar size={20} />
                      </div>
                      <div className="result-info">
                        <span className="name">{event.title}</span>
                        <span className="meta">{event.location}</span>
                      </div>
                      <ArrowRight size={14} className="arrow" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {query.trim() === '' && (
            <div className="search-shortcuts">
              <p>Quick filters:</p>
              <div className="shortcuts-row">
                <span className="shortcut-chip glass" onClick={() => setQuery('Grade 10')}>Grade 10</span>
                <span className="shortcut-chip glass" onClick={() => setQuery('Math')}>Mathematics</span>
                <span className="shortcut-chip glass" onClick={() => setQuery('Science')}>Science</span>
                <span className="shortcut-chip glass" onClick={() => setQuery('Teacher')}>Teachers</span>
                <span className="shortcut-chip glass" onClick={() => setQuery('Admin')}>Admin</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SearchOverlay;
