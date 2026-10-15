export const LESSON_AI_LIMIT = 50;
const RESERVATION_MS = 10 * 60 * 1000;
export const LESSON_AI_TIME_ZONE = 'Europe/Belgrade';
const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: LESSON_AI_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayAt = now => {
  const parts = Object.fromEntries(dayFormatter.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export function lessonAiDayWindow(now = Date.now()) {
  const day = dayAt(now);
  // Find the next local midnight, including 23/25-hour daylight-saving days.
  let low = now;
  let high = now + 27 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dayAt(middle) === day) low = middle;
    else high = middle;
  }
  return { period: 'day', day, timeZone: LESSON_AI_TIME_ZONE, resetsAt: new Date(high).toISOString(), serverTime: new Date(now).toISOString() };
}

const dailyRef = (db, uid, day) => db.doc(`lessonAiUsage/${uid}/days/${day}`);
const requestDay = (request, fallback) => /^\d{4}-\d{2}-\d{2}$/.test(request?.quotaDay || '') ? request.quotaDay : fallback;

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
const quotaView = (used, reservations, window) => ({
  ...window,
  limit: LESSON_AI_LIMIT,
  used,
  reserved: Object.keys(reservations).length,
  remaining: Math.max(0, LESSON_AI_LIMIT - used - Object.keys(reservations).length),
});

export async function getLessonAiQuota(db, uid, now = Date.now()) {
  const window = lessonAiDayWindow(now);
  const snapshot = await dailyRef(db, uid, window.day).get();
  const used = safeCount(snapshot.data()?.used);
  return quotaView(used, currentReservations(snapshot.data()?.reservations, now), window);
}

export async function reserveLessonAiQuota(db, { uid, requestId, contextHash, schoolId, now = Date.now() }) {
  const window = lessonAiDayWindow(now);
  const usageRef = dailyRef(db, uid, window.day);
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
      return { replay: previous.result, quota: quotaView(used, reservations, window) };
    }
    if (previous?.status === 'inProgress' && (previous.expiresAt > now || reservations[requestId])) {
      throw new LessonAiQuotaError('aborted', 'This lesson is already generating. Please wait for it to finish.');
    }
    if (used + Object.keys(reservations).length >= LESSON_AI_LIMIT) {
      throw new LessonAiQuotaError('resource-exhausted', `This account has reached its ${LESSON_AI_LIMIT} lesson AI generations for today. The allowance resets at midnight.`, {
        kind: 'lesson-ai-quota', ...quotaView(used, reservations, window)
      });
    }

    reservations[requestId] = now + RESERVATION_MS;
    transaction.set(usageRef, { used, reservations, updatedAt: new Date(now).toISOString() });
    transaction.set(requestRef, { status: 'inProgress', contextHash, schoolId, quotaDay: window.day, expiresAt: now + RESERVATION_MS, startedAt: new Date(now).toISOString() });
    return { replay: null, quota: quotaView(used, reservations, window) };
  });
}

export async function completeLessonAiQuota(db, { uid, requestId, contextHash, result, now = Date.now() }) {
  const window = lessonAiDayWindow(now);
  const totalRef = db.doc(`lessonAiUsage/${uid}`);
  const todayRef = dailyRef(db, uid, window.day);
  const requestRef = db.doc(`lessonAiUsage/${uid}/requests/${requestId}`);
  return db.runTransaction(async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    const request = requestDoc.data();
    if (request?.status === 'succeeded' && request.contextHash === contextHash) {
      const today = (await transaction.get(todayRef)).data();
      return { result: request.result, quota: quotaView(safeCount(today?.used), currentReservations(today?.reservations, now), window) };
    }
    if (request?.status !== 'inProgress' || request.contextHash !== contextHash) {
      throw new LessonAiQuotaError('aborted', 'The lesson generation reservation expired. Please try again.');
    }
    const billedDay = requestDay(request, window.day);
    const usageRef = dailyRef(db, uid, billedDay);
    const [usageDoc, totalDoc, todayDoc] = await Promise.all([
      transaction.get(usageRef), transaction.get(totalRef),
      billedDay === window.day ? null : transaction.get(todayRef),
    ]);
    const used = safeCount(usageDoc.data()?.used);
    const reservations = currentReservations(usageDoc.data()?.reservations, now);
    if (!reservations[requestId] || used >= LESSON_AI_LIMIT) {
      throw new LessonAiQuotaError('aborted', 'The lesson generation reservation expired. Please try again.');
    }
    delete reservations[requestId];
    const nextUsed = used + 1;
    transaction.set(usageRef, { used: nextUsed, reservations, updatedAt: new Date(now).toISOString() });
    // Keep the existing platform-admin lifetime total separate from daily limits.
    transaction.set(totalRef, { used: safeCount(totalDoc.data()?.used) + 1, updatedAt: new Date(now).toISOString() }, { merge: true });
    transaction.set(requestRef, { status: 'succeeded', contextHash, schoolId: request.schoolId, quotaDay: billedDay, result, completedAt: new Date(now).toISOString() });
    const today = todayDoc?.data();
    return { result, quota: billedDay === window.day ? quotaView(nextUsed, reservations, window)
      : quotaView(safeCount(today?.used), currentReservations(today?.reservations, now), window) };
  });
}

export async function releaseLessonAiQuota(db, { uid, requestId, contextHash, now = Date.now() }) {
  const requestRef = db.doc(`lessonAiUsage/${uid}/requests/${requestId}`);
  await db.runTransaction(async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (requestDoc.data()?.status !== 'inProgress' || requestDoc.data()?.contextHash !== contextHash) return;
    const usageRef = dailyRef(db, uid, requestDay(requestDoc.data(), dayAt(now)));
    const usageDoc = await transaction.get(usageRef);
    const reservations = currentReservations(usageDoc.data()?.reservations, now);
    delete reservations[requestId];
    transaction.set(usageRef, { used: safeCount(usageDoc.data()?.used), reservations, updatedAt: new Date(now).toISOString() });
    transaction.delete(requestRef);
  });
}
