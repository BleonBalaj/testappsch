// Ported from MomentumHorizon00; see docs/nature-theme.md.
import { NATURE_SURFACES as SURFACE } from './surfaces.js';
/** Keep the existing page fade, compositing it on glass surfaces so the
 * backdrop doesn't suddenly change when an ancestor reaches opacity 1. */
export function observeNatureGlassEntries(root, isPaused = () => false) {
    const hosts = new Map();
    const targets = new Map();
    let serial = 0;
    const target = (parent, variable) => {
        for (const child of parent.children) {
            if (!(child instanceof HTMLElement))
                continue;
            if (!child.matches(SURFACE) && child.querySelector(SURFACE)) {
                target(child, variable);
                continue;
            }
            const factors = targets.get(child) ?? new Set();
            if (factors.has(variable))
                continue;
            factors.add(variable);
            targets.set(child, factors);
            child.style.setProperty('--nature-glass-entry-opacity', `calc(${[...factors].map(name => `var(${name}, 1)`).join(' * ')})`);
            child.dataset.natureGlassFade = 'true';
            // A card inserted during a running fade must join that same timeline.
            // Otherwise it inherits the mirror's factor of 1 and pops in fully lit.
            if (isPaused())
                for (const entry of hosts.values())
                    if (entry.variable === variable)
                        for (const add of entry.additions)
                            add(child);
        }
    };
    const scan = (node) => {
        const surfaces = [...(node.matches(SURFACE) ? [node] : []), ...node.querySelectorAll(SURFACE)];
        const changed = new Set();
        for (const surface of surfaces)
            for (let host = surface.parentElement; host && host !== root; host = host.parentElement) {
                if (host.matches(SURFACE) || !host.style.opacity)
                    continue;
                changed.add(host);
                if (hosts.has(host))
                    continue;
                const element = host;
                const entry = { observer: null, variable: `--nature-entry-opacity-${serial++}`, last: '', active: false, clones: new Set(), additions: new Set(), settled: null, sources: new WeakSet(), listeners: new Set(), disposed: false, raf: 0 };
                const update = () => {
                    // Once mirrored, native finish/cancel events own the animation's
                    // lifecycle. Transform frames need no repeated animation discovery.
                    if (entry.disposed || entry.clones.size > 0)
                        return;
                    // Motion accelerates opacity with WAAPI: inline opacity remains 0
                    // until completion. Mirror that already-running browser animation,
                    // including its easing/start time, rather than waiting on inline style.
                    const sources = element.getAnimations?.().filter(animation => animation.effect instanceof KeyframeEffect && animation.effect.getKeyframes().some(frame => frame.opacity !== undefined)) ?? [];
                    for (const source of sources) {
                        if (entry.sources.has(source))
                            continue;
                        entry.sources.add(source);
                        const effect = source.effect;
                        const frames = effect.getKeyframes().filter(frame => frame.opacity !== undefined).map(frame => ({ opacity: frame.opacity, offset: frame.offset, easing: frame.easing }));
                        if (frames.length < 2)
                            continue;
                        entry.settled = null;
                        element.style.setProperty(entry.variable, '1');
                        target(element, entry.variable);
                        const clones = [];
                        const attached = new Set();
                        const add = (surface) => {
                            if (attached.has(surface))
                                return;
                            attached.add(surface);
                            const clone = surface.animate(frames, effect.getTiming());
                            clone.playbackRate = source.playbackRate;
                            if (source.startTime !== null)
                                clone.startTime = source.startTime;
                            else
                                clone.currentTime = source.currentTime;
                            if (source.playState === 'paused')
                                clone.pause();
                            clones.push(clone);
                            entry.clones.add(clone);
                        };
                        for (const [surface, factors] of targets)
                            if (factors.has(entry.variable))
                                add(surface);
                        entry.additions.add(add);
                        entry.active = true;
                        element.dataset.natureGlassEntry = 'true';
                        const detach = () => {
                            source.removeEventListener('finish', finish);
                            source.removeEventListener('cancel', cancel);
                            entry.listeners.delete(detach);
                        };
                        const clear = () => { entry.additions.delete(add); for (const clone of clones) {
                            clone.cancel();
                            entry.clones.delete(clone);
                        } detach(); };
                        const finish = () => {
                            if (!entry.disposed) {
                                // WAAPI finish can precede Motion's final inline write. Reading
                                // stale inline 0 here used to blank the whole group for a frame.
                                const value = isPaused() ? String((source.playbackRate < 0 ? frames[0] : frames[frames.length - 1]).opacity) : element.style.opacity || '1';
                                entry.settled = isPaused() ? value : null;
                                element.style.setProperty(entry.variable, value);
                            }
                            clear();
                        };
                        const cancel = () => { clear(); if (!entry.disposed)
                            update(); };
                        entry.listeners.add(detach);
                        source.addEventListener('finish', finish, { once: true });
                        source.addEventListener('cancel', cancel, { once: true });
                    }
                    if (sources.some(source => source.playState === 'running' || source.pending))
                        return;
                    const inline = element.style.opacity || '1';
                    // Only bridge the finish-to-inline handoff. Once Motion acknowledges
                    // its final value, later JS-driven opacity changes must work normally.
                    if (entry.settled !== null && inline === entry.settled)
                        entry.settled = null;
                    const opacity = isPaused() && entry.settled !== null ? entry.settled : inline;
                    if (opacity === entry.last)
                        return;
                    entry.last = opacity;
                    // Do not override Motion's initial computed opacity. Wait for its
                    // first real animation frame, then transfer the same live value.
                    if (!entry.active && Number(opacity) <= 0)
                        return;
                    element.style.setProperty(entry.variable, opacity);
                    if (!entry.active) {
                        entry.active = true;
                        target(element, entry.variable);
                        element.dataset.natureGlassEntry = 'true';
                    }
                };
                hosts.set(element, entry);
                entry.observer = new MutationObserver(update);
                entry.observer.observe(element, { attributes: true, attributeFilter: ['style'] });
                update();
                // Accelerated animations can be attached after the React commit.
                entry.raf = requestAnimationFrame(() => { entry.raf = 0; update(); });
            }
        for (const element of changed) {
            const entry = hosts.get(element);
            if (entry?.active)
                target(element, entry.variable);
        }
    };
    const removeHost = (node) => {
        const entry = hosts.get(node);
        if (!entry)
            return;
        entry.disposed = true;
        entry.observer.disconnect();
        hosts.delete(node);
        if (entry.raf)
            cancelAnimationFrame(entry.raf);
        for (const detach of [...entry.listeners])
            detach();
        for (const clone of entry.clones)
            clone.cancel();
        delete node.dataset.natureGlassEntry;
        node.style.removeProperty(entry.variable);
        for (const [element, factors] of targets) {
            factors.delete(entry.variable);
            if (factors.size)
                element.style.setProperty('--nature-glass-entry-opacity', `calc(${[...factors].map(name => `var(${name}, 1)`).join(' * ')})`);
            else {
                delete element.dataset.natureGlassFade;
                element.style.removeProperty('--nature-glass-entry-opacity');
                targets.delete(element);
            }
        }
    };
    scan(root);
    const observer = new MutationObserver(records => {
        let removed = false;
        for (const record of records) {
            for (const node of record.addedNodes)
                if (node instanceof HTMLElement)
                    scan(node);
            if (record.removedNodes.length)
                removed = true;
        }
        if (removed) {
            for (const host of hosts.keys())
                if (!root.contains(host))
                    removeHost(host);
            for (const element of targets.keys())
                if (!root.contains(element)) {
                    delete element.dataset.natureGlassFade;
                    element.style.removeProperty('--nature-glass-entry-opacity');
                    targets.delete(element);
                }
        }
    });
    // Observe styles only on known fade containers, never on charts or rows.
    observer.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); for (const host of hosts.keys())
        removeHost(host); };
}
