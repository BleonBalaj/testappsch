import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {useAuth} from './AuthContext';
import {callWorkflow,useWorkflowCollection} from '../features/schoolWorkflows/cloud';
import {hasUnreadActivity} from '../features/lessonPlans/activity';
const Context=createContext({reviews:{},activity:{},loading:false,error:null});
const initialized=new Set();
export function LessonReviewProvider({children}) {
  const {activeSchoolId,currentUser,currentRole,roleReady,activeSchool}=useAuth();
  const uid=currentUser?.uid,admin=currentRole==='admin';
  const enabled=roleReady&&uid&&['admin','teacher','dept_head'].includes(currentRole)&&(admin||activeSchool?.rolePermissions?.teacher?.['lesson-plans']!==false);
  const schoolId=enabled?activeSchoolId:null;
  const key=JSON.stringify([uid,schoolId,currentRole,activeSchool?.rolePermissions]);
  const reviews=useWorkflowCollection(schoolId,'lessonPlanReviews',admin?[]:[['ownerUid','==',uid||'']]);
  const activity=useWorkflowCollection(schoolId,`lessonPlanActivity/${uid}/plans`);
  const [attempt,setAttempt]=useState(0),[bootstrap,setBootstrap]=useState({key:'',error:null});
  useEffect(()=>{
    if(!schoolId||initialized.has(key))return;
    let active=true;
    (async()=>{
      let cursor='';
      do{const response=await callWorkflow({schoolId,action:'reviewBootstrap',commandId:crypto.randomUUID(),cursor});cursor=response.data.cursor;}while(active&&cursor);
      if(active){initialized.add(key);setBootstrap({key,error:null});}
    })().catch(error=>{if(active)setBootstrap({key,error});});
    return()=>{active=false;};
  },[schoolId,key,attempt]);
  const value=useMemo(()=>({reviews:Object.fromEntries(reviews.rows.map(row=>[row.id,row])),activity:Object.fromEntries(activity.rows.map(row=>[row.id,row])),loading:reviews.loading||activity.loading,refreshing:reviews.refreshing||activity.refreshing,error:reviews.error||activity.error||(bootstrap.key===key&&bootstrap.error),retry:()=>{reviews.retry();activity.retry();initialized.delete(key);setAttempt(value=>value+1);}}),[reviews,activity,bootstrap,key]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useLessonReviews=()=>useContext(Context);
export function usePlanActivity(planId){const context=useLessonReviews(),value=context.activity[planId];return{...context,review:context.reviews[planId],value,historyUnread:hasUnreadActivity(value,'history'),feedbackUnread:hasUnreadActivity(value,'feedback')};}
