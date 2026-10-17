import { usePlanActivity } from '../context/LessonReviewContext';
import { PlanUnreadDot, PlanReviewer, PlanReadMarker } from './PlanActivity';
import React, { useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WorkflowDialog, WorkflowError, WorkflowField } from './workflows/WorkflowUI';
import { useWorkflowAction, useWorkflowDocument, useWorkflowList } from '../features/schoolWorkflows/cloud';
import { words, workflowTime } from '../features/schoolWorkflows/i18n';
import ReadStatus from './ReadStatus';
import {emptyReadReady} from '../features/liveResource';

export function LessonPlanFeedbackDialog({ schoolId, planId, language, onClose }) {
  const { currentUser, currentRole } = useAuth();
  const l = (en, sq) => words(language, en, sq);
  const share = useWorkflowDocument(schoolId, `lessonPlanShares/${planId}`);
  const history = useWorkflowDocument(schoolId, `lessonPlanReviewHistory/${planId}`);
  const messages = useWorkflowList(schoolId, `lessonPlanFeedback/${planId}/messages`, [], 'at');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const latest=useRef(null);
  const action = useWorkflowAction(schoolId);
  const {review,loading:reviewLoading,error:reviewError,retry:retryReview}=usePlanActivity(planId);
  const ownerUid=share.value?.ownerUid||history.value?.ownerUid;
  const isOwner=ownerUid===currentUser.uid;
  const assigned=currentRole==='admin'&&review?.reviewerUid===currentUser.uid;
  const accessLoading=share.loading||history.loading||reviewLoading||(!share.value&&share.refreshing);
  const accessError=share.error||history.error||reviewError;
  const canSend=Boolean(!accessLoading&&!accessError&&share.value&&(isOwner||assigned));
  const send=async event=>{
    event.preventDefault();
    if(!canSend||!message.trim()||action.busy)return;
    const draft=message;
    try{
      const result=await action.run('feedbackComment',{planId,revisionId:share.value.revisionId,shareToken:share.value.shareToken,message:draft});
      if(result){setMessage(previous=>previous===draft?'':previous);setSent(true);messages.refresh();latest.current?.scrollIntoView({block:'start',behavior:'instant'});}
    }catch{/* Keep the draft; the error appears beside the Send button. */}
  };
  const composer=<>
    <WorkflowError language={language} error={action.error}/>
    {canSend?<form className="plan-comments-composer" onSubmit={send}>
      <WorkflowField label={l('Write a comment','Shkruani një koment')}><textarea rows={3} maxLength={6000} required value={message} placeholder={l('Write your message…','Shkruani mesazhin tuaj…')} onChange={event=>{setMessage(event.target.value);setSent(false);}} /></WorkflowField>
      <div className="plan-comments-send"><span role="status">{sent?l('Comment sent.','Komenti u dërgua.'):l('Comments do not change the plan or its review status.','Komentet nuk e ndryshojnë planin ose statusin e kontrollit.')}</span><button type="submit" className="btn-primary" disabled={action.busy||!message.trim()}><Send size={16}/>{action.busy?l('Sending…','Duke dërguar…'):l('Send comment','Dërgo komentin')}</button></div>
    </form>:accessLoading?<ReadStatus state={{loading:true}} language={language} loadingText={l('Checking comment access…','Duke kontrolluar qasjen te komentet…')}/>:!accessError&&<p className="plan-comments-access">{!share.value?l('Sharing is off. Previous comments remain available. Share the plan again to continue the conversation.','Ndarja është ndalur. Komentet e mëparshme mbeten të dukshme. Ndajeni planin sërish për të vazhduar bisedën.'):l('The author and assigned reviewer can send comments. To comment as an admin, first assign this review to yourself in the shared-plan view.','Autori dhe kontrolluesi i caktuar mund të dërgojnë komente. Për të komentuar si administrator, merreni fillimisht përsipër kontrollin te plani i ndarë.')}</p>}
  </>;
  return <WorkflowDialog className="plan-comments-dialog" title={l('Plan comments','Komentet e planit')} hint={l('Discuss this plan with its author or reviewer. Newest comments appear first.','Bisedoni me autorin ose kontrolluesin për këtë plan. Komentet më të reja shfaqen të parat.')} onClose={onClose} busy={action.busy} footer={composer}>
    <PlanReviewer planId={planId} language={language}/>
    <WorkflowError language={language} error={accessError||messages.error}/>
    <div ref={latest} className="plan-comments-latest"/>
    <ReadStatus state={messages} language={language} loadingText={l('Loading comments…','Duke ngarkuar komentet…')}/>
    {!accessError&&emptyReadReady(messages)&&!messages.rows.length&&<p className="workflow-empty">{l('No comments yet. Start the conversation below.','Ende nuk ka komente. Niseni bisedën më poshtë.')}</p>}
    <ol className="plan-comments-list" aria-label={l('Comments, newest first','Komentet, nga më i riu')}>
      {messages.rows.map(entry=><li className={`workflow-feedback-message${entry.actorUid===currentUser.uid?' is-mine':''}`} key={entry.id}>
        <PlanReadMarker schoolId={schoolId} planId={planId} kind="feedback" cursor={{at:entry.at,id:entry.id}} language={language}/>
        <header><div><strong>{entry.actorName||entry.actorEmail}</strong><span>{entry.actorUid===ownerUid?l('Plan author','Autori i planit'):l('Administrator','Administrator')}{entry.actorUid===currentUser.uid?l(' · You',' · Ju'):''}</span></div><time>{workflowTime(language,entry.at)}</time></header>
        {entry.message?<p>{entry.message}</p>:<p>{l('Shared an updated plan for review.','Dërgoi planin e përditësuar për kontroll.')}</p>}
      </li>)}
    </ol>
    {messages.more&&<button type="button" className="btn-secondary" disabled={messages.loadingMore} onClick={messages.loadMore}>{messages.loadingMore?l('Loading…','Duke ngarkuar…'):l('Load earlier comments','Ngarko komentet e mëparshme')}</button>}
    {(messages.error||accessError)&&<button type="button" className="btn-secondary" onClick={()=>{messages.refresh();share.retry();history.retry();retryReview();}}>{l('Retry','Riprovo')}</button>}
  </WorkflowDialog>;
}
export default function LessonPlanFeedback({ schoolId, planId, language, disabled = false }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="workflow-feedback-trigger" disabled={disabled} onClick={() => setOpen(true)}><MessageSquare size={16} />{words(language,'Comments','Komentet')}<PlanUnreadDot planId={planId} kind="feedback" language={language}/></button>{open && <LessonPlanFeedbackDialog key={`${schoolId}:${planId}`} schoolId={schoolId} planId={planId} language={language} onClose={() => setOpen(false)} />}</>;
}
