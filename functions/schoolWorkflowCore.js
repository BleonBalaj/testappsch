export class WorkflowError extends Error {
  constructor(key) { super(key); this.key = key; }
}
export const fail = key => { throw new WorkflowError(key); };
export function text(value, max = 200, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('invalid');
  return value.trim();
}
export function id(value) {
  const result = text(value, 160, true);
  if (result.includes('/') || result === '.' || result === '..') fail('invalid');
  return result;
}
export function validDate(value) {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail('date');
  return value;
}
export function datesBetween(from, to) {
  validDate(from); validDate(to);
  const days = (Date.parse(`${to}T12:00Z`) - Date.parse(`${from}T12:00Z`)) / 86400000;
  if (days < 0 || days > 30) fail('dateRange');
  return Array.from({ length: days + 1 }, (_, i) => new Date(Date.parse(`${from}T12:00Z`) + i * 86400000).toISOString().slice(0, 10));
}
export function clock(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let h = Number(match[1]); const m = Number(match[2]);
  if (m > 59 || h > 23 || (match[3] && (h < 1 || h > 12))) return null;
  if (match[3]) h = h % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return h * 60 + m;
}
export function interval(value) {
  const parts = String(value || '').split(/\s*(?:-|–|—|\bto\b)\s*/i);
  const start = clock(parts[0]), end = parts.length === 2 ? clock(parts[1]) : null;
  return { start, end: start !== null && end !== null && end > start ? end : null };
}
export const overlaps = (a, b) => a.start < b.end && b.start < a.end;
export function explicitInterval(startTime, endTime) {
  const start = clock(startTime), end = clock(endTime);
  if (start === null || end === null || end <= start) fail('times');
  return { start, end };
}
export function requestFields(input, previous) {
  const type = previous?.type || input.type;
  if (!['supply', 'repair'].includes(type)) fail('invalid');
  const priority = input.priority || 'normal';
  if (!['low', 'normal', 'urgent'].includes(priority)) fail('invalid');
  const items = type === 'supply' ? input.items : [];
  if (!Array.isArray(items) || (type === 'supply' && (!items.length || items.length > 25))) fail('items');
  const seen = new Set();
  const normalized = items.map(item => {
    const key = id(item.id);
    if (seen.has(key)) fail('items'); seen.add(key);
    const needed = Number(item.needed), provided = Number(item.provided || 0);
    if (!Number.isSafeInteger(needed) || needed < 1 || needed > 100000 || !Number.isSafeInteger(provided) || provided < 0 || provided > needed) fail('quantities');
    return { id: key, name: text(item.name, 160, true), needed, provided };
  });
  const wanted = input.status || previous?.status || 'needed';
  const resolution = text(input.resolution || '', 3000);
  let status;
  if (wanted === 'cancelled') status = wanted;
  else if (type === 'supply') {
    if (normalized.every(item => item.provided === item.needed)) status = 'completed';
    else if (normalized.some(item => item.provided > 0)) status = 'partial';
    else status = wanted === 'in_progress' ? 'in_progress' : 'needed';
    if (wanted === 'completed' && status !== 'completed') fail('notFulfilled');
  } else {
    if (!['needed', 'in_progress', 'completed'].includes(wanted)) fail('invalid');
    if (wanted === 'completed' && !resolution) fail('resolution');
    status = wanted;
  }
  return { type, title: text(input.title, 180, true), description: text(input.description || '', 4000),
    classGroupId: input.classGroupId ? id(input.classGroupId) : '', room: text(input.room || '', 100),
    priority, neededBy: input.neededBy ? validDate(input.neededBy) : '', assigneeUid: input.assigneeUid ? id(input.assigneeUid) : '',
    items: normalized, status, resolution };
}
export function matchesTeacher(item, teacher, courses = []) {
  const course = courses.find(course => String(course.id) === String(item.courseId));
  const source = course && !item.teacherId ? { ...course, ...item, teacherId: course.teacherId, teacherEmail: course.teacherEmail } : item;
  return [teacher.id, teacher.uid, teacher.staffId].filter(Boolean).includes(source.teacherId)
    || Boolean(teacher.email && source.teacherEmail && teacher.email.toLowerCase() === source.teacherEmail.toLowerCase());
}
export function absenceCovers(absence, date, slot) {
  return absence.status === 'active' && absence.from <= date && absence.to >= date
    && (!absence.startTime || slot.start === null || slot.end === null || overlaps(explicitInterval(absence.startTime, absence.endTime), slot));
}
export function assertCoverAvailable({ substituteUid, teacherUid, date, slot, absences, covers, ownLessons, ignoreId }) {
  if (substituteUid === teacherUid) fail('sameTeacher');
  if (absences.some(absence => absence.teacherUid === substituteUid && absenceCovers(absence, date, slot))) fail('substituteAbsent');
  if (covers.some(cover => cover.id !== ignoreId && cover.date === date && cover.substituteUid === substituteUid
    && ['assigned', 'covered'].includes(cover.status) && overlaps(slot, explicitInterval(cover.startTime, cover.endTime)))) fail('coverConflict');
  for (const lesson of ownLessons) {
    const time = interval(lesson.time);
    const absent = absences.some(absence => absence.teacherUid === substituteUid && absenceCovers(absence, date, time));
    if (absent) continue;
    if (time.start === null || time.end === null) fail('ambiguousSchedule');
    if (overlaps(slot, time)) fail('timetableConflict');
  }
}
