import test from 'node:test';
import assert from 'node:assert/strict';
import { createDialogBackgroundManager } from './dialog-background.js';

function style(initial = {}) {
  const values = new Map(Object.entries(initial).map(([name, value]) => [name, { value, priority: '' }]));
  return {
    getPropertyValue: name => values.get(name)?.value || '',
    getPropertyPriority: name => values.get(name)?.priority || '',
    setProperty: (name, value, priority = '') => values.set(name, { value, priority }),
    removeProperty: name => values.delete(name),
  };
}
function fixture() {
  const root = { style: style(), clientWidth: 1420 };
  const body = { style: style({ 'overflow-x': 'hidden' }) };
  const app = { inert: false };
  const calls = [];
  const window = { innerWidth: 1440, scrollX: 0, scrollY: 1800, scrollTo: position => { calls.push(position); window.scrollX = position.left; window.scrollY = position.top; } };
  return { root, body, app, window, calls, document: { documentElement: root, body, getElementById: () => app } };
}

test('a dialog opened deep in the document locks scrolling without giving the sticky sidebar a body scroll container', () => {
  const f = fixture(), manager = createDialogBackgroundManager();
  const release = manager.lock(f.document, f.window);
  assert.equal(f.root.style.getPropertyValue('overflow'), 'hidden');
  assert.equal(f.body.style.getPropertyValue('overflow'), 'clip');
  assert.equal(f.app.inert, true);
  assert.equal(f.root.style.getPropertyValue('scrollbar-gutter'), 'stable');
  assert.equal(f.window.scrollY, 1800);
  release();
  assert.equal(f.root.style.getPropertyValue('overflow'), '');
  assert.equal(f.body.style.getPropertyValue('overflow'), '');
  assert.equal(f.body.style.getPropertyValue('overflow-x'), 'hidden');
  assert.equal(f.root.style.getPropertyValue('scrollbar-gutter'), '');
  assert.equal(f.app.inert, false);
  assert.deepEqual(f.calls, []);
});

test('overlapping dialogs keep the background locked until the final release, including repeated cleanup', () => {
  const f = fixture(), manager = createDialogBackgroundManager();
  const first = manager.lock(f.document, f.window);
  const second = manager.lock(f.document, f.window);
  first(); first();
  assert.equal(f.app.inert, true);
  assert.equal(f.body.style.getPropertyValue('overflow'), 'clip');
  second();
  assert.equal(f.app.inert, false);
  const again = manager.lock(f.document, f.window);
  assert.equal(f.app.inert, true);
  again();
  assert.equal(f.app.inert, false);
});

test('closing restores prior inline priorities, pre-existing inert state, and document position without smooth scrolling', () => {
  const f = fixture(), manager = createDialogBackgroundManager();
  f.app.inert = true;
  f.root.style.setProperty('overflow-y', 'scroll', 'important');
  f.root.style.setProperty('scrollbar-gutter', 'stable both-edges', 'important');
  f.body.style.setProperty('overflow-y', 'visible', 'important');
  const release = manager.lock(f.document, f.window);
  f.window.scrollY = 0;
  release();
  assert.equal(f.root.style.getPropertyValue('overflow-y'), 'scroll');
  assert.equal(f.root.style.getPropertyPriority('overflow-y'), 'important');
  assert.equal(f.root.style.getPropertyValue('scrollbar-gutter'), 'stable both-edges');
  assert.equal(f.root.style.getPropertyPriority('scrollbar-gutter'), 'important');
  assert.equal(f.body.style.getPropertyValue('overflow-y'), 'visible');
  assert.equal(f.body.style.getPropertyPriority('overflow-y'), 'important');
  assert.equal(f.app.inert, true);
  assert.deepEqual(f.calls, [{ left: 0, top: 1800, behavior: 'instant' }]);
});
