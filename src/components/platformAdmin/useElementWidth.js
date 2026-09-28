import { useLayoutEffect, useState } from 'react';

/** Current content width of an element, for charts drawn in real pixels. */
export function useElementWidth(ref, fallback = 600) {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setWidth(Math.max(0, Math.floor(element.clientWidth)));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
