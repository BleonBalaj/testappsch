import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, Clock, MapPin, User, Search, 
  Filter, Calendar, Download, Plus, X, Check, BookOpen, 
  Sparkles, RotateCcw, Tag
} from 'lucide-react';
import ClassDetail from '../components/ClassDetail';
import { useSchoolData } from '../context/SchoolDataContext';
import './Schedule.css';

const ScheduleItem = ({ item, delay, onClick }) => (
  <motion.div 
    className={`schedule-item glass bouncy ${item.isEvent ? 'event-type' : ''}`}
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ delay }}
    onClick={() => onClick(item)}
    layout
  >
    <div className="time-strip" style={{ backgroundColor: `hsl(var(${item.color}))` }}></div>
    <div className="schedule-content">
      <div className="schedule-header">
        <div className="header-left">
          <span className="class-time">{item.time}</span>
          {item.isEvent && <span className="event-tag">Event 📅</span>}
          {item.subjectCategory && !item.isEvent && (
            <span className="category-tag glass">{item.subjectCategory}</span>
          )}
        </div>
        <span className="class-room"><MapPin size={12} /> {item.room}</span>
      </div>
      <h3>{item.subject}</h3>
      <div className="schedule-footer">
        <div className="teacher-small">
          <div className="avatar-xs">
            {item.isEvent ? (
              <div className="icon-avatar-xs" style={{ background: `hsla(var(${item.color}), 0.2)`, color: `hsl(var(${item.color}))` }}>
                <Clock size={15} />
              </div>
            ) : (
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.teacher}`} alt={item.teacher} />
            )}
          </div>
          <span className="teacher-name">{item.isEvent ? `${item.attendees || 50} Registered` : item.teacher}</span>
        </div>
      </div>
    </div>
  </motion.div>
);

const INITIAL_SCHEDULE = {
  'Monday': [
    { id: 1, time: '08:30 - 10:00', subject: 'Mathematics', subjectCategory: 'Math', room: 'Room 302', teacher: 'Dr. Sarah Smith', color: '--primary' },
    { id: 2, time: '10:15 - 11:45', subject: 'Physics Mechanics', subjectCategory: 'Science', room: 'Lab 1', teacher: 'Prof. James Wilson', color: '--chart-2' },
    { id: 3, time: '12:30 - 14:00', subject: 'English Literature', subjectCategory: 'Humanities', room: 'Room 105', teacher: 'Ms. Emily Brown', color: '--accent' },
    { id: 4, time: '14:15 - 15:45', subject: 'World History', subjectCategory: 'Humanities', room: 'Room 201', teacher: 'Mr. David Clark', color: '--chart-1' },
  ],
  'Tuesday': [
    { id: 5, time: '08:30 - 10:00', subject: 'Chemistry Lab', subjectCategory: 'Science', room: 'Lab 2', teacher: 'Dr. Sarah Smith', color: '--chart-3' },
    { id: 6, time: '10:15 - 11:45', subject: 'Biology & Genetics', subjectCategory: 'Science', room: 'Lab 3', teacher: 'Prof. James Wilson', color: '--chart-5' },
    { id: 7, time: '13:00 - 14:30', subject: 'Debate & Public Speaking', subjectCategory: 'Humanities', room: 'Auditorium', teacher: 'Ms. Emily Brown', color: '--primary' },
  ],
  'Wednesday': [
    { id: 8, time: '09:00 - 10:30', subject: 'Computer Science & AI', subjectCategory: 'Technology', room: 'Lab 4', teacher: 'Mr. Alex Vance', color: '--chart-4' },
    { id: 'e1', time: '11:00 - 15:00', subject: 'Science Fair Rehearsal', room: 'Auditorium', attendees: 45, color: '--primary', isEvent: true },
    { id: 9, time: '15:15 - 16:30', subject: 'Calculus Seminar', subjectCategory: 'Math', room: 'Room 302', teacher: 'Dr. Sarah Smith', color: '--accent' },
  ],
  'Thursday': [
    { id: 10, time: '10:00 - 11:30', subject: 'Digital Art & Animation', subjectCategory: 'Arts', room: 'Studio 3', teacher: 'Ms. Clara Oswald', color: '--chart-1' },
    { id: 11, time: '12:30 - 14:00', subject: 'Physics Mechanics', subjectCategory: 'Science', room: 'Lab 1', teacher: 'Prof. James Wilson', color: '--chart-2' },
    { id: 12, time: '14:30 - 16:00', subject: 'Civics & Government', subjectCategory: 'Humanities', room: 'Room 205', teacher: 'Mr. David Clark', color: '--chart-3' },
  ],
  'Friday': [
    { id: 13, time: '08:30 - 10:00', subject: 'Physical Education & Athletics', subjectCategory: 'Athletics', room: 'Main Gymnasium', teacher: 'Coach Mike Tyson', color: '--mood-happy' },
    { id: 'e2', time: '13:00 - 16:00', subject: 'Annual Science Fair', room: 'Main Gym', attendees: 120, color: '--accent', isEvent: true },
    { id: 14, time: '16:15 - 17:00', subject: 'Student Council Assembly', room: 'Auditorium', teacher: 'Ms. Emily Brown', color: '--chart-2' },
  ]
};

const Schedule = () => {
  const { staffList } = useSchoolData();
  const [scheduleState, setScheduleState] = useState(INITIAL_SCHEDULE);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedClass, setSelectedClass] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddSlotOpen, setIsAddSlotOpen] = useState(false);

  // Week navigation state
  const [weekOffset, setWeekOffset] = useState(0);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'classes', 'events'

  // Add Slot Form State
  const [newSlotForm, setNewSlotForm] = useState({
    day: 'Monday',
    time: '09:00 - 10:30',
    subject: '',
    subjectCategory: 'Academic',
    room: 'Room 101',
    teacher: 'Dr. Sarah Smith',
    isEvent: false,
    color: '--primary'
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Helper for computing dynamic week date string
  const weekDateString = useMemo(() => {
    const now = new Date();
    // Monday of current week
    const currentMonday = new Date(now);
    const dayOfWeek = now.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentMonday.setDate(now.getDate() + distanceToMonday + weekOffset * 7);

    const friday = new Date(currentMonday);
    friday.setDate(currentMonday.getDate() + 4);

    const startMonth = currentMonday.toLocaleString('en-US', { month: 'short' });
    const endMonth = friday.toLocaleString('en-US', { month: 'short' });
    const startDay = currentMonday.getDate();
    const endDay = friday.getDate();
    const year = friday.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  }, [weekOffset]);

  // Extract unique teachers and categories for filters
  const teachersList = useMemo(() => {
    const list = new Set();
    Object.values(scheduleState).forEach(dayItems => {
      dayItems.forEach(item => {
        if (item.teacher) list.add(item.teacher);
      });
    });
    // Also include from staff context if available
    staffList.forEach(s => list.add(s.name));
    return ['all', ...Array.from(list)];
  }, [scheduleState, staffList]);

  const categoriesList = useMemo(() => {
    const list = new Set();
    Object.values(scheduleState).forEach(dayItems => {
      dayItems.forEach(item => {
        if (item.subjectCategory) list.add(item.subjectCategory);
      });
    });
    return ['all', ...Array.from(list)];
  }, [scheduleState]);

  // Filter current schedule for the selected day
  const currentSchedule = useMemo(() => {
    const dayItems = scheduleState[selectedDay] || [];
    return dayItems.filter(item => {
      const matchesSearch = 
        item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.room && item.room.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.teacher && item.teacher.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesTeacher = teacherFilter === 'all' || item.teacher === teacherFilter;
      const matchesCategory = categoryFilter === 'all' || item.subjectCategory === categoryFilter;
      
      let matchesType = true;
      if (typeFilter === 'classes') matchesType = !item.isEvent;
      if (typeFilter === 'events') matchesType = !!item.isEvent;

      return matchesSearch && matchesTeacher && matchesCategory && matchesType;
    }).sort((a, b) => a.time.localeCompare(b.time));
  }, [scheduleState, selectedDay, searchTerm, teacherFilter, categoryFilter, typeFilter]);

  const handleClassClick = (item) => {
    if (item.isEvent) return;
    setSelectedClass(item);
    setIsDetailOpen(true);
  };

  const handleAddSlotSubmit = (e) => {
    e.preventDefault();
    if (!newSlotForm.subject) return;

    const newItem = {
      ...newSlotForm,
      id: Date.now()
    };

    setScheduleState(prev => ({
      ...prev,
      [newSlotForm.day]: [...(prev[newSlotForm.day] || []), newItem]
    }));

    setIsAddSlotOpen(false);
    setNewSlotForm({
      day: selectedDay,
      time: '09:00 - 10:30',
      subject: '',
      subjectCategory: 'Academic',
      room: 'Room 101',
      teacher: 'Dr. Sarah Smith',
      isEvent: false,
      color: '--primary'
    });
  };

  // Export Timetable
  const handleExportTimetable = () => {
    const rows = [["Day", "Time", "Subject", "Teacher", "Room", "Type"]];
    days.forEach(day => {
      const dayItems = scheduleState[day] || [];
      dayItems.forEach(item => {
        rows.push([
          day,
          item.time,
          item.subject,
          item.teacher || 'N/A',
          item.room,
          item.isEvent ? 'Campus Event' : (item.subjectCategory || 'Class')
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LumiSchool_Timetable_${weekDateString.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters = searchTerm !== '' || teacherFilter !== 'all' || categoryFilter !== 'all' || typeFilter !== 'all';

  return (
    <div className="schedule-page">
      {/* Header */}
      <header className="page-header">
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text">Academic Schedule 🗓️</h1>
            <span className="count-pill glass">{currentSchedule.length} Periods Today</span>
          </div>
          <p>Real-time timetable for classes, science labs, and campus events.</p>
        </div>

        <div className="header-actions">
          <button className="btn-secondary glass" onClick={handleExportTimetable} title="Export CSV Timetable">
            <Download size={18} />
            Export Schedule
          </button>
          
          <button className="btn-primary" onClick={() => setIsAddSlotOpen(true)}>
            <Plus size={18} />
            Add Period / Event
          </button>

          {/* Interactive Week Navigator */}
          <div className="week-selector-card glass">
            <button 
              className="week-nav-btn glass" 
              onClick={() => setWeekOffset(prev => prev - 1)}
              title="Previous Week"
              aria-label="Previous Week"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="week-date-info">
              <span className="week-label">{weekDateString}</span>
              {weekOffset === 0 ? (
                <span className="current-week-tag">Current Week</span>
              ) : (
                <button 
                  className="reset-week-btn" 
                  onClick={() => setWeekOffset(0)}
                  title="Jump to current week"
                >
                  <RotateCcw size={11} /> Reset
                </button>
              )}
            </div>

            <button 
              className="week-nav-btn glass" 
              onClick={() => setWeekOffset(prev => prev + 1)}
              title="Next Week"
              aria-label="Next Week"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Filter Controls Bar */}
      <div className="schedule-filters-container glass">
        {/* Search Bar */}
        <div className="search-bar-wrap">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search classes, teachers, subjects, rooms, or events..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter Dropdowns & Pills Row */}
        <div className="filters-flex-row">
          <div className="filter-group-item">
            <label><User size={13} /> Teacher:</label>
            <select 
              value={teacherFilter} 
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="schedule-filter-select glass"
            >
              {teachersList.map(t => (
                <option key={t} value={t}>
                  {t === 'all' ? 'All Teachers & Faculty' : t}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group-item">
            <label><Tag size={13} /> Subject / Category:</label>
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="schedule-filter-select glass"
            >
              {categoriesList.map(c => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All Subjects & Domains' : c}
                </option>
              ))}
            </select>
          </div>

          <div className="type-toggle-pills glass">
            <button 
              className={`type-pill ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              All
            </button>
            <button 
              className={`type-pill ${typeFilter === 'classes' ? 'active' : ''}`}
              onClick={() => setTypeFilter('classes')}
            >
              Classes
            </button>
            <button 
              className={`type-pill ${typeFilter === 'events' ? 'active' : ''}`}
              onClick={() => setTypeFilter('events')}
            >
              Events
            </button>
          </div>

          {hasActiveFilters && (
            <button 
              className="reset-filters-btn glass"
              onClick={() => {
                setSearchTerm('');
                setTeacherFilter('all');
                setCategoryFilter('all');
                setTypeFilter('all');
              }}
            >
              <RotateCcw size={13} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Day Selector with Clean Shadows */}
      <div className="day-selector-container">
        {days.map(day => {
          const count = (scheduleState[day] || []).length;
          return (
            <button 
              key={day}
              className={`day-btn ${selectedDay === day ? 'active glass' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              <span className="day-name">{day}</span>
              <span className="day-count-badge">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline and Schedule List */}
      <div className="schedule-timeline">
        <div className="timeline-labels">
          <span>08:00 AM</span>
          <span>10:00 AM</span>
          <span>12:00 PM</span>
          <span>02:00 PM</span>
          <span>04:00 PM</span>
        </div>

        <div className="schedule-list">
          {currentSchedule.length === 0 ? (
            <div className="empty-schedule-card glass">
              <div className="empty-icon-wrap glass">
                <Calendar size={32} />
              </div>
              <h3>No scheduled periods found for {selectedDay}</h3>
              <p>Try adjusting your search criteria or switch to another day of the week.</p>
              {hasActiveFilters && (
                <button 
                  className="btn-secondary glass btn-small"
                  onClick={() => { setSearchTerm(''); setTeacherFilter('all'); setCategoryFilter('all'); setTypeFilter('all'); }}
                >
                  Reset Active Filters
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence>
              {currentSchedule.map((item, index) => (
                <ScheduleItem 
                  key={item.id} 
                  item={item} 
                  delay={index * 0.05} 
                  onClick={handleClassClick}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── MODAL: Add Period / Event ── */}
      <AnimatePresence>
        {isAddSlotOpen && (
          <div className="modal-overlay" onClick={() => setIsAddSlotOpen(false)}>
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Add Period or Event</h3>
                <p className="modal-subtitle">Schedule a class period, laboratory session, or campus event.</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddSlotOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddSlotSubmit} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Day of Week</label>
                    <select 
                      value={newSlotForm.day}
                      onChange={e => setNewSlotForm({ ...newSlotForm, day: e.target.value })}
                      className="custom-form-select"
                    >
                      {days.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Time Slot</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. 09:00 - 10:30"
                      value={newSlotForm.time}
                      onChange={e => setNewSlotForm({ ...newSlotForm, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Subject / Event Title</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Advanced Calculus, Robotics Workshop"
                    value={newSlotForm.subject}
                    onChange={e => setNewSlotForm({ ...newSlotForm, subject: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Instructor / Host</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Dr. Sarah Smith"
                      value={newSlotForm.teacher}
                      onChange={e => setNewSlotForm({ ...newSlotForm, teacher: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Room / Location</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Room 302, Main Gym"
                      value={newSlotForm.room}
                      onChange={e => setNewSlotForm({ ...newSlotForm, room: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Category</label>
                    <select 
                      value={newSlotForm.subjectCategory}
                      onChange={e => setNewSlotForm({ ...newSlotForm, subjectCategory: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="Math">Mathematics</option>
                      <option value="Science">Science & Labs</option>
                      <option value="Humanities">Humanities & Languages</option>
                      <option value="Technology">Technology & CS</option>
                      <option value="Arts">Arts & Music</option>
                      <option value="Athletics">Athletics & PE</option>
                      <option value="Event">Campus Event</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Color Accent</label>
                    <select 
                      value={newSlotForm.color}
                      onChange={e => setNewSlotForm({ ...newSlotForm, color: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="--primary">Primary Theme (Purple)</option>
                      <option value="--accent">Accent Violet</option>
                      <option value="--chart-1">Chart Rose</option>
                      <option value="--chart-2">Chart Indigo</option>
                      <option value="--chart-3">Chart Cyan</option>
                      <option value="--mood-happy">Emerald Green</option>
                    </select>
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddSlotOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save to Schedule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ClassDetail 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
        classInfo={selectedClass} 
      />
    </div>
  );
};

export default Schedule;
