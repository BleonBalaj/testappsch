import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, Clock, MapPin, User, Search, 
  Filter, Calendar, Download, Plus, X, Check, BookOpen, 
  Sparkles, RotateCcw, Tag, Layers, GraduationCap, CheckCircle2,
  Trash2
} from 'lucide-react';
import ClassDetail from '../components/ClassDetail';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../services/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Avatar } from '../components/Avatar';
import { SUBJECTS } from '../features/lessonPlans/catalog';
import { translateCatalogValue } from '../features/lessonPlans/i18n';
import './Schedule.css';

const ScheduleItem = ({ item, delay, onClick, activeTab, userRole, onDeleteSlot, isAlbanian }) => (
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
        <div className="header-left" style={{ flexWrap: 'wrap' }}>
          <span className="class-time">{item.time}</span>
          {item.isEvent && (
            <span className="event-tag">
              <Calendar size={11} /> {isAlbanian ? 'Ngjarje' : 'Event'}
            </span>
          )}
          {item.classLabel && !item.isEvent && (
            <span className="category-tag glass">{isAlbanian ? `Klasa ${item.classLabel} · P${item.period}` : `Class ${item.classLabel} · P${item.period}`}</span>
          )}
          {item.subjectCategory && !item.isEvent && !item.classLabel && (
            <span className="category-tag glass">{item.subjectCategory}</span>
          )}
          {activeTab === 'all-schedule' && userRole !== 'admin' && item.enrolled && !item.isEvent && (
            <span className="enrolled-status-pill">
              <CheckCircle2 size={11} /> {userRole === 'teacher' ? (isAlbanian ? 'Lënda Ime' : 'My Class') : (isAlbanian ? 'I Regjistruar' : 'Enrolled')}
            </span>
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
              <Avatar alt={item.teacher} />
            )}
          </div>
          <span className="teacher-name">{item.isEvent ? (isAlbanian ? `${item.attendees || 50} Të Regjistruar` : `${item.attendees || 50} Registered`) : item.teacher}</span>
        </div>
        {userRole !== 'student' && !item.isEvent && onDeleteSlot && (
          <button 
            type="button" 
            className="icon-action-btn delete glass"
            style={{ marginLeft: 'auto', padding: '4px', opacity: 0.7 }}
            onClick={(e) => { e.stopPropagation(); onDeleteSlot(item.id); }}
            title={isAlbanian ? 'Fshij Orën' : 'Delete Slot'}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  </motion.div>
);

const INITIAL_SCHEDULE = {
  'Monday': [],
  'Tuesday': [],
  'Wednesday': [],
  'Thursday': [],
  'Friday': []
};


const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function mondayForWeek(weekOffset) {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() + (today.getDay() === 0 ? -6 : 1 - today.getDay()) + weekOffset * 7);
  return monday;
}

function dateForDay(monday, day) {
  const date = new Date(monday);
  date.setDate(date.getDate() + DAYS.indexOf(day));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const Schedule = ({ userRole = 'student', lessonLanguage = 'en', onCreateLessonPlan }) => {
  const { staffList } = useSchoolData();
  const { activeSchoolId, currentUser } = useAuth();
  const { language, t, isAlbanian } = useLanguage();
  const [scheduleState, setScheduleState] = useState(INITIAL_SCHEDULE);

  useEffect(() => {
    if (!activeSchoolId) {
      setScheduleState(INITIAL_SCHEDULE);
      return;
    }

    const entriesCol = collection(db, 'schools', activeSchoolId, 'scheduleEntries');
    const unsubscribe = onSnapshot(entriesCol, (snapshot) => {
      const grouped = {
        'Monday': [],
        'Tuesday': [],
        'Wednesday': [],
        'Thursday': [],
        'Friday': []
      };
      snapshot.forEach(docSnap => {
        const item = { id: docSnap.id, ...docSnap.data() };
        if (grouped[item.day]) {
          grouped[item.day].push(item);
        }
      });
      setScheduleState(grouped);
    }, (err) => {
      console.warn('Notice listening to schedule entries:', err.message);
    });

    return () => unsubscribe();
  }, [activeSchoolId]);

  const handleDeleteSlot = async (slotId) => {
    if (!activeSchoolId) {
      setScheduleState(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(day => {
          next[day] = next[day].filter(item => String(item.id) !== String(slotId));
        });
        return next;
      });
      return;
    }
    try {
      await deleteDoc(doc(db, 'schools', activeSchoolId, 'scheduleEntries', String(slotId)));
    } catch (err) {
      console.warn('Error deleting schedule entry:', err.message);
    }
  };

  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedClass, setSelectedClass] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddSlotOpen, setIsAddSlotOpen] = useState(false);

  // Default tab for student and teacher is 'my-schedule', for admin is 'all-schedule'
  const [activeTab, setActiveTab] = useState(() => (userRole === 'admin' ? 'all-schedule' : 'my-schedule'));
  const [prevRole, setPrevRole] = useState(userRole);

  if (prevRole !== userRole) {
    setPrevRole(userRole);
    setActiveTab(userRole === 'admin' ? 'all-schedule' : 'my-schedule');
  }

  // Superadmins NEVER have a personal schedule tab; strictly locked to master campus schedule
  const effectiveTab = userRole === 'admin' ? 'all-schedule' : activeTab;

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
    curriculumSubject: '',
    classLabel: '',
    period: '',
    subjectCategory: 'Academic',
    room: 'Room 101',
    teacher: 'Noesis',
    isEvent: false,
    color: '--primary',
    enrolled: true
  });

  const days = DAYS;

  const weekMonday = useMemo(() => mondayForWeek(weekOffset), [weekOffset]);

  // A selected weekday is resolved against the displayed week, including week navigation.
  const weekDateString = useMemo(() => {
    const friday = new Date(weekMonday);
    friday.setDate(friday.getDate() + 4);

    if (isAlbanian) {
      const albanianMonths = ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Korr', 'Gush', 'Sht', 'Tet', 'Nën', 'Dhj'];
      const startMonth = albanianMonths[weekMonday.getMonth()];
      const endMonth = albanianMonths[friday.getMonth()];
      const startDay = weekMonday.getDate();
      const endDay = friday.getDate();
      const year = friday.getFullYear();

      if (startMonth === endMonth) {
        return `${startDay} – ${endDay} ${startMonth}, ${year}`;
      }
      return `${startDay} ${startMonth} – ${endDay} ${endMonth}, ${year}`;
    }

    const startMonth = weekMonday.toLocaleString('en-US', { month: 'short' });
    const endMonth = friday.toLocaleString('en-US', { month: 'short' });
    const startDay = weekMonday.getDate();
    const endDay = friday.getDate();
    const year = friday.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  }, [weekMonday, isAlbanian]);

  // Determine if an item belongs in My Schedule
  const isItemInMySchedule = useCallback((item) => {
    if (userRole === 'teacher') {
      return item.teacher === 'Noesis' || item.isEvent;
    }
    // For students and general users
    return Boolean(item.enrolled || item.isEvent);
  }, [userRole]);

  // Day counts for My Schedule vs All Schedule
  const myScheduleCount = useMemo(() => {
    const dayItems = scheduleState[selectedDay] || [];
    return dayItems.filter(isItemInMySchedule).length;
  }, [scheduleState, selectedDay, isItemInMySchedule]);

  const allScheduleCount = useMemo(() => {
    const dayItems = scheduleState[selectedDay] || [];
    return dayItems.length;
  }, [scheduleState, selectedDay]);

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

  // Filter current schedule for the selected day and active tab
  const currentSchedule = useMemo(() => {
    const dayItems = scheduleState[selectedDay] || [];
    return dayItems.filter(item => {
      // Tab filter
      if (effectiveTab === 'my-schedule' && !isItemInMySchedule(item)) {
        return false;
      }

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
  }, [scheduleState, selectedDay, effectiveTab, isItemInMySchedule, searchTerm, teacherFilter, categoryFilter, typeFilter]);

  const handleClassClick = (item) => {
    if (item.isEvent) return;
    setSelectedClass({ ...item, scheduledDate: dateForDay(weekMonday, selectedDay) });
    setIsDetailOpen(true);
  };

  const handleCreateLessonPlan = () => {
    if (!selectedClass?.classLabel || !selectedClass?.curriculumSubject || !onCreateLessonPlan) return;
    onCreateLessonPlan({
      date: selectedClass.scheduledDate,
      classLabel: selectedClass.classLabel,
      subject: selectedClass.curriculumSubject,
      period: selectedClass.period,
    });
    setIsDetailOpen(false);
  };

  const handleAddSlotSubmit = async (e) => {
    e.preventDefault();
    if (!newSlotForm.subject || !newSlotForm.classLabel || !newSlotForm.curriculumSubject || !newSlotForm.period) return;

    const slotId = `slot_${Date.now()}`;
    const newItem = {
      ...newSlotForm,
      id: slotId,
      createdByUid: currentUser?.uid || '',
      createdAt: serverTimestamp()
    };

    if (activeSchoolId) {
      try {
        await setDoc(doc(db, 'schools', activeSchoolId, 'scheduleEntries', slotId), newItem);
      } catch (err) {
        console.warn('Error saving schedule entry to Firestore:', err.message);
      }
    } else {
      setScheduleState(prev => ({
        ...prev,
        [newSlotForm.day]: [...(prev[newSlotForm.day] || []), newItem]
      }));
    }

    setIsAddSlotOpen(false);
    setNewSlotForm({
      day: selectedDay,
      time: '09:00 - 10:30',
      subject: '',
      curriculumSubject: '',
      classLabel: '',
      period: '',
      subjectCategory: 'Academic',
      room: 'Room 101',
      teacher: 'Noesis',
      isEvent: false,
      color: '--primary',
      enrolled: true
    });
  };

  // Export Timetable
  const handleExportTimetable = () => {
    const isMy = effectiveTab === 'my-schedule';
    const rows = [["Day", "Time", "Subject", "Teacher", "Room", "Type", "Status"]];
    days.forEach(day => {
      const dayItems = scheduleState[day] || [];
      const filtered = isMy ? dayItems.filter(isItemInMySchedule) : dayItems;
      filtered.forEach(item => {
        rows.push([
          day,
          item.time,
          item.subject,
          item.teacher || 'N/A',
          item.room,
          item.isEvent ? 'Campus Event' : (item.subjectCategory || 'Class'),
          item.enrolled ? 'Enrolled' : 'All Campus'
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const prefix = isMy ? 'My_Schedule' : 'Master_Campus_Schedule';
    link.setAttribute("download", `NoesisHorizon_${prefix}_${weekDateString.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
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
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              {t('schedule.title')}
              <Calendar size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">
              {`${currentSchedule.length} ${t('common.total')}`}
            </span>
          </div>
          <p>{t('schedule.subtitle')}</p>
        </div>

        <div className="header-actions">
          {/* Segmented Schedule View Switcher - ONLY for Students and Teachers */}
          {userRole !== 'admin' && (
            <div className="schedule-segmented-toggle glass">
              <button
                type="button"
                className={`segmented-tab ${effectiveTab === 'my-schedule' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-schedule')}
                title={userRole === 'student' ? (isAlbanian ? 'Shfaq Lëndët & Ngjarjet e Mia' : 'Show My Enrolled Classes & Events') : (isAlbanian ? 'Shfaq Orarin Tim Mësimor' : 'Show My Teaching Timetable')}
              >
                <Calendar size={14} />
                <span>{userRole === 'student' ? (isAlbanian ? 'Orari Im' : 'My Schedule') : (isAlbanian ? 'Orari Im Mësimor' : 'My Timetable')}</span>
                <span className="segmented-counter">{myScheduleCount}</span>
              </button>
              <button
                type="button"
                className={`segmented-tab ${effectiveTab === 'all-schedule' ? 'active' : ''}`}
                onClick={() => setActiveTab('all-schedule')}
                title={isAlbanian ? 'Shfaq Orarin Kryesor të Shkollës' : 'Show Master Campus Schedule'}
              >
                <Layers size={14} />
                <span>{isAlbanian ? 'I Gjithë Kampusi' : 'All Campus'}</span>
                <span className="segmented-counter">{allScheduleCount}</span>
              </button>
            </div>
          )}

          {/* Interactive Week Navigator */}
          <div className="week-selector-card glass">
            <button 
              className="week-nav-btn glass" 
              onClick={() => setWeekOffset(prev => prev - 1)}
              title={isAlbanian ? 'Java e Kaluar' : 'Previous Week'}
              aria-label="Previous Week"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="week-date-info">
              <span className="week-label">{weekDateString}</span>
              {weekOffset === 0 ? (
                <span className="current-week-tag">{isAlbanian ? 'Java Aktuale' : 'Current Week'}</span>
              ) : (
                <button 
                  className="reset-week-btn" 
                  onClick={() => setWeekOffset(0)}
                  title={isAlbanian ? 'Kthehu te java aktuale' : 'Jump to current week'}
                >
                  <RotateCcw size={11} /> {isAlbanian ? 'Rivendos' : 'Reset'}
                </button>
              )}
            </div>

            <button 
              className="week-nav-btn glass" 
              onClick={() => setWeekOffset(prev => prev + 1)}
              title={isAlbanian ? 'Java e Ardhshme' : 'Next Week'}
              aria-label="Next Week"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button className="btn-secondary glass" onClick={handleExportTimetable} title={isAlbanian ? 'Eksporto Orarin CSV' : 'Export CSV Timetable'}>
            <Download size={16} />
            <span className="export-btn-text">{isAlbanian ? 'Eksporto Orarin' : (userRole === 'admin' || effectiveTab === 'all-schedule' ? 'Export Master' : 'Export Timetable')}</span>
          </button>
          
          {userRole !== 'student' && (
            <button className="btn-primary" onClick={() => setIsAddSlotOpen(true)}>
              <Plus size={16} />
              <span>{t('schedule.addEntry')}</span>
            </button>
          )}
        </div>
      </header>

      {/* Filter Controls Bar */}
      <div className="schedule-filters-container glass">
        {/* Search Bar */}
        <div className="search-bar-wrap">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={effectiveTab === 'my-schedule' ? (isAlbanian ? 'Kërko në orarin tim, sallat, apo mësimdhënësit...' : 'Search within my scheduled classes, rooms, or teachers...') : (isAlbanian ? 'Kërko të gjitha lëndët, mësimdhënësit, sallat, apo ngjarjet...' : 'Search all classes, teachers, subjects, rooms, or events...')} 
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
            <label><User size={13} /> {isAlbanian ? 'MËSIMDHËNËSI:' : 'Teacher:'}</label>
            <select 
              value={teacherFilter} 
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="schedule-filter-select glass"
            >
              {teachersList.map(t => (
                <option key={t} value={t}>
                  {t === 'all' ? (isAlbanian ? 'Të Gjithë Mësimdhënësit' : 'All Teachers & Faculty') : t}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group-item">
            <label><Tag size={13} /> {isAlbanian ? 'LËNDA / KATEGORIA:' : 'Subject / Category:'}</label>
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="schedule-filter-select glass"
            >
              {categoriesList.map(c => {
                const categoryTranslations = {
                  'Math': 'Matematikë',
                  'Science': 'Shkencë',
                  'Humanities': 'Shkenca Shoqërore',
                  'Technology': 'Teknologji',
                  'Arts': 'Arte',
                  'Athletics': 'Edukim Fizik',
                  'Event': 'Ngjarje'
                };
                const displayCategory = isAlbanian && categoryTranslations[c] ? categoryTranslations[c] : c;
                return (
                  <option key={c} value={c}>
                    {c === 'all' ? (isAlbanian ? 'Të Gjitha Lëndët & Fushat' : 'All Subjects & Domains') : displayCategory}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="type-toggle-pills glass">
            <button 
              className={`type-pill ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              {isAlbanian ? 'Të Gjitha' : 'All'}
            </button>
            <button 
              className={`type-pill ${typeFilter === 'classes' ? 'active' : ''}`}
              onClick={() => setTypeFilter('classes')}
            >
              {isAlbanian ? 'Lëndët' : 'Classes'}
            </button>
            <button 
              className={`type-pill ${typeFilter === 'events' ? 'active' : ''}`}
              onClick={() => setTypeFilter('events')}
            >
              {isAlbanian ? 'Ngjarjet' : 'Events'}
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
              <RotateCcw size={13} /> {isAlbanian ? 'Pastro Filtrat' : 'Clear Filters'}
            </button>
          )}
        </div>
      </div>

      {/* Day Selector with Clean Shadows */}
      <div className="day-selector-container">
        {days.map(day => {
          const count = (scheduleState[day] || []).filter(item => effectiveTab === 'my-schedule' ? isItemInMySchedule(item) : true).length;
          return (
            <button 
              key={day}
              className={`day-btn ${selectedDay === day ? 'active glass' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              <span className="day-name">{t(`schedule.${day.toLowerCase()}`, day)}</span>
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
              <h3>
                {effectiveTab === 'my-schedule'
                  ? (isAlbanian ? `Nuk ka lëndë të planifikuara në orarin tuaj për ${t('schedule.' + selectedDay.toLowerCase(), selectedDay)}` : `No classes scheduled in your personal timetable for ${selectedDay}`)
                  : (isAlbanian ? `Nuk u gjetën orë të planifikuara për ${t('schedule.' + selectedDay.toLowerCase(), selectedDay)}` : `No scheduled periods found for ${selectedDay}`)}
              </h3>
              <p>
                {effectiveTab === 'my-schedule'
                  ? (isAlbanian ? 'Nuk keni lëndë të regjistruara apo ngjarje për këtë ditë. Kaloni te "I Gjithë Kampusi" për të parë orarin e përgjithshëm.' : 'You have no enrolled classes or registered events for this day. Switch to "All Campus Schedule" to view what is happening campus-wide.')
                  : (isAlbanian ? 'Provoni të rregulloni filtrat e kërkimit ose kaloni në një ditë tjetër të javës.' : 'Try adjusting your search criteria or switch to another day of the week.')}
              </p>
              {effectiveTab === 'my-schedule' && userRole !== 'admin' ? (
                <button 
                  className="btn-secondary glass btn-small"
                  onClick={() => setActiveTab('all-schedule')}
                >
                  {isAlbanian ? 'Eksploro Orarin e Shkollës' : 'Browse All Campus Schedule'}
                </button>
              ) : hasActiveFilters ? (
                <button 
                  className="btn-secondary glass btn-small"
                  onClick={() => { setSearchTerm(''); setTeacherFilter('all'); setCategoryFilter('all'); setTypeFilter('all'); }}
                >
                  {isAlbanian ? 'Rivendos Filtrat' : 'Reset Active Filters'}
                </button>
              ) : null}
            </div>
          ) : (
            <AnimatePresence>
              {currentSchedule.map((item, index) => (
                <ScheduleItem 
                  key={item.id} 
                  item={item} 
                  delay={index * 0.05} 
                  onClick={handleClassClick}
                  activeTab={effectiveTab}
                  userRole={userRole}
                  onDeleteSlot={handleDeleteSlot}
                  isAlbanian={isAlbanian}
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
                <h3>{isAlbanian ? 'Shto Orë ose Ngjarje' : 'Add Period or Event'}</h3>
                <p className="modal-subtitle">{isAlbanian ? 'Planifikoni një orë mësimore, sesion laboratori, ose ngjarje të shkollës.' : 'Schedule a class period, laboratory session, or campus event.'}</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddSlotOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddSlotSubmit} className="modal-form">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Dita e Javës' : 'Day of Week'}</label>
                    <select 
                      value={newSlotForm.day}
                      onChange={e => setNewSlotForm({ ...newSlotForm, day: e.target.value })}
                      className="custom-form-select"
                    >
                      {days.map(d => (
                        <option key={d} value={d}>{t(`schedule.${d.toLowerCase()}`, d)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Orari' : 'Time Slot'}</label>
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
                  <label>{isAlbanian ? 'Titulli i Lëndës / Ngjarjes' : 'Subject / Event Title'}</label>
                  <input 
                    type="text" 
                    required 
                    placeholder={isAlbanian ? 'p.sh. Kalkulus i Avancuar, Punëtori Robotike' : 'e.g. Advanced Calculus, Robotics Workshop'}
                    value={newSlotForm.subject}
                    onChange={e => setNewSlotForm({ ...newSlotForm, subject: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="schedule-class-label">{isAlbanian ? 'Klasa' : 'Class'}</label>
                    <input
                      id="schedule-class-label"
                      type="text"
                      required
                      placeholder="e.g. VII/1"
                      value={newSlotForm.classLabel}
                      onChange={e => setNewSlotForm({ ...newSlotForm, classLabel: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="schedule-period">{isAlbanian ? 'Ora Mësimore' : 'Period'}</label>
                    <input
                      id="schedule-period"
                      type="number"
                      min="1"
                      max="12"
                      required
                      placeholder="e.g. 2"
                      value={newSlotForm.period}
                      onChange={e => setNewSlotForm({ ...newSlotForm, period: e.target.value })}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="schedule-curriculum-subject">{isAlbanian ? 'Lënda kurrikulare për planin mësimor' : 'Curriculum subject for lesson planning'}</label>
                  <select
                    id="schedule-curriculum-subject"
                    className="custom-form-select"
                    required
                    value={newSlotForm.curriculumSubject}
                    onChange={e => setNewSlotForm({ ...newSlotForm, curriculumSubject: e.target.value })}
                  >
                    <option value="">{isAlbanian ? 'Zgjidh lëndën' : 'Select subject'}</option>
                    {SUBJECTS.map(subject => (
                      <option key={subject.name} value={subject.name}>{translateCatalogValue(lessonLanguage, subject.name)}</option>
                    ))}
                  </select>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Mësimdhënësi / Organizatori' : 'Instructor / Host'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. Dr. Sarah Smith' : 'e.g. Dr. Sarah Smith'}
                      value={newSlotForm.teacher}
                      onChange={e => setNewSlotForm({ ...newSlotForm, teacher: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Salla / Lokacioni' : 'Room / Location'}</label>
                    <input 
                      type="text" 
                      required
                      placeholder={isAlbanian ? 'p.sh. Salla 302, Palestra' : 'e.g. Room 302, Main Gym'}
                      value={newSlotForm.room}
                      onChange={e => setNewSlotForm({ ...newSlotForm, room: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Kategoria' : 'Category'}</label>
                    <select 
                      value={newSlotForm.subjectCategory}
                      onChange={e => setNewSlotForm({ ...newSlotForm, subjectCategory: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="Math">{isAlbanian ? 'Matematikë' : 'Mathematics'}</option>
                      <option value="Science">{isAlbanian ? 'Shkencë & Laboratore' : 'Science & Labs'}</option>
                      <option value="Humanities">{isAlbanian ? 'Shkenca Shoqërore & Gjuhë' : 'Humanities & Languages'}</option>
                      <option value="Technology">{isAlbanian ? 'Teknologji & TIK' : 'Technology & CS'}</option>
                      <option value="Arts">{isAlbanian ? 'Art & Muzikë' : 'Arts & Music'}</option>
                      <option value="Athletics">{isAlbanian ? 'Edukim Fizik & Sport' : 'Athletics & PE'}</option>
                      <option value="Event">{isAlbanian ? 'Ngjarje Shkollore' : 'Campus Event'}</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Ngjyra e Theksit' : 'Color Accent'}</label>
                    <select 
                      value={newSlotForm.color}
                      onChange={e => setNewSlotForm({ ...newSlotForm, color: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="--primary">{isAlbanian ? 'Tema Kryesore (Vjollcë)' : 'Primary Theme (Purple)'}</option>
                      <option value="--accent">{isAlbanian ? 'Vjollcë e Çelët' : 'Accent Violet'}</option>
                      <option value="--chart-1">{isAlbanian ? 'Rozë' : 'Chart Rose'}</option>
                      <option value="--chart-2">{isAlbanian ? 'Indigo' : 'Chart Indigo'}</option>
                      <option value="--chart-3">{isAlbanian ? 'Cian' : 'Chart Cyan'}</option>
                      <option value="--mood-happy">{isAlbanian ? 'E Gjelbër Smerald' : 'Emerald Green'}</option>
                    </select>
                  </div>
                </div>

                {userRole !== 'admin' && (
                  <div className="input-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem' }}>
                    <input 
                      type="checkbox" 
                      id="enrolledCheck"
                      checked={newSlotForm.enrolled}
                      onChange={e => setNewSlotForm({ ...newSlotForm, enrolled: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="enrolledCheck" style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                      {userRole === 'teacher' ? (isAlbanian ? 'Përfshi në orarin tim mësimor' : 'Include in personal teaching timetable') : (isAlbanian ? 'Përfshi në orarin tim personal' : 'Include in personal student timetable')}
                    </label>
                  </div>
                )}

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddSlotOpen(false)}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary">
                    {isAlbanian ? 'Ruaj në Orar' : 'Save to Schedule'}
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
        userRole={userRole}
        onCreateLessonPlan={selectedClass && (userRole === 'admin' || (userRole === 'teacher' && selectedClass.teacher === 'Noesis')) ? handleCreateLessonPlan : undefined}
        lessonLanguage={lessonLanguage}
      />
    </div>
  );
};

export default Schedule;

