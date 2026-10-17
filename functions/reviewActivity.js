import { createHash } from 'node:crypto';
const millis=x=>x?.toMillis?.()??0;
export const compareActivity=(a,b)=>millis(a?.at)-millis(b?.at)||(Number(a?.at?.nanoseconds||0)%1000000)-(Number(b?.at?.nanoseconds||0)%1000000)||String(a?.id||'').localeCompare(String(b?.id||''));
const head=(data,type)=>({at:data?.[`${type}At`],id:data?.[`${type}EventId`]||''});
const key=value=>createHash('sha256').update(value).digest('hex');
const isFeedback=event=>['comment','feedback','reply'].includes(event.action)||(event.action==='resubmit'&&event.feedback?.message);

// Both command writers and legacy author autosaves flow through this durable,
// idempotent event consumer. Out-of-order deliveries cannot roll a cursor back.
export async function processReviewEvent(db,schoolId,planId,eventId,event) {
  const school=db.doc(`schools/${schoolId}`),reviewRef=school.collection('lessonPlanReviews').doc(planId);
  await db.runTransaction(async tx=>{
    const receipt=school.collection('reviewEventReceipts').doc(key(`${planId}:${eventId}`));
    const [done,schoolSnap,memberSnap,reviewSnap,historySnap]=await Promise.all([tx.get(receipt),tx.get(school),tx.get(school.collection('members')),tx.get(reviewRef),tx.get(school.collection('lessonPlanReviewHistory').doc(planId))]);
    if(done.exists||!schoolSnap.exists||historySnap.data()?.ownerUid!==event.ownerUid)return;
    const members=memberSnap.docs.map(doc=>({...doc.data(),uid:doc.id})),schoolData=schoolSnap.data(),review=reviewSnap.data()||{};
    const admins=[...new Set([schoolData.creatorUid,...members.filter(m=>m.role==='admin'&&m.status==='active').map(m=>m.uid)].filter(Boolean))];
    const owner=members.find(m=>m.uid===event.ownerUid);
    const ownerAllowed=admins.includes(event.ownerUid)||(owner?.status==='active'&&['teacher','dept_head'].includes(owner.role)&&schoolData.rolePermissions?.teacher?.['lesson-plans']!==false);
    let actorUid=event.actorUid;
    if(event.action==='auto_reopen'&&eventId.endsWith('-reopen'))actorUid=(await tx.get(school.collection('lessonPlanReviewHistory').doc(planId).collection('events').doc(eventId.slice(0,-7)))).data()?.actorUid||actorUid;
    const recipients=[...new Set([...admins,...(ownerAllowed?[event.ownerUid]:[])])].filter(uid=>uid!==actorUid);
    const states=await Promise.all(recipients.map(uid=>tx.get(school.collection('lessonPlanActivity').doc(uid).collection('plans').doc(planId))));
    const assigned=event.reviewer?.uid??review.reviewerUid;
    const bell=[...new Set([...(ownerAllowed?[event.ownerUid]:[]),...(assigned&&admins.includes(assigned)?[assigned]:admins),event.previousReviewerUid])].filter(uid=>uid&&uid!==actorUid&&(admins.includes(uid)||(ownerAllowed&&uid===event.ownerUid)));
    const bucket=Math.floor(millis(event.at)/1800000),noticeId=`plan-${key(event.action==='update'?`${planId}:${event.shareToken}:${actorUid}:${bucket}`:`${planId}:${eventId}`)}`;
    const noticeRef=school.collection('workflowNotices').doc(noticeId),previousNotice=(await tx.get(noticeRef)).data();
    const cursor={at:event.at,id:eventId};
    states.forEach((snapshot,index)=>{
      const previous=snapshot.data()||{},patch={planId,ownerUid:event.ownerUid};
      if(compareActivity(cursor,head(previous,'history'))>0)Object.assign(patch,{historyAt:event.at,historyEventId:eventId,historyActorName:event.actorName,historyAction:event.action});
      if(isFeedback(event)&&compareActivity(cursor,head(previous,'feedback'))>0)Object.assign(patch,{feedbackAt:event.at,feedbackEventId:eventId,feedbackActorName:event.actorName});
      tx.set(school.collection('lessonPlanActivity').doc(recipients[index]).collection('plans').doc(planId),patch,{merge:true});
    });
    if(compareActivity(cursor,head(review,'history'))>0)tx.set(reviewRef,{ownerUid:event.ownerUid,reviewStatus:event.reviewStatus,historyAt:event.at,historyEventId:eventId},{merge:true});
    if(event.action!=='auto_reopen'&&bell.length){
      const newest=!previousNotice||compareActivity(cursor,{at:previousNotice.at,id:previousNotice.eventId})>0;
      const readBy={...previousNotice?.readBy};bell.forEach(uid=>{readBy[uid]=false;});
      const kind=event.action.startsWith('reviewer_')?'plan_assignment':event.action==='review'?'plan_review':event.action==='update'?'plan_update':event.action==='unshare'?'plan_unshare':['share','reshare'].includes(event.action)?'plan_share':event.action==='resubmit'?'plan_resubmit':event.action==='reply'||(event.action==='comment'&&actorUid===event.ownerUid)?'plan_reply':'plan_feedback';
      tx.set(noticeRef,{recipientUids:[...new Set([...(previousNotice?.recipientUids||[]),...bell])],readBy,
        kind:newest?kind:previousNotice.kind,title:event.plan?.lessonUnit||event.plan?.subject||'Lesson plan',target:'lesson-plans',recordId:planId,
        actorName:newest?event.actorName:previousNotice.actorName||'',eventId:newest?eventId:previousNotice.eventId,at:newest?event.at:previousNotice.at,
        count:(previousNotice?.count||0)+1});
    }
    tx.set(receipt,{eventId,planId,at:event.at});
  });
}
