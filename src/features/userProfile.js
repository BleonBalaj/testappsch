/**
 * Fields a users/{uid} profile is missing compared with the signed-in account.
 * Never overwrites values the user chose (name, photo); keeps email in sync
 * with Firebase Auth. Returns null when the profile is already complete.
 */
export function buildProfileBackfill(authUser, existing) {
  if (!authUser?.uid) return null;
  const current = existing || {};
  const email = typeof authUser.email === 'string' ? authUser.email.trim().toLowerCase() : '';
  const fallbackName = current.displayName || current.name || authUser.displayName || (email ? email.split('@')[0] : 'Member');
  const fields = {};
  if (!current.uid) fields.uid = authUser.uid;
  if (email && current.email !== email) fields.email = email;
  if (!current.displayName) fields.displayName = fallbackName;
  if (!current.name) fields.name = fallbackName;
  const needsCreatedAt = !current.createdAt;
  if (!Object.keys(fields).length && !needsCreatedAt) return null;
  return { fields, needsCreatedAt };
}
