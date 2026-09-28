import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Turns an unexpected server error into one the app can show. Without this the
 * browser only ever sees a bare "INTERNAL", and the cause is only in the logs.
 */
export function toClientError(error) {
  if (error instanceof HttpsError) return error;
  const code = typeof error?.code === 'string' || typeof error?.code === 'number' ? String(error.code) : '';
  const message = typeof error?.message === 'string' ? error.message.replace(/\s+/g, ' ').trim() : '';
  const detail = [code, message].filter(Boolean).join(': ').slice(0, 300);
  return new HttpsError('internal', `The server could not finish this request${detail ? ` (${detail})` : ''}.`);
}

/** Runs a callable body, logging unexpected errors with context before reporting them. */
export async function reportErrors(name, request, run) {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof HttpsError)) {
      const { error: logError } = await import('firebase-functions/logger');
      logError(`${name} failed`, {
        callerUid: request.auth?.uid || null,
        schoolId: typeof request.data?.schoolId === 'string' ? request.data.schoolId : null,
        code: error?.code ?? null,
        message: error?.message ?? String(error),
        stack: error?.stack ?? null,
      });
    }
    throw toClientError(error);
  }
}
