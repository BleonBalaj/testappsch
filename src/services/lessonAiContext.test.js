import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLessonAiRequestContext, GENERATED_LESSON_FIELDS } from './lessonAiContext.js';

test('sends every preset lesson field while parsing grade and parallel separately', () => {
  const plan = {
    classLabel: 'II-4', grade: 4, section: '8', subject: 'Matematikë',
    lessonUnit: 'Bashkësitë dhe elementet e bashkësive', period: '7',
    teacherName: 'Arta', schoolName: 'Noesis Horizon', reflection: 'Existing teacher note',
    ...Object.fromEntries(GENERATED_LESSON_FIELDS.map((field) => [field, ['competencyOutcomes', 'fieldOutcomes', 'lessonOutcomes', 'successCriteria'].includes(field) ? [`Preset ${field}`] : `Preset ${field}`])),
  };
  const context = buildLessonAiRequestContext(plan, 'sq');
  assert.equal(context.grade, 2);
  assert.equal(context.section, '4');
  assert.equal(context.period, '7');
  assert.equal(context.language, 'sq');
  assert.equal(context.reflection, plan.reflection);
  for (const field of GENERATED_LESSON_FIELDS) assert.deepEqual(context[field], plan[field]);
});
