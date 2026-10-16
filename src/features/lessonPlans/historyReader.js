const time = value => value?.toMillis?.() ?? new Date(value || 0).getTime();

// Immutable events can be merged across cursor pages without refetching every
// earlier page. The live query is anchored at the initial oldest document, so
// even a burst of new events cannot leave a gap in a sliding limited query.
export function createHistoryReader({ read, listen }, onChange, { pageSize = 100 } = {}) {
  const records = new Map();
  let alive = true, stop = () => {}, cursor = null;
  let state = { rows: [], loading: true, loadingMore: false, hasMore: false, error: false, pageError: false };
  const publish = patch => {
    if (!alive) return;
    state = { ...state, ...patch };
    onChange(state);
  };
  const merge = docs => {
    for (const doc of docs) records.set(doc.id, { ...doc.data(), eventId: doc.id });
    return [...records.values()].sort((a, b) => time(b.at) - time(a.at) || (a.eventId < b.eventId ? 1 : a.eventId > b.eventId ? -1 : 0));
  };
  const acceptPage = docs => {
    cursor = docs[Math.min(pageSize, docs.length) - 1] || cursor;
    publish({ rows: merge(docs), loading: false, loadingMore: false, hasMore: docs.length > pageSize, pageError: false });
  };
  return {
    async start() {
      try {
        const docs = await read({ limit: pageSize + 1 });
        if (!alive) return;
        acceptPage(docs);
        stop = listen(docs.at(-1), updates => {
          publish({ rows: merge(updates), error: false });
        }, () => {
          // Do not keep displaying previously authorized snapshots after a
          // membership change or denied listener.
          records.clear();
          publish({ rows: [], hasMore: false, error: true });
        });
      } catch {
        publish({ rows: [], loading: false, error: true });
      }
    },
    async loadMore() {
      if (!alive || state.loading || state.loadingMore || !state.hasMore || state.error) return;
      publish({ loadingMore: true, pageError: false });
      try {
        const docs = await read({ after: cursor, limit: pageSize + 1 });
        if (alive && !state.error) acceptPage(docs);
      } catch {
        publish({ loadingMore: false, pageError: true });
      }
    },
    dispose() { alive = false; stop(); },
  };
}
