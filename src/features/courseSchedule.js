import { courseMatchesReference } from './enrollment.js';

export const SCHEDULE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DAY_NAMES = [
  ['Monday', /\b(?:monday|mon|e hene|hene)\b/gi],
  ['Tuesday', /\b(?:tuesday|tue|tues|e marte|marte)\b/gi],
  ['Wednesday', /\b(?:wednesday|wed|e merkure|merkure)\b/gi],
  ['Thursday', /\b(?:thursday|thu|thur|thurs|e enjte|enjte)\b/gi],
  ['Friday', /\b(?:friday|fri|e premte|premte)\b/gi],
];
const CLOCK = String.raw`(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*[ap]m)?|(?:1[0-2]|0?[1-9])\s*[ap]m`;
const TIME = new RegExp(`(?:${CLOCK})(?:\\s*(?:-|–|—|to)\\s*(?:${CLOCK}))?`, 'gi');

// Legacy courses stored a human-readable string. Parse only explicit weekdays
// and clock times; an ambiguous string must never create a guessed timetable.
export function parseWeeklySchedule(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\bmon(?:day)?\s*-\s*fri(?:day)?\b/gi, 'Monday Tuesday Wednesday Thursday Friday');
  const result = [];
  for (const segment of normalized.split(/[;\n]+/)) {
    const days = DAY_NAMES.flatMap(([day, pattern]) => [...segment.matchAll(pattern)].map(match => ({ day, index: match.index })));
    const times = [...segment.matchAll(TIME)].map(match => ({ time: match[0].trim().replace(/\s+/g, ' ').toUpperCase(), index: match.index }));
    days.sort((a, b) => a.index - b.index);
    if (!days.length || !times.length) continue;
    if (times.length !== 1 && times.length !== days.length) continue;
    days.forEach((entry, index) => result.push({ day: entry.day, time: times.length === 1 ? times[0].time : times[index].time }));
  }
  return [...new Map(result.map(entry => [`${entry.day}:${entry.time}`, entry])).values()];
}

export function weeklyScheduleForCourse(course) {
  if (Array.isArray(course.weeklySchedule)) {
    return course.weeklySchedule.filter(entry => SCHEDULE_DAYS.includes(entry.day) && typeof entry.time === 'string' && entry.time.trim())
      .map(entry => ({ day: entry.day, time: entry.time.trim() }));
  }
  return parseWeeklySchedule(course.schedule);
}

export function scheduleStartMinutes(value) {
  const match = String(value || '').match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\b/i);
  if (!match || (!match[2] && !match[3])) return Number.POSITIVE_INFINITY;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour > 23 || minute > 59 || (match[3] && (hour < 1 || hour > 12))) return Number.POSITIVE_INFINITY;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + minute;
}

export function mergeCourseSchedule(courses = [], savedEntries = []) {
  const grouped = Object.fromEntries(SCHEDULE_DAYS.map(day => [day, []]));
  for (const entry of savedEntries) {
    if (grouped[entry.day]) grouped[entry.day].push(entry);
  }
  for (const course of courses) {
    for (const [index, slot] of weeklyScheduleForCourse(course).entries()) {
      const duplicate = grouped[slot.day].some(entry =>
        !entry.isEvent && entry.time?.trim().toLowerCase() === slot.time.toLowerCase() &&
        (String(entry.courseId || '') === String(course.id) || courseMatchesReference(course, entry.subject))
      );
      if (duplicate) continue;
      grouped[slot.day].push({
        id: `course:${course.id}:${slot.day}:${index}`,
        source: 'course',
        courseId: String(course.id),
        day: slot.day,
        time: slot.time,
        subject: course.name || course.code || '',
        subjectCategory: course.department || '',
        room: course.room || '',
        teacher: course.teacher || '',
        teacherId: course.teacherId || '',
        teacherEmail: course.teacherEmail || '',
        createdByUid: course.createdByUid || '',
        classGroupId: course.classGroupId || '',
        classLabel: course.classLabel || '',
        curriculumSubject: course.curriculumSubject || '',
        period: course.period || '',
        color: course.color || '--primary',
        isEvent: false,
      });
    }
  }
  for (const day of SCHEDULE_DAYS) grouped[day].sort((a, b) => scheduleStartMinutes(a.time) - scheduleStartMinutes(b.time) || String(a.subject || '').localeCompare(String(b.subject || '')));
  return grouped;
}
