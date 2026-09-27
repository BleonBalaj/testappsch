import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_WEIGHTS, getCategoryDisplayName, validateCategoryWeights, calcStudentGradeData } from './grading.js';

test('renamed defaults and custom categories retain stable category IDs', () => {
  const weights = { Homework: 20, Engagement: 15, Exam: 35, custom_lab: 30 };
  const labels = { Exam: 'Term assessment', custom_lab: 'Laboratory' };
  assert.equal(validateCategoryWeights(weights, labels, [{ category: 'Exam' }]), null);
  assert.equal(getCategoryDisplayName('Exam', false, labels), 'Term assessment');
  assert.equal(getCategoryDisplayName('custom_lab', false, labels), 'Laboratory');
  assert.match(validateCategoryWeights({ Homework: 20, Engagement: 15, custom_lab: 65 }, { custom_lab: 'Laboratory' }, [{ category: 'Exam' }]), /cannot be removed/);
  assert.match(validateCategoryWeights(weights, { Exam: 'Laboratory', custom_lab: 'Laboratory' }), /unique/);
});

test('grade calculation includes custom, homework, and engagement assignments', () => {
  const weights = { Homework: 20, Engagement: 15, custom_lab: 65 };
  const assignments = [
    { id: 'h', category: 'Homework', totalPoints: 10 },
    { id: 'e', category: 'Engagement', totalPoints: 10 },
    { id: 'l', category: 'custom_lab', totalPoints: 20 },
  ];
  const grades = { student1: { h: 8, e: 9, l: 10 } };
  const result = calcStudentGradeData('student1', assignments, grades, weights);
  assert.equal(result.catScores.Homework.pct, 80);
  assert.equal(result.catScores.Engagement.pct, 90);
  assert.equal(result.catScores.custom_lab.pct, 50);
  assert.equal(result.finalPct, 62);
  assert.equal(calcStudentGradeData('student1', [], {}, INITIAL_WEIGHTS).finalPct, null);
});
