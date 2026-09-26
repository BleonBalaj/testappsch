import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseClassLabel, stageForClass, getSubjectArea, listSubjects,
  createPlan, changePlanSubject, changePlanClass, setPlanField, resetDerivedField,
  applyTopic, duplicatePlan, getDateRange, createLessonPlanRepository,
} from './index.js';

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
};
const now = '2026-09-26T12:00:00Z';

test('class labels separate grade and section and general stage mapping is correct', () => {
  assert.deepEqual(parseClassLabel('Klasa VI/2'), { grade: 6, gradeLabel: 'VI', section: '2', classLabel: 'VI/2' });
  assert.equal(parseClassLabel('10A').grade, 10);
  assert.equal(parseClassLabel('VII-1').section, '1');
  assert.equal(parseClassLabel('Përgatitore').grade, 0);
  assert.equal(parseClassLabel('XIII/2'), null);
  assert.equal(stageForClass('Përgatitore'), 'Shkalla I');
  assert.equal(stageForClass('II/1'), 'Shkalla I');
  assert.equal(stageForClass('V/1'), 'Shkalla II');
  assert.equal(stageForClass('VI/2'), 'Shkalla III');
  assert.equal(stageForClass('IX/2'), 'Shkalla IV');
  assert.equal(stageForClass('XI/2'), 'Shkalla V');
  assert.equal(stageForClass('XII/2'), 'Shkalla VI');
  assert.equal(stageForClass('unknown'), '');
  assert.equal(stageForClass('XII/2', { schoolStages: [{ grade: 'XII', stage: 'Shkalla profesionale', validated: true }] }), 'Shkalla profesionale');
});

test('subject catalog is searchable, merged, and only approved school records override', () => {
  assert.equal(getSubjectArea('Matematikë'), 'Matematika');
  assert.equal(getSubjectArea('Gjuhë shqipe'), 'Gjuhët dhe komunikimi');
  assert.equal(getSubjectArea('Art figurativ'), 'Artet');
  const schoolSubjects = [
    { name: 'Matematikë', area: 'Area e gabuar', validated: false },
    { name: 'Robotikë', area: 'Jeta dhe puna', grades: [6], validated: true },
  ];
  assert.equal(getSubjectArea('Matematikë', { schoolSubjects }), 'Matematika');
  assert.equal(getSubjectArea('Robotikë', { schoolSubjects, classLabel: 'VI/2' }), 'Jeta dhe puna');
  assert.equal(getSubjectArea('Robotikë', { schoolSubjects, classLabel: 'VII/1' }), '');
  assert.ok(listSubjects({ schoolSubjects, classLabel: 'VI/2' }).some((item) => item.name === 'Gjuhë shqipe'));
  assert.ok(listSubjects({ schoolSubjects, classLabel: 'VI/2' }).some((item) => item.name === 'Robotikë'));
  assert.ok(!listSubjects({ schoolSubjects, classLabel: 'VII/1' }).some((item) => item.name === 'Robotikë'));
  assert.equal(listSubjects({ query: 'matematike' }).length, 1);
});

test('new plan uses explicit defaults; scheduled lesson takes precedence; teacher changes preserve content', () => {
  const preferences = { defaultClass: 'VI/2', defaultSubject: 'Matematikë', teacherName: 'Arta Hoxha', rememberLastUsed: true, lastUsedClass: 'VIII/1' };
  const plan = createPlan({ preferences, teacherId: 'arta', now });
  assert.equal(plan.classLabel, 'VI/2');
  assert.equal(plan.curriculumStage, 'Shkalla III');
  assert.equal(plan.curricularArea, 'Matematika');
  assert.equal(plan.teacherName, 'Arta Hoxha');
  assert.equal(plan.date, '2026-09-26');
  assert.equal(plan.topicLearningOutcome, '');
  assert.deepEqual(plan.competencyOutcomes, []);
  const scheduled = createPlan({ preferences, teacherId: 'arta', now, scheduledLesson: { date: '2026-10-01', classLabel: 'VII/1', subject: 'Gjuhë shqipe', period: '3' } });
  assert.equal(scheduled.classLabel, 'VII/1');
  assert.equal(scheduled.subject, 'Gjuhë shqipe');
  assert.equal(scheduled.period, '3');
  assert.equal(scheduled.curriculumStage, 'Shkalla III');
  assert.equal(scheduled.curricularArea, 'Gjuhët dhe komunikimi');
  const authored = { ...plan, lessonUnit: 'Njësia ime', lessonOutcomes: ['Rezultati im'], topicLearningOutcome: 'Tekst i shkruar' };
  const changed = changePlanSubject(authored, 'Gjuhë shqipe');
  assert.equal(changed.curricularArea, 'Gjuhët dhe komunikimi');
  assert.equal(changed.lessonUnit, 'Njësia ime');
  assert.deepEqual(changed.lessonOutcomes, ['Rezultati im']);
  assert.equal(changed.topicLearningOutcome, 'Tekst i shkruar');
  assert.equal(changePlanClass(changed, 'VIII/1').curriculumStage, 'Shkalla IV');
  assert.equal(setPlanField(changed, 'curricularArea', 'Fushë e veçantë').areaManual, true);
  const overridden = setPlanField(changed, 'curricularArea', 'Fushë e veçantë');
  assert.equal(changePlanSubject(overridden, 'Matematikë').curricularArea, 'Fushë e veçantë');
  assert.equal(resetDerivedField(overridden, 'curricularArea').curricularArea, 'Gjuhët dhe komunikimi');
});

test('topic selection asks before replacing authored text and duplicate clears reflection', () => {
  const plan = { ...createPlan({ teacherId: 'arta', now }), topicLearningOutcome: 'E shkruar manualisht', reflection: 'Ora shkoi mirë' };
  const topic = { title: 'Numrat', learningOutcome: 'Nga plani dymujor' };
  const pending = applyTopic(plan, topic);
  assert.equal(pending.needsConfirmation, true);
  assert.equal(pending.plan.topicLearningOutcome, 'E shkruar manualisht');
  const applied = applyTopic(plan, topic, { confirmReplace: true });
  assert.equal(applied.plan.topicLearningOutcome, 'Nga plani dymujor');
  const duplicate = duplicatePlan(plan, { now: '2026-09-27T12:00:00Z' });
  assert.equal(duplicate.id, null);
  assert.equal(duplicate.status, 'draft');
  assert.equal(duplicate.reflection, '');
  assert.equal(duplicate.date, '2026-09-27');
});

test('date presets are inclusive and weeks start Monday', () => {
  assert.deepEqual(getDateRange('thisWeek', { today: '2026-09-26' }), { startDate: '2026-09-21', endDate: '2026-09-27' });
  assert.deepEqual(getDateRange('last7Days', { today: '2026-09-26' }), { startDate: '2026-09-20', endDate: '2026-09-26' });
  assert.deepEqual(getDateRange('lastMonth', { today: '2026-01-02' }), { startDate: '2025-12-01', endDate: '2025-12-31' });
  assert.throws(() => getDateRange('custom', { startDate: '2026-09-28', endDate: '2026-09-01' }), RangeError);
});

test('repository persists plan, preferences, templates, reusable entries, topics, and school mappings', () => {
  const storage = memoryStorage();
  const config = { storage, schoolId: 'school-a', now: () => new Date(now) };
  const repo = createLessonPlanRepository('arta', config);
  repo.savePreferences({ defaultClass: 'VI/2', defaultSubject: 'Matematikë' });
  const plan = repo.savePlan(createPlan({ teacherId: 'arta', preferences: repo.getPreferences(), now }));
  assert.ok(plan.id);
  assert.equal(plan.classLabel, 'VI/2');
  const edited = repo.savePlan({ ...plan, lessonUnit: 'Thyesat', status: 'completed', createdAt: '1999-01-01T00:00:00Z' });
  assert.equal(edited.createdAt, plan.createdAt);
  assert.equal(repo.getPlan(plan.id).lessonUnit, 'Thyesat');
  repo.savePreferences({ defaultClass: 'VIII/1' });
  assert.equal(repo.getPlan(plan.id).classLabel, 'VI/2');
  const newPlan = createPlan({ teacherId: 'arta', preferences: repo.getPreferences(), now });
  assert.equal(newPlan.classLabel, 'VIII/1');
  assert.equal(repo.archivePlan(plan.id).status, 'archived');
  assert.equal(repo.restorePlan(plan.id).status, 'completed');
  assert.equal(repo.saveTemplate({ name: 'Model', plan: { ...plan, reflection: 'Old' } }).plan.reflection, '');
  assert.equal(repo.saveReusableEntry({ kind: 'resources', value: 'Projektor' }).value, 'Projektor');
  repo.saveTopic({ title: 'Thyesat', subject: 'Matematikë', classLabel: 'VI/2', learningOutcome: 'Rezultat i ruajtur' });
  assert.equal(repo.listTopics({ subject: 'Matematikë', classLabel: 'VI/2' }).length, 1);
  assert.equal(repo.saveReusableEntry({ type: 'assessment', text: 'Vlerësim formativ' }).value, 'Vlerësim formativ');
  assert.equal(repo.listReusableEntries('assessment')[0].text, 'Vlerësim formativ');
  assert.equal(repo.saveTopic({ title: 'Energjia', subject: 'Fizikë', outcome: 'Nga plani dymujor' }).learningOutcome, 'Nga plani dymujor');
  assert.throws(() => repo.saveSubjectMapping({ name: 'Robotikë', area: 'Jeta dhe puna' }), /Administrator/);
  repo.saveSubjectMapping({ name: 'Robotikë', area: 'Jeta dhe puna' }, { isAdmin: true });
  assert.equal(repo.listSubjectMappings()[0].validated, true);
  const reopened = createLessonPlanRepository('arta', config);
  assert.equal(reopened.listPlans().length, 1);
  assert.equal(reopened.getPreferences().defaultClass, 'VIII/1');
  assert.equal(reopened.listTemplates().length, 1);
  assert.equal(reopened.listReusableEntries('resources').length, 1);
  assert.equal(reopened.listSubjectMappings().length, 1);
  const other = createLessonPlanRepository('blerta', config);
  assert.equal(other.listPlans().length, 0);
  assert.equal(other.listSubjectMappings().length, 1);
  assert.throws(() => other.savePlan(plan), /another teacher/);
});

test('invalid stored JSON reports a warning and cannot be overwritten', () => {
  const storage = memoryStorage();
  const repo = createLessonPlanRepository('arta', { storage });
  storage.setItem(repo.storageKeys.personal, '{broken');
  assert.equal(repo.getStorageStatus().personal.ok, false);
  assert.deepEqual(repo.listPlans(), []);
  assert.throws(() => repo.savePreferences({ defaultClass: 'VI/2' }), /Cannot safely write/);
  assert.equal(storage.getItem(repo.storageKeys.personal), '{broken');
});
