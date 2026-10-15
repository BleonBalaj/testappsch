// Ported from MomentumHorizon00; see docs/nature-theme.md.
import { NATURE_SURFACES as SURFACE } from './surfaces.js';
/** Prepare nearby native glass layers before their first visible scroll.
 * No card bitmap, deferred content, geometry reads or changes to material.
 * Keep the extra layers bounded to the viewport and its approach region. */
export function observeNaturePausedCardPaint(root) {
    if (typeof IntersectionObserver === 'undefined')
        return () => { };
    const watched = new Set();
    const prepared = new Map();
    let stopped = false;
    const release = (card) => {
        const original = prepared.get(card);
        if (original === undefined)
            return;
        if (card.style.willChange === 'transform')
            card.style.willChange = original;
        prepared.delete(card);
    };
    const observer = new IntersectionObserver(entries => {
        if (stopped)
            return;
        for (const entry of entries) {
            const card = entry.target;
            if (!root.contains(card) || !entry.isIntersecting) {
                release(card);
                continue;
            }
            if (prepared.has(card) || (card.style.willChange && card.style.willChange !== 'auto'))
                continue;
            prepared.set(card, card.style.willChange);
            // Opacity would create a backdrop root and break the glass. Transform
            // is a compositor preparation hint; no actual transform is applied.
            card.style.willChange = 'transform';
        }
    }, { rootMargin: '150% 0px' });
    const scan = (node) => {
        const cards = [...(node.matches(SURFACE) ? [node] : []), ...node.querySelectorAll(SURFACE)];
        for (const card of cards) {
            if (watched.has(card) || card.parentElement?.closest(SURFACE))
                continue;
            watched.add(card);
            observer.observe(card);
        }
    };
    scan(root);
    const mutations = new MutationObserver(records => {
        let removed = false;
        for (const record of records) {
            for (const node of record.addedNodes)
                if (node instanceof HTMLElement)
                    scan(node);
            if (record.removedNodes.length)
                removed = true;
        }
        if (removed)
            for (const card of watched)
                if (!root.contains(card)) {
                    observer.unobserve(card);
                    watched.delete(card);
                    release(card);
                }
    });
    mutations.observe(root, { childList: true, subtree: true });
    return () => { stopped = true; mutations.disconnect(); observer.disconnect(); for (const card of prepared.keys())
        release(card); watched.clear(); };
}
