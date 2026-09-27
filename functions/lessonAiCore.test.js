import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLessonGenerationContext,
  buildLessonGenerationPrompt,
  generateLessonPlanCore,
  validateLessonGeneration,
} from './lessonAiCore.js';

const plan = {
  subject: 'Matematikë',
  classLabel: 'VI/2',
  lessonUnit: 'Mbledhja e thyesave me emërues të ndryshëm',
  curricularArea: 'Matematikë',
  curriculumStage: 'Shkalla III',
  period: '2',
  duration: '45',
  topicLearningOutcome: 'Nxënësi përdor shumëfishin e përbashkët për të mbledhur thyesat.',
  language: 'sq',
};

const completeResult = {
  contextUsed: { subject: plan.subject, classLabel: plan.classLabel, grade: '6', classSection: '2', lessonUnit: plan.lessonUnit, periodWithinUnit: '2' },
  focusConcepts: ['emëruesin e përbashkët', 'thyesa të barasvlershme'],
  concreteExample: 'Për 1/3 + 1/4, nxënësit gjejnë emëruesin 12 dhe shkruajnë 4/12 + 3/12 = 7/12.',
  topic: 'Mbledhja e thyesave me emërues të ndryshëm — Ora 2',
  topicLearningOutcome: 'Nxënësit përdorin shumëfishin e përbashkët për të kthyer thyesa me emërues të ndryshëm në thyesa të barasvlershme dhe për të shpjeguar shumën.',
  competencyOutcomes: [
    'Arsyeton pse 1/3 dhe 4/12 përfaqësojnë të njëjtën sasi përpara mbledhjes.',
    'Shpjegon zgjedhjen e emëruesit të përbashkët në një shembull me dy thyesa.',
  ],
  fieldOutcomes: [
    'Kthen dy thyesa me emërues të ndryshëm në thyesa të barasvlershme.',
    'Gjen dhe thjeshton shumën e dy thyesave pas barazimit të emëruesve.',
  ],
  keywords: 'thyesë, emërues, shumëfish i përbashkët, barasvlershmëri',
  lessonOutcomes: [
    'Gjen emëruesin e përbashkët të 3 dhe 4 për mbledhjen 1/3 + 1/4.',
    'Kthen 1/3 në 4/12 dhe 1/4 në 3/12 pa ndryshuar vlerën e tyre.',
    'Verifikon me model vizual se 4/12 + 3/12 është 7/12.',
  ],
  successCriteria: [
    'Zgjedh një emërues të përbashkët të vlefshëm për dy thyesa të dhëna.',
    'Shkruan saktë të dyja thyesat e barasvlershme para mbledhjes.',
    'Shpjegon me vizatim pse shuma është më e madhe se secili mbledhës.',
  ],
  resources: 'Shirita thyesash të ndarë në të dymbëdhjetat dhe fletë me rrjete për krahasim.',
  crossCurricular: 'Art figurativ: ngjyrosja e pjesëve të një figure për të krahasuar 1/3 dhe 1/4.',
  methodology: 'Për 1/3 + 1/4, nxënësit gjejnë emëruesin 12 dhe shkruajnë 4/12 + 3/12 = 7/12. Mësuesi modelon pse këto thyesa janë të barasvlershme me shiritat e thyesave. Nxënësit më pas zgjedhin vetë emëruesin për 2/3 + 1/6, vizatojnë të dy sasitë dhe shpjegojnë si e kontrolluan rezultatin.',
  assessment: 'Mësuesi kontrollon nëse secili nxënës zgjedh një emërues të përbashkët, shkruan thyesat e barasvlershme dhe arsyeton shumën në vizatim.',
  homework: 'Llogarit 1/2 + 1/3 dhe 3/4 + 1/8; vizato një model për secilën shumë dhe shpjego emëruesin e përbashkët.',
};

test('uses subject, grade, exact unit, period, and teacher-authored context', () => {
  const context = buildLessonGenerationContext(plan);
  assert.equal(context.subject, plan.subject);
  assert.equal(context.classLabel, plan.classLabel);
  assert.equal(context.grade, 6);
  assert.equal(context.classSection, '2');
  assert.equal(context.periodWithinUnit, 2);
  assert.equal(context.outputLanguage, 'Albanian (Shqip)');
  assert.equal(context.existingTeacherContent.topicLearningOutcome, plan.topicLearningOutcome);
  assert.match(buildLessonGenerationPrompt(context), /Mbledhja e thyesave me emërues të ndryshëm/);
  const history = buildLessonGenerationContext({ subject: 'History', classLabel: 'VIII/1', lessonUnit: 'Causes of the French Revolution', period: '3', language: 'en' });
  assert.equal(history.grade, 8);
  assert.equal(history.subject, 'History');
  assert.match(buildLessonGenerationPrompt(history), /Causes of the French Revolution/);
  assert.ok(validateLessonGeneration({ ...completeResult, contextUsed: { ...completeResult.contextUsed, subject: 'Technology' } }, context).some((problem) => problem.includes('selected subject')));
});

test('rejects generic output and does not silently replace it with a template', async () => {
  const vague = { ...completeResult, concreteExample: 'Do exercises.', methodology: 'Students discuss the topic.' };
  assert.ok(validateLessonGeneration(vague, buildLessonGenerationContext(plan)).length > 0);
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(vague) }] } }] }), { status: 200 });
  };
  await assert.rejects(generateLessonPlanCore(plan, 'test-key', { fetchImpl }), /too generic/);
  assert.equal(calls, 2);
});

test('retries with specific feedback and accepts a grounded response', async () => {
  const requests = [];
  const fetchImpl = async (_url, init) => {
    requests.push(init);
    const output = requests.length === 1 ? { ...completeResult, methodology: 'Generic activity.' } : completeResult;
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] }), { status: 200 });
  };
  const result = await generateLessonPlanCore(plan, 'test-key', { fetchImpl });
  assert.equal(result.topic, completeResult.topic);
  assert.equal(result.reflection, undefined);
  assert.equal(requests.length, 2);
  assert.match(JSON.parse(requests[1].body).contents[0].parts[0].text, /previous answer was rejected/);
  assert.equal(requests[0].headers['x-goog-api-key'], 'test-key');
  assert.equal(JSON.parse(requests[0].body).generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON');
});

test('II-4 means grade 2 in parallel 4, including later periods and all authored fields', () => {
  const preset = {
    subject: 'Matematikë', classLabel: 'Klasa II–4', grade: 4, section: '9',
    lessonUnit: 'Bashkësitë dhe elementet e bashkësive', period: '12',
    topic: 'Bashkësitë me sende konkrete',
    topicLearningOutcome: 'Klasifikon sende sipas një vetie.',
    competencyOutcomes: ['Shpjegon rregullin e grupimit.'],
    fieldOutcomes: ['Identifikon elementet e bashkësisë.'],
    keywords: 'bashkësi, element',
    lessonOutcomes: ['Rendon objektet sipas ngjyrës.'],
    successCriteria: ['Vendos objektet në grupin e duhur.'],
    resources: 'Kopsa dhe figura prej letre',
    crossCurricular: 'Gjuhë: përshkrimi i objekteve',
    methodology: 'Nxënësit grupojnë kopsa.',
    assessment: 'Mësuesi vëzhgon grupimin.',
    homework: 'Grupojnë sende në shtëpi.',
    reflection: 'Herën e kaluar u deshën më shumë mjete konkrete.',
    teacherName: 'Arta', schoolName: 'Noesis Horizon',
    curricularArea: 'Matematika', curriculumStage: 'Shkalla I',
    areaManual: true, stageManual: true,
  };
  const context = buildLessonGenerationContext(preset);
  assert.equal(context.grade, 2);
  assert.equal(context.classSection, '4');
  assert.equal(context.classParallel, '4');
  assert.equal(context.periodWithinUnit, 12);
  assert.equal(context.existingTeacherReflection, preset.reflection);
  assert.equal(context.curricularAreaWasManuallySet, true);
  for (const field of Object.keys(preset).filter((key) => ['topic', 'topicLearningOutcome', 'competencyOutcomes', 'fieldOutcomes', 'keywords', 'lessonOutcomes', 'successCriteria', 'resources', 'crossCurricular', 'methodology', 'assessment', 'homework'].includes(key))) {
    assert.deepEqual(context.existingTeacherContent[field], preset[field]);
  }
  assert.match(buildLessonGenerationPrompt(context), /parallel is a group identifier/);
  assert.throws(() => buildLessonGenerationContext({ ...preset, period: '0' }), /positive lesson period/);
});

test('allows a short specific unit and no forced cross-curricular connection', () => {
  const context = buildLessonGenerationContext({ subject: 'Science', classLabel: 'II-4', lessonUnit: 'Plants', period: '5' });
  const candidate = {
    ...completeResult,
    contextUsed: { subject: 'Science', classLabel: 'II-4', grade: '2', classSection: '4', lessonUnit: 'Plants', periodWithinUnit: '5' },
    topic: 'Plants',
    topicLearningOutcome: 'Students identify parts of plants and explain how roots take in water.',
    focusConcepts: ['plants', 'roots'],
    concreteExample: 'Students compare two plants and point to the roots of each one.',
    methodology: 'Students compare two plants and point to the roots of each one. The teacher models the parts of plants with real specimens. Students draw their own plant and label roots and leaves, then explain where the water enters.',
    crossCurricular: '',
  };
  assert.deepEqual(validateLessonGeneration(candidate, context), []);
  assert.ok(validateLessonGeneration({ ...candidate, topicLearningOutcome: completeResult.topicLearningOutcome, methodology: completeResult.methodology }, context).some((problem) => problem.includes('unit content')));
});

test('surfaces API failures instead of producing a hard-coded generic plan', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: 'API quota exceeded' } }), { status: 429 });
  };
  await assert.rejects(generateLessonPlanCore(plan, 'test-key', { fetchImpl }), /API quota exceeded/);
  assert.equal(calls, 1);
});
