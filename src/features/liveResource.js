export const readDenied = error => ['permission-denied','unauthenticated','functions/permission-denied','functions/unauthenticated'].includes(error?.code) || error?.details?.key === 'access';
export const verifiedSnapshot = snapshot => !snapshot.metadata?.fromCache && !snapshot.metadata?.hasPendingWrites;
export const emptyReadReady = state => Boolean(state.hasLoaded && !state.loading && !state.refreshing && !state.error);
export function compareReadValues(a,b){
  if(typeof a?.seconds==='number'&&typeof b?.seconds==='number')return a.seconds-b.seconds||(a.nanoseconds||0)-(b.nanoseconds||0);
  const value=item=>item?.toMillis?.()??(item instanceof Date?item.getTime():item??'');
  return value(a)<value(b)?-1:value(a)>value(b)?1:0;
}

// Only acknowledged server results establish existence/emptiness. Verified data
// survives navigation; each new subscription revalidates it in the background.
export function createLiveResource({listen,empty,denied=readDenied}) {
  let state={...empty,hasLoaded:false,loading:true,refreshing:false,error:null};
  let alive=false,generation=0,stop=()=>{};
  const subscribers=new Set();
  const emit=patch=>{state={...state,...patch};subscribers.forEach(fn=>fn());};
  const fail=(revision,error)=>{
    if(!alive||generation!==revision)return;
    if(denied(error)){generation++;stop();emit({...empty,hasLoaded:false});}
    emit({loading:false,refreshing:false,error});
  };
  const connect=()=>{
    stop();const revision=++generation;
    emit({loading:!state.hasLoaded,refreshing:state.hasLoaded,error:null});
    try{stop=listen(snapshot=>{
      if(!alive||generation!==revision||snapshot.cached||snapshot.pending)return;
      emit({...snapshot.data,hasLoaded:true,loading:false,refreshing:false,error:null});
    },error=>fail(revision,error));}catch(error){fail(revision,error);}
  };
  return {
    snapshot:()=>state,
    isActive:()=>subscribers.size>0,
    subscribe(fn){
      subscribers.add(fn);
      if(!alive){alive=true;connect();}
      return()=>{subscribers.delete(fn);if(!subscribers.size){alive=false;generation++;stop();emit({loading:!state.hasLoaded,refreshing:state.hasLoaded});}};
    },
    refresh(){if(alive)connect();},
    dispose(){alive=false;generation++;stop();emit({...empty,hasLoaded:false,loading:true,refreshing:false,error:null});},
  };
}

// Never evict a cache still used by another mounted view/provider.
export function trimInactiveStores(stores,maximum=100,prefix='') {
  const candidates=[...stores].filter(([key])=>key.includes(prefix));
  const newest=[...stores.keys()].at(-1);
  let excess=candidates.length-maximum;
  for(const [key,store] of candidates){if(excess<=0)break;if(key!==newest&&!store.isActive()){store.dispose();stores.delete(key);excess--;}}
}
