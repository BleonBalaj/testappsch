const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso, now = Date.now()) {
  const time = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(time)) return 'Never';
  const diff = Math.max(0, now - time);
  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  if (diff < 2 * DAY) return 'Yesterday';
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} days ago`;
  return formatDate(iso, now);
}

export function formatDate(iso, now = Date.now()) {
  const time = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(time)) return '—';
  const sameYear = new Date(time).getFullYear() === new Date(now).getFullYear();
  return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function formatDateTime(iso) {
  const time = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(time)) return '—';
  return new Date(time).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString() : '—';
}

export function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
}

export const ROLE_LABELS = Object.freeze({
  admin: 'Administrator', teacher: 'Teacher', dept_head: 'Head of Department',
  counselor: 'Counselor', support: 'Staff', student: 'Student',
});

export const roleLabel = role => ROLE_LABELS[role] || (typeof role === 'string' && role.startsWith('custom_') ? 'Custom role' : role || 'Member');
