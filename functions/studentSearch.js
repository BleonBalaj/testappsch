// Search fields stored on each student directory record. Firestore has no
// substring search, so every word (name parts, email, student ID) is stored
// with all of its prefixes and matched with one array-contains query.
// Keep this file identical to its copy in the other package (functions/ and src/features/students/).

export const SEARCH_TOKEN_MAX_LENGTH = 24;
export const SEARCH_TOKENS_LIMIT = 250;

export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function words(value, separators) {
  return normalizeSearchText(value).split(separators).map(word => word.trim()).filter(Boolean);
}

/** The words a student can be found by. */
export function studentSearchWords({ name, email, studentId } = {}) {
  const normalizedEmail = normalizeSearchText(email).replace(/\s/g, '');
  const normalizedId = normalizeSearchText(studentId).replace(/\s/g, '');
  return [...new Set([
    ...words(name, /[\s\-'’.]+/),
    ...(normalizedEmail ? [normalizedEmail, ...words(normalizedEmail.split('@')[0], /[._+\-]+/)] : []),
    ...(normalizedId ? [normalizedId, ...words(normalizedId, /[-_/]+/)] : []),
  ])];
}

export function studentSearchTokens(fields = {}) {
  const tokens = new Set();
  for (const word of studentSearchWords(fields)) {
    const limit = Math.min(word.length, SEARCH_TOKEN_MAX_LENGTH);
    for (let length = 1; length <= limit; length += 1) tokens.add(word.slice(0, length));
    if (tokens.size >= SEARCH_TOKENS_LIMIT) break;
  }
  return [...tokens].slice(0, SEARCH_TOKENS_LIMIT);
}

export function studentSortKey(name) {
  return normalizeSearchText(name).slice(0, 200);
}

/** Fields to store on a student record whenever its name, email or ID changes. */
export function studentSearchFields(fields = {}) {
  return { nameLower: studentSortKey(fields.name), searchTokens: studentSearchTokens(fields) };
}

/** The query words of a search box value. */
export function searchTermWords(term) {
  return words(term, /\s+/).map(word => word.slice(0, 120));
}

/** The single token sent to Firestore: the longest query word, trimmed to the stored length. */
export function searchQueryToken(term) {
  const [longest] = searchTermWords(term).sort((a, b) => b.length - a.length);
  return longest ? longest.slice(0, SEARCH_TOKEN_MAX_LENGTH) : '';
}

/** Every query word must start one of the student's words. */
export function matchesStudentSearch(student, term) {
  const queryWords = searchTermWords(term);
  if (!queryWords.length) return true;
  const candidates = studentSearchWords(student || {});
  return queryWords.every(word => candidates.some(candidate => candidate.startsWith(word)));
}
