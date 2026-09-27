import { GENERATED_LESSON_FIELDS } from '../../services/lessonAiContext.js';

const AI_EDITED_FIELDS = [...GENERATED_LESSON_FIELDS, 'period', 'status'];
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const copy = (value) => structuredClone(value);

export function makeLessonAiUndoSnapshot(before, after, { schoolId, accountId }) {
  const changes = Object.fromEntries(AI_EDITED_FIELDS.flatMap((field) =>
    same(before[field], after[field]) ? [] : [[field, { before: copy(before[field]), after: copy(after[field]) }]]));
  return {
    version: 1,
    planId: before.id,
    schoolId,
    accountId,
    changes,
  };
}

export function buildLessonAiUndoPatch(current, snapshot) {
  if (!current || !snapshot || current.id !== snapshot.planId) return { patch: {}, skipped: [] };
  const patch = {};
  const skipped = [];
  for (const [field, change] of Object.entries(snapshot.changes || {})) {
    if (!AI_EDITED_FIELDS.includes(field) || !change || !Object.hasOwn(change, 'after')) continue;
    if (same(current[field], change.after)) patch[field] = copy(change.before);
    else skipped.push(field);
  }
  return { patch, skipped };
}

export function lessonAiUndoStorageKey({ accountId, schoolId, planId }) {
  return `noesis-lesson-ai-undo:v1:${accountId}:${schoolId}:${planId}`;
}
