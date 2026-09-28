import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Mail, Phone, MapPin, Star, Trophy, BookOpen,
  CheckSquare, TrendingUp, Clock, Award, Heart, Zap, BarChart2,
  Calendar, AlertCircle, MessageSquare, Archive, ArchiveRestore,
  AlertTriangle
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { calcStudentGradeData, INITIAL_WEIGHTS } from '../features/gradebook/grading';
import { Avatar } from '../components/Avatar';
import { displayCourse, enrolledCoursesForStudent } from '../features/enrollment';
import { classGroupsById, hasValidClass, homeroomTeacherInfo, studentClassLabel } from '../features/classGroups';
import { useStudentRecord } from '../features/students/studentData';
import './StudentOverview.css';

/* ─── Grade helpers ────────────────────────────────────── */
const gradeColor = (pct) => {
  if (pct === null || pct === undefined) return 'hsl(var(--muted-foreground))';
  if (pct >= 80) return 'hsl(var(--mood-happy))';
  if (pct >= 60) return 'hsl(var(--mood-neutral))';
  return 'hsl(var(--mood-sad))';
};

const gradeLabel = (pct) => {
  if (pct === null || pct === undefined) return '—';
  if (pct >= 93) return 'A'; if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+'; if (pct >= 83) return 'B'; if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+'; if (pct >= 73) return 'C'; if (pct >= 70) return 'C-';
  if (pct >= 60) return 'D'; return 'F';
};

/* ─── Dynamic Student Data ──────────────────────── */
const buildStudentData = (student) => ({
  recentActivity: student?.recentActivity || [],
  badges: student?.badges || [],
});

const TABS = [
  { id: 'overview',     label: 'Overview',     icon: BarChart2  },
  { id: 'grades',       label: 'Grades',       icon: BookOpen   },
  { id: 'assignments',  label: 'Assignments',  icon: CheckSquare},
];

/* ─── Component ─────────────────────────────────────────── */
const StudentOverview = ({ student, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const { classesList, classesLoaded, classGroups = [], staffList = [], toggleArchiveStudent } = useSchoolData();
  const { activeSchoolId } = useAuth();
  const { t, isAlbanian } = useLanguage();
  // Live copy of this one record, so edits elsewhere show up immediately.
  const { student: freshStudent } = useStudentRecord(activeSchoolId, student?.id);
  const liveStudent = freshStudent || student;
  const groupsById = useMemo(() => classGroupsById(classGroups), [classGroups]);
  const studentId = liveStudent?.id;
  const enrolledClasses = useMemo(() => enrolledCoursesForStudent(liveStudent, classesList), [classesList, liveStudent]);
  const [courseRecords, setCourseRecords] = useState({});

  useEffect(() => {
    if (!activeSchoolId || !studentId) return undefined;
    const unsubscribers = enrolledClasses.flatMap(course => ['assignments', 'grades', 'studentTracking'].map(kind =>
      onSnapshot(collection(db, 'schools', activeSchoolId, 'classes', String(course.id), kind), snapshot => {
        const records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        const key = `${activeSchoolId}/${studentId}/${course.id}`;
        setCourseRecords(prev => ({ ...prev, [key]: { ...prev[key], [kind]: records } }));
      }, error => {
        console.warn(`Could not load ${kind} for student profile:`, error);
        const key = `${activeSchoolId}/${studentId}/${course.id}`;
        setCourseRecords(prev => ({ ...prev, [key]: { ...prev[key], [kind]: null, error: true } }));
      })
    ));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [activeSchoolId, studentId, enrolledClasses]);

  const courseSummary = useMemo(() => {
    const classes = [];
    const assignments = [];
    let earned = 0;
    let possible = 0;
    let loading = false;
    let error = false;
    for (const course of enrolledClasses) {
      const record = courseRecords[`${activeSchoolId}/${studentId}/${course.id}`];
      if (!record || record.assignments === undefined || record.grades === undefined || record.studentTracking === undefined) {
        loading = true;
        classes.push({ name: course.name, teacher: course.teacher || '—', grade: null });
        continue;
      }
      if (record.error) {
        error = true;
        classes.push({ name: course.name, teacher: course.teacher || '—', grade: null });
        continue;
      }
      const studentGrades = {};
      for (const grade of record.grades) {
        if (grade.scores?.[studentId] !== undefined) studentGrades[grade.id] = grade.scores[studentId];
      }
      const tracking = record.studentTracking.find(item => item.id === String(studentId));
      const grade = calcStudentGradeData(studentId, record.assignments, { [studentId]: studentGrades }, course.weights || INITIAL_WEIGHTS, { [studentId]: tracking }, course.gradingSettings).finalPct;
      classes.push({ name: course.name, teacher: course.teacher || '—', grade });
      for (const assignment of record.assignments) {
        const rawScore = studentGrades[assignment.id];
        const max = Number(assignment.totalPoints);
        const graded = rawScore !== undefined && rawScore !== null && rawScore !== '' && Number.isFinite(Number(rawScore)) && Number.isFinite(max) && max > 0;
        const score = graded ? Math.min(max, Math.max(0, Number(rawScore))) : null;
        if (graded) { earned += score; possible += max; }
        assignments.push({ title: assignment.title, due: assignment.date || '—', status: graded ? 'Submitted' : 'Not Started', score: graded ? `${score} / ${max}` : '—' });
      }
    }
    return { classes, assignments, earned, possible, loading, error };
  }, [activeSchoolId, enrolledClasses, courseRecords, studentId]);

  const tabs = [
    { id: 'overview',     label: t('student.overview', 'Overview'),         icon: BarChart2  },
    { id: 'grades',       label: t('student.grades', 'Grades'),             icon: BookOpen   },
    { id: 'assignments',  label: t('student.assignments', 'Assignments'),   icon: CheckSquare},
  ];

  if (!student) return null;

  // Retrieve freshest student record if present in Context
  const isArchived = liveStudent.status === 'archived';
  const isUnassigned = classesLoaded && !isArchived && enrolledClasses.length === 0;

  const data = { ...buildStudentData(liveStudent), ...courseSummary };

  return (
    <motion.div className="sov-page" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

      {/* ── Visual Feedback Banners ── */}
      {isArchived && (
        <div className="sov-status-banner archived glass">
          <div className="sov-banner-left">
            <Archive size={22} className="banner-icon-archived" />
            <div>
              <h4>{t('student.archivedRecord', 'Archived Student Record')}</h4>
              <p>{isAlbanian ? 'Ky nxënës është arkivuar dhe është joaktiv në listat aktuale të klasave.' : 'This student is archived and inactive in current class rosters.'}</p>
            </div>
          </div>
          <button 
            className="btn-secondary glass btn-sm"
            onClick={() => toggleArchiveStudent && toggleArchiveStudent(liveStudent)}
          >
            <ArchiveRestore size={14} /> {t('student.restoreStudent', 'Restore / Unarchive Student')}
          </button>
        </div>
      )}

      {isUnassigned && (
        <div className="sov-status-banner unassigned glass">
          <div className="sov-banner-left">
            <AlertTriangle size={22} className="banner-icon-unassigned" />
            <div>
              <h4>{t('student.activeStandingNoClasses', 'Active Standing · No Assigned Classes')}</h4>
              <p>{t('student.unassignedBanner', 'This student is in good standing in the school directory, but is not yet assigned to any active class schedule or curriculum courses.')}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero Card ── */}
      <div 
        className={`sov-hero glass ${isArchived ? 'is-archived-hero' : ''}`} 
        style={{ borderLeft: `5px solid ${isArchived ? 'hsl(var(--mood-neutral))' : 'hsl(var(--primary))'}` }}
      >
        {/* Top bar */}
        <div className="sov-hero-top">
          <button className="back-btn bouncy" onClick={onBack}>
            <ArrowLeft size={16} /> {t('student.allStudents', 'All Students')}
          </button>
          <div className="sov-hero-actions">
            {isArchived && (
              <span className="sov-badge-status archived">
                <Archive size={12} /> {t('student.archived', 'Archived')}
              </span>
            )}
            {isUnassigned && (
              <span className="sov-badge-status unassigned">
                <AlertTriangle size={12} /> {t('student.noActiveClasses', 'No Active Classes')}
              </span>
            )}
            <button className="btn-secondary glass btn-sm"><MessageSquare size={15} /> {t('student.message', 'Message')}</button>
            <button className="btn-primary btn-sm"><Mail size={15} /> {t('student.email', 'Email')}</button>
          </div>
        </div>

        {/* Identity */}
        <div className="sov-identity">
          <div className="sov-avatar-wrap">
            <Avatar alt={liveStudent.name} />
          </div>
          <div className="sov-identity-info">
            <div className="sov-name-row">
              <h2 className="sov-name">{liveStudent.name}</h2>
              <span className="sov-id-tag">{liveStudent.studentId || liveStudent.id}</span>
            </div>
            <p className="sov-sub">
              {studentClassLabel(liveStudent, groupsById)
                ? `${isAlbanian ? 'Klasa' : 'Class'} ${studentClassLabel(liveStudent, groupsById)}${hasValidClass(liveStudent, groupsById) ? '' : (isAlbanian ? ' (pa lidhje)' : ' (not linked)')}`
                : (isAlbanian ? 'Pa klasë' : 'No class')}
              {hasValidClass(liveStudent, groupsById) ? ` · ${isAlbanian ? 'Kujdestari' : 'Homeroom'}: ${homeroomTeacherInfo(groupsById.get(String(liveStudent.classGroupId)), staffList, isAlbanian).name}` : ''}
              {' • '}{classesLoaded ? enrolledClasses.length : '…'} {isAlbanian ? 'lëndë' : enrolledClasses.length === 1 ? 'course' : 'courses'}
            </p>
            <div className="sov-classes-pills">
              {!classesLoaded ? (
                <span className="sov-class-pill">{isAlbanian ? 'Po ngarkohen lëndët…' : 'Loading courses…'}</span>
              ) : enrolledClasses.length > 0 ? (
                enrolledClasses.map(course => (
                  <span key={course.id} className="sov-class-pill">
                    <BookOpen size={12} /> {displayCourse(course)}
                  </span>
                ))
              ) : (
                <span className="sov-class-pill unassigned">
                  <AlertTriangle size={12} /> {t('student.noActiveClasses', 'No Active Classes Enrolled')}
                </span>
              )}
            </div>
          </div>
          <div className="sov-contact-info">
            <div className="sov-contact-item"><Mail size={14} />{liveStudent.email || 'N/A'}</div>
            <div className="sov-contact-item"><Phone size={14} />{liveStudent.phone || 'N/A'}</div>
          </div>
        </div>

        {/* Stat Strip */}
        <div className="sov-stat-strip">
          <div className="sov-stat" style={{ borderColor: 'hsl(var(--primary)/0.35)', background: 'hsl(var(--primary)/0.12)' }}>
            <Star size={16} color="hsl(var(--primary))" />
            <span>{isAlbanian ? 'Pikë të vlerësuara' : 'Graded points'}</span>
            <strong style={{ color: 'hsl(var(--primary))' }}>{data.error ? '—' : data.loading ? '…' : `${data.earned} / ${data.possible}`}</strong>
          </div>
          <div className="sov-stat" style={{ borderColor: 'hsl(var(--accent)/0.35)', background: 'hsl(var(--accent)/0.12)' }}>
            <BookOpen size={16} color="hsl(var(--accent))" />
            <span>{t('student.enrolled', 'Enrolled')}</span>
            <strong style={{ color: 'hsl(var(--accent))' }}>{classesLoaded ? enrolledClasses.length : '…'} {isAlbanian ? 'Lëndë' : 'Classes'}</strong>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="co-tab-bar glass">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`co-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <motion.div key="overview" className="sov-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="sov-overview-grid">

              {/* Recent Activity */}
              <div className="sov-widget glass">
                <h4 className="widget-title">{t('student.recentActivity', 'Recent Activity')}</h4>
                <div className="activity-list">
                  {data.recentActivity.length === 0 ? (
                    <p style={{ padding: '1rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem', textAlign: 'center' }}>
                      {t('student.noRecentActivity', 'No recent activity recorded.')}
                    </p>
                  ) : (
                    data.recentActivity.map((a, i) => (
                      <motion.div key={i} className="activity-row" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                        <div className="activity-emoji">{a.emoji}</div>
                        <div className="activity-info">
                          <p>{a.text}</p>
                          <span>{a.time}</span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Guardian & Contact Details */}
              <div className="sov-widget glass">
                <h4 className="widget-title">{t('student.guardianDetails', 'Guardian & Contact Details')}</h4>
                <div className="sov-contact-card-info">
                  <div className="sov-detail-row">
                    <span className="sov-detail-label">{t('student.officialId', 'Official Student ID:')}</span>
                    <strong>{liveStudent.studentId || liveStudent.id}</strong>
                  </div>
                  <div className="sov-detail-row">
                    <span className="sov-detail-label">{t('student.guardian', 'Guardian:')}</span>
                    <strong>{liveStudent.guardian || (isAlbanian ? 'Prindi / Kujdestari Ligjor' : 'Primary Parent / Guardian')}</strong>
                  </div>
                  <div className="sov-detail-row">
                    <span className="sov-detail-label">{t('student.phone', 'Phone:')}</span>
                    <span>{liveStudent.phone || 'N/A'}</span>
                  </div>
                  <div className="sov-detail-row">
                    <span className="sov-detail-label">{t('student.emailLabel', 'Email:')}</span>
                    <span>{liveStudent.email || 'N/A'}</span>
                  </div>
                  <div className="sov-detail-row">
                    <span className="sov-detail-label">{t('student.standing', 'Standing:')}</span>
                    <span className={`status-pill-mini ${liveStudent.status === 'archived' ? 'archived' : 'active'}`}>
                      {liveStudent.status === 'archived' ? t('student.archived', 'Archived') : t('student.activeEnrolled', 'Active Enrolled')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grade Snapshot */}
              <div className="sov-widget glass">
                <h4 className="widget-title">{t('student.gradeSnapshot', 'Grade Snapshot')}</h4>
                <div className="grade-snap-list">
                  {!classesLoaded ? (
                    <p style={{ padding: '1rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem', textAlign: 'center' }}>
                      {isAlbanian ? 'Po ngarkohen lëndët…' : 'Loading courses…'}
                    </p>
                  ) : data.classes.length === 0 ? (
                    <p style={{ padding: '1rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem', textAlign: 'center' }}>
                      {t('student.noClassesEnrolled', 'No classes enrolled yet.')}
                    </p>
                  ) : (
                    data.classes.map((c, i) => (
                      <div key={i} className="grade-snap-row">
                        <span className="grade-snap-name">{c.name}</span>
                        <div className="grade-snap-bar-bg">
                          <div className="grade-snap-bar" style={{ width: `${c.grade ?? 0}%`, background: gradeColor(c.grade) }} />
                        </div>
                        <strong style={{ color: gradeColor(c.grade), minWidth: '36px', textAlign: 'right' }}>{c.grade === null ? '—' : `${c.grade}%`}</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* GRADES */}
        {activeTab === 'grades' && (
          <motion.div key="grades" className="sov-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="co-table glass">
              <table>
                <thead>
                  <tr>
                    <th>{t('student.class', 'Class')}</th>
                    <th>{t('student.teacher', 'Teacher')}</th>
                    <th>{t('student.gradePct', 'Grade %')}</th>
                    <th>{t('student.letter', 'Letter')}</th>
                    <th>{t('student.status', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {!classesLoaded ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>{isAlbanian ? 'Po ngarkohen lëndët…' : 'Loading courses…'}</td></tr>
                  ) : data.classes.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>
                        {t('student.noEnrolledGrades', 'No enrolled classes or course grades recorded.')}
                      </td>
                    </tr>
                  ) : (
                    data.classes.map((c, i) => (
                      <tr key={i}>
                        <td><strong>{c.name}</strong></td>
                        <td className="muted">{c.teacher}</td>
                        <td>
                          <div className="grade-bar-wrap">
                            <div className="mini-bar-bg">
                              <div className="mini-bar" style={{ width: `${c.grade ?? 0}%`, background: gradeColor(c.grade) }} />
                            </div>
                            <strong style={{ color: gradeColor(c.grade) }}>{c.grade === null ? '—' : `${c.grade}%`}</strong>
                          </div>
                        </td>
                        <td><span className="grade-badge" style={{ color: gradeColor(c.grade) }}>{gradeLabel(c.grade)}</span></td>
                        <td><span className="status-chip" style={{ color: gradeColor(c.grade) }}>{c.grade === null ? (isAlbanian ? 'Pa nota' : 'Not graded') : c.grade >= 70 ? t('student.passing', 'Passing') : t('student.atRisk', 'At Risk')}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ASSIGNMENTS */}
        {activeTab === 'assignments' && (
          <motion.div key="assignments" className="sov-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="co-table glass">
              <table>
                <thead>
                  <tr>
                    <th>{t('student.assignment', 'Assignment')}</th>
                    <th>{t('student.due', 'Due')}</th>
                    <th>{t('student.status', 'Status')}</th>
                    <th>{t('student.score', 'Score')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assignments.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>
                        {t('student.noAssignments', 'No assignments recorded for this student.')}
                      </td>
                    </tr>
                  ) : (
                    data.assignments.map((a, i) => {
                      const statusColors = {
                        'Submitted':   'hsl(var(--mood-happy))',
                        'In Progress': 'hsl(var(--mood-neutral))',
                        'Not Started': 'hsl(var(--muted-foreground))',
                      };
                      return (
                        <tr key={i}>
                          <td><strong>{a.title}</strong></td>
                          <td className="muted">{a.due}</td>
                          <td>
                            <span className="status-chip" style={{ background: `${statusColors[a.status] || 'hsl(var(--muted-foreground))'}22`, color: statusColors[a.status] || 'hsl(var(--muted-foreground))' }}>
                              {isAlbanian ? (a.status === 'Submitted' ? 'E Dorëzuar' : a.status === 'In Progress' ? 'Në Progres' : 'E Pa Filluar') : a.status}
                            </span>
                          </td>
                          <td><strong style={{ color: a.score ? gradeColor(parseInt(a.score)) : 'hsl(var(--muted-foreground))' }}>{a.score || '—'}</strong></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
};

export default StudentOverview;
