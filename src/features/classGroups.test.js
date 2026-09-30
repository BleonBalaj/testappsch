import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classGroupLabel, cleanSection, classGroupsById, classGroupForItem, findClassGroupByLabel, gradeLevelName,
  hasValidClass, sortClassGroups, studentClassLabel, validateClassGroupDraft,
} from './classGroups.js';
import { parseClassLabel, stageForClass } from './lessonPlans/catalog.js';
import { explicitCourseAssignments, isEnrolledThroughClass, isStudentEnrolledInCourse } from './enrollment.js';

const groups = [
  { id: 'g10b', gradeLevel: 10, section: 'B', label: '10B' },
  { id: 'g10a', gradeLevel: 10, section: 'A', label: '10A' },
  { id: 'g2', gradeLevel: 2, section: '1', label: '2/1' },
  { id: 'gp', gradeLevel: 0, section: 'A', label: 'Përgatitore/A' },
];

test('labels read naturally and always parse back to the same grade and section', () => {
  assert.equal(classGroupLabel({ gradeLevel: 10, section: 'a' }), '10A');
  assert.equal(classGroupLabel({ gradeLevel: 10, section: ' 1 ' }), '10/1');
  assert.equal(classGroupLabel({ gradeLevel: 7, section: 'ab' }), '7/AB');
  assert.equal(classGroupLabel({ gradeLevel: 5, section: '' }), '5');
  assert.equal(classGroupLabel({ gradeLevel: 0, section: '' }), 'Përgatitore');
  assert.equal(classGroupLabel({ gradeLevel: 0, section: 'b' }), 'Përgatitore/B');
  assert.equal(classGroupLabel({ gradeLevel: 12, section: 'ë' }), '12/Ë');
  assert.equal(classGroupLabel({ gradeLevel: 13, section: 'A' }), '');
  assert.equal(classGroupLabel({ gradeLevel: -1, section: 'A' }), '');
  for (const [gradeLevel, section] of [[10, 'A'], [10, '1'], [7, 'AB'], [5, ''], [0, ''], [0, 'B'], [12, 'Ë']]) {
    const parsed = parseClassLabel(classGroupLabel({ gradeLevel, section }));
    assert.equal(parsed?.grade, gradeLevel, `${gradeLevel}${section}`);
    assert.equal(parsed?.section, cleanSection(section), `${gradeLevel}${section}`);
  }
  assert.equal(stageForClass('Përgatitore/A'), 'Shkalla I');
  assert.equal(stageForClass('10A'), 'Shkalla V');
});

test('sections keep letters and digits only, upper-cased', () => {
  assert.equal(cleanSection(' a-1 '), 'A1');
  assert.equal(cleanSection('ë'), 'Ë');
  assert.equal(cleanSection('<script>'), 'SCRIPT');
  assert.equal(cleanSection('ABCDEFGHIJKLMNOP').length, 10);
});

test('classes sort by grade then section, numbers in natural order', () => {
  const sorted = sortClassGroups([...groups, { id: 'g10_10', gradeLevel: 10, section: '10' }, { id: 'g10_2', gradeLevel: 10, section: '2' }]);
  assert.deepEqual(sorted.map(group => group.id), ['gp', 'g2', 'g10_2', 'g10_10', 'g10a', 'g10b']);
});

test('older free-text labels find the matching class in any common notation', () => {
  assert.equal(findClassGroupByLabel(groups, '10A')?.id, 'g10a');
  assert.equal(findClassGroupByLabel(groups, 'X/a')?.id, 'g10a');
  assert.equal(findClassGroupByLabel(groups, 'Klasa 10-b')?.id, 'g10b');
  assert.equal(findClassGroupByLabel(groups, 'II/1')?.id, 'g2');
  assert.equal(findClassGroupByLabel(groups, 'përgatitore a')?.id, 'gp');
  assert.equal(findClassGroupByLabel(groups, '10C'), null);
  assert.equal(findClassGroupByLabel(groups, ''), null);
  assert.equal(findClassGroupByLabel(groups, 'Science club'), null);
});

test('drafts need a grade and homeroom teacher and must not duplicate a class', () => {
  const draft = { gradeLevel: 10, section: 'c', homeroomTeacherId: 't1' };
  assert.equal(validateClassGroupDraft(draft, groups), '');
  assert.equal(validateClassGroupDraft({ ...draft, section: 'a' }, groups), 'duplicate');
  assert.equal(validateClassGroupDraft({ ...draft, section: 'A' }, groups, 'g10a'), '');
  assert.equal(validateClassGroupDraft({ ...draft, gradeLevel: '' }, groups), 'grade');
  assert.equal(validateClassGroupDraft({ ...draft, gradeLevel: 14 }, groups), 'grade');
  assert.equal(validateClassGroupDraft({ ...draft, section: '---' }, groups), 'section');
  assert.equal(validateClassGroupDraft({ ...draft, homeroomTeacherId: '' }, groups), 'teacher');
  assert.equal(validateClassGroupDraft({ gradeLevel: 0, section: '', homeroomTeacherId: 't' }, groups), '');
});

test('student class labels prefer the linked class and fall back to older text', () => {
  const byId = classGroupsById(groups);
  assert.equal(studentClassLabel({ classGroupId: 'g10a', grade: '9B' }, byId), '10A');
  assert.equal(studentClassLabel({ classGroupId: 'deleted', grade: '9B' }, byId), '9B');
  assert.equal(studentClassLabel({ grade: '' }, byId), '');
  assert.equal(studentClassLabel({}, byId), '');
  assert.equal(hasValidClass({ classGroupId: 'g10a' }, byId), true);
  assert.equal(hasValidClass({ classGroupId: 'deleted' }, byId), false);
  assert.equal(gradeLevelName(0, true), 'Përgatitore');
  assert.equal(gradeLevelName(10, false), 'Grade 10');
});

test('schedule items resolve their class by link first, then by label', () => {
  assert.equal(classGroupForItem({ classGroupId: 'g10b', classLabel: '10A' }, groups)?.id, 'g10b');
  assert.equal(classGroupForItem({ classGroupId: 'gone', classLabel: 'X/A' }, groups)?.id, 'g10a');
  assert.equal(classGroupForItem({ classLabel: '' }, groups), null);
});

test('courses linked to a class include its students; stored assignments skip them', () => {
  const linked = { id: 'math10a', classGroupId: 'g10a' };
  const open = { id: 'robotics' };
  const other = { id: 'math10b', classGroupId: 'g10b' };
  const student = { id: 's1', classGroupId: 'g10a', assignedClasses: ['robotics'] };
  assert.equal(isEnrolledThroughClass(student, linked), true);
  assert.equal(isStudentEnrolledInCourse(student, linked), true);
  assert.equal(isStudentEnrolledInCourse(student, open), true);
  assert.equal(isStudentEnrolledInCourse(student, other), false);
  assert.equal(isStudentEnrolledInCourse({ id: 's2', assignedClasses: [] }, linked), false);
  const courses = [linked, open, other];
  assert.deepEqual(explicitCourseAssignments(['math10a', 'robotics', 'math10b'], courses, 'g10a'), ['robotics', 'math10b']);
  // Moving from 10A to 10B drops 10A's courses and 10B's become automatic.
  assert.deepEqual(explicitCourseAssignments(['math10a', 'robotics', 'math10b'], courses, 'g10b', 'g10a'), ['robotics']);
  assert.deepEqual(explicitCourseAssignments(['math10a', 'robotics'], courses, '', 'g10a'), ['robotics']);
});
