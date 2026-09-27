import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Mail, Phone, MapPin, Star, Trophy, BookOpen,
  CheckSquare, TrendingUp, Clock, Award, Heart, Zap, BarChart2,
  Calendar, AlertCircle, MessageSquare, Archive, ArchiveRestore,
  AlertTriangle
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from '../components/Avatar';
import './StudentOverview.css';

/* ─── Grade helpers ────────────────────────────────────── */
const gradeColor = (pct) => {
  if (pct >= 80) return 'hsl(var(--mood-happy))';
  if (pct >= 60) return 'hsl(var(--mood-neutral))';
  return 'hsl(var(--mood-sad))';
};

const gradeLabel = (pct) => {
  if (pct >= 93) return 'A'; if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+'; if (pct >= 83) return 'B'; if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+'; if (pct >= 73) return 'C'; if (pct >= 70) return 'C-';
  if (pct >= 60) return 'D'; return 'F';
};

/* ─── Dynamic Student Data ──────────────────────── */
const buildStudentData = (student) => ({
  gpa: student?.gpa || 0,
  attendance: student?.attendance || 100,
  rank: student?.rank || '—',
  streak: student?.streak || 0,
  classes: (student?.assignedClasses || []).map(cls => ({
    name: typeof cls === 'string' ? cls : cls.name,
    teacher: cls.teacher || 'Course Instructor',
    grade: cls.grade != null ? cls.grade : 100,
    code: cls.code || 'CLS-101'
  })),
  assignments: student?.assignments || [],
  recentActivity: student?.recentActivity || [],
  badges: student?.badges || [],
  weeklyAttendance: student?.weeklyAttendance || [1, 1, 1, 1, 1],
  weeklyHistory: student?.weeklyHistory || []
});

const TABS = [
  { id: 'overview',     label: 'Overview',     icon: BarChart2  },
  { id: 'grades',       label: 'Grades',       icon: BookOpen   },
  { id: 'assignments',  label: 'Assignments',  icon: CheckSquare},
  { id: 'attendance',   label: 'Attendance',   icon: Calendar   },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/* ─── Component ─────────────────────────────────────────── */
const StudentOverview = ({ student, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const { studentsList, toggleArchiveStudent } = useSchoolData();
  const { t, isAlbanian } = useLanguage();

  const tabs = [
    { id: 'overview',     label: t('student.overview', 'Overview'),         icon: BarChart2  },
    { id: 'grades',       label: t('student.grades', 'Grades'),             icon: BookOpen   },
    { id: 'assignments',  label: t('student.assignments', 'Assignments'),   icon: CheckSquare},
    { id: 'attendance',   label: t('student.attendance', 'Attendance'),     icon: Calendar   },
  ];

  const days = isAlbanian ? ['Hën', 'Mar', 'Mër', 'Enj', 'Pre'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  if (!student) return null;

  // Retrieve freshest student record if present in Context
  const liveStudent = studentsList.find(s => s.id === student.id) || student;
  const isArchived = liveStudent.status === 'archived';
  const isUnassigned = !isArchived && (!liveStudent.assignedClasses || liveStudent.assignedClasses.length === 0);

  const data = buildStudentData(liveStudent);

  return (
    <motion.div className="sov-page" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

      {/* ── Visual Feedback Banners ── */}
      {isArchived && (
        <div className="sov-status-banner archived glass">
          <div className="sov-banner-left">
            <Archive size={22} className="banner-icon-archived" />
            <div>
              <h4>{t('student.archivedRecord', 'Archived Student Record')}</h4>
              <p>{t('student.archivedBanner', 'This student is currently archived and marked as inactive in active rosters and attendance call sheets.')}</p>
            </div>
          </div>
          <button 
            className="btn-secondary glass btn-sm"
            onClick={() => toggleArchiveStudent && toggleArchiveStudent(liveStudent.id)}
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
              <span className="sov-id-tag">{liveStudent.studentId || `STU-${1000 + liveStudent.id}`}</span>
            </div>
            <p className="sov-sub">Grade {liveStudent.grade} • {liveStudent.assignedClasses?.length || 0} {t('student.classesAssigned', 'Classes Assigned')}</p>
            <div className="sov-classes-pills">
              {liveStudent.assignedClasses && liveStudent.assignedClasses.length > 0 ? (
                liveStudent.assignedClasses.map(cls => (
                  <span key={cls} className="sov-class-pill">
                    <BookOpen size={12} /> {cls}
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
            <span>{t('student.points', 'Points')}</span>
            <strong style={{ color: 'hsl(var(--primary))' }}>{liveStudent.points ?? 0}</strong>
          </div>
          <div className="sov-stat" style={{ borderColor: 'hsl(var(--chart-2)/0.35)', background: 'hsl(var(--chart-2)/0.12)' }}>
            <TrendingUp size={16} color="hsl(var(--chart-2))" />
            <span>{t('student.gpa', 'GPA')}</span>
            <strong style={{ color: 'hsl(var(--chart-2))' }}>{data.gpa}</strong>
          </div>
          <div className="sov-stat" style={{ borderColor: 'hsl(var(--mood-happy)/0.35)', background: 'hsl(var(--mood-happy)/0.12)' }}>
            <CheckSquare size={16} color="hsl(var(--mood-happy))" />
            <span>{t('student.attendance', 'Attendance')}</span>
            <strong style={{ color: 'hsl(var(--mood-happy))' }}>{data.attendance}%</strong>
          </div>
          <div className="sov-stat" style={{ borderColor: 'hsl(var(--chart-4)/0.35)', background: 'hsl(var(--chart-4)/0.12)' }}>
            <Trophy size={16} color="hsl(var(--chart-4))" />
            <span>{t('student.rank', 'Class Rank')}</span>
            <strong style={{ color: 'hsl(var(--chart-4))' }}>#{data.rank}</strong>
          </div>
          <div className="sov-stat" style={{ borderColor: 'hsl(var(--accent)/0.35)', background: 'hsl(var(--accent)/0.12)' }}>
            <BookOpen size={16} color="hsl(var(--accent))" />
            <span>{t('student.enrolled', 'Enrolled')}</span>
            <strong style={{ color: 'hsl(var(--accent))' }}>{liveStudent.assignedClasses?.length || 0} {isAlbanian ? 'Lëndë' : 'Classes'}</strong>
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
                    <strong>{liveStudent.studentId || `STU-${1000 + liveStudent.id}`}</strong>
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

              {/* Weekly Attendance mini-chart */}
              <div className="sov-widget glass">
                <h4 className="widget-title">{t('student.thisWeekAttendance', "This Week's Attendance")}</h4>
                <div className="week-attendance">
                  {days.map((d, i) => (
                    <div key={d} className="day-col">
                      <div className={`day-dot ${data.weeklyAttendance[i] ? 'present' : 'absent'}`} />
                      <span className="day-label">{d}</span>
                    </div>
                  ))}
                </div>
                <p className="attendance-note" style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                  {data.weeklyAttendance.filter(Boolean).length}/5 {t('student.daysPresentThisWeek', 'days present this week')}
                </p>
              </div>

              {/* Grade Snapshot */}
              <div className="sov-widget glass">
                <h4 className="widget-title">{t('student.gradeSnapshot', 'Grade Snapshot')}</h4>
                <div className="grade-snap-list">
                  {data.classes.length === 0 ? (
                    <p style={{ padding: '1rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem', textAlign: 'center' }}>
                      {t('student.noClassesEnrolled', 'No classes enrolled yet.')}
                    </p>
                  ) : (
                    data.classes.map((c, i) => (
                      <div key={i} className="grade-snap-row">
                        <span className="grade-snap-name">{c.name}</span>
                        <div className="grade-snap-bar-bg">
                          <div className="grade-snap-bar" style={{ width: `${c.grade}%`, background: gradeColor(c.grade) }} />
                        </div>
                        <strong style={{ color: gradeColor(c.grade), minWidth: '36px', textAlign: 'right' }}>{c.grade}%</strong>
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
                  {data.classes.length === 0 ? (
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
                              <div className="mini-bar" style={{ width: `${c.grade}%`, background: gradeColor(c.grade) }} />
                            </div>
                            <strong style={{ color: gradeColor(c.grade) }}>{c.grade}%</strong>
                          </div>
                        </td>
                        <td><span className="grade-badge" style={{ color: gradeColor(c.grade) }}>{gradeLabel(c.grade)}</span></td>
                        <td><span className="status-chip" style={{ background: `${gradeColor(c.grade)}22`, color: gradeColor(c.grade) }}>{c.grade >= 70 ? t('student.passing', 'Passing') : t('student.atRisk', 'At Risk')}</span></td>
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

        {/* ATTENDANCE */}
        {activeTab === 'attendance' && (
          <motion.div key="attendance" className="sov-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="sov-attendance-cards">
              <div className="att-stat-card glass">
                <div className="att-icon" style={{ background: 'hsl(var(--mood-happy)/0.15)' }}>
                  <CheckSquare size={28} color="hsl(var(--mood-happy))" />
                </div>
                <span>{t('student.totalPresent', 'Total Present')}</span>
                <strong style={{ color: 'hsl(var(--mood-happy))' }}>{liveStudent.presentDays || 0} {t('student.days', 'days')}</strong>
              </div>
              <div className="att-stat-card glass">
                <div className="att-icon" style={{ background: 'hsl(var(--mood-sad)/0.15)' }}>
                  <AlertCircle size={28} color="hsl(var(--mood-sad))" />
                </div>
                <span>{t('student.totalAbsent', 'Total Absent')}</span>
                <strong style={{ color: 'hsl(var(--mood-sad))' }}>{liveStudent.absentDays || 0} {t('student.days', 'days')}</strong>
              </div>
              <div className="att-stat-card glass">
                <div className="att-icon" style={{ background: 'hsl(var(--mood-neutral)/0.15)' }}>
                  <Clock size={28} color="hsl(var(--mood-neutral))" />
                </div>
                <span>{t('student.lateArrivals', 'Late Arrivals')}</span>
                <strong style={{ color: 'hsl(var(--mood-neutral))' }}>{liveStudent.lateDays || 0} {t('student.times', 'times')}</strong>
              </div>
              <div className="att-stat-card glass">
                <div className="att-icon" style={{ background: 'hsl(var(--chart-2)/0.15)' }}>
                  <TrendingUp size={28} color="hsl(var(--chart-2))" />
                </div>
                <span>{t('student.overallRate', 'Overall Rate')}</span>
                <strong style={{ color: 'hsl(var(--chart-2))' }}>{data.attendance}%</strong>
              </div>
            </div>
            <div className="co-table glass" style={{ marginTop: '1.25rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('student.week', 'Week')}</th>
                    <th>{days[0]}</th>
                    <th>{days[1]}</th>
                    <th>{days[2]}</th>
                    <th>{days[3]}</th>
                    <th>{days[4]}</th>
                    <th>{t('student.rate', 'Rate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weeklyHistory.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>
                        {t('student.noWeeklyHistory', 'No weekly attendance history logged yet.')}
                      </td>
                    </tr>
                  ) : (
                    data.weeklyHistory.map(([week,...daysHistory]) => {
                      const present = daysHistory.slice(0,5).filter(Boolean).length;
                      return (
                        <tr key={week}>
                          <td className="muted">{week}</td>
                          {daysHistory.slice(0,5).map((d, i2) => (
                            <td key={i2} className="centered">
                              <span style={{ fontSize: '1.25rem' }}>{d ? '✅' : '❌'}</span>
                            </td>
                          ))}
                          <td className="centered"><strong style={{ color: gradeColor(present/5*100) }}>{present}/5</strong></td>
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
