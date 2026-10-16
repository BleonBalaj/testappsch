import { NATURE_PHASES, readNaturePhasePref, readNatureSeason, resolveNaturePhase, resolveNatureSeason } from './nature-phase.js';

export const THEME_MODES = ['dark', 'light', 'system', 'nature'];
export const normalizeTheme = value => THEME_MODES.includes(value) ? value : 'system';
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Private storage can be unavailable. */ } };
let currentMode = normalizeTheme(read('lumi-theme-mode') || read('lumi-theme'));

export function getThemeMode() { return currentMode; }

export function applyTheme(value = currentMode, { persist = true } = {}) {
  currentMode = normalizeTheme(value);
  const root = document.documentElement;
  const nature = currentMode === 'nature';
  const phase = NATURE_PHASES[resolveNaturePhase(readNaturePhasePref())];
  const isLight = nature ? phase !== 'night' : currentMode === 'light' ||
    (currentMode === 'system' && !!window.matchMedia?.('(prefers-color-scheme: light)').matches);
  root.classList.toggle('theme-nature', nature);
  if (nature) {
    root.dataset.theme = 'nature';
    root.dataset.naturePhase = phase;
    root.dataset.natureSeason = resolveNatureSeason(readNatureSeason());
  } else {
    if (isLight) root.dataset.theme = 'light';
    else root.removeAttribute('data-theme');
    delete root.dataset.naturePhase;
    delete root.dataset.natureSeason;
    delete root.dataset.natureTransitioning;
    root.style.removeProperty('--nature-phase-duration');
  }
  root.dataset.themeStyle = isLight ? 'light' : 'dark';
  if (persist) {
    write('lumi-theme-mode', currentMode);
    write('lumi-theme', nature ? 'nature' : isLight ? 'light' : 'dark');
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: { mode: currentMode, isLight } }));
}

export function subscribeTheme(listener) {
  window.addEventListener('themechange', listener);
  return () => window.removeEventListener('themechange', listener);
}

export function observeDeviceTheme() {
  const media = window.matchMedia?.('(prefers-color-scheme: light)');
  const system = () => { if (currentMode === 'system') applyTheme('system'); };
  const storage = event => {
    if (event.key === 'lumi-theme-mode' || event.key === null) applyTheme(read('lumi-theme-mode'), { persist: false });
  };
  media?.addEventListener('change', system);
  window.addEventListener('storage', storage);
  return () => { media?.removeEventListener('change', system); window.removeEventListener('storage', storage); };
}
