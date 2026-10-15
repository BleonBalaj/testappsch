import { createHash } from 'node:crypto';

const ORIGIN = 'https://dukagjinibotime.com';
const CATALOG = '/kategoria/botime-shkollore/librat-per-mesimedhenes';
// This file host is linked by the publisher's current book pages.
const PDF_HOSTS = new Set(['dukagjinibotime.com', 'www.dukagjinibotime.com', 'lightseagreen-narwhal-999006.hostingersite.com']);
const CACHE_VERSION = 2;
const DAY = 86400000;
const memory = new Map();
const pending = new Map();
const bookMemory = new Map();
const bookPending = new Map();
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const SUBJECTS = [
  ['Matematikë', ['matematike', 'matematika', 'mathematics', 'math', 'maths']],
  ['Gjuhë shqipe', ['gjuhe shqipe', 'gjuha shqipe', 'albanian', 'albanian language', 'abetare']],
  ['Njeriu dhe natyra', ['njeriu dhe natyra', 'man and nature', 'nature and society']],
  ['Shoqëria dhe mjedisi', ['shoqeria dhe mjedisi', 'society and environment']],
  ['Edukatë figurative', ['edukate figurative', 'edukata figurative', 'art', 'visual arts', 'figurative art']],
  ['Edukatë muzikore', ['edukate muzikore', 'edukata muzikore', 'music']],
  ['Edukatë fizike', ['edukate fizike', 'edukata fizike', 'edukate fizike sportet dhe shendeti', 'physical education', 'pe']],
  ['Shkathtësi për jetë', ['shkathtesi per jete', 'life skills']],
  ['Biologji', ['biologji', 'biologjia', 'biology']], ['Fizikë', ['fizike', 'fizika', 'physics']],
  ['Kimi', ['kimi', 'kimia', 'chemistry']], ['Histori', ['histori', 'historia', 'history']],
  ['Gjeografi', ['gjeografi', 'gjeografia', 'geography']], ['Edukatë qytetare', ['edukate qytetare', 'civic education', 'civics']],
  ['TIK', ['tik', 'ict', 'information and communication technology']], ['Teknologji', ['teknologji', 'teknologjia', 'technology']],
];

export function teacherGuideSubject(subject) {
  return SUBJECTS.find(([, aliases]) => aliases.includes(normalize(subject)))?.[0] || null;
}

function anchors(html) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(match => ({
    url: new URL(match[1].replace(/&amp;/g, '&'), ORIGIN).href,
    title: match[2].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(),
  }));
}

export function selectTeacherGuide(html, subject, grade) {
  const canonical = teacherGuideSubject(subject);
  if (!canonical || !Number.isInteger(grade) || grade < 1 || grade > 12) return null;
  const aliases = SUBJECTS.find(([name]) => name === canonical)[1];
  const matches = anchors(html).filter(book => {
    const url = new URL(book.url);
    if (url.origin !== ORIGIN || !url.pathname.startsWith('/libra/')) return false;
    const title = normalize(book.title);
    const numbers = title.match(/\b\d+\b/g) || [];
    if (!numbers.includes(String(grade)) && !(grade === 1 && title.startsWith('abetare'))) return false;
    // A science course is not automatically the primary-school nature subject.
    return aliases.some(alias => title.startsWith(`${alias} `) || title === alias || (alias === 'abetare' && grade === 1 && title.startsWith(alias)));
  });
  const unique = [...new Map(matches.map(book => [book.url, book])).values()];
  // Different upper-secondary tracks/editions must not be chosen arbitrarily.
  return unique.length === 1 ? { ...unique[0], subject: canonical, grade } : null;
}

export function trustedGuidePdf(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && PDF_HOSTS.has(parsed.hostname) && !parsed.username && !parsed.password && !parsed.port && /^\/wp-content\/uploads\/.+\.pdf$/i.test(parsed.pathname);
  } catch { return false; }
}

export function guidePdfFromPage(html) {
  const urls = html.replace(/\\\//g, '/').match(/https:\/\/[^\s"<>\\]+\.pdf/gi) || [];
  return [...new Set(urls)].find(trustedGuidePdf) || null;
}

export function selectGuidePassages(pages, lessonUnit) {
  const terms = [...new Set(normalize(lessonUnit).split(' ').filter(term => term.length >= 4 && !['mesimore', 'njesia', 'tema', 'lesson', 'unit', 'chapter'].includes(term)).map(term => term.slice(0, 6)))];
  if (!terms.length) return [];
  const ranked = pages.map((content, index) => {
    const normalized = normalize(content);
    const hits = terms.filter(term => normalized.includes(term));
    const isIndex = /permbajtja|tabela e permbajtjes|te dashur mesues|parathenie|udherrefyes|konceptimin e mesimeve/.test(normalized.slice(0, 300));
    const heading = normalized.slice(0, 450);
    const headingMatches = heading.includes(normalize(lessonUnit)) || terms.filter(term => heading.includes(term)).length >= Math.min(2, terms.length);
    const score = hits.length >= Math.min(2, terms.length) && headingMatches && content.length > 160 && !isIndex
      ? hits.length * 4 + (normalized.includes(normalize(lessonUnit)) ? 12 : 0) : 0;
    return { index, score };
  }).filter(page => page.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  if (!ranked.length) return [];
  const selected = new Set();
  for (const { index } of ranked.slice(0, 3)) {
    selected.add(index);
    if (index + 1 < pages.length && selected.size < 6) selected.add(index + 1);
  }
  return [...selected].sort((a, b) => a - b).slice(0, 6).filter(index => pages[index]?.trim()).map(index => ({ page: index + 1, text: pages[index].slice(0, 3000) }));
}

async function boundedFetch(url, { fetchImpl, signal, range, limit = 2000000 }) {
  const isCatalog = new URL(url).origin === ORIGIN;
  if (!isCatalog && !trustedGuidePdf(url)) throw new Error('Untrusted guide URL.');
  let current = url;
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetchImpl(current, { signal, redirect: 'manual', headers: range ? { Range: `bytes=${range[0]}-${range[1] - 1}` } : {} });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = new URL(response.headers.get('location'), current).href;
      if (range ? !trustedGuidePdf(next) : new URL(next).origin !== ORIGIN) throw new Error('Untrusted guide redirect.');
      await response.body?.cancel(); current = next; continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Guide unavailable (${response.status}).`); }
    if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new Error('Guide exceeds download budget.'); }
    const reader = response.body.getReader();
    const chunks = []; let length = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); throw new Error('Guide exceeds download budget.'); }
      chunks.push(value);
    }
    const data = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    return { data, status: response.status, headers: response.headers };
  }
  throw new Error('Too many guide redirects.');
}

async function extractGuidePages(url, options) {
  // Range reads extract selectable text without downloading large page images.
  const { getResolvedPDFJS } = await import('unpdf');
  const { getDocument, PDFDataRangeTransport } = await getResolvedPDFJS();
  const chunkSize = 262144;
  const first = await boundedFetch(url, { ...options, range: [0, chunkSize], limit: 20000000 });
  if (new TextDecoder().decode(first.data.slice(0, 5)) !== '%PDF-') throw new Error('The guide is not a PDF.');
  const total = Number(first.headers.get('content-range')?.match(/\/(\d+)$/)?.[1] || first.data.length);
  let downloaded = first.data.length; let task;
  const tailStart = Math.max(chunkSize, Math.floor((total - 2097152) / chunkSize) * chunkSize);
  const tail = first.status === 206 && total > 2 * chunkSize
    ? await boundedFetch(url, { ...options, range: [tailStart, total], limit: 2400000 }) : null;
  downloaded += tail?.data.length || 0;
  class GuideRange extends PDFDataRangeTransport {
    requestDataRange(begin, end) {
      if (tail?.status === 206 && begin >= tailStart && end <= total) {
        queueMicrotask(() => this.onDataRange(begin, tail.data.slice(begin - tailStart, end - tailStart)));
        return;
      }
      downloaded += end - begin;
      if (downloaded > 32000000) { void task.destroy(); return; }
      boundedFetch(url, { ...options, range: [begin, end], limit: end - begin }).then(result => {
        if (result.status !== 206 || result.data.length !== end - begin || !result.headers.get('content-range')?.startsWith(`bytes ${begin}-${end - 1}/`)) throw new Error('Guide range read failed.');
        this.onDataRange(begin, result.data);
      }).catch(() => { void task.destroy(); });
    }
    abort() { /* The parent signal cancels all outstanding HTTP requests. */ }
  }
  const params = first.status === 206 && total > first.data.length
    ? { range: new GuideRange(total, first.data), length: total, rangeChunkSize: chunkSize, disableAutoFetch: true, disableStream: true }
    : { data: first.data };
  task = getDocument({ ...params, useSystemFonts: true, isEvalSupported: false, verbosity: 0 });
  const stop = () => { void task.destroy(); };
  options.signal?.addEventListener('abort', stop, { once: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 500) throw new Error('The guide has too many pages.');
    const pages = Array.from({ length: pdf.numPages }, (_, index) => options.previousPages?.[index] || '');
    let firstMatch = -1;
    for (let index = 1; index <= pdf.numPages; index++) {
      options.signal?.throwIfAborted();
      if (pages[index - 1]) continue;
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      pages[index - 1] = content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('').slice(0, 15000);
      page.cleanup();
      // Stop after the matching lesson and its continuation, rather than read
      // hundreds of unrelated lessons and large embedded images every time.
      if (firstMatch < 0 && selectGuidePassages([pages[index - 1]], options.unit).length) firstMatch = index;
      if (firstMatch > 0 && index >= firstMatch + 1) break;
    }
    return pages;
  } finally { options.signal?.removeEventListener('abort', stop); await task.destroy(); }
}

async function cachedGuidePages(url, options) {
  const cached = bookMemory.get(url);
  if (cached?.expiresAt > Date.now() && selectGuidePassages(cached.pages, options.unit).length) return cached.pages;
  const pendingKey = `${url}:${normalize(options.unit)}`;
  if (bookPending.has(pendingKey)) return bookPending.get(pendingKey);
  let stop;
  const aborted = new Promise((_, reject) => {
    stop = () => reject(new Error('Guide lookup cancelled.'));
    options.signal?.addEventListener('abort', stop, { once: true });
  });
  const operation = Promise.race([extractGuidePages(url, { ...options, previousPages: cached?.pages }), aborted]).then(pages => {
    if (bookMemory.size >= 4) bookMemory.delete(bookMemory.keys().next().value);
    bookMemory.set(url, { pages, expiresAt: Date.now() + DAY });
    return pages;
  });
  bookPending.set(pendingKey, operation);
  try { return await operation; } finally { options.signal?.removeEventListener('abort', stop); bookPending.delete(pendingKey); }
}

async function discoverGuide(context, options) {
  const paths = context.grade <= 5
    ? [`${CATALOG}/arsimi-fillor-librat-per-mesimdhenes/libri-i-mesuesit-klasa-${context.grade}`]
    : [`${CATALOG}/${context.grade <= 9 ? 'shkollimi-i-mesem-i-ulet-librat-per-mesimdhenes' : 'arsimi-i-mesem-i-larte'}`];
  const index = await boundedFetch(`${ORIGIN}${paths[0]}`, options);
  let html = new TextDecoder().decode(index.data);
  // Secondary categories can contain links to individual grade catalogs.
  const gradeCatalog = anchors(html).find(link => new URL(link.url).origin === ORIGIN && link.url.includes(`${CATALOG}/`) && new RegExp(`klasa-${context.grade}$`).test(link.url));
  if (gradeCatalog) html = new TextDecoder().decode((await boundedFetch(gradeCatalog.url, options)).data);
  const book = selectTeacherGuide(html, context.subject, context.grade);
  if (!book) return { status: 'not-found', publisher: 'Dukagjini Botime', passages: [] };
  const detail = new TextDecoder().decode((await boundedFetch(book.url, options)).data);
  const pdfUrl = guidePdfFromPage(detail);
  if (!pdfUrl) return { status: 'not-found', publisher: 'Dukagjini Botime', title: book.title, url: book.url, passages: [] };
  let unit = context.lessonUnit;
  if ((context.outputLanguage === 'English' || !/[ëç]/i.test(context.lessonUnit)) && options.translateUnit) {
    try { unit = await options.translateUnit(context) || unit; } catch { /* Retain the original unit when translation is unavailable. */ }
  }
  const pages = await (options.extractPages || cachedGuidePages)(pdfUrl, { ...options, unit });
  const passages = selectGuidePassages(pages, unit);
  return { status: passages.length ? 'matched' : 'no-unit-match', publisher: 'Dukagjini Botime', title: book.title, url: book.url, pdfUrl, grade: context.grade, subject: book.subject, passages };
}

export async function getTeacherGuideContext(context, { db, fetchImpl = globalThis.fetch, signal, now = Date.now(), extractPages, translateUnit } = {}) {
  if (!teacherGuideSubject(context.subject)) return { status: 'not-found', publisher: 'Dukagjini Botime', passages: [] };
  // Public reference cache never contains names, notes, school IDs, or pupil data.
  const key = createHash('sha256').update(JSON.stringify([CACHE_VERSION, teacherGuideSubject(context.subject), context.grade, normalize(context.lessonUnit)])).digest('hex');
  const cached = memory.get(key);
  if (cached?.expiresAt > now) return cached.reference;
  if (pending.has(key)) return pending.get(key);
  const lookup = (async () => {
    const ref = db?.collection('lessonGuideCache').doc(key);
    try {
      const stored = (await ref?.get())?.data();
      if (stored?.version === CACHE_VERSION && stored.expiresAt > now) return stored.reference;
    } catch { /* A cache outage must not prevent generating a lesson. */ }
    let reference;
    const controller = new AbortController();
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    let timeout;
    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(() => { controller.abort(); reject(new Error('Guide lookup timed out.')); }, 55000);
    });
    try { reference = await Promise.race([discoverGuide(context, { fetchImpl, signal: combined, extractPages, translateUnit }), deadline]); }
    catch { reference = { status: 'unavailable', publisher: 'Dukagjini Botime', passages: [] }; }
    finally { clearTimeout(timeout); }
    signal?.throwIfAborted();
    const expiresAt = now + (reference.status === 'matched' ? 7 * DAY : reference.status === 'unavailable' ? 15 * 60000 : DAY);
    if (memory.size >= 100) memory.delete(memory.keys().next().value);
    memory.set(key, { expiresAt, reference });
    try { await ref?.set({ version: CACHE_VERSION, reference, expiresAt }); }
    catch { /* The in-process cache is sufficient if cloud caching fails. */ }
    return reference;
  })();
  pending.set(key, lookup);
  try { return await lookup; } finally { pending.delete(key); }
}

export function guideSourceSummary(reference) {
  return Object.fromEntries(Object.entries({
    status: reference?.status || 'not-found', publisher: 'Dukagjini Botime',
    title: reference?.title, url: reference?.url, pdfUrl: reference?.pdfUrl,
    grade: reference?.grade, pages: reference?.passages?.map(passage => passage.page) || [],
  }).filter(([, value]) => value !== undefined));
}
