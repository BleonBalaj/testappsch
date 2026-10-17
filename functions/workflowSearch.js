import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { fail, id, text, validDate } from './schoolWorkflowCore.js';
import { searchStudentDirectory } from './studentDirectorySearch.js';

const normalize = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const wire = value => value?.toMillis ? value.toMillis() : Array.isArray(value) ? value.map(wire) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, wire(item)])) : value;
const stamp = (doc, field) => {
  const value = doc.get(field);
  return { id: doc.id, value: value?.toMillis ? { seconds: value.seconds, nanoseconds: value.nanoseconds } : value };
};

// Full-scope matching happens BEFORE result pagination. Sparse text matches
// continue across bounded server scans; no unmatched/private rows reach clients.
export async function searchWorkflow(tx, school, data, actor, admin) {
  if(data.kind==='students'){if(data.module!=='students')fail('invalid');return searchStudentDirectory(tx,school,data);}
  const kinds = { requests: ['school-requests', 'schoolRequests', 'updatedAt', 'desc'], lessons: ['coverage', 'lessonCoverage', 'date', 'asc'], absences: ['coverage', 'teacherAbsences', 'from', 'desc'] };
  const config = kinds[data.kind];
  if (!config || data.module !== config[0]) fail('invalid');
  const [, path, field, direction] = config, f = data.filters || {};
  const search = normalize(text(f.search || '', 200)), terms = search.split(/\s+/).filter(Boolean);
  const status = f.status || (data.kind === 'requests' ? 'active' : 'all');
  const allowed = data.kind === 'requests' ? ['all','active','archived','needed','in_progress','partial','completed','cancelled'] : data.kind === 'lessons' ? ['all','needs_cover','assigned','covered','cancelled'] : ['all','active','cancelled'];
  if (!allowed.includes(status)) fail('invalid');
  let source = school.collection(path), primary;
  if (!admin) source = source.where(data.kind === 'absences' ? 'teacherUid' : 'participantUids', data.kind === 'absences' ? '==' : 'array-contains', actor.uid);
  if (data.kind === 'requests') {
    const type = f.type || 'all', classId = f.classId || 'all';
    if (!['all','supply','repair'].includes(type)) fail('invalid');
    if (classId !== 'all') primary = ['classGroupId', id(classId)];
    else if (type !== 'all') primary = ['type', type];
    else if (!['all','active','archived'].includes(status)) primary = ['status', status];
    else if (status !== 'all') primary = ['archived', status === 'archived'];
    if (primary) source = source.where(primary[0], '==', primary[1]);
  } else {
    validDate(f.from); validDate(f.to); if (f.from > f.to) fail('dateRange');
    const lower = data.kind === 'absences' ? new Date(Date.parse(`${f.from}T12:00Z`) - 31 * 86400000).toISOString().slice(0,10) : f.from;
    source = source.where(field, '>=', lower).where(field, '<=', f.to);
  }
  source = source.orderBy(field, direction).orderBy(FieldPath.documentId(), direction);
  let cursor = data.cursor || null;
  if (cursor) {
    id(cursor.id);
    if (field === 'updatedAt') {
      if (!Number.isSafeInteger(cursor.value?.seconds) || !Number.isSafeInteger(cursor.value?.nanoseconds) || cursor.value.nanoseconds < 0 || cursor.value.nanoseconds >= 1e9) fail('invalid');
    } else validDate(cursor.value);
  }
  const wanted = data.remaining ?? 41;
  if (!Number.isSafeInteger(wanted) || wanted < 1 || wanted > 41) fail('invalid');
  const results = [], cursors = []; let scanned = 0, more = true;
  while (scanned < 800 && results.length < wanted && more) {
    const after = cursor ? [field === 'updatedAt' ? new Timestamp(cursor.value.seconds, cursor.value.nanoseconds) : cursor.value, cursor.id] : null;
    const snapshot = await tx.get((after ? source.startAfter(...after) : source).limit(200));
    if (!snapshot.size) { more = false; break; }
    let consumed = 0;
    for (const doc of snapshot.docs) {
      const row = doc.data(); cursor = stamp(doc, field); scanned++; consumed++;
      const matches = data.kind === 'requests'
        ? ((f.type || 'all') === 'all' || row.type === f.type) && ((f.classId || 'all') === 'all' || row.classGroupId === f.classId)
          && (status === 'all' || (status === 'archived' ? row.archived : status === 'active' ? !row.archived && !['completed','cancelled'].includes(row.status) : !row.archived && row.status === status))
        : (status === 'all' || row.status === status) && (data.kind !== 'absences' || row.to >= f.from);
      const haystack = normalize([row.title,row.description,row.classLabel,row.room,row.assigneeName,row.createdByName,row.subject,row.teacherName,row.substituteName,...(row.items || []).map(item => item.name)].join(' '));
      if (matches && terms.every(term => haystack.includes(term))) { results.push({ ...wire(row), id: doc.id }); cursors.push(cursor); }
      if (results.length === wanted) break;
    }
    more = consumed < snapshot.size || snapshot.size === 200;
  }
  return { rows: results, cursors, cursor, more, scanned };
}
