// A route can unmount without throwing away its verified pages. Each cache is
// scoped to the active account, membership and permission set by cloud.js.
export function createPagedList({ read, listen, compare, denied }, { pageSize = 40 } = {}) {
  let state = { rows: [], hasLoaded:false, loading: true, loadingMore: false, refreshing: false, more: false, error: null };
  let initialized = false, alive = false, generation = 0, liveRevision=0,readingGeneration=null, stop = () => {}, cursor = null, anchor = null;
  const subscribers = new Set();
  const emit = patch => { state = { ...state, ...patch }; subscribers.forEach(fn => fn()); };
  const rows = docs => docs.map(entry => ({ ...entry.data(), id: entry.id })).sort(compare);
  const failure = error => {
    if (denied(error)) { generation++; stop(); initialized = false; cursor = anchor = null; emit({ rows: [], hasLoaded:false, more: false }); }
    emit({ loading: false, loadingMore: false, refreshing: false, error });
  };
  const connect = () => {
    stop(); const revision = ++generation;
    emit({ refreshing: initialized, loadingMore: false, error: null });
    const completeLimit=state.more?null:Math.max(pageSize+1,state.rows.length+1);
    stop = listen({anchor:state.more?anchor:null,limit:completeLimit}, snapshot => {
      if (!alive || generation !== revision) return;
      // A temporary empty disk-cache result must not erase verified rows.
      if (snapshot.cached || snapshot.pending) return;
      liveRevision++;
      const more=completeLimit?snapshot.docs.length>=completeLimit:state.more;
      if(completeLimit&&snapshot.docs.length){cursor=snapshot.docs[Math.min(snapshot.docs.length,completeLimit-1)-1];anchor=snapshot.docs.at(-1);}
      emit({ rows: rows(snapshot.docs), hasLoaded:true, more, loading: false, refreshing: false, error: null });
      if(completeLimit&&more)Promise.resolve().then(()=>{if(alive&&generation===revision)connect();});
    }, error => { if (alive && generation === revision) failure(error); });
  };
  const load = async more => {
    if (!alive || readingGeneration===generation || state.loadingMore || (more && !state.more)) return;
    const revision = generation,readLiveRevision=liveRevision,knownIds=new Set(state.rows.map(row=>row.id));
    readingGeneration=revision;
    emit(more ? { loadingMore: true, error: null } : { loading: !initialized, refreshing: initialized, error: null });
    try {
      const docs = await read({ after: more ? cursor : null, limit: pageSize + 1 });
      if (!alive || generation !== revision) return;
      cursor = docs[Math.min(pageSize, docs.length) - 1] || cursor;
      anchor = docs.at(-1) || anchor;
      const merged = more ? new Map(state.rows.map(row => [row.id, row])) : new Map();
      rows(docs).forEach(row => {
        // The live query may have updated/deleted an overlapping lookahead
        // while this older-page request was in flight. Keep that newer truth.
        if(more&&liveRevision!==readLiveRevision&&knownIds.has(row.id))return;
        merged.set(row.id, row);
      });
      initialized = true;
      emit({ rows: [...merged.values()].sort(compare), hasLoaded:true, loading: false, loadingMore: false, more: docs.length > pageSize, error: null });
      connect();
    } catch (error) { if (alive && generation === revision) failure(error); }
    finally {if(readingGeneration===revision)readingGeneration=null;}
  };
  return {
    snapshot: () => state,
    isActive:()=>subscribers.size>0,
    subscribe(fn) {
      subscribers.add(fn);
      if (!alive) { alive = true; if (initialized) connect(); else load(false); }
      return () => { subscribers.delete(fn); if (!subscribers.size) { alive = false; generation++; stop(); emit({ loading:!initialized,loadingMore: false, refreshing: initialized }); } };
    },
    loadMore: () => load(true),
    refresh: () => { if (!alive) return; if (initialized) connect(); else load(false); },
    dispose() { alive = false; generation++; stop(); initialized = false; cursor = anchor = null; emit({ rows: [], hasLoaded:false, loading: true, loadingMore: false, refreshing: false, more: false, error: null }); },
  };
}
