import { memo, useEffect, useMemo, useRef, useCallback } from 'react';

const NUM_STARS = 200;

function prefersReducedMotion() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  } catch { return false; }
}

function getThemeStarConfig() {
  try {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--star-color').trim();
    
    let fill = isLight ? '270, 38%, 32%' : '0, 0%, 100%';
    if (raw) {
      const parts = raw.split(/\s+/);
      if (parts.length >= 3) {
        fill = `${parts[0]}, ${parts[1]}, ${parts[2]}`;
      }
    }

    return {
      fill,
      isLight,
    };
  } catch {
    const isLight = document.documentElement?.getAttribute('data-theme') === 'light';
    return {
      fill: isLight ? '270, 38%, 32%' : '0, 0%, 100%',
      isLight: !!isLight,
    };
  }
}

const StarryBackground = memo(function StarryBackground() {
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const configRef   = useRef(null);
  const visibleRef  = useRef(true);

  const reduceMotion = useMemo(() => prefersReducedMotion(), []);

  const stars = useMemo(() => {
    if (reduceMotion) return [];
    return Array.from({ length: NUM_STARS }, () => ({
      x:       Math.random(),
      y:       Math.random(),
      radius:  0.8 + Math.random() * 1.4,
      opacity: 0.15 + Math.random() * 0.55,
    }));
  }, [reduceMotion]);

  const draw = useCallback(() => {
    if (!visibleRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr  = Math.min(2, window.devicePixelRatio || 1);
    const tw   = Math.floor(cssW * dpr);
    const th   = Math.floor(cssH * dpr);
    if (canvas.width !== tw)  canvas.width  = tw;
    if (canvas.height !== th) canvas.height = th;

    // Reset transform and completely clear the physical backing canvas buffer
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const config = configRef.current || getThemeStarConfig();
    const { fill, isLight } = config;
    if (!fill) return;

    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x * cssW, s.y * cssH, s.radius, 0, Math.PI * 2);
      // In light mode, provide balanced contrast so stars remain gently visible against the lilac canvas
      const alpha = isLight 
        ? Math.min(0.85, (s.opacity * 1.35) + 0.12)
        : s.opacity;
      ctx.fillStyle = `hsla(${fill}, ${alpha})`;
      ctx.fill();
    }
  }, [stars]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    if (reduceMotion) return;

    const refresh = () => {
      configRef.current = getThemeStarConfig();
      if (visibleRef.current) scheduleDraw();
    };

    // Initial render
    refresh();

    // Listen to direct DOM mutations on data-theme attribute on document.documentElement
    const observer = new MutationObserver(() => {
      refresh();
      // Ensure layout recalculation and custom properties are painted cleanly
      window.requestAnimationFrame(() => {
        refresh();
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    const onResize   = () => { if (visibleRef.current) scheduleDraw(); };
    const onTheme    = () => {
      refresh();
      window.requestAnimationFrame(refresh);
    };
    const onSettings = () => onTheme();
    const onVis      = () => {
      visibleRef.current = document.visibilityState === 'visible';
      if (visibleRef.current) onTheme();
    };

    window.addEventListener('resize',             onResize,   { passive: true });
    window.addEventListener('themechange',        onTheme);
    window.addEventListener('userSettingsChanged', onSettings);
    window.addEventListener('storage',            onSettings);
    document.addEventListener('visibilitychange',  onVis);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize',             onResize);
      window.removeEventListener('themechange',        onTheme);
      window.removeEventListener('userSettingsChanged', onSettings);
      window.removeEventListener('storage',            onSettings);
      document.removeEventListener('visibilitychange',  onVis);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [reduceMotion, scheduleDraw]);

  if (reduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      'fixed',
        inset:         0,
        width:         '100vw',
        height:        '100vh',
        pointerEvents: 'none',
        zIndex:        0,
        transition:    'opacity 0.2s ease',
      }}
    />
  );
});

export default StarryBackground;
