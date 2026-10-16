import { dateInTimeZone, getDateRange } from './plan.js';

export const REVIEW_STATUSES = ['pending', 'reviewing', 'archived'];
export const normalizePlanSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();

export function inboxRecord(plan, share) {
  return {
    planId: String(plan.id), ownerUid: share.ownerUid, ownerName: share.ownerName, ownerEmail: share.ownerEmail,
    lessonUnit: plan.lessonUnit || '', subject: plan.subject || '', topic: plan.topic || '',
    classLabel: plan.classLabel || '', lessonDate: plan.date || '', planUpdatedAt: plan.updatedAt || '',
    sharedAt: share.sharedAt, shareToken: share.shareToken, revisionId: share.revisionId,
    reviewStatus: 'pending', reviewedByUid: '', reviewedAt: null,
    lastEventId: share.revisionId,
    shareCycle: share.shareCycle,
  };
}

export function filterSharedPlans(records, { search = '', ownerUid = 'all', subject = 'all', date = 'all', dateBasis = 'lesson', from = '', to = '', now = new Date() } = {}) {
  const needle = normalizePlanSearch(search);
  const range = date === 'all' ? null : date === 'custom'
    ? { startDate: from || '0000-01-01', endDate: to || '9999-12-31' }
    : getDateRange(date, { now });
  return records.filter(record => {
    if (ownerUid !== 'all' && record.ownerUid !== ownerUid) return false;
    if (subject !== 'all' && record.subject !== subject) return false;
    if (needle && !normalizePlanSearch([record.ownerName, record.ownerEmail, record.lessonUnit, record.subject, record.topic, record.classLabel].join(' ')).includes(needle)) return false;
    const stamp = record.sharedAt?.toDate?.() || (record.sharedAt ? new Date(record.sharedAt) : null);
    const day = dateBasis === 'shared' ? (stamp && !Number.isNaN(stamp.getTime()) ? dateInTimeZone(stamp) : '') : record.lessonDate;
    return !range || (day && day >= range.startDate && day <= range.endDate);
  }).sort((a, b) => (b.sharedAt?.toMillis?.() || new Date(b.sharedAt || 0).getTime() || 0) - (a.sharedAt?.toMillis?.() || new Date(a.sharedAt || 0).getTime() || 0));
}

export const historyTime = (stamp, language) => {
  const value = stamp?.toDate?.() || new Date(stamp || 0);
  return Number.isNaN(value.getTime()) ? '' : new Intl.DateTimeFormat(language === 'sq' ? 'sq-AL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
};
const skipChanges = new Set(['id', 'ownerUid', 'teacherId', 'createdAt', 'updatedAt', 'schoolLogo']);
export function changedPlanFields(previous, next) {
  if (!previous || !next) return [];
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .filter(key => !skipChanges.has(key) && JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
}
