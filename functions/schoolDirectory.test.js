import test from 'node:test';
import assert from 'node:assert/strict';
import { directoryPatch } from './schoolDirectory.js';
import { roleData } from './provisionSchoolUser.js';
import { studentSearchFields } from './studentSearch.js';

const courses = [
  { id: 'cls_math', name: 'Mathematics', code: 'MATH-1', enrolledStudentIds: ['s-legacy'] },
  { id: 'cls_art', name: 'Art', code: 'ART-2' },
];

test('older records gain search fields, a status, an empty class link and course IDs', () => {
  const patch = directoryPatch({ name: 'Ëlira Hoxha', email: 'elira@school.test', grade: '10A', assignedClasses: ['Mathematics (MATH-1)', 'ART-2', 'Removed course'] }, courses, 's1');
  assert.equal(patch.nameLower, 'elira hoxha');
  assert.ok(patch.searchTokens.includes('hox'));
  assert.equal(patch.status, 'active');
  assert.equal(patch.classGroupId, '');
  assert.equal('grade' in patch, false);
  assert.deepEqual(patch.assignedClasses, ['cls_math', 'cls_art', 'Removed course']);
});

test('very old records take their courses from the course-side student list', () => {
  const patch = directoryPatch({ name: 'Old', status: 'archived' }, courses, 's-legacy');
  assert.deepEqual(patch.assignedClasses, ['cls_math']);
  assert.equal('status' in patch, false);
  assert.deepEqual(directoryPatch({ name: 'Nobody', assignedClasses: 'Art' }, courses, 'x').assignedClasses, ['cls_art']);
});

test('current records need no write, so re-running the upgrade is free', () => {
  const current = roleData({ role: 'student', uid: 'uid-1', email: 'a@b.test', name: 'Ana', extra: { assignedClasses: ['cls_math'], classGroupId: 'g1', grade: '10A' } });
  assert.deepEqual(directoryPatch(current, courses, 'uid-1'), {});
  assert.deepEqual(directoryPatch({ ...current, grade: 7 }, courses, 'uid-1'), { grade: '7' });
});

test('new student records have no invented class and are searchable immediately', () => {
  const record = roleData({ role: 'student', uid: 'abcdefgh123', email: 'new@school.test', name: 'New Student', extra: {} });
  assert.equal(record.grade, '');
  assert.equal(record.classGroupId, '');
  assert.equal(record.status, 'active');
  assert.equal(record.studentId, 'STU-ABCDEFGH');
  assert.deepEqual({ nameLower: record.nameLower, searchTokens: record.searchTokens },
    studentSearchFields({ name: 'New Student', email: 'new@school.test', studentId: 'STU-ABCDEFGH' }));
  const withClass = roleData({ role: 'student', uid: 'u2', email: 'x@y.test', name: 'X', extra: { classGroupId: 'g10a', grade: '10A', unexpected: 'dropped' } });
  assert.equal(withClass.classGroupId, 'g10a');
  assert.equal(withClass.grade, '10A');
  assert.equal('unexpected' in withClass, false);
});
