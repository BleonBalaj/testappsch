import {compareReadValues,readDenied} from '../liveResource.js';
const initial=()=>({rows:[],hasLoaded:false,loading:true,refreshing:false,loadingMore:false,hasMore:false,error:null,pageError:null});

// Immutable cursor pages stay in this scoped store when the drawer closes.
// An anchored live query catches every intervening event on the next visit.
export function createHistoryReader({read,listen},onChange, {pageSize=100,maxCachedRows=500}={}) {
  const records=new Map(),subscribers=new Set();
  let state=initial(),alive=false,generation=0,stop=()=>{},cursor=null,anchor=null;
  const publish=patch=>{
    if(!alive)return;
    state={...state,...patch};onChange?.(state);subscribers.forEach(fn=>fn());
  };
  const merge=docs=>{
    for(const doc of docs)records.set(doc.id,{doc,row:{...doc.data(),eventId:doc.id}});
    return [...records.values()].map(value=>value.row).sort((a,b)=>compareReadValues(b.at,a.at)||compareReadValues(b.eventId,a.eventId));
  };
  const fail=error=>{
    if(readDenied(error)){generation++;stop();records.clear();cursor=anchor=null;publish({rows:[],hasLoaded:false,hasMore:false});}
    publish({loading:false,refreshing:false,loadingMore:false,error});
  };
  const connect=()=>{
    stop();const revision=++generation;
    stop=listen(anchor,snapshot=>{
      if(!alive||generation!==revision)return;
      const {docs,cached,pending}=Array.isArray(snapshot)?{docs:snapshot}:snapshot;
      if(cached||pending)return;
      const first=anchor===null,more=first&&docs.length>pageSize;
      if(first&&docs.length){anchor=docs.at(-1);cursor=docs[Math.min(pageSize,docs.length)-1];}
      publish({rows:merge(docs),hasLoaded:true,loading:false,refreshing:false,error:null,...(first?{hasMore:more}:{})});
      if(first&&docs.length)Promise.resolve().then(()=>{if(alive&&generation===revision)connect();});
    },error=>{if(alive&&generation===revision)fail(error);});
  };
  const start=async()=>{
    if(alive)return;
    alive=true;const revision=++generation;
    if(state.hasLoaded){publish({loading:false,refreshing:true,error:null});connect();return;}
    // The first state is already loading, before any asynchronous read.
    if(state.error)publish({loading:true,error:null});
    try{
      const docs=await read({limit:pageSize+1});
      if(!alive||generation!==revision)return;
      cursor=docs[Math.min(pageSize,docs.length)-1]||null;anchor=docs.at(-1)||null;
      publish({rows:merge(docs),hasLoaded:true,loading:false,refreshing:false,hasMore:docs.length>pageSize,error:null,pageError:null});
      connect();
    }catch(error){if(alive&&generation===revision)fail(error);}
  };
  const pause=()=>{
    alive=false;generation++;stop();
    if(state.rows.length>maxCachedRows+1){
      const kept=state.rows.slice(0,maxCachedRows+1),keepIds=new Set(kept.map(row=>row.eventId));
      cursor=records.get(kept[maxCachedRows-1].eventId).doc;
      for(const id of records.keys())if(!keepIds.has(id))records.delete(id);
      state={...state,rows:kept,hasMore:true};
    }
    state={...state,loading:!state.hasLoaded,loadingMore:false,refreshing:state.hasLoaded};
  };
  return {
    start,pause,
    snapshot:()=>state,
    isActive:()=>subscribers.size>0,
    subscribe(fn){subscribers.add(fn);if(!alive)void start();return()=>{subscribers.delete(fn);if(!subscribers.size)pause();};},
    refresh(){if(!alive)return;if(state.hasLoaded){publish({refreshing:true,error:null});connect();}else{pause();return start();}},
    async loadMore(){
      if(!alive||state.loading||state.loadingMore||!state.hasMore||state.error)return;
      const revision=generation;publish({loadingMore:true,pageError:null});
      try{
        const docs=await read({after:cursor,limit:pageSize+1});
        if(!alive||generation!==revision)return;
        cursor=docs[Math.min(pageSize,docs.length)-1]||cursor;
        publish({rows:merge(docs),loadingMore:false,hasMore:docs.length>pageSize,pageError:null});
      }catch(error){if(alive&&generation===revision){if(readDenied(error))fail(error);else publish({loadingMore:false,pageError:error});}}
    },
    dispose(){pause();records.clear();cursor=anchor=null;state=initial();subscribers.forEach(fn=>fn());},
  };
}
