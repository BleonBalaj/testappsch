import { useCallback, useEffect, useRef, useState } from 'react';
import { waitForPendingWrites } from 'firebase/firestore';
import { db } from '../services/firebase';
import { fetchRelease, isNewerVersion } from '../features/version/release';
import { AppReleaseContext } from '../features/version/useAppRelease';

const currentVersion = import.meta.env.VITE_APP_VERSION;

export function AppReleaseProvider({ children }) {
  const [latest, setLatest] = useState(null);
  const [status, setStatus] = useState('idle');
  const [updating, setUpdating] = useState(false);
  const activeCheck = useRef(null);
  const mounted = useRef(true);
  const check = useCallback(async (manual = false) => {
    if (document.visibilityState === 'hidden' || !navigator.onLine) {
      if (manual) setStatus('offline');
      return;
    }
    if (activeCheck.current) return;
    const controller = new AbortController();
    activeCheck.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    if (manual) setStatus('checking');
    try {
      const release = await fetchRelease({ signal: controller.signal });
      if (!mounted.current) return;
      setLatest(previous => isNewerVersion(release.version, currentVersion) && (!previous || isNewerVersion(release.version, previous.version)) ? release : previous);
      setStatus('checked');
    } catch { if (mounted.current && manual) setStatus('error'); }
    finally { clearTimeout(timeout); if (activeCheck.current === controller) activeCheck.current = null; }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const onReturn = () => check();
    const timer = setInterval(onReturn, 10 * 60 * 1000);
    window.addEventListener('focus', onReturn);
    window.addEventListener('online', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    void check();
    return () => { mounted.current = false; clearInterval(timer); activeCheck.current?.abort(); activeCheck.current = null; window.removeEventListener('focus', onReturn); window.removeEventListener('online', onReturn); document.removeEventListener('visibilitychange', onReturn); };
  }, [check]);
  const refresh = async () => {
    if (updating) return;
    setUpdating(true);
    let timer;
    try {
      if (!navigator.onLine) throw new Error('offline');
      const pending = [];
      window.dispatchEvent(new CustomEvent('app:before-update', { detail: { waitUntil: promise => pending.push(Promise.resolve(promise)) } }));
      pending.push(waitForPendingWrites(db));
      await Promise.race([Promise.all(pending), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 12_000); })]);
      window.location.reload();
    } catch { setStatus('save-error'); setUpdating(false); }
    finally { clearTimeout(timer); }
  };
  return <AppReleaseContext.Provider value={{ version: currentVersion, buildDate: import.meta.env.VITE_BUILD_DATE, latest, status, updating, check, refresh }}>{children}</AppReleaseContext.Provider>;
}

