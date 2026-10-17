import React,{useCallback,useEffect,useRef,useState} from 'react';
import {doc,updateDoc} from 'firebase/firestore';
import {db} from '../services/firebase';
import {useAuth} from '../context/AuthContext';
import {usePlanActivity} from '../context/LessonReviewContext';
import {activityHead,activityMillis,compareCursors} from '../features/lessonPlans/activity';
import {words,workflowLabel} from '../features/schoolWorkflows/i18n';
export function PlanUnreadDot({planId,kind,language}) {
  const value=usePlanActivity(planId),unread=kind==='feedback'?value.feedbackUnread:value.historyUnread;
  return unread?<span className="plan-unread-dot" role="img" aria-label={words(language,'Unread updates','Përditësime të palexuara')} title={words(language,'Unread updates','Përditësime të palexuara')}/>:null;
}
export function PlanReviewer({planId,language}) {
  const {review,loading,refreshing,error}=usePlanActivity(planId);
  if(!review&&(loading||refreshing))return <span className="plan-reviewer-label" role="status">{words(language,'Loading reviewer…','Duke ngarkuar kontrolluesin…')}</span>;
  if(!review&&error)return <span className="plan-reviewer-label">{words(language,'Reviewer information unavailable','Të dhënat e kontrolluesit nuk janë të disponueshme')}</span>;
  return <span className="plan-reviewer-label">{review?.reviewerUid?`${words(language,'Reviewer','Kontrolluesi')}: ${review.reviewerName||review.reviewerEmail}`:words(language,'Reviewer not assigned yet','Ende pa kontrollues të caktuar')}{review?.reviewStatus&&review.reviewerUid?` · ${['pending','reviewing','archived','unshared'].includes(review.reviewStatus)?words(language,({pending:'Needs review',reviewing:'In review',archived:'Review archived',unshared:'Sharing is off'})[review.reviewStatus],({pending:'Në pritje të kontrollit',reviewing:'Në kontroll',archived:'Kontrolli i arkivuar',unshared:'Ndarja është ndalur'})[review.reviewStatus]):workflowLabel(language,review.reviewStatus)}`:''}</span>;
}
export function PlanReadMarker({schoolId,planId,kind,cursor,language}) {
  const {currentUser}=useAuth(),{value,historyUnread,feedbackUnread}=usePlanActivity(planId),node=useRef(null);
  const [error,setError]=useState(false),[busy,setBusy]=useState(false);
  const unread=kind==='feedback'?feedbackUnread:historyUnread;
  const stamp=activityMillis(cursor?.at),eventId=cursor?.id||'';
  const visible=Boolean(unread&&eventId&&eventId===activityHead(value,kind).id&&compareCursors(cursor,activityHead(value,kind))===0);
  const mark=useCallback(async()=>{
    if(!eventId||!currentUser?.uid)return;
    setBusy(true);setError(false);
    try{await updateDoc(doc(db,'schools',schoolId,'lessonPlanActivity',currentUser.uid,'plans',planId),{[`seen${kind}At`]:cursor.at,[`seen${kind}EventId`]:eventId});}
    catch{setError(true);}finally{setBusy(false);}
  // The cursor key binds this acknowledgement to the exact rendered event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[schoolId,planId,kind,currentUser?.uid,stamp,eventId]);
  useEffect(()=>{
    if(!visible||!node.current||!globalThis.IntersectionObserver)return;
    let timer;
    const observer=new IntersectionObserver(entries=>{clearTimeout(timer);if(entries.some(entry=>entry.isIntersecting))timer=setTimeout(mark,1200);},{threshold:.6});
    observer.observe(node.current);return()=>{clearTimeout(timer);observer.disconnect();};
  },[visible,mark]);
  return visible?<div ref={node} className="plan-unread-marker"><span>{words(language,kind==='feedback'?'New comments':'New history updates',kind==='feedback'?'Komente të reja':'Përditësime të reja në historik')}</span><button type="button" disabled={busy} onClick={mark}>{words(language,busy?'Saving…':error?'Retry marking as read':'Mark as read',busy?'Duke ruajtur…':error?'Provo sërish shënimin si të lexuar':'Shëno si të lexuar')}</button></div>:null;
}
