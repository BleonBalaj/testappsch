import { fail, id, text } from './schoolWorkflowCore.js';
import { compareActivity } from './reviewActivity.js';

async function bootstrap(tx,school,data,actor,admin) {
  let source=school.collection('lessonPlanReviewHistory');
  if(!admin)source=source.where('ownerUid','==',actor.uid);
  source=source.orderBy('__name__').limit(26);
  if(data.cursor)source=source.startAfter(id(data.cursor));
  const page=await tx.get(source),docs=page.docs.slice(0,25);
  const loaded=await Promise.all(docs.map(async history=>{
    const value=history.data(),planId=history.id;
    const activity=school.collection('lessonPlanActivity').doc(actor.uid).collection('plans').doc(planId),review=school.collection('lessonPlanReviews').doc(planId);
    const [previous,current,last,messages]=await Promise.all([tx.get(activity),tx.get(review),tx.get(history.ref.collection('events').doc(value.lastEventId)),tx.get(school.collection('lessonPlanFeedback').doc(planId).collection('messages').orderBy('at','desc').limit(1))]);
    const message=messages.docs[0],feedback=message?{...message.data(),id:message.id}:null;
    let audit=null,version=null;
    if(feedback)[audit,version]=await Promise.all([tx.get(history.ref.collection('events').doc(feedback.id)),tx.get(history.ref.collection('events').doc(feedback.revisionId))]);
    return{history,value,planId,activity,review,previous:previous.data()||{},current:current.data(),last:last.exists?{...last.data(),id:last.id}:null,feedback,audit,version};
  }));
  for(const row of loaded){
    const patch={planId:row.planId,ownerUid:row.value.ownerUid};
    const candidates=[row.last,row.feedback].filter(event=>event?.actorUid&&event.actorUid!==actor.uid).sort((a,b)=>compareActivity(b,a));
    const latest=candidates[0],feedback=row.feedback?.actorUid!==actor.uid?row.feedback:null;
    for(const[type,event]of[['history',latest],['feedback',feedback]])if(event&&compareActivity(event,{at:row.previous[`${type}At`],id:row.previous[`${type}EventId`]})>0){patch[`${type}At`]=event.at;patch[`${type}EventId`]=event.id;}
    tx.set(row.activity,patch,{merge:true});
    if(!row.current)tx.set(row.review,{ownerUid:row.value.ownerUid,reviewerUid:'',reviewerName:'',reviewerEmail:'',revision:0,reviewStatus:row.value.lastReviewStatus||'pending'});
    if(row.feedback&&!row.audit.exists&&row.version.data()?.plan)tx.set(row.history.ref.collection('events').doc(row.feedback.id),{
      planId:row.planId,ownerUid:row.value.ownerUid,actorUid:row.feedback.actorUid,actorName:row.feedback.actorName,actorEmail:row.feedback.actorEmail||'',
      action:row.feedback.action,at:row.feedback.at,shareToken:row.feedback.shareToken,revisionId:row.feedback.revisionId,
      reviewStatus:row.version.data().reviewStatus||'pending',previousReviewStatus:row.version.data().reviewStatus||'pending',plan:row.version.data().plan,
      feedback:{message:row.feedback.message,outcome:row.feedback.outcome},backfilled:true,
    });
  }
  return{cursor:page.size>25?docs.at(-1).id:''};
}

export async function reviewCommand(tx, school, data, actor, admin, at, commandId) {
  if(data.action==='reviewBootstrap')return bootstrap(tx,school,data,actor,admin);
  const planId=id(data.planId), history=school.collection('lessonPlanReviewHistory').doc(planId);
  const [p,s,i,h,r]=await Promise.all([
    tx.get(school.collection('lessonPlans').doc(planId)),tx.get(school.collection('lessonPlanShares').doc(planId)),
    tx.get(school.collection('lessonPlanInbox').doc(planId)),tx.get(history),tx.get(school.collection('lessonPlanReviews').doc(planId)),
  ]);
  if(!admin)fail('access');
  const plan=p.data(),share=s.data(),inbox=i.data(),review=r.data();
  if(!plan||!share||!inbox||!h.exists)fail('notShared');
  if(data.shareToken!==share.shareToken||data.revisionId!==share.revisionId)fail('changed');
  if((review?.revision||0)!==Number(data.reviewRevision||0))fail('reviewChanged');
  const before=review?.reviewerUid||'';
  let assigned=before,action,status=inbox.reviewStatus,note='';
  if(data.action==='reviewAssign') {
    if(before===actor.uid)return{id:planId};
    if(before&&!data.takeover)fail('reviewAssigned');
    if(before)note=text(data.note,2000,true);
    assigned=actor.uid;action=before?'reviewer_reassign':'reviewer_assign';
  } else if(data.action==='reviewRelease') {
    if(before!==actor.uid)fail('reviewerOnly');
    if(status==='archived')fail('reviewArchived');
    assigned='';action='reviewer_release';status='pending';
  } else if(data.action==='reviewStatus') {
    if(before!==actor.uid)fail('reviewerOnly');
    status=data.reviewStatus;
    const allowed={pending:['reviewing'],reviewing:['pending','archived'],archived:['pending']};
    if(status===inbox.reviewStatus)return{id:planId};
    if(!allowed[inbox.reviewStatus]?.includes(status))fail('reviewTransition');
    action='review';
  } else fail('invalid');
  const reviewer=assigned?{uid:assigned,name:assigned===actor.uid?actor.name:review.reviewerName,email:assigned===actor.uid?actor.email:review.reviewerEmail}:{uid:'',name:'',email:''};
  const next={ownerUid:plan.ownerUid,reviewerUid:reviewer.uid,reviewerName:reviewer.name,reviewerEmail:reviewer.email,
    assignedAt:action.startsWith('reviewer_')?at:review.assignedAt||at,reviewStatus:status,revision:(review?.revision||0)+1,updatedAt:at,historyAt:at,historyEventId:commandId};
  tx.set(school.collection('lessonPlanReviews').doc(planId),next,{merge:true});
  tx.update(i.ref,{reviewStatus:status,reviewedByUid:actor.uid,reviewedAt:at,lastEventId:commandId});
  tx.set(history.collection('events').doc(commandId),{planId,ownerUid:plan.ownerUid,actorUid:actor.uid,actorName:actor.name,actorEmail:actor.email,
    action,at,shareToken:share.shareToken,revisionId:share.revisionId,reviewStatus:status,previousReviewStatus:inbox.reviewStatus,plan,
    reviewer,previousReviewerUid:before,previousReviewerName:review?.reviewerName||'',note});
  tx.update(history,{lastEventId:commandId,lastEventAt:at,lastAction:action,lastReviewStatus:status});
  return{id:planId};
}
