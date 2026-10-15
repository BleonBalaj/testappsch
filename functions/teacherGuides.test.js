import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherGuideSubject, selectTeacherGuide, guidePdfFromPage, trustedGuidePdf, selectGuidePassages, getTeacherGuideContext, guideSourceSummary } from './teacherGuides.js';

test('matches exact subject and grade; does not confuse grade 2 with grade 12 or science with biology', () => {
  const html = '<a href="/libra/math-12">MATEMATIKA 12 (LIBRI I MËSUESIT)</a><a href="/libra/math-2">MATEMATIKA 2 (LIBRI I MËSUESIT)</a><a href="https://attacker.example/libra/math-2">MATEMATIKA 2</a>';
  assert.equal(selectTeacherGuide(html, 'Mathematics', 2).url, 'https://dukagjinibotime.com/libra/math-2');
  assert.equal(teacherGuideSubject('Science'), null);
  assert.equal(selectTeacherGuide('<a href="/libra/a">MATEMATIKA 10 – NATYROR</a><a href="/libra/b">MATEMATIKA 10 – SHOQEROR</a>', 'Matematikë', 10), null);
  assert.equal(selectTeacherGuide('<a href="/libra/abetare">ABETARE (LIBËR PËR MËSUESIN/EN)</a>', 'Albanian', 1).grade, 1);
});

test('only reads publisher-hosted PDFs or the file host linked by its catalog', () => {
  assert.equal(trustedGuidePdf('https://attacker.example/book.pdf'), false);
  assert.equal(trustedGuidePdf('https://dukagjinibotime.com.attacker.example/wp-content/uploads/a.pdf'), false);
  assert.equal(trustedGuidePdf('https://dukagjinibotime.com:1234/wp-content/uploads/a.pdf'), false);
  assert.equal(trustedGuidePdf('http://dukagjinibotime.com/wp-content/uploads/a.pdf'), false);
  const url = 'https://lightseagreen-narwhal-999006.hostingersite.com/wp-content/uploads/2025/06/Matematika-2-Libri-i-mesuesit.pdf';
  assert.equal(guidePdfFromPage(`<a href="${url}">Download</a>`), url);
  assert.equal(guidePdfFromPage('<a href="https://attacker.example/a.pdf">Download</a>'), null);
});

test('retrieves matching unit passages with accurate PDF page indexes and skips unrelated text', () => {
  const pages = ['Përmbajtja: Bashkësitë dhe elementet e bashkësive. '.repeat(5), 'Thyesat me emërues të ndryshëm. '.repeat(20), 'Bashkësitë dhe elementet e bashkësive: Nxënësit grupojnë objekte dhe identifikojnë elementet sipas ngjyrës. '.repeat(8), 'Nxënësit tregojnë pse një element i përket grupit. '.repeat(8)];
  const passages = selectGuidePassages(pages, 'Bashkësitë dhe elementet e bashkësive');
  assert.deepEqual(passages.map(p => p.page), [3, 4]);
  assert.deepEqual(selectGuidePassages(pages, 'Energjia elektrike'), []);
  assert.deepEqual(guideSourceSummary({ status: 'matched', title: 'Book', passages }).pages, [3, 4]);
  assert.deepEqual(selectGuidePassages(['Të dashur mësues, ky udhërrëfyes përdor bashkësitë dhe elementet si shembuj. '.repeat(8)], 'Bashkësitë dhe elementet'), []);
});

test('English titles can retrieve Albanian guide passages without changing the selected lesson unit', async () => {
  const context = { subject: 'Mathematics', grade: 3, lessonUnit: 'Sets and their elements test-translation', outputLanguage: 'English' };
  const result = await getTeacherGuideContext(context, { translateUnit: async input => {
    assert.equal(input.lessonUnit, context.lessonUnit); return 'Bashkësitë dhe elementet';
  }, fetchImpl: async url => new Response(url.includes('/libra/') ? 'https://dukagjinibotime.com/wp-content/uploads/math-3.pdf' : '<a href="/libra/math-3">MATEMATIKA 3 (LIBRI I MËSUESIT)</a>'), extractPages: async () => ['Bashkësitë dhe elementet: Nxënësi klasifikon sende sipas një tipari të përbashkët. '.repeat(8)] });
  assert.equal(result.status, 'matched');
  assert.equal(context.lessonUnit, 'Sets and their elements test-translation');
});

test('caches public subject-grade-unit context without sending private teacher fields to the publisher', async () => {
  const context = { subject: 'History', grade: 7, lessonUnit: 'Revolucioni francez test-cache', teacherName: 'Private name', schoolName: 'Private school' };
  const writes = [];
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ data: () => null }), set: async value => writes.push(value) }) }) };
  let reads = 0;
  const fetchImpl = async (url, init) => {
    reads++;
    assert.ok(url.startsWith('https://dukagjinibotime.com/'));
    assert.equal(init.body, undefined);
    return new Response(url.includes('/libra/') ? '<a href="https://dukagjinibotime.com/wp-content/uploads/history.pdf">PDF</a>' : '<a href="/libra/history-7">HISTORIA 7 (LIBRI I MËSUESIT)</a>');
  };
  const extractPages = async () => ['Revolucioni francez test-cache: Shkaqet dhe ndryshimet në shoqëri. '.repeat(8)];
  const first = await getTeacherGuideContext(context, { db, fetchImpl, extractPages });
  assert.equal(first.status, 'matched');
  assert.equal((await getTeacherGuideContext(context, { db, fetchImpl, extractPages })).status, 'matched');
  assert.equal(reads, 2);
  assert.doesNotMatch(JSON.stringify(writes), /Private/);
});

test('a source outage falls back explicitly and blocked redirects are never followed', async () => {
  const urls = [];
  const result = await getTeacherGuideContext({ subject: 'Physics', grade: 8, lessonUnit: 'Test source outage' }, { fetchImpl: async url => {
    urls.push(url); return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
  } });
  assert.equal(result.status, 'unavailable');
  assert.equal(urls.length, 1);
  assert.deepEqual(result.passages, []);
});
