import { memo, useEffect, useMemo, useRef, useCallback } from 'react';

const NUM_STARS = 200;

function prefersReducedMotion() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  } catch { return false; }
}

function readStarHsl() {
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--star-color').trim();
    const parts = raw.split(/\s+/);
    if (parts.length < 3) return '0, 0%, 100%';
    return `${parts[0]}, ${parts[1]}, ${parts[2]}`;
  } catch { return '0, 0%, 100%'; }
}

const StarryBackground = memo(function StarryBackground() {
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const fillRef     = useRef(null);
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const fill = fillRef.current;
    if (!fill) return;

    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x * cssW, s.y * cssH, s.radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${fill}, ${s.opacity})`;
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
      fillRef.current = readStarHsl();
      if (visibleRef.current) scheduleDraw();
    };

    refresh();

    const onResize   = () => { if (visibleRef.current) scheduleDraw(); };
    const onSettings = () => refresh();
    const onVis      = () => {
      visibleRef.current = document.visibilityState === 'visible';
      if (visibleRef.current) refresh();
    };

    window.addEventListener('resize',             onResize,   { passive: true });
    window.addEventListener('userSettingsChanged', onSettings);
    document.addEventListener('visibilitychange',  onVis);

    return () => {
      window.removeEventListener('resize',             onResize);
      window.removeEventListener('userSettingsChanged', onSettings);
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
      }}
    />
  );
});

export default StarryBackground;
