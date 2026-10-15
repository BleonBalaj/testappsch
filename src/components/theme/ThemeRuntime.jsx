import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../features/theme/useThemeMode';
import { observeDeviceTheme } from '../../features/theme/themeStore';
const NatureBackground = lazy(() => import('./NatureBackground').then(module => ({ default: module.NatureBackground })));

export default function ThemeRuntime() {
  const mode = useThemeMode();
  const { globalPreferences } = useAuth();
  const [notice, setNotice] = useState(null);
  useEffect(observeDeviceTheme, []);
  useEffect(() => {
    const notify = event => setNotice(event.detail);
    window.addEventListener('nature:notice', notify);
    return () => window.removeEventListener('nature:notice', notify);
  }, []);
  const connection = navigator.connection;
  const allowScene = globalPreferences.animations !== false && !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType) && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return <>
    {mode === 'nature' && <Suspense fallback={null}><NatureBackground allowScene={allowScene} /></Suspense>}
    {mode === 'nature' && notice && <div className="nature-performance-notice" role="status"><strong>{notice.title}</strong><p>{notice.description}</p><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notice">×</button></div>}
  </>;
}
