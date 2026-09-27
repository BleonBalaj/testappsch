export const LESSON_AI_LIMIT = 50;
const RESERVATION_MS = 10 * 60 * 1000;

export class LessonAiQuotaError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const safeCount = (value) => Number.isInteger(value) && value >= 0 ? value : 0;
const currentReservations = (value, now) => Object.fromEntries(
  Object.entries(value || {}).filter(([, expiry]) => Number.isFinite(expiry) && expiry > now)
);
const quotaView = (used, reservations) => ({
  limit: LESSON_AI_LIMIT,
  used,
  remaining: Math.max(0, LESSON_AI_LIMIT - used - Object.keys(reservations).length),
});

export async function getLessonAiQuota(db, uid, now = Date.now()) {
  const snapshot = await db.doc(`lessonAiUsage/${uid}`).get();
  const used = safeCount(snapshot.data()?.used);
  return quotaView(used, currentReservations(snapshot.data()?.reservations, now));
}

export async function reserveLessonAiQuota(db, { uid, requestId, contextHash, schoolId, now = Date.now() }) {
  const usageRef = db.doc(`lessonAiUsage/${uid}`);
  const requestRef = db.doc(`lessonAiUsage/${uid}/requests/${requestId}`);
  return db.runTransaction(async (transaction) => {
    const [usageDoc, requestDoc] = await Promise.all([transaction.get(usageRef), transaction.get(requestRef)]);
    const used = safeCount(usageDoc.data()?.used);
    const reservations = currentReservations(usageDoc.data()?.reservations, now);
    const previous = requestDoc.data();

    if (previous?.contextHash && previous.contextHash !== contextHash) {
      throw new LessonAiQuotaError('invalid-argument', 'This generation request was already used for another lesson.');
    }
    if (previous?.status === 'succeeded') {
      return { replay: previous.result, quota: quotaView(used, reservations) };
    }
    if (previous?.status === 'inProgress' && reservations[requestId]) {
      throw new LessonAiQuotaError('aborted', 'This lesson is already generating. Please wait for it to finish.');
    }
    if (used + Object.keys(reservations).length >= LESSON_AI_LIMIT) {
      throw new LessonAiQuotaError('resource-exhausted', `This account has reached its ${LESSON_AI_LIMIT} lesson AI generations.`, {
        kind: 'lesson-ai-quota', ...quotaView(used, reservations)
      });
    }

    reservations[requestId] = now + RESERVATION_MS;
    transaction.set(usageRef, { used, reservations, updatedAt: new Date(now).toISOString() });
    transaction.set(requestRef, { status: 'inProgress', contextHash, schoolId, startedAt: new Date(now).toISOString() });
    return { replay: null, quota: quotaView(used, reservations) };
  });
}

export async function completeLessonAiQuota(db, { uid, requestId, contextHash, result, now = Date.now() }) {
  const usageRef = db.doc(`lessonAiUsage/${uid}`);
  const requestRef = db.doc(`lessonAiUsage/${uid}/requests/${requestId}`);
  return db.runTransaction(async (transaction) => {
    const [usageDoc, requestDoc] = await Promise.all([transaction.get(usageRef), transaction.get(requestRef)]);
    const used = safeCount(usageDoc.data()?.used);
    const reservations = currentReservations(usageDoc.data()?.reservations, now);
    const request = requestDoc.data();
    if (request?.status === 'succeeded' && request.contextHash === contextHash) {
      return { result: request.result, quota: quotaView(used, reservations) };
    }
    if (request?.status !== 'inProgress' || request.contextHash !== contextHash) {
      throw new LessonAiQuotaError('aborted', 'The lesson generation reservation expired. Please try again.');
    }
    if (!reservations[requestId] && used + Object.keys(reservations).length >= LESSON_AI_LIMIT) {
      throw new LessonAiQuotaError('resource-exhausted', `This account has reached its ${LESSON_AI_LIMIT} lesson AI generations.`, {
        kind: 'lesson-ai-quota', ...quotaView(used, reservations)
      });
    }
    delete reservations[requestId];
    const nextUsed = used + 1;
    transaction.set(usageRef, { used: nextUsed, reservations, updatedAt: new Date(now).toISOString() });
    transaction.set(requestRef, { status: 'succeeded', contextHash, schoolId: request.schoolId, result, completedAt: new Date(now).toISOString() });
    return { result, quota: quotaView(nextUsed, reservations) };
  });
}

export async function releaseLessonAiQuota(db, { uid, requestId, contextHash, now = Date.now() }) {
  const usageRef = db.doc(`lessonAiUsage/${uid}`);
  const requestRef = db.doc(`lessonAiUsage/${uid}/requests/${requestId}`);
  await db.runTransaction(async (transaction) => {
    const [usageDoc, requestDoc] = await Promise.all([transaction.get(usageRef), transaction.get(requestRef)]);
    if (requestDoc.data()?.status !== 'inProgress' || requestDoc.data()?.contextHash !== contextHash) return;
    const reservations = currentReservations(usageDoc.data()?.reservations, now);
    delete reservations[requestId];
    transaction.set(usageRef, { used: safeCount(usageDoc.data()?.used), reservations, updatedAt: new Date(now).toISOString() });
    transaction.delete(requestRef);
  });
}
