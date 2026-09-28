import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWebLink, safeWebLink } from './links.js';

test('only http and https links are ever rendered', () => {
  assert.equal(safeWebLink('https://drive.google.com/file/1'), 'https://drive.google.com/file/1');
  assert.equal(safeWebLink('HTTP://example.com'), 'HTTP://example.com');
  assert.equal(safeWebLink('javascript:alert(1)'), '');
  assert.equal(safeWebLink('data:text/html,hi'), '');
  assert.equal(safeWebLink(''), '');
  assert.equal(safeWebLink(null), '');
  assert.equal(safeWebLink('https://exa mple.com'), '');
});

test('typed links gain https and unsafe schemes are refused', () => {
  assert.deepEqual(normalizeWebLink('  drive.google.com/x  '), { url: 'https://drive.google.com/x', error: '' });
  assert.deepEqual(normalizeWebLink('https://youtu.be/abc'), { url: 'https://youtu.be/abc', error: '' });
  assert.deepEqual(normalizeWebLink(''), { url: '', error: '' });
  assert.equal(normalizeWebLink('javascript:alert(1)').error, 'scheme');
  assert.equal(normalizeWebLink('mailto:a@b.c').error, 'scheme');
  assert.equal(normalizeWebLink('not a link').error, 'invalid');
  assert.equal(normalizeWebLink('localhost').error, 'invalid');
});
