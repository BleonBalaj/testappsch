import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPlatformOverview, PlatformAccessError } from './service';

/**
 * Loads the platform snapshot once and on demand. A refresh keeps the previous
 * data on screen (dimmed by the page) instead of flashing a loader.
 */
export function usePlatformOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchPlatformOverview();
      if (requestId === requestRef.current) setData(snapshot);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      if (err instanceof PlatformAccessError) setAccessDenied(true);
      else setError(err.message);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => { requestRef.current += 1; };
  }, [load]);

  return { data, error, accessDenied, loading, refresh: load };
}
