import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Users, Settings, Plus, Trash2,
  Edit, AlertCircle, UserMinus, BarChart2, BookMarked,
  ClipboardList, Calendar, X, Check, CheckCircle2, ShieldAlert
} from 'lucide-react';
import './ClassOverview.css';

/* ─── Mock Data ──────────────────────────────────────────── */

const INITIAL_STUDENTS = [
  { id: 1, name: 'Bella Blue',    email: 'bella@lumischool.edu',   avatar: 'Bella' },
  { id: 2, name: 'Max Power',     email: 'max@lumischool.edu',     avatar: 'Max' },
  { id: 3, name: 'Sophie Miller', email: 'sophie@lumischool.edu',  avatar: 'Sophie' },
];

const INITIAL_ASSIGNMENTS = [
  { id: 1, title: 'Chapter 4 Homework',  category: 'Homework', date: 'Mar 10, 2026', totalPoints: 100 },
  { id: 2, title: 'Midterm Quiz',        category: 'Quiz',     date: 'Mar 15, 2026', totalPoints: 50  },
  { id: 3, title: 'Lab Report',          category: 'Project',  date: 'Mar 20, 2026', totalPoints: 100 },
];

const INITIAL_WEIGHTS = { Homework: 25, Quiz: 25, Exam: 30, Project: 20 };

/* ─── Helpers ────────────────────────────────────────────── */

const toPercent = (score, total) =>
  total > 0 ? Math.round((score / total) * 100) : 0;

const calcClassAvg = (assignmentId, grades, students) => {
  const graded = students.filter(s => grades[s.id]?.[assignmentId] !== undefined);
  if (!graded.length) return null;
  const sum = graded.reduce((a, s) => a + Number(grades[s.id][assignmentId]), 0);
  return sum / graded.length;
};

const calcFinalGrade = (studentId, assignments, grades, weights) => {
  const cats = {};
  assignments.forEach(a => {
    const g = grades[studentId]?.[a.id];
    if (g === undefined) return;
    if (!cats[a.category]) cats[a.category] = { earned: 0, total: 0 };
    cats[a.category].earned += Number(g);
    cats[a.category].total  += a.totalPoints;
  });
  let weightedSum = 0, weightTotal = 0;
  Object.entries(cats).forEach(([cat, { earned, total }]) => {
    const w = weights[cat] ?? 0;
    weightedSum += (earned / total) * w;
    weightTotal += w;
  });
  return weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) : null;
};

const gradeLabel = (pct) => {
  if (pct === null) return '—';
  if (pct >= 93) return 'A'; if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+'; if (pct >= 83) return 'B'; if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+'; if (pct >= 73) return 'C'; if (pct >= 70) return 'C-';
  if (pct >= 60) return 'D'; return 'F';
};

const gradeColor = (pct) => {
  if (pct === null) return 'hsl(var(--muted-foreground))';
  if (pct >= 80) return 'hsl(var(--mood-happy))';
  if (pct >= 60) return 'hsl(var(--mood-neutral))';
  return 'hsl(var(--mood-sad))';
};

/* ─── Sub-components ─────────────────────────────────────── */

const Avatar = ({ name, size = 36 }) => (
  <img
    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`}
    alt={name}
    style={{ width: size, height: size, borderRadius: '50%', background: 'hsla(var(--secondary),0.3)' }}
  />
);

/* Grade Modal */
const GradeModal = ({ assignment, students, grades, onSave, onClose }) => {
  const [local, setLocal] = useState(
    Object.fromEntries(students.map(s => [s.id, grades[s.id]?.[assignment.id] ?? '']))
  );
  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-content"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Grade — {assignment.title}</h3>
          <p className="modal-subtitle">Total assignment capacity: {assignment.totalPoints} Points</p>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); onSave(assignment.id, local); }}>
          <div className="modal-grades-list">
            {students.map(s => (
              <div key={s.id} className="grade-input-row">
                <div className="grade-student-info">
                  <Avatar name={s.name} size={30} />
                  <span>{s.name}</span>
                </div>
                <div className="grade-input-wrap">
                  <input
                    type="number"
                    min="0"
                    max={assignment.totalPoints}
                    placeholder="—"
                    value={local[s.id]}
                    onChange={e => setLocal({ ...local, [s.id]: e.target.value })}
                  />
                  <span className="max-pts">/ {assignment.totalPoints}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Grades</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* Weights Modal */
const WeightsModal = ({ weights, onSave, onClose }) => {
  const [local, setLocal] = useState({ ...weights });
  const total = Object.values(local).reduce((a, b) => a + Number(b || 0), 0);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-content"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Category Weights</h3>
          <p className="modal-subtitle">Configure percentage weights for each assignment type (Total must equal 100%).</p>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); if (total === 100) onSave(local); }}>
          <div className="form-grid-2">
            {Object.keys(weights).map(cat => (
              <div key={cat} className="input-group">
                <label>{cat} (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={local[cat]}
                  onChange={e => setLocal({ ...local, [cat]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
          <div className="weights-total-row" style={{ color: total === 100 ? 'hsl(var(--mood-happy))' : 'hsl(var(--destructive))' }}>
            Total: {total}% {total !== 100 && '(Must equal 100%)'}
          </div>
          <div className="modal-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={total !== 100}>Save Weights</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* Add Assignment Modal */
const AddAssignmentModal = ({ onSave, onClose }) => {
  const [form, setForm] = useState({ title: '', category: 'Homework', totalPoints: 100, date: '' });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-content"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Add Assignment</h3>
          <p className="modal-subtitle">Create a coursework item or examination for this class.</p>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); if (form.title) onSave(form); }}>
          <div className="input-group">
            <label>Title</label>
            <input required placeholder="e.g. Chapter 5 Practice" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-grid-2">
            <div className="input-group">
              <label>Category</label>
              <select className="custom-form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {['Homework', 'Quiz', 'Exam', 'Project'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Total Points</label>
              <input type="number" min="1" required value={form.totalPoints} onChange={e => setForm({ ...form, totalPoints: Number(e.target.value) })} />
            </div>
          </div>
          <div className="input-group">
            <label>Date</label>
            <input type="text" placeholder="e.g. Mar 25, 2026" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="modal-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Add Assignment</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────── */

const TABS = [
  { id: 'dashboard',  label: 'Dashboard',  icon: BarChart2     },
  { id: 'roster',     label: 'Roster',     icon: Users         },
  { id: 'gradebook',  label: 'Gradebook',  icon: BookMarked    },
  { id: 'materials',  label: 'Materials',  icon: BookOpen      },
  { id: 'attendance', label: 'Attendance', icon: ClipboardList },
];

const ClassOverview = ({ classData, onBack, onStudentSelect }) => {
  const [activeTab, setActiveTab]         = useState('gradebook');
  const [students, setStudents]           = useState(INITIAL_STUDENTS);
  const [assignments, setAssignments]     = useState(INITIAL_ASSIGNMENTS);
  const [grades, setGrades]               = useState({});   // { studentId: { assignmentId: score } }
  const [weights, setWeights]             = useState(INITIAL_WEIGHTS);
  const [gradeModal, setGradeModal]       = useState(null); // assignment obj
  const [weightsModal, setWeightsModal]   = useState(false);
  const [addModal, setAddModal]           = useState(false);
  const [studentToRemove, setStudentToRemove] = useState(null);
  const [catFilter, setCatFilter]         = useState('All');
  const [searchQ, setSearchQ]             = useState('');

  if (!classData) return null;

  /* helpers */
  const saveGrades = (assignmentId, localScores) => {
    const next = { ...grades };
    Object.entries(localScores).forEach(([sId, score]) => {
      if (score === '') return;
      if (!next[sId]) next[sId] = {};
      next[sId][assignmentId] = score;
    });
    setGrades(next);
    setGradeModal(null);
  };

  const saveWeights = (w) => { setWeights(w); setWeightsModal(false); };

  const addAssignment = (form) => {
    const next = { ...form, id: Date.now(), date: form.date || new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) };
    setAssignments([...assignments, next]);
    setAddModal(false);
  };

  const deleteAssignment = (id) => setAssignments(assignments.filter(a => a.id !== id));

  const addStudent = () => {
    const id = Date.now();
    setStudents([...students, { id, name: 'New Student', email: `student${id}@lumischool.edu`, avatar: `student${id}` }]);
  };
  const removeStudent = (id) => setStudents(students.filter(s => s.id !== id));

  const filteredAssignments = assignments
    .filter(a => catFilter === 'All' || a.category === catFilter)
    .filter(a => a.title.toLowerCase().includes(searchQ.toLowerCase()));

  const cats = ['All', ...new Set(assignments.map(a => a.category))];

  /* avg across all graded */
  const classOverallAvg = () => {
    const avgs = students.map(s => calcFinalGrade(s.id, assignments, grades, weights)).filter(v => v !== null);
    if (!avgs.length) return null;
    return Math.round(avgs.reduce((a,b) => a+b,0) / avgs.length);
  };

  return (
    <motion.div className="co-page" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>

      {/* ── Hero Header ── */}
      <div className="co-header glass" style={{ borderLeft: `5px solid hsl(var(${classData.color}))` }}>
        {/* Row 1: back + actions */}
        <div className="co-header-top">
          <button className="back-btn bouncy" onClick={onBack}>
            <ArrowLeft size={16} /> All Classes
          </button>
          <button className="btn-primary btn-sm" onClick={addStudent}>
            <Plus size={15} /> Add Student
          </button>
        </div>

        {/* Row 2: class identity */}
        <div className="co-header-identity">
          <div className="co-class-icon-wrap" style={{ background: `hsl(var(${classData.color}) / 0.18)` }}>
            <BookOpen size={28} color={`hsl(var(${classData.color}))`} />
          </div>
          <div>
            <h2 className="co-class-name">{classData.name}</h2>
            <p className="co-meta">{classData.code} &nbsp;·&nbsp; {classData.teacher}</p>
          </div>
        </div>

        {/* Row 3: stat pills */}
        <div className="co-header-stats">
          <div className="co-stat-pill" style={{ borderColor: `hsl(var(--chart-4) / 0.3)`, background: `hsl(var(--chart-4) / 0.13)` }}>
            <span style={{ color: 'hsl(var(--chart-4))' }}>Students</span>
            <strong style={{ color: 'hsl(var(--chart-4))' }}>{students.length}</strong>
          </div>
          <div className="co-stat-pill" style={{ borderColor: `hsl(var(--chart-2) / 0.3)`, background: `hsl(var(--chart-2) / 0.13)` }}>
            <span style={{ color: 'hsl(var(--chart-2))' }}>Progress</span>
            <strong style={{ color: 'hsl(var(--chart-2))' }}>{classData.progress}%</strong>
          </div>
          <div className="co-stat-pill" style={{ borderColor: `hsl(var(${classData.color}) / 0.3)`, background: `hsl(var(${classData.color}) / 0.13)` }}>
            <span style={{ color: `hsl(var(${classData.color}))` }}>Class Avg</span>
            <strong style={{ color: `hsl(var(${classData.color}))` }}>
              {classOverallAvg() !== null ? `${classOverallAvg()}%` : '—'}
            </strong>
          </div>
          <div className="co-stat-pill" style={{ borderColor: `hsl(var(--chart-1) / 0.3)`, background: `hsl(var(--chart-1) / 0.13)` }}>
            <span style={{ color: 'hsl(var(--chart-1))' }}>Assignments</span>
            <strong style={{ color: 'hsl(var(--chart-1))' }}>{assignments.length}</strong>
          </div>
        </div>
      </div>

      {/* ── Horizontal Tabs ── */}
      <div className="co-tab-bar glass">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`co-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <motion.div key="dashboard" className="co-tab-content" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
            <div className="co-dashboard-grid">
              <div className="co-widget glass">
                <h4>Class Breakdown</h4>
                <div className="breakdown-list">
                  {['A','B','C','D','F'].map(letter => {
                    const count = students.filter(s => {
                      const pct = calcFinalGrade(s.id, assignments, grades, weights);
                      return gradeLabel(pct) === letter || gradeLabel(pct).startsWith(letter);
                    }).length;
                    return (
                      <div key={letter} className="breakdown-row">
                        <span className="grade-badge" style={{ background: `hsl(var(--chart-${Math.floor(Math.random()*5)+1}) / 0.2)` }}>{letter}</span>
                        <div className="breakdown-bar-bg">
                          <div className="breakdown-bar" style={{ width: students.length ? `${(count/students.length)*100}%` : '0%', background: `hsl(var(--primary))` }} />
                        </div>
                        <span>{count} student{count !== 1 ? 's' : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="co-widget glass">
                <h4>Category Weights</h4>
                <div className="weights-list">
                  {Object.entries(weights).map(([cat, w]) => (
                    <div key={cat} className="weight-row">
                      <span className="type-badge">{cat}</span>
                      <div className="breakdown-bar-bg">
                        <div className="breakdown-bar" style={{ width: `${w}%`, background: `hsl(var(--accent))` }} />
                      </div>
                      <strong>{w}%</strong>
                    </div>
                  ))}
                </div>
                <button className="btn-secondary glass btn-sm" style={{marginTop:'1rem'}} onClick={() => setWeightsModal(true)}>
                  <Settings size={14} /> Edit Weights
                </button>
              </div>
              <div className="co-widget glass">
                <h4>Top Students</h4>
                {students.slice().sort((a,b) => {
                  const pa = calcFinalGrade(a.id, assignments, grades, weights) ?? -1;
                  const pb = calcFinalGrade(b.id, assignments, grades, weights) ?? -1;
                  return pb - pa;
                }).map((s,i) => {
                  const pct = calcFinalGrade(s.id, assignments, grades, weights);
                  return (
                    <div key={s.id} className="top-student-row">
                      <span className="rank-badge">#{i+1}</span>
                      <Avatar name={s.name} size={32} />
                      <span className="flex-1">{s.name}</span>
                      <strong style={{ color: gradeColor(pct) }}>{pct !== null ? `${pct}%` : '—'} {gradeLabel(pct)}</strong>
                    </div>
                  );
                })}
              </div>
              <div className="co-widget glass">
                <h4>Quick Stats</h4>
                <div className="quick-stats">
                  <div className="qs-item">
                    <span>Assignments</span><strong>{assignments.length}</strong>
                  </div>
                  <div className="qs-item">
                    <span>Graded</span><strong>{assignments.filter(a => students.some(s => grades[s.id]?.[a.id] !== undefined)).length}</strong>
                  </div>
                  <div className="qs-item">
                    <span>Class Avg</span><strong style={{ color: gradeColor(classOverallAvg()) }}>{classOverallAvg() !== null ? `${classOverallAvg()}%` : '—'}</strong>
                  </div>
                  <div className="qs-item">
                    <span>Letter</span><strong style={{ color: gradeColor(classOverallAvg()) }}>{gradeLabel(classOverallAvg())}</strong>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ROSTER ── */}
        {activeTab === 'roster' && (
          <motion.div key="roster" className="co-tab-content" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
            <div className="co-toolbar">
              <h3>Student Roster</h3>
              <button className="btn-primary btn-sm" onClick={addStudent}><Plus size={16}/> Add Student</button>
            </div>
            <div className="co-table glass">
              <table>
                <thead>
                  <tr>
                    <th>Student</th><th>Email</th><th>Final Grade</th><th>Letter</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {students.map(s => {
                      const pct = calcFinalGrade(s.id, assignments, grades, weights);
                      return (
                        <motion.tr key={s.id} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} layout
                          style={{ cursor: 'pointer' }}
                          onClick={() => onStudentSelect && onStudentSelect({ ...s, grade: 'Roster', tags: [], points: 0, badge: '' })}
                        >
                          <td>
                            <div className="student-cell">
                              <Avatar name={s.name} size={32} />
                              <span>{s.name}</span>
                            </div>
                          </td>
                          <td className="muted">{s.email}</td>
                          <td><strong style={{ color: gradeColor(pct) }}>{pct !== null ? `${pct}%` : '—'}</strong></td>
                          <td><span className="grade-badge" style={{ color: gradeColor(pct) }}>{gradeLabel(pct)}</span></td>
                          <td>
                            <button 
                              type="button"
                              className="icon-btn-destructive" 
                              title="Remove from class roster"
                              onClick={(e) => {
                                e.stopPropagation();
                                setStudentToRemove(s);
                              }}
                            >
                              <UserMinus size={16}/>
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
              {students.length === 0 && <div className="empty-state"><AlertCircle size={28}/><p>No students enrolled.</p></div>}
            </div>
          </motion.div>
        )}

        {/* ── GRADEBOOK ── */}
        {activeTab === 'gradebook' && (
          <motion.div key="gradebook" className="co-tab-content" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
            {/* Toolbar */}
            <div className="co-toolbar">
              <h3>Gradebook</h3>
              <div className="co-toolbar-actions">
                <button className="btn-secondary glass btn-sm" onClick={() => setWeightsModal(true)}>
                  <Settings size={15}/> Set Weights
                </button>
                <button className="btn-primary btn-sm" onClick={() => setAddModal(true)}>
                  <Plus size={15}/> Add Assignment
                </button>
              </div>
            </div>
            {/* Filters */}
            <div className="co-filters">
              <div className="search-box glass">
                <span>🔍</span>
                <input placeholder="Search assignments…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>
              <div className="cat-pills">
                {cats.map(c => (
                  <button key={c} className={`cat-pill ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>{c}</button>
                ))}
              </div>
            </div>
            {/* Table */}
            <div className="co-table glass">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Total Pts</th>
                    <th>Class Avg</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredAssignments.map(a => {
                      const avg = calcClassAvg(a.id, grades, students);
                      return (
                        <motion.tr key={a.id} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} layout>
                          <td><strong>{a.title}</strong></td>
                          <td><span className="type-badge">{a.category}</span></td>
                          <td className="muted">{a.date}</td>
                          <td className="centered">{a.totalPoints}</td>
                          <td className="centered">
                            {avg !== null
                              ? <span style={{ color: gradeColor(toPercent(avg, a.totalPoints)), fontWeight: 700 }}>
                                  {Math.round(avg)} / {a.totalPoints} ({toPercent(avg, a.totalPoints)}%)
                                </span>
                              : <span className="muted">—</span>}
                          </td>
                          <td className="actions-cell">
                            <button className="btn-grade glass bouncy" onClick={() => setGradeModal(a)}>
                              <Edit size={14} /> Grade
                            </button>
                            <button className="icon-btn-destructive" onClick={() => deleteAssignment(a.id)}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
              {filteredAssignments.length === 0 && <div className="empty-state"><AlertCircle size={28}/><p>No assignments found.</p></div>}
            </div>

            {/* Per-student grade summary */}
            {students.length > 0 && assignments.length > 0 && (
              <div className="grade-summary-section">
                <h4 style={{ margin: '0 0 1rem', color: 'hsl(var(--muted-foreground))', fontSize:'0.9rem', textTransform:'uppercase', letterSpacing:'1px' }}>Student Final Grades</h4>
                <div className="co-table glass">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        {Object.keys(weights).map(cat => <th key={cat}>{cat}</th>)}
                        <th>Final %</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => {
                        const pct = calcFinalGrade(s.id, assignments, grades, weights);
                        const catScores = {};
                        assignments.forEach(a => {
                          const g = grades[s.id]?.[a.id];
                          if (g === undefined) return;
                          if (!catScores[a.category]) catScores[a.category] = { earned:0, total:0 };
                          catScores[a.category].earned += Number(g);
                          catScores[a.category].total  += a.totalPoints;
                        });
                        return (
                          <tr key={s.id}>
                            <td>
                              <div className="student-cell">
                                <Avatar name={s.name} size={28} />
                                <span>{s.name}</span>
                              </div>
                            </td>
                            {Object.keys(weights).map(cat => (
                              <td key={cat} className="centered muted">
                                {catScores[cat]
                                  ? `${toPercent(catScores[cat].earned, catScores[cat].total)}%`
                                  : '—'}
                              </td>
                            ))}
                            <td className="centered"><strong style={{ color: gradeColor(pct) }}>{pct !== null ? `${pct}%` : '—'}</strong></td>
                            <td className="centered"><span className="grade-badge" style={{ color: gradeColor(pct), border: `1px solid ${gradeColor(pct)}22` }}>{gradeLabel(pct)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── MATERIALS ── */}
        {activeTab === 'materials' && (
          <motion.div key="materials" className="co-tab-content" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
            <div className="co-toolbar"><h3>Course Materials</h3><button className="btn-primary btn-sm"><Plus size={15}/> Upload</button></div>
            <div className="materials-grid">
              {['Syllabus Fall 2026','Lecture Slides – Week 4','Recommended Reading List','Study Guide'].map((title, i) => (
                <div key={i} className="material-card glass bouncy">
                  <div className="material-icon"><BookOpen size={32} color={`hsl(var(${classData.color}))`} /></div>
                  <h4>{title}</h4>
                  <span className="material-type">{['PDF','PPTX','DOCX','PDF'][i]}</span>
                  <button className="btn-secondary glass btn-sm">Download</button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── ATTENDANCE ── */}
        {activeTab === 'attendance' && (
          <motion.div key="attendance" className="co-tab-content" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
            <div className="co-toolbar"><h3>Attendance</h3><button className="btn-primary btn-sm"><Plus size={15}/> Mark Today</button></div>
            <div className="co-table glass">
              <table>
                <thead><tr><th>Student</th><th>Present</th><th>Absent</th><th>Rate</th></tr></thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id}>
                      <td><div className="student-cell"><Avatar name={s.name} size={28}/><span>{s.name}</span></div></td>
                      <td className="centered" style={{ color: 'hsl(var(--mood-happy))' }}>18</td>
                      <td className="centered" style={{ color: 'hsl(var(--mood-sad))' }}>2</td>
                      <td className="centered"><strong style={{ color: 'hsl(var(--mood-happy))' }}>90%</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {gradeModal   && <GradeModal assignment={gradeModal} students={students} grades={grades} onSave={saveGrades} onClose={() => setGradeModal(null)} />}
        {weightsModal && <WeightsModal weights={weights} onSave={saveWeights} onClose={() => setWeightsModal(false)} />}
        {addModal     && <AddAssignmentModal onSave={addAssignment} onClose={() => setAddModal(false)} />}

        {/* Roster Unenrollment Modal */}
        {studentToRemove && (
          <div className="modal-overlay" onClick={() => setStudentToRemove(null)}>
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
                    <UserMinus size={20} />
                  </div>
                  <div>
                    <h3>Remove from Class Roster?</h3>
                    <p className="modal-subtitle">Class enrollment removal confirmation</p>
                  </div>
                </div>
                <button type="button" className="icon-btn-close" onClick={() => setStudentToRemove(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <div className="delete-modal-body">
                <p>
                  Are you sure you want to remove <strong>{studentToRemove.name}</strong> from <strong>{classData.name}</strong>?
                </p>
                <div className="roster-notice-callout">
                  <CheckCircle2 size={16} />
                  <span>This student will only be unenrolled from this specific class roster. Their master profile, records, and data will remain safe and active in the school Students Directory.</span>
                </div>
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-secondary" onClick={() => setStudentToRemove(null)}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-destructive-solid" 
                  onClick={() => {
                    removeStudent(studentToRemove.id);
                    setStudentToRemove(null);
                  }}
                >
                  <UserMinus size={14} /> Remove from Roster
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default ClassOverview;
