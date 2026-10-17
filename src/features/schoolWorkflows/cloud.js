import { useAuth } from '../../context/AuthContext';
import { createPagedList } from './listCache.js';
import { createSearchPages } from './searchPages.js';
import {createLiveResource,compareReadValues,readDenied,trimInactiveStores} from '../liveResource.js';
import {createCloudHistoryReader} from '../lessonPlans/historyCloud.js';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { collection, doc, documentId, endAt, getDocsFromServer, limit, onSnapshot, orderBy, query, startAfter, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
export const callWorkflow = httpsCallable(functions, 'schoolWorkflow', { timeout: 120000 });
const listCaches = new Map(), directoryCaches = new Map(), documentCaches = new Map();
let activeScope = '';
const denied = readDenied;
function useWorkflowScope() {
  const {currentUser,activeSchoolId,currentRole,roleReady,activeSchool}=useAuth();
  const scope=JSON.stringify([currentUser?.uid,activeSchoolId,currentRole,roleReady,activeSchool?.rolePermissions]);
  useEffect(()=>{ if(activeScope===scope)return; activeScope=scope; for(const map of[listCaches,directoryCaches,documentCaches])for(const [key,store]of map)if(!key.startsWith(scope+'|')){store.dispose();map.delete(key);} },[scope]);
  return scope;
}
export function useWorkflowDirectory(schoolId, module) {
  const scope=useWorkflowScope(),key=scope+'|'+schoolId+':'+module;
  let store=inactive;
  if(schoolId){
    store=directoryCaches.get(key);
    if(!store){store=createLiveResource({empty:{value:{staff:[],classes:[],courses:[]}},listen:(next,error)=>{
      let active=true;callWorkflow({schoolId,action:'workflowDirectory',module}).then(response=>{if(active)next({data:{value:response.data}});}).catch(cause=>{if(active)error(cause);});
      return()=>{active=false;};
    }});directoryCaches.set(key,store);trimInactiveStores(directoryCaches);}
  }
  const state=useSyncExternalStore(store.subscribe,store.snapshot,store.snapshot);
  return {...(state.value||{staff:[],classes:[],courses:[]}),...state,retry:store.refresh};
}
export function useWorkflowAction(schoolId) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const pending = useRef(null), running = useRef(false);
  const run = async (action, fields = {}) => {
    if (running.current) return null;
    running.current = true; setBusy(true); setError(null);
    const data = JSON.parse(JSON.stringify({ schoolId, action, ...fields })), key = JSON.stringify(data);
    if (pending.current?.key !== key) pending.current = { key, commandId: crypto.randomUUID() };
    try {
      const response = await callWorkflow({ ...data, commandId: pending.current.commandId });
      pending.current = null;
      return response.data;
    } catch (error) { setError(error); throw error; }
    finally { running.current = false; setBusy(false); }
  };
  return { run, busy, error, clearError: () => setError(null) };
}
export function useWorkflowDocument(schoolId,path) {
  return useScopedDocument(schoolId&&path?['schools',schoolId,...path.split('/')]:null);
}
export function useScopedDocument(path) {
  const scope=useWorkflowScope(),pathKey=JSON.stringify(path),key=scope+'|document:'+pathKey;
  let store=inactive;
  if(path){store=documentCaches.get(key);if(!store){store=createLiveResource({empty:{value:null},listen:(next,error)=>onSnapshot(doc(db,...JSON.parse(pathKey)),{includeMetadataChanges:true},snapshot=>next({data:{value:snapshot.exists()?{...snapshot.data(),id:snapshot.id}:null},cached:snapshot.metadata.fromCache,pending:snapshot.metadata.hasPendingWrites}),error)});documentCaches.set(key,store);trimInactiveStores(documentCaches);}}
  const state=useSyncExternalStore(store.subscribe,store.snapshot,store.snapshot);
  return {...state,retry:store.refresh};
}
export function useWorkflowCollection(schoolId,path,filters=[]) {
  return useScopedCollection(schoolId&&path?['schools',schoolId,...path.split('/')]:null,filters);
}
export function useScopedCollection(path,filters=[]) {
  const scope=useWorkflowScope(),pathKey=JSON.stringify(path),filtersKey=JSON.stringify(filters),key=scope+'|collection:'+pathKey+':'+filtersKey;
  let store=inactive;
  if(path){store=documentCaches.get(key);if(!store){store=createLiveResource({empty:{rows:[]},listen:(next,error)=>onSnapshot(query(collection(db,...JSON.parse(pathKey)),...JSON.parse(filtersKey).map(([field,op,value])=>where(field,op,value))),{includeMetadataChanges:true},snapshot=>next({data:{rows:snapshot.docs.map(entry=>({...entry.data(),id:entry.id}))},cached:snapshot.metadata.fromCache,pending:snapshot.metadata.hasPendingWrites}),error)});documentCaches.set(key,store);trimInactiveStores(documentCaches);}}
  const state=useSyncExternalStore(store.subscribe,store.snapshot,store.snapshot);
  return {...state,retry:store.refresh};
}
const emptyList={rows:[],value:null,hasLoaded:false,loading:false,loadingMore:false,refreshing:false,more:false,hasMore:false,error:null};
const inactive={snapshot:()=>emptyList,subscribe:()=>()=>{},refresh:()=>{},loadMore:()=>{}};
export function useLessonPlanHistory(schoolId,planId){
  const scope=useWorkflowScope(),key=scope+'|history:'+JSON.stringify([schoolId,planId]);
  let store=inactive;
  if(schoolId&&planId){store=listCaches.get(key);if(!store){store=createCloudHistoryReader(db,schoolId,planId);listCaches.set(key,store);trimInactiveStores(listCaches,24,'|history:');}}
  const state=useSyncExternalStore(store.subscribe,store.snapshot,store.snapshot);
  return {...state,loadMore:store.loadMore,retry:store.refresh};
}
export function useWorkflowList(schoolId,path,filters=[],field='updatedAt',direction='desc') {
  const scope=useWorkflowScope(),filtersKey=JSON.stringify(filters),key=scope+'|'+JSON.stringify([schoolId,path,filtersKey,field,direction]);
  let store=inactive;
  if(schoolId&&path){
    store=listCaches.get(key);
    if(!store){
      const source=query(collection(db,'schools',schoolId,...path.split('/')),...JSON.parse(filtersKey).map(([name,op,val])=>where(name,op,val)),orderBy(field,direction));
      const factor=direction==='desc'?-1:1;
      store=createPagedList({
        read:async({after,limit:size})=>(await getDocsFromServer(query(source,...(after?[startAfter(after)]:[]),limit(size)))).docs,
        listen:(bounds,next,error)=>onSnapshot(bounds.limit?query(source,limit(bounds.limit)):query(source,endAt(bounds.anchor)),{includeMetadataChanges:true},snapshot=>next({docs:snapshot.docs,cached:snapshot.metadata.fromCache,pending:snapshot.metadata.hasPendingWrites}),error),
        compare:(a,b)=>factor*(compareReadValues(a[field],b[field])||compareReadValues(a.id,b.id)),denied,
      });
      listCaches.set(key,store);
      trimInactiveStores(listCaches,40);
    }
  }
  const state=useSyncExternalStore(store.subscribe,store.snapshot,store.snapshot);
  return {...state,refresh:store.refresh,loadMore:store.loadMore};
}
export function useWorkflowSearch(schoolId, kind, filters, enabled = true) {
  const scope = useWorkflowScope(), { currentUser, currentRole } = useAuth();
  const filtersKey = JSON.stringify({...filters,search:String(filters.search||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim()}), [settled, setSettled] = useState(filtersKey);
  useEffect(() => { const timer = setTimeout(() => setSettled(filtersKey), 250); return () => clearTimeout(timer); }, [filtersKey]);
  const module = kind === 'students'?'students':kind === 'requests' ? 'school-requests' : 'coverage';
  const key = scope + '|search:' + JSON.stringify([schoolId, kind, settled]);
  let store = inactive;
  if (schoolId && enabled) {
    store = listCaches.get(key);
    if (!store) {
      store = createSearchPages({ read: async fields => (await callWorkflow({ schoolId, action: 'workflowSearch', module, kind, filters: JSON.parse(settled), ...fields })).data, denied });
      listCaches.set(key, store);
      // Bound distinct filter caches without evicting any active live list.
      trimInactiveStores(listCaches,24,'|search:');
    }
  }
  const state = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const visibleStudents=kind==='students'?JSON.stringify(state.rows.map(row=>row.id)):'';
  useEffect(()=>{
    if(!schoolId||!enabled||!visibleStudents||filtersKey!==settled)return;
    const ids=JSON.parse(visibleStudents);let timer;
    const off=[];
    // A newest-document listener cannot see deletion of an older displayed row.
    // Watch only the visible IDs, never the whole school directory.
    for(let offset=0;offset<ids.length;offset+=30){let signature;
      off.push(onSnapshot(query(collection(db,'schools',schoolId,'students'),where(documentId(),'in',ids.slice(offset,offset+30))),{includeMetadataChanges:true},snapshot=>{
        if(snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
        const next=JSON.stringify(snapshot.docs.map(doc=>[doc.id,doc.data()]));
        if((signature!==undefined&&signature!==next)||(signature===undefined&&snapshot.size!==ids.slice(offset,offset+30).length)){clearTimeout(timer);timer=setTimeout(()=>store.refresh(),150);}
        signature=next;
      },()=>store.refresh()));
    }
    return()=>{clearTimeout(timer);off.forEach(stop=>stop());};
  },[schoolId,enabled,visibleStudents,filtersKey,settled,store]);
  useEffect(() => {
    if (!schoolId || !enabled || filtersKey !== settled) return;
    const path = kind==='students'?'students':kind === 'requests' ? 'schoolRequests' : kind === 'lessons' ? 'lessonCoverage' : 'teacherAbsences';
    const scopeFilter = kind==='students'||currentRole === 'admin' ? [] : [where(kind === 'absences' ? 'teacherUid' : 'participantUids', kind === 'absences' ? '==' : 'array-contains', currentUser?.uid)];
    let head, timer;
    const off = onSnapshot(query(collection(db,'schools',schoolId,path), ...scopeFilter, orderBy('updatedAt','desc'), limit(1)), {includeMetadataChanges:true}, snapshot => {
      if (snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites) return;
      const next = snapshot.docs.map(doc => `${doc.id}:${doc.data().revision}:${doc.data().updatedAt?.toMillis?.()}`).join('|');
      if (head !== undefined && head !== next) { clearTimeout(timer); timer = setTimeout(() => store.refresh(), 150); }
      head = next;
    }, () => store.refresh());
    return () => { clearTimeout(timer); off(); };
  }, [schoolId, kind, enabled, currentRole, currentUser?.uid, filtersKey, settled, store]);
  return { ...(filtersKey === settled ? state : { ...emptyList, loading: true }), next: store.next, previous: store.previous, refresh: store.refresh };
}
export async function photoForWorkflow(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) throw Object.assign(new Error('photo'), { key: 'photo' });
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.82, .65, .48, .3]) {
      const value = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      if (value.length < 530000) return { name: file.name.slice(0, 180), type: 'image/jpeg', base64: value };
    }
    throw Object.assign(new Error('photo'), { key: 'photo' });
  } finally { image.close(); }
}
