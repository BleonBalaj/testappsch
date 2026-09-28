// Address-bar paths for the app's pages. The app still navigates with page ids
// (App.jsx `currentPath`); this only maps those ids to and from URLs.
export const PAGE_PATHS = Object.freeze({
  dashboard: '/dashboard',
  schedule: '/schedule',
  classes: '/classes',
  'lesson-plans': '/lesson-plans',
  'lesson-plans-settings': '/lesson-plans/settings',
  transcript: '/transcript',
  tasks: '/tasks',
  messages: '/messages',
  students: '/students',
  staff: '/staff',
  teachers: '/staff',
  leaderboard: '/leaderboard',
  events: '/events',
  resources: '/resources',
  'mood-insights': '/mood-insights',
  settings: '/settings',
  login: '/login',
});

const PATH_PAGES = new Map(
  Object.entries(PAGE_PATHS).filter(([page]) => page !== 'teachers').map(([page, path]) => [path, page]),
);
PATH_PAGES.set('/', 'dashboard');
PATH_PAGES.set('/index.html', 'dashboard');
PATH_PAGES.set('/teachers', 'staff');

// Detail pages carry the record id: /classes/<id>, /students/<id>.
const DETAIL_PAGES = Object.freeze({ classes: 'class-overview', students: 'student-overview' });
const DETAIL_PARENTS = Object.freeze({ 'class-overview': 'classes', 'student-overview': 'students' });

/**
 * { page, id? } for a pathname, or null when no page lives there.
 * Keeps the old `#/login` links working.
 */
export function pageFromLocation(pathname, hash = '') {
  if (hash === '#/login' || hash === '#login') return { page: 'login' };
  const clean = `/${String(pathname || '').replace(/^\/+|\/+$/g, '')}`;
  const page = PATH_PAGES.get(clean);
  if (page) return { page };
  const match = clean.match(/^\/(classes|students)\/([^/]+)$/);
  if (match) {
    try {
      return { page: DETAIL_PAGES[match[1]], id: decodeURIComponent(match[2]) };
    } catch {
      return null;
    }
  }
  return null;
}

/** The URL for a page; detail pages need their record id, else they fall back to the list. */
export function pathForPage(page, id) {
  if (DETAIL_PARENTS[page]) {
    const base = PAGE_PATHS[DETAIL_PARENTS[page]];
    return id !== undefined && id !== null && String(id) !== '' ? `${base}/${encodeURIComponent(String(id))}` : base;
  }
  return PAGE_PATHS[page] || null;
}

export const detailParent = page => DETAIL_PARENTS[page] || null;
