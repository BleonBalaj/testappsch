import { useLessonReviews, usePlanActivity } from '../context/LessonReviewContext';
import { PlanReviewer, PlanUnreadDot } from './PlanActivity';
import { useWorkflowAction, useWorkflowDocument, useWorkflowCollection } from '../features/schoolWorkflows/cloud';
import { words } from '../features/schoolWorkflows/i18n';
import { WorkflowDialog, WorkflowField, WorkflowError } from './workflows/WorkflowUI';
import LessonPlanFeedback from './LessonPlanFeedback';
import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, Eye, History, Search, UserCheck } from 'lucide-react';
import { filterSharedPlans, historyTime } from '../features/lessonPlans/sharing';
import { shareText } from '../features/lessonPlans/sharingI18n';
import { translate } from '../features/lessonPlans/i18n';
import LessonPlanDocument from '../pages/LessonPlanDocument';
import LessonPlanHistory from './LessonPlanHistory';
import LessonSharingDialog from './LessonSharingDialog';
import FilterSelect from './FilterSelect';
import ReadStatus from './ReadStatus';
import {emptyReadReady} from '../features/liveResource';

const dates = ['all', 'today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'last7Days', 'custom'];

function SharedPlanReview({ schoolId, selected, identity, language, onBack }) {
  const s=key=>shareText(language,key),l=(en,sq)=>words(language,en,sq);
  const metadata=useWorkflowDocument(schoolId,`lessonPlanReviewHistory/${selected.planId}`);
  const inbox=useWorkflowDocument(schoolId,`lessonPlanInbox/${selected.planId}`),paper=useWorkflowDocument(schoolId,`lessonPlans/${selected.planId}`);
  const {review,loading:reviewLoading,refreshing:reviewRefreshing,error:reviewError,retry:retryReview}=usePlanActivity(selected.planId),action=useWorkflowAction(schoolId);
  const [showHistory,setShowHistory]=useState(Boolean(selected.openHistory)),[takeover,setTakeover]=useState(false),[note,setNote]=useState('');
  const record=inbox.value,plan=paper.value,available=Boolean(record&&plan),mine=review?.reviewerUid===identity.uid;
  const versionReady=available&&(plan.updatedAt||'')===record.planUpdatedAt;
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});document.querySelector('.main-content')?.scrollTo({top:0,behavior:'instant'});},[]);
  const run=async(name,fields={})=>{try{const result=await action.run(name,{planId:selected.planId,shareToken:record.shareToken,revisionId:record.revisionId,reviewRevision:review?.revision||0,...fields});if(result)setTakeover(false);}catch{/* Inline error, live records remain visible. */}};
  return <section className="lesson-shared-review">
    <div className="lesson-review-toolbar"><button type="button" className="btn-secondary" onClick={onBack}><ArrowLeft size={17}/>{s('back')}</button><button type="button" className="btn-secondary" onClick={()=>setShowHistory(true)}><History size={17}/>{s('history')}<PlanUnreadDot planId={selected.planId} kind="history" language={language}/></button></div>
    <div className="lesson-panel-heading lesson-shared-review-heading"><div><h2>{record?.lessonUnit||selected.lessonUnit||translate(language,'plans.untitledUnit')}</h2><p>{record?.ownerName||metadata.value?.ownerName||selected.ownerName} · {record?.ownerEmail||metadata.value?.ownerEmail||selected.ownerEmail}</p><PlanReviewer planId={selected.planId} language={language}/></div>{record&&<span className="lesson-review-badge" data-review-status={record.reviewStatus}>{s(record.reviewStatus)}</span>}</div>
    <p className="lesson-review-note">{s('readonly')}</p><div className="lesson-review-toolbar"><LessonPlanFeedback schoolId={schoolId} planId={selected.planId} language={language}/></div>
    {record?.shareCycle>1&&record.reviewStatus==='pending'&&<p className="lesson-review-note">{s('resharedNote')}</p>}
    {emptyReadReady(inbox)&&emptyReadReady(paper)&&!available&&<p role="status">{s('unavailable')}</p>}
    <WorkflowError language={language} error={action.error||inbox.error||paper.error||metadata.error||reviewError}/>
    {(inbox.error||paper.error||metadata.error||reviewError)&&<button type="button" className="btn-secondary" onClick={()=>{inbox.retry();paper.retry();metadata.retry();retryReview();}}>{s('retry')}</button>}
    <div className="lesson-review-layout">
      <div><ReadStatus state={{loading:inbox.loading||paper.loading||(available&&!versionReady),refreshing:inbox.refreshing||paper.refreshing,value:versionReady&&plan,error:inbox.error||paper.error}} language={language} loadingText={s('loading')}/>{versionReady&&<>
        <ReadStatus state={{loading:reviewLoading,refreshing:reviewRefreshing,value:review,error:reviewError}} language={language}/>{!reviewLoading&&!reviewRefreshing&&!reviewError&&!inbox.refreshing&&!paper.refreshing&&<div className="lesson-review-toolbar">
          {!review?.reviewerUid&&<button type="button" className="btn-primary" disabled={action.busy} onClick={()=>run('reviewAssign')}><UserCheck size={17}/>{l('Assign review to me','Merr përsipër kontrollin')}</button>}
          {review?.reviewerUid&&!mine&&<><span className="lesson-review-note">{l('The assigned reviewer manages this review and can comment with the author.','Kontrolluesi i caktuar e menaxhon kontrollin dhe mund të komentojë me autorin.')}</span><button type="button" className="btn-secondary" onClick={()=>setTakeover(true)}>{l('Take over this review','Merr përsipër këtë kontroll')}</button></>}
          {mine&&record.reviewStatus==='pending'&&<button type="button" className="btn-secondary" disabled={action.busy} onClick={()=>run('reviewStatus',{reviewStatus:'reviewing'})}>{s('startReview')}</button>}
          {mine&&record.reviewStatus==='reviewing'&&<button type="button" className="btn-primary" disabled={action.busy} onClick={()=>run('reviewStatus',{reviewStatus:'archived'})}><Archive size={17}/>{s('archive')}</button>}
          {mine&&record.reviewStatus==='archived'&&<button type="button" className="btn-secondary" disabled={action.busy} onClick={()=>run('reviewStatus',{reviewStatus:'pending'})}>{s('restore')}</button>}
          {mine&&record.reviewStatus!=='archived'&&<button type="button" className="btn-secondary" disabled={action.busy} onClick={()=>run('reviewRelease')}>{l('Release review assignment','Hiq dorë nga kontrolli')}</button>}
        </div>}<p>{s('guidance')}</p><div className="lesson-shared-paper"><LessonPlanDocument plan={plan} language={language}/></div>
      </>}</div>
    </div>
    {showHistory&&<LessonSharingDialog title={s('history')} side onClose={()=>setShowHistory(false)}><LessonPlanHistory schoolId={schoolId} planId={selected.planId} language={language}/></LessonSharingDialog>}
    {takeover&&<WorkflowDialog title={l('Take over the review','Merr përsipër kontrollin')} hint={l('This replaces the current reviewer and records who took over and why. The author will be notified.','Ky veprim zëvendëson kontrolluesin aktual dhe regjistron kush e mori përsipër dhe arsyen. Autori do të njoftohet.')} onClose={()=>setTakeover(false)} busy={action.busy}><form className="workflow-form" onSubmit={event=>{event.preventDefault();run('reviewAssign',{takeover:true,note});}}><WorkflowError language={language} error={action.error}/><WorkflowField label={l('Reason for taking over','Arsyeja e marrjes përsipër')}><textarea required maxLength={2000} value={note} onChange={event=>setNote(event.target.value)}/></WorkflowField><button type="submit" className="btn-primary" disabled={action.busy}>{l('Assign to me','Cakto veten si kontrollues')}</button></form></WorkflowDialog>}
  </section>;
}

export default function SharedLessonPlans({ schoolId, identity, language, initialPlanId=null }) {
  const s = key => shareText(language, key);
  const t = key => translate(language, key);
  const [status, setStatus] = useState('active');
  const {reviews,error:reviewError,retry}=useLessonReviews();
  const [selected, setSelected] = useState(initialPlanId?{planId:initialPlanId,openHistory:true}:null);
  const [historyPlan,setHistoryPlan]=useState(null);
  const [filters, setFilters] = useState({ search: '', ownerUid: 'all', reviewerUid:'all', subject: 'all', date: 'all', dateBasis: 'lesson', from: '', to: '' });
  const update = (key, value) => setFilters(old => ({ ...old, [key]: value }));
  const constraints=['all','history'].includes(status)?[]:status==='active'?[['reviewStatus','in',['pending','reviewing']]]:[['reviewStatus','==',status]];
  const data=useWorkflowCollection(schoolId,status==='history'?'lessonPlanReviewHistory':'lessonPlanInbox',constraints);
  const rows=useMemo(()=>data.rows.map(row=>({...reviews[row.id],...row,planId:row.id})),[data.rows,reviews]);
  const authors = useMemo(() => [...new Map(rows.map(row => [row.ownerUid, row])).values()].sort((a, b) => (a.ownerName||'').localeCompare(b.ownerName||'')), [rows]);
  const filtered = filterSharedPlans(rows, {...filters,reviewerUid:filters.reviewerUid==='mine'?identity.uid:filters.reviewerUid});
  if (selected) return <SharedPlanReview key={selected.planId} schoolId={schoolId} selected={selected} identity={identity} language={language} onBack={() => setSelected(null)} />;
  return <section className="lesson-list-panel glass">
    <div className="lesson-panel-heading"><div><h2>{s('heading')}</h2><p>{s('guidance')}</p></div></div>
    <div className="lesson-filters lesson-shared-filters">
      <label className="lesson-search"><Search size={17} /><input aria-label={s('search')} placeholder={s('search')} value={filters.search} onChange={e => update('search', e.target.value)} /></label>
      <FilterSelect label={s('allUsers')} value={filters.ownerUid} onChange={value => update('ownerUid', value)} options={[{ value: 'all', label: s('allUsers') }, ...authors.map(author => ({ value: author.ownerUid, label: `${author.ownerName} · ${author.ownerEmail}` }))]} />
      <FilterSelect label={words(language,'Reviewer','Kontrolluesi')} value={filters.reviewerUid} onChange={value=>update('reviewerUid',value)} options={[{value:'all',label:words(language,'All reviewers','Të gjithë kontrolluesit')},{value:'mine',label:words(language,'Assigned to me','Të caktuara për mua')},{value:'unassigned',label:words(language,'Unassigned','Pa kontrollues')},...[...new Map(Object.values(reviews).filter(row=>row.reviewerUid).map(row=>[row.reviewerUid,row])).values()].map(row=>({value:row.reviewerUid,label:row.reviewerName||row.reviewerEmail}))]}/>
      <FilterSelect label={t('filter.subjectAria')} value={filters.subject} onChange={value => update('subject', value)} options={[{ value: 'all', label: t('filter.allSubjects') }, ...[...new Set(rows.map(row => row.subject).filter(Boolean))].sort().map(subject => ({ value: subject, label: subject }))]} />
      <FilterSelect label={t('filter.statusAria')} value={status} onChange={setStatus} options={['active', 'pending', 'reviewing', 'archived', 'all', 'history'].map(value => ({ value, label: s(value === 'history' ? 'historyList' : ['pending', 'reviewing', 'archived'].includes(value) ? `filter_${value}` : value) }))} />
      <FilterSelect label={s('lessonDate')} value={filters.dateBasis} onChange={value => update('dateBasis', value)} options={[{ value: 'lesson', label: s('lessonDate') }, { value: 'shared', label: s('sharedDate') }]} />
      <FilterSelect label={t('filter.dateAria')} value={filters.date} onChange={value => update('date', value)} options={dates.map(value => ({ value, label: t(`date.${value}`) }))} />
      {filters.date === 'custom' && <><input type="date" aria-label={t('filter.fromDateAria')} value={filters.from} onChange={e => update('from', e.target.value)} /><input type="date" aria-label={t('filter.toDateAria')} value={filters.to} min={filters.from || undefined} onChange={e => update('to', e.target.value)} /></>}
    </div>
    <ReadStatus state={data} language={language} loadingText={s('loading')}/>
    {reviewError&&<><WorkflowError language={language} error={reviewError}/><button type="button" className="btn-secondary" onClick={retry}>{words(language,'Retry review sync','Riprovo sinkronizimin e kontrollit')}</button></>}
    {data.error && <><p role="alert">{s('error')}</p><button type="button" className="btn-secondary" onClick={data.retry}>{s('retry')}</button></>}
    {emptyReadReady(data) && !reviewError && !filtered.length && <p className="lesson-empty">{s('empty')}</p>}
    <div className="lesson-plan-list">{filtered.map(row => <article className="lesson-plan-row" key={row.planId}>
      <div className="lesson-plan-icon"><Eye size={22} /></div><div className="lesson-plan-main"><div className="lesson-plan-title"><h3><button type="button" className="lesson-plan-open-button" onClick={() => setSelected(row)}>{row.lessonUnit || t('plans.untitledUnit')}</button></h3><span className="lesson-review-badge" data-review-status={status === 'history' ? undefined : row.reviewStatus}>{status === 'history' ? s(`action_${row.lastAction}`) : s(row.reviewStatus)}</span>{row.shareCycle > 1 && <span className="lesson-review-badge">{s('reshared')}</span>}</div><p>{row.ownerName} · {row.ownerEmail}</p><PlanReviewer planId={row.planId} language={language}/><p>{[row.subject, row.classLabel, row.topic].filter(Boolean).join(' · ')}</p><small>{row.lessonDate} · {s('sharedDate')}: {historyTime(row.sharedAt, language)}</small></div>
      <div className="lesson-plan-actions"><button type="button" onClick={() => setSelected(row)}><Eye size={16} />{s('view')}</button><LessonPlanFeedback schoolId={schoolId} planId={row.planId} language={language}/><button type="button" onClick={()=>setHistoryPlan(row.planId)}><History size={16}/>{s('history')}<PlanUnreadDot planId={row.planId} kind="history" language={language}/></button></div>
    </article>)}</div>
    {historyPlan&&<LessonSharingDialog title={s('history')} side onClose={()=>setHistoryPlan(null)}><LessonPlanHistory key={historyPlan} schoolId={schoolId} planId={historyPlan} language={language}/></LessonSharingDialog>}
  </section>;
}
