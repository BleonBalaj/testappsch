import { dateInTimeZone, getDateRange } from './plan.js';
import { normalizePlanSearch } from './sharing.js';
import { shareText } from './sharingI18n.js';
import { translate } from './i18n.js';

export const HISTORY_FILTER_DEFAULTS = { search: '', actor: 'all', action: 'all', status: 'all', date: 'all', from: '', to: '' };
export const HISTORY_ACTIONS = ['share', 'reshare', 'update', 'unshare', 'review', 'auto_reopen'];
export const HISTORY_DATES = ['all', 'today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'last7Days', 'custom'];

export const hasHistoryFilters = filters => Boolean(filters.search.trim() || ['actor', 'action', 'status', 'date'].some(key => filters[key] !== 'all'));

const textValue = value => typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
function eventSearchText(event, group, language) {
  const plan = event.plan || {};
  const fields = group.changes.flatMap(change => change.steps.filter(step => step.event.eventId === event.eventId).map(step => [
    change.field, translate(language, `editor.${change.field}`), textValue(step.before), textValue(step.after),
  ].join(' ')));
  return normalizePlanSearch([
    event.actorName, event.actorEmail, event.actorUid === 'system' ? shareText(language, 'system') : '',
    shareText(language, `action_${event.action}`), shareText(language, event.reviewStatus),
    plan.lessonUnit, plan.subject, plan.topic, plan.classLabel, ...fields,
  ].join(' '));
}

// Group first, filter second: keep lifecycle boundaries, intermediate changes,
// and the real before/after baseline. All criteria must match the same event;
// if one event matches, its entire editing session remains visible.
export function filterHistoryGroups(groups, filters, { language = 'en', now = new Date(), timeZone = 'Europe/Belgrade' } = {}) {
  const terms = normalizePlanSearch(filters.search).split(/\s+/).filter(Boolean);
  const range = filters.date === 'all' ? null : filters.date === 'custom'
    ? { startDate: filters.from || '0000-01-01', endDate: filters.to || '9999-12-31' }
    : getDateRange(filters.date, { now, timeZone });
  return groups.filter(group => group.events.some(event => {
    if (filters.actor !== 'all' && event.actorUid !== filters.actor) return false;
    if (filters.action !== 'all' && event.action !== filters.action) return false;
    if (filters.status !== 'all' && event.reviewStatus !== filters.status) return false;
    if (range) {
      const stamp = event.at?.toDate?.() || new Date(event.at || 0);
      if (Number.isNaN(stamp.getTime())) return false;
      const date = dateInTimeZone(stamp, timeZone);
      if (date < range.startDate || date > range.endDate) return false;
    }
    if (!terms.length) return true;
    const haystack = eventSearchText(event, group, language);
    return terms.every(term => haystack.includes(term));
  }));
}
