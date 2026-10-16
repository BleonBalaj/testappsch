import test from 'node:test';
import assert from 'node:assert/strict';
test('a fresh visit selects System, follows the device, and preserves an explicitly chosen theme', async () => {
  const originals = Object.fromEntries(['window', 'document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const media = new EventTarget(); media.matches = false;
  const data = new Map();
  const root = { dataset: {}, classList: { toggle() {} }, style: { removeProperty() {} }, removeAttribute(key) { if (key === 'data-theme') delete this.dataset.theme; } };
  try {
    globalThis.window = Object.assign(new EventTarget(), { matchMedia: () => media });
    globalThis.document = { documentElement: root };
    globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
    const { applyTheme, getThemeMode, observeDeviceTheme } = await import('./themeStore.js');
    assert.equal(getThemeMode(), 'system');
    applyTheme();
    assert.equal(root.dataset.themeStyle, 'dark');
    assert.equal(data.get('lumi-theme-mode'), 'system');
    const stop = observeDeviceTheme();
    media.matches = true; media.dispatchEvent(new Event('change'));
    assert.equal(root.dataset.themeStyle, 'light');
    assert.equal(getThemeMode(), 'system');
    applyTheme('dark');
    media.dispatchEvent(new Event('change'));
    assert.equal(getThemeMode(), 'dark');
    assert.equal(root.dataset.themeStyle, 'dark');
    stop();
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
