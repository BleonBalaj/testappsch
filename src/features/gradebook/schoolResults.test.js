import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchoolRankings, courseResult } from './schoolResults.js';

const courses = [
  { id: 'math', name: 'Mathematics', code: 'M1', weights: { Homework: 100, Engagement: 0 } },
  { id: 'science', name: 'Science', code: 'S1', weights: { Homework: 100, Engagement: 0 } },
];
const students = [
  { id: 'a', name: 'Ada', grade: 'II-2', assignedClasses: ['math', 'science'] },
  { id: 'b', name: 'Ben', grade: 'II-2', assignedClasses: ['math'] },
  { id: 'c', name: 'Cora', grade: 'III-1', assignedClasses: ['science'] },
  { id: 'd', name: 'Deni', grade: 'III-1', assignedClasses: [] },
];
const records = {
  math: {
    assignments: [{ id: 'hw', category: 'Homework', totalPoints: 20 }],
    grades: [{ id: 'hw', scores: { a: 18, b: 20, c: 20 } }],
    studentTracking: [],
  },
  science: {
    assignments: [{ id: 'hw', category: 'Homework', totalPoints: 10 }],
    grades: [{ id: 'hw', scores: { a: 8, c: 10 } }],
    studentTracking: [],
  },
};

test('ranks by real course grade average, with enrollment and no stored point fallback', () => {
  const ranked = buildSchoolRankings(students.map(student => ({ ...student, points: 9999 })), courses, records);
  assert.deepEqual(ranked.map(row => [row.name, row.average, row.gradedCourses, row.rank]), [
    ['Ben', 100, 1, 1], ['Cora', 100, 1, 1], ['Ada', 85, 2, 3],
  ]);
});

test('course and cohort filters use actual records and never fall back to overall', () => {
  assert.deepEqual(buildSchoolRankings(students, courses, records, 'course:math').map(row => row.name), ['Ben', 'Ada']);
  assert.deepEqual(buildSchoolRankings(students, courses, records, 'cohort:III-1').map(row => row.name), ['Cora']);
  assert.deepEqual(buildSchoolRankings(students, courses, records, 'course:missing'), []);
});

test('ungraded course has no rank; zero score is a real grade; override is respected', () => {
  const record = { assignments: records.math.assignments, grades: [{ id: 'hw', scores: { a: 0 } }], studentTracking: [] };
  assert.equal(courseResult('a', courses[0], record), 0);
  assert.equal(courseResult('b', courses[0], record), null);
  assert.equal(courseResult('a', courses[0], { ...record, studentTracking: [{ id: 'a', manualOverridePct: 75 }] }), 75);
});

test('archived students and grades from non-enrolled courses are excluded', () => {
  const ranked = buildSchoolRankings([{ ...students[0], status: 'archived' }, students[3]], courses, records);
  assert.deepEqual(ranked, []);
});
