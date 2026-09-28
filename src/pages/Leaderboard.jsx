import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Users, BookOpen, Search, ChevronDown, Check, X, ArrowUpRight } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { buildSchoolRankings } from '../features/gradebook/schoolResults';
import { useCourseRecords } from '../features/gradebook/useCourseRecords';
import { isStudentEnrolledInCourse } from '../features/enrollment';
import './Leaderboard.css';

const PodiumStep = ({ student, rank, height, color, delay, onSelect, isAlbanian }) => {
  if (!student) return null;
  return (
    <motion.div 
      className={`podium-step rank-${rank}`}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: `${height}px`, opacity: 1 }}
      transition={{ delay, duration: 0.5, type: 'spring', bounce: 0.3 }}
      onClick={() => onSelect && onSelect(student)}
      title={student.name}
    >
      <motion.div 
        className="podium-avatar"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: delay + 0.2 }}
      >
        <Avatar alt={student.name} />
        <div className="medal-icon" style={{ backgroundColor: color }}>
          {rank === 1 ? <Trophy size={16} color="white" /> : <Medal size={16} color="white" />}
        </div>
      </motion.div>
      <div className="podium-base glass" style={{ backgroundColor: color }}>
        <span className="rank-num">#{student.rank}</span>
        <h4>{student.name}</h4>
        <span className="points">{student.average}%</span>
        <span className="podium-badge-label">{student.gradedCourses} {isAlbanian ? 'lëndë me nota' : student.gradedCourses === 1 ? 'graded course' : 'graded courses'}</span>
      </div>
    </motion.div>
  );
};

const Leaderboard = ({ onStudentSelect, userRole = 'student' }) => {
  const isStudent = userRole === 'student';
  const { studentsList = [], classesList = [], classesLoaded } = useSchoolData();
  const { currentUser, activeSchoolId } = useAuth();
  const { t, isAlbanian } = useLanguage();
  const [activeFilter, setActiveFilter] = useState('overall');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const assessedCourses = useMemo(() => classesList.filter(course => studentsList.some(student => student.status !== 'archived' && isStudentEnrolledInCourse(student, course))), [classesList, studentsList]);
  const { records, loading: gradesLoading, error: gradesError } = useCourseRecords(activeSchoolId, assessedCourses);

  const dropdownGroups = useMemo(() => {
    const cohorts = [...new Set(studentsList.filter(student => student.status !== 'archived').map(student => String(student.grade || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(grade => ({ id: `cohort:${grade}`, label: `${isAlbanian ? 'Klasa' : 'Class'} ${grade}`, icon: Users }));
    const courses = classesList.map(course => ({ id: `course:${course.id}`, label: [course.name, course.code && `(${course.code})`].filter(Boolean).join(' '), icon: BookOpen }));
    return [
      { category: isAlbanian ? 'Të gjitha' : 'General', items: [{ id: 'overall', label: isAlbanian ? 'Mesatarja e të gjitha lëndëve' : 'All graded courses', icon: Trophy }] },
      ...(cohorts.length ? [{ category: isAlbanian ? 'Klasat' : 'Class groups', items: cohorts }] : []),
      ...(courses.length ? [{ category: isAlbanian ? 'Lëndët' : 'Courses', items: courses }] : []),
    ];
  }, [studentsList, classesList, isAlbanian]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isDropdownOpen]);

  // Find active filter label and icon
  const currentOption = useMemo(() => {
    for (const group of dropdownGroups) {
      const match = group.items.find(item => item.id === activeFilter);
      if (match) return match;
    }
    return dropdownGroups[0].items[0];
  }, [activeFilter, dropdownGroups]);

  // Filtered dropdown items for search
  const filteredDropdownGroups = useMemo(() => {
    if (!dropdownSearch.trim()) return dropdownGroups;
    const query = dropdownSearch.toLowerCase();
    return dropdownGroups.map(group => ({
      ...group,
      items: group.items.filter(item => item.label.toLowerCase().includes(query))
    })).filter(group => group.items.length > 0);
  }, [dropdownSearch, dropdownGroups]);

  const filteredRankings = useMemo(() => gradesLoading || gradesError ? [] : buildSchoolRankings(studentsList, classesList, records, currentOption.id), [studentsList, classesList, records, currentOption.id, gradesLoading, gradesError]);

  const handleStudentClick = (student) => {
    if (isStudent) return; // Students do not access administrative student overview
    const actualStudent = studentsList.find(item => String(item.id) === String(student.id));
    if (onStudentSelect && actualStudent) onStudentSelect(actualStudent);
  };

  const top1 = filteredRankings[0];
  const top2 = filteredRankings[1];
  const top3 = filteredRankings[2];
  const rest = filteredRankings.slice(3);

  const CurrentIcon = currentOption.icon;

  return (
    <motion.div 
      className="leaderboard-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <header className="page-header">
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              {t('leaderboard.title', 'Academic Leaderboard')}
              <Trophy size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">{isAlbanian ? 'Notat aktuale' : 'Current grades'}</span>
          </div>
          <p>{isAlbanian ? 'Renditja bazohet në mesataren e notave të lëndëve me vlerësime në shkollën aktive.' : 'Ranked by the average grade across assessed courses in the active school.'}</p>
        </div>
      </header>

      {/* Controls Bar with Searchable Dropdown Filter */}
      <div className="leaderboard-controls-bar">
        <div className="searchable-filter-container" ref={dropdownRef}>
          <button 
            type="button" 
            className={`searchable-filter-trigger ${isDropdownOpen ? 'active' : ''}`}
            onClick={() => setIsDropdownOpen(prev => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
          >
            <div className="trigger-left">
              <CurrentIcon size={16} className="trigger-icon" />
              <span className="trigger-label-muted">{t('common.filter', 'Filter')}:</span>
              <strong className="trigger-value">{currentOption.label}</strong>
            </div>
            <ChevronDown size={16} className={`chevron-arrow ${isDropdownOpen ? 'open' : ''}`} />
          </button>

          {/* Searchable Dropdown Popover */}
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div 
                className="searchable-dropdown-popover glass"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {/* Search Bar inside Dropdown */}
                <div className="dropdown-search-box">
                  <Search size={15} className="dropdown-search-icon" />
                  <input 
                    ref={searchInputRef}
                    type="text"
                    placeholder={isAlbanian ? 'Kërko klasa ose lëndë...' : 'Search class groups or courses...'}
                    value={dropdownSearch}
                    onChange={(e) => setDropdownSearch(e.target.value)}
                  />
                  {dropdownSearch && (
                    <button 
                      type="button" 
                      className="dropdown-search-clear"
                      onClick={() => setDropdownSearch('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown Options List */}
                <div className="dropdown-options-list">
                  {filteredDropdownGroups.length === 0 ? (
                    <div className="dropdown-empty-state">
                      <span>{isAlbanian ? 'Nuk u gjet klasë ose lëndë' : 'No matching class group or course'}</span>
                    </div>
                  ) : (
                    filteredDropdownGroups.map(group => (
                      <div key={group.category} className="dropdown-group">
                        <div className="dropdown-group-title">{group.category}</div>
                        {group.items.map(item => {
                          const Icon = item.icon;
                          const isSelected = currentOption.id === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`dropdown-option-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                setActiveFilter(item.id);
                                setIsDropdownOpen(false);
                                setDropdownSearch('');
                              }}
                            >
                              <div className="option-item-left">
                                <Icon size={15} className="option-icon" />
                                <span>{item.label}</span>
                              </div>
                              {isSelected && <Check size={16} className="option-check-icon" />}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Reset to Overall Pill */}
        {currentOption.id !== 'overall' && (
          <button 
            type="button" 
            className="reset-overall-pill bouncy"
            onClick={() => setActiveFilter('overall')}
          >
            <Trophy size={13} /> {isAlbanian ? 'Të gjitha lëndët' : 'All courses'}
          </button>
        )}
      </div>

      {gradesError ? (
        <section className="empty-leaderboard glass" style={{ padding: '3rem 2rem', textAlign: 'center', borderRadius: '24px', margin: '2rem 0' }}>
          <h3>{isAlbanian ? 'Notat nuk mund të ngarkohen' : 'Grades could not be loaded'}</h3>
          <p>{isAlbanian ? 'Kontrolloni lejet e lëndëve dhe provoni përsëri.' : 'Check course access and try again.'}</p>
        </section>
      ) : (gradesLoading || !classesLoaded) ? (
        <section className="empty-leaderboard glass" style={{ padding: '3rem 2rem', textAlign: 'center', borderRadius: '24px', margin: '2rem 0' }}>
          <p>{isAlbanian ? 'Po ngarkohen notat...' : 'Loading course grades...'}</p>
        </section>
      ) : filteredRankings.length === 0 ? (
        <section className="empty-leaderboard glass" style={{ padding: '3rem 2rem', textAlign: 'center', borderRadius: '24px', margin: '2rem 0' }}>
          <Trophy size={48} style={{ color: 'hsl(var(--muted-foreground))', margin: '0 auto 1rem auto' }} />
          <h3>{isAlbanian ? 'Ende nuk ka renditje' : 'No rankings yet'}</h3>
          <p style={{ color: 'hsl(var(--muted-foreground))', maxWidth: '400px', margin: '0 auto' }}>
            {isAlbanian ? 'Renditja shfaqet pasi nxënësit e regjistruar marrin vlerësime në lëndë.' : 'Rankings appear after enrolled students receive course grades.'}
          </p>
        </section>
      ) : (
        <>
          {/* Top 3 Podium */}
          <section className="podium-section">
            {top2 && <PodiumStep student={top2} rank={2} height={200} color="hsl(var(--accent))" delay={0.15} onSelect={handleStudentClick} isAlbanian={isAlbanian} />}
            {top1 && <PodiumStep student={top1} rank={1} height={260} color="hsl(var(--mood-neutral))" delay={0.3} onSelect={handleStudentClick} isAlbanian={isAlbanian} />}
            {top3 && <PodiumStep student={top3} rank={3} height={160} color="hsl(var(--mood-sad))" delay={0.05} onSelect={handleStudentClick} isAlbanian={isAlbanian} />}
          </section>

          {/* Rankings List */}
          <section className="rankings-list glass">
            <div className="list-header">
              <span>{t('leaderboard.rank', 'Rank')}</span>
              <span>{isAlbanian ? 'Nxënësi' : 'Student'}</span>
              <span>{t('leaderboard.class', 'Class')}</span>
              <span>{isAlbanian ? 'Lëndë' : 'Courses'}</span>
              <span>{isAlbanian ? 'Mesatarja' : 'Average'}</span>
            </div>
            <div className="list-body">
              <AnimatePresence mode="wait">
                {rest.length === 0 && filteredRankings.length <= 3 ? (
                  <div className="empty-rankings-note">
                    <span>{isAlbanian ? 'Nxënësit me nota janë paraqitur në podium.' : 'All students with grades are shown on the podium above.'}</span>
                  </div>
                ) : (
                  rest.map((student, index) => {
                    const isCurrentUser = isStudent && student.id === currentUser?.uid;
                    return (
                      <motion.div 
                        key={`${activeFilter}-${student.id}`} 
                        className={`ranking-row bouncy ${isCurrentUser ? 'current-user-row' : ''}`}
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 15 }}
                        transition={{ duration: 0.2, delay: index * 0.04 }}
                        onClick={() => handleStudentClick(student)}
                        style={{ cursor: isStudent ? 'default' : 'pointer' }}
                        title={isCurrentUser ? (isAlbanian ? 'Profili Juaj në Renditje' : 'Your Ranking Profile') : (isStudent ? `${student.name}'s Academic Standing` : `View ${student.name}'s Profile`)}
                      >
                        <div className="rank-col">#{student.rank}</div>
                        <div className="student-col">
                          <div className="avatar-small">
                            <Avatar alt={student.name} />
                          </div>
                          <div className="student-info-col">
                            <div className="student-name-row">
                              <span className="student-name">{student.name}</span>
                              {isCurrentUser && <span className="you-pill-badge">{t('leaderboard.you', 'You')}</span>}
                              {!isStudent && <ArrowUpRight size={13} className="student-view-icon" />}
                            </div>
                            <span className="student-badge-pill">{student.gradedCourses} {isAlbanian ? 'lëndë me nota' : student.gradedCourses === 1 ? 'graded course' : 'graded courses'}</span>
                          </div>
                        </div>
                      <div className="class-col muted">
                        {student.grade ? `${isAlbanian ? 'Klasa' : 'Class'} ${student.grade}` : '—'}
                      </div>
                      <div className="trend-col">
                        {student.gradedCourses}
                      </div>
                      <div className="points-col font-bold">
                        {student.average}%
                      </div>
                    </motion.div>
                  ); })
                )}
              </AnimatePresence>
            </div>
          </section>
        </>
      )}
    </motion.div>
  );
};

export default Leaderboard;
