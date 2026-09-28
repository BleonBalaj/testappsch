import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

const KINDS = ['assignments', 'grades', 'studentTracking'];

export function useCourseRecords(schoolId, courses) {
  const ids = useMemo(() => [...new Set(courses.map(course => String(course.id)))].sort(), [courses]);
  const key = `${schoolId || ''}:${ids.join('|')}`;
  const [state, setState] = useState({ key: '', records: {}, error: null });

  useEffect(() => {
    if (!schoolId || ids.length === 0) return undefined;
    let active = true;
    const unsubscribers = ids.flatMap(id => KINDS.map(kind => onSnapshot(
      collection(db, 'schools', schoolId, 'classes', id, kind),
      snapshot => setState(previous => {
        if (!active) return previous;
        const records = previous.key === key ? previous.records : {};
        return { key, error: previous.key === key ? previous.error : null, records: { ...records, [id]: { ...records[id], [kind]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) } } };
      }),
      error => setState(previous => active ? { key, records: previous.key === key ? previous.records : {}, error } : previous)
    )));
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [schoolId, key, ids]);

  if (!schoolId || ids.length === 0) return { records: {}, loading: false, error: null };
  const records = state.key === key ? state.records : {};
  const loading = !state.error && ids.some(id => KINDS.some(kind => !Array.isArray(records[id]?.[kind])));
  return { records, loading, error: state.key === key ? state.error : null };
}
