import { changedPlanFields } from './sharing.js';

export const HISTORY_SESSION_MS = 30 * 60 * 1000;
const millis = value => value?.toMillis?.() ?? new Date(value || 0).getTime();
const sameSession = (newest, older, windowMs) => newest.action === 'update' && older?.action === 'update' &&
  newest.actorUid === older.actorUid && newest.shareToken === older.shareToken &&
  Number.isFinite(millis(newest.at)) && Number.isFinite(millis(older.at)) &&
  millis(newest.at) - millis(older.at) >= 0 && millis(newest.at) - millis(older.at) <= windowMs;

// Group the display, never rewrite the append-only audit records. Fixed windows
// are anchored at the newest edit, so a continuous day cannot become one session.
export function groupHistoryEvents(rows, { count = rows.length, windowMs = HISTORY_SESSION_MS } = {}) {
  const groups = [];
  rows.slice(0, count).forEach((entry, index) => {
    const previous = groups.at(-1);
    if (previous && sameSession(previous.latest, entry, windowMs)) {
      previous.events.push(entry); previous.oldestIndex = index;
    } else groups.push({ key: entry.eventId, latest: entry, events: [entry], oldestIndex: index });
  });
  return groups.map(group => {
    const oldest = group.events.at(-1);
    const prior = rows.slice(group.oldestIndex + 1).find(entry => entry.action !== 'auto_reopen');
    const fields = new Map();
    let previous = prior?.plan;
    for (const event of [...group.events].reverse()) {
      for (const field of changedPlanFields(previous, event.plan)) {
        const change = fields.get(field) || { field, before: previous[field], steps: [] };
        change.after = event.plan[field];
        change.steps.push({ event, before: previous[field], after: event.plan[field] });
        fields.set(field, change);
      }
      previous = event.plan;
    }
    return { ...group, oldest, prior, changes: [...fields.values()],
      partial: group.oldestIndex === count - 1 && sameSession(group.latest, rows[count], windowMs) };
  });
}
