// Student records are the one school collection that can grow to tens of
// thousands of documents, so nothing loads the whole collection. Every screen
// asks for exactly what it shows: one page of the directory, one class or
// course roster, one record, a search, or a server-side count.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection, doc, documentId, getCountFromServer, getDocs, limit, onSnapshot, or, orderBy, query, startAfter, where,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { chooseSearchToken, matchesStudentSearch, normalizeSearchText, searchWordTokens } from './studentSearch';

export const DIRECTORY_PAGE_SIZE = 30;
export const SEARCH_RESULT_LIMIT = 100;
export const ROSTER_LIMIT = 2000;
const COUNT_TTL_MS = 60_000;
const COUNT_CONCURRENCY = 6;
const ID_CHUNK = 30; // Firestore's limit for an "in" filter.
const EXPORT_PAGE_SIZE = 1000;

const CACHE_GRACE_MS = 4000;

const studentsCollection = schoolId => collection(db, 'schools', schoolId, 'students');
const toStudent = snapshot => ({ id: snapshot.id, ...snapshot.data() });
const isIndexBuilding = error => error?.code === 'failed-precondition';
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * onSnapshot that waits for the server's first answer. With the offline cache
 * on, a new query first reports whichever matching records happen to be
 * cached, which can be a few students out of a whole class. That cached
 * answer is used only when offline or when the server is slow to reply.
 */
function onServerSnapshot(target, onNext, onError) {
  let delivered = false;
  let latestCached = null;
  let timer = null;
  const deliver = snapshot => { delivered = true; onNext(snapshot); };
  const unsubscribe = onSnapshot(target, { includeMetadataChanges: true }, snapshot => {
    if (!delivered && snapshot.metadata.fromCache && !isOffline()) {
      latestCached = snapshot;
      if (!timer) timer = setTimeout(() => { timer = null; if (!delivered && latestCached) deliver(latestCached); }, CACHE_GRACE_MS);
      return;
    }
    clearTimeout(timer);
    timer = null;
    // Skip metadata-only query updates once the data is showing.
    if (delivered && typeof snapshot.docChanges === 'function' && snapshot.docChanges().length === 0) return;
    deliver(snapshot);
  }, onError);
  return () => { clearTimeout(timer); unsubscribe(); };
}

// ── Search token ─────────────────────────────────────────────────────────
// Firestore allows one array-contains per query, so a search runs on one of
// its words and the others are checked on the client. Every match contains
// every word, so any word's results include all matches; the word with the
// fewest students gives the smallest list to page through.

const tokenCounts = new Map();
function countTokenMatches(schoolId, token) {
  const key = `${schoolId}|${token}`;
  const cached = tokenCounts.get(key);
  if (cached?.promise) return cached.promise;
  if (cached && Date.now() - cached.at < COUNT_TTL_MS) return Promise.resolve(cached.value);
  const promise = getCountFromServer(query(studentsCollection(schoolId), where('searchTokens', 'array-contains', token)))
    .then(snapshot => {
      const value = snapshot.data().count;
      tokenCounts.set(key, { value, at: Date.now() });
      return value;
    })
    // Without a count, fall back to preferring the longest word.
    .catch(() => { tokenCounts.delete(key); return Infinity; });
  tokenCounts.set(key, { promise, at: Date.now() });
  return promise;
}

/** The query word with the fewest matching students. */
export async function pickSearchToken(schoolId, term) {
  const tokens = searchWordTokens(term);
  if (tokens.length <= 1) return tokens[0] || '';
  const counts = await Promise.all(tokens.map(token => countTokenMatches(schoolId, token)));
  return chooseSearchToken(tokens, counts);
}

/** pickSearchToken as a hook; the token is empty while a multi-word choice is counted. */
function useSearchToken(schoolId, term, enabled) {
  const tokens = enabled && schoolId ? searchWordTokens(term) : [];
  const key = tokens.length > 1 ? `${schoolId}|${tokens.join(' ')}` : '';
  const [state, setState] = useState({ key: '', token: '' });
  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    pickSearchToken(schoolId, term).then(token => { if (active) setState({ key, token }); });
    return () => { active = false; };
  }, [key, schoolId, term]);
  if (tokens.length === 0) return { token: '', searching: false };
  if (tokens.length === 1) return { token: tokens[0], searching: true };
  return { token: state.key === key ? state.token : '', searching: true };
}

export function compareStudents(a, b) {
  const nameA = a?.nameLower ?? normalizeSearchText(a?.name);
  const nameB = b?.nameLower ?? normalizeSearchText(b?.name);
  return nameA.localeCompare(nameB) || String(a?.id).localeCompare(String(b?.id));
}

export const sortStudents = (students = []) => [...students].sort(compareStudents);

/** Client-side check for the same filters the queries apply. */
export function studentMatchesFilters(student, { status = 'all', classGroupId = '', courseId = '', courseClassGroupId = '' } = {}) {
  if (!student) return false;
  const archived = student.status === 'archived';
  if ((status === 'active' || status === 'unassigned') && archived) return false;
  if (status === 'archived' && !archived) return false;
  if (status === 'unassigned' && student.classGroupId) return false;
  if (classGroupId && String(student.classGroupId || '') !== String(classGroupId)) return false;
  if (courseId) {
    const explicit = Array.isArray(student.assignedClasses) && student.assignedClasses.map(String).includes(String(courseId));
    const viaClass = Boolean(courseClassGroupId) && String(student.classGroupId || '') === String(courseClassGroupId);
    if (!explicit && !viaClass) return false;
  }
  return true;
}

function directoryMode({ enabled, schoolId, searching, courseId, classGroupId }) {
  if (!enabled || !schoolId) return 'off';
  if (searching) return 'search';
  if (courseId) return 'course';
  if (classGroupId) return 'class';
  return 'paged';
}

/**
 * One view of the student directory with live updates.
 * - No filter: pages of 30 ordered by name ("Load more" grows the page).
 * - Class or course: that roster (bounded by class size).
 * - Search: the rarest query word's matches in name order, a page at a time,
 *   refined on the client by the other words and filters.
 * `ordered` is false until the school's records carry sort fields.
 */
export function useStudentDirectory({
  schoolId, search = '', status = 'all', classGroupId = '', courseId = '', courseClassGroupId = '',
  pageSize = DIRECTORY_PAGE_SIZE, enabled = true, ordered = true, pageResults = false,
}) {
  const { token, searching } = useSearchToken(schoolId, search, enabled);
  const mode = directoryMode({ enabled, schoolId, searching, courseId, classGroupId });
  const filterKey = [schoolId, mode, token, status, classGroupId, courseId, courseClassGroupId, ordered].join('|');
  const [paging, setPaging] = useState({ key: filterKey, count: pageSize });
  const count = paging.key === filterKey ? paging.count : pageSize;
  const pagedQueries = mode === 'paged' || (mode === 'search' && ordered);
  const queryKey = `${filterKey}|${pagedQueries ? count : 0}`;
  const [state, setState] = useState({ key: '', items: [], raw: 0, error: null, fallback: false });

  useEffect(() => {
    // A multi-word search waits until its word is chosen.
    if (mode === 'off' || (mode === 'search' && !token)) return undefined;
    let active = true;
    const students = studentsCollection(schoolId);
    const results = {};
    const names = [];
    const unsubscribers = [];
    let fallback = false;

    const publish = () => {
      if (!active || names.some(name => !results[name])) return;
      const merged = new Map();
      let raw = 0;
      for (const name of names) {
        raw = Math.max(raw, results[name].length);
        for (const student of results[name]) merged.set(student.id, student);
      }
      setState({ key: queryKey, items: [...merged.values()], raw, error: null, fallback });
    };
    const fail = error => { if (active) setState({ key: queryKey, items: [], raw: 0, error, fallback }); };
    const listen = (name, studentQuery, onError = fail) => {
      unsubscribers.push(onServerSnapshot(studentQuery, snapshot => {
        results[name] = snapshot.docs.map(toStudent);
        publish();
      }, onError));
    };

    if (mode === 'search') {
      const searchQuery = withOrder => (withOrder
        ? query(students, where('searchTokens', 'array-contains', token), orderBy('nameLower'), limit(count + 1))
        : query(students, where('searchTokens', 'array-contains', token), limit(SEARCH_RESULT_LIMIT)));
      names.push('search');
      // Until the search index is ready, show the first matches unsorted.
      listen('search', searchQuery(ordered), error => {
        if (!active) return;
        if (ordered && isIndexBuilding(error) && !fallback) {
          fallback = true;
          unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
          listen('search', searchQuery(false));
          return;
        }
        fail(error);
      });
      if (!ordered) fallback = true;
    } else if (mode === 'course') {
      names.push('explicit');
      if (courseClassGroupId) names.push('class');
      listen('explicit', query(students, where('assignedClasses', 'array-contains', String(courseId)), limit(ROSTER_LIMIT)));
      if (courseClassGroupId) listen('class', query(students, where('classGroupId', '==', String(courseClassGroupId)), limit(ROSTER_LIMIT)));
    } else if (mode === 'class') {
      names.push('class');
      listen('class', query(students, where('classGroupId', '==', String(classGroupId)), limit(ROSTER_LIMIT)));
    } else {
      const pagedQuery = withOrder => {
        const constraints = [];
        if (status === 'active' || status === 'archived') constraints.push(where('status', '==', status));
        if (status === 'unassigned') constraints.push(where('classGroupId', '==', ''), where('status', '==', 'active'));
        if (withOrder) constraints.push(orderBy('nameLower'));
        constraints.push(limit(count + 1));
        return query(students, ...constraints);
      };
      names.push('page');
      // Until the sort index is ready, show an unsorted page instead of an error.
      listen('page', pagedQuery(ordered), error => {
        if (!active) return;
        if (ordered && isIndexBuilding(error) && !fallback) {
          fallback = true;
          unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
          listen('page', pagedQuery(false));
          return;
        }
        fail(error);
      });
      if (!ordered) fallback = true;
    }
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [queryKey, mode, schoolId, token, status, classGroupId, courseId, courseClassGroupId, count, ordered]);

  // While the next page loads, keep showing the current one instead of blanking the list.
  const sameFilters = state.key.slice(0, state.key.lastIndexOf('|')) === filterKey;
  const current = state.key === queryKey || sameFilters ? state : null;
  const shownCount = state.key === queryKey ? count : Number(state.key.slice(state.key.lastIndexOf('|') + 1)) || count;
  // Memoized so callers can depend on the array without re-running effects.
  // `matched` is the number of results for search and roster modes; paged mode counts on the server.
  const { students, hasMore, matched } = useMemo(() => {
    if (!current) return { students: [], hasMore: false, matched: undefined };
    if (mode === 'paged') {
      const page = current.fallback ? sortStudents(current.items) : current.items;
      return { students: page.slice(0, shownCount), hasMore: page.length > shownCount, matched: undefined };
    }
    const filters = { status, classGroupId, courseId, courseClassGroupId };
    if (mode === 'search' && !current.fallback) {
      // Name-ordered pages of the chosen word's matches; the extra record tells whether more exist.
      const page = current.items.slice(0, shownCount).filter(student => studentMatchesFilters(student, filters) && matchesStudentSearch(student, search));
      const more = current.raw > shownCount;
      return { students: page, hasMore: more, matched: more ? undefined : page.length };
    }
    const all = sortStudents(current.items.filter(student => studentMatchesFilters(student, filters) &&
      (mode !== 'search' || matchesStudentSearch(student, search))));
    // Lists (e.g. the Students page) can show a large roster a page at a time.
    return pageResults
      ? { students: all.slice(0, shownCount), hasMore: all.length > shownCount, matched: all.length }
      : { students: all, hasMore: false, matched: all.length };
  }, [current, mode, shownCount, status, classGroupId, courseId, courseClassGroupId, search, pageResults]);
  const loading = mode !== 'off' && state.key !== queryKey;
  const loadMore = useCallback(() => setPaging({ key: filterKey, count: count + pageSize }), [filterKey, count, pageSize]);
  return {
    students,
    matched,
    // True until the first results for these filters arrive.
    loading: loading && !current,
    loadingMore: loading && Boolean(current),
    error: current?.error || null,
    hasMore,
    // A search or roster hit its cap, so more matches may exist.
    capped: Boolean(current && mode === 'search' && current.fallback && current.raw >= SEARCH_RESULT_LIMIT) ||
      Boolean(current && (mode === 'course' || mode === 'class') && current.raw >= ROSTER_LIMIT),
    mode,
    loadMore,
  };
}

/** Students of one course: stored assignments plus the linked class. */
export function useCourseRoster(schoolId, course, { includeArchived = true } = {}) {
  const result = useStudentDirectory({
    schoolId, courseId: course?.id ? String(course.id) : '', courseClassGroupId: course?.classGroupId ? String(course.classGroupId) : '',
    status: includeArchived ? 'all' : 'active', enabled: Boolean(course?.id),
  });
  return { students: result.students, loading: result.loading, error: result.error, capped: result.capped };
}

/** Students of one homeroom class. */
export function useClassRoster(schoolId, classGroupId, { includeArchived = false } = {}) {
  const result = useStudentDirectory({
    schoolId, classGroupId: classGroupId ? String(classGroupId) : '', status: includeArchived ? 'all' : 'active', enabled: Boolean(classGroupId),
  });
  return { students: result.students, loading: result.loading, error: result.error, capped: result.capped };
}

/** One student record, live. */
export function useStudentRecord(schoolId, studentId) {
  const key = schoolId && studentId ? `${schoolId}|${studentId}` : '';
  const [state, setState] = useState({ key: '', student: null, error: null });
  useEffect(() => {
    if (!key) return undefined;
    return onServerSnapshot(doc(db, 'schools', schoolId, 'students', String(studentId)),
      snapshot => setState({ key, student: snapshot.exists() ? toStudent(snapshot) : null, error: null }),
      error => setState({ key, student: null, error }));
  }, [key, schoolId, studentId]);
  const current = state.key === key ? state : null;
  return { student: current?.student || null, loading: Boolean(key) && !current, error: current?.error || null };
}

/** Typeahead search for pickers (enroll, message, add to class). */
export function useStudentSearch(schoolId, term, { max = 20, enabled = true, debounceMs = 250 } = {}) {
  const words = enabled && schoolId ? searchWordTokens(term).join(' ') : '';
  const [debounced, setDebounced] = useState({ words: '', term: '' });
  useEffect(() => {
    const timer = setTimeout(() => setDebounced({ words, term }), words ? debounceMs : 0);
    return () => clearTimeout(timer);
  }, [words, term, debounceMs]);
  const key = debounced.words && schoolId ? `${schoolId}|${debounced.words}` : '';
  const [state, setState] = useState({ key: '', items: [], raw: 0, error: null });
  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    const students = studentsCollection(schoolId);
    // First matches in name order; unsorted while the search index builds.
    pickSearchToken(schoolId, debounced.term)
      .then(token => getDocs(query(students, where('searchTokens', 'array-contains', token), orderBy('nameLower'), limit(SEARCH_RESULT_LIMIT)))
        .catch(error => {
          if (!isIndexBuilding(error)) throw error;
          return getDocs(query(students, where('searchTokens', 'array-contains', token), limit(SEARCH_RESULT_LIMIT)));
        }))
      .then(snapshot => { if (active) setState({ key, items: snapshot.docs.map(toStudent), raw: snapshot.size, error: null }); })
      .catch(error => { if (active) setState({ key, items: [], raw: 0, error }); });
    return () => { active = false; };
  }, [key, schoolId, debounced.term]);
  const current = state.key === key ? state : null;
  const results = useMemo(() => (current
    ? sortStudents(current.items.filter(student => matchesStudentSearch(student, debounced.term))).slice(0, max)
    : []), [current, debounced.term, max]);
  return {
    results,
    loading: Boolean(words) && (words !== debounced.words || !current),
    error: current?.error || null,
    capped: Boolean(current && (current.raw >= SEARCH_RESULT_LIMIT || results.length >= max)),
    active: Boolean(words),
  };
}

/** Loads the given student records (for rankings or chat members), in chunks. */
export async function fetchStudentsByIds(schoolId, ids = []) {
  const unique = [...new Set(ids.map(String).filter(Boolean))];
  const chunks = [];
  for (let index = 0; index < unique.length; index += ID_CHUNK) chunks.push(unique.slice(index, index + ID_CHUNK));
  const snapshots = await Promise.all(chunks.map(chunk => getDocs(query(studentsCollection(schoolId), where(documentId(), 'in', chunk)))));
  return snapshots.flatMap(snapshot => snapshot.docs.map(toStudent));
}

export function useStudentsByIds(schoolId, ids = []) {
  const idsKey = [...new Set(ids.map(String).filter(Boolean))].sort().join('|');
  const key = schoolId && idsKey ? `${schoolId}#${idsKey}` : '';
  const [state, setState] = useState({ key: '', students: [], error: null });
  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    fetchStudentsByIds(schoolId, idsKey.split('|'))
      .then(students => { if (active) setState({ key, students, error: null }); })
      .catch(error => { if (active) setState({ key, students: [], error }); });
    return () => { active = false; };
  }, [key, schoolId, idsKey]);
  const current = state.key === key ? state : null;
  const students = useMemo(() => current?.students || [], [current]);
  return { students, loading: Boolean(key) && !current, error: current?.error || null };
}

// ── Counts ──────────────────────────────────────────────────────────────
// Aggregation queries count on the server without downloading records.

function countQuery(schoolId, spec) {
  const students = studentsCollection(schoolId);
  switch (spec.kind) {
    case 'status': return query(students, where('status', '==', spec.value));
    case 'unassigned': return query(students, where('classGroupId', '==', ''), where('status', '==', 'active'));
    case 'class': return query(students, where('classGroupId', '==', String(spec.value)), where('status', '==', 'active'));
    case 'course': return spec.classGroupId
      ? query(students, or(where('assignedClasses', 'array-contains', String(spec.value)), where('classGroupId', '==', String(spec.classGroupId))))
      : query(students, where('assignedClasses', 'array-contains', String(spec.value)));
    default: return students;
  }
}

export const countSpecKey = spec => [spec.kind, spec.value ?? '', spec.classGroupId ?? ''].join(':');

const countCache = new Map();

export function fetchStudentCount(schoolId, spec, version = 0) {
  const key = `${schoolId}|${version}|${countSpecKey(spec)}`;
  const cached = countCache.get(key);
  if (cached?.promise) return cached.promise;
  if (cached && Date.now() - cached.at < COUNT_TTL_MS) return Promise.resolve(cached.value);
  const promise = getCountFromServer(countQuery(schoolId, spec))
    .then(snapshot => {
      const value = snapshot.data().count;
      countCache.set(key, { value, at: Date.now() });
      return value;
    })
    .catch(error => { countCache.delete(key); throw error; });
  countCache.set(key, { promise, at: Date.now() });
  return promise;
}

/**
 * Server-side counts for a list of specs, e.g. one per course card.
 * `version` changes after this browser edits students, refreshing counts.
 */
export function useStudentCounts(schoolId, specs = [], version = 0) {
  const specsKey = specs.map(countSpecKey).join(',');
  const key = schoolId && specs.length ? `${schoolId}|${version}|${specsKey}` : '';
  const [state, setState] = useState({ key: '', counts: {}, error: null, done: false });
  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    const pending = specsKey.split(',').map(item => {
      const [kind, value, classGroupId] = item.split(':');
      return { kind, value, classGroupId };
    });
    const counts = {};
    let firstError = null;
    let next = 0;
    const worker = async () => {
      while (active && next < pending.length) {
        const spec = pending[next++];
        try {
          counts[countSpecKey(spec)] = await fetchStudentCount(schoolId, spec, version);
        } catch (error) {
          firstError = firstError || error;
        }
        if (active) setState({ key, counts: { ...counts }, error: firstError, done: false });
      }
    };
    Promise.all(Array.from({ length: Math.min(COUNT_CONCURRENCY, pending.length) }, worker))
      .then(() => { if (active) setState({ key, counts: { ...counts }, error: firstError, done: true }); });
    return () => { active = false; };
  }, [key, schoolId, specsKey, version]);
  const current = state.key === key ? state : null;
  return {
    get: spec => current?.counts[countSpecKey(spec)],
    loading: Boolean(key) && !current?.done,
    error: current?.error || null,
  };
}

/**
 * Every student matching the directory filters, read page by page for a CSV
 * export. Ordered by document id so no composite index is needed.
 */
export async function fetchStudentsForExport(schoolId, { status = 'all', classGroupId = '', courseId = '', courseClassGroupId = '' } = {}) {
  const students = studentsCollection(schoolId);
  const filters = { status, classGroupId, courseId, courseClassGroupId };
  if (courseId || classGroupId) {
    const rosterQueries = courseId
      ? [query(students, where('assignedClasses', 'array-contains', String(courseId))),
        ...(courseClassGroupId ? [query(students, where('classGroupId', '==', String(courseClassGroupId)))] : [])]
      : [query(students, where('classGroupId', '==', String(classGroupId)))];
    const snapshots = await Promise.all(rosterQueries.map(rosterQuery => getDocs(rosterQuery)));
    const merged = new Map();
    snapshots.forEach(snapshot => snapshot.docs.forEach(item => merged.set(item.id, toStudent(item))));
    return sortStudents([...merged.values()].filter(student => studentMatchesFilters(student, filters)));
  }
  const constraints = [];
  if (status === 'active' || status === 'archived') constraints.push(where('status', '==', status));
  if (status === 'unassigned') constraints.push(where('classGroupId', '==', ''), where('status', '==', 'active'));
  const all = [];
  let cursor = null;
  for (;;) {
    const page = await getDocs(query(students, ...constraints, orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(EXPORT_PAGE_SIZE)));
    all.push(...page.docs.map(toStudent));
    if (page.size < EXPORT_PAGE_SIZE) break;
    cursor = page.docs[page.docs.length - 1];
  }
  return sortStudents(all);
}
