import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_PATHS, pageFromLocation, pathForPage, detailParent } from './pageRoutes.js';

test('every page id round-trips through its URL', () => {
  for (const [page, path] of Object.entries(PAGE_PATHS)) {
    const parsed = pageFromLocation(path);
    assert.equal(parsed.page, page === 'teachers' ? 'staff' : page, path);
    assert.equal(pathForPage(page), path);
  }
});

test('the root and legacy links still land where they used to', () => {
  assert.deepEqual(pageFromLocation('/'), { page: 'dashboard' });
  assert.deepEqual(pageFromLocation(''), { page: 'dashboard' });
  assert.deepEqual(pageFromLocation('/index.html'), { page: 'dashboard' });
  assert.deepEqual(pageFromLocation('/teachers'), { page: 'staff' });
  assert.deepEqual(pageFromLocation('/', '#/login'), { page: 'login' });
  assert.deepEqual(pageFromLocation('/messages/'), { page: 'messages' });
});

test('detail pages carry and decode their record id', () => {
  assert.deepEqual(pageFromLocation('/classes/abc123'), { page: 'class-overview', id: 'abc123' });
  assert.deepEqual(pageFromLocation('/students/u%201'), { page: 'student-overview', id: 'u 1' });
  assert.equal(pathForPage('class-overview', 'abc123'), '/classes/abc123');
  assert.equal(pathForPage('student-overview', 'u 1'), '/students/u%201');
  assert.equal(pathForPage('class-overview'), '/classes');
  assert.equal(pathForPage('student-overview', ''), '/students');
  assert.equal(detailParent('class-overview'), 'classes');
  assert.equal(detailParent('messages'), null);
});

test('unknown paths are not pages', () => {
  for (const path of ['/nope', '/classes/a/b', '/admin', '/dashboard/extra', '/students/%E0%A4%A']) {
    assert.equal(pageFromLocation(path), null, path);
  }
  assert.equal(pathForPage('not-a-page'), null);
});
