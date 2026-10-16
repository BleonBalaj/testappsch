import test from 'node:test';
import assert from 'node:assert/strict';
import { observeNatureGlassEntries } from './nature-glass-entry.js';

// Exercise animation ownership and event ordering without a browser renderer.
// In particular, native finish can precede Motion's final inline style write.
function environment() {
  const saved = new Map(['CSS', 'HTMLElement', 'KeyframeEffect', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const observers = new Set(), frames = new Map(), registrations = [];
  let frameId = 0;
  class Element {
    constructor(className = '', opacity = '') {
      this.className = className; this.parentElement = null; this.children = [];
      this.dataset = {}; this.properties = new Map(); this.animations = []; this.mirrors = [];
      this.style = { opacity, setProperty: (key, value) => this.properties.set(key, value), removeProperty: key => this.properties.delete(key) };
    }
    append(child) { child.parentElement = this; this.children.push(child); return child; }
    remove(child) { this.children = this.children.filter(node => node !== child); child.parentElement = null; }
    matches(selector) { return selector.split(',').some(value => value.trim() === `.${this.className}`); }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    contains(other) { for (let node = other; node; node = node.parentElement) if (node === this) return true; return false; }
    getAnimations() { return this.animations.filter(animation => animation.playState !== 'idle'); }
    animate(keyframes, timing) { const animation = new Animation(keyframes, timing); this.animations.push(animation); this.mirrors.push(animation); return animation; }
  }
  class Effect {
    constructor(keyframes, timing) { this.keyframes = keyframes; this.timing = timing; }
    getKeyframes() { return this.keyframes; }
    getTiming() { return this.timing; }
  }
  class Animation extends EventTarget {
    constructor(keyframes, timing = { duration: 400, delay: 0, easing: 'ease-out', fill: 'both' }) {
      super(); this.effect = new Effect(keyframes, timing); this.playState = 'running';
      this.playbackRate = 1; this.startTime = 12; this.currentTime = 90; this.pending = false; this.cancels = 0;
    }
    pause() { this.playState = 'paused'; }
    cancel() { this.cancels++; this.playState = 'idle'; this.dispatchEvent(new Event('cancel')); }
    finish() { this.playState = 'finished'; this.dispatchEvent(new Event('finish')); }
  }
  class Observer {
    constructor(callback) { this.callback = callback; observers.add(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { observers.delete(this); }
  }
  Object.assign(globalThis, {
    CSS: { registerProperty: descriptor => registrations.push(descriptor) },
    HTMLElement: Element, KeyframeEffect: Effect, MutationObserver: Observer,
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const native = (element, keyframes = [{ opacity: '0', offset: 0 }, { opacity: '1', offset: 1 }], timing) => {
    const animation = new Animation(keyframes, timing); element.animations.push(animation); return animation;
  };
  const styles = element => { for (const observer of [...observers]) if (observer.target === element && observer.options.attributes) observer.callback([]); };
  const tree = (root, addedNodes = [], removedNodes = []) => { for (const observer of [...observers]) if (observer.target === root && observer.options.childList) observer.callback([{ addedNodes, removedNodes }]); };
  const flushFrames = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); };
  const factor = element => [...element.properties.keys()].find(key => key.startsWith('--noesis-nature-entry-'));
  const restore = () => { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } };
  return { Element, native, styles, tree, flushFrames, factor, registrations, observers, frames, restore };
}

test('nested page, grid and card fades use distinct inherited factors without replacing card opacity animations', () => {
  const env = environment(); let stop;
  try {
    const root = new env.Element(), page = root.append(new env.Element('page', '0'));
    const grid = page.append(new env.Element('grid', '0')), card = grid.append(new env.Element('staff-card', '0'));
    const sources = [page, grid, card].map((node, index) => env.native(node, undefined, { duration: 300 + index * 100, delay: index * 80, easing: 'ease-out', fill: 'both' }));
    stop = observeNatureGlassEntries(root); env.flushFrames();
    const variables = [page, grid, card].map(node => env.factor(node));
    assert.equal(new Set(variables).size, 3);
    for (const [index, node] of [page, grid, card].entries()) {
      assert.equal(node.mirrors.length, 1);
      const mirror = node.mirrors[0];
      assert.deepEqual(mirror.effect.getTiming(), sources[index].effect.getTiming());
      assert.equal(mirror.startTime, sources[index].startTime);
      assert.equal(mirror.effect.getKeyframes()[0][variables[index]], '0');
      assert.ok(mirror.effect.getKeyframes().every(frame => frame.opacity === undefined));
      assert.equal(sources[index].cancels, 0);
    }
    for (const variable of variables) assert.ok(card.properties.get('--nature-glass-entry-opacity').includes(variable));
    assert.equal(card.dataset.natureGlassCard, 'true');
    assert.equal(card.dataset.natureGlassEntry, undefined, 'the card must use the composed factor, not a forced opacity of one');
    assert.equal(grid.dataset.natureGlassEntry, 'true');
    assert.ok(env.registrations.every(property => property.syntax === '<number>' && property.inherits && property.initialValue === '1'));
  } finally { stop?.(); env.restore(); }
});

test('finish before inline acknowledgement cannot blank the page, including later transform style writes', () => {
  const env = environment(); let stop;
  try {
    const root = new env.Element(), page = root.append(new env.Element('page', '0'));
    page.append(new env.Element('content-card'));
    const source = env.native(page); stop = observeNatureGlassEntries(root);
    const variable = env.factor(page); source.finish();
    assert.equal(page.style.opacity, '0', 'reproduce the stale Motion inline value');
    assert.equal(page.properties.get(variable), '1');
    env.styles(page); env.flushFrames(); env.styles(page);
    assert.equal(page.properties.get(variable), '1', 'stale inline zero cannot replace the finished endpoint');
    page.style.opacity = '1'; env.styles(page);
    page.style.opacity = '.35'; env.styles(page);
    assert.equal(page.properties.get(variable), '.35', 'later JS opacity updates remain live after acknowledgement');
    assert.equal(page.mirrors[0].cancels, 1);
  } finally { stop?.(); env.restore(); }
});

test('JavaScript driven fades seed hidden cards and multiply with their parent without a visible initial frame', () => {
  const env = environment(); let stop;
  try {
    const root = new env.Element(), page = root.append(new env.Element('page', '0'));
    const card = page.append(new env.Element('student-card', '0'));
    stop = observeNatureGlassEntries(root);
    const own = env.factor(card);
    assert.equal(card.properties.get(own), '0');
    page.style.opacity = '.25'; env.styles(page);
    card.style.opacity = '.4'; env.styles(card);
    assert.equal(page.properties.get(env.factor(page)), '.25');
    assert.equal(card.properties.get(own), '.4');
    assert.equal(card.properties.get('--nature-glass-entry-opacity').match(/var\(/g).length, 2);
    assert.equal(card.mirrors.length, 0);
  } finally { stop?.(); env.restore(); }
});

test('cards added during an active fade inherit its timeline without restarting it', () => {
  const env = environment(); let stop;
  try {
    const root = new env.Element(), page = root.append(new env.Element('page', '0'));
    page.append(new env.Element('class-card'));
    const source = env.native(page); stop = observeNatureGlassEntries(root);
    const mirror = page.mirrors[0]; mirror.currentTime = 170;
    const late = page.append(new env.Element('class-card'));
    env.tree(root, [late]);
    assert.equal(page.mirrors.length, 1);
    assert.equal(mirror.currentTime, 170);
    assert.equal(late.mirrors.length, 0);
    assert.ok(late.properties.get('--nature-glass-entry-opacity').includes(env.factor(page)));
    source.finish(); assert.equal(page.properties.get(env.factor(page)), '1');
  } finally { stop?.(); env.restore(); }
});

test('interrupted, paused and reversed animations retain source timing and settle on the correct endpoint', () => {
  const env = environment(); let stop;
  try {
    const root = new env.Element(), page = root.append(new env.Element('page', '0'));
    page.append(new env.Element('settings-section'));
    const first = env.native(page); stop = observeNatureGlassEntries(root);
    const next = env.native(page, [{ opacity: '.4', offset: 0 }, { opacity: '1', offset: 1 }]);
    next.playbackRate = -1; next.startTime = null; next.currentTime = 120; next.pause();
    first.cancel();
    assert.equal(page.mirrors.length, 2);
    assert.equal(page.mirrors[0].cancels, 1);
    assert.equal(page.mirrors[1].playbackRate, -1);
    assert.equal(page.mirrors[1].currentTime, 120);
    assert.equal(page.mirrors[1].playState, 'paused');
    next.finish(); env.styles(page);
    assert.equal(page.properties.get(env.factor(page)), '.4');
  } finally { stop?.(); env.restore(); }
});

test('removed routes and theme cleanup cancel only mirrors and recycle registered properties', () => {
  const env = environment(); let stop;
  try {
    const root = new env.Element(), page = root.append(new env.Element('page', '0'));
    const card = page.append(new env.Element('resource-card', '0'));
    const native = [env.native(page), env.native(card)]; stop = observeNatureGlassEntries(root);
    const slots = [env.factor(page), env.factor(card)].sort();
    root.remove(page); env.tree(root, [], [page]);
    assert.ok(native.every(source => source.cancels === 0));
    assert.ok([page, card].every(node => node.mirrors[0].cancels === 1));
    assert.deepEqual(card.dataset, {}); assert.equal(card.properties.size, 0);
    const next = root.append(new env.Element('page', '0'));
    const nextCard = next.append(new env.Element('resource-card', '0'));
    env.native(next); env.native(nextCard); const registered = env.registrations.length;
    env.tree(root, [next]);
    assert.deepEqual([env.factor(next), env.factor(nextCard)].sort(), slots);
    assert.equal(env.registrations.length, registered, 'route changes do not grow the global property registry');
    stop(); stop = undefined;
    assert.equal(env.observers.size, 0); assert.equal(env.frames.size, 0);
    assert.deepEqual(nextCard.dataset, {}); assert.equal(nextCard.properties.size, 0);
  } finally { stop?.(); env.restore(); }
});

test('missing typed animation support leaves native animations and DOM untouched', () => {
  const env = environment();
  try {
    const root = new env.Element(), card = root.append(new env.Element('stat-card', '0'));
    const source = env.native(card); delete globalThis.CSS.registerProperty;
    const stop = observeNatureGlassEntries(root); stop();
    assert.equal(env.observers.size, 0); assert.equal(card.mirrors.length, 0);
    assert.deepEqual(card.dataset, {}); assert.equal(card.properties.size, 0); assert.equal(source.cancels, 0);
  } finally { env.restore(); }
});
