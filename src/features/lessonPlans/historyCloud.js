import { collection, endAt, getDocs, limit, onSnapshot, orderBy, query, startAfter } from 'firebase/firestore';
import { createHistoryReader } from './historyReader.js';

export function createCloudHistoryReader(db, schoolId, planId, onChange) {
  const source = query(collection(db, 'schools', schoolId, 'lessonPlanReviewHistory', String(planId), 'events'), orderBy('at', 'desc'));
  return createHistoryReader({
    read: async ({ after, limit: size }) => (await getDocs(query(source, ...(after ? [startAfter(after)] : []), limit(size)))).docs,
    listen: (anchor, next, error) => onSnapshot(anchor ? query(source, endAt(anchor)) : source, { includeMetadataChanges: true }, snapshot => {
      if (!snapshot.metadata.hasPendingWrites) next(snapshot.docs);
    }, error),
  }, onChange);
}
