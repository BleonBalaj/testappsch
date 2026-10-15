// Ported from MomentumHorizon00; see docs/nature-theme.md.
// Nature season, time of day and movement preferences. Stored per device.
// The hour ranges must match the inline script in ThemeInitializer.
export const NATURE_PHASES = ["morning", "golden", "night"];
export const NATURE_PHASE_KEY = "natureThemePhase";
export const NATURE_PHASE_EVENT = "naturePhaseChanged";
export const NATURE_MOTION_KEY = "natureBackgroundPaused";
export const NATURE_MOTION_EVENT = "natureMotionChanged";
export const NATURE_SEASONS = ["summer", "autumn", "winter"];
export const NATURE_SEASON_PREFS = ["auto", ...NATURE_SEASONS];
export const NATURE_SEASON_KEY = "natureThemeSeason";
export const NATURE_SEASON_EVENT = "natureSeasonChanged";
/** Legacy public records keep the original Summer meadow. */
export function normalizeNatureSeason(value) {
    return value === "auto" || value === "autumn" || value === "winter" ? value : "summer";
}
/** Northern calendar; the existing meadow also represents spring. Local date. */
export function natureSeasonAt(date = new Date()) {
    const month = date.getMonth();
    return month === 11 || month < 2 ? "winter" : month >= 8 ? "autumn" : "summer";
}
export function resolveNatureSeason(pref, date) {
    return pref === "auto" ? natureSeasonAt(date) : pref;
}
export function readNatureSeason() {
    if (typeof document !== "undefined") {
        const publicSeason = document.documentElement.dataset.publicNatureSeason;
        if (publicSeason !== undefined)
            return normalizeNatureSeason(publicSeason);
    }
    try {
        const saved = localStorage.getItem(NATURE_SEASON_KEY);
        return NATURE_SEASON_PREFS.some(value => value === saved) ? saved : "auto";
    }
    catch {
        return "auto";
    }
}
export function writeNatureSeason(season) {
    const next = NATURE_SEASON_PREFS.includes(season) ? season : "auto";
    // Manual Summer must remain distinguishable from an unset Auto preference.
    try {
        localStorage.setItem(NATURE_SEASON_KEY, next);
    }
    catch { /* Storage unavailable. */ }
    window.dispatchEvent(new Event(NATURE_SEASON_EVENT));
}
/** Local Nature preference; other themes never consume it. */
export function readNatureMotionPaused() {
    if (typeof document !== "undefined") {
        const { publicNaturePaused, publicNatureAutoPaused } = document.documentElement.dataset;
        if (publicNaturePaused !== undefined)
            return publicNaturePaused === "true" || publicNatureAutoPaused === "true";
    }
    try {
        return localStorage.getItem(NATURE_MOTION_KEY) === "true";
    }
    catch {
        return false;
    }
}
/** Public performance pauses last for the visit and never change app settings. */
export function pauseNatureForPerformance() {
    if (typeof document !== "undefined" && document.documentElement.dataset.publicNaturePaused !== undefined) {
        document.documentElement.dataset.publicNatureAutoPaused = "true";
        window.dispatchEvent(new Event(NATURE_MOTION_EVENT));
    }
    else {
        writeNatureMotionPaused(true);
    }
}
export function writeNatureMotionPaused(paused) {
    try {
        if (paused)
            localStorage.setItem(NATURE_MOTION_KEY, "true");
        else
            localStorage.removeItem(NATURE_MOTION_KEY);
    }
    catch { /* Storage unavailable. */ }
    window.dispatchEvent(new Event(NATURE_MOTION_EVENT));
}
/** Matches the prototype's scene tween, including an interrupted phase change. */
export function createNaturePhaseTransition(initial) {
    let from = initial;
    let target = initial;
    let started = 0;
    let duration = 0;
    const valueAt = (now) => {
        if (!duration)
            return target;
        const k = Math.min(1, Math.max(0, (now - started) / duration));
        const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        return from + (target - from) * eased;
    };
    return {
        valueAt,
        change(next, now) {
            if (next === target)
                return null;
            from = valueAt(now);
            target = next;
            started = now;
            duration = 1800 + 1500 * Math.abs(next - from);
            return duration;
        },
    };
}
export function naturePhaseIndexAt(date = new Date()) {
    const hr = date.getHours();
    return hr >= 20 || hr < 6 ? 2 : hr >= 17 ? 1 : 0;
}
export function readNaturePhasePref() {
    if (typeof document !== "undefined") {
        const pagePref = document.documentElement.dataset.publicNaturePhase;
        if (pagePref === "auto" || pagePref === "morning" || pagePref === "golden" || pagePref === "night")
            return pagePref;
    }
    try {
        const v = localStorage.getItem(NATURE_PHASE_KEY);
        return v === "morning" || v === "golden" || v === "night" ? v : "auto";
    }
    catch {
        return "auto";
    }
}
export function writeNaturePhasePref(pref) {
    pref = ["auto", ...NATURE_PHASES].includes(pref) ? pref : "auto";
    try {
        if (pref === "auto")
            localStorage.removeItem(NATURE_PHASE_KEY);
        else
            localStorage.setItem(NATURE_PHASE_KEY, pref);
    }
    catch { /* Storage unavailable. */ }
    window.dispatchEvent(new Event(NATURE_PHASE_EVENT));
}
/** Morning and golden are light UIs (dark ink on frosted glass); night is dark. */
export function natureThemeStyle(date) {
    return resolveNaturePhase(readNaturePhasePref(), date) === 2 ? "dark" : "light";
}
export function resolveNaturePhase(pref, date) {
    return pref === "auto" ? naturePhaseIndexAt(date) : NATURE_PHASES.indexOf(pref);
}
