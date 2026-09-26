import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, BookOpen, Clock, MessageCircle, ClipboardCheck, 
  Check, AlertCircle, FileText, Download, Calendar, UserCheck, 
  Sparkles, CheckCircle2 
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { Avatar } from './Avatar';
import './ClassDetail.css';

const MOCK_MATERIALS = [
  { id: 'm1', name: 'Course Syllabus & Grading Rubric.pdf', size: '1.4 MB', date: 'Term Start' },
  { id: 'm2', name: 'Unit 4 Problem Set & Lab Guide.pdf', size: '2.8 MB', date: '3 days ago' },
  { id: 'm3', name: 'Midterm Exam Review Packet.docx', size: '4.1 MB', date: 'Yesterday' }
];

const ClassDetail = ({ isOpen, onClose, classInfo, userRole = 'student', onCreateLessonPlan, lessonLanguage = 'en' }) => {
  const { studentsList } = useSchoolData();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'attendance', 'materials'
  const isStudent = userRole === 'student';
  
  // Attendance Roll Call state: { [studentId]: 'P' | 'L' | 'A' | 'E' }
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [isRollCallSaved, setIsRollCallSaved] = useState(false);

  if (!classInfo) return null;

  // Real enrolled students or fallback
  const enrolledStudents = studentsList.length > 0 ? studentsList.slice(0, 10) : [
    { id: 1, name: 'Luna Star', grade: '10A' },
    { id: 2, name: 'Oliver Twist', grade: '9B' },
    { id: 3, name: 'Sophie Miller', grade: '11C' },
    { id: 4, name: 'Felix Cat', grade: '12A' }
  ];

  const handleStatusChange = (studentId, status) => {
    setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
    setIsRollCallSaved(false);
  };

  const markAllPresent = () => {
    const all = {};
    enrolledStudents.forEach(s => {
      all[s.id] = 'P';
    });
    setAttendanceRecords(all);
    setIsRollCallSaved(false);
  };

  const handleSaveAttendance = () => {
    setIsRollCallSaved(true);
    setTimeout(() => setIsRollCallSaved(false), 3000);
  };

  // Calculate live presence rate
  const recordedCount = Object.keys(attendanceRecords).length;
  const presentCount = Object.values(attendanceRecords).filter(v => v === 'P' || v === 'L').length;
  const attendanceRate = recordedCount > 0 ? Math.round((presentCount / recordedCount) * 100) : 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="class-detail-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div 
            className="class-detail-modal"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="class-detail-top-row">
              <div className="class-badge" style={{ backgroundColor: `hsl(var(${classInfo.color || '--primary'}))` }}>
                <BookOpen size={24} color="white" />
              </div>
              <div className="class-title-info">
                <h2>{classInfo.subject}</h2>
                <p>{classInfo.classLabel ? `Class ${classInfo.classLabel} · Period ${classInfo.period} · ` : ''}{classInfo.room} • {classInfo.time}</p>
                {classInfo.scheduledDate && <p>{new Date(`${classInfo.scheduledDate}T12:00:00`).toLocaleDateString(lessonLanguage === 'sq' ? 'sq-AL' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>}
              </div>
              <button className="icon-btn-close" onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            {/* Segmented Tab Navigation */}
            <div className="class-segmented-tabs">
              <button 
                type="button"
                className={`class-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                type="button"
                className={`class-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
                onClick={() => setActiveTab('attendance')}
              >
                {isStudent ? '📋 My Attendance' : '📋 Roll Call'}
              </button>
              <button 
                type="button"
                className={`class-tab-btn ${activeTab === 'materials' ? 'active' : ''}`}
                onClick={() => setActiveTab('materials')}
              >
                📚 Materials
              </button>
            </div>

            {/* Modal Body Container (Single Scroll Surface) */}
            <div className="class-detail-scroll-body">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="class-tab-pane">
                  {/* Teacher Card */}
                  <section className="class-detail-section">
                    <h3>Lead Faculty</h3>
                    <div className="teacher-info-card">
                      <div className="avatar-med">
                        <Avatar alt={classInfo.teacher} />
                      </div>
                      <div className="info">
                        <p className="name">{classInfo.teacher}</p>
                        <p className="role">Senior Instructor • Active</p>
                      </div>
                    </div>
                  </section>

                  {/* Student Roster Preview */}
                  <section className="class-detail-section">
                    <div className="section-header">
                      <h3>Enrolled Students</h3>
                      <span className="count">{enrolledStudents.length} Students Active</span>
                    </div>
                    <div className="student-compact-list">
                      {enrolledStudents.slice(0, 5).map((student) => (
                        <div key={student.id} className="student-compact-item" title={student.name}>
                          <Avatar alt={student.name} />
                        </div>
                      ))}
                      {enrolledStudents.length > 5 && (
                        <div className="more-students">+{enrolledStudents.length - 5} more</div>
                      )}
                    </div>
                  </section>

                  {/* Weekly Progress */}
                  <section className="class-detail-section">
                    <h3>Curriculum Progress</h3>
                    <div className="progress-card">
                      <div className="progress-header">
                        <span>Unit 4: Advanced Principles</span>
                        <strong>75% Completed</strong>
                      </div>
                      <div className="progress-bar-bg">
                        <motion.div 
                          className="progress-bar-fill"
                          initial={{ width: 0 }}
                          animate={{ width: '75%' }}
                          transition={{ delay: 0.2, duration: 0.8 }}
                        />
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* TAB 2: LIVE ATTENDANCE (ROLE-AWARE) */}
              {activeTab === 'attendance' && (
                <div className="class-tab-pane">
                  {isStudent ? (
                    <div className="student-personal-attendance-view">
                      <div className="attendance-header-card">
                        <div className="att-stats">
                          <strong>My Attendance Standing</strong>
                          <span>Verified Course Enrollment Record</span>
                        </div>
                        <div className="att-rate-badge">
                          <span>Rate:</span> <strong>97%</strong>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', marginTop: '1rem' }}>
                        <div className="glass" style={{ padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 700 }}>Present</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'hsl(var(--mood-happy))' }}>28</p>
                        </div>
                        <div className="glass" style={{ padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 700 }}>Late</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'hsl(var(--accent))' }}>1</p>
                        </div>
                        <div className="glass" style={{ padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 700 }}>Unexcused</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'hsl(var(--mood-happy))' }}>0</p>
                        </div>
                      </div>

                      <div style={{ marginTop: '1.25rem' }}>
                        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 0.65rem 0' }}>Recent Class Log</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          {[
                            { date: 'Today (Period 2)', status: 'Present (On-Time)', color: 'var(--mood-happy)' },
                            { date: 'Yesterday (Period 2)', status: 'Present (On-Time)', color: 'var(--mood-happy)' },
                            { date: 'Oct 14, 2026', status: 'Excused (Campus Event)', color: 'var(--accent)' },
                            { date: 'Oct 13, 2026', status: 'Present (On-Time)', color: 'var(--mood-happy)' },
                          ].map((log, i) => (
                            <div key={i} className="glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', borderRadius: '10px' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{log.date}</span>
                              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px', background: `hsla(${log.color}, 0.15)`, color: `hsl(${log.color})` }}>
                                {log.status}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p style={{ fontSize: '0.74rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.75rem', textAlign: 'center' }}>
                          Certified by {classInfo.teacher || 'Course Instructor'}.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="attendance-header-card">
                        <div className="att-stats">
                          <strong>Daily Roll Call</strong>
                          <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className="att-rate-badge">
                          <span>Rate:</span> <strong>{attendanceRate}%</strong>
                        </div>
                      </div>

                      <div className="att-quick-actions">
                        <button type="button" className="btn-secondary btn-sm" onClick={markAllPresent}>
                          <UserCheck size={14} />
                          Mark All Present
                        </button>
                      </div>

                      <div className="attendance-student-list">
                        {enrolledStudents.map((student) => {
                          const currentStatus = attendanceRecords[student.id] || 'P';
                          return (
                            <div key={student.id} className="attendance-student-row">
                              <div className="avatar-xs">
                                <Avatar alt={student.name} />
                              </div>
                              <div className="att-name-col">
                                <strong>{student.name}</strong>
                                <span>Grade {student.grade || '10'}</span>
                              </div>

                              <div className="att-btn-group">
                                <button 
                                  type="button"
                                  className={`att-pill-btn present ${currentStatus === 'P' ? 'active' : ''}`}
                                  onClick={() => handleStatusChange(student.id, 'P')}
                                  title="Present"
                                >
                                  P
                                </button>
                                <button 
                                  type="button"
                                  className={`att-pill-btn late ${currentStatus === 'L' ? 'active' : ''}`}
                                  onClick={() => handleStatusChange(student.id, 'L')}
                                  title="Late"
                                >
                                  L
                                </button>
                                <button 
                                  type="button"
                                  className={`att-pill-btn absent ${currentStatus === 'A' ? 'active' : ''}`}
                                  onClick={() => handleStatusChange(student.id, 'A')}
                                  title="Absent"
                                >
                                  A
                                </button>
                                <button 
                                  type="button"
                                  className={`att-pill-btn excused ${currentStatus === 'E' ? 'active' : ''}`}
                                  onClick={() => handleStatusChange(student.id, 'E')}
                                  title="Excused"
                                >
                                  E
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: MATERIALS & DOCUMENTS */}
              {activeTab === 'materials' && (
                <div className="class-tab-pane">
                  <div className="materials-list">
                    {MOCK_MATERIALS.map((doc) => (
                      <div key={doc.id} className="material-card">
                        <div className="material-icon-box">
                          <FileText size={20} />
                        </div>
                        <div className="material-info">
                          <strong>{doc.name}</strong>
                          <span>{doc.size} • Uploaded {doc.date}</span>
                        </div>
                        <button type="button" className="icon-btn-secondary" title="Download Material">
                          <Download size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="class-detail-actions">
              {!isStudent && onCreateLessonPlan && (
                <button
                  type="button"
                  className="btn-secondary full-width"
                  style={{ marginBottom: '0.65rem' }}
                  onClick={onCreateLessonPlan}
                >
                  <FileText size={18} />
                  {lessonLanguage === 'sq' ? 'Krijo plan mësimor' : 'Create lesson plan'}
                </button>
              )}
              {isStudent ? (
                <button 
                  type="button" 
                  className="btn-primary full-width"
                  onClick={() => setActiveTab('materials')}
                >
                  <FileText size={18} />
                  View Course Materials ({MOCK_MATERIALS.length})
                </button>
              ) : (
                activeTab === 'attendance' ? (
                  <button 
                    type="button" 
                    className={`btn-primary full-width ${isRollCallSaved ? 'saved' : ''}`}
                    onClick={handleSaveAttendance}
                  >
                    {isRollCallSaved ? <><Check size={18} /> Roll Call Saved!</> : <><ClipboardCheck size={18} /> Save Roll Call</>}
                  </button>
                ) : (
                  <button 
                    type="button" 
                    className="btn-primary full-width"
                    onClick={() => setActiveTab('attendance')}
                  >
                    <ClipboardCheck size={18} />
                    Take Class Attendance
                  </button>
                )
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ClassDetail;
