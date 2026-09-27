import { parseClassLabel } from '../features/lessonPlans/catalog.js';

export const GENERATED_LESSON_FIELDS = Object.freeze([
  'topic', 'topicLearningOutcome', 'competencyOutcomes', 'fieldOutcomes',
  'keywords', 'lessonOutcomes', 'successCriteria', 'resources',
  'crossCurricular', 'methodology', 'assessment', 'homework',
]);

// Always send authored fields, including when the teacher elects to replace them.
// Replacement only decides how the returned draft is merged into the editor.
export function buildLessonAiRequestContext(plan, language = 'en') {
  const parsedClass = parseClassLabel(plan?.classLabel);
  const suppliedGrade = Number(plan?.grade);
  const grade = parsedClass?.grade ?? (Number.isInteger(suppliedGrade) && suppliedGrade >= 1 && suppliedGrade <= 12 ? suppliedGrade : null);

  return {
    subject: plan?.subject,
    classLabel: plan?.classLabel,
    grade,
    section: parsedClass?.section ?? plan?.section,
    lessonUnit: plan?.lessonUnit,
    curricularArea: plan?.curricularArea,
    curriculumStage: plan?.curriculumStage,
    date: plan?.date,
    period: plan?.period || '1',
    academicYear: plan?.academicYear,
    duration: plan?.duration,
    teacherName: plan?.teacherName,
    schoolName: plan?.schoolName,
    areaManual: plan?.areaManual,
    stageManual: plan?.stageManual,
    reflection: plan?.reflection,
    language: language === 'sq' ? 'sq' : 'en',
    ...Object.fromEntries(GENERATED_LESSON_FIELDS.map((field) => [field, plan?.[field]])),
  };
}
