// Cursor pages of MATCHES, not pages of source records. The callable may return
// a continuation with zero matches; keep scanning until a page or true end.
export function createSearchPages({ read, denied }, { size = 40 } = {}) {
  let state = { rows: [], hasLoaded:false, page: 0, more: false, loading: true, refreshing: false, error: null, scanned: 0 };
  let alive = false, generation = 0;
  const pages = new Map(), starts = new Map([[0, null]]), listeners = new Set();
  const emit = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const load = async (page, refresh = false) => {
    const cached = pages.get(page), revision = ++generation;
    if (cached) emit({ ...cached,hasLoaded:true, page, loading: false, refreshing: true, error: null });
    else emit({ rows: [],hasLoaded:false, page, loading: true, refreshing: false, error: null, scanned: 0 });
    try {
      let cursor = starts.get(page), more = true, rows = [], cursors = [], scanned = 0;
      do {
        const response = await read({ cursor, remaining: size + 1 - rows.length });
        if (!alive || generation !== revision) return;
        rows.push(...response.rows); cursors.push(...response.cursors); scanned += response.scanned;
        if (response.more && JSON.stringify(response.cursor) === JSON.stringify(cursor)) throw new Error('Search cursor did not advance.');
        cursor = response.cursor; more = response.more; emit({ scanned });
      } while (more && rows.length <= size);
      const hasNext = rows.length > size;
      if (refresh) for (const key of pages.keys()) if (key > page) pages.delete(key);
      if (hasNext) starts.set(page + 1, cursors[size - 1]);
      const result = { rows: rows.slice(0, size), more: hasNext, scanned };
      pages.set(page, result);
      // Keep cursor history for Back navigation, but bound retained card data.
      for (const key of pages.keys()) if (key!==0 && Math.abs(key - page) > 2) pages.delete(key);
      emit({ ...result,hasLoaded:true, page, loading: false, refreshing: false, error: null });
    } catch (error) {
      if (!alive || generation !== revision) return;
      if (denied(error)) { pages.clear(); starts.clear(); starts.set(0, null); emit({ rows: [],hasLoaded:false, more: false, page: 0 }); }
      emit({ loading: false, refreshing: false, error });
    }
  };
  return {
    snapshot: () => state,
    isActive:()=>listeners.size>0,
    subscribe(fn) { listeners.add(fn); if (!alive) { alive = true; load(0, true); } return () => { listeners.delete(fn); if (!listeners.size) { alive = false; generation++;state={...state,loading:!state.hasLoaded,refreshing:state.hasLoaded}; } }; },
    next: () => { if (state.more && !state.loading && !state.refreshing) return load(state.page + 1); },
    previous: () => { if (state.page && !state.loading && !state.refreshing) return load(state.page - 1); },
    refresh: () => { if (alive) return load(0, true); },
    dispose() { alive = false; generation++; pages.clear(); starts.clear(); starts.set(0, null); emit({ rows: [],hasLoaded:false, page: 0, more: false, loading: true, refreshing: false, error: null }); },
  };
}
