import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRelease, isNewerVersion, parseRelease } from './release.js';

test('release comparisons use numeric versions and never prompt for an old CDN response', () => {
  assert.equal(isNewerVersion('2.4.10', '2.4.9'), true);
  assert.equal(isNewerVersion('2.5.0', '2.4.99'), true);
  assert.equal(isNewerVersion('2.4.1', '2.4.1'), false);
  assert.equal(isNewerVersion('2.4.0', '2.4.1'), false);
  for (const malformed of [null, {}, '<html>', '2.4', '2.4.1-preview', 'Infinity.4.1']) {
    assert.equal(parseRelease({ version: malformed }), null);
    assert.equal(isNewerVersion(malformed, '2.4.1'), false);
  }
});

test('release checks bypass caches, propagate cancellation, and reject malformed hosting responses', async () => {
  const controller = new AbortController();
  const release = await fetchRelease({ now: 1234, signal: controller.signal, fetcher: async (url, options) => {
    assert.equal(url, '/version.json?t=1234');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, controller.signal);
    assert.equal(options.headers['Cache-Control'], 'no-cache');
    return { ok: true, json: async () => ({ version: '2.4.2', requiresReload: true }) };
  } });
  assert.equal(release.requiresReload, true);
  await assert.rejects(fetchRelease({ fetcher: async () => ({ ok: false }) }), /failed/);
  await assert.rejects(fetchRelease({ fetcher: async () => ({ ok: true, json: async () => ({}) }) }), /Invalid/);
});
