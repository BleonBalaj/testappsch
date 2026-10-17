import { PlanReadMarker } from './PlanActivity';
import { WorkflowDialog } from './workflows/WorkflowUI';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { ArrowLeft, FilePenLine, History, MessageSquare, Search, SlidersHorizontal, UserCheck, RotateCcw, X } from 'lucide-react';
import { historyTime } from '../features/lessonPlans/sharing';
import { groupHistoryEvents } from '../features/lessonPlans/historySessions';
import {useLessonPlanHistory} from '../features/schoolWorkflows/cloud';
import {emptyReadReady} from '../features/liveResource';
import ReadStatus from './ReadStatus';
import { filterHistoryGroups, hasHistoryFilters, HISTORY_ACTIONS, HISTORY_DATES, HISTORY_FILTER_DEFAULTS } from '../features/lessonPlans/historyFilters';
import { shareText } from '../features/lessonPlans/sharingI18n';
import { translate } from '../features/lessonPlans/i18n';
import { historyEntryKind, historyHasPlanVersion, historyFieldLabel, historyFieldValue } from '../features/lessonPlans/historyPresentation';
import LessonPlanDocument from '../pages/LessonPlanDocument';
import FilterSelect from './FilterSelect';

export default function LessonPlanHistory({ schoolId, planId, language, onClose }) {
  const s = key => shareText(language, key);
  const t = key => translate(language, key);
  const filterId = useId();
  const [filters, setFilters] = useState(HISTORY_FILTER_DEFAULTS);
  const [selectedVersion, setVersion] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const sourceKey = `${schoolId}:${planId}`;
  const history = useLessonPlanHistory(schoolId,planId);
  const { rows } = history;
  const version = !history.error && selectedVersion?.key === sourceKey ? selectedVersion.entry : null;
  const selectVersion = entry => setVersion(entry ? { key: sourceKey, entry } : null);
  const filtering = hasHistoryFilters(filters);
  const invalidDates = filters.date === 'custom' && filters.from && filters.to && filters.from > filters.to;
  const update = (key, value) => setFilters(old => ({ ...old, [key]: value }));
  useEffect(() => {
    if (!filtering || invalidDates || history.loading || history.refreshing || history.loadingMore || history.error || history.pageError || !history.hasMore) return;
    const timer = window.setTimeout(history.loadMore, 250);
    return () => window.clearTimeout(timer);
  }, [filtering, filters, invalidDates, history.loading, history.refreshing, history.loadingMore, history.error, history.pageError, history.hasMore,history.loadMore]);
  const count = Math.max(0, rows.length - (history.hasMore ? 1 : 0));
  const groups = useMemo(() => groupHistoryEvents(rows, { count }), [rows, count]);
  const filtered = useMemo(() => filterHistoryGroups(groups, filters, { language }), [groups, filters, language]);
  const actors = useMemo(() => [...new Map(rows.map(row => [row.actorUid, row])).values()].sort((a, b) => (a.actorName || '').localeCompare(b.actorName || '')), [rows]);
  const scanning = filtering && history.hasMore && !history.error && !history.pageError && !invalidDates;
  return <aside className="lesson-history-panel" aria-label={s('history')}>
    {onClose&&<div className="lesson-history-heading"><h3><History size={19} /> {s('history')}</h3><button type="button" className="lesson-icon-button" onClick={onClose} aria-label={s('close')}><X size={20} /></button></div>}
    <p>{s('historyIntro')}</p>
    <details className="lesson-history-about"><summary>{s('aboutHistory')}</summary><p>{s('historyHint')} {s('sessionHint')}</p><p>{s('archiveExplanation')}</p></details>
    <div className="lesson-history-filters" role="search" aria-label={s('historyFilters')}>
      <label className="lesson-history-filter lesson-history-search" htmlFor={`${filterId}-search`}><span>{s('historySearchLabel')}</span><span className="lesson-history-search-box"><Search size={17} aria-hidden="true" /><input id={`${filterId}-search`} type="search" placeholder={s('historySearch')} value={filters.search} onChange={e => update('search', e.target.value)} /></span></label>
      <div className="lesson-history-filter-tools"><button type="button" className="btn-secondary" aria-expanded={showFilters} aria-controls={`${filterId}-options`} onClick={()=>setShowFilters(value=>!value)}><SlidersHorizontal size={16}/>{s('filterOptions')}{Object.entries(filters).some(([key,value])=>!['search','from','to'].includes(key)&&value!=='all')&&<span aria-label={s('filtersApplied')}> •</span>}</button>{filtering&&<button type="button" className="text-btn" onClick={()=>setFilters(HISTORY_FILTER_DEFAULTS)}>{s('historyReset')}</button>}</div>
      <div id={`${filterId}-options`} className="lesson-history-filter-options" hidden={!showFilters}>
      <label className="lesson-history-filter"><span>{s('historyPerson')}</span><FilterSelect label={s('historyPerson')} value={filters.actor} onChange={value => update('actor', value)} options={[{ value: 'all', label: s('historyAllPeople') }, ...actors.map(actor => ({ value: actor.actorUid, label: actor.actorUid === 'system' ? s('system') : [actor.actorName, actor.actorEmail].filter(Boolean).join(' · ') }))]} /></label>
      <label className="lesson-history-filter"><span>{s('historyAction')}</span><FilterSelect label={s('historyAction')} value={filters.action} onChange={value => update('action', value)} options={[{ value: 'all', label: s('historyAllActions') }, ...HISTORY_ACTIONS.map(action => ({ value: action, label: s(`historyAction_${action}`) }))]} /></label>
      <label className="lesson-history-filter"><span>{s('historyReviewStatus')}</span><FilterSelect label={s('historyReviewStatus')} value={filters.status} onChange={value => update('status', value)} options={[{ value: 'all', label: s('historyAllStatuses') }, ...['pending', 'reviewing', 'archived', 'unshared'].map(status => ({ value: status, label: s(status) }))]} /></label>
      <label className="lesson-history-filter"><span>{s('historyEventDate')}</span><FilterSelect label={s('historyEventDate')} value={filters.date} onChange={value => update('date', value)} options={HISTORY_DATES.map(date => ({ value: date, label: t(`date.${date}`) }))} /></label>
      {filters.date === 'custom' && <><label className="lesson-history-filter" htmlFor={`${filterId}-from`}><span>{s('historyFrom')}</span><input id={`${filterId}-from`} type="date" value={filters.from} max={filters.to || undefined} onChange={e => update('from', e.target.value)} /></label><label className="lesson-history-filter" htmlFor={`${filterId}-to`}><span>{s('historyTo')}</span><input id={`${filterId}-to`} type="date" value={filters.to} min={filters.from || undefined} onChange={e => update('to', e.target.value)} /></label></>}
      </div>
    </div>
    {showFilters&&<p className="lesson-history-filter-hint">{s('historyFilterHint')}</p>}
    {invalidDates && <p role="alert">{s('historyInvalidDates')}</p>}
    <ReadStatus state={history} language={language} loadingText={s('loading')}/>
    {history.error && <><p role="alert">{s('historyLoadError')}</p><button type="button" className="btn-secondary" onClick={history.retry}>{s('retry')}</button></>}
    {history.pageError && <p role="alert">{s('historyPageError')}</p>}
    {emptyReadReady(history) && <p role="status" className="lesson-history-results">{s('historyResults').replace('{count}', filtered.length).replace('{loaded}', count)} {scanning ? s('historyScanning') : history.hasMore ? s('historyMoreAvailable') : s('historyAllLoaded')}</p>}
    {emptyReadReady(history) && !filtered.length && <p>{scanning ? s('historyNoMatchesYet') : history.hasMore && filtering ? s('historyNoLoadedMatches') : rows.length ? s('historyNoMatches') : s('noHistory')}</p>}
    <ol className="lesson-history-list">{filtered.map(group => {
      const entry = group.latest;
      const kind=historyEntryKind(entry.action),compact=kind==='review'||kind==='system';
      const Icon=kind==='review'?UserCheck:kind==='comment'?MessageSquare:kind==='system'?RotateCcw:FilePenLine;
      const cause = entry.action === 'auto_reopen' ? rows.find(row => row.revisionId === entry.revisionId && ['update', 'reshare', 'resubmit'].includes(row.action))?.action : '';
      return <li key={entry.eventId} data-event-kind={kind}><PlanReadMarker schoolId={schoolId} planId={planId} kind="history" cursor={{at:entry.at,id:entry.eventId}} language={language}/><span className="lesson-history-event-icon"><Icon size={18}/></span><div className="lesson-history-event-content">
        <header className="lesson-history-event-heading"><strong title={entry.actorEmail}>{entry.actorUid==='system'?s('system'):entry.actorName||entry.actorEmail}</strong>{compact?<span className="lesson-history-event-action">{s(entry.action==='review'?`action_review_${entry.reviewStatus}`:`action_${entry.action}${cause ? `_${cause}` : ''}`)}</span>:entry.actorUid!=='system'&&entry.actorEmail&&<span>{entry.actorEmail}</span>}</header>
        {!compact&&<p className="lesson-history-event-action">{s(entry.action === 'update' ? 'sessionTitle' : `action_${entry.action}`)}</p>}
        <time>{group.events.length > 1 ? `${historyTime(group.oldest.at, language)} – ${historyTime(entry.at, language)}` : historyTime(entry.at, language)}</time>
        {entry.action === 'update' && <span>{group.changes.length} {s('sessionFields')}</span>}
        {entry.action === 'review' && <div className="lesson-history-status-change">{entry.previousReviewStatus&&entry.previousReviewStatus!==entry.reviewStatus&&<><span>{s(entry.previousReviewStatus)}</span><span aria-hidden="true">→</span></>}<span className="lesson-review-badge" data-review-status={entry.reviewStatus}>{s(entry.reviewStatus)}</span></div>}
        {entry.feedback?.message&&<blockquote className="lesson-history-feedback">{entry.feedback.message}</blockquote>}
        {entry.action==='reviewer_reassign'&&entry.previousReviewerName&&entry.previousReviewerUid!==entry.reviewer?.uid&&<p className="lesson-history-reassignment">{entry.previousReviewerName} → {entry.reviewer?.name||entry.actorName}</p>}
        {entry.note&&<p>{entry.note}</p>}
        {['update', 'reshare'].includes(entry.action) && group.prior && <details><summary>{s('changes')} ({group.changes.length})</summary>{group.changes.length ? group.changes.map(change => {
          const value=item=>historyFieldValue(item,change.field,language);
          return <div className="lesson-history-diff" key={change.field}><b>{historyFieldLabel(change.field,language)}</b><del><small>{s('before')}</small>{value(change.before)}</del><ins><small>{s('after')}</small>{value(change.after)}</ins>{JSON.stringify(change.before) === JSON.stringify(change.after) && <small>{s('reverted')}</small>}{change.steps.length > 1 && <details><summary>{s('fieldSteps')} ({change.steps.length})</summary>{change.steps.map(step => <div className="lesson-history-step" key={step.event.eventId}><time>{historyTime(step.event.at, language)}</time><del>{value(step.before)}</del><ins>{value(step.after)}</ins></div>)}</details>}</div>;
        }) : <p>{s('noContentChanges')}</p>}</details>}
        {historyHasPlanVersion(entry)&&<button type="button" className="lesson-history-version" onClick={() => selectVersion(entry)}>{s('version')}</button>}
        {group.events.length > 1 && <details className="lesson-history-versions"><summary>{s('savedVersions')} ({group.events.length})</summary>{group.events.map(saved => <button type="button" key={saved.eventId} className="lesson-history-version" onClick={() => selectVersion(saved)}>{historyTime(saved.at, language)}</button>)}</details>}
        {group.partial && <p className="lesson-history-partial">{s('partialSession')}</p>}
      </div></li>;
    })}</ol>
    {history.hasMore && !history.error && <button type="button" className="btn-secondary" disabled={history.loadingMore||history.refreshing} onClick={history.loadMore}>{history.loadingMore ? s('loading') : history.pageError ? s('retry') : s('more')}</button>}
    {version && <WorkflowDialog key={version.eventId} className="lesson-version-dialog" title={s('recorded')} hint={`${version.actorName||version.actorEmail||s('system')} · ${historyTime(version.at,language)}`} onClose={()=>selectVersion(null)} footer={<button type="button" className="btn-secondary" onClick={()=>selectVersion(null)}><ArrowLeft size={17}/>{s('backToHistory')}</button>}><p className="lesson-version-notice">{s('savedVersionHint')}</p><div className="lesson-recorded-version"><LessonPlanDocument plan={version.plan} language={language} /></div></WorkflowDialog>}
  </aside>;
}
