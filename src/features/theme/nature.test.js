import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { natureSeasonAt, naturePhaseIndexAt, createNaturePhaseTransition, resolveNatureSeason, resolveNaturePhase } from './nature-phase.js';
import { NATURE_SURFACES } from './surfaces.js';

test('Nature Auto uses the same local seasons and time boundaries as Horizon', () => {
  for (let month = 0; month < 12; month++) {
    const date = new Date(2026, month, 15, 12);
    assert.equal(natureSeasonAt(date), month < 2 || month === 11 ? 'winter' : month >= 8 ? 'autumn' : 'summer');
    assert.equal(resolveNatureSeason('auto', date), natureSeasonAt(date));
    assert.equal(resolveNatureSeason('summer', date), 'summer');
  }
  for (const [hour, index] of [[0, 2], [5, 2], [6, 0], [16, 0], [17, 1], [19, 1], [20, 2], [23, 2]]) {
    const date = new Date(2026, 5, 1, hour);
    assert.equal(naturePhaseIndexAt(date), index);
    assert.equal(resolveNaturePhase('auto', date), index);
  }
  const transition = createNaturePhaseTransition(0);
  assert.equal(transition.change(2, 0), 4800);
  const interrupted = transition.valueAt(1200);
  transition.change(1, 1200);
  assert.equal(transition.valueAt(1200), interrupted);
  assert.equal(transition.valueAt(10000), 1);
});

test('all Nature styling is scoped, screen-only, and leaves lesson paper and print rules intact', () => {
  const load = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  for (const file of ['./nature-reference.css', './nature.css']) {
    const root = postcss.parse(load(file));
    root.walkRules(rule => {
      for (const selector of postcss.list.comma(rule.selector)) assert.ok(selector.startsWith('html.theme-nature'), selector);
      assert.ok(!rule.selector.includes('.lesson-document') || rule.selector.includes(':not(:where(.lesson-document'), 'Nature cannot directly style lesson paper');
    });
  }
  const adapter = postcss.parse(load('./nature.css'));
  assert.equal(adapter.first.name, 'import');
  assert.match(adapter.first.params, /screen$/);
  adapter.walkRules(rule => {
    let parent = rule.parent;
    while (parent && !(parent.type === 'atrule' && parent.name === 'media' && parent.params === 'screen')) parent = parent.parent;
    assert.ok(parent, 'Every adapter rule must be screen-only');
  });
  const original = load('../../pages/LessonPlans.css');
  assert.match(original, /\.lesson-document\s*\{[^}]*background:\s*#fff;/);
  assert.match(original, /\.lesson-document-header h2\s*\{\s*color:\s*#1e40af;/);
  assert.ok(!NATURE_SURFACES.includes('.lesson-document'));
  const chrome = postcss.parse(load('../../components/theme/ThemePicker.css'));
  const hiddenInPrint = new Set();
  chrome.walkAtRules('media', media => {
    if (media.params === 'print') media.walkRules(rule => {
      if (rule.nodes.some(node => node.prop === 'display' && node.value === 'none' && node.important)) {
        postcss.list.comma(rule.selector).forEach(selector => hiddenInPrint.add(selector));
      }
    });
  });
  for (const selector of ['.nature-scene-frame', '.nature-top-fade', '.nature-bottom-fade', '.nature-performance-notice']) assert.ok(hiddenInPrint.has(selector), `${selector} must never enter lesson print layout`);
});

test('every Nature scene import resolves locally and frozen-frame protections are present', () => {
  const directory = new URL('../../../public/nature/', import.meta.url);
  const html = fs.readFileSync(new URL('scene.html', directory), 'utf8');
  const map = JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports;
  const resolve = specifier => specifier.startsWith('three/addons/') ? map['three/addons/'] + specifier.slice('three/addons/'.length) : specifier === 'three' ? map.three : specifier;
  for (const match of html.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const specifier = resolve(match[1]);
    assert.ok(!/^https?:/.test(specifier));
    assert.ok(fs.existsSync(new URL(specifier, directory)), specifier);
  }
  const inspect = folder => {
    for (const file of fs.readdirSync(folder, { withFileTypes: true })) {
      const absolute = path.join(folder, file.name);
      if (file.isDirectory()) inspect(absolute);
      else if (file.name.endsWith('.js')) for (const match of fs.readFileSync(absolute, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const specifier = match[1];
        assert.ok(fs.existsSync(specifier.startsWith('.') ? path.resolve(path.dirname(absolute), specifier) : new URL(resolve(specifier), directory)), `${file.name}: ${specifier}`);
      }
    }
  };
  inspect(fileURLToPath(directory));
  assert.match(html, /nature-frozen-frame/);
  assert.match(html, /nature:motion/);
  assert.match(html, /nature:season/);
  assert.match(html, /e\.origin !== location\.origin|event\.origin !== location\.origin/);
});

test('switching away from Nature removes its attributes and restores system theme tracking', async () => {
  const original = Object.fromEntries(['window', 'document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const events = new EventTarget();
  const media = new EventTarget(); media.matches = false;
  const classes = new Set();
  const properties = new Map();
  const storage = new Map([['lumi-theme-mode', 'dark']]);
  const root = { dataset: {}, classList: { toggle: (key, on) => on ? classes.add(key) : classes.delete(key) }, style: { removeProperty: key => properties.delete(key) }, removeAttribute: key => { if (key === 'data-theme') delete root.dataset.theme; } };
  try {
    globalThis.window = Object.assign(events, { matchMedia: () => media });
    globalThis.document = { documentElement: root };
    globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
    const { applyTheme, getThemeMode, observeDeviceTheme } = await import('./themeStore.js');
    const stop = observeDeviceTheme();
    applyTheme('nature');
    assert.equal(getThemeMode(), 'nature');
    assert.ok(classes.has('theme-nature'));
    assert.equal(root.dataset.theme, 'nature');
    assert.ok(['summer', 'autumn', 'winter'].includes(root.dataset.natureSeason));
    assert.ok(['morning', 'golden', 'night'].includes(root.dataset.naturePhase));
    root.dataset.natureTransitioning = 'true';
    properties.set('--nature-phase-duration', '3300ms');
    applyTheme('system');
    assert.ok(!classes.has('theme-nature'));
    assert.equal(root.dataset.naturePhase, undefined);
    assert.equal(root.dataset.natureSeason, undefined);
    assert.equal(root.dataset.natureTransitioning, undefined);
    assert.ok(!properties.has('--nature-phase-duration'));
    assert.equal(root.dataset.theme, undefined);
    media.matches = true; media.dispatchEvent(new Event('change'));
    assert.equal(root.dataset.theme, 'light');
    stop();
    media.matches = false; media.dispatchEvent(new Event('change'));
    assert.equal(root.dataset.theme, 'light');
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
