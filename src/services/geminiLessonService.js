import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase.js';
import { GENERATED_LESSON_FIELDS } from './lessonAiContext.js';

export const LESSON_AI_MODEL = 'gemini-3.8-flash';
export { GENERATED_LESSON_FIELDS };

const text = (value) => typeof value === 'string' ? value.trim() : '';

export function mergeGeneratedLessonFields(current, generated, { replaceExisting = false, period = '1' } = {}) {
  const next = { ...current, period: current.period || period, status: 'draft' };
  for (const field of GENERATED_LESSON_FIELDS) {
    const value = current[field];
    const alreadyWritten = Array.isArray(value) ? value.some((item) => text(item)) : Boolean(text(value));
    if (replaceExisting || !alreadyWritten) next[field] = generated[field];
  }
  // Reflection records what actually happened; generation must never fabricate it.
  return next;
}

export async function getLessonAiUsage() {
  const getUsage = httpsCallable(functions, 'getLessonAiUsage');
  const result = await getUsage();
  return result.data;
}

export async function generateLessonPlanWithAI(planContext, { schoolId, signal, requestId } = {}) {
  if (!schoolId) throw new Error('Select a school before generating a lesson plan.');
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const generate = httpsCallable(functions, 'generateLessonPlan', { timeout: 130000 });
  const result = await generate({ schoolId, planContext, requestId });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return result.data;
}

export default generateLessonPlanWithAI;
