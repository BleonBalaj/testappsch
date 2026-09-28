// Mirrors PLATFORM_ADMIN_EMAILS in functions/platformAdmin.js. This copy only
// decides what the browser renders; the Cloud Function enforces access and
// Firestore rules give this email nothing extra.
export const PLATFORM_ADMIN_EMAILS = Object.freeze(['admin@bleon.com']);

export function isPlatformAdminEmail(email) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return Boolean(normalized) && PLATFORM_ADMIN_EMAILS.includes(normalized);
}
