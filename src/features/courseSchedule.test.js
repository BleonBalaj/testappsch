import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeeklySchedule, mergeCourseSchedule, scheduleStartMinutes } from './courseSchedule.js';

test('parses recurring legacy course schedules without inventing periods', () => {
  assert.deepEqual(parseWeeklySchedule('Mon, Wed 10:00 AM'), [
    { day: 'Monday', time: '10:00 AM' }, { day: 'Wednesday', time: '10:00 AM' },
  ]);
  assert.deepEqual(parseWeeklySchedule('Tue 09:30 - 10:15; Thu 11:00 - 11:45'), [
    { day: 'Tuesday', time: '09:30 - 10:15' }, { day: 'Thursday', time: '11:00 - 11:45' },
  ]);
  assert.deepEqual(parseWeeklySchedule('E Hënë, E Mërkurë 09:00'), [
    { day: 'Monday', time: '09:00' }, { day: 'Wednesday', time: '09:00' },
  ]);
  assert.equal(parseWeeklySchedule('Flexible / Room 301').length, 0);
});

test('merges course timetable with manually saved slots and avoids matching duplicates', () => {
  const course = { id: 'math-1', name: 'Mathematics', code: 'M1', schedule: 'Mon, Wed 10:00 AM', teacherId: 'teacher-1' };
  const grouped = mergeCourseSchedule([course], [{ id: 'manual-1', day: 'Monday', time: '10:00 AM', courseId: 'math-1', subject: 'Mathematics' }]);
  assert.equal(grouped.Monday.length, 1);
  assert.equal(grouped.Wednesday.length, 1);
  assert.equal(grouped.Wednesday[0].courseId, 'math-1');
  assert.equal(grouped.Wednesday[0].teacherId, 'teacher-1');
});

test('structured schedule replaces old text and updates immediately after course edit', () => {
  const course = { id: 'science', name: 'Science', schedule: 'Mon 09:00', weeklySchedule: [{ day: 'Friday', time: '13:00' }] };
  const grouped = mergeCourseSchedule([course]);
  assert.equal(grouped.Monday.length, 0);
  assert.equal(grouped.Friday[0].time, '13:00');
});

test('sorts both 12-hour and 24-hour schedule times chronologically', () => {
  assert.equal(scheduleStartMinutes('09:30 - 10:15'), 570);
  assert.equal(scheduleStartMinutes('2:00 PM - 3:00 PM'), 840);
  assert.equal(scheduleStartMinutes('12:00 AM'), 0);
  const grouped = mergeCourseSchedule([], [
    { id: 'late', day: 'Monday', time: '2:00 PM', subject: 'Late' },
    { id: 'early', day: 'Monday', time: '09:30', subject: 'Early' },
  ]);
  assert.deepEqual(grouped.Monday.map(entry => entry.id), ['early', 'late']);
});
