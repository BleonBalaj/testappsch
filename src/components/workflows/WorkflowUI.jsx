import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import DialogPortal from '../DialogPortal';
import ReadStatus from '../ReadStatus';
import { workflowError, workflowLabel, workflowTime, words } from '../../features/schoolWorkflows/i18n';
import { useWorkflowList } from '../../features/schoolWorkflows/cloud';
import './Workflows.css';
export function WorkflowDialog({ title, hint, onClose, children, footer, busy = false, className = '' }) {
  const titleId = useId(), node = useRef(null);
  useEffect(() => { node.current?.focus({ preventScroll: true }); }, []);
  const keyDown = event => {
    if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const nodes = [...node.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"], select:not(:disabled)')].filter(element => element.getClientRects().length);
    if (!nodes.length) { event.preventDefault(); return; }
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === node.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === node.current)) { event.preventDefault(); first.focus(); }
  };
  return <DialogPortal><div className="workflow-overlay"><div className={`workflow-dialog ${className}`} ref={node} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keyDown}><header><div><h2 id={titleId}>{title}</h2>{hint && <p>{hint}</p>}</div><button type="button" className="workflow-icon" disabled={busy} onClick={onClose} aria-label="Close / Mbyll"><X size={22} /></button></header><div className="workflow-dialog-body">{children}</div>{footer && <footer>{footer}</footer>}</div></div></DialogPortal>;
}
export const WorkflowField = ({ label, hint, children, wide = false }) => <label className={`workflow-field${wide ? ' workflow-field-wide' : ''}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
export const WorkflowBadge = ({ language, status }) => <span className="workflow-status" data-status={status}>{workflowLabel(language, status)}</span>;
export const WorkflowError = ({ language, error }) => error ? <p className="workflow-error" role="alert">{workflowError(language, error)}</p> : null;
export function WorkflowListFooter({ list, language }) {
  const l = (en, sq) => words(language, en, sq);
  return <div className="workflow-list-footer"><span role="status">{list.loadingMore ? l('Loading older records…','Duke ngarkuar regjistrimet e mëparshme…') : list.loading ? l('Loading…', 'Duke ngarkuar…') : `${list.rows.length} ${l('records loaded', 'regjistrime të ngarkuara')}`}{list.more && l(' · Earlier records are available.', ' · Ka regjistrime më të vjetra.')}</span><WorkflowError language={language} error={list.error} />{list.more && <button type="button" className="btn-secondary" disabled={list.loading || list.loadingMore} onClick={list.loadMore}>{l('Load older records', 'Ngarko regjistrime më të vjetra')}</button>}<button type="button" className="text-btn" disabled={list.loading} onClick={list.refresh}>{l('Refresh list', 'Rifresko listën')}</button></div>;
}
export function WorkflowSearchFooter({ list, language }) {
  const l = (en,sq) => words(language,en,sq), busy = list.loading;
  const count = list.rows.length;
  const hasMultiplePages = Boolean(list.more || (list.page && list.page > 0));
  const page = (list.page || 0) + 1;
  return <><WorkflowError language={language} error={list.error}/><nav className="workflow-pagination" aria-label={l('Result pages','Faqet e rezultateve')} aria-busy={busy}>
    {hasMultiplePages && <button type="button" className="btn-secondary" disabled={busy || !list.page} onClick={list.previous}>{l('Previous','Mëparshmja')}</button>}
    <span role="status">{list.loading && !list.hasLoaded && !count ? l('Searching all accessible records…','Duke kërkuar në të gjitha regjistrimet e lejuara…') : hasMultiplePages ? `${l('Page','Faqja')} ${page} · ${count} ${l('results on this page','rezultate në këtë faqe')}` : `${count} ${count === 1 ? l('result','rezultat') : l('results','rezultate')}`}</span>
    {hasMultiplePages && <button type="button" className="btn-secondary" disabled={busy || !list.more} onClick={list.next}>{l('Next','Tjetra')}</button>}
    <button type="button" className="text-btn" disabled={busy} onClick={list.refresh}>{list.error ? l('Retry search','Riprovo kërkimin') : l('Refresh list','Rifresko listën')}</button>
  </nav></>;
}
function RecordedFields({ snapshot, language }) {
  const fields = [
    ['description','Description','Përshkrimi'],['priority','Priority','Përparësia'],['neededBy','Needed by','Afati'],
    ['assigneeName','Responsible','Përgjegjësi'],['teacherName','Absent teacher','Mësimdhënësi që mungon'],
    ['substituteName','Substitute','Zëvendësuesi'],['reason','Private absence note','Shënim privat për mungesën'],
    ['resolution','Resolution','Zgjidhja'],['note','Instructions / note','Udhëzime / shënim'],['planId','Linked plan ID','ID-ja e planit të lidhur'],
  ];
  return <>{fields.filter(([key])=>snapshot[key]).map(([key,en,sq])=><p key={key}><strong>{words(language,en,sq)}: </strong>{key==='priority'?workflowLabel(language,snapshot[key]):snapshot[key]}</p>)}{snapshot.startTime && <p>{snapshot.startTime}–{snapshot.endTime || '—'}</p>}</>;
}
export function WorkflowHistory({ schoolId, path, language }) {
  const list = useWorkflowList(schoolId, `${path}/events`, [], 'at');
  const l = (en, sq) => words(language, en, sq);
  return <section className="workflow-history"><h3>{l('Activity history', 'Historiku i veprimeve')}</h3><p>{l('Saved actions are recorded with the person, time and recorded values.', 'Veprimet e ruajtura shënohen me personin, kohën dhe vlerat e regjistruara.')}</p><ReadStatus state={list} language={language}/>{list.rows.map(event => <article key={event.id}><strong>{workflowLabel(language, event.action)}</strong><span>{event.actorName} · {workflowTime(language, event.at)}</span>{event.note && <p>{event.note}</p>}{(event.before || event.after) && <details><summary>{l('Recorded details', 'Hollësitë e regjistruara')}</summary>{[event.before, event.after].map((snapshot, index) => snapshot && <div key={index}><h4>{index ? l('After', 'Pas') : l('Before', 'Para')}</h4><p>{[snapshot.title || snapshot.subject || snapshot.teacherName, snapshot.classLabel, snapshot.room, snapshot.date, snapshot.from, snapshot.to].filter(Boolean).join(' · ')}</p>{snapshot.status && <WorkflowBadge status={snapshot.status} language={language} />}{snapshot.items?.map(item => <p key={item.id}>{item.name}: {item.provided}/{item.needed}</p>)}<RecordedFields snapshot={snapshot} language={language}/></div>)}</details>}</article>)}<WorkflowListFooter list={list} language={language} /></section>;
}
