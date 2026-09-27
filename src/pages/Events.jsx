import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, MapPin, Clock, Users, Plus, Star, 
  X, Check, Download, Sparkles, Filter 
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { useLanguage } from '../context/LanguageContext';
import './Events.css';

const INITIAL_EVENTS = [];

const EventCard = ({ event, onToggleStar, t, isAlbanian }) => (
  <motion.div 
    className="event-card-large glass bouncy"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.9 }}
    layout
    style={{ borderLeft: `6px solid hsl(var(${event.color || '--primary'}))` }}
  >
    <div className="event-date-box" style={{ background: `hsla(var(${event.color || '--primary'}), 0.15)`, color: `hsl(var(${event.color || '--primary'}))` }}>
      <span className="event-month">{new Date(event.date || Date.now()).toLocaleString(isAlbanian ? 'sq-AL' : 'default', { month: 'short' })}</span>
      <span className="event-day">{new Date(event.date || Date.now()).getDate()}</span>
    </div>
    
    <div className="event-main-info">
      <div className="event-header">
        <h3>{event.title}</h3>
        <span className="event-type-badge" style={{ background: `hsla(var(${event.color || '--primary'}), 0.2)`, color: `hsl(var(${event.color || '--primary'}))` }}>
          {isAlbanian ? (
            event.type === 'Academic' ? 'Akademike' :
            event.type === 'Sports' ? 'Sport' :
            event.type === 'Arts' ? 'Arte' :
            event.type === 'Staff' ? 'Stafi' :
            event.type === 'Meeting' ? 'Mbledhje' : event.type
          ) : event.type}
        </span>
      </div>
      
      <div className="event-meta-grid">
        <div className="meta-info">
          <Clock size={16} />
          <span>{event.time}</span>
        </div>
        <div className="meta-info">
          <MapPin size={16} />
          <span>{event.location}</span>
        </div>
        <div className="meta-info">
          <Users size={16} />
          <span>{event.attendees || 0} {t('events.registered', 'Registered')}</span>
        </div>
      </div>
    </div>
    
    <div className="event-actions">
      <button 
        className={`icon-btn-secondary bouncy ${event.starred ? 'starred' : ''}`}
        onClick={() => onToggleStar(event.id)}
        title={event.starred ? t('events.starred', 'Starred Event') : 'Star Event'}
      >
        <Star size={18} fill={event.starred ? 'hsl(var(--mood-neutral))' : 'none'} color={event.starred ? 'hsl(var(--mood-neutral))' : 'currentColor'} />
      </button>
      <button className="btn-secondary glass btn-small">{t('events.details', 'Details')}</button>
    </div>
  </motion.div>
);

const Events = ({ userRole = 'student' }) => {
  const { eventsList = [], addEvent, updateEvent } = useSchoolData();
  const { t, isAlbanian } = useLanguage();
  const [filter, setFilter] = useState('All');
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);

  // New Event Form State
  const [eventForm, setEventForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM - 12:00 PM',
    location: 'Main Auditorium',
    type: 'Academic',
    color: '--primary',
    attendees: 0
  });
  
  const types = userRole === 'student' 
    ? ['All', 'Academic', 'Sports', 'Arts', 'Starred'] 
    : ['All', 'Academic', 'Sports', 'Arts', 'Staff', 'Meeting'];

  const getFilterLabel = (key) => {
    switch(key) {
      case 'All': return t('common.all', 'All');
      case 'Academic': return t('events.academic', 'Academic');
      case 'Sports': return t('events.sports', 'Sports');
      case 'Arts': return t('events.arts', 'Arts');
      case 'Starred': return t('events.starred', 'Starred');
      case 'Staff': return t('events.staff', 'Staff');
      case 'Meeting': return t('events.meeting', 'Meeting');
      default: return key;
    }
  };

  const filteredEvents = filter === 'All' 
    ? (userRole === 'student' ? eventsList.filter(e => e.type !== 'Staff') : eventsList)
    : filter === 'Starred'
    ? eventsList.filter(e => e.starred)
    : eventsList.filter(e => e.type === filter);

  const toggleStar = (id) => {
    const ev = eventsList.find(e => e.id === id);
    if (ev && updateEvent) {
      updateEvent(id, { starred: !ev.starred });
    }
  };

  const handleAddEventSubmit = async (e) => {
    e.preventDefault();
    if (!eventForm.title) return;

    const newEvent = {
      ...eventForm,
      attendees: Number(eventForm.attendees) || 0,
      starred: false
    };

    if (addEvent) {
      await addEvent(newEvent);
    }
    setIsNewEventOpen(false);
    setEventForm({
      title: '',
      date: new Date().toISOString().split('T')[0],
      time: '10:00 AM - 12:00 PM',
      location: 'Main Auditorium',
      type: 'Academic',
      color: '--primary',
      attendees: 0
    });
  };

  const handleExportEvents = () => {
    const rows = [["Title", "Date", "Time", "Location", "Category", "Attendees"]];
    eventsList.forEach(e => {
      rows.push([e.title, e.date, e.time, e.location, e.type, e.attendees]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NoesisHorizon_Events_Calendar_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="events-page">
      <header className="page-header">
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              {t('events.title', userRole === 'student' ? 'Campus & Academic Events' : 'Campus Events Calendar')}
              <CalendarIcon size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">{filteredEvents.length} {t('events.title', 'Events')}</span>
          </div>
          <p>
            {t('events.subtitle', userRole === 'student'
              ? 'Stay informed with school-wide assemblies, academic dates, science fairs, and extracurriculars.'
              : 'School-wide events, assemblies, holidays, and extracurricular schedules.')}
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-secondary glass" onClick={handleExportEvents} title="Export Calendar">
            <Download size={18} />
            {t('events.export', 'Export Events')}
          </button>
          {userRole !== 'student' && (
            <button className="btn-primary" onClick={() => setIsNewEventOpen(true)}>
              <Plus size={18} />
              {t('events.addEvent', 'Schedule Event')}
            </button>
          )}
        </div>
      </header>

      <div className="events-controls glass">
        <div className="filter-scroll">
          {types.map(filt => (
            <button 
              key={filt}
              className={`filter-pill ${filter === filt ? 'active' : ''}`}
              onClick={() => setFilter(filt)}
            >
              {getFilterLabel(filt)} {filt === 'All' ? `(${eventsList.length})` : `(${eventsList.filter(e => e.type === filt).length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="events-feed">
        <AnimatePresence>
          {filteredEvents.map(event => (
            <EventCard key={event.id} event={event} onToggleStar={toggleStar} t={t} isAlbanian={isAlbanian} />
          ))}
          {filteredEvents.length === 0 && (
            <motion.div 
              className="empty-state glass"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <CalendarIcon size={48} color="hsl(var(--muted-foreground))" />
              <h3>{t('common.noData', 'No events found')}</h3>
              <p>{isAlbanian ? 'Nuk ka ngjarje të planifikuara për këtë kategori.' : 'There are no events scheduled for this category.'}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── MODAL: Add New Event ── */}
      <AnimatePresence>
        {isNewEventOpen && (
          <div className="modal-overlay" onClick={() => setIsNewEventOpen(false)}>
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{t('events.addEvent', 'Schedule Event')}</h3>
                <p className="modal-subtitle">{isAlbanian ? 'Planifikoni mbledhje shkollore, provime, ndeshje sportive apo aktivitete klubesh.' : 'Schedule a school assembly, exam, sports match, or club activity.'}</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsNewEventOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddEventSubmit} className="modal-form">
                <div className="input-group">
                  <label>{isAlbanian ? 'Titulli i Ngjarjes' : 'Event Title'}</label>
                  <input 
                    type="text" 
                    required 
                    placeholder={isAlbanian ? 'p.sh. Panairi Vjetor STEM, Finalet e Basketbollit' : 'e.g. Annual STEM Expo, Basketball Finals'}
                    value={eventForm.title}
                    onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{t('common.date', 'Event Date')}</label>
                    <input 
                      type="date" 
                      required 
                      value={eventForm.date}
                      onChange={e => setEventForm({ ...eventForm, date: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{t('common.time', 'Time Interval')}</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. 09:00 AM - 02:00 PM"
                      value={eventForm.time}
                      onChange={e => setEventForm({ ...eventForm, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Lokacioni / Salla' : 'Location / Venue'}</label>
                    <input 
                      type="text" 
                      required 
                      placeholder={isAlbanian ? 'p.sh. Amfiteatri Kryesor, Salla e Sporteve' : 'e.g. Main Auditorium, Gymnasium'}
                      value={eventForm.location}
                      onChange={e => setEventForm({ ...eventForm, location: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Kategoria' : 'Event Category'}</label>
                    <select 
                      value={eventForm.type}
                      onChange={e => setEventForm({ ...eventForm, type: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="Academic">{t('events.academic', 'Academic')}</option>
                      <option value="Staff">{t('events.staff', 'Staff')}</option>
                      <option value="Meeting">{t('events.meeting', 'Meeting')}</option>
                      <option value="Sports">{t('events.sports', 'Sports')}</option>
                      <option value="Arts">{t('events.arts', 'Arts & Culture')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Pjesëmarrës të Pritur' : 'Expected Attendees'}</label>
                    <input 
                      type="number" 
                      min="1"
                      placeholder="e.g. 100"
                      value={eventForm.attendees}
                      onChange={e => setEventForm({ ...eventForm, attendees: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Ngjyra e Shenjës' : 'Badge Color Accent'}</label>
                    <select 
                      value={eventForm.color}
                      onChange={e => setEventForm({ ...eventForm, color: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="--primary">{isAlbanian ? 'Vjollcë Kryesore' : 'Primary (Purple)'}</option>
                      <option value="--accent">{isAlbanian ? 'Vjollcë e Çelët' : 'Accent (Violet)'}</option>
                      <option value="--chart-1">{isAlbanian ? 'Rozë' : 'Rose Pink'}</option>
                      <option value="--chart-2">{isAlbanian ? 'Kaltër Indigo' : 'Indigo Blue'}</option>
                      <option value="--chart-4">{isAlbanian ? 'Portokalli e Artë' : 'Amber Orange'}</option>
                      <option value="--mood-happy">{isAlbanian ? 'E Gjelbër Smerald' : 'Emerald Green'}</option>
                    </select>
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsNewEventOpen(false)}>
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button type="submit" className="btn-primary">
                    {isAlbanian ? 'Publiko Ngjarjen' : 'Publish Event'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Events;
