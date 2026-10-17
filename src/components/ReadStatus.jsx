import React,{useSyncExternalStore} from 'react';
import {LoaderCircle} from 'lucide-react';
import './ReadStatus.css';
const subscribeOnline=callback=>{
  window.addEventListener('online',callback);window.addEventListener('offline',callback);
  return()=>{window.removeEventListener('online',callback);window.removeEventListener('offline',callback);};
};
const onlineSnapshot=()=>typeof navigator==='undefined'||navigator.onLine!==false;

export default function ReadStatus({state,language,loadingText}){
  const online=useSyncExternalStore(subscribeOnline,onlineSnapshot,()=>true);
  if(!state)return null;
  if(state.error || !state.loading || state.refreshing || state.hasLoaded || state.rows?.length || state.value) return null;
  const sq=language==='sq';
  return <p className="data-read-status" role="status"><LoaderCircle size={17} aria-hidden="true"/>{!online
    ? (sq?'Jeni jashtë linje. Ngarkimi vazhdon pas rilidhjes.':'You’re offline. Loading will resume when connected.')
    : loadingText||(sq?'Duke ngarkuar…':'Loading…')}</p>;
}
