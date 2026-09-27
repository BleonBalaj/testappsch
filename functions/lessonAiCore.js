import { parseClassLabel, stageForClass, getSubjectArea } from './catalog.js';

// Pin a supported model instead of silently dropping to retired Flash models.
export const LESSON_AI_MODEL = 'gemini-3.8-flash';

export const GENERATED_LESSON_FIELDS = Object.freeze([
  'topic', 'topicLearningOutcome', 'competencyOutcomes', 'fieldOutcomes',
  'keywords', 'lessonOutcomes', 'successCriteria', 'resources',
  'crossCurricular', 'methodology', 'assessment', 'homework',
]);

const LIST_FIELDS = new Set(['competencyOutcomes', 'fieldOutcomes', 'lessonOutcomes', 'successCriteria']);
const CONTEXT_FIELDS = [
  'topic', 'topicLearningOutcome', 'competencyOutcomes', 'fieldOutcomes',
  'keywords', 'lessonOutcomes', 'successCriteria', 'resources',
  'crossCurricular', 'methodology', 'assessment', 'homework',
];

const stringSchema = { type: 'string' };
const listSchema = { type: 'array', items: stringSchema };
const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    contextUsed: {
      type: 'object',
      properties: { subject: stringSchema, classLabel: stringSchema, grade: stringSchema, classSection: stringSchema, lessonUnit: stringSchema, periodWithinUnit: stringSchema },
      required: ['subject', 'classLabel', 'grade', 'classSection', 'lessonUnit', 'periodWithinUnit'],
      description: 'Echo the exact subject, class, parsed grade, class parallel, unit and period; used to reject context drift.',
    },
    focusConcepts: { type: 'array', items: stringSchema, description: 'One to four actual concepts or skills from the selected lesson unit.' },
    concreteExample: { type: 'string', description: 'A complete, age-appropriate example or student task that is copied into the methodology.' },
    ...Object.fromEntries(GENERATED_LESSON_FIELDS.map((field) => [field, LIST_FIELDS.has(field) ? listSchema : stringSchema])),
  },
  required: ['contextUsed', 'focusConcepts', 'concreteExample', ...GENERATED_LESSON_FIELDS],
};

const SYSTEM_INSTRUCTION = `You are helping a teacher draft ONE lesson plan. The selected subject, lesson unit, grade, class parallel, and every teacher-written field are binding context, not labels to decorate a generic template. Treat supplied field contents as semantic constraints even if the user has selected an option to replace those fields in the editor.

Parse class labels carefully: a label such as II-4 or II/4 means GRADE 2, PARALLEL/SECTION 4; it does not mean grade 4. Grade controls age, prior knowledge, reading level, number range, cognitive demand and task complexity. The parallel identifies a group only; do not invent different curricular content for parallel 4 unless teacher notes specify it. If the unit could mean different things at different grades, choose the interpretation appropriate to the parsed grade and subject. If it is genuinely ambiguous, stay within the explicitly named concepts and avoid unsupported specifics.

Reason from the actual knowledge and skills inside the named unit. Every lesson outcome must say what learners will do with a specific concept from that unit. Success criteria must be observable evidence of those outcomes. The methodology must contain a worked or modeled example and a different student task using the unit's actual content. The assessment must say what the teacher will inspect in those same tasks. Make resources and homework suitable for this subject, grade, and unit. Prefer concrete objects, visuals and short instructions for early primary grades; avoid advanced terminology or operations beyond the selected grade unless explicitly supplied by the teacher.

Respect the selected period as the sequence within this unit, including period 4, 5, 12 or later. Do not assume the unit has a fixed number of periods or invent what happened in prior periods. A later period may deepen or apply the content, but do not mechanically treat every second period as drills or every third as a word problem. Use the stated duration for a realistic sequence; avoid fixed 10/25/10 timing unless it fits. Cross-check all teacher-provided topic, outcomes, criteria, resources, methodology, assessment and homework before drafting. If a supplied field names a method, example, resource or constraint, carry it through where relevant and avoid contradiction. Do not invent official curriculum standards, competency codes, textbook pages, prior lessons, or student results. Write outcomes as editable suggestions, not as verified official quotations. Existing reflection is historical teacher context only: never generate or rewrite a post-lesson reflection.

Avoid filler such as "understands the concept", "discusses the topic", "completes exercises", "uses a worksheet", or "connects to real life" unless you specify the concept, an actual question or example, and observable student work. Do not introduce technology or another subject unless it is genuinely relevant. Leave crossCurricular empty if no authentic connection exists. If the unit title is broad, choose one manageable lesson focus within that unit at this grade and period and keep the exact unit title in the topic. Never present that choice as an official curriculum requirement.

Return JSON in the requested schema. Echo the exact input subject, classLabel, grade, classSection, lessonUnit and periodWithinUnit in contextUsed as strings. Copy the exact lesson-unit title into the topic. Include one to four real unit concepts or skills in focusConcepts and use each phrase in an outcome, the methodology, or the assessment. Write one concreteExample as a complete age-appropriate sentence or worked problem, and copy that exact example into the methodology. Write all generated prose in the requested output language; preserve proper names and the original unit title.`;

function text(value) {
  return typeof value === 'string' ? value.trim().slice(0, 3000) : '';
}

function normalized(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function periodNumber(value) {
  if (value === '' || value === null || value === undefined) return 1;
  const raw = String(value).trim();
  const match = raw.match(/^(?:(?:period|ora)\s*)?(\d+)$/i);
  if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) < 1) {
    throw new Error('Enter a valid positive lesson period.');
  }
  return Number(match[1]);
}

function durationMinutes(value) {
  const parsed = Number.parseInt(String(value ?? '').match(/\d+/)?.[0] ?? '45', 10);
  return Number.isFinite(parsed) && parsed >= 20 && parsed <= 180 ? parsed : 45;
}

export function buildLessonGenerationContext(plan = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || JSON.stringify(plan).length > 35000) {
    throw new Error('The lesson context is invalid or too large.');
  }
  const subject = text(plan.subject);
  const classLabel = text(plan.classLabel);
  const lessonUnit = text(plan.lessonUnit);
  if (!subject || !classLabel || !lessonUnit) {
    throw new Error('Add a subject, class, and specific lesson unit before generating.');
  }
  if (normalized(lessonUnit) === normalized(subject) || /^(unit|chapter|lesson|review|revision|topic|nj[eë]sia|kapitulli|m[eë]simi|p[eë]rs[eë]ritje)\s*\d*$/i.test(lessonUnit)) {
    throw new Error('The lesson unit is too broad. Add the exact concept or skill you want taught.');
  }

  const parsedClass = parseClassLabel(classLabel);
  const parsedGrade = parsedClass?.grade;
  const suppliedGrade = Number(plan.grade);
  const grade = parsedGrade ?? (Number.isInteger(suppliedGrade) && suppliedGrade >= 1 && suppliedGrade <= 12 ? suppliedGrade : null);
  if (grade === null) throw new Error('Use a class label with a grade, such as II-4, or select a valid grade.');
  const existingContent = Object.fromEntries(CONTEXT_FIELDS.flatMap((field) => {
    const value = plan[field];
    if (LIST_FIELDS.has(field)) {
      const items = Array.isArray(value) ? value.slice(0, 20).map(text).filter(Boolean) : [];
      return items.length ? [[field, items]] : [];
    }
    return text(value) ? [[field, text(value)]] : [];
  }));

  return {
    subject,
    classLabel,
    grade,
    classSection: text(parsedClass?.section ?? plan.section),
    classParallel: text(parsedClass?.section ?? plan.section),
    lessonUnit,
    curricularArea: text(plan.curricularArea) || getSubjectArea(subject, { classLabel }),
    curriculumStage: text(plan.curriculumStage) || stageForClass(classLabel),
    lessonDate: text(plan.date),
    academicYear: text(plan.academicYear),
    teacherName: text(plan.teacherName),
    schoolName: text(plan.schoolName),
    curricularAreaWasManuallySet: plan.areaManual === true,
    curriculumStageWasManuallySet: plan.stageManual === true,
    periodWithinUnit: periodNumber(plan.period),
    durationMinutes: durationMinutes(plan.duration),
    outputLanguage: plan.language === 'sq' ? 'Albanian (Shqip)' : 'English',
    existingTeacherContent: existingContent,
    existingTeacherReflection: text(plan.reflection),
  };
}

export function buildLessonGenerationPrompt(context, problems = []) {
  return `Create a lesson-plan draft from this structured teacher context. The lessonUnit is the content to teach, not just a title. Derive examples, activities, outcomes, assessment evidence and homework from its actual concepts at the parsed grade. The class parallel is a group identifier, not another grade. Read EVERY nonempty existingTeacherContent field as context, even if that field may later be replaced. Respect manually set area and stage. Do not claim access to an official school curriculum document that was not supplied.\n\n${JSON.stringify(context, null, 2)}${problems.length ? `\n\nYour previous answer was rejected. Fix these problems, then return the entire JSON object again:\n- ${problems.join('\n- ')}` : ''}`;
}

export function validateLessonGeneration(candidate, context) {
  const problems = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return ['The response was not a JSON object.'];
  }
  if (text(candidate.contextUsed?.subject) !== context.subject ||
      text(candidate.contextUsed?.classLabel) !== context.classLabel ||
      text(candidate.contextUsed?.grade) !== String(context.grade) ||
      text(candidate.contextUsed?.classSection) !== context.classSection ||
      text(candidate.contextUsed?.periodWithinUnit) !== String(context.periodWithinUnit) ||
      text(candidate.contextUsed?.lessonUnit) !== context.lessonUnit) {
    problems.push('The response did not preserve the selected subject, grade, parallel, unit and period.');
  }

  for (const field of GENERATED_LESSON_FIELDS) {
    if (LIST_FIELDS.has(field)) {
      if (!Array.isArray(candidate[field]) || candidate[field].filter((item) => text(item).length >= 18).length < 1) {
        problems.push(`${field} needs a specific, complete outcome or criterion.`);
      }
    } else if (field !== 'crossCurricular' && text(candidate[field]).length < (field === 'topic' ? 1 : field === 'methodology' ? 100 : field === 'keywords' ? 5 : 20)) {
      problems.push(`${field} is missing or too vague.`);
    }
  }

  const focusConcepts = candidate.focusConcepts;
  if (!Array.isArray(focusConcepts) || focusConcepts.filter((item) => text(item).length >= 2).length < 1) {
    problems.push('focusConcepts must identify a real concept or skill from the lesson unit.');
  } else {
    const teachingContent = normalized([
      candidate.topicLearningOutcome,
      ...(Array.isArray(candidate.lessonOutcomes) ? candidate.lessonOutcomes : []),
      candidate.methodology,
      candidate.assessment,
    ].join(' '));
    if (focusConcepts.slice(0, 4).some((concept) => !teachingContent.includes(normalized(concept)))) {
      problems.push('Use every focusConcept explicitly in a lesson outcome, the methodology, or the assessment.');
    }
  }
  if (!normalized(candidate.topic).includes(normalized(context.lessonUnit))) {
    problems.push('The topic must retain the exact selected lesson-unit title.');
  }
  const unitTerms = normalized(context.lessonUnit).split(' ').filter((term) => term.length >= 4);
  if (unitTerms.length) {
    const teachingText = normalized([
      candidate.topicLearningOutcome,
      ...(Array.isArray(candidate.lessonOutcomes) ? candidate.lessonOutcomes : []),
      candidate.methodology,
      candidate.assessment,
      candidate.homework,
    ].join(' '));
    if (!unitTerms.some((term) => teachingText.includes(term.slice(0, 5)))) {
      problems.push('The lesson activities and outcomes do not use the selected unit content.');
    }
  }
  const example = normalized(candidate.concreteExample);
  if (example.length < 20 || !normalized(candidate.methodology).includes(example)) {
    problems.push('Provide a concrete, unit-specific example of a complete sentence and copy it into the methodology.');
  }

  const outcomeText = [...(Array.isArray(candidate.lessonOutcomes) ? candidate.lessonOutcomes : []), ...(Array.isArray(candidate.successCriteria) ? candidate.successCriteria : [])].join(' ');
  const genericOutcome = /^(students?|learners?|nx[eë]n[eë]s(?:i|it|ja))?\s*(will\s*)?(understand|learn|discuss|explain|kupton|m[eë]son|diskuton)\s+(the\s*)?(topic|concept|lesson|subject|tem[eë]n|konceptin)/i;
  if (outcomeText.split(/[.!?]/).some((sentence) => genericOutcome.test(sentence.trim()))) {
    problems.push('Replace generic learning outcomes with observable work on the unit concepts.');
  }
  return problems;
}

async function callGemini(apiKey, prompt, { fetchImpl, signal, model }) {
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 7000,
        responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: RESULT_SCHEMA } },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = text(payload?.error?.message) || `Gemini returned HTTP ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  const candidate = payload?.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`Gemini stopped before completing the plan (${candidate.finishReason}). Please try again.`);
  }
  const output = candidate?.content?.parts?.filter((part) => !part.thought).map((part) => part.text || '').join('') || '';
  if (!output) throw new Error('Gemini returned no lesson plan. Please try again.');
  try {
    return JSON.parse(output);
  } catch {
    throw new Error('Gemini returned an incomplete lesson plan. Please try again.');
  }
}

export async function generateLessonPlanCore(planContext, apiKey, options = {}) {
  const context = buildLessonGenerationContext(planContext);
  if (!apiKey) throw new Error('The lesson generation service is not configured.');

  const request = {
    fetchImpl: options.fetchImpl || globalThis.fetch,
    signal: options.signal,
    model: options.model || LESSON_AI_MODEL,
  };
  let problems = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await callGemini(apiKey, buildLessonGenerationPrompt(context, problems), request);
    problems = validateLessonGeneration(result, context);
    if (!problems.length) {
      return Object.fromEntries(GENERATED_LESSON_FIELDS.map((field) => [field, LIST_FIELDS.has(field) ? result[field].map(text).filter(Boolean) : text(result[field])]));
    }
  }
  throw new Error(`The generated lesson was too generic for this unit. Nothing was changed. ${problems[0]}`);
}

export default generateLessonPlanCore;
