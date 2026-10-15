import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';

export function passwordRecoveryEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Please enter a valid email address.');
  }
  return email;
}

export function recoveryRateState(previous, now, maximum) {
  const duration = 15 * 60 * 1000;
  const current = previous?.expiresAt > now ? previous : { count: 0, expiresAt: now + duration };
  if (current.count >= maximum) throw new HttpsError('resource-exhausted', 'Too many recovery attempts. Please try again in 15 minutes.');
  return { count: current.count + 1, expiresAt: current.expiresAt };
}

export async function reserveRecoveryCheck(db, email, ip, now = Date.now()) {
  // Fixed hashed document IDs contain no email/IP and reset their counts in place.
  const keys = [
    { value: `ip:${ip}`, maximum: 20 },
    { value: `email:${email}`, maximum: 5 },
  ];
  const refs = keys.map(key => db.doc(`passwordRecoveryLimits/${createHash('sha256').update(key.value).digest('hex')}`));
  await db.runTransaction(async tx => {
    const records = await tx.getAll(...refs);
    const states = records.map((record, index) => recoveryRateState(record.data(), now, keys[index].maximum));
    states.forEach((state, index) => tx.set(refs[index], state));
  });
}

export async function verifyRecoveryAccount(email, auth) {
  let user;
  try { user = await auth.getUserByEmail(email); }
  catch (error) {
    if (error.code === 'auth/user-not-found') throw new HttpsError('not-found', 'Email not found. No account is registered with this email address.');
    // Never turn an outage or Auth configuration failure into "email not found".
    throw new HttpsError('unavailable', 'Could not check your account. Please try again shortly.');
  }
  if (user.disabled) throw new HttpsError('failed-precondition', 'This account is disabled. Please contact your school administrator.');
  // A provisioned account without a password can use reset to set its first one.
  // No roles, memberships, school names, or user records leave this endpoint.
  return { verified: true };
}

export async function checkRecoveryAccount(request) {
  const email = passwordRecoveryEmail(request.data?.email);
  const [{ getAuth }, { getFirestore }, { ensureDefaultApp }] = await Promise.all([
    import('firebase-admin/auth'), import('firebase-admin/firestore'), import('./adminApp.js'),
  ]);
  ensureDefaultApp();
  // Cloud Functions supplies the client address first, followed by proxies.
  // Keep the email limit as well; network addresses may be shared or proxied.
  const forwarded = String(request.rawRequest?.headers?.['x-forwarded-for'] || '').split(',').map(value => value.trim()).filter(Boolean);
  const ip = forwarded[0] || request.rawRequest?.ip || 'unknown';
  await reserveRecoveryCheck(getFirestore(), email, ip);
  return verifyRecoveryAccount(email, getAuth());
}
