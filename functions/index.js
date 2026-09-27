import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createHash, randomUUID } from 'node:crypto';
import { buildLessonGenerationContext, generateLessonPlanCore } from './lessonAiCore.js';
import {
  LessonAiQuotaError, getLessonAiQuota, reserveLessonAiQuota,
  completeLessonAiQuota, releaseLessonAiQuota,
} from './lessonAiQuota.js';

initializeApp();

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const permittedRoles = new Set(['admin', 'teacher', 'dept_head']);

export const getLessonAiUsage = onCall({ region: 'us-central1', invoker: 'public' }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to view your AI usage.');
  return getLessonAiQuota(getFirestore(), request.auth.uid);
});

export const generateLessonPlan = onCall({
  region: 'us-central1',
  invoker: 'public',
  secrets: [geminiApiKey],
  timeoutSeconds: 120,
  memory: '512MiB',
  maxInstances: 20,
}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to generate a lesson plan.');

  const schoolId = typeof request.data?.schoolId === 'string' ? request.data.schoolId.trim() : '';
  if (!schoolId || schoolId.length > 128 || schoolId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Select a valid school before generating.');
  }

  const db = getFirestore();
  const [school, membership] = await Promise.all([
    db.doc(`schools/${schoolId}`).get(),
    db.doc(`schools/${schoolId}/members/${uid}`).get(),
  ]);
  if (!school.exists) throw new HttpsError('not-found', 'The selected school does not exist.');

  const member = membership.data();
  const isCreator = school.data()?.creatorUid === uid;
  const isAllowedMember = member?.status === 'active' && permittedRoles.has(member.role);
  if (!isCreator && !isAllowedMember) {
    throw new HttpsError('permission-denied', 'Only active teachers and school administrators can generate lesson plans for this school.');
  }

  const planContext = request.data?.planContext;
  if (!planContext || typeof planContext !== 'object' || Array.isArray(planContext)) {
    throw new HttpsError('invalid-argument', 'Add a subject, class, and lesson unit first.');
  }

  const apiKey = geminiApiKey.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'Lesson generation is not configured yet.');

  try {
    // Reject invalid input before reserving one of the account's generation slots.
    buildLessonGenerationContext(planContext);
    const requestId = typeof request.data?.requestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.data.requestId)
      ? request.data.requestId : randomUUID();
    const contextHash = createHash('sha256').update(JSON.stringify({ schoolId, planContext })).digest('hex');
    const reservation = await reserveLessonAiQuota(db, { uid, requestId, contextHash, schoolId });
    if (reservation.replay) return { ...reservation.replay, quota: reservation.quota };

    let generated;
    try {
      generated = await generateLessonPlanCore(planContext, apiKey);
    } catch (error) {
      try { await releaseLessonAiQuota(db, { uid, requestId, contextHash }); }
      catch (releaseError) { console.error('Could not release failed lesson AI reservation:', releaseError); }
      throw error;
    }
    const completed = await completeLessonAiQuota(db, { uid, requestId, contextHash, result: generated });
    return { ...completed.result, quota: completed.quota };
  } catch (error) {
    if (error instanceof LessonAiQuotaError) throw new HttpsError(error.code, error.message, error.details);
    const message = String(error?.message || 'Lesson generation failed.');
    if (/context is invalid|Add a subject|lesson unit is too broad|valid positive lesson period|class label with a grade/i.test(message)) {
      throw new HttpsError('invalid-argument', message);
    }
    if (/too generic/i.test(message)) throw new HttpsError('failed-precondition', message);
    // Never return upstream API details or the key to the browser.
    console.error('Lesson generation failed:', error);
    if (error?.status === 401 || error?.status === 403) {
      throw new HttpsError('failed-precondition', 'The app’s AI service key was rejected. Contact the school administrator.');
    }
    if (error?.status === 429) {
      throw new HttpsError('resource-exhausted', 'The AI service limit was reached. Please try again later.');
    }
    if (error?.status === 400) {
      throw new HttpsError('internal', 'The lesson generator configuration needs an update.');
    }
    if (error?.status >= 500) {
      throw new HttpsError('unavailable', 'The AI service is temporarily unavailable. Please try again later.');
    }
    throw new HttpsError('internal', 'Lesson generation failed. Please try again later.');
  }
});
