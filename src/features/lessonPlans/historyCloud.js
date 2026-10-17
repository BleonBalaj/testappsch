import { collection, endAt, getDocsFromServer, limit, onSnapshot, orderBy, query, startAfter } from 'firebase/firestore';
import { createHistoryReader } from './historyReader.js';

export function createCloudHistoryReader(db, schoolId, planId, onChange) {
  const source = query(collection(db, 'schools', schoolId, 'lessonPlanReviewHistory', String(planId), 'events'), orderBy('at', 'desc'));
  return createHistoryReader({
    read: async ({ after, limit: size }) => (await getDocsFromServer(query(source, ...(after ? [startAfter(after)] : []), limit(size)))).docs,
    listen: (anchor, next, error) => onSnapshot(anchor ? query(source, endAt(anchor)) : query(source,limit(101)), { includeMetadataChanges: true }, snapshot => next({docs:snapshot.docs,cached:snapshot.metadata.fromCache,pending:snapshot.metadata.hasPendingWrites}), error),
  }, onChange);
}
