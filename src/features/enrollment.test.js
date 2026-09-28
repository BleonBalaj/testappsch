import test from 'node:test';
import assert from 'node:assert/strict';
import { courseMatchesReference, enrolledCoursesForStudent, isStudentEnrolledInCourse, normalizeAssignedCourseIds } from './enrollment.js';

const math = { id: 'cls_math_1', name: 'Mathematics', code: 'MATH-2', enrolledStudentIds: [] };
const history = { id: 'cls_history_1', name: 'History', code: 'HIST-2', enrolledStudentIds: ['student-1'] };

test('recognizes stored IDs, names, codes, and old name plus code labels', () => {
  for (const reference of ['cls_math_1', 'Mathematics', 'MATH-2', 'Mathematics (MATH-2)', 'Old title (MATH-2)']) {
    assert.equal(courseMatchesReference(math, reference), true, reference);
  }
  assert.equal(courseMatchesReference(math, 'Math'), false);
  assert.equal(courseMatchesReference(math, 'MATH-20'), false);
  assert.equal(courseMatchesReference(math, { id: 'old-id', code: 'MATH-2' }), true);
});

test('resolves student and class-side enrollment without relying on display flags', () => {
  const student = { id: 'student-1', assignedClasses: ['Mathematics (MATH-2)'] };
  assert.deepEqual(enrolledCoursesForStudent(student, [math, history]).map(course => course.id), [math.id]);
  assert.equal(isStudentEnrolledInCourse({ id: 'student-1' }, history), true);
  assert.equal(isStudentEnrolledInCourse({ id: 'student-1', assignedClasses: [] }, history), false);
  assert.equal(isStudentEnrolledInCourse({ id: 'student-1', assignedClasses: 'Mathematics (MATH-2)' }, math), true);
  assert.equal(isStudentEnrolledInCourse({ id: 'student-2', assignedClasses: [] }, { ...math, enrolled: true }), false);
});

test('new edits migrate recognized legacy labels to stable IDs without duplicates', () => {
  assert.deepEqual(normalizeAssignedCourseIds(['Mathematics (MATH-2)', 'cls_math_1', 'Unknown elective'], [math]), ['cls_math_1', 'Unknown elective']);
});
