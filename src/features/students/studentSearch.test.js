import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  matchesStudentSearch, normalizeSearchText, searchQueryToken, studentSearchFields, studentSearchTokens,
  SEARCH_TOKEN_MAX_LENGTH, SEARCH_TOKENS_LIMIT,
} from './studentSearch.js';

const student = { name: 'Ardit Çeku', email: 'Ardit.Ceku@School.com', studentId: 'STU-1A2B3C4D' };

test('the server copy is identical so stored and queried tokens always agree', () => {
  const client = readFileSync(new URL('./studentSearch.js', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../../../functions/studentSearch.js', import.meta.url), 'utf8');
  assert.equal(server, client);
});

test('normalizing removes accents and case so Albanian names match plain typing', () => {
  assert.equal(normalizeSearchText('  Ëndrit   ÇELA '), 'endrit cela');
  assert.equal(studentSearchFields(student).nameLower, 'ardit ceku');
});

test('every word of the name, the email and the student ID is findable by prefix', () => {
  const tokens = new Set(studentSearchTokens(student));
  for (const token of ['a', 'ard', 'ardit', 'c', 'cek', 'ceku', 'ardit.ceku@school.com', 'stu', 'stu-1a2b', '1a2b3c4d']) {
    assert.ok(tokens.has(token), token);
  }
  assert.ok(!tokens.has('rdit'), 'middle of a word is not a prefix');
  assert.ok([...tokens].every(token => token.length <= SEARCH_TOKEN_MAX_LENGTH));
  assert.ok(tokens.size <= SEARCH_TOKENS_LIMIT);
});

test('the query token is the longest word, so one indexed lookup narrows the most', () => {
  assert.equal(searchQueryToken('  Ard  Çeku '), 'ceku');
  assert.equal(searchQueryToken(''), '');
  assert.equal(searchQueryToken('a'.repeat(40)).length, SEARCH_TOKEN_MAX_LENGTH);
});

test('multi-word searches must match every word, in any order', () => {
  assert.equal(matchesStudentSearch(student, 'çeku ard'), true);
  assert.equal(matchesStudentSearch(student, 'ceku berisha'), false);
  assert.equal(matchesStudentSearch(student, 'stu-1a'), true);
  assert.equal(matchesStudentSearch(student, 'school.com'), false);
  assert.equal(matchesStudentSearch(student, ''), true);
  assert.equal(matchesStudentSearch({}, 'x'), false);
});

test('long emails still match on the stored prefix and the full comparison', () => {
  const long = { name: 'X', email: 'a.very.long.address.for.testing@example-school.org' };
  const token = searchQueryToken(long.email);
  assert.ok(studentSearchTokens(long).includes(token));
  assert.equal(matchesStudentSearch(long, long.email), true);
});
