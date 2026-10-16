const overflowProperties = ['overflow', 'overflow-x', 'overflow-y'];
const capture = (node, properties) => properties.map(property => ({ property, value: node.style.getPropertyValue(property), priority: node.style.getPropertyPriority(property) }));
const restoreStyles = (node, values) => {
  values.forEach(({ property }) => node.style.removeProperty(property));
  values.forEach(({ property, value, priority }) => { if (value) node.style.setProperty(property, value, priority); });
};

// A portal freezes interaction, not the app's geometry. In Nature the page
// scrolls in the document and the sidebar is sticky. Body overflow:hidden
// creates a new scrolling ancestor and can move that sidebar off screen.
export function createDialogBackgroundManager() {
  let count = 0, restore = null;
  return {
    lock(document, window) {
      if (count++ === 0) {
        const root = document.documentElement, body = document.body;
        const app = document.getElementById('root');
        const wasInert = app?.inert;
        const rootStyles = capture(root, [...overflowProperties, 'scrollbar-gutter']);
        const bodyStyles = capture(body, overflowProperties);
        const position = { left: window.scrollX, top: window.scrollY };
        if (window.innerWidth > root.clientWidth) root.style.setProperty('scrollbar-gutter', 'stable');
        root.style.setProperty('overflow', 'hidden', 'important');
        // clip blocks body overflow without introducing a scroll container.
        body.style.setProperty('overflow', 'clip', 'important');
        if (app) app.inert = true;
        restore = () => {
          restoreStyles(body, bodyStyles);
          restoreStyles(root, rootStyles);
          if (app) app.inert = wasInert;
          if (window.scrollX !== position.left || window.scrollY !== position.top) window.scrollTo({ ...position, behavior: 'instant' });
        };
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (--count === 0) { restore?.(); restore = null; }
      };
    },
  };
}
