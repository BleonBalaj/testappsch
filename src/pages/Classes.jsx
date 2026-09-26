import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Book, CheckSquare, Users, Plus, Search, Filter, 
  Download, Sparkles, BookOpen, Layers, X, Check,
  GraduationCap, Clock, MapPin
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import './Classes.css';

export const INITIAL_CLASSES = [
  { 
    id: 1, 
    name: 'Advanced Mathematics', 
    code: 'MATH-301', 
    department: 'Mathematics', 
    color: '--primary', 
    teacher: 'Dr. Sarah Smith', 
    students: 24, 
    progress: 75, 
    room: 'Room 302', 
    schedule: 'Mon, Wed 08:30 AM',
    enrolled: true,
    myGrade: '96%',
    letterGrade: 'A',
    credits: 4,
    period: 'Period 1'
  },
  { 
    id: 2, 
    name: 'World History', 
    code: 'HIST-202', 
    department: 'Humanities', 
    color: '--chart-2', 
    teacher: 'Mr. David Clark', 
    students: 30, 
    progress: 40, 
    room: 'Room 105', 
    schedule: 'Tue, Thu 10:15 AM',
    enrolled: true,
    myGrade: '92%',
    letterGrade: 'A-',
    credits: 4,
    period: 'Period 4'
  },
  { 
    id: 3, 
    name: 'Physics Mechanics', 
    code: 'PHYS-401', 
    department: 'Science', 
    color: '--chart-1', 
    teacher: 'Prof. James Wilson', 
    students: 18, 
    progress: 60, 
    room: 'Physics Lab 2', 
    schedule: 'Mon, Fri 01:00 PM',
    enrolled: true,
    taughtByMe: true,
    myGrade: '95%',
    letterGrade: 'A',
    credits: 4,
    period: 'Period 2'
  },
  { 
    id: 4, 
    name: 'English Literature', 
    code: 'ENG-101', 
    department: 'Humanities', 
    color: '--chart-4', 
    teacher: 'Ms. Emily Brown', 
    students: 28, 
    progress: 90, 
    room: 'Room 204', 
    schedule: 'Wed, Fri 11:00 AM',
    enrolled: true,
    myGrade: '94%',
    letterGrade: 'A',
    credits: 4,
    period: 'Period 3'
  },
  { 
    id: 5, 
    name: 'Computer Science', 
    code: 'CS-501', 
    department: 'Technology', 
    color: '--chart-5', 
    teacher: 'Mr. Alan Turing', 
    students: 22, 
    progress: 85, 
    room: 'Computer Lab A', 
    schedule: 'Tue, Thu 02:30 PM',
    enrolled: false,
    credits: 4,
    period: 'Elective'
  },
  { 
    id: 6, 
    name: 'Biology Labs', 
    code: 'BIO-201', 
    department: 'Science', 
    color: '--accent', 
    teacher: 'Dr. Jane Goodall', 
    students: 15, 
    progress: 50, 
    room: 'Bio Lab 1', 
    schedule: 'Mon, Thu 09:45 AM',
    enrolled: false,
    taughtByMe: true,
    credits: 4,
    period: 'Elective'
  },
];

const SWATCH_OPTIONS = [
  { label: 'Magenta', value: '--primary' },
  { label: 'Rose', value: '--accent' },
  { label: 'Cyan', value: '--chart-1' },
  { label: 'Emerald', value: '--chart-2' },
  { label: 'Amber', value: '--chart-4' },
  { label: 'Violet', value: '--chart-5' },
];

const ClassCard = ({ classInfo, onClick, userRole = 'student' }) => {
  return (
    <motion.div 
      className="class-card glass bouncy"
      onClick={() => onClick(classInfo)}
      layout
      whileHover={{ y: -5, scale: 1.02 }}
      style={{ borderTop: `4px solid hsl(var(${classInfo.color}))` }}
    >
      <div className="class-card-header">
        <div className="class-icon" style={{ backgroundColor: `hsla(var(${classInfo.color}), 0.2)`, color: `hsl(var(${classInfo.color}))` }}>
          <Book size={24} />
        </div>
        <div className="class-title">
          <div className="class-title-top">
            <h3>{classInfo.name}</h3>
            {userRole === 'student' && (
              classInfo.enrolled ? (
                <span className="class-enroll-badge enrolled" title="You are enrolled in this class">
                  <Check size={11} /> Enrolled
                </span>
              ) : (
                <span className="class-enroll-badge elective" title="Elective course available in curriculum">
                  Open Elective
                </span>
              )
            )}
            {userRole === 'teacher' && classInfo.taughtByMe && (
              <span className="class-enroll-badge instructor" title="You are the lead instructor for this course">
                My Class
              </span>
            )}
          </div>
          <p>{classInfo.code} • {classInfo.teacher}</p>
        </div>
      </div>

      <div className="class-meta-row">
        <span className="class-room-badge">
          <MapPin size={12} /> {classInfo.room || 'Main Hall'}
        </span>
        <span className="class-schedule-badge">
          <Clock size={12} /> {classInfo.schedule || 'Regular'}
        </span>
        {classInfo.period && (
          <span className="class-period-badge glass">
            {classInfo.period}
          </span>
        )}
      </div>

      {userRole === 'student' && classInfo.enrolled && classInfo.myGrade && (
        <div className="student-card-standing glass">
          <span className="sc-label">Standing:</span>
          <span className="sc-val">{classInfo.myGrade} ({classInfo.letterGrade})</span>
          <span className="sc-credit">• {classInfo.credits || 4} Credits</span>
        </div>
      )}

      <div className="class-card-stats">
        <div className="stat">
          <CheckSquare size={16} />
          <span>{classInfo.progress}% Complete</span>
        </div>
        <div className="stat">
          <Users size={16} />
          <span>{classInfo.students} Students</span>
        </div>
      </div>
    </motion.div>
  );
};

const Classes = ({ onClassSelect, userRole = 'student' }) => {
  const { staffList } = useSchoolData();
  const [classesList, setClassesList] = useState(INITIAL_CLASSES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Default tab for student and teacher is 'my-classes', for admin is 'all-classes'
  const [activeTab, setActiveTab] = useState(() => (userRole === 'admin' ? 'all-classes' : 'my-classes'));
  const [prevRole, setPrevRole] = useState(userRole);

  if (prevRole !== userRole) {
    setPrevRole(userRole);
    setActiveTab(userRole === 'admin' ? 'all-classes' : 'my-classes');
  }

  // Superadmins never have a personal "My Classes" view; strictly lock to full curriculum catalog
  const effectiveTab = userRole === 'admin' ? 'all-classes' : activeTab;

  // New Class Form State
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassDept, setNewClassDept] = useState('Science');
  const [newClassTeacher, setNewClassTeacher] = useState(staffList[0]?.name || 'Dr. Sarah Smith');
  const [newClassRoom, setNewClassRoom] = useState('Room 301');
  const [newClassSchedule, setNewClassSchedule] = useState('Mon, Wed 10:00 AM');
  const [newClassColor, setNewClassColor] = useState('--primary');

  const departments = ['All', 'Science', 'Mathematics', 'Humanities', 'Technology'];

  // Calculate my classes count based on role
  const myClassesCount = useMemo(() => {
    if (userRole === 'teacher') {
      return classesList.filter(c => c.taughtByMe).length;
    }
    // Default to student enrollment
    return classesList.filter(c => c.enrolled).length;
  }, [classesList, userRole]);

  // Classes filtered by tab first
  const tabFilteredClasses = useMemo(() => {
    if (effectiveTab === 'my-classes') {
      if (userRole === 'teacher') {
        return classesList.filter(c => c.taughtByMe);
      }
      return classesList.filter(c => c.enrolled);
    }
    return classesList;
  }, [classesList, effectiveTab, userRole]);

  // Classes filtered by search & department
  const filteredClasses = useMemo(() => {
    return tabFilteredClasses.filter(c => {
      const matchesDept = selectedDept === 'All' || c.department === selectedDept;
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.teacher.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDept && matchesSearch;
    });
  }, [tabFilteredClasses, selectedDept, searchQuery]);

  const handleCreateClass = (e) => {
    e.preventDefault();
    if (!newClassName.trim() || !newClassCode.trim()) return;

    const newClass = {
      id: Date.now(),
      name: newClassName.trim(),
      code: newClassCode.trim().toUpperCase(),
      department: newClassDept,
      teacher: newClassTeacher,
      room: newClassRoom.trim(),
      schedule: newClassSchedule.trim(),
      color: newClassColor,
      students: 20,
      progress: 0,
      enrolled: false,
      taughtByMe: userRole === 'teacher'
    };

    setClassesList(prev => [newClass, ...prev]);
    setIsAddModalOpen(false);
    setNewClassName('');
    setNewClassCode('');
  };

  const handleExportClasses = () => {
    const listToExport = effectiveTab === 'my-classes' ? tabFilteredClasses : classesList;
    const headers = 'ID,Course Name,Code,Department,Teacher,Room,Schedule,Students,Progress,Status\n';
    const rows = listToExport.map(c => 
      `"${c.id}","${c.name}","${c.code}","${c.department}","${c.teacher}","${c.room}","${c.schedule}",${c.students},${c.progress}%,"${c.enrolled ? 'Enrolled' : 'Open'}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NoesisHorizon_${userRole === 'admin' ? 'CurriculumCatalog' : (effectiveTab === 'my-classes' ? 'MyClasses' : 'AllCourses')}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="classes-page">
      <header className="page-header">
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              {userRole === 'student' ? 'Courses & Learning' : 'Courses & Classes'}
              <Book size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">
              {userRole === 'admin' 
                ? `${filteredClasses.length} Courses Catalog` 
                : (effectiveTab === 'my-classes' ? `${filteredClasses.length} My Classes` : `${classesList.length} Total`)}
            </span>
          </div>
          <p>
            {userRole === 'student' 
              ? 'View your enrolled subjects, course grades, syllabus materials, and class assignments.'
              : userRole === 'teacher'
              ? 'Manage your assigned teaching classes, rosters, curriculum materials, and student submissions.'
              : 'School-wide curriculum management, course creation, instructor assignments, and catalog governance.'}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary glass" onClick={handleExportClasses}>
            <Download size={16} />
            {userRole === 'student' ? 'Export Schedule' : 'Export CSV'}
          </button>
          {userRole !== 'student' && (
            <button type="button" className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={18} />
              Add Course
            </button>
          )}
        </div>
      </header>

      {/* Role-Based Tabs (My Classes vs All Classes) - ONLY for Students and Teachers */}
      {userRole !== 'admin' && (
        <div className="classes-nav-tabs-bar glass">
          <div className="classes-nav-tabs">
            <button
              type="button"
              className={`classes-nav-tab ${effectiveTab === 'my-classes' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-classes')}
            >
              <BookOpen size={16} />
              <span>{userRole === 'teacher' ? 'My Teaching Classes' : 'My Classes'}</span>
              <span className="tab-pill-counter">{myClassesCount}</span>
            </button>
            <button
              type="button"
              className={`classes-nav-tab ${effectiveTab === 'all-classes' ? 'active' : ''}`}
              onClick={() => setActiveTab('all-classes')}
            >
              <Layers size={16} />
              <span>All Classes</span>
              <span className="tab-pill-counter">{classesList.length}</span>
            </button>
          </div>

          {/* Info hint */}
          <div className="classes-tabs-hint">
            {effectiveTab === 'my-classes' ? (
              <span>
                Showing {userRole === 'student' ? 'courses you are enrolled in' : 'classes you teach'}
              </span>
            ) : (
              <span>Browsing full school curriculum catalog</span>
            )}
          </div>
        </div>
      )}

      {/* Student Banner when in My Classes */}
      {userRole === 'student' && effectiveTab === 'my-classes' && (
        <div className="student-classes-summary-strip glass">
          <div className="strip-info">
            <div className="strip-avatar-badge">
              <GraduationCap size={22} />
            </div>
            <div>
              <h4>Aria Montgomery's Enrolled Schedule</h4>
              <p>Grade 10 Honors • 4 Active Subjects • 16 Weekly Credit Hours</p>
            </div>
          </div>
          <div className="strip-stats">
            <div className="strip-stat-item">
              <span className="strip-stat-label">Term GPA / Avg</span>
              <strong className="strip-stat-val text-primary">94.3% (A)</strong>
            </div>
            <div className="strip-stat-item">
              <span className="strip-stat-label">Enrolled Status</span>
              <strong className="strip-stat-val text-success">Good Standing</strong>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="classes-controls-bar">
        <div className="classes-search-box">
          <Search size={17} className="search-icon" />
          <input 
            type="text" 
            placeholder={effectiveTab === 'my-classes' ? "Search within my classes..." : "Search all classes by title, code, teacher..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="clear-btn" onClick={() => setSearchQuery('')}>
              <X size={15} />
            </button>
          )}
        </div>

        <div className="classes-filter-pills">
          {departments.map(dept => (
            <button
              key={dept}
              type="button"
              className={`dept-pill ${selectedDept === dept ? 'active' : ''}`}
              onClick={() => setSelectedDept(dept)}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Classes Grid */}
      <div className="classes-grid">
        <AnimatePresence mode="popLayout">
          {filteredClasses.length > 0 ? (
            filteredClasses.map((classItem) => (
              <ClassCard 
                key={classItem.id} 
                classInfo={classItem} 
                onClick={onClassSelect} 
                userRole={userRole}
              />
            ))
          ) : (
            <motion.div 
              className="empty-classes-card glass"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="empty-icon-wrap">
                <BookOpen size={40} className="muted" />
              </div>
              <h3>No courses found</h3>
              <p>
                {effectiveTab === 'my-classes'
                  ? 'No classes match your search in your enrolled list. Try switching to "All Classes" to browse other subjects.'
                  : 'No classes match your current search criteria or department filter.'}
              </p>
              {effectiveTab === 'my-classes' ? (
                <button type="button" className="btn-secondary glass btn-sm" onClick={() => setActiveTab('all-classes')}>
                  Browse All Classes
                </button>
              ) : (
                <button type="button" className="btn-secondary glass btn-sm" onClick={() => { setSearchQuery(''); setSelectedDept('All'); }}>
                  Clear Filters
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── MODAL: Add New Course ── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Add New Course</h3>
                <p className="modal-subtitle">Create a curriculum subject and assign a lead instructor.</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddModalOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateClass} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Course Title</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Organic Chemistry II"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Course Code</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. CHEM-302"
                      value={newClassCode}
                      onChange={(e) => setNewClassCode(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Department</label>
                    <select 
                      value={newClassDept}
                      onChange={(e) => setNewClassDept(e.target.value)}
                      className="custom-form-select"
                    >
                      <option value="Science">Science & Labs</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Humanities">Humanities & Languages</option>
                      <option value="Technology">Technology & Computer Science</option>
                      <option value="Arts">Fine Arts & Music</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Lead Instructor</label>
                    <select 
                      value={newClassTeacher}
                      onChange={(e) => setNewClassTeacher(e.target.value)}
                      className="custom-form-select"
                    >
                      {staffList.map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.department || s.roleName || 'Faculty'})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Assigned Room</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Chemistry Lab 3"
                      value={newClassRoom}
                      onChange={(e) => setNewClassRoom(e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Schedule & Time</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Tue, Thu 09:30 AM"
                      value={newClassSchedule}
                      onChange={(e) => setNewClassSchedule(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Card Color Accent</label>
                  <div className="swatch-picker-row">
                    {SWATCH_OPTIONS.map(swatch => (
                      <button
                        key={swatch.value}
                        type="button"
                        className={`swatch-btn ${newClassColor === swatch.value ? 'selected' : ''}`}
                        style={{ backgroundColor: `hsl(var(${swatch.value}))` }}
                        onClick={() => setNewClassColor(swatch.value)}
                        title={swatch.label}
                      >
                        {newClassColor === swatch.value && <Check size={14} color="#fff" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={!newClassName.trim() || !newClassCode.trim()}>
                    Create Course
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

export default Classes;
