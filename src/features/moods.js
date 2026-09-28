// Mood entries are keyed by the user's local calendar day (YYYY-MM-DD).

export const MOODS = Object.freeze(['happy', 'neutral', 'sad']);

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Noon on the entry's day, so formatting never slips to the previous date. */
export function moodEntryDate(key) {
  return new Date(`${key}T12:00:00`);
}

function shiftDays(key, days) {
  const date = moodEntryDate(key);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

/** Entries inside a range: '7days', '30days', 'alltime' or 'custom' (inclusive dates). */
export function entriesInRange(entries = [], range = '7days', { today = localDateKey(), start = '', end = '' } = {}) {
  const valid = entries.filter(entry => /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.date || '')) && MOODS.includes(entry.mood));
  let from = '';
  let to = '';
  if (range === '7days') { from = shiftDays(today, -6); to = today; }
  else if (range === '30days') { from = shiftDays(today, -29); to = today; }
  else if (range === 'custom') {
    from = start || '';
    to = end || '';
    if (from && to && from > to) [from, to] = [to, from];
  }
  return valid
    .filter(entry => (!from || entry.date >= from) && (!to || entry.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Counts per mood and the most frequent one; null when there is nothing logged, 'mixed' on a tie. */
export function summarizeMoods(entries = []) {
  const counts = Object.fromEntries(MOODS.map(mood => [mood, 0]));
  for (const entry of entries) if (MOODS.includes(entry.mood)) counts[entry.mood] += 1;
  const total = MOODS.reduce((sum, mood) => sum + counts[mood], 0);
  if (!total) return { counts, total, dominant: null, share: 0 };
  const top = Math.max(...MOODS.map(mood => counts[mood]));
  const leaders = MOODS.filter(mood => counts[mood] === top);
  return { counts, total, dominant: leaders.length === 1 ? leaders[0] : 'mixed', share: top / total };
}
