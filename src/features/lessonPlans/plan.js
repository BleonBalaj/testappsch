import { getSubjectArea, parseClassLabel, stageForClass } from './catalog.js';

const asText = (value) => typeof value === 'string' ? value.trim() : '';
const asList = (value) => Array.isArray(value) ? value : [];

export function dateInTimeZone(now = new Date(), timeZone = 'Europe/Belgrade') {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new TypeError('Invalid date');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const timestamp = (now) => {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new TypeError('Invalid date');
  return date.toISOString();
};

// Pure creation: repository.savePlan supplies a unique id at first persistence.
export function createPlan({ preferences = {}, schoolData = {}, scheduledLesson = null, teacherId, now = new Date() } = {}) {
  if (!teacherId || !String(teacherId).trim()) throw new TypeError('teacherId is required');
  const scheduled = scheduledLesson ?? {};
  const timeZone = schoolData.timeZone || preferences.timeZone || 'Europe/Belgrade';
  const classLabel = asText(scheduled.classLabel ?? scheduled.className ?? scheduled.class)
    || asText(preferences.defaultClass)
    || asText(schoolData.defaultClass)
    || (preferences.rememberLastUsed ? asText(preferences.lastUsedClass) : '');
  const parsed = parseClassLabel(classLabel);
  const subject = asText(scheduled.subject)
    || asText(preferences.defaultSubject)
    || asText(schoolData.defaultSubject)
    || (preferences.rememberLastUsed ? asText(preferences.lastUsedSubject) : '');
  const date = asText(scheduled.date ?? scheduled.scheduledDate) || dateInTimeZone(now, timeZone);
  const schoolSubjects = asList(schoolData.subjectMappings ?? schoolData.subjects);
  const schoolStages = asList(schoolData.stageMappings);
  const stamp = timestamp(now);
  return {
    id: null,
    teacherId: String(teacherId).trim(),
    status: 'draft',
    createdAt: stamp,
    updatedAt: stamp,
    date,
    period: asText(scheduled.period ?? scheduled.lessonPeriod),
    classLabel,
    grade: parsed?.grade ?? null,
    section: parsed?.section ?? '',
    subject,
    curricularArea: getSubjectArea(subject, { schoolSubjects, classLabel }),
    curriculumStage: stageForClass(classLabel, { schoolStages }),
    areaManual: false,
    stageManual: false,
    teacherName: asText(preferences.teacherName) || asText(schoolData.teacherName) || asText(schoolData.teacher?.name),
    schoolName: asText(preferences.schoolName) || asText(schoolData.schoolName) || asText(schoolData.school?.name),
    academicYear: asText(preferences.academicYear) || asText(schoolData.academicYear),
    duration: preferences.duration ?? schoolData.duration ?? '',
    lessonUnit: '',
    topic: '',
    topicLearningOutcome: '',
    competencyOutcomes: [],
    fieldOutcomes: [],
    keywords: '',
    lessonOutcomes: [],
    successCriteria: [],
    resources: '',
    crossCurricular: '',
    methodology: '',
    assessment: '',
    homework: '',
    reflection: '',
  };
}

// Call for a direct teacher edit so later derived changes respect the override.
export function setPlanField(plan, field, value) {
  if (!plan || typeof plan !== 'object') throw new TypeError('plan is required');
  if (field === 'subject') return changePlanSubject(plan, value);
  if (field === 'classLabel') return changePlanClass(plan, value);
  if (field === 'curricularArea') return { ...plan, curricularArea: value, areaManual: true };
  if (field === 'curriculumStage') return { ...plan, curriculumStage: value, stageManual: true };
  return { ...plan, [field]: value };
}

export function changePlanSubject(plan, subject, { schoolSubjects = [], forceArea = false } = {}) {
  if (!plan || typeof plan !== 'object') throw new TypeError('plan is required');
  const next = { ...plan, subject: asText(subject) };
  if (!plan.areaManual || forceArea) {
    next.curricularArea = getSubjectArea(next.subject, { schoolSubjects, classLabel: plan.classLabel });
    next.areaManual = false;
  }
  // Written outcomes and lesson content are intentionally untouched.
  return next;
}

export function changePlanClass(plan, classLabel, { schoolStages = [], schoolSubjects = [], forceStage = false } = {}) {
  if (!plan || typeof plan !== 'object') throw new TypeError('plan is required');
  const nextClass = asText(classLabel);
  const parsed = parseClassLabel(nextClass);
  const next = { ...plan, classLabel: nextClass, grade: parsed?.grade ?? null, section: parsed?.section ?? '' };
  if (!plan.stageManual || forceStage) {
    next.curriculumStage = stageForClass(nextClass, { schoolStages });
    next.stageManual = false;
  }
  if (!plan.areaManual) next.curricularArea = getSubjectArea(plan.subject, { schoolSubjects, classLabel: nextClass });
  return next;
}

export function resetDerivedField(plan, field, { schoolSubjects = [], schoolStages = [] } = {}) {
  if (field === 'curricularArea') return { ...plan, areaManual: false, curricularArea: getSubjectArea(plan.subject, { schoolSubjects, classLabel: plan.classLabel }) };
  if (field === 'curriculumStage') return { ...plan, stageManual: false, curriculumStage: stageForClass(plan.classLabel, { schoolStages }) };
  throw new TypeError('field must be curricularArea or curriculumStage');
}

// Topic outcomes are stored records, never generated. Existing authored text needs confirmation.
export function applyTopic(plan, topic, { confirmReplace = false } = {}) {
  if (!plan || typeof plan !== 'object' || !topic || typeof topic !== 'object') throw new TypeError('plan and topic are required');
  const title = asText(topic.title ?? topic.topic);
  const outcome = asText(topic.learningOutcome ?? topic.topicLearningOutcome ?? topic.outcome);
  const existing = asText(plan.topicLearningOutcome);
  if (outcome && existing && existing !== outcome && !confirmReplace) return { plan, needsConfirmation: true };
  return { plan: { ...plan, topic: title, topicLearningOutcome: outcome || existing }, needsConfirmation: false };
}

export function duplicatePlan(plan, { now = new Date(), timeZone = 'Europe/Belgrade', date, teacherId } = {}) {
  if (!plan || typeof plan !== 'object') throw new TypeError('plan is required');
  const stamp = timestamp(now);
  return {
    ...plan,
    id: null,
    status: 'draft',
    date: date || dateInTimeZone(now, timeZone),
    teacherId: teacherId ?? plan.teacherId,
    createdAt: stamp,
    updatedAt: stamp,
    reflection: '',
  };
}

export const DATE_PRESETS = Object.freeze([
  { id: 'today', label: 'Sot' },
  { id: 'yesterday', label: 'Dje' },
  { id: 'thisWeek', label: 'Këtë javë' },
  { id: 'lastWeek', label: 'Javën e kaluar' },
  { id: 'thisMonth', label: 'Këtë muaj' },
  { id: 'lastMonth', label: 'Muajin e kaluar' },
  { id: 'last7Days', label: '7 ditët e fundit' },
  { id: 'custom', label: 'Periudhë e personalizuar' },
]);

const parseYmd = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Date must use YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new TypeError('Invalid calendar date');
  return date;
};
const ymd = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

export function getDateRange(preset, { today, now = new Date(), timeZone = 'Europe/Belgrade', startDate, endDate } = {}) {
  if (preset === 'custom') {
    const start = ymd(parseYmd(startDate));
    const end = ymd(parseYmd(endDate));
    if (start > end) throw new RangeError('Start date must be on or before end date');
    return { startDate: start, endDate: end };
  }
  const base = parseYmd(today ?? dateInTimeZone(now, timeZone));
  const day = base.getUTCDay();
  const monday = addDays(base, -((day + 6) % 7));
  switch (preset) {
    case 'today': return { startDate: ymd(base), endDate: ymd(base) };
    case 'yesterday': return { startDate: ymd(addDays(base, -1)), endDate: ymd(addDays(base, -1)) };
    case 'thisWeek': return { startDate: ymd(monday), endDate: ymd(addDays(monday, 6)) };
    case 'lastWeek': return { startDate: ymd(addDays(monday, -7)), endDate: ymd(addDays(monday, -1)) };
    case 'last7Days': return { startDate: ymd(addDays(base, -6)), endDate: ymd(base) };
    case 'thisMonth': return { startDate: ymd(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1))), endDate: ymd(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0))) };
    case 'lastMonth': return { startDate: ymd(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1))), endDate: ymd(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 0))) };
    default: throw new TypeError(`Unknown date preset: ${preset}`);
  }
}
