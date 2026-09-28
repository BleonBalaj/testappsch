import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, BookOpen, Clock, MessageCircle, ClipboardCheck, 
  Check, AlertCircle, FileText, Download, Calendar, UserCheck, 
  Sparkles, CheckCircle2 
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from './Avatar';
import { courseMatchesReference } from '../features/enrollment';
import { classGroupForItem, classGroupsById, studentClassLabel } from '../features/classGroups';
import { useClassRoster, useCourseRoster } from '../features/students/studentData';
import './ClassDetail.css';

const ClassDetail = ({ isOpen, onClose, classInfo, userRole = 'student', onCreateLessonPlan, lessonLanguage = 'en' }) => {
  const { classesList = [], classGroups = [] } = useSchoolData();
  const { activeSchoolId } = useAuth();
  const { isAlbanian } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'attendance', 'materials'
  const isStudent = userRole === 'student';
  
  // Attendance Roll Call state: { [studentId]: 'P' | 'L' | 'A' | 'E' }
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [isRollCallSaved, setIsRollCallSaved] = useState(false);

  // The roster is the linked course's students, or the slot's class. Staff only,
  // and only while the panel is open.
  const groupsById = useMemo(() => classGroupsById(classGroups), [classGroups]);
  const relatedCourse = classInfo ? classesList.find(course =>
    [classInfo.courseId, classInfo.classId, classInfo.subject, classInfo.curriculumSubject]
      .some(reference => courseMatchesReference(course, reference))
  ) : null;
  const slotGroup = classInfo && !relatedCourse ? classGroupForItem(classInfo, classGroups, groupsById) : null;
  const loadRoster = Boolean(isOpen && classInfo && !isStudent);
  const courseRoster = useCourseRoster(activeSchoolId, loadRoster ? relatedCourse : null);
  const classRoster = useClassRoster(activeSchoolId, loadRoster && slotGroup ? slotGroup.id : '');

  if (!classInfo) return null;

  const classMaterials = classInfo.materials || [];
  const rosterSource = relatedCourse ? courseRoster : slotGroup ? classRoster : null;
  const displayStudents = rosterSource ? rosterSource.students : [];
  const rosterLoading = Boolean(rosterSource?.loading);

  const handleStatusChange = (studentId, status) => {
    setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
    setIsRollCallSaved(false);
  };

  const markAllPresent = () => {
    const all = {};
    displayStudents.forEach(s => {
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
                <p>{[classInfo.classLabel ? `${isAlbanian ? 'Klasa' : 'Class'} ${classInfo.classLabel}${classInfo.period ? ` · ${isAlbanian ? 'Ora' : 'Period'} ${classInfo.period}` : ''}` : '', classInfo.room, classInfo.time].filter(Boolean).join(' · ')}</p>
                {classInfo.scheduledDate && <p>{new Date(`${classInfo.scheduledDate}T12:00:00`).toLocaleDateString(isAlbanian || lessonLanguage === 'sq' ? 'sq-AL' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>}
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
                {isAlbanian ? 'Përmbledhje' : 'Overview'}
              </button>
              <button 
                type="button"
                className={`class-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
                onClick={() => setActiveTab('attendance')}
              >
                {isStudent ? (isAlbanian ? '📋 Pjesëmarrja Ime' : '📋 My Attendance') : (isAlbanian ? '📋 Regjistri' : '📋 Roll Call')}
              </button>
              <button 
                type="button"
                className={`class-tab-btn ${activeTab === 'materials' ? 'active' : ''}`}
                onClick={() => setActiveTab('materials')}
              >
                {isAlbanian ? '📚 Materialet' : '📚 Materials'}
              </button>
            </div>

            {/* Modal Body Container (Single Scroll Surface) */}
            <div className="class-detail-scroll-body">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="class-tab-pane">
                  {/* Teacher Card */}
                  <section className="class-detail-section">
                    <h3>{isAlbanian ? 'Mësimdhënësi Kryesor' : 'Lead Faculty'}</h3>
                    <div className="teacher-info-card">
                      <div className="avatar-med">
                        <Avatar alt={classInfo.teacher} />
                      </div>
                      <div className="info">
                        <p className="name">{classInfo.teacher}</p>
                        <p className="role">{isAlbanian ? 'Mësimdhënës • Aktiv' : 'Senior Instructor • Active'}</p>
                      </div>
                    </div>
                  </section>

                  {/* Student Roster Preview */}
                  <section className="class-detail-section">
                    <div className="section-header">
                      <h3>{isAlbanian ? 'Nxënësit e Regjistruar' : 'Enrolled Students'}</h3>
                      <span className="count">{isAlbanian ? `${displayStudents.length} Nxënës Aktivë` : `${displayStudents.length} Students Active`}</span>
                    </div>
                    <div className="student-compact-list">
                      {displayStudents.length === 0 ? (
                        <span style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>{isAlbanian ? 'Nuk ka nxënës të regjistruar në këtë lëndë' : 'No students enrolled in this class'}</span>
                      ) : (
                        <>
                          {displayStudents.slice(0, 5).map((student) => (
                            <div key={student.id} className="student-compact-item" title={student.name}>
                              <Avatar alt={student.name} />
                            </div>
                          ))}
                          {displayStudents.length > 5 && (
                            <div className="more-students">{isAlbanian ? `+${displayStudents.length - 5} të tjerë` : `+${displayStudents.length - 5} more`}</div>
                          )}
                        </>
                      )}
                    </div>
                  </section>

                  {/* Weekly Progress */}
                  <section className="class-detail-section">
                    <h3>{isAlbanian ? 'Progresi i Kurrikulës' : 'Curriculum Progress'}</h3>
                    <div className="progress-card">
                      <div className="progress-header">
                        <span>{classInfo.currentUnit || classInfo.subject || (isAlbanian ? 'Kurrikula e Lëndës' : 'Course Curriculum')}</span>
                        <strong>{classInfo.progress != null ? `${classInfo.progress}%` : '0%'} {isAlbanian ? 'Përfunduar' : 'Completed'}</strong>
                      </div>
                      <div className="progress-bar-bg">
                        <motion.div 
                          className="progress-bar-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${classInfo.progress || 0}%` }}
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
                          <strong>{isAlbanian ? 'Gjendja Ime e Pjesëmarrjes' : 'My Attendance Standing'}</strong>
                          <span>{isAlbanian ? 'Të Dhëna të Verifikuara të Pjesëmarrjes' : 'Verified Course Enrollment Record'}</span>
                        </div>
                        <div className="att-rate-badge">
                          <span>{isAlbanian ? 'Norma:' : 'Rate:'}</span> <strong>{classInfo.attendanceRate != null ? `${classInfo.attendanceRate}%` : '100%'}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', marginTop: '1rem' }}>
                        <div className="glass" style={{ padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 700 }}>{isAlbanian ? 'Prezent' : 'Present'}</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'hsl(var(--mood-happy))' }}>{classInfo.presentCount || 0}</p>
                        </div>
                        <div className="glass" style={{ padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 700 }}>{isAlbanian ? 'Me Vonesë' : 'Late'}</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'hsl(var(--accent))' }}>{classInfo.lateCount || 0}</p>
                        </div>
                        <div className="glass" style={{ padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 700 }}>{isAlbanian ? 'Pa Arsye' : 'Unexcused'}</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'hsl(var(--mood-sad))' }}>{classInfo.unexcusedCount || 0}</p>
                        </div>
                      </div>

                      <div style={{ marginTop: '1.25rem' }}>
                        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 0.65rem 0' }}>{isAlbanian ? 'Ditari i Fundit i Orëve' : 'Recent Class Log'}</h4>
                        {(classInfo.recentLogs && classInfo.recentLogs.length > 0) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                            {classInfo.recentLogs.map((log, i) => (
                              <div key={i} className="glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', borderRadius: '10px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{log.date}</span>
                                <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px', background: `hsla(${log.color || 'var(--mood-happy)'}, 0.15)`, color: `hsl(${log.color || 'var(--mood-happy)'})` }}>
                                  {log.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ padding: '1rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
                            {isAlbanian ? 'Nuk ka regjistrime pjesëmarrjeje ende.' : 'No attendance logs recorded yet.'}
                          </div>
                        )}
                        <p style={{ fontSize: '0.74rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.75rem', textAlign: 'center' }}>
                          {isAlbanian ? 'Certifikuar nga' : 'Certified by'} {classInfo.teacher || (isAlbanian ? 'Mësimdhënësi i Lëndës' : 'Course Instructor')}.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="attendance-header-card">
                        <div className="att-stats">
                          <strong>{isAlbanian ? 'Regjistri Ditor' : 'Daily Roll Call'}</strong>
                          <span>{new Date().toLocaleDateString(isAlbanian ? 'sq-AL' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className="att-rate-badge">
                          <span>{isAlbanian ? 'Norma:' : 'Rate:'}</span> <strong>{attendanceRate}%</strong>
                        </div>
                      </div>

                      <div className="att-quick-actions">
                        <button type="button" className="btn-secondary btn-sm" onClick={markAllPresent}>
                          <UserCheck size={14} />
                          {isAlbanian ? 'Shëno të Gjithë Prezentë' : 'Mark All Present'}
                        </button>
                      </div>

                      <div className="attendance-student-list">
                        {displayStudents.length === 0 ? (
                          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                            {rosterLoading
                              ? (isAlbanian ? 'Po ngarkohen nxënësit…' : 'Loading students…')
                              : !rosterSource
                                ? (isAlbanian ? 'Kjo orë nuk është e lidhur me një lëndë ose klasë.' : 'This period is not linked to a course or class.')
                                : (isAlbanian ? 'Nuk ka nxënës të regjistruar në këtë lëndë ende.' : 'No students enrolled in this class yet.')}
                          </div>
                        ) : (
                          displayStudents.map((student) => {
                            const currentStatus = attendanceRecords[student.id] || 'P';
                            return (
                              <div key={student.id} className="attendance-student-row">
                                <div className="avatar-xs">
                                  <Avatar alt={student.name} />
                                </div>
                                <div className="att-name-col">
                                  <strong>{student.name}</strong>
                                  <span>{studentClassLabel(student, groupsById) ? `${isAlbanian ? 'Klasa' : 'Class'} ${studentClassLabel(student, groupsById)}` : (isAlbanian ? 'Pa klasë' : 'No class')}</span>
                                </div>

                                <div className="att-btn-group">
                                  <button 
                                    type="button" 
                                    className={`att-pill-btn present ${currentStatus === 'P' ? 'active' : ''}`}
                                    onClick={() => handleStatusChange(student.id, 'P')}
                                    title={isAlbanian ? 'Prezent' : 'Present'}
                                  >
                                    P
                                  </button>
                                  <button 
                                    type="button" 
                                    className={`att-pill-btn late ${currentStatus === 'L' ? 'active' : ''}`}
                                    onClick={() => handleStatusChange(student.id, 'L')}
                                    title={isAlbanian ? 'Me Vonesë' : 'Late'}
                                  >
                                    L
                                  </button>
                                  <button 
                                    type="button" 
                                    className={`att-pill-btn absent ${currentStatus === 'A' ? 'active' : ''}`}
                                    onClick={() => handleStatusChange(student.id, 'A')}
                                    title={isAlbanian ? 'Mungesë' : 'Absent'}
                                  >
                                    A
                                  </button>
                                  <button 
                                    type="button" 
                                    className={`att-pill-btn excused ${currentStatus === 'E' ? 'active' : ''}`}
                                    onClick={() => handleStatusChange(student.id, 'E')}
                                    title={isAlbanian ? 'Me Arsye' : 'Excused'}
                                  >
                                    E
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: MATERIALS & DOCUMENTS */}
              {activeTab === 'materials' && (
                <div className="class-tab-pane">
                  <div className="materials-list">
                    {classMaterials.length === 0 ? (
                      <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem' }}>
                        {isAlbanian ? 'Nuk ka materiale të ngarkuara për këtë lëndë ende.' : 'No course materials uploaded for this class yet.'}
                      </div>
                    ) : (
                      classMaterials.map((doc) => (
                        <div key={doc.id} className="material-card">
                          <div className="material-icon-box">
                            <FileText size={20} />
                          </div>
                          <div className="material-info">
                            <strong>{doc.name}</strong>
                            <span>{doc.size} • {isAlbanian ? 'Ngarkuar më' : 'Uploaded'} {doc.date}</span>
                          </div>
                          <button type="button" className="icon-btn-secondary" title={isAlbanian ? 'Shkarko Materialin' : 'Download Material'}>
                            <Download size={16} />
                          </button>
                        </div>
                      ))
                    )}
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
                  {isAlbanian || lessonLanguage === 'sq' ? 'Krijo plan mësimor' : 'Create lesson plan'}
                </button>
              )}
              {isStudent ? (
                <button 
                  type="button" 
                  className="btn-primary full-width"
                  onClick={() => setActiveTab('materials')}
                >
                  <FileText size={18} />
                  {isAlbanian ? `Shiko Materialet e Lëndës (${classMaterials.length})` : `View Course Materials (${classMaterials.length})`}
                </button>
              ) : (
                activeTab === 'attendance' ? (
                  <button 
                    type="button" 
                    className={`btn-primary full-width ${isRollCallSaved ? 'saved' : ''}`}
                    onClick={handleSaveAttendance}
                  >
                    {isRollCallSaved ? <><Check size={18} /> {isAlbanian ? 'Regjistri u Ruajt!' : 'Roll Call Saved!'}</> : <><ClipboardCheck size={18} /> {isAlbanian ? 'Ruaj Regjistrin' : 'Save Roll Call'}</>}
                  </button>
                ) : (
                  <button 
                    type="button" 
                    className="btn-primary full-width"
                    onClick={() => setActiveTab('attendance')}
                  >
                    <ClipboardCheck size={18} />
                    {isAlbanian ? 'Merr Pjesëmarrjen' : 'Take Class Attendance'}
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
