import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { History, Search, X } from 'lucide-react';
import { db } from '../services/firebase';
import { historyTime } from '../features/lessonPlans/sharing';
import { groupHistoryEvents } from '../features/lessonPlans/historySessions';
import { createCloudHistoryReader } from '../features/lessonPlans/historyCloud';
import { filterHistoryGroups, hasHistoryFilters, HISTORY_ACTIONS, HISTORY_DATES, HISTORY_FILTER_DEFAULTS } from '../features/lessonPlans/historyFilters';
import { shareText } from '../features/lessonPlans/sharingI18n';
import { translate } from '../features/lessonPlans/i18n';
import LessonPlanDocument from '../pages/LessonPlanDocument';
import FilterSelect from './FilterSelect';

const showValue = value => Array.isArray(value) ? value.join('\n') : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '—');
const initialHistory = { rows: [], loading: true, loadingMore: false, hasMore: false, error: false, pageError: false };

export default function LessonPlanHistory({ schoolId, planId, language, onClose }) {
  const s = key => shareText(language, key);
  const t = key => translate(language, key);
  const reader = useRef(null);
  const filterId = useId();
  const [data, setData] = useState({ key: '', ...initialHistory });
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState(HISTORY_FILTER_DEFAULTS);
  const [selectedVersion, setVersion] = useState(null);
  const sourceKey = `${schoolId}:${planId}:${attempt}`;
  const history = data.key === sourceKey ? data : initialHistory;
  const { rows } = history;
  const version = !history.error && selectedVersion?.key === sourceKey ? selectedVersion.entry : null;
  const selectVersion = entry => setVersion(entry ? { key: sourceKey, entry } : null);
  const filtering = hasHistoryFilters(filters);
  const invalidDates = filters.date === 'custom' && filters.from && filters.to && filters.from > filters.to;
  const update = (key, value) => setFilters(old => ({ ...old, [key]: value }));
  useEffect(() => {
    const current = createCloudHistoryReader(db, schoolId, planId, next => setData({ key: sourceKey, ...next }));
    reader.current = current;
    current.start();
    return () => { current.dispose(); reader.current = null; };
  }, [schoolId, planId, sourceKey]);
  useEffect(() => {
    if (!filtering || invalidDates || history.loading || history.loadingMore || history.error || history.pageError || !history.hasMore) return;
    const timer = window.setTimeout(() => reader.current?.loadMore(), 250);
    return () => window.clearTimeout(timer);
  }, [filtering, filters, invalidDates, history.loading, history.loadingMore, history.error, history.pageError, history.hasMore]);
  const count = Math.max(0, rows.length - (history.hasMore ? 1 : 0));
  const groups = useMemo(() => groupHistoryEvents(rows, { count }), [rows, count]);
  const filtered = useMemo(() => filterHistoryGroups(groups, filters, { language }), [groups, filters, language]);
  const actors = useMemo(() => [...new Map(rows.map(row => [row.actorUid, row])).values()].sort((a, b) => (a.actorName || '').localeCompare(b.actorName || '')), [rows]);
  const scanning = filtering && history.hasMore && !history.error && !history.pageError && !invalidDates;
  return <aside className="lesson-history-panel" aria-label={s('history')}>
    <div className="lesson-history-heading"><h3><History size={19} /> {s('history')}</h3>{onClose && <button type="button" className="lesson-icon-button" onClick={onClose} aria-label={s('close')}><X size={20} /></button>}</div>
    <p>{s('historyHint')} {s('sessionHint')}</p><p className="lesson-review-note">{s('archiveExplanation')}</p>
    <div className="lesson-history-filters" role="search" aria-label={s('historyFilters')}>
      <label className="lesson-history-filter lesson-history-search" htmlFor={`${filterId}-search`}><span>{s('historySearchLabel')}</span><span className="lesson-history-search-box"><Search size={17} aria-hidden="true" /><input id={`${filterId}-search`} type="search" placeholder={s('historySearch')} value={filters.search} onChange={e => update('search', e.target.value)} /></span></label>
      <label className="lesson-history-filter"><span>{s('historyPerson')}</span><FilterSelect label={s('historyPerson')} value={filters.actor} onChange={value => update('actor', value)} options={[{ value: 'all', label: s('historyAllPeople') }, ...actors.map(actor => ({ value: actor.actorUid, label: actor.actorUid === 'system' ? s('system') : [actor.actorName, actor.actorEmail].filter(Boolean).join(' · ') }))]} /></label>
      <label className="lesson-history-filter"><span>{s('historyAction')}</span><FilterSelect label={s('historyAction')} value={filters.action} onChange={value => update('action', value)} options={[{ value: 'all', label: s('historyAllActions') }, ...HISTORY_ACTIONS.map(action => ({ value: action, label: s(`historyAction_${action}`) }))]} /></label>
      <label className="lesson-history-filter"><span>{s('historyReviewStatus')}</span><FilterSelect label={s('historyReviewStatus')} value={filters.status} onChange={value => update('status', value)} options={[{ value: 'all', label: s('historyAllStatuses') }, ...['pending', 'reviewing', 'archived', 'unshared'].map(status => ({ value: status, label: s(status) }))]} /></label>
      <label className="lesson-history-filter"><span>{s('historyEventDate')}</span><FilterSelect label={s('historyEventDate')} value={filters.date} onChange={value => update('date', value)} options={HISTORY_DATES.map(date => ({ value: date, label: t(`date.${date}`) }))} /></label>
      {filters.date === 'custom' && <><label className="lesson-history-filter" htmlFor={`${filterId}-from`}><span>{s('historyFrom')}</span><input id={`${filterId}-from`} type="date" value={filters.from} max={filters.to || undefined} onChange={e => update('from', e.target.value)} /></label><label className="lesson-history-filter" htmlFor={`${filterId}-to`}><span>{s('historyTo')}</span><input id={`${filterId}-to`} type="date" value={filters.to} min={filters.from || undefined} onChange={e => update('to', e.target.value)} /></label></>}
      {filtering && <button type="button" className="btn-secondary lesson-history-reset" onClick={() => setFilters(HISTORY_FILTER_DEFAULTS)}>{s('historyReset')}</button>}
    </div>
    <p className="lesson-history-filter-hint">{s('historyFilterHint')}</p>
    {invalidDates && <p role="alert">{s('historyInvalidDates')}</p>}
    {history.loading && <p role="status">{s('loading')}</p>}
    {history.error && <><p role="alert">{s('historyLoadError')}</p><button type="button" className="btn-secondary" onClick={() => setAttempt(value => value + 1)}>{s('retry')}</button></>}
    {history.pageError && <p role="alert">{s('historyPageError')}</p>}
    {!history.loading && !history.error && <p role="status" className="lesson-history-results">{s('historyResults').replace('{count}', filtered.length).replace('{loaded}', count)} {scanning ? s('historyScanning') : history.hasMore ? s('historyMoreAvailable') : s('historyAllLoaded')}</p>}
    {!history.loading && !history.error && !filtered.length && <p>{scanning ? s('historyNoMatchesYet') : history.hasMore && filtering ? s('historyNoLoadedMatches') : rows.length ? s('historyNoMatches') : s('noHistory')}</p>}
    <ol className="lesson-history-list">{filtered.map(group => {
      const entry = group.latest;
      const cause = entry.action === 'auto_reopen' ? rows.find(row => row.revisionId === entry.revisionId && ['update', 'reshare'].includes(row.action))?.action : '';
      return <li key={entry.eventId}>
        <strong>{s(entry.action === 'update' ? 'sessionTitle' : `action_${entry.action}${cause ? `_${cause}` : ''}`)}</strong>
        <span>{entry.actorUid === 'system' ? s('system') : `${entry.actorName} · ${entry.actorEmail}`}</span>
        <time>{group.events.length > 1 ? `${historyTime(group.oldest.at, language)} – ${historyTime(entry.at, language)}` : historyTime(entry.at, language)}</time>
        {entry.action === 'update' && <span>{group.events.length} {s('sessionSaves')} · {group.changes.length} {s('sessionFields')}</span>}
        {entry.action === 'review' && <span className="lesson-review-badge" data-review-status={entry.reviewStatus}>{s(entry.reviewStatus)}</span>}
        {['update', 'reshare'].includes(entry.action) && group.prior && <details><summary>{s('changes')} ({group.changes.length})</summary>{group.changes.length ? group.changes.map(change => {
          const key = `editor.${change.field}`;
          const label = translate(language, key);
          return <div className="lesson-history-diff" key={change.field}><b>{label === key ? change.field.replace(/([a-z])([A-Z])/g, '$1 $2') : label}</b><del><small>{s('before')}</small>{showValue(change.before)}</del><ins><small>{s('after')}</small>{showValue(change.after)}</ins>{JSON.stringify(change.before) === JSON.stringify(change.after) && <small>{s('reverted')}</small>}{change.steps.length > 1 && <details><summary>{s('fieldSteps')} ({change.steps.length})</summary>{change.steps.map(step => <div className="lesson-history-step" key={step.event.eventId}><time>{historyTime(step.event.at, language)}</time><del>{showValue(step.before)}</del><ins>{showValue(step.after)}</ins></div>)}</details>}</div>;
        }) : <p>{s('noContentChanges')}</p>}</details>}
        {entry.action !== 'auto_reopen' && <button type="button" className="lesson-history-version" onClick={() => selectVersion(entry)}>{s('version')}</button>}
        {group.events.length > 1 && <details className="lesson-history-versions"><summary>{s('savedVersions')} ({group.events.length})</summary>{group.events.map(saved => <button type="button" key={saved.eventId} className="lesson-history-version" onClick={() => selectVersion(saved)}>{historyTime(saved.at, language)}</button>)}</details>}
        {group.partial && <p className="lesson-history-partial">{s('partialSession')}</p>}
      </li>;
    })}</ol>
    {history.hasMore && !history.error && <button type="button" className="btn-secondary" disabled={history.loadingMore} onClick={() => reader.current?.loadMore()}>{history.loadingMore ? s('loading') : history.pageError ? s('retry') : s('more')}</button>}
    {version && <section className="lesson-recorded-version"><div className="lesson-history-heading"><h3>{s('recorded')}</h3><button type="button" className="lesson-icon-button" onClick={() => selectVersion(null)} aria-label={s('close')}><X size={20} /></button></div><p>{historyTime(version.at, language)}</p><LessonPlanDocument plan={version.plan} language={language} /></section>}
  </aside>;
}
