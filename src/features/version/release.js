export function parseRelease(value) {
  if (!value || typeof value !== 'object' || !/^\d+\.\d+\.\d+$/.test(value.version)) return null;
  return { version: value.version, buildDate: typeof value.buildDate === 'string' ? value.buildDate : '', requiresReload: value.requiresReload === true };
}

// Old CDN responses and rollbacks must never cause a reload loop.
export function isNewerVersion(candidate, current) {
  const a = parseRelease({ version: candidate });
  const b = parseRelease({ version: current });
  if (!a || !b) return false;
  const left = a.version.split('.').map(Number), right = b.version.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return false;
}

export async function fetchRelease({ fetcher = fetch, signal, now = Date.now() } = {}) {
  const response = await fetcher(`/version.json?t=${now}`, { cache: 'no-store', signal, headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } });
  if (!response.ok) throw new Error('Release check failed');
  const release = parseRelease(await response.json());
  if (!release) throw new Error('Invalid release information');
  return release;
}
