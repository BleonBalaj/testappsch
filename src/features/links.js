// Links on materials open in a new tab, so only web links are allowed.

/** A stored value that is safe to use as an href, or '' when it is not a web link. */
export function safeWebLink(value) {
  const text = String(value ?? '').trim();
  return /^https?:\/\/\S+$/i.test(text) && text.length <= 2048 ? text : '';
}

/**
 * Cleans a link typed by a teacher. "drive.google.com/x" becomes
 * "https://drive.google.com/x"; other schemes (javascript:, data:) are refused.
 */
export function normalizeWebLink(value) {
  const text = String(value ?? '').trim();
  if (!text) return { url: '', error: '' };
  if (/^https?:\/\//i.test(text)) return safeWebLink(text) ? { url: text, error: '' } : { url: '', error: 'invalid' };
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return { url: '', error: 'scheme' };
  const withScheme = `https://${text.replace(/^\/+/, '')}`;
  return /^https:\/\/[^\s/]+\.[^\s/]+/i.test(withScheme) && safeWebLink(withScheme) ? { url: withScheme, error: '' } : { url: '', error: 'invalid' };
}
