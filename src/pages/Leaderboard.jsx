import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Medal, Star, TrendingUp, Award, Zap, 
  Sparkles, Filter, Users, BookOpen, Search, ChevronDown, 
  Check, X, ArrowUpRight 
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './Leaderboard.css';

export const STUDENTS_DATABASE = [];

const DROPDOWN_GROUPS = [
  {
    category: 'General',
    items: [
      { id: 'overall', label: 'Overall (All Classes & Subjects)', icon: Trophy }
    ]
  },
  {
    category: 'Classes & Cohorts',
    items: [
      { id: '10a', label: 'Class 10A (Sophomores)', icon: Users },
      { id: '11b', label: 'Class 11B (Juniors)', icon: Users },
      { id: '12a', label: 'Class 12A (Seniors)', icon: Users },
      { id: 'math301', label: 'Advanced Mathematics (MATH-301)', icon: BookOpen },
      { id: 'hist202', label: 'World History (HIST-202)', icon: BookOpen },
      { id: 'phys401', label: 'Physics Mechanics (PHYS-401)', icon: BookOpen },
      { id: 'eng101', label: 'English Literature (ENG-101)', icon: BookOpen },
      { id: 'cs501', label: 'Computer Science (CS-501)', icon: BookOpen },
      { id: 'bio201', label: 'Biology Labs (BIO-201)', icon: BookOpen }
    ]
  },
  {
    category: 'Subject Disciplines',
    items: [
      { id: 'math', label: 'Mathematics', icon: Star },
      { id: 'science', label: 'Science & Physics', icon: Sparkles },
      { id: 'arts', label: 'Arts & Literature', icon: Award },
      { id: 'tech', label: 'Technology & Computing', icon: Zap },
      { id: 'humanities', label: 'Humanities & Civics', icon: BookOpen }
    ]
  }
];

const PodiumStep = ({ student, rank, height, color, delay, onSelect }) => {
  if (!student) return null;
  return (
    <motion.div 
      className={`podium-step rank-${rank}`}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: `${height}px`, opacity: 1 }}
      transition={{ delay, duration: 0.5, type: 'spring', bounce: 0.3 }}
      onClick={() => onSelect && onSelect(student)}
      title={`View ${student.name}'s Profile`}
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
        <span className="rank-num">#{rank}</span>
        <h4>{student.name}</h4>
        <span className="points">{student.points} pts</span>
        {student.badge && <span className="podium-badge-label">{student.badge}</span>}
      </div>
    </motion.div>
  );
};

const Leaderboard = ({ onStudentSelect, userRole = 'student' }) => {
  const isStudent = userRole === 'student';
  const { studentsList = [] } = useSchoolData();
  const { currentUser } = useAuth();
  const { t, isAlbanian } = useLanguage();
  const [activeFilter, setActiveFilter] = useState('overall');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

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
    for (const group of DROPDOWN_GROUPS) {
      const match = group.items.find(item => item.id === activeFilter);
      if (match) return match;
    }
    return DROPDOWN_GROUPS[0].items[0];
  }, [activeFilter]);

  // Filtered dropdown items for search
  const filteredDropdownGroups = useMemo(() => {
    if (!dropdownSearch.trim()) return DROPDOWN_GROUPS;
    const query = dropdownSearch.toLowerCase();
    return DROPDOWN_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => item.label.toLowerCase().includes(query))
    })).filter(group => group.items.length > 0);
  }, [dropdownSearch]);

  const studentsDatabase = useMemo(() => {
    return studentsList.map(student => ({
      id: student.id,
      name: student.name,
      avatar: student.name,
      classId: student.grade ? String(student.grade).toLowerCase().replace(/[^a-z0-9]/g, '') : 'all',
      className: student.grade ? `Class ${student.grade}` : 'General Cohort',
      grade: student.grade || '',
      overallPoints: Number(student.points) || 0,
      overallBadge: student.overallBadge || (student.gpa ? `GPA ${student.gpa}` : 'Honor Roll'),
      trend: 'same',
      subjects: {}
    }));
  }, [studentsList]);

  const filteredRankings = useMemo(() => {
    if (studentsDatabase.length === 0) return [];
    
    // 1. Overall filter
    if (activeFilter === 'overall') {
      return studentsDatabase.map(student => ({
        id: student.id,
        name: student.name,
        className: student.className,
        grade: student.grade,
        points: student.overallPoints,
        badge: student.overallBadge,
        trend: student.trend
      })).sort((a, b) => b.points - a.points).map((item, index) => ({
        ...item,
        rank: index + 1
      }));
    }

    // 2. Class cohorts
    const cohortMatches = studentsDatabase.filter(student => student.classId === activeFilter);
    if (cohortMatches.length > 0) {
      return cohortMatches
        .map(student => ({
          id: student.id,
          name: student.name,
          className: student.className,
          grade: student.grade,
          points: student.overallPoints,
          badge: student.overallBadge,
          trend: student.trend
        }))
        .sort((a, b) => b.points - a.points)
        .map((item, index) => ({
          ...item,
          rank: index + 1
        }));
    }

    // 3. Fallback
    return studentsDatabase
      .map(student => ({
        id: student.id,
        name: student.name,
        className: student.className,
        grade: student.grade,
        points: student.overallPoints,
        badge: student.overallBadge,
        trend: student.trend
      }))
      .sort((a, b) => b.points - a.points)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));
  }, [studentsDatabase, activeFilter]);

  const handleStudentClick = (student) => {
    if (isStudent) return; // Students do not access administrative student overview
    if (onStudentSelect) {
      onStudentSelect({
        id: student.id,
        name: student.name,
        grade: student.grade || '12',
        email: `${student.name.toLowerCase().replace(' ', '.')}@lumischool.edu`,
        phone: '+1 (555) 234-0' + student.id,
        points: student.points,
        badge: student.badge,
        tags: ['Honor Roll', 'Active Leader', 'Dean\'s Scholar']
      });
    }
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
            <span className="count-pill glass">{t('leaderboard.season', 'Season 2026')}</span>
          </div>
          <p>{t('leaderboard.subtitle', 'Celebrating high academic achievements, subject mastery, and class excellence.')}</p>
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
                    placeholder="Search classes, cohorts, or subjects..."
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
                      <span>No matching class or subject found</span>
                    </div>
                  ) : (
                    filteredDropdownGroups.map(group => (
                      <div key={group.category} className="dropdown-group">
                        <div className="dropdown-group-title">{group.category}</div>
                        {group.items.map(item => {
                          const Icon = item.icon;
                          const isSelected = activeFilter === item.id;
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
        {activeFilter !== 'overall' && (
          <button 
            type="button" 
            className="reset-overall-pill bouncy"
            onClick={() => setActiveFilter('overall')}
          >
            <Trophy size={13} /> Reset to Overall
          </button>
        )}
      </div>

      {filteredRankings.length === 0 ? (
        <section className="empty-leaderboard glass" style={{ padding: '3rem 2rem', textAlign: 'center', borderRadius: '24px', margin: '2rem 0' }}>
          <Trophy size={48} style={{ color: 'hsl(var(--muted-foreground))', margin: '0 auto 1rem auto' }} />
          <h3>No Leaderboard Rankings Yet</h3>
          <p style={{ color: 'hsl(var(--muted-foreground))', maxWidth: '400px', margin: '0 auto' }}>
            Academic points and distinctions will appear here once students are enrolled and evaluated.
          </p>
        </section>
      ) : (
        <>
          {/* Top 3 Podium */}
          <section className="podium-section">
            {top2 && <PodiumStep student={top2} rank={2} height={200} color="hsl(var(--accent))" delay={0.15} onSelect={handleStudentClick} />}
            {top1 && <PodiumStep student={top1} rank={1} height={260} color="hsl(var(--mood-neutral))" delay={0.3} onSelect={handleStudentClick} />}
            {top3 && <PodiumStep student={top3} rank={3} height={160} color="hsl(var(--mood-sad))" delay={0.05} onSelect={handleStudentClick} />}
          </section>

          {/* Rankings List */}
          <section className="rankings-list glass">
            <div className="list-header">
              <span>{t('leaderboard.rank', 'Rank')}</span>
              <span>{t('leaderboard.distinction', 'Student & Distinction')}</span>
              <span>{t('leaderboard.class', 'Class')}</span>
              <span>{t('leaderboard.trend', 'Trend')}</span>
              <span>{t('leaderboard.points', 'Points')}</span>
            </div>
            <div className="list-body">
              <AnimatePresence mode="wait">
                {rest.length === 0 && filteredRankings.length <= 3 ? (
                  <div className="empty-rankings-note">
                    <span>{t('leaderboard.allTopNote', 'All top enrolled students are featured on the podium above! Click any student to view their profile. 🌟')}</span>
                  </div>
                ) : (
                  rest.map((student, index) => {
                    const isCurrentUser = isStudent && (student.id === currentUser?.uid || (student.name && currentUser?.name && student.name.toLowerCase() === currentUser.name.toLowerCase()));
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
                            {student.badge && <span className="student-badge-pill">{student.badge}</span>}
                          </div>
                        </div>
                      <div className="class-col muted">
                        {student.className ? student.className.split(' ').slice(0, 2).join(' ') : 'Class'}
                      </div>
                      <div className="trend-col">
                        {student.trend === 'up' && <TrendingUp size={17} color="hsl(var(--mood-happy))" />}
                        {student.trend === 'down' && <TrendingUp size={17} color="hsl(var(--destructive))" style={{ transform: 'scaleY(-1)' }} />}
                        {student.trend === 'same' && <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>}
                      </div>
                      <div className="points-col font-bold">
                        {student.points} pts
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
