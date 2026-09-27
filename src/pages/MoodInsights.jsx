import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smile, Meh, Frown, Target, Calendar, 
  ChevronDown, ArrowUpRight, ArrowDownRight, 
  TrendingUp, BarChart3, Filter, Download
} from 'lucide-react';
import { useMood } from '../context/MoodContext';
import { useLanguage } from '../context/LanguageContext';
import './MoodInsights.css';

const MoodInsights = () => {
  const { moodHistory } = useMood();
  const { language, t, isAlbanian } = useLanguage();
  const [dateRange, setDateRange] = useState('7days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getMoodIcon = (mood) => {
    switch(mood) {
      case 'happy': return <Smile className="mood-icon happy" size={20} />;
      case 'neutral': return <Meh className="mood-icon neutral" size={20} />;
      case 'sad': return <Frown className="mood-icon sad" size={20} />;
      default: return <Meh className="mood-icon" size={20} />;
    }
  };

  // Simple calculation for dominant mood
  const happyCount = moodHistory.filter(m => m.mood === 'happy').length;
  const dominantMood = happyCount >= (moodHistory.length / 2) ? 'Happy' : 'Balanced';

  return (
    <motion.div 
      className="mood-insights-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <header className="page-header">
        <div className="header-content">
          <div className="title-with-icon">
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              {t('mood.title')}
              <BarChart3 size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
          </div>
          <p>{t('mood.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="icon-btn glass bouncy" title={isAlbanian ? 'Shkarko Të Dhënat' : 'Download Data'}>
            <Download size={20} />
          </button>
          <div className="range-pills glass">
            {['7days', '30days', 'alltime', 'custom'].map((range) => (
              <button 
                key={range}
                className={`range-pill ${dateRange === range ? 'active' : ''}`}
                onClick={() => setDateRange(range)}
              >
                {range === '7days' && t('mood.days7')}
                {range === '30days' && t('mood.days30')}
                {range === 'alltime' && t('mood.allTime')}
                {range === 'custom' && t('mood.custom')}
              </button>
            ))}
            <motion.div 
              className="range-pill-bg"
              layoutId="range-pill-bg"
              initial={false}
              animate={{ 
                x: dateRange === '7days' ? '0%' : 
                   dateRange === '30days' ? '100%' : 
                   dateRange === 'alltime' ? '200%' : '300%' 
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          </div>
        </div>
      </header>

      {dateRange === 'custom' && (
        <motion.div 
          className="custom-date-row glass"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <div className="input-group">
            <label>{isAlbanian ? 'Data e Fillimit' : 'Start Date'}</label>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          </div>
          <div className="input-group">
            <label>{isAlbanian ? 'Data e Mbarimit' : 'End Date'}</label>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
          <button className="btn-primary">{isAlbanian ? 'Apliko Filtrin' : 'Apply Filter'}</button>
        </motion.div>
      )}

      <div className="insights-grid">
        <section className="stats-cards">
          <div className="stat-card glass bouncy">
            <div className="stat-header">
              <div className="stat-icon-wrap happy-bg">
                <Smile size={24} />
              </div>
              <span className="stat-trend positive">
                <ArrowUpRight size={16} /> {isAlbanian ? 'Të Dhëna të Regjistruara' : 'Logged Data'}
              </span>
            </div>
            <div className="stat-body">
              <h3>
                {dominantMood === 'Happy' ? (isAlbanian ? 'I Gëzuar' : 'Happy') : (isAlbanian ? 'I Balancuar' : 'Balanced')} - {t('mood.dominantVibe')}
              </h3>
              <p>{isAlbanian ? `Bazuar në ${moodHistory.length} regjistrime gjithsej` : `Based on your ${moodHistory.length} total logs`}</p>
            </div>
            <div className="stat-footer">
              <div className="progress-bar-wrap">
                <div className="progress-bar" style={{ width: `${moodHistory.length ? (happyCount/moodHistory.length)*100 : 0}%` }}></div>
              </div>
            </div>
          </div>
        </section>

        <section className="chart-section glass">
          <div className="chart-header">
            <h3>{t('mood.moodTrend')}</h3>
            <div className="chart-legend">
              <span className="legend-item"><span className="dot happy-dot"></span> {isAlbanian ? 'Gjendja e regjistruar' : 'Recorded Moods'}</span>
            </div>
          </div>
          <div className="chart-container">
            <div className="visual-chart">
               {/* Show bars based on recent history */}
               {moodHistory.slice(0, 7).reverse().map((item, i) => {
                 const intensities = { happy: 90, neutral: 60, sad: 30 };
                 const h = intensities[item.mood] || 50;
                 return (
                   <motion.div 
                     key={item.id} 
                     className="chart-bar-wrap"
                     initial={{ height: 0 }}
                     animate={{ height: `${h}%` }}
                     transition={{ delay: i * 0.1 }}
                   >
                     <div className={`chart-bar happy-bar`}>
                       <div className="bar-tooltip">
                         {item.mood === 'happy' ? (isAlbanian ? 'I GËZUAR' : 'HAPPY') : item.mood === 'neutral' ? (isAlbanian ? 'I BALANCUAR' : 'BALANCED') : (isAlbanian ? 'E VËSHTIRË' : 'TOUGH')}
                       </div>
                     </div>
                     <span className="bar-label">{new Date(item.date).toLocaleDateString(isAlbanian ? 'sq-AL' : 'en-US', { weekday: 'short' })}</span>
                   </motion.div>
                 );
               })}
            </div>
          </div>
        </section>

        <section className="history-section glass">
          <div className="section-header">
            <h3>{t('mood.historyLog')}</h3>
            <button className="text-btn">{t('common.delete')}</button>
          </div>
          <div className="history-list">
            {moodHistory.map((item) => (
              <div key={item.id} className="history-item glass bouncy">
                <div className="history-left">
                  <div className={`mood-badge ${item.mood}`}>
                    {getMoodIcon(item.mood)}
                  </div>
                  <div className="history-details">
                    <strong>{item.note || (isAlbanian ? 'Pa shënim' : 'No note added')}</strong>
                    <span>{new Date(item.date).toLocaleDateString(isAlbanian ? 'sq-AL' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="history-right">
                  <div className={`mood-status-tag ${item.mood}`}>
                    {item.mood === 'happy' ? (isAlbanian ? 'I GËZUAR' : 'HAPPY') : item.mood === 'neutral' ? (isAlbanian ? 'I QETË' : 'NEUTRAL') : (isAlbanian ? 'E VËSHTIRË' : 'TOUGH')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
};

export default MoodInsights;
