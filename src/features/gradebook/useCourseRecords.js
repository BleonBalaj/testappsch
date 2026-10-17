import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {verifiedSnapshot} from '../liveResource';

const KINDS = ['assignments', 'grades', 'studentTracking'];

const recordsCache = new Map();

export function useCourseRecords(schoolId, courses) {
  const ids = useMemo(() => [...new Set(courses.map(course => String(course.id)))].sort(), [courses]);
  const key = `${schoolId || ''}:${ids.join('|')}`;
  const [state, setState] = useState(() => recordsCache.get(key) || { key: '', records: {}, errors: {} });

  useEffect(() => {
    if (!schoolId || ids.length === 0) return undefined;
    let active = true;
    const unsubscribers = ids.flatMap(id => KINDS.map(kind => onSnapshot(
      collection(db, 'schools', schoolId, 'classes', id, kind),
      {includeMetadataChanges:true},
      snapshot => {
        if (!active||!verifiedSnapshot(snapshot)) return;
        setState(previous => {
          const currentKey = previous.key === key ? previous : (recordsCache.get(key) || { key, records: {}, errors: {} });
          const records = currentKey.key === key ? currentKey.records : {};
          const nextState = {
            key,
            errors: { ...(currentKey.key === key ? currentKey.errors : {}), [id + ':' + kind]: null },
            records: { ...records, [id]: { ...records[id], [kind]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) } },
          };
          recordsCache.set(key, nextState);
          return nextState;
        });
      },
      error => {
        if (!active) return;
        setState(previous => {
          const currentKey = previous.key === key ? previous : (recordsCache.get(key) || { key, records: {}, errors: {} });
          const nextState = {
            key,
            records: { ...(currentKey.key === key ? currentKey.records : {}), [id]: { ...(currentKey.key === key ? currentKey.records[id] : {}), [kind]: null } },
            errors: { ...(currentKey.key === key ? currentKey.errors : {}), [id + ':' + kind]: error },
          };
          recordsCache.set(key, nextState);
          return nextState;
        });
      }
    )));
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [schoolId, key, ids]);

  if (!schoolId || ids.length === 0) return { records: {}, loading: false, error: null };
  const records = state.key === key ? state.records : (recordsCache.get(key)?.records || {});
  const error=state.key===key?Object.values(state.errors).find(Boolean)||null:null;
  const loading = !error && ids.some(id => KINDS.some(kind => !Array.isArray(records[id]?.[kind])));
  return { records, loading, error };
}
