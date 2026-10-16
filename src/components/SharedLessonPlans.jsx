import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { Archive, ArrowLeft, Eye, History, Search } from 'lucide-react';
import { db } from '../services/firebase';
import { filterSharedPlans, historyTime } from '../features/lessonPlans/sharing';
import { reviewSharedPlan } from '../features/lessonPlans/sharingCloud';
import { shareText } from '../features/lessonPlans/sharingI18n';
import { translate } from '../features/lessonPlans/i18n';
import LessonPlanDocument from '../pages/LessonPlanDocument';
import LessonPlanHistory from './LessonPlanHistory';
import FilterSelect from './FilterSelect';

const dates = ['all', 'today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'last7Days', 'custom'];

function SharedPlanReview({ schoolId, selected, identity, language, onBack }) {
  const s = key => shareText(language, key);
  const [plan, setPlan] = useState(null);
  const [record, setRecord] = useState(null);
  const [available, setAvailable] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const versionReady = available && record && plan && (plan.updatedAt || '') === record.planUpdatedAt;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'instant' });
    const offInbox = onSnapshot(doc(db, 'schools', schoolId, 'lessonPlanInbox', selected.planId), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.hasPendingWrites) return;
      setRecord(snapshot.exists() ? snapshot.data() : null);
      if (!snapshot.exists()) { setAvailable(false); setPlan(null); setShowHistory(true); }
      else setAvailable(true);
    }, () => { setAvailable(false); setPlan(null); setError(s('error')); });
    const offPlan = onSnapshot(doc(db, 'schools', schoolId, 'lessonPlans', selected.planId), snapshot => {
      setPlan(snapshot.exists() ? snapshot.data() : null);
    }, () => { setPlan(null); setAvailable(false); setShowHistory(true); });
    return () => { offInbox(); offPlan(); };
    // Translations are display-only; school/plan navigation remounts this view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, selected.planId]);
  async function review(status) {
    setBusy(true); setError('');
    try { await reviewSharedPlan(schoolId, record, identity, status); }
    catch (err) { setError(s(err.message?.startsWith('sharing.') ? err.message.slice(8) : 'error')); }
    finally { setBusy(false); }
  }
  return <section className="lesson-shared-review">
    <div className="lesson-review-toolbar"><button type="button" className="btn-secondary" onClick={onBack}><ArrowLeft size={17} />{s('back')}</button><button type="button" className="btn-secondary" aria-expanded={showHistory} onClick={() => setShowHistory(value => !value)}><History size={17} />{s('history')}</button></div>
    <div className="lesson-panel-heading"><div><h2>{record?.lessonUnit || selected.lessonUnit || translate(language, 'plans.untitledUnit')}</h2><p>{selected.ownerName} · {selected.ownerEmail}</p></div>{record && <span className="lesson-review-badge" data-review-status={record.reviewStatus}>{s(record.reviewStatus)}</span>}</div>
    <p className="lesson-review-note">{s('readonly')}</p>
    {record?.shareCycle > 1 && record.reviewStatus === 'pending' && <p className="lesson-review-note">{s('resharedNote')}</p>}
    {!available && <p role="status">{s('unavailable')}</p>}
    {error && <p className="lesson-storage-warning" role="alert">{error}</p>}
    <div className={`lesson-review-layout ${showHistory ? 'with-history' : ''}`}>
      <div>{available && !versionReady && <p role="status">{s('loading')}</p>}{versionReady && <><div className="lesson-review-toolbar"><button type="button" className="btn-secondary" disabled={busy || record.reviewStatus === 'reviewing'} onClick={() => review('reviewing')}>{s('startReview')}</button>{record.reviewStatus === 'archived' ? <button type="button" className="btn-secondary" disabled={busy} onClick={() => review('pending')}>{s('restore')}</button> : <button type="button" className="btn-primary" disabled={busy} onClick={() => review('archived')}><Archive size={17} />{s('archive')}</button>}</div><p>{s('guidance')}</p><div className="lesson-shared-paper"><LessonPlanDocument plan={plan} language={language} /></div></>}</div>
      {showHistory && <LessonPlanHistory schoolId={schoolId} planId={selected.planId} language={language} />}
    </div>
  </section>;
}

export default function SharedLessonPlans({ schoolId, identity, language }) {
  const s = key => shareText(language, key);
  const t = key => translate(language, key);
  const [status, setStatus] = useState('active');
  const [data, setData] = useState({ key: '', rows: [], loading: true, error: false });
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: '', ownerUid: 'all', subject: 'all', date: 'all', dateBasis: 'lesson', from: '', to: '' });
  const update = (key, value) => setFilters(old => ({ ...old, [key]: value }));
  const sourceKey = `${schoolId}:${status}`;
  useEffect(() => {
    const source = collection(db, 'schools', schoolId, status === 'history' ? 'lessonPlanReviewHistory' : 'lessonPlanInbox');
    const target = ['all', 'history'].includes(status) ? source : status === 'active' ? query(source, where('reviewStatus', 'in', ['pending', 'reviewing'])) : query(source, where('reviewStatus', '==', status));
    return onSnapshot(target, { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.hasPendingWrites) return;
      setData({ key: sourceKey, rows: snapshot.docs.map(entry => ({ ...entry.data(), planId: entry.id })), loading: false, error: false });
    }, () => setData({ key: sourceKey, rows: [], loading: false, error: true }));
  }, [schoolId, status, sourceKey]);
  const rows = useMemo(() => data.key === sourceKey ? data.rows : [], [data, sourceKey]);
  const authors = useMemo(() => [...new Map(rows.map(row => [row.ownerUid, row])).values()].sort((a, b) => a.ownerName.localeCompare(b.ownerName)), [rows]);
  const filtered = filterSharedPlans(rows, filters);
  if (selected) return <SharedPlanReview key={selected.planId} schoolId={schoolId} selected={selected} identity={identity} language={language} onBack={() => setSelected(null)} />;
  return <section className="lesson-list-panel glass">
    <div className="lesson-panel-heading"><div><h2>{s('heading')}</h2><p>{s('guidance')}</p></div></div>
    <div className="lesson-filters lesson-shared-filters">
      <label className="lesson-search"><Search size={17} /><input aria-label={s('search')} placeholder={s('search')} value={filters.search} onChange={e => update('search', e.target.value)} /></label>
      <FilterSelect label={s('allUsers')} value={filters.ownerUid} onChange={value => update('ownerUid', value)} options={[{ value: 'all', label: s('allUsers') }, ...authors.map(author => ({ value: author.ownerUid, label: `${author.ownerName} · ${author.ownerEmail}` }))]} />
      <FilterSelect label={t('filter.subjectAria')} value={filters.subject} onChange={value => update('subject', value)} options={[{ value: 'all', label: t('filter.allSubjects') }, ...[...new Set(rows.map(row => row.subject).filter(Boolean))].sort().map(subject => ({ value: subject, label: subject }))]} />
      <FilterSelect label={t('filter.statusAria')} value={status} onChange={setStatus} options={['active', 'pending', 'reviewing', 'archived', 'all', 'history'].map(value => ({ value, label: s(value === 'history' ? 'historyList' : ['pending', 'reviewing', 'archived'].includes(value) ? `filter_${value}` : value) }))} />
      <FilterSelect label={s('lessonDate')} value={filters.dateBasis} onChange={value => update('dateBasis', value)} options={[{ value: 'lesson', label: s('lessonDate') }, { value: 'shared', label: s('sharedDate') }]} />
      <FilterSelect label={t('filter.dateAria')} value={filters.date} onChange={value => update('date', value)} options={dates.map(value => ({ value, label: t(`date.${value}`) }))} />
      {filters.date === 'custom' && <><input type="date" aria-label={t('filter.fromDateAria')} value={filters.from} onChange={e => update('from', e.target.value)} /><input type="date" aria-label={t('filter.toDateAria')} value={filters.to} min={filters.from || undefined} onChange={e => update('to', e.target.value)} /></>}
    </div>
    {(data.key !== sourceKey || data.loading) && <p role="status">{s('loading')}</p>}
    {data.error && <p role="alert">{s('error')}</p>}
    {!data.error && data.key === sourceKey && !filtered.length && <p className="lesson-empty">{s('empty')}</p>}
    <div className="lesson-plan-list">{filtered.map(row => <article className="lesson-plan-row" key={row.planId}>
      <div className="lesson-plan-icon"><Eye size={22} /></div><div className="lesson-plan-main"><div className="lesson-plan-title"><h3><button type="button" className="lesson-plan-open-button" onClick={() => setSelected(row)}>{row.lessonUnit || t('plans.untitledUnit')}</button></h3><span className="lesson-review-badge" data-review-status={status === 'history' ? undefined : row.reviewStatus}>{status === 'history' ? s(`action_${row.lastAction}`) : s(row.reviewStatus)}</span>{row.shareCycle > 1 && <span className="lesson-review-badge">{s('reshared')}</span>}</div><p>{row.ownerName} · {row.ownerEmail}</p><p>{[row.subject, row.classLabel, row.topic].filter(Boolean).join(' · ')}</p><small>{row.lessonDate} · {s('sharedDate')}: {historyTime(row.sharedAt, language)}</small></div>
      <div className="lesson-plan-actions"><button type="button" onClick={() => setSelected(row)}><Eye size={16} />{s('view')}</button></div>
    </article>)}</div>
  </section>;
}
