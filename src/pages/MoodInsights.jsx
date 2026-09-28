import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Smile, Meh, Frown, BarChart3, Download, Sparkles } from 'lucide-react';
import { useMood } from '../context/MoodContext';
import { useLanguage } from '../context/LanguageContext';
import { entriesInRange, localDateKey, moodEntryDate, summarizeMoods } from '../features/moods';
import './MoodInsights.css';

const RANGES = ['7days', '30days', 'alltime', 'custom'];
const CHART_LIMIT = 14;
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

const MoodInsights = () => {
  const { moodHistory } = useMood();
  const { t, isAlbanian } = useLanguage();
  const [dateRange, setDateRange] = useState('7days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const locale = isAlbanian ? 'sq-AL' : 'en-US';

  const moodName = mood => ({
    happy: isAlbanian ? 'I gëzuar' : 'Happy',
    neutral: isAlbanian ? 'I qetë' : 'Neutral',
    sad: isAlbanian ? 'E vështirë' : 'Tough',
    mixed: isAlbanian ? 'E përzier' : 'Mixed',
  }[mood] || mood);
  const moodIcon = (mood, size = 20) => {
    if (mood === 'happy') return <Smile className="mood-icon happy" size={size} />;
    if (mood === 'sad') return <Frown className="mood-icon sad" size={size} />;
    return <Meh className="mood-icon neutral" size={size} />;
  };

  const entries = useMemo(() => entriesInRange(moodHistory, dateRange, { today: localDateKey(), start: customStart, end: customEnd }),
    [moodHistory, dateRange, customStart, customEnd]);
  const summary = useMemo(() => summarizeMoods(entries), [entries]);
  const chartEntries = useMemo(() => entries.slice(0, CHART_LIMIT).reverse(), [entries]);
  const rangeLabel = {
    '7days': t('mood.days7'), '30days': t('mood.days30'), alltime: t('mood.allTime'), custom: t('mood.custom'),
  }[dateRange];

  const handleDownload = () => {
    if (!entries.length) return;
    const rows = [['Date', 'Mood', 'Note'], ...entries.map(entry => [entry.date, entry.mood, entry.note || ''])];
    const blob = new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mood_${localDateKey()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      className="mood-insights-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <header className="page-header">
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text">
              {t('mood.title')}
              <BarChart3 size={30} className="page-title-icon" aria-hidden="true" />
            </h1>
          </div>
          <p>{t('mood.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="icon-btn glass bouncy" onClick={handleDownload} disabled={!entries.length}
            title={isAlbanian ? 'Shkarko të dhënat (CSV)' : 'Download data (CSV)'} aria-label={isAlbanian ? 'Shkarko të dhënat' : 'Download data'}>
            <Download size={20} />
          </button>
          <div className="range-pills glass" role="group" aria-label={isAlbanian ? 'Periudha' : 'Date range'}>
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                className={`range-pill ${dateRange === range ? 'active' : ''}`}
                onClick={() => setDateRange(range)}
                aria-pressed={dateRange === range}
              >
                {range === '7days' && t('mood.days7')}
                {range === '30days' && t('mood.days30')}
                {range === 'alltime' && t('mood.allTime')}
                {range === 'custom' && t('mood.custom')}
              </button>
            ))}
            <motion.div
              className="range-pill-bg"
              initial={false}
              animate={{ x: `${RANGES.indexOf(dateRange) * 100}%` }}
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
            <label htmlFor="mood-start">{isAlbanian ? 'Data e fillimit' : 'Start date'}</label>
            <input id="mood-start" type="date" value={customStart} max={customEnd || undefined} onChange={(e) => setCustomStart(e.target.value)} />
          </div>
          <div className="input-group">
            <label htmlFor="mood-end">{isAlbanian ? 'Data e mbarimit' : 'End date'}</label>
            <input id="mood-end" type="date" value={customEnd} min={customStart || undefined} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        </motion.div>
      )}

      {moodHistory.length === 0 ? (
        <section className="mood-empty glass">
          <Sparkles size={36} />
          <h3>{isAlbanian ? 'Ende nuk keni regjistruar gjendje' : 'No moods logged yet'}</h3>
          <p>{isAlbanian ? 'Zgjidhni si ndiheni te "Gjendja e sotme" në panelin kryesor. Statistikat shfaqen këtu.' : 'Pick how you feel under "Today\'s vibe" on the dashboard. Your insights will appear here.'}</p>
        </section>
      ) : (
      <div className="insights-grid">
        <section className="stats-cards">
          <div className="stat-card glass">
            <div className="stat-header">
              <div className={`stat-icon-wrap mood-bg-${summary.dominant || 'none'}`}>
                {summary.dominant && summary.dominant !== 'mixed' ? moodIcon(summary.dominant, 24) : <Meh size={24} />}
              </div>
              <span className="stat-trend">{rangeLabel}</span>
            </div>
            <div className="stat-body">
              <h3>
                {summary.dominant
                  ? `${moodName(summary.dominant)} · ${t('mood.dominantVibe')}`
                  : (isAlbanian ? 'Asnjë regjistrim në këtë periudhë' : 'No entries in this period')}
              </h3>
              <p>{summary.total
                ? (isAlbanian ? `Bazuar në ${summary.total} regjistrime` : `Based on ${summary.total} ${summary.total === 1 ? 'entry' : 'entries'}`)
                : (isAlbanian ? 'Provoni një periudhë tjetër.' : 'Try another date range.')}</p>
            </div>
            {summary.total > 0 && (
              <div className="mood-breakdown">
                {['happy', 'neutral', 'sad'].map(mood => (
                  <div key={mood} className="mood-breakdown-row">
                    <span className="mood-breakdown-label">{moodIcon(mood, 14)} {moodName(mood)}</span>
                    <div className="progress-bar-wrap">
                      <div className={`progress-bar mood-fill-${mood}`} style={{ width: `${(summary.counts[mood] / summary.total) * 100}%` }} />
                    </div>
                    <span className="mood-breakdown-count">{summary.counts[mood]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="chart-section glass">
          <div className="chart-header">
            <h3>{t('mood.moodTrend')}</h3>
            <div className="chart-legend">
              {['happy', 'neutral', 'sad'].map(mood => (
                <span key={mood} className="legend-item"><span className={`dot mood-dot-${mood}`}></span> {moodName(mood)}</span>
              ))}
            </div>
          </div>
          <div className="chart-container">
            {chartEntries.length === 0 ? (
              <p className="chart-empty">{isAlbanian ? 'Asnjë regjistrim në këtë periudhë.' : 'No entries in this period.'}</p>
            ) : (
              <div className="visual-chart">
                {chartEntries.map((item, i) => {
                  const heights = { happy: 90, neutral: 60, sad: 30 };
                  return (
                    <motion.div
                      key={item.id || item.date}
                      className="chart-bar-wrap"
                      initial={{ height: 0 }}
                      animate={{ height: `${heights[item.mood]}%` }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className={`chart-bar mood-bar-${item.mood}`}>
                        <div className="bar-tooltip">{moodName(item.mood)}</div>
                      </div>
                      <span className="bar-label">{moodEntryDate(item.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="history-section glass">
          <div className="section-header">
            <h3>{t('mood.historyLog')}</h3>
            <span className="history-count">{entries.length}</span>
          </div>
          <div className="history-list">
            {entries.length === 0 ? (
              <p className="chart-empty">{isAlbanian ? 'Asnjë regjistrim në këtë periudhë.' : 'No entries in this period.'}</p>
            ) : entries.map((item) => (
              <div key={item.id || item.date} className="history-item glass">
                <div className="history-left">
                  <div className={`mood-badge ${item.mood}`}>
                    {moodIcon(item.mood)}
                  </div>
                  <div className="history-details">
                    <strong>{item.note || (isAlbanian ? 'Pa shënim' : 'No note added')}</strong>
                    <span>{moodEntryDate(item.date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="history-right">
                  <div className={`mood-status-tag ${item.mood}`}>
                    {moodName(item.mood)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      )}
    </motion.div>
  );
};

export default MoodInsights;
