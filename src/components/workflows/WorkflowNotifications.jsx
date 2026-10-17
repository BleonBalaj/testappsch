import ReadStatus from '../ReadStatus';
import {emptyReadReady} from '../../features/liveResource';
import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useWorkflowList } from '../../features/schoolWorkflows/cloud';
import { words, workflowLabel, workflowTime } from '../../features/schoolWorkflows/i18n';
import { WorkflowDialog, WorkflowError, WorkflowListFooter } from './WorkflowUI';

export default function WorkflowNotifications({ schoolId, uid, language, onNavigate, onNotice }) {
  const [open,setOpen]=useState(false),[error,setError]=useState(null),[busy,setBusy]=useState(false);
  const list=useWorkflowList(schoolId,'workflowNotices',[['recipientUids','array-contains',uid]],'at');
  const seen=useRef(null),noticeCallback=useRef(onNotice);
  useEffect(()=>{noticeCallback.current=onNotice;},[onNotice]);
  useEffect(()=>{
    if(list.loading||list.error)return;
    const head=list.rows.slice(0,40),previous=seen.current;
    const versions=new Map(head.map(row=>[row.id,(row.at?.toMillis?.()||0)+':'+(row.eventId||'')]));
    if(previous){const fresh=head.filter(row=>!row.readBy?.[uid]&&previous.get(row.id)!==versions.get(row.id));if(fresh.length){const row=fresh[0];noticeCallback.current?.('info',fresh.length>1?words(language,'New school updates: ','Përditësime të reja të shkollës: ')+fresh.length:[workflowLabel(language,row.kind),row.actorName,row.title].filter(Boolean).join(' · '));}}
    seen.current=versions;
  },[list.rows,list.loading,list.error,uid,language]);
  const unread=list.rows.slice(0,40).filter(row=>!row.readBy?.[uid]).length,l=(en,sq)=>words(language,en,sq);
  const visit=async row=>{
    setBusy(true);setError(null);
    try{
      const latest=await runTransaction(db,async tx=>{const ref=doc(db,'schools',schoolId,'workflowNotices',row.id),snapshot=await tx.get(ref);if(!snapshot.exists())return row;const current={...snapshot.data(),id:snapshot.id};if(current.eventId===row.eventId&&current.at?.isEqual?.(row.at))tx.update(ref,{[`readBy.${uid}`]:true});return current;});
      setOpen(false);onNavigate(latest.target,latest);
    }
    catch(error){setError(error);}finally{setBusy(false);}
  };
  return <><button type="button" className="notification-btn bouncy workflow-notification-button" title={l('Notifications','Njoftimet')} aria-label={`${l('Notifications','Njoftimet')}${unread?` · ${unread}`:''}`} onClick={()=>{setOpen(true);list.refresh();}}><span className="notification-emoji" aria-hidden="true">🔔</span><Bell size={19} className="notification-nature-icon" aria-hidden="true"/>{unread>0&&<span className="workflow-notice-count">{unread}</span>}</button>{open&&<WorkflowDialog title={l('School notifications','Njoftimet e shkollës')} hint={l('Requests, lesson feedback and substitute arrangements. The badge counts unread notices among the latest 40. Opening a notice marks it as read and opens the relevant record.','Kërkesat, komentet për planet dhe zëvendësimet. Numri tregon njoftimet e palexuara ndër 40 më të fundit. Hapja e njoftimit e shënon si të lexuar dhe hap regjistrimin përkatës.')} onClose={()=>setOpen(false)} busy={busy}><WorkflowError language={language} error={error}/><ReadStatus state={list} language={language}/>{emptyReadReady(list)&&!list.rows.length&&<p className="workflow-empty">{l('No workflow notifications yet.','Ende nuk ka njoftime për këto veprime.')}</p>}{list.rows.map(row=><article key={row.id} className={`workflow-record ${!row.readBy?.[uid]?'workflow-notice-unread':''}`}><h3><button type="button" className="workflow-open" disabled={busy} onClick={()=>visit(row)}>{workflowLabel(language,row.kind)}</button></h3><p>{row.title}</p>{row.actorName&&<small>{row.actorName}</small>}<small>{workflowTime(language,row.at)}</small></article>)}<WorkflowListFooter list={list} language={language}/></WorkflowDialog>}</>;
}
