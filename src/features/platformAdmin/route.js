export const ADMIN_VIEWS = Object.freeze(['overview', 'users', 'schools']);

/**
 * null when the path is not under /admin; { view } otherwise, where view is
 * null for an unknown /admin sub-path (rendered as "page not found").
 */
export function parseAdminPath(pathname) {
  const clean = `/${String(pathname || '').replace(/^\/+|\/+$/g, '')}`;
  if (clean !== '/admin' && !clean.startsWith('/admin/')) return null;
  const rest = clean.slice('/admin'.length).replace(/^\/+/, '');
  if (!rest) return { view: 'overview' };
  return { view: rest !== 'overview' && ADMIN_VIEWS.includes(rest) ? rest : null };
}

export const adminPathFor = view => (view === 'overview' ? '/admin' : `/admin/${view}`);

/** Client-side navigation that the App-level path listener picks up. */
export function navigateTo(path) {
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
