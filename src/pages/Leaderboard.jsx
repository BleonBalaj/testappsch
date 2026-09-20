import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Medal, Star, TrendingUp, Award, Zap, 
  Sparkles, Filter, Users, BookOpen, Search, ChevronDown, 
  Check, X, ArrowUpRight 
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import './Leaderboard.css';

const STUDENTS_DATABASE = [
  {
    id: 1,
    name: 'Bella Blue',
    avatar: 'Bella',
    classId: '12a',
    className: 'Class 12A (Seniors)',
    grade: '12',
    overallPoints: 1420,
    overallBadge: 'Valedictorian Candidate',
    trend: 'up',
    subjects: {
      math: { points: 490, badge: 'Calculus Champion', trend: 'up' },
      science: { points: 450, badge: 'Chemistry Star', trend: 'same' },
      arts: { points: 380, badge: 'Creative Essayist', trend: 'up' },
      tech: { points: 480, badge: 'AI & Algorithm MVP', trend: 'up' },
      humanities: { points: 420, badge: 'Civics Scholar', trend: 'up' },
      math301: { points: 490, badge: 'Math 301 Top Scorer', trend: 'up' },
      hist202: { points: 420, badge: 'World History Lead', trend: 'up' },
      phys401: { points: 450, badge: 'Physics Lab Head', trend: 'up' },
      eng101: { points: 380, badge: 'English Lit Honors', trend: 'up' },
      cs501: { points: 480, badge: 'CS Algorithms Ace', trend: 'up' },
      bio201: { points: 430, badge: 'Biology Research Lead', trend: 'up' }
    }
  },
  {
    id: 2,
    name: 'Luna Star',
    avatar: 'Luna',
    classId: '11b',
    className: 'Class 11B (Juniors)',
    grade: '11',
    overallPoints: 1280,
    overallBadge: 'Science Fair Champion',
    trend: 'up',
    subjects: {
      math: { points: 410, badge: 'Geometry Master', trend: 'same' },
      science: { points: 485, badge: 'Physics Genius', trend: 'up' },
      arts: { points: 340, badge: 'Digital Art Lead', trend: 'up' },
      tech: { points: 450, badge: 'Robotics Captain', trend: 'up' },
      humanities: { points: 390, badge: 'World History Ace', trend: 'up' },
      math301: { points: 410, badge: 'Math Honors', trend: 'same' },
      hist202: { points: 390, badge: 'History Finalist', trend: 'up' },
      phys401: { points: 485, badge: 'Quantum Physics MVP', trend: 'up' },
      eng101: { points: 340, badge: 'Lit Scholar', trend: 'same' },
      cs501: { points: 450, badge: 'Robotics Programmer', trend: 'up' },
      bio201: { points: 480, badge: 'Bio Lab Specialist', trend: 'up' }
    }
  },
  {
    id: 3,
    name: 'Sophie Miller',
    avatar: 'Sophie',
    classId: '12a',
    className: 'Class 12A (Seniors)',
    grade: '12',
    overallPoints: 1150,
    overallBadge: "Dean's Honor Roll",
    trend: 'down',
    subjects: {
      math: { points: 380, badge: 'Stats Whiz', trend: 'down' },
      science: { points: 395, badge: 'Lab Master', trend: 'down' },
      arts: { points: 430, badge: 'Theater Stage Lead', trend: 'up' },
      tech: { points: 360, badge: 'Web Development Ace', trend: 'same' },
      humanities: { points: 460, badge: 'Model UN Best Delegate', trend: 'up' },
      math301: { points: 380, badge: 'Applied Math', trend: 'down' },
      hist202: { points: 460, badge: 'Civics Scholar', trend: 'up' },
      phys401: { points: 395, badge: 'Optics Project MVP', trend: 'down' },
      eng101: { points: 430, badge: 'Editor-in-Chief', trend: 'up' },
      cs501: { points: 360, badge: 'Frontend Architect', trend: 'same' },
      bio201: { points: 390, badge: 'Genetics Fellow', trend: 'same' }
    }
  },
  {
    id: 4,
    name: 'Leo Lion',
    avatar: 'Leo',
    classId: '10a',
    className: 'Class 10A (Sophomores)',
    grade: '10',
    overallPoints: 1060,
    overallBadge: 'Debate Finalist',
    trend: 'same',
    subjects: {
      math: { points: 350, badge: 'Problem Solver', trend: 'up' },
      science: { points: 360, badge: 'Bio Exploration Ace', trend: 'same' },
      arts: { points: 410, badge: 'Drama Co-Lead', trend: 'down' },
      tech: { points: 340, badge: 'Game Engine Novice', trend: 'up' },
      humanities: { points: 450, badge: 'Philosophy Whiz', trend: 'up' },
      math301: { points: 350, badge: 'Algebra II Top 5', trend: 'up' },
      hist202: { points: 450, badge: 'Mock Trial Lead', trend: 'up' },
      phys401: { points: 360, badge: 'Mechanics Lab Ace', trend: 'same' },
      eng101: { points: 410, badge: 'Creative Essayist', trend: 'down' },
      cs501: { points: 340, badge: 'Scratch & Python MVP', trend: 'up' },
      bio201: { points: 360, badge: 'Ecology Explorer', trend: 'same' }
    }
  },
  {
    id: 5,
    name: 'Oliver Twist',
    avatar: 'Oliver',
    classId: '11b',
    className: 'Class 11B (Juniors)',
    grade: '11',
    overallPoints: 990,
    overallBadge: 'Literature Whiz',
    trend: 'up',
    subjects: {
      math: { points: 320, badge: 'Algebra Explorer', trend: 'same' },
      science: { points: 420, badge: 'Biology Whiz', trend: 'up' },
      arts: { points: 460, badge: 'Published Novelist', trend: 'up' },
      tech: { points: 310, badge: 'Python Developer', trend: 'up' },
      humanities: { points: 430, badge: 'European History Ace', trend: 'up' },
      math301: { points: 320, badge: 'Trigonometry Scholar', trend: 'same' },
      hist202: { points: 430, badge: 'Historical Analysis MVP', trend: 'up' },
      phys401: { points: 420, badge: 'Astronomy Fellow', trend: 'up' },
      eng101: { points: 460, badge: 'Literary Journal Lead', trend: 'up' },
      cs501: { points: 310, badge: 'Data Structures Apprentice', trend: 'up' },
      bio201: { points: 420, badge: 'Microbiology Whiz', trend: 'up' }
    }
  },
  {
    id: 6,
    name: 'Felix Cat',
    avatar: 'Felix',
    classId: '10a',
    className: 'Class 10A (Sophomores)',
    grade: '10',
    overallPoints: 940,
    overallBadge: 'Art & Design Excellence',
    trend: 'same',
    subjects: {
      math: { points: 300, badge: 'Math Enthusiast', trend: 'same' },
      science: { points: 310, badge: 'Ecology Researcher', trend: 'down' },
      arts: { points: 495, badge: 'Master Painter & Sculptor', trend: 'up' },
      tech: { points: 370, badge: '3D Modeler & Animator', trend: 'up' },
      humanities: { points: 350, badge: 'Art Historian', trend: 'same' },
      math301: { points: 300, badge: 'Applied Geometry', trend: 'same' },
      hist202: { points: 350, badge: 'Renaissance Art History', trend: 'same' },
      phys401: { points: 310, badge: 'Optics & Light Colorist', trend: 'down' },
      eng101: { points: 495, badge: 'Graphic Novel Author', trend: 'up' },
      cs501: { points: 370, badge: 'Shader & Blender Artist', trend: 'up' },
      bio201: { points: 310, badge: 'Botanical Illustrator', trend: 'down' }
    }
  },
  {
    id: 7,
    name: 'Max Power',
    avatar: 'Max',
    classId: '11b',
    className: 'Class 11B (Juniors)',
    grade: '11',
    overallPoints: 910,
    overallBadge: 'Robotics MVP',
    trend: 'up',
    subjects: {
      math: { points: 460, badge: 'Algebra Ace', trend: 'up' },
      science: { points: 380, badge: 'Circuit Master', trend: 'up' },
      arts: { points: 280, badge: 'Audio Producer', trend: 'same' },
      tech: { points: 495, badge: 'Hardware Hacker Champion', trend: 'up' },
      humanities: { points: 310, badge: 'Ethics in Tech Scholar', trend: 'same' },
      math301: { points: 460, badge: 'Discrete Math Ace', trend: 'up' },
      hist202: { points: 310, badge: 'Industrial History', trend: 'same' },
      phys401: { points: 380, badge: 'Electronics Project Head', trend: 'up' },
      eng101: { points: 280, badge: 'Technical Writer', trend: 'same' },
      cs501: { points: 495, badge: 'Competitive Coding Gold', trend: 'up' },
      bio201: { points: 340, badge: 'Bioengineering Apprentice', trend: 'up' }
    }
  },
  {
    id: 8,
    name: 'Chloe Bennett',
    avatar: 'Chloe',
    classId: '12a',
    className: 'Class 12A (Seniors)',
    grade: '12',
    overallPoints: 880,
    overallBadge: 'History Scholar',
    trend: 'down',
    subjects: {
      math: { points: 290, badge: 'Math Applied', trend: 'down' },
      science: { points: 320, badge: 'Environmental Fellow', trend: 'same' },
      arts: { points: 420, badge: 'Digital Sculptor', trend: 'same' },
      tech: { points: 300, badge: 'UI Designer', trend: 'same' },
      humanities: { points: 475, badge: 'Historical Archive Lead', trend: 'up' },
      math301: { points: 290, badge: 'Financial Math', trend: 'down' },
      hist202: { points: 475, badge: 'Primary Source Researcher', trend: 'up' },
      phys401: { points: 320, badge: 'Climate Physics', trend: 'same' },
      eng101: { points: 420, badge: 'Classical Poetry', trend: 'same' },
      cs501: { points: 300, badge: 'Web Accessibility Lead', trend: 'same' },
      bio201: { points: 320, badge: 'Marine Biology Fellow', trend: 'same' }
    }
  },
  {
    id: 9,
    name: 'Aria Montgomery',
    avatar: 'Aria',
    classId: '10a',
    className: 'Class 10A (Sophomores)',
    grade: '10',
    overallPoints: 1240,
    overallBadge: 'Honors Scholar',
    trend: 'up',
    subjects: {
      math: { points: 410, badge: 'Honors Algebra Ace', trend: 'up' },
      science: { points: 430, badge: 'Chemistry Distinction', trend: 'up' },
      arts: { points: 390, badge: 'Creative Writing Honor', trend: 'up' },
      tech: { points: 410, badge: 'Code & Logic Merit', trend: 'up' },
      humanities: { points: 400, badge: 'History Essayist', trend: 'up' },
      math301: { points: 410, badge: 'Math 301 Active', trend: 'up' },
      hist202: { points: 400, badge: 'Hist 202 Honors', trend: 'up' },
      phys401: { points: 430, badge: 'Physics Lab Active', trend: 'up' },
      eng101: { points: 390, badge: 'Literature Honor', trend: 'up' },
      cs501: { points: 410, badge: 'CS Algorithms Lead', trend: 'up' },
      bio201: { points: 420, badge: 'Biology Research Merit', trend: 'up' }
    }
  }
];

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

  const filteredRankings = useMemo(() => {
    // 1. Overall filter
    if (activeFilter === 'overall') {
      return STUDENTS_DATABASE.map(student => ({
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

    // 2. Class cohorts (10a, 11b, 12a)
    if (['10a', '11b', '12a'].includes(activeFilter)) {
      return STUDENTS_DATABASE
        .filter(student => student.classId === activeFilter)
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

    // 3. Specific class or subject
    return STUDENTS_DATABASE
      .map(student => {
        const subjectData = student.subjects[activeFilter] || { points: 0, badge: '', trend: 'same' };
        return {
          id: student.id,
          name: student.name,
          className: student.className,
          grade: student.grade,
          points: subjectData.points,
          badge: subjectData.badge,
          trend: subjectData.trend
        };
      })
      .sort((a, b) => b.points - a.points)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));
  }, [activeFilter]);

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
              Academic Leaderboard
              <Trophy size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">Season 2026</span>
          </div>
          <p>Celebrating high academic achievements, subject mastery, and class excellence.</p>
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
              <span className="trigger-label-muted">Filter:</span>
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

      {/* Top 3 Podium */}
      <section className="podium-section">
        {top2 && <PodiumStep student={top2} rank={2} height={200} color="hsl(var(--accent))" delay={0.15} onSelect={handleStudentClick} />}
        {top1 && <PodiumStep student={top1} rank={1} height={260} color="hsl(var(--mood-neutral))" delay={0.3} onSelect={handleStudentClick} />}
        {top3 && <PodiumStep student={top3} rank={3} height={160} color="hsl(var(--mood-sad))" delay={0.05} onSelect={handleStudentClick} />}
      </section>

      {/* Rankings List */}
      <section className="rankings-list glass">
        <div className="list-header">
          <span>Rank</span>
          <span>Student & Distinction</span>
          <span>Class</span>
          <span>Trend</span>
          <span>Points</span>
        </div>
        <div className="list-body">
          <AnimatePresence mode="wait">
            {rest.length === 0 && filteredRankings.length <= 3 ? (
              <div className="empty-rankings-note">
                <span>All top enrolled students are featured on the podium above! Click any student to view their profile. 🌟</span>
              </div>
            ) : (
              rest.map((student, index) => {
                const isCurrentUser = isStudent && student.name === 'Aria Montgomery';
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
                    title={isCurrentUser ? 'Your Ranking Profile' : (isStudent ? `${student.name}'s Academic Standing` : `View ${student.name}'s Profile`)}
                  >
                    <div className="rank-col">#{student.rank}</div>
                    <div className="student-col">
                      <div className="avatar-small">
                        <Avatar alt={student.name} />
                      </div>
                      <div className="student-info-col">
                        <div className="student-name-row">
                          <span className="student-name">{student.name}</span>
                          {isCurrentUser && <span className="you-pill-badge">You</span>}
                          {!isStudent && <ArrowUpRight size={13} className="student-view-icon" />}
                        </div>
                        {student.badge && <span className="student-badge-pill">{student.badge}</span>}
                      </div>
                    </div>
                  <div className="class-col muted">
                    {student.className.split(' ')[0]} {student.className.split(' ')[1]}
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
    </motion.div>
  );
};

export default Leaderboard;
