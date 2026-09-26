import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, 
  Download, 
  Printer, 
  Search, 
  Award, 
  Calendar, 
  CheckCircle2, 
  BookOpen, 
  FileText, 
  Sparkles, 
  Building2, 
  ShieldCheck, 
  ArrowUpRight, 
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import './Transcript.css';

// Complete Official Student Profile
const STUDENT_PROFILE = {
  name: 'Aria Montgomery',
  studentId: 'STU-1008',
  stateId: 'SASID-9482019',
  dateOfBirth: '2010-04-14',
  grade: 'Grade 10 (Sophomore)',
  homeroom: 'Room 105 • Class 10A',
  admitDate: 'September 3, 2024',
  expectedGraduation: 'June 2028',
  counselor: 'Ms. Emily Brown (Student Affairs)',
  program: 'College Preparatory Honors Scholar Track',
  academicStanding: 'Dean\'s Honors List with High Distinction',
  cumulativeGpa: 3.92,
  weightedGpa: 4.15,
  classRank: '4 of 128 (Top 3%)',
  totalCreditsEarned: 44.0,
  totalCreditsRequired: 48.0,
  inProgressCredits: 4.0,
  verificationCode: 'LUMI-TR-2026-9081-AM',
  issuedDate: 'September 19, 2026'
};

// Historical Course Records Organized by Academic Terms
const TRANSCRIPT_TERMS = [
  {
    id: 'term-g10-fall-2026',
    termName: 'Grade 10 – Fall Semester 2026',
    academicYear: '2026–2027',
    termStatus: 'In Progress (Midterm Certified)',
    termGpa: 3.89,
    termCredits: 17.0,
    termHonor: 'High Honors Roll',
    courses: [
      {
        code: 'MATH-301',
        title: 'Advanced Mathematics (Calculus & Functions)',
        department: 'Mathematics',
        type: 'Honors',
        instructor: 'Dr. Sarah Smith',
        credits: 4.0,
        gradePercentage: 95,
        letterGrade: 'A',
        gpaPoints: 4.0,
        dateAwarded: 'Sep 18, 2026',
        status: 'Midterm Graded',
        remarks: 'Exemplary differential calculus synthesis and proof structure.'
      },
      {
        code: 'PHYS-401',
        title: 'Physics Mechanics & Dynamics Lab',
        department: 'Science',
        type: 'AP / Advanced',
        instructor: 'Prof. James Wilson',
        credits: 4.0,
        gradePercentage: 91,
        letterGrade: 'A-',
        gpaPoints: 3.7,
        dateAwarded: 'Sep 16, 2026',
        status: 'Midterm Graded',
        remarks: 'Superior kinematic experimentation and lab report precision.'
      },
      {
        code: 'HIST-202',
        title: 'World History Seminar: Modern Civilizations',
        department: 'Humanities',
        type: 'Honors',
        instructor: 'Mr. David Clark',
        credits: 3.0,
        gradePercentage: 92,
        letterGrade: 'A-',
        gpaPoints: 3.7,
        dateAwarded: 'Sep 15, 2026',
        status: 'Midterm Graded',
        remarks: 'Insightful historiographical comparative analysis of Enlightenment essays.'
      },
      {
        code: 'ENG-101',
        title: 'English Literature Analysis & Rhetoric',
        department: 'Language Arts',
        type: 'Core',
        instructor: 'Ms. Emily Brown',
        credits: 3.0,
        gradePercentage: 97,
        letterGrade: 'A+',
        gpaPoints: 4.0,
        dateAwarded: 'Sep 14, 2026',
        status: 'Midterm Graded',
        remarks: 'Exceptional textual evidence and eloquent rhetorical synthesis.'
      },
      {
        code: 'CS-501',
        title: 'Computer Science & Algorithmic Logic',
        department: 'Technology',
        type: 'Honors',
        instructor: 'Mr. Alex Vance',
        credits: 3.0,
        gradePercentage: 98,
        letterGrade: 'A+',
        gpaPoints: 4.0,
        dateAwarded: 'Sep 12, 2026',
        status: 'Midterm Graded',
        remarks: 'Flawless graph algorithm traversal and clean modular architecture.'
      }
    ]
  },
  {
    id: 'term-g9-spring-2026',
    termName: 'Grade 9 – Spring Semester 2026',
    academicYear: '2025–2026',
    termStatus: 'Completed & Certified',
    termGpa: 3.94,
    termCredits: 16.0,
    termHonor: 'Dean\'s Academic List',
    courses: [
      {
        code: 'MATH-201',
        title: 'Honors Euclidean Geometry & Trigonometry',
        department: 'Mathematics',
        type: 'Honors',
        instructor: 'Dr. Sarah Smith',
        credits: 4.0,
        gradePercentage: 96,
        letterGrade: 'A',
        gpaPoints: 4.0,
        dateAwarded: 'Jun 10, 2026',
        status: 'Final Certified',
        remarks: 'Mastered deductive geometric proof reasoning and spherical projection.'
      },
      {
        code: 'CHEM-101',
        title: 'Introductory Chemistry & Quantitative Lab',
        department: 'Science',
        type: 'Core Lab',
        instructor: 'Dr. Aris Thorne',
        credits: 4.0,
        gradePercentage: 92,
        letterGrade: 'A-',
        gpaPoints: 3.7,
        dateAwarded: 'Jun 08, 2026',
        status: 'Final Certified',
        remarks: 'Precise titration lab methodology and thermodynamic calculations.'
      },
      {
        code: 'GEO-101',
        title: 'World Geography & Cultural Anthropology',
        department: 'Humanities',
        type: 'Core',
        instructor: 'Mr. David Clark',
        credits: 3.0,
        gradePercentage: 94,
        letterGrade: 'A',
        gpaPoints: 4.0,
        dateAwarded: 'Jun 06, 2026',
        status: 'Final Certified',
        remarks: 'Delivered top-ranked capstone presentation on urban sustainability.'
      },
      {
        code: 'ENG-092',
        title: 'Composition & Critical Literary Reading',
        department: 'Language Arts',
        type: 'Core',
        instructor: 'Ms. Emily Brown',
        credits: 3.0,
        gradePercentage: 95,
        letterGrade: 'A',
        gpaPoints: 4.0,
        dateAwarded: 'Jun 05, 2026',
        status: 'Final Certified',
        remarks: 'Consistently articulate argumentative essays and thesis defense.'
      },
      {
        code: 'ART-110',
        title: 'Digital Media, Typography & Visual Arts',
        department: 'Fine Arts',
        type: 'Elective',
        instructor: 'Ms. Clara Oswald',
        credits: 2.0,
        gradePercentage: 98,
        letterGrade: 'A+',
        gpaPoints: 4.0,
        dateAwarded: 'Jun 04, 2026',
        status: 'Final Certified',
        remarks: 'Curated student visual portfolio showcased in regional exhibition.'
      }
    ]
  },
  {
    id: 'term-g9-fall-2025',
    termName: 'Grade 9 – Fall Semester 2025',
    academicYear: '2025–2026',
    termStatus: 'Completed & Certified',
    termGpa: 3.88,
    termCredits: 15.0,
    termHonor: 'Academic Honor Roll',
    courses: [
      {
        code: 'MATH-101',
        title: 'Honors Algebra II & Polynomial Systems',
        department: 'Mathematics',
        type: 'Honors',
        instructor: 'Dr. Sarah Smith',
        credits: 4.0,
        gradePercentage: 94,
        letterGrade: 'A',
        gpaPoints: 4.0,
        dateAwarded: 'Jan 15, 2026',
        status: 'Final Certified',
        remarks: 'Comprehensive understanding of complex numbers and matrices.'
      },
      {
        code: 'SCI-091',
        title: 'Integrated Physical Sciences & Inquiry',
        department: 'Science',
        type: 'Core',
        instructor: 'Prof. James Wilson',
        credits: 4.0,
        gradePercentage: 90,
        letterGrade: 'A-',
        gpaPoints: 3.7,
        dateAwarded: 'Jan 14, 2026',
        status: 'Final Certified',
        remarks: 'Active lab investigator with keen attention to error margins.'
      },
      {
        code: 'HIST-101',
        title: 'Classical Civilizations & Governance',
        department: 'Humanities',
        type: 'Core',
        instructor: 'Mr. David Clark',
        credits: 3.0,
        gradePercentage: 91,
        letterGrade: 'A-',
        gpaPoints: 3.7,
        dateAwarded: 'Jan 12, 2026',
        status: 'Final Certified',
        remarks: 'Strong debate performance in Hellenistic constitutional simulations.'
      },
      {
        code: 'ENG-091',
        title: 'Literary Foundations, Grammar & Rhetoric',
        department: 'Language Arts',
        type: 'Core',
        instructor: 'Ms. Emily Brown',
        credits: 3.0,
        gradePercentage: 93,
        letterGrade: 'A',
        gpaPoints: 4.0,
        dateAwarded: 'Jan 10, 2026',
        status: 'Final Certified',
        remarks: 'Rigorous grammatical clarity and strong prose voice.'
      },
      {
        code: 'PE-101',
        title: 'Physical Education & Lifelong Fitness',
        department: 'Physical Education',
        type: 'Core',
        instructor: 'Coach Mike Tyson',
        credits: 1.0,
        gradePercentage: 100,
        letterGrade: 'A+',
        gpaPoints: 4.0,
        dateAwarded: 'Jan 08, 2026',
        status: 'Final Certified',
        remarks: 'Exemplary leadership, teamwork, and athletic benchmark achievements.'
      }
    ]
  }
];

const GRADING_SCALE = [
  { grade: 'A+', range: '97 – 100%', points: '4.0', desc: 'Distinguished Mastery' },
  { grade: 'A', range: '93 – 96%', points: '4.0', desc: 'Superior Achievement' },
  { grade: 'A-', range: '90 – 92%', points: '3.7', desc: 'Excellent Understanding' },
  { grade: 'B+', range: '87 – 89%', points: '3.3', desc: 'Above Average' },
  { grade: 'B', range: '83 – 86%', points: '3.0', desc: 'Proficient' },
  { grade: 'B-', range: '80 – 82%', points: '2.7', desc: 'Satisfactory' },
  { grade: 'C+', range: '77 – 79%', points: '2.3', desc: 'Marginal' },
  { grade: 'C/D', range: '60 – 76%', points: '1.0 – 2.0', desc: 'Minimum Credit' },
];

const Transcript = ({ userRole = 'student' }) => {
  const [selectedTermFilter, setSelectedTermFilter] = useState('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('terms'); // 'terms' or 'tabular'
  const [copiedHash, setCopiedHash] = useState(false);
  const [exportNotice, setExportNotice] = useState(false);

  // Departments for filtering
  const departments = useMemo(() => {
    const set = new Set();
    TRANSCRIPT_TERMS.forEach(term => {
      term.courses.forEach(c => set.add(c.department));
    });
    return ['all', ...Array.from(set)];
  }, []);

  // Filtered terms and courses
  const filteredTerms = useMemo(() => {
    return TRANSCRIPT_TERMS.map(term => {
      if (selectedTermFilter !== 'all' && term.id !== selectedTermFilter) {
        return null;
      }
      const filteredCourses = term.courses.filter(course => {
        const matchesDept = selectedDeptFilter === 'all' || course.department === selectedDeptFilter;
        const query = searchTerm.toLowerCase().trim();
        const matchesSearch = query === '' || 
          course.title.toLowerCase().includes(query) ||
          course.code.toLowerCase().includes(query) ||
          course.instructor.toLowerCase().includes(query) ||
          course.letterGrade.toLowerCase().includes(query);
        return matchesDept && matchesSearch;
      });

      return {
        ...term,
        courses: filteredCourses
      };
    }).filter(term => term !== null && term.courses.length > 0);
  }, [selectedTermFilter, selectedDeptFilter, searchTerm]);

  // All matching courses flattened for tabular view
  const allFilteredCourses = useMemo(() => {
    const list = [];
    filteredTerms.forEach(term => {
      term.courses.forEach(c => {
        list.push({ ...c, termName: term.termName });
      });
    });
    return list;
  }, [filteredTerms]);

  // Handle PDF Export / Print
  const handlePrintPDF = () => {
    setExportNotice(true);
    setTimeout(() => {
      window.print();
    }, 300);
    setTimeout(() => {
      setExportNotice(false);
    }, 4000);
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(STUDENT_PROFILE.verificationCode);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2500);
  };

  // If viewed by non-student, render guarded banner
  if (userRole !== 'student') {
    return (
      <div className="transcript-page student-only-notice glass">
        <GraduationCap size={48} className="text-primary" />
        <h2>Student Transcript Portal</h2>
        <p>The historical grade transcript portal is configured exclusively for enrolled students to inspect verified course credentials.</p>
      </div>
    );
  }

  return (
    <div className="transcript-page">
      {/* ── Screen Controls & Action Bar ── */}
      <header className="page-header no-print">
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              Academic Transcript
              <GraduationCap size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">Official Student Record</span>
          </div>
          <p>
            Certified historical record of completed terms, awarded course grades, cumulative credit hours, and academic honors.
          </p>
        </div>

        <div className="header-actions">
          <button 
            type="button" 
            className="btn-secondary glass" 
            onClick={handleCopyHash}
            title="Copy Verification Hash"
          >
            {copiedHash ? <Check size={16} className="text-success" /> : <Copy size={16} />}
            {copiedHash ? 'Code Copied!' : 'Verification Code'}
          </button>
          
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handlePrintPDF}
            title="Export official PDF format"
          >
            <Printer size={17} />
            Export as PDF
          </button>
        </div>
      </header>

      {/* Export feedback message */}
      <AnimatePresence>
        {exportNotice && (
          <motion.div 
            className="export-toast-banner no-print glass"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Sparkles size={18} className="toast-sparkle" />
            <span>Opening native print dialog. Select <strong>"Save as PDF"</strong> in your destination menu for an official accredited digital PDF.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Official Institutional Document Container: Card 1 (Student Credentials & Summary) ── */}
      <div className="official-transcript-sheet glass transcript-info-card" id="printable-transcript-header">
        
        {/* Document Header with School Seal & Verification */}
        <div className="transcript-doc-header">
          <div className="school-brand-block">
            <div className="school-crest-badge">
              <Building2 size={36} />
            </div>
            <div className="school-text-meta">
              <h2 className="school-name">Noesis Horizon</h2>
              <div className="school-sub">Accredited Secondary & Preparatory Institution • CEEB Code: 052-890</div>
              <div className="school-address">100 Academic Way, Cambridge, MA 02138 • registrar@lumischool.edu</div>
            </div>
          </div>

          <div className="official-seal-block">
            <div className="seal-emblem">
              <ShieldCheck size={28} />
              <span>OFFICIAL ACADEMIC TRANSCRIPT</span>
            </div>
            <div className="verification-code-tag">
              ID: <strong>{STUDENT_PROFILE.verificationCode}</strong>
            </div>
          </div>
        </div>

        <div className="divider-line"></div>

        {/* Student Identification & Academic Metrics Ledger */}
        <div className="student-credentials-grid">
          <div className="cred-field">
            <span className="cred-label">Student Name:</span>
            <span className="cred-val highlight">{STUDENT_PROFILE.name}</span>
          </div>
          <div className="cred-field">
            <span className="cred-label">Student ID:</span>
            <span className="cred-val">{STUDENT_PROFILE.studentId}</span>
          </div>
          <div className="cred-field">
            <span className="cred-label">Current Grade / Level:</span>
            <span className="cred-val">{STUDENT_PROFILE.grade}</span>
          </div>
          <div className="cred-field">
            <span className="cred-label">Homeroom / Class:</span>
            <span className="cred-val">{STUDENT_PROFILE.homeroom}</span>
          </div>
          <div className="cred-field">
            <span className="cred-label">Admit Date:</span>
            <span className="cred-val">{STUDENT_PROFILE.admitDate}</span>
          </div>
          <div className="cred-field">
            <span className="cred-label">Anticipated Graduation:</span>
            <span className="cred-val">{STUDENT_PROFILE.expectedGraduation}</span>
          </div>
          <div className="cred-field">
            <span className="cred-label">Academic Counselor:</span>
            <span className="cred-val">{STUDENT_PROFILE.counselor}</span>
          </div>
          <div className="cred-field">
            <span className="cred-label">Program of Study:</span>
            <span className="cred-val">{STUDENT_PROFILE.program}</span>
          </div>
        </div>

        {/* Quick Summary Cards (Stat Bar) */}
        <div className="transcript-stats-strip">
          <div className="stat-pill-box">
            <span className="stat-label">Cumulative GPA</span>
            <span className="stat-number">{STUDENT_PROFILE.cumulativeGpa.toFixed(2)}</span>
            <span className="stat-sub">Weighted: {STUDENT_PROFILE.weightedGpa.toFixed(2)}</span>
          </div>
          <div className="stat-pill-box">
            <span className="stat-label">Credits Earned</span>
            <span className="stat-number">{STUDENT_PROFILE.totalCreditsEarned.toFixed(1)}</span>
            <span className="stat-sub">of {STUDENT_PROFILE.totalCreditsRequired.toFixed(1)} Required</span>
          </div>
          <div className="stat-pill-box">
            <span className="stat-label">Class Standing</span>
            <span className="stat-number">{STUDENT_PROFILE.classRank}</span>
            <span className="stat-sub">{STUDENT_PROFILE.academicStanding}</span>
          </div>
          <div className="stat-pill-box">
            <span className="stat-label">Transcript Status</span>
            <span className="stat-number status-active">Certified</span>
            <span className="stat-sub">Issued: {STUDENT_PROFILE.issuedDate}</span>
          </div>
        </div>
      </div>

      {/* ── Official Institutional Document Container: Card 2 (Course Specifics, Records & Verification) ── */}
      <div className="official-transcript-sheet glass transcript-records-card" id="printable-transcript-records">
        
        {/* Filter Controls Bar (Interactive, Hidden on Print) */}
        <div className="transcript-filter-controls no-print">
          <div className="search-filter-box glass">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search course title, code, instructor, or grade..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filters-row">
            <div className="filter-select-group">
              <label>Semester / Term:</label>
              <select 
                value={selectedTermFilter} 
                onChange={e => setSelectedTermFilter(e.target.value)}
                className="custom-filter-select"
              >
                <option value="all">All Academic Terms (Historical)</option>
                {TRANSCRIPT_TERMS.map(t => (
                  <option key={t.id} value={t.id}>{t.termName}</option>
                ))}
              </select>
            </div>

            <div className="filter-select-group">
              <label>Department:</label>
              <select 
                value={selectedDeptFilter} 
                onChange={e => setSelectedDeptFilter(e.target.value)}
                className="custom-filter-select"
              >
                <option value="all">All Departments</option>
                {departments.filter(d => d !== 'all').map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="view-mode-toggle glass">
              <button 
                type="button" 
                className={`view-btn ${viewMode === 'terms' ? 'active' : ''}`}
                onClick={() => setViewMode('terms')}
              >
                Semester View
              </button>
              <button 
                type="button" 
                className={`view-btn ${viewMode === 'tabular' ? 'active' : ''}`}
                onClick={() => setViewMode('tabular')}
              >
                Master Table
              </button>
            </div>
          </div>
        </div>

        {/* ── Chronological Semester Sections ── */}
        {viewMode === 'terms' ? (
          <div className="terms-historical-container">
            {filteredTerms.length === 0 ? (
              <div className="empty-transcript-state">
                <BookOpen size={36} />
                <h4>No courses found matching your filter</h4>
                <p>Try clearing your search query or selecting "All Academic Terms".</p>
              </div>
            ) : (
              filteredTerms.map(term => (
                <div key={term.id} className="term-block-card">
                  <div className="term-block-header">
                    <div className="term-title-meta">
                      <div className="term-name-row">
                        <Calendar size={18} className="text-primary" />
                        <h3>{term.termName}</h3>
                        <span className="term-honor-pill"><Award size={13} /> {term.termHonor}</span>
                      </div>
                      <span className="term-status-badge">{term.termStatus}</span>
                    </div>

                    <div className="term-quick-metrics">
                      <div className="term-metric">
                        <span className="m-label">Term GPA</span>
                        <span className="m-val">{term.termGpa.toFixed(2)}</span>
                      </div>
                      <div className="term-metric">
                        <span className="m-label">Credits</span>
                        <span className="m-val">{term.termCredits.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="courses-table-wrapper">
                    <table className="transcript-courses-table">
                      <thead>
                        <tr>
                          <th>Course Code</th>
                          <th>Subject / Course Title</th>
                          <th>Department</th>
                          <th>Type</th>
                          <th>Credits</th>
                          <th>Grade Awarded</th>
                          <th>Date Given</th>
                          <th>Instructor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {term.courses.map((course, i) => (
                          <tr key={`${term.id}-${course.code}-${i}`}>
                            <td className="font-mono course-code">{course.code}</td>
                            <td className="course-title-cell">
                              <strong>{course.title}</strong>
                              {course.remarks && (
                                <div className="course-remarks-text">{course.remarks}</div>
                              )}
                            </td>
                            <td><span className="dept-tag">{course.department}</span></td>
                            <td><span className="type-tag">{course.type}</span></td>
                            <td className="text-center font-semibold">{course.credits.toFixed(1)}</td>
                            <td className="grade-cell">
                              <div className="grade-badge-wrap">
                                <span className={`letter-grade-badge ${course.letterGrade.startsWith('A') ? 'grade-a' : 'grade-b'}`}>
                                  {course.letterGrade}
                                </span>
                                <span className="grade-pct">{course.gradePercentage}%</span>
                                <span className="gpa-pts">({course.gpaPoints.toFixed(1)} pts)</span>
                              </div>
                            </td>
                            <td className="date-given-cell">{course.dateAwarded}</td>
                            <td className="instructor-cell">{course.instructor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Master Table View */
          <div className="master-tabular-container">
            <div className="courses-table-wrapper">
              <table className="transcript-courses-table">
                <thead>
                  <tr>
                    <th>Term</th>
                    <th>Code</th>
                    <th>Course Title</th>
                    <th>Dept</th>
                    <th>Type</th>
                    <th>Credits</th>
                    <th>Final Grade</th>
                    <th>Date Awarded</th>
                    <th>Instructor</th>
                  </tr>
                </thead>
                <tbody>
                  {allFilteredCourses.map((c, idx) => (
                    <tr key={`master-${c.code}-${idx}`}>
                      <td className="term-col-text font-semibold">{c.termName.split('–')[1] || c.termName}</td>
                      <td className="font-mono course-code">{c.code}</td>
                      <td className="course-title-cell">
                        <strong>{c.title}</strong>
                        {c.remarks && <div className="course-remarks-text">{c.remarks}</div>}
                      </td>
                      <td><span className="dept-tag">{c.department}</span></td>
                      <td><span className="type-tag">{c.type}</span></td>
                      <td className="text-center font-semibold">{c.credits.toFixed(1)}</td>
                      <td className="grade-cell">
                        <span className={`letter-grade-badge ${c.letterGrade.startsWith('A') ? 'grade-a' : 'grade-b'}`}>
                          {c.letterGrade}
                        </span>
                        <span className="grade-pct">{c.gradePercentage}%</span>
                      </td>
                      <td className="date-given-cell">{c.dateAwarded}</td>
                      <td className="instructor-cell">{c.instructor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grading Scale & Institutional Accreditation Legend */}
        <div className="grading-legend-section">
          <div className="legend-header">
            <h4>Official Grading Scale & Accreditation Key</h4>
            <span className="muted-text">4.0 Standard Unweighted Academic System</span>
          </div>

          <div className="grading-scale-grid">
            {GRADING_SCALE.map((g, i) => (
              <div key={i} className="scale-item">
                <span className="scale-grade">{g.grade}</span>
                <span className="scale-range">{g.range}</span>
                <span className="scale-points">{g.points} pts</span>
                <span className="scale-desc">{g.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Official Certification Signature Block */}
        <div className="official-signature-block">
          <div className="sig-column">
            <div className="sig-line"></div>
            <span className="sig-name">Elena Rostova, Ed.D.</span>
            <span className="sig-title">Dean of Academic Affairs & Principal</span>
            <span className="sig-date">Certified: September 19, 2026</span>
          </div>

          <div className="seal-watermark-center">
            <div className="watermark-seal">
              <ShieldCheck size={36} />
              <span>ACCREDITED REGISTRAR SEAL</span>
              <span className="seal-number">REG-2026-A1</span>
            </div>
          </div>

          <div className="sig-column">
            <div className="sig-line"></div>
            <span className="sig-name">Ms. Emily Brown, M.Ed.</span>
            <span className="sig-title">Registrar & Lead Academic Counselor</span>
            <span className="sig-date">Certified: September 19, 2026</span>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="transcript-doc-footer">
          <p>This electronic academic transcript is a demonstration record for Noesis Horizon. For verification in a real deployment, contact the school registrar and cite Verification Code: {STUDENT_PROFILE.verificationCode}.</p>
        </div>

      </div>
    </div>
  );
};

export default Transcript;
