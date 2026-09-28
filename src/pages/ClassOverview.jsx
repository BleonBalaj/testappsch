import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Users, Settings, Plus, Trash2,
  Edit, AlertCircle, UserMinus, BarChart2, BookMarked,
  ClipboardList, Calendar, X, Check, CheckCircle2, ShieldAlert,
  Download, ExternalLink, FileText, Video, Link as LinkIcon, RotateCcw
} from 'lucide-react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from '../components/Avatar';
import { CURRICULUM_STAGES } from './Classes';
import { INITIAL_WEIGHTS, getCategoryDisplayName, validateCategoryWeights, calcStudentGradeData } from '../features/gradebook/grading';
import { courseMatchesReference, isEnrolledThroughClass, isStudentEnrolledInCourse, normalizeAssignedCourseIds } from '../features/enrollment';
import { classGroupsById, studentClassLabel } from '../features/classGroups';
import { useCourseRoster, useStudentSearch } from '../features/students/studentData';
import { normalizeWebLink, safeWebLink } from '../features/links';
import './ClassOverview.css';

/* ─── Production Data State ──────────────────────────────── */

/* ─── Helpers ────────────────────────────────────────────── */

const toPercent = (score, total) =>
  total > 0 ? Math.round((score / total) * 100) : 0;

const calcClassAvg = (assignmentId, grades, students) => {
  const graded = students.filter(s => grades[s.id]?.[assignmentId] !== undefined);
  if (!graded.length) return null;
  const sum = graded.reduce((a, s) => a + Number(grades[s.id][assignmentId]), 0);
  return sum / graded.length;
};

const calcFinalGrade = (studentId, assignments, grades, weights, studentTracking, gradingSettings) => {
  const data = calcStudentGradeData(studentId, assignments, grades, weights, studentTracking, gradingSettings);
  return data.finalPct;
};

const gradeLabel = (pct, isAlbanian = false) => {
  if (pct === null || pct === undefined) return '—';
  if (isAlbanian) {
    if (pct >= 90) return '5 (A)';
    if (pct >= 75) return '4 (B)';
    if (pct >= 60) return '3 (C)';
    if (pct >= 50) return '2 (D)';
    return '1 (F)';
  }
  if (pct >= 93) return 'A'; if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+'; if (pct >= 83) return 'B'; if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+'; if (pct >= 73) return 'C'; if (pct >= 70) return 'C-';
  if (pct >= 60) return 'D'; return 'F';
};

const gradeColor = (pct) => {
  if (pct === null || pct === undefined) return 'hsl(var(--muted-foreground))';
  if (pct >= 80) return 'hsl(var(--mood-happy))';
  if (pct >= 60) return 'hsl(var(--mood-neutral))';
  return 'hsl(var(--mood-sad))';
};

/* ─── Sub-components ─────────────────────────────────────── */

/* Grade Modal */
const GradeModal = ({ assignment, students, grades, categoryLabels, onSave, onClose }) => {
  const { isAlbanian } = useLanguage();
  const [studentSearch, setStudentSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(
    Object.fromEntries(students.map(s => [s.id, grades[s.id]?.[assignment.id] ?? '']))
  );
  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try { await onSave(assignment.id, local); } catch (saveError) { setError(saveError.message || 'Could not save grades.'); } finally { setSaving(false); }
  };
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
          <h3>{isAlbanian ? 'Vlerëso — ' : 'Grade — '}{assignment.title}</h3>
          <p className="modal-subtitle">{getCategoryDisplayName(assignment.category, isAlbanian, categoryLabels)} · {isAlbanian ? `Pikët maksimale: ${assignment.totalPoints}` : `Maximum points: ${assignment.totalPoints}`}</p>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="search-box glass gradebook-student-search"><span>🔍</span><input aria-label={isAlbanian ? 'Kërko nxënësit' : 'Search students'} placeholder={isAlbanian ? 'Kërko nxënësit…' : 'Search students…'} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} /></div>
          <div className="modal-grades-list">
            {students.filter(s => [s.name, s.studentId, s.email].some(value => String(value || '').toLocaleLowerCase().includes(studentSearch.trim().toLocaleLowerCase()))).map(s => (
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
          {error && <p role="alert" className="category-editor-error">{error}</p>}
          <div className="modal-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{isAlbanian ? 'Anulo' : 'Cancel'}</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? (isAlbanian ? 'Duke ruajtur…' : 'Saving…') : (isAlbanian ? 'Ruaj Notat' : 'Save Grades')}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* Grading & Weights Settings Modal */
const GradingSettingsModal = ({ weights, categoryLabels, assignments, gradingSettings, curriculumStage, onSave, onClose }) => {
  const { isAlbanian } = useLanguage();
  const [localWeights, setLocalWeights] = useState({ ...weights });
  const [localLabels, setLocalLabels] = useState({ ...categoryLabels });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState({
    homeworkMinusValue: gradingSettings?.homeworkMinusValue ?? 1,
    engagementPlusValue: gradingSettings?.engagementPlusValue ?? 1,
    engagementMinusValue: gradingSettings?.engagementMinusValue ?? 1
  });
  const [localStage, setLocalStage] = useState(curriculumStage || 'Shkalla III');

  const totalWeight = Object.values(localWeights).reduce((a, b) => a + Number(b || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateCategoryWeights(localWeights, localLabels, assignments);
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    setError('');
    try { await onSave({
      newWeights: Object.fromEntries(Object.entries(localWeights).map(([key, value]) => [key, Number(value)])),
      newCategoryLabels: localLabels,
      newGradingSettings: localSettings,
      newCurriculumStage: localStage
    }); } catch (saveError) { setError(saveError.message || 'Could not save settings.'); } finally { setSaving(false); }
  };

  const addCategory = () => {
    const id = `custom_${crypto.randomUUID()}`;
    setLocalWeights(prev => ({ ...prev, [id]: 0 }));
    setLocalLabels(prev => ({ ...prev, [id]: '' }));
  };

  const removeCategory = (category) => {
    if (assignments.some(assignment => assignment.category === category)) {
      setError(isAlbanian ? 'Kjo kategori ka detyra. Hiqni ose zhvendosni detyrat para se ta fshini.' : 'This category has assignments. Remove or move them before deleting it.');
      return;
    }
    setLocalWeights(prev => { const next = { ...prev }; delete next[category]; return next; });
    setLocalLabels(prev => { const next = { ...prev }; delete next[category]; return next; });
    setError('');
  };

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
          <h3>{isAlbanian ? 'Cilësimet e Notimit & Peshat' : 'Grading Settings & Category Weights'}</h3>
          <p className="modal-subtitle">
            {isAlbanian
              ? 'Konfiguroni peshat e vlerësimit, zbritjet për detyrat, angazhimin dhe shkallën e kurrikulës.'
              : 'Configure category weights, continuous evaluation deductions, and curriculum stage.'}
          </p>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {/* Shkalla e Kurrikulës */}
          <div className="input-group">
            <label>{isAlbanian ? 'Shkalla e Kurrikulës' : 'Curriculum Stage'}</label>
            <select
              className="custom-form-select"
              value={localStage}
              onChange={(e) => setLocalStage(e.target.value)}
            >
              {CURRICULUM_STAGES.map(stage => (
                <option key={stage.id} value={stage.id}>
                  {isAlbanian ? stage.labelSq : stage.labelEn}
                </option>
              ))}
            </select>
          </div>

          {/* Section: Category Weights */}
          <div style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--primary))', letterSpacing: '0.5px' }}>
              {isAlbanian ? 'Peshat e Kategorive (Totali duhet të jetë 100%)' : 'Category Weights (Total must equal 100%)'}
            </h4>
            <p className="ct-subtitle">{isAlbanian ? 'Ndryshoni emrat dhe peshat. Kategoritë e ndjekjes Detyrat dhe Angazhimi nuk mund të fshihen.' : 'Edit names and weights. Homework and Engagement stay because continuous tracking uses them.'}</p>
          </div>

          <div className="category-editor-list">
            {Object.keys(localWeights).map(cat => (
              <div key={cat} className="category-editor-row">
                <div className="input-group">
                  <label htmlFor={`category-name-${cat}`}>{isAlbanian ? 'Emri i kategorisë' : 'Category name'}</label>
                  <input id={`category-name-${cat}`} aria-label={`${getCategoryDisplayName(cat, isAlbanian, localLabels)} name`} value={localLabels[cat] ?? ''}
                    placeholder={cat.startsWith('custom_') ? (isAlbanian ? 'Emri i ri' : 'New category name') : getCategoryDisplayName(cat, isAlbanian)}
                    onChange={e => setLocalLabels(prev => ({ ...prev, [cat]: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label htmlFor={`category-weight-${cat}`}>{isAlbanian ? 'Pesha (%)' : 'Weight (%)'}</label>
                  <input id={`category-weight-${cat}`} type="number" min="0" max="100" step="1" value={localWeights[cat]}
                    onChange={e => setLocalWeights(prev => ({ ...prev, [cat]: e.target.value }))} />
                </div>
                <button type="button" className="icon-btn-destructive" disabled={cat === 'Homework' || cat === 'Engagement' || assignments.some(a => a.category === cat)}
                  title={cat === 'Homework' || cat === 'Engagement' ? (isAlbanian ? 'Kategoria e ndjekjes është e detyrueshme' : 'Required tracking category') : (isAlbanian ? 'Fshi kategorinë' : 'Remove category')}
                  aria-label={`${isAlbanian ? 'Fshi' : 'Remove'} ${getCategoryDisplayName(cat, isAlbanian, localLabels)}`} onClick={() => removeCategory(cat)}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary" onClick={addCategory}><Plus size={15} /> {isAlbanian ? 'Shto Kategori' : 'Add Category'}</button>

          <div className="weights-total-row" style={{ color: totalWeight === 100 ? 'hsl(var(--mood-happy))' : 'hsl(var(--destructive))', fontWeight: 700 }}>
            {isAlbanian
              ? `Totali i Peshave: ${totalWeight}% ${totalWeight !== 100 ? '(Duhet të jetë saktësisht 100%)' : '✓'}`
              : `Total Weight: ${totalWeight}% ${totalWeight !== 100 ? '(Must equal exactly 100%)' : '✓'}`}
          </div>
          {error && <p role="alert" className="category-editor-error">{error}</p>}

          {/* Section: Continuous Assessment Rules */}
          <div style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--primary))', letterSpacing: '0.5px' }}>
              {isAlbanian ? 'Rregullat e Vlerësimit të Vazhdueshëm' : 'Continuous Assessment Rules'}
            </h4>
          </div>

          <div className="form-grid-2">
            <div className="input-group">
              <label>{isAlbanian ? 'Detyra e Munguar: Zbritje për çdo Minus (%)' : 'Missing Homework: Deduction per Minus (%)'}</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                max="50"
                required
                value={localSettings.homeworkMinusValue}
                onChange={e => setLocalSettings({ ...localSettings, homeworkMinusValue: Number(e.target.value) })}
              />
              <small style={{ fontSize: '0.73rem', color: 'hsl(var(--muted-foreground))' }}>
                {isAlbanian ? 'p.sh. 1% minus për çdo detyrë të papërfunduar (zbret nga pesha e detyrave)' : 'e.g. 1% minus per missing homework (deducted from homework weight)'}
              </small>
            </div>

            <div className="input-group">
              <label>{isAlbanian ? 'Angazhim në Klasë: Fiton për çdo Plus (%)' : 'Class Engagement: Earned per Plus (%)'}</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                max="50"
                required
                value={localSettings.engagementPlusValue}
                onChange={e => setLocalSettings({ ...localSettings, engagementPlusValue: Number(e.target.value) })}
              />
              <small style={{ fontSize: '0.73rem', color: 'hsl(var(--muted-foreground))' }}>
                {isAlbanian ? 'p.sh. 1% për çdo përgjigje ose aktivitet pozitiv në orë' : 'e.g. 1% per positive classroom response or activity'}
              </small>
            </div>
          </div>

          <div className="input-group">
            <label>{isAlbanian ? 'Angazhim në Klasë: Zbret për çdo Minus (%)' : 'Class Engagement: Deducted per Minus (%)'}</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              max="50"
              required
              value={localSettings.engagementMinusValue}
              onChange={e => setLocalSettings({ ...localSettings, engagementMinusValue: Number(e.target.value) })}
            />
            <small style={{ fontSize: '0.73rem', color: 'hsl(var(--muted-foreground))' }}>
              {isAlbanian ? 'p.sh. 1% zbret për vonesë, mosangazhim ose prishje disipline' : 'e.g. 1% deducted for inattention or lack of preparation'}
            </small>
          </div>

          <div className="modal-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {isAlbanian ? 'Anulo' : 'Cancel'}
            </button>
            <button type="submit" className="btn-primary" disabled={saving || totalWeight !== 100}>
              {saving ? (isAlbanian ? 'Duke ruajtur…' : 'Saving…') : (isAlbanian ? 'Ruaj Cilësimet' : 'Save Settings')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* Manual Override Modal */
const ManualOverrideModal = ({ studentData, onSave, onReset, onClose }) => {
  const { isAlbanian } = useLanguage();
  const [val, setVal] = useState(
    studentData.manualOverridePct !== undefined && studentData.manualOverridePct !== null
      ? studentData.manualOverridePct
      : (studentData.calculatedPct ?? 100)
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
          <h3>{isAlbanian ? `Rregullo Notën — ${studentData.student?.name}` : `Adjust Grade — ${studentData.student?.name}`}</h3>
          <p className="modal-subtitle">
            {isAlbanian
              ? 'Vendosni një përqindje të personalizuar përfundimtare për këtë nxënës ose rivendosni llogaritjen automatike.'
              : 'Set a custom final grade percentage for this student or reset to automated weight-based calculation.'}
          </p>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); onSave(Number(val)); }}>
          <div style={{
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            background: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 700 }}>
                {isAlbanian ? 'Llogaritja Automatike e Sistemit' : 'System Calculated Grade'}
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'hsl(var(--foreground))' }}>
                {studentData.calculatedPct !== null ? `${studentData.calculatedPct}%` : '—'}
              </div>
            </div>
            {studentData.isOverridden && (
              <span style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '8px',
                background: 'hsla(var(--mood-neutral), 0.2)',
                color: 'hsl(var(--mood-neutral))',
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase'
              }}>
                {isAlbanian ? 'E Rregulluar Manualisht' : 'Manually Overridden'}
              </span>
            )}
          </div>

          <div className="input-group">
            <label>{isAlbanian ? 'Përqindja Përfundimtare e Notës (%)' : 'Final Grade Percentage (%)'}</label>
            <input
              type="number"
              min="0"
              max="100"
              required
              value={val}
              onChange={e => setVal(e.target.value)}
              placeholder="0 - 100"
            />
          </div>

          <div className="modal-footer-actions" style={{ display: 'flex', justifyContent: 'space-between' }}>
            {studentData.isOverridden ? (
              <button type="button" className="btn-secondary" style={{ color: 'hsl(var(--destructive))' }} onClick={onReset}>
                <RotateCcw size={14} style={{ marginRight: '0.35rem' }} />
                {isAlbanian ? 'Rivendos Automatike' : 'Reset to Auto'}
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                {isAlbanian ? 'Anulo' : 'Cancel'}
              </button>
              <button type="submit" className="btn-primary">
                {isAlbanian ? 'Ruaj Notën' : 'Save Grade'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* Add Assignment Modal */
const AddAssignmentModal = ({ weights, categoryLabels, onSave, onClose }) => {
  const { isAlbanian } = useLanguage();
  const [form, setForm] = useState({ title: '', category: Object.keys(weights)[0] || 'Homework', totalPoints: 100, date: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try { await onSave(form); } catch (saveError) { setError(saveError.message || 'Could not create assignment.'); } finally { setSaving(false); }
  };
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
          <h3>{isAlbanian ? 'Shto Detyrë' : 'Add Assignment'}</h3>
          <p className="modal-subtitle">{isAlbanian ? 'Krijoni një detyrë ose testim për këtë klasë.' : 'Create a coursework item or examination for this class.'}</p>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>{isAlbanian ? 'Titulli' : 'Title'}</label>
            <input required placeholder={isAlbanian ? 'p.sh. Ushtrime Kapitulli 5' : 'e.g. Chapter 5 Practice'} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-grid-2">
            <div className="input-group">
              <label>{isAlbanian ? 'Kategoria' : 'Category'}</label>
              <select className="custom-form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {Object.keys(weights).map(c => <option key={c} value={c}>{getCategoryDisplayName(c, isAlbanian, categoryLabels)}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>{isAlbanian ? 'Pikët Totale' : 'Total Points'}</label>
              <input type="number" min="1" required value={form.totalPoints} onChange={e => setForm({ ...form, totalPoints: Number(e.target.value) })} />
            </div>
          </div>
          <div className="input-group">
            <label>{isAlbanian ? 'Data' : 'Date'}</label>
            <input type="text" placeholder={isAlbanian ? 'p.sh. 25 Mars, 2026' : 'e.g. Mar 25, 2026'} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          {error && <p role="alert" className="category-editor-error">{error}</p>}
          <div className="modal-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{isAlbanian ? 'Anulo' : 'Cancel'}</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? (isAlbanian ? 'Duke ruajtur…' : 'Saving…') : (isAlbanian ? 'Shto Detyrë' : 'Add Assignment')}</button>
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

const ClassOverview = ({ classData, onBack, onStudentSelect, userRole = 'student' }) => {
  const { updateStudent, rolePermissions, classGroups = [] } = useSchoolData();
  const { activeSchoolId } = useAuth();
  const { t, isAlbanian } = useLanguage();
  const canEditClass = userRole === 'admin' || ((userRole === 'teacher' || userRole === 'dept_head') && (rolePermissions?.teacher?.classes ?? true));
  const canManageEnrollment = canEditClass && (userRole === 'admin' || (rolePermissions?.teacher?.canEditDeleteStudents ?? true));

  const [activeTab, setActiveTab]         = useState('gradebook');
  const [assignments, setAssignments]     = useState([]);
  const [grades, setGrades]               = useState({});   // { studentId: { assignmentId: score } }
  const [weights, setWeights]             = useState(classData?.weights || INITIAL_WEIGHTS);
  const [categoryLabels, setCategoryLabels] = useState(classData?.categoryLabels || {});
  const [gradingSettings, setGradingSettings] = useState(() => ({
    homeworkMinusValue: classData?.gradingSettings?.homeworkMinusValue ?? 1,
    engagementPlusValue: classData?.gradingSettings?.engagementPlusValue ?? 1,
    engagementMinusValue: classData?.gradingSettings?.engagementMinusValue ?? 1
  }));
  const [curriculumStage, setCurriculumStage] = useState(classData?.curriculumStage || 'Shkalla III');
  const [studentTracking, setStudentTracking] = useState({});
  const [manualOverrideModal, setManualOverrideModal] = useState(null);
  const [materials, setMaterials]         = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [gradeModal, setGradeModal]       = useState(null); // assignment obj
  const [weightsModal, setWeightsModal]   = useState(false);
  const [addModal, setAddModal]           = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isMarkAttendanceOpen, setIsMarkAttendanceOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState(null);
  const [catFilter, setCatFilter]         = useState('All');
  const [searchQ, setSearchQ]             = useState('');
  const [studentSearchQ, setStudentSearchQ] = useState('');
  const [enrollSearch, setEnrollSearch] = useState('');

  // Sync props updates
  useEffect(() => {
    if (classData?.gradingSettings) {
      setGradingSettings({
        homeworkMinusValue: classData.gradingSettings.homeworkMinusValue ?? 1,
        engagementPlusValue: classData.gradingSettings.engagementPlusValue ?? 1,
        engagementMinusValue: classData.gradingSettings.engagementMinusValue ?? 1
      });
    }
    if (classData?.curriculumStage) {
      setCurriculumStage(classData.curriculumStage);
    }
    if (classData?.weights) {
      setWeights(classData.weights);
    }
    setCategoryLabels(classData?.categoryLabels || {});
  }, [classData]);

  // Students enrolled in this course: its linked class plus individually added students.
  const roster = useCourseRoster(activeSchoolId, classData);
  const students = roster.students;
  const groupsById = useMemo(() => classGroupsById(classGroups), [classGroups]);
  const linkedClass = classData?.classGroupId ? groupsById.get(String(classData.classGroupId)) : null;

  const gradebookStudents = useMemo(() => {
    const query = studentSearchQ.trim().toLocaleLowerCase();
    if (!query) return students;
    return students.filter(student => [student.name, student.studentId, student.email].some(value => String(value || '').toLocaleLowerCase().includes(query)));
  }, [students, studentSearchQ]);

  // Students to add come from a server-side search, never the whole school.
  const enrollResults = useStudentSearch(activeSchoolId, enrollSearch, { max: 30, enabled: isEnrollModalOpen });
  const availableStudentsToEnroll = enrollResults.results.filter(s => s.status !== 'archived' && !isStudentEnrolledInCourse(s, classData));

  // 1. Real-time listener for assignments
  useEffect(() => {
    if (!activeSchoolId || !classData?.id) return;
    const colRef = collection(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'assignments');
    const unsub = onSnapshot(colRef, (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
      setAssignments(items);
    }, (err) => console.warn('Assignments sync notice:', err.message));
    return () => unsub();
  }, [activeSchoolId, classData?.id]);

  // 2. Real-time listener for grades
  useEffect(() => {
    if (!activeSchoolId || !classData?.id) return;
    const colRef = collection(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'grades');
    const unsub = onSnapshot(colRef, (snapshot) => {
      const newGrades = {};
      snapshot.forEach(docSnap => {
        const assignId = docSnap.id;
        const data = docSnap.data();
        const scores = data.scores || {};
        Object.entries(scores).forEach(([sId, score]) => {
          if (!newGrades[sId]) newGrades[sId] = {};
          newGrades[sId][assignId] = score;
        });
      });
      setGrades(newGrades);
    }, (err) => console.warn('Grades sync notice:', err.message));
    return () => unsub();
  }, [activeSchoolId, classData?.id]);

  // 3. Real-time listener for student continuous tracking (homework minuses, engagement +/-, manual override)
  useEffect(() => {
    if (!activeSchoolId || !classData?.id) return;
    const colRef = collection(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'studentTracking');
    const unsub = onSnapshot(colRef, (snapshot) => {
      const items = {};
      snapshot.forEach(docSnap => {
        items[docSnap.id] = docSnap.data();
      });
      setStudentTracking(items);
    }, (err) => console.warn('StudentTracking sync notice:', err.message));
    return () => unsub();
  }, [activeSchoolId, classData?.id]);

  // 4. Real-time listener for materials
  useEffect(() => {
    if (!activeSchoolId || !classData?.id) return;
    const colRef = collection(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'materials');
    const unsub = onSnapshot(colRef, (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
      setMaterials(items);
    }, (err) => console.warn('Materials sync notice:', err.message));
    return () => unsub();
  }, [activeSchoolId, classData?.id]);

  // 5. Real-time listener for attendance
  useEffect(() => {
    if (!activeSchoolId || !classData?.id) return;
    const colRef = collection(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'attendance');
    const unsub = onSnapshot(colRef, (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
      setAttendanceRecords(items);
    }, (err) => console.warn('Attendance sync notice:', err.message));
    return () => unsub();
  }, [activeSchoolId, classData?.id]);

  const tabsList = [
    { id: 'dashboard',  label: t('nav.dashboard', 'Dashboard'),  icon: BarChart2     },
    { id: 'roster',     label: t('classes.roster', 'Roster'),        icon: Users         },
    { id: 'gradebook',  label: t('classes.gradebook', 'Gradebook'),  icon: BookMarked    },
    { id: 'materials',  label: t('classes.materials', 'Materials'),  icon: BookOpen      },
    { id: 'attendance', label: t('classes.attendance', 'Attendance'), icon: ClipboardList },
  ];

  const availableTabs = !canManageEnrollment
    ? tabsList.filter(t => t.id !== 'roster')
    : tabsList;

  /* Cloud operations */
  const saveGrades = async (assignmentId, localScores) => {
    if (!activeSchoolId || !classData?.id) throw new Error('No active school or class.');
    const assignment = assignments.find(item => item.id === assignmentId);
    if (!assignment) throw new Error('Assignment no longer exists.');
    const max = Number(assignment.totalPoints);
    if (Object.values(localScores).some(value => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > max))) throw new Error(`Scores must be between 0 and ${max}.`);
    const gradeDocRef = doc(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'grades', String(assignmentId));
    await setDoc(gradeDocRef, {
        assignmentId,
        scores: localScores,
        updatedAt: serverTimestamp()
    }, { merge: true });
    setGradeModal(null);
  };

  const saveGradingSettings = async ({ newWeights, newCategoryLabels, newGradingSettings, newCurriculumStage }) => {
    const validationError = validateCategoryWeights(newWeights, newCategoryLabels, assignments);
    if (validationError) throw new Error(validationError);
    if (!activeSchoolId || !classData?.id) throw new Error('No active school or class.');
    const classDocRef = doc(db, 'schools', activeSchoolId, 'classes', String(classData.id));
    await updateDoc(classDocRef, {
        weights: newWeights,
        categoryLabels: newCategoryLabels,
        gradingSettings: newGradingSettings,
        curriculumStage: newCurriculumStage
    });
    setWeights(newWeights);
    setCategoryLabels(newCategoryLabels);
    setGradingSettings(newGradingSettings);
    setCurriculumStage(newCurriculumStage);
    setWeightsModal(false);
  };

  const updateStudentTracking = async (studentId, changes) => {
    if (!activeSchoolId || !classData?.id || !studentId) return;
    setStudentTracking(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), ...changes }
    }));
    try {
      const docRef = doc(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'studentTracking', String(studentId));
      await setDoc(docRef, { ...changes, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.warn('Could not save student tracking:', err.message);
    }
  };

  const adjustHomeworkMinus = (studentId, delta) => {
    const current = Math.max(0, Number(studentTracking[studentId]?.missingHomework || 0));
    const next = Math.max(0, current + delta);
    updateStudentTracking(studentId, { missingHomework: next });
  };

  const adjustEngagementPlus = (studentId, delta) => {
    const current = Math.max(0, Number(studentTracking[studentId]?.engagementPluses || 0));
    const next = Math.max(0, current + delta);
    updateStudentTracking(studentId, { engagementPluses: next });
  };

  const adjustEngagementMinus = (studentId, delta) => {
    const current = Math.max(0, Number(studentTracking[studentId]?.engagementMinuses || 0));
    const next = Math.max(0, current + delta);
    updateStudentTracking(studentId, { engagementMinuses: next });
  };

  const addAssignment = async (form) => {
    if (!activeSchoolId || !classData?.id) throw new Error('No active school or class.');
    if (!Object.hasOwn(weights, form.category)) throw new Error('Choose an available category.');
    if (!form.title?.trim() || !Number.isFinite(Number(form.totalPoints)) || Number(form.totalPoints) <= 0) throw new Error('Enter a title and positive total points.');
    const assignId = `asg_${Date.now()}`;
    const next = {
      ...form,
      id: assignId,
      date: form.date || new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
      createdAt: serverTimestamp()
    };
    const assignRef = doc(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'assignments', assignId);
    await setDoc(assignRef, next);
    setAddModal(false);
  };

  const deleteAssignment = async (id) => {
    if (!activeSchoolId || !classData?.id) return;
    try {
      const assignRef = doc(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'assignments', String(id));
      await deleteDoc(assignRef);
    } catch (e) {
      console.warn('Could not delete assignment:', e.message);
    }
  };

  const enrollStudent = async (student) => {
    if (!student?.id) return;
    const currentClasses = normalizeAssignedCourseIds(student.assignedClasses, [classData]);
    if (!isStudentEnrolledInCourse(student, classData) || !currentClasses.includes(String(classData.id))) {
      await updateStudent(student.id, {
        assignedClasses: [...new Set([...currentClasses, String(classData.id)])]
      });
    }
  };

  const removeStudent = async (studentId) => {
    const student = students.find(s => s.id === studentId);
    if (!student || isEnrolledThroughClass(student, classData)) return;
    const nextClasses = normalizeAssignedCourseIds(student.assignedClasses, [classData])
      .filter(reference => !courseMatchesReference(classData, reference));
    await updateStudent(student.id, {
      assignedClasses: nextClasses
    });
  };

  const filteredAssignments = assignments
    .filter(a => catFilter === 'All' || a.category === catFilter)
    .filter(a => a.title.toLowerCase().includes(searchQ.toLowerCase()));

  const cats = ['All', ...new Set(assignments.map(a => a.category))];

  /* avg across all graded */
  const classOverallAvg = () => {
    const avgs = students.map(s => calcFinalGrade(s.id, assignments, grades, weights, studentTracking, gradingSettings)).filter(v => v !== null);
    if (!avgs.length) return null;
    return Math.round(avgs.reduce((a,b) => a+b,0) / avgs.length);
  };

  if (!classData) return null;

  return (
    <motion.div className="co-page" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>

      {/* ── Hero Header ── */}
      <div className="co-header glass" style={{ borderLeft: `5px solid hsl(var(${classData.color}))` }}>
        {/* Row 1: back + actions */}
        <div className="co-header-top">
          <button className="back-btn bouncy" onClick={onBack}>
            <ArrowLeft size={16} /> {t('classes.allClasses', 'All Courses')}
          </button>
          {canManageEnrollment && (
            <button className="btn-primary btn-sm" onClick={() => setIsEnrollModalOpen(true)}>
              <Plus size={15} /> {t('classes.enrollStudent', 'Enroll Student')}
            </button>
          )}
        </div>

        {/* Row 2: class identity */}
        <div className="co-header-identity">
          <div className="co-class-icon-wrap" style={{ background: `hsl(var(${classData.color}) / 0.18)` }}>
            <BookOpen size={28} color={`hsl(var(${classData.color}))`} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <h2 className="co-class-name">{classData.name}</h2>
              {curriculumStage && (
                <span className="co-curriculum-badge" title={isAlbanian ? 'Shkalla e Kurrikulës' : 'Curriculum Stage'}>
                  🏷️ {curriculumStage}
                </span>
              )}
            </div>
            <p className="co-meta">{classData.code} &nbsp;·&nbsp; {classData.teacher} {classData.room ? `· ${classData.room}` : ''}</p>
          </div>
        </div>

        {/* Row 3: stat pills */}
        <div className="co-header-stats">
          <div className="co-stat-pill" style={{ borderColor: `hsl(var(--chart-4) / 0.3)`, background: `hsl(var(--chart-4) / 0.13)` }}>
            <span style={{ color: 'hsl(var(--chart-4))' }}>{t('classes.students', 'Students')}</span>
            <strong style={{ color: 'hsl(var(--chart-4))' }}>{students.length}</strong>
          </div>
          <div className="co-stat-pill" style={{ borderColor: `hsl(var(--chart-2) / 0.3)`, background: `hsl(var(--chart-2) / 0.13)` }}>
            <span style={{ color: 'hsl(var(--chart-2))' }}>{t('classes.progress', 'Progress')}</span>
            <strong style={{ color: 'hsl(var(--chart-2))' }}>{classData.progress}%</strong>
          </div>
          <div className="co-stat-pill" style={{ borderColor: `hsl(var(${classData.color}) / 0.3)`, background: `hsl(var(${classData.color}) / 0.13)` }}>
            <span style={{ color: `hsl(var(${classData.color}))` }}>{t('classes.classAvg', 'Class Avg')}</span>
            <strong style={{ color: `hsl(var(${classData.color}))` }}>
              {classOverallAvg() !== null ? `${classOverallAvg()}%` : '—'}
            </strong>
          </div>
          <div className="co-stat-pill" style={{ borderColor: `hsl(var(--chart-1) / 0.3)`, background: `hsl(var(--chart-1) / 0.13)` }}>
            <span style={{ color: 'hsl(var(--chart-1))' }}>{t('classes.assignments', 'Assignments')}</span>
            <strong style={{ color: 'hsl(var(--chart-1))' }}>{assignments.length}</strong>
          </div>
        </div>
      </div>

      {/* ── Horizontal Tabs ── */}
      <div className="co-tab-bar glass">
        {availableTabs.map(tab => {
          const Icon = tab.icon;
          const displayLabel = isAlbanian ? (
            tab.id === 'dashboard' ? 'Paneli' :
            tab.id === 'roster' ? 'Lista e Nxënësve' :
            tab.id === 'gradebook' ? 'Ditari i Notave' :
            tab.id === 'materials' ? 'Materialet' :
            tab.id === 'attendance' ? 'Pjesëmarrja' : tab.label
          ) : tab.label;
          return (
            <button
              key={tab.id}
              className={`co-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              {displayLabel}
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
                <h4>{t('classes.breakdown', 'Class Breakdown')}</h4>
                <div className="breakdown-list">
                  {['A','B','C','D','F'].map((letter, idx) => {
                    const count = students.filter(s => {
                      const pct = calcFinalGrade(s.id, assignments, grades, weights, studentTracking, gradingSettings);
                      return gradeLabel(pct, false) === letter || gradeLabel(pct, false).startsWith(letter);
                    }).length;
                    return (
                      <div key={letter} className="breakdown-row">
                        <span className="grade-badge" style={{ background: `hsl(var(--chart-${(idx % 5) + 1}) / 0.2)` }}>{letter}</span>
                        <div className="breakdown-bar-bg">
                          <div className="breakdown-bar" style={{ width: students.length ? `${(count/students.length)*100}%` : '0%', background: `hsl(var(--primary))` }} />
                        </div>
                        <span>{count} {isAlbanian ? 'nxënës' : (count !== 1 ? 'students' : 'student')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="co-widget glass">
                <h4>{t('classes.weights', 'Category Weights')}</h4>
                <div className="weights-list">
                  {Object.entries(weights).map(([cat, w]) => (
                    <div key={cat} className="weight-row">
                      <span className="type-badge">{getCategoryDisplayName(cat, isAlbanian, categoryLabels)}</span>
                      <div className="breakdown-bar-bg">
                        <div className="breakdown-bar" style={{ width: `${w}%`, background: `hsl(var(--accent))` }} />
                      </div>
                      <strong>{w}%</strong>
                    </div>
                  ))}
                </div>
                {canEditClass && (
                  <button className="btn-secondary glass btn-sm" style={{marginTop:'1rem'}} onClick={() => setWeightsModal(true)}>
                    <Settings size={14} /> {isAlbanian ? 'Cilësimet e Vlerësimit & Peshat' : 'Grading Settings & Weights'}
                  </button>
                )}
              </div>
              <div className="co-widget glass">
                <h4>{t('classes.topStudents', 'Top Students')}</h4>
                {students.slice().sort((a,b) => {
                  const pa = calcFinalGrade(a.id, assignments, grades, weights, studentTracking, gradingSettings) ?? -1;
                  const pb = calcFinalGrade(b.id, assignments, grades, weights, studentTracking, gradingSettings) ?? -1;
                  return pb - pa;
                }).map((s,i) => {
                  const pct = calcFinalGrade(s.id, assignments, grades, weights, studentTracking, gradingSettings);
                  return (
                    <div key={s.id} className="top-student-row">
                      <span className="rank-badge">#{i+1}</span>
                      <Avatar name={s.name} size={32} />
                      <span className="flex-1">{s.name}</span>
                      <strong style={{ color: gradeColor(pct) }}>{pct !== null ? `${pct}%` : '—'} ({gradeLabel(pct, isAlbanian)})</strong>
                    </div>
                  );
                })}
              </div>
              <div className="co-widget glass">
                <h4>{t('classes.quickStats', 'Quick Stats')}</h4>
                <div className="quick-stats">
                  <div className="qs-item">
                    <span>{t('classes.assignments', 'Assignments')}</span><strong>{assignments.length}</strong>
                  </div>
                  <div className="qs-item">
                    <span>{isAlbanian ? 'Të Vlerësuara' : 'Graded'}</span><strong>{assignments.filter(a => students.some(s => grades[s.id]?.[a.id] !== undefined)).length}</strong>
                  </div>
                  <div className="qs-item">
                    <span>{t('classes.classAvg', 'Class Avg')}</span><strong style={{ color: gradeColor(classOverallAvg()) }}>{classOverallAvg() !== null ? `${classOverallAvg()}%` : '—'}</strong>
                  </div>
                  <div className="qs-item">
                    <span>{isAlbanian ? 'Nota' : 'Letter'}</span><strong style={{ color: gradeColor(classOverallAvg()) }}>{gradeLabel(classOverallAvg())}</strong>
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
              <h3>{t('classes.roster', 'Student Roster')}</h3>
              {canManageEnrollment && <button className="btn-primary btn-sm" onClick={() => setIsEnrollModalOpen(true)}><Plus size={16}/> {t('classes.enrollStudent', 'Add Student')}</button>}
            </div>
            {linkedClass && (
              <p className="co-roster-note">{isAlbanian
                ? `Të gjithë nxënësit e klasës ${linkedClass.label} janë të regjistruar automatikisht. Mund të shtoni edhe nxënës nga klasa të tjera.`
                : `Every student of class ${linkedClass.label} is enrolled automatically. You can also add students from other classes.`}</p>
            )}
            <div className="co-table glass">
              <table>
                <thead>
                  <tr>
                    <th>{t('leaderboard.student', 'Student')}</th><th>{t('staff.email', 'Email')}</th><th>{t('classes.finalGrade', 'Final Grade')}</th><th>{isAlbanian ? 'Nota' : 'Letter'}</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {students.map(s => {
                      const pct = calcFinalGrade(s.id, assignments, grades, weights);
                      return (
                        <motion.tr key={s.id} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} layout
                          style={{ cursor: 'pointer' }}
                          onClick={() => onStudentSelect && onStudentSelect(s)}
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
                            {isEnrolledThroughClass(s, classData) ? (
                              <span className="co-via-class" title={isAlbanian ? `Regjistruar përmes klasës ${linkedClass?.label || ''}. Ndryshoni klasën e nxënësit për ta hequr.` : `Enrolled through class ${linkedClass?.label || ''}. Change the student's class to remove them.`}>
                                {isAlbanian ? 'Klasa' : 'Class'} {linkedClass?.label || ''}
                              </span>
                            ) : canManageEnrollment && (
                              <button 
                                type="button"
                                className="icon-btn-destructive" 
                                title={isAlbanian ? 'Hiq nga lista e lëndës' : 'Remove from course roster'}
                                aria-label={isAlbanian ? `Hiq ${s.name} nga lënda` : `Remove ${s.name} from course`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStudentToRemove(s);
                                }}
                              >
                                <UserMinus size={16}/>
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
              {students.length === 0 && <div className="empty-state"><AlertCircle size={28}/><p>{roster.loading ? (isAlbanian ? 'Po ngarkohen nxënësit…' : 'Loading students…') : roster.error ? (isAlbanian ? 'Nxënësit nuk mund të ngarkohen.' : 'Students could not be loaded.') : (isAlbanian ? 'Ende nuk ka nxënës të regjistruar.' : 'No students enrolled yet.')}</p></div>}
            </div>
          </motion.div>
        )}

        {/* ── GRADEBOOK ── */}
        {activeTab === 'gradebook' && (
          <motion.div key="gradebook" className="co-tab-content" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
            {/* Toolbar */}
            <div className="co-toolbar">
              <div>
                <h3 style={{ margin: 0 }}>
                  {!canEditClass
                    ? (isAlbanian ? 'Detyrat & Notat e Kursit' : 'Course Assignments & Grades') 
                    : (isAlbanian ? 'Ditari i Notave & Vlerësimi' : 'Gradebook & Assessment')}
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'hsl(var(--muted-foreground))' }}>
                  {isAlbanian 
                    ? 'Menaxhoni detyrat, mungesat e detyrave, angazhimin dhe shpërndarjen e notave.' 
                    : 'Manage coursework, missing homework, engagement, and final grade distribution.'}
                </p>
              </div>
              {canEditClass && (
                <div className="co-toolbar-actions">
                  <button className="btn-secondary glass btn-sm" onClick={() => setWeightsModal(true)}>
                    <Settings size={15}/> {isAlbanian ? 'Cilësimet e Vlerësimit & Peshat' : 'Grading Settings & Weights'}
                  </button>
                  <button className="btn-primary btn-sm" onClick={() => setAddModal(true)}>
                    <Plus size={15}/> {isAlbanian ? 'Shto Detyrë' : 'Add Assignment'}
                  </button>
                </div>
              )}
            </div>

            <div className="search-box glass gradebook-student-search"><span>🔍</span><input aria-label={isAlbanian ? 'Kërko nxënësin në ditarin e notave' : 'Search gradebook students'} placeholder={isAlbanian ? 'Kërko nxënësin sipas emrit, ID-së ose email-it…' : 'Find a student by name, ID, or email…'} value={studentSearchQ} onChange={e => setStudentSearchQ(e.target.value)} /></div>

            {/* ── 1. Continuous Assessment: Missing Homework & Engagement ── */}
            {students.length > 0 && (
              <div className="continuous-tracking-card glass">
                <div className="continuous-tracking-header">
                  <div className="ct-title-group">
                    <div className="ct-icon-badge">
                      <ClipboardList size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800 }}>
                        {isAlbanian ? 'Vlerësimi i Vazhdueshëm' : 'Continuous Assessment'}: {getCategoryDisplayName('Homework', isAlbanian, categoryLabels)} & {getCategoryDisplayName('Engagement', isAlbanian, categoryLabels)}
                      </h4>
                      <p className="ct-subtitle">
                        {isAlbanian
                          ? `${getCategoryDisplayName('Homework', true, categoryLabels)}: ${weights.Homework ?? 0}% e notës (-${gradingSettings.homeworkMinusValue}% për çdo minus) · ${getCategoryDisplayName('Engagement', true, categoryLabels)}: ${weights.Engagement ?? 0}% e notës (+${gradingSettings.engagementPlusValue}% për plus, -${gradingSettings.engagementMinusValue}% për minus)`
                          : `${getCategoryDisplayName('Homework', false, categoryLabels)}: ${weights.Homework ?? 0}% weight (-${gradingSettings.homeworkMinusValue}% per minus) · ${getCategoryDisplayName('Engagement', false, categoryLabels)}: ${weights.Engagement ?? 0}% weight (+${gradingSettings.engagementPlusValue}% per plus, -${gradingSettings.engagementMinusValue}% per minus)`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="co-table glass">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('leaderboard.student', 'Student')}</th>
                        <th>{isAlbanian ? `Detyrat e Munguara (-${gradingSettings.homeworkMinusValue}%)` : `Missing Homework (-${gradingSettings.homeworkMinusValue}%)`}</th>
                        <th>{isAlbanian ? 'Pikët e Detyrave' : 'Homework Score'}</th>
                        <th>{isAlbanian ? 'Angazhimi në Klasë (+ / -)' : 'Class Engagement (+ / -)'}</th>
                        <th>{isAlbanian ? 'Pikët e Angazhimit' : 'Engagement Score'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradebookStudents.map(s => {
                        const data = calcStudentGradeData(s.id, assignments, grades, weights, studentTracking, gradingSettings);
                        const canEdit = canEditClass;
                        return (
                          <tr key={s.id}>
                            <td>
                              <div className="student-cell">
                                <Avatar name={s.name} size={28} />
                                <span style={{ fontWeight: 600 }}>{s.name}</span>
                              </div>
                            </td>
                            {/* Missing Homework Column */}
                            <td>
                              <div className="tracker-counter-group">
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="counter-btn minus"
                                    disabled={data.missingHw <= 0}
                                    onClick={() => adjustHomeworkMinus(s.id, -1)}
                                    title={isAlbanian ? 'Hiq një minus' : 'Remove a minus'}
                                  >
                                    –
                                  </button>
                                )}
                                <span className={`tracker-badge ${data.missingHw > 0 ? 'badge-minus' : 'badge-clean'}`}>
                                  {data.missingHw} {data.missingHw === 1 ? (isAlbanian ? 'minus' : 'minus') : (isAlbanian ? 'minuse' : 'minuses')}
                                </span>
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="counter-btn plus"
                                    onClick={() => adjustHomeworkMinus(s.id, 1)}
                                    title={isAlbanian ? 'Shto minus për detyrë mangut' : 'Add minus for missing homework'}
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            </td>
                            {/* Homework Score */}
                            <td className="centered">
                              <span style={{ fontWeight: 700, color: data.catScores.Homework.pct < 70 ? 'hsl(var(--mood-sad))' : 'hsl(var(--mood-happy))' }}>
                                {data.catScores.Homework.earnedWeightPts.toFixed(1)} / {weights.Homework ?? 0}%
                                <span className="pts-pct-sub"> ({data.catScores.Homework.pct === null ? '—' : `${data.catScores.Homework.pct}%`})</span>
                              </span>
                            </td>
                            {/* Engagement Column */}
                            <td>
                              <div className="tracker-engagement-dual">
                                {/* Pluses */}
                                <div className="tracker-counter-group mini">
                                  <span className="tracker-label-tiny">{isAlbanian ? 'Plus:' : 'Plus:'}</span>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      className="counter-btn minus sm"
                                      disabled={data.engPluses <= 0}
                                      onClick={() => adjustEngagementPlus(s.id, -1)}
                                    >
                                      –
                                    </button>
                                  )}
                                  <span className="tracker-badge badge-plus">+{data.engPluses}</span>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      className="counter-btn plus sm"
                                      onClick={() => adjustEngagementPlus(s.id, 1)}
                                      title={isAlbanian ? 'Shto plus për aktivitet' : 'Add plus for engagement'}
                                    >
                                      +
                                    </button>
                                  )}
                                </div>

                                {/* Minuses */}
                                <div className="tracker-counter-group mini">
                                  <span className="tracker-label-tiny">{isAlbanian ? 'Minus:' : 'Minus:'}</span>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      className="counter-btn minus sm"
                                      disabled={data.engMinuses <= 0}
                                      onClick={() => adjustEngagementMinus(s.id, -1)}
                                    >
                                      –
                                    </button>
                                  )}
                                  <span className="tracker-badge badge-minus">-{data.engMinuses}</span>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      className="counter-btn plus sm"
                                      onClick={() => adjustEngagementMinus(s.id, 1)}
                                      title={isAlbanian ? 'Shto minus për mosangazhim' : 'Add minus for inattention'}
                                    >
                                      +
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                            {/* Engagement Score */}
                            <td className="centered">
                              <span style={{ fontWeight: 700, color: data.catScores.Engagement.pct < 60 ? 'hsl(var(--mood-sad))' : 'hsl(var(--mood-happy))' }}>
                                {data.catScores.Engagement.earnedWeightPts.toFixed(1)} / {weights.Engagement ?? 0}%
                                <span className="pts-pct-sub"> ({data.catScores.Engagement.pct === null ? '—' : `${data.catScores.Engagement.pct}%`})</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── 2. Coursework & Exams List ── */}
            <div className="assignments-section" style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, color: 'hsl(var(--foreground))', fontSize: '1rem', fontWeight: 800 }}>
                  {isAlbanian ? 'Detyrat & Testimet e Kursit' : 'Assignments & Examinations'}
                </h4>
              </div>

              {/* Filters */}
              <div className="co-filters">
                <div className="search-box glass">
                  <span>🔍</span>
                  <input placeholder={isAlbanian ? 'Kërko detyrat…' : 'Search assignments…'} value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                </div>
                <div className="cat-pills">
                  {cats.map(c => (
                    <button key={c} className={`cat-pill ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>
                      {c === 'All' ? (isAlbanian ? 'Të Gjitha' : 'All') : getCategoryDisplayName(c, isAlbanian, categoryLabels)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="co-table glass">
                <table>
                  <thead>
                    <tr>
                      <th>{isAlbanian ? 'Emri' : 'Name'}</th>
                      <th>{isAlbanian ? 'Kategoria' : 'Category'}</th>
                      <th>{t('common.date', 'Date')}</th>
                      <th>{isAlbanian ? 'Pikët Totale' : 'Total Pts'}</th>
                      <th>{t('classes.classAvg', 'Class Avg')}</th>
                      <th>{!canEditClass ? t('common.status', 'Status') : t('common.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredAssignments.map(a => {
                        const avg = calcClassAvg(a.id, grades, students);
                        return (
                          <motion.tr key={a.id} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} layout>
                            <td><strong>{a.title}</strong></td>
                            <td><span className="type-badge">{getCategoryDisplayName(a.category, isAlbanian, categoryLabels)}</span></td>
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
                              {!canEditClass ? (
                                <span style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '0.35rem', 
                                  padding: '0.3rem 0.7rem', 
                                  borderRadius: '8px', 
                                  fontSize: '0.78rem', 
                                  fontWeight: 700, 
                                  background: 'hsla(var(--mood-happy), 0.15)', 
                                  color: 'hsl(var(--mood-happy))' 
                                }}>
                                  <CheckCircle2 size={13} /> {isAlbanian ? 'E Vlerësuar' : 'Graded'}
                                </span>
                              ) : (
                                <>
                                  <button className="btn-grade glass bouncy" onClick={() => setGradeModal(a)}>
                                    <Edit size={14} /> {isAlbanian ? 'Vlerëso' : 'Grade'}
                                  </button>
                                  <button className="icon-btn-destructive" onClick={() => deleteAssignment(a.id)}>
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
                {filteredAssignments.length === 0 && (
                  <div className="empty-state">
                    <AlertCircle size={28}/>
                    <p>{isAlbanian ? 'Nuk u gjet asnjë detyrë.' : 'No assignments found.'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── 3. Per-student final grade distribution & summary ── */}
            {students.length > 0 && (
              <div className="grade-summary-section" style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: 'hsl(var(--foreground))', fontSize: '1rem', fontWeight: 800 }}>
                    {isAlbanian ? 'Notat Përfundimtare të Nxënësve' : 'Student Final Grades & Distribution'}
                  </h4>
                  {canEditClass && (
                    <span style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
                      💡 {isAlbanian ? 'Mësuesit mund të rregullojnë notën manualisht me butonin "Ndrysho".' : 'Teachers can manually override final scores with "Adjust".'}
                    </span>
                  )}
                </div>

                <div className="co-table glass">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('leaderboard.student', 'Student')}</th>
                        <th>{getCategoryDisplayName('Homework', isAlbanian, categoryLabels)} ({weights.Homework ?? 0}%)</th>
                        <th>{getCategoryDisplayName('Engagement', isAlbanian, categoryLabels)} ({weights.Engagement ?? 0}%)</th>
                        {Object.keys(weights).filter(c => c !== 'Homework' && c !== 'Engagement').map(cat => (
                          <th key={cat}>{getCategoryDisplayName(cat, isAlbanian, categoryLabels)} ({weights[cat]}%)</th>
                        ))}
                        <th>{isAlbanian ? 'Përfundimtare %' : 'Final %'}</th>
                        <th>{isAlbanian ? 'Nota' : 'Grade'}</th>
                        {canEditClass && <th>{isAlbanian ? 'Rregullim' : 'Override'}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {gradebookStudents.map(s => {
                        const data = calcStudentGradeData(s.id, assignments, grades, weights, studentTracking, gradingSettings);
                        const pct = data.finalPct;
                        return (
                          <tr key={s.id}>
                            <td>
                              <div className="student-cell">
                                <Avatar name={s.name} size={28} />
                                <span style={{ fontWeight: 600 }}>{s.name}</span>
                              </div>
                            </td>
                            {/* Homework */}
                            <td className="centered">
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{ fontWeight: 700 }}>{data.catScores.Homework.pct === null ? '—' : `${data.catScores.Homework.pct}%`}</span>
                                <small className="muted" style={{ fontSize: '0.72rem' }}>
                                  {data.missingHw > 0 ? `-${data.missingHw} min` : (isAlbanian ? 'E plotë' : 'Full')}
                                </small>
                              </div>
                            </td>
                            {/* Engagement */}
                            <td className="centered">
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{ fontWeight: 700 }}>{data.catScores.Engagement.pct === null ? '—' : `${data.catScores.Engagement.pct}%`}</span>
                                <small className="muted" style={{ fontSize: '0.72rem' }}>
                                  +{data.engPluses} / -{data.engMinuses}
                                </small>
                              </div>
                            </td>
                            {/* Other categories */}
                            {Object.keys(weights).filter(c => c !== 'Homework' && c !== 'Engagement').map(cat => (
                              <td key={cat} className="centered muted">
                                {data.catScores[cat]?.pct !== null ? `${data.catScores[cat]?.pct}%` : '—'}
                              </td>
                            ))}
                            {/* Final % */}
                            <td className="centered">
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <strong style={{ color: gradeColor(pct), fontSize: '1.05rem' }}>
                                  {pct !== null ? `${pct}%` : '—'}
                                </strong>
                                {data.isOverridden && (
                                  <span className="override-badge-pill" title={isAlbanian ? 'Notë e vendosur manualisht nga mësuesi' : 'Manually overridden by teacher'}>
                                    {isAlbanian ? 'Manual' : 'Manual'}
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Letter grade */}
                            <td className="centered">
                              <span className="grade-badge" style={{ color: gradeColor(pct), border: `1px solid ${gradeColor(pct)}33` }}>
                                {gradeLabel(pct, isAlbanian)}
                              </span>
                            </td>
                            {/* Override Action */}
                            {canEditClass && (
                              <td className="actions-cell">
                                <button
                                  type="button"
                                  className="btn-grade glass bouncy"
                                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                                  onClick={() => setManualOverrideModal({ student: s, ...data })}
                                  title={isAlbanian ? 'Rregullo notën përfundimtare manualisht' : 'Manually adjust final grade'}
                                >
                                  <Edit size={13} /> {isAlbanian ? 'Ndrysho' : 'Adjust'}
                                </button>
                              </td>
                            )}
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
            <div className="co-toolbar">
              <h3>{t('classes.materials', 'Course Materials')}</h3>
              {canEditClass && (
                <button className="btn-primary btn-sm" onClick={() => setIsAddMaterialOpen(true)}>
                  <Plus size={15}/> {t('classes.addMaterial', 'Add Material')}
                </button>
              )}
            </div>
            {materials.length > 0 ? (
              <div className="materials-grid">
                {materials.map((m) => (
                  <div key={m.id} className="material-card glass bouncy">
                    <div className="material-icon"><BookOpen size={32} color={`hsl(var(${classData.color}))`} /></div>
                    <h4>{m.title}</h4>
                    <span className="material-type">{m.type || 'PDF'}</span>
                    <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>{m.date || ''}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', width: '100%', justifyContent: 'space-between' }}>
                      {safeWebLink(m.url) ? (
                        <a href={safeWebLink(m.url)} target="_blank" rel="noopener noreferrer" className="btn-secondary glass btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <ExternalLink size={14} /> {isAlbanian ? 'Hap' : 'Open'}
                        </a>
                      ) : <span />}
                      {canEditClass && (
                        <button 
                          className="icon-btn-destructive" 
                          style={{ padding: '0.35rem' }} 
                          title="Delete material"
                          onClick={async () => {
                            if (!activeSchoolId) return;
                            await deleteDoc(doc(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'materials', String(m.id)));
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <BookOpen size={28} />
                <p>{isAlbanian ? 'Ende nuk ka materiale të ngarkuara për këtë kurs.' : 'No materials uploaded for this course yet.'}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── ATTENDANCE ── */}
        {activeTab === 'attendance' && (
          <motion.div key="attendance" className="co-tab-content" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
            <div className="co-toolbar">
              <h3>{t('classes.attendance', 'Attendance Roll Call')}</h3>
              {canEditClass && (
                <button className="btn-primary btn-sm" onClick={() => setIsMarkAttendanceOpen(true)}>
                  <Plus size={15}/> {isAlbanian ? 'Bëj Regjistrimin' : 'Take Roll Call'}
                </button>
              )}
            </div>
            {attendanceRecords.length > 0 ? (
              <div className="co-table glass">
                <table>
                  <thead>
                    <tr>
                      <th>{t('common.date', 'Date')}</th>
                      <th>{isAlbanian ? 'Gjithsej Nxënës' : 'Class Roster Count'}</th>
                      <th>{isAlbanian ? 'Prezent' : 'Present'}</th>
                      <th>{isAlbanian ? 'Mungesë' : 'Absent'}</th>
                      <th>{isAlbanian ? 'Përqindja Ditore' : 'Daily Attendance'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map(rec => {
                      const recs = rec.records || {};
                      const total = Object.keys(recs).length || students.length || 1;
                      const present = Object.values(recs).filter(st => st === 'present').length;
                      const rate = Math.round((present / total) * 100);
                      return (
                        <tr key={rec.id}>
                          <td><strong>{rec.date}</strong></td>
                          <td className="centered">{total}</td>
                          <td className="centered" style={{ color: 'hsl(var(--mood-happy))' }}>{present}</td>
                          <td className="centered" style={{ color: 'hsl(var(--mood-sad))' }}>{total - present}</td>
                          <td className="centered">
                            <strong style={{ color: rate >= 80 ? 'hsl(var(--mood-happy))' : 'hsl(var(--mood-sad))' }}>
                              {rate}%
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <ClipboardList size={28} />
                <p>{isAlbanian ? 'Ende nuk është regjistruar vijueshmëria për këtë kurs.' : 'No attendance recorded for this class yet.'}</p>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {gradeModal   && <GradeModal assignment={gradeModal} students={students} grades={grades} categoryLabels={categoryLabels} onSave={saveGrades} onClose={() => setGradeModal(null)} />}
        {weightsModal && (
          <GradingSettingsModal 
            weights={weights} 
            categoryLabels={categoryLabels}
            assignments={assignments}
            gradingSettings={gradingSettings} 
            curriculumStage={curriculumStage} 
            onSave={saveGradingSettings} 
            onClose={() => setWeightsModal(false)} 
          />
        )}
        {manualOverrideModal && (
          <ManualOverrideModal
            studentData={manualOverrideModal}
            onSave={(val) => {
              updateStudentTracking(manualOverrideModal.student.id, { manualOverridePct: val });
              setManualOverrideModal(null);
            }}
            onReset={() => {
              updateStudentTracking(manualOverrideModal.student.id, { manualOverridePct: null });
              setManualOverrideModal(null);
            }}
            onClose={() => setManualOverrideModal(null)}
          />
        )}
        {addModal     && <AddAssignmentModal weights={weights} categoryLabels={categoryLabels} onSave={addAssignment} onClose={() => setAddModal(false)} />}

        {/* Enroll Student Modal */}
        {isEnrollModalOpen && (
          <div className="modal-overlay" onClick={() => { setIsEnrollModalOpen(false); setEnrollSearch(''); }}>
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? `Regjistro Nxënës në ${classData.name}` : `Enroll Students in ${classData.name}`}</h3>
                <p className="modal-subtitle">{isAlbanian ? 'Zgjidhni nxënës nga lista e shkollës për t\'i shtuar në këtë lëndë.' : 'Select students from the school directory to add to this course roster.'}</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsEnrollModalOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <div className="modal-form">
                {linkedClass && (
                  <p className="co-roster-note">{isAlbanian
                    ? `Nxënësit e klasës ${linkedClass.label} janë tashmë të regjistruar. Kërkoni për të shtuar nxënës të tjerë.`
                    : `Students of class ${linkedClass.label} are already enrolled. Search to add other students.`}</p>
                )}
                <div className="input-group">
                  <label htmlFor="co-enroll-search">{isAlbanian ? 'Kërko nxënës' : 'Search students'}</label>
                  <input id="co-enroll-search" type="text" autoFocus value={enrollSearch} onChange={e => setEnrollSearch(e.target.value)}
                    placeholder={isAlbanian ? 'Emri, email-i ose ID e nxënësit…' : 'Student name, email or ID…'} />
                </div>
                {!enrollResults.active ? (
                  <p className="co-roster-note">{isAlbanian ? 'Shkruani emrin, email-in ose ID-në për të gjetur nxënës.' : 'Type a name, email or ID to find students.'}</p>
                ) : enrollResults.loading ? (
                  <p className="co-roster-note">{isAlbanian ? 'Duke kërkuar…' : 'Searching…'}</p>
                ) : enrollResults.error ? (
                  <p className="co-roster-note is-error">{isAlbanian ? 'Kërkimi dështoi. Provoni sërish.' : 'Search failed. Try again.'}</p>
                ) : availableStudentsToEnroll.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {availableStudentsToEnroll.map(student => (
                      <div 
                        key={student.id} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          background: 'hsla(var(--background), 0.6)',
                          borderRadius: '12px',
                          border: '1px solid hsla(var(--border), 0.6)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar name={student.name} size={32} />
                          <div>
                            <strong style={{ fontSize: '0.9rem', display: 'block' }}>{student.name}</strong>
                            <small style={{ color: 'hsl(var(--muted-foreground))' }}>{[studentClassLabel(student, groupsById) && `${isAlbanian ? 'Klasa' : 'Class'} ${studentClassLabel(student, groupsById)}`, student.email].filter(Boolean).join(' · ')}</small>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={async () => {
                            await enrollStudent(student);
                          }}
                        >
                          <Plus size={14} /> {isAlbanian ? 'Regjistro' : 'Enroll'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <CheckCircle2 size={28} style={{ color: 'hsl(var(--mood-happy))' }} />
                    <p>{isAlbanian ? 'Asnjë nxënës i paregjistruar nuk përputhet me kërkimin.' : 'No unenrolled students match this search.'}</p>
                  </div>
                )}
                {enrollResults.capped && <p className="co-roster-note">{isAlbanian ? "Po shfaqen rezultatet e para. Shkruani më shumë për t'i ngushtuar." : 'Showing the first matches. Type more to narrow them down.'}</p>}
              </div>
              <div className="modal-footer-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsEnrollModalOpen(false)}>
                  {isAlbanian ? 'Mbyll' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Material Modal */}
        {isAddMaterialOpen && (
          <div className="modal-overlay" onClick={() => setIsAddMaterialOpen(false)}>
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Ngarko Material Mësimor' : 'Add Course Material'}</h3>
                <p className="modal-subtitle">{isAlbanian ? 'Ndani dokumente reference, prezantime leksionesh, apo linqe studimi me këtë klasë.' : 'Share reference documents, lecture slides, or study links with this class.'}</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddMaterialOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <form 
                className="modal-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target;
                  const title = form.matTitle.value.trim();
                  const type = form.matType.value;
                  const link = normalizeWebLink(form.matUrl.value);
                  if (link.error) {
                    form.matUrl.setCustomValidity(isAlbanian ? 'Shkruani një lidhje interneti, p.sh. https://drive.google.com/…' : 'Enter a web link, for example https://drive.google.com/…');
                    form.matUrl.reportValidity();
                    return;
                  }
                  const url = link.url;
                  if (!title || !activeSchoolId) return;
                  const matId = `mat_${Date.now()}`;
                  await setDoc(doc(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'materials', matId), {
                    id: matId,
                    title,
                    type,
                    url,
                    date: new Date().toLocaleDateString(isAlbanian ? 'sq-AL' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    createdAt: serverTimestamp()
                  });
                  setIsAddMaterialOpen(false);
                }}
              >
                <div className="input-group">
                  <label>{isAlbanian ? 'Titulli i Dokumentit' : 'Document Title'}</label>
                  <input name="matTitle" required placeholder={isAlbanian ? 'p.sh. Kapitulli 4 Prezantimi & Shënimet' : 'e.g. Chapter 4 Slides & Lecture Notes'} />
                </div>
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Lloji i Materialit' : 'Resource Type'}</label>
                    <select name="matType" className="custom-form-select">
                      <option value="PDF">{isAlbanian ? 'Dokument PDF' : 'PDF Document'}</option>
                      <option value="Slides">{isAlbanian ? 'Prezantim / Sllajde' : 'Slides / Presentation'}</option>
                      <option value="Doc">{isAlbanian ? 'Dokument Word / Tekst' : 'Word / Text Document'}</option>
                      <option value="Link">{isAlbanian ? 'Vegëz e Jashtme Web' : 'External Web Resource / URL'}</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>{isAlbanian ? 'Vegëz / URL e Materialit (Opsionale)' : 'Resource Link / URL (Optional)'}</label>
                    <input name="matUrl" placeholder="https://example.com/material.pdf" onInput={e => e.currentTarget.setCustomValidity('')} />
                  </div>
                </div>
                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddMaterialOpen(false)}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary">
                    {isAlbanian ? 'Ngarko Materialin' : 'Upload Material'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Mark Attendance Modal */}
        {isMarkAttendanceOpen && (
          <div className="modal-overlay" onClick={() => setIsMarkAttendanceOpen(false)}>
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Regjistri Ditor' : 'Take Roll Call'} — {new Date().toLocaleDateString(isAlbanian ? 'sq-AL' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
                <p className="modal-subtitle">{isAlbanian ? `Shënoni pjesëmarrjen ditore për nxënësit e regjistruar në ${classData.name}.` : `Mark daily attendance for students enrolled in ${classData.name}.`}</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsMarkAttendanceOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <form
                className="modal-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!activeSchoolId) return;
                  const formData = new FormData(e.target);
                  const records = {};
                  students.forEach(s => {
                    records[s.id] = formData.get(`att_${s.id}`) || 'present';
                  });
                  const today = new Date().toISOString().split('T')[0];
                  await setDoc(doc(db, 'schools', activeSchoolId, 'classes', String(classData.id), 'attendance', today), {
                    id: today,
                    date: today,
                    records,
                    recordedAt: serverTimestamp()
                  });
                  setIsMarkAttendanceOpen(false);
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '55vh', overflowY: 'auto' }}>
                  {students.map(s => (
                    <div 
                      key={s.id} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: 'hsla(var(--background), 0.6)',
                        borderRadius: '12px',
                        border: '1px solid hsla(var(--border), 0.6)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar name={s.name} size={30} />
                        <strong>{s.name}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'hsl(var(--mood-happy))' }}>
                          <input type="radio" name={`att_${s.id}`} value="present" defaultChecked /> {isAlbanian ? 'Prezent' : 'Present'}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'hsl(var(--mood-sad))' }}>
                          <input type="radio" name={`att_${s.id}`} value="absent" /> {isAlbanian ? 'Mungesë' : 'Absent'}
                        </label>
                      </div>
                    </div>
                  ))}
                  {students.length === 0 && (
                    <div className="empty-state">
                      <AlertCircle size={24} />
                      <p>{isAlbanian ? 'Ende nuk ka nxënës të regjistruar. Regjistroni nxënës së pari për të marrë pjesëmarrjen.' : 'No students enrolled yet. Enroll students first to take roll call.'}</p>
                    </div>
                  )}
                </div>
                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsMarkAttendanceOpen(false)}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary" disabled={students.length === 0}>
                    {isAlbanian ? 'Ruaj Regjistrin' : 'Save Roll Call'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

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
                    <h3>{isAlbanian ? 'Çregjistro nga Lista e Kursit?' : 'Remove from Class Roster?'}</h3>
                    <p className="modal-subtitle">{isAlbanian ? 'Konfirmimi i çregjistrimit nga kursi' : 'Class enrollment removal confirmation'}</p>
                  </div>
                </div>
                <button type="button" className="icon-btn-close" onClick={() => setStudentToRemove(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <div className="delete-modal-body">
                <p>
                  {isAlbanian ? <>A jeni të sigurt që dëshironi të hiqni <strong>{studentToRemove.name}</strong> nga <strong>{classData.name}</strong>?</> : <>Are you sure you want to remove <strong>{studentToRemove.name}</strong> from <strong>{classData.name}</strong>?</>}
                </p>
                <div className="roster-notice-callout">
                  <CheckCircle2 size={16} />
                  <span>{isAlbanian ? 'Ky nxënës do të çregjistrohet vetëm nga ky kurs. Profili, të dhënat dhe historiku i tij mbeten të sigurt në Drejtorinë e Shkollës.' : 'This student will only be unenrolled from this specific class roster. Their master profile, records, and data will remain safe and active in the school Students Directory.'}</span>
                </div>
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-secondary" onClick={() => setStudentToRemove(null)}>
                  {isAlbanian ? 'Anulo' : 'Cancel'}
                </button>
                <button 
                  type="button" 
                  className="btn-destructive-solid" 
                  onClick={() => {
                    removeStudent(studentToRemove.id);
                    setStudentToRemove(null);
                  }}
                >
                  <UserMinus size={14} /> {isAlbanian ? 'Çregjistro nga Kursi' : 'Remove from Roster'}
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
