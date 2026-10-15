const OVERLAY = '.modal-overlay, .lesson-modal-overlay, .search-overlay.open, .drawer-overlay, .profile-drawer-overlay, [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

// Track only dialog changes; chart animation must not trigger full-page scans.
export function observeDialogOverlays(root, onChange) {
  const overlays = new Set(root.querySelectorAll(OVERLAY));
  let previous;
  const publish = () => {
    const open = [...overlays].some(node => node.isConnected && !node.hidden && node.getAttribute('aria-hidden') !== 'true');
    if (open !== previous) { previous = open; onChange(open); }
  };
  const observer = new MutationObserver(records => {
    let changed = false;
    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.target.matches(OVERLAY) || overlays.has(record.target)) {
          if (record.target.matches(OVERLAY)) overlays.add(record.target);
          else overlays.delete(record.target);
          changed = true;
        }
        continue;
      }
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(OVERLAY)) { overlays.add(node); changed = true; }
        for (const overlay of node.querySelectorAll(OVERLAY)) { overlays.add(overlay); changed = true; }
      }
      if (record.removedNodes.length) {
        for (const overlay of overlays) if (!root.contains(overlay)) { overlays.delete(overlay); changed = true; }
      }
    }
    if (changed) publish();
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden'] });
  publish();
  return () => observer.disconnect();
}
