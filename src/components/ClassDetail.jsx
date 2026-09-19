import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, BookOpen, Clock, MessageCircle, ClipboardCheck, 
  Check, AlertCircle, FileText, Download, Calendar, UserCheck, 
  Sparkles, CheckCircle2 
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import './ClassDetail.css';

const MOCK_MATERIALS = [
  { id: 'm1', name: 'Course Syllabus & Grading Rubric.pdf', size: '1.4 MB', date: 'Term Start' },
  { id: 'm2', name: 'Unit 4 Problem Set & Lab Guide.pdf', size: '2.8 MB', date: '3 days ago' },
  { id: 'm3', name: 'Midterm Exam Review Packet.docx', size: '4.1 MB', date: 'Yesterday' }
];

const ClassDetail = ({ isOpen, onClose, classInfo }) => {
  const { studentsList } = useSchoolData();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'attendance', 'materials'
  
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
                <p>{classInfo.room} • {classInfo.time}</p>
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
                📋 Roll Call
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
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${classInfo.teacher}`} alt={classInfo.teacher} />
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
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} alt={student.name} />
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

              {/* TAB 2: LIVE ATTENDANCE ROLL CALL */}
              {activeTab === 'attendance' && (
                <div className="class-tab-pane">
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
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} alt={student.name} />
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
              {activeTab === 'attendance' ? (
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
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ClassDetail;
