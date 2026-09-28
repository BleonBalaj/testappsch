import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LayoutDashboard, RefreshCw, School as SchoolIcon, Shield, Users } from 'lucide-react';
import StarryBackground from '../components/StarryBackground';
import { Avatar } from '../components/Avatar';
import NotFound from './NotFound';
import OverviewView from '../components/platformAdmin/OverviewView';
import UsersView from '../components/platformAdmin/UsersView';
import SchoolsView from '../components/platformAdmin/SchoolsView';
import { SchoolDetailDialog, UserDetailDialog } from '../components/platformAdmin/Dialogs';
import { usePlatformOverview } from '../features/platformAdmin/usePlatformOverview';
import { runPlatformRepair } from '../features/platformAdmin/service';
import { adminPathFor } from '../features/platformAdmin/route';
import {
  RANGE_OPTIONS, buildRecency, buildSchoolActivity, buildSignupSeries, computeKpis, rangeWindow,
} from '../features/platformAdmin/metrics';
import { formatDateTime, relativeTime } from '../features/platformAdmin/format';
import './PlatformAdmin.css';

const NAV = [
  { view: 'overview', label: 'Overview', icon: LayoutDashboard, title: 'Platform overview' },
  { view: 'users', label: 'Accounts', icon: Users, title: 'Accounts' },
  { view: 'schools', label: 'Schools', icon: SchoolIcon, title: 'Schools' },
];
const RANGE_KEY = 'lumi-admin-range';

function readStoredRange() {
  try {
    const stored = localStorage.getItem(RANGE_KEY);
    return RANGE_OPTIONS.some(option => option.id === stored) ? stored : '30d';
  } catch {
    return '30d';
  }
}

function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function PlatformAdmin({ view, currentUser, onNavigate, onGoHome }) {
  const { data, error, accessDenied, loading, refresh } = usePlatformOverview();
  const now = useMinuteClock();
  const [rangeId, setRangeId] = useState(readStoredRange);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState(null);
  const [repairing, setRepairing] = useState(null);
  const [repairResult, setRepairResult] = useState(null);

  const chooseRange = id => {
    setRangeId(id);
    try { localStorage.setItem(RANGE_KEY, id); } catch { /* Preference only. */ }
  };

  const range = useMemo(() => rangeWindow(rangeId, now), [rangeId, now]);
  const derived = useMemo(() => {
    if (!data) return null;
    return {
      kpis: computeKpis(data, range, now),
      series: buildSignupSeries(data.users, range),
      recency: buildRecency(data.users, now),
      activity: buildSchoolActivity(data.users, range.start),
      schoolsById: new Map(data.schools.map(school => [school.id, school])),
      usersById: new Map(data.users.map(user => [user.uid, user])),
    };
  }, [data, range, now]);

  const handleRepair = useCallback(async (action) => {
    setRepairing(action);
    setRepairResult(null);
    try {
      setRepairResult(await runPlatformRepair(action));
      await refresh();
    } catch (err) {
      setRepairResult({ error: err.message });
    } finally {
      setRepairing(null);
    }
  }, [refresh]);

  if (accessDenied) return <NotFound onGoHome={onGoHome} />;

  const title = NAV.find(item => item.view === view)?.title || 'Platform admin';
  const selectedUser = selectedUserId ? derived?.usersById.get(selectedUserId) : null;
  const selectedSchool = selectedSchoolId ? derived?.schoolsById.get(selectedSchoolId) : null;
  const openUser = uid => { setSelectedSchoolId(null); setSelectedUserId(uid); };
  const openSchool = id => { setSelectedUserId(null); setSelectedSchoolId(id); };

  return (
    <div className="padm">
      <StarryBackground />
      <aside className="padm-nav" aria-label="Platform admin">
        <div className="padm-brand">
          <span className="padm-brand-icon" aria-hidden="true"><Shield size={16} /></span>
          <span>Platform admin</span>
        </div>
        <nav className="padm-nav-links">
          {NAV.map(item => (
            <button key={item.view} type="button" className={`padm-nav-link ${view === item.view ? 'is-active' : ''}`}
              aria-current={view === item.view ? 'page' : undefined} onClick={() => onNavigate(adminPathFor(item.view))}>
              <item.icon size={17} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="padm-nav-footer">
          <button type="button" className="padm-nav-link" onClick={onGoHome}>
            <ArrowLeft size={17} aria-hidden="true" />
            Back to app
          </button>
          <div className="padm-identity">
            <Avatar src={currentUser.photoURL} name={currentUser.displayName || currentUser.email} size={34} />
            <div className="padm-identity-text">
              <span className="padm-list-title">{currentUser.displayName || 'Platform admin'}</span>
              <span className="padm-list-sub">{currentUser.email}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="padm-main">
        <header className="padm-header">
          <div>
            <h1 className="gradient-text">{title}</h1>
            <p className="padm-header-sub">
              {data ? <>Data from <span title={formatDateTime(data.generatedAt)}>{relativeTime(data.generatedAt, now).toLowerCase()}</span></> : 'Loading platform data…'}
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'padm-spin' : ''} aria-hidden="true" />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
        </header>

        <div className="padm-range" role="group" aria-label="Date range">
          {RANGE_OPTIONS.map(option => (
            <button key={option.id} type="button" className={`padm-chip ${rangeId === option.id ? 'is-active' : ''}`}
              aria-pressed={rangeId === option.id} onClick={() => chooseRange(option.id)}>
              {option.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="padm-inline-alert is-error" role="alert">
            <span>{error}</span>
            <button type="button" className="padm-link-btn" onClick={refresh}>Try again</button>
          </div>
        )}
        {data?.usersTruncated && (
          <p className="padm-inline-alert">Showing the {data.users.length.toLocaleString()} most recently active of {data.totals.users.toLocaleString()} accounts. Totals still count everyone.</p>
        )}

        {!data && loading && (
          <div className="padm-loading" role="status">
            <RefreshCw size={22} className="padm-spin" aria-hidden="true" />
            Gathering accounts, schools and activity…
          </div>
        )}

        {data && derived && (
          <div className={`padm-content ${loading ? 'is-refreshing' : ''}`} aria-busy={loading}>
            {view === 'overview' && (
              <OverviewView snapshot={data} kpis={derived.kpis} series={derived.series} recency={derived.recency}
                range={range} activity={derived.activity} schoolsById={derived.schoolsById} now={now}
                onOpenUser={openUser} onOpenSchool={openSchool}
                repairing={repairing} repairResult={repairResult} onRepair={handleRepair} />
            )}
            {view === 'users' && (
              <UsersView snapshot={data} range={range} schoolsById={derived.schoolsById} now={now} onOpenUser={openUser} />
            )}
            {view === 'schools' && (
              <SchoolsView snapshot={data} range={range} activity={derived.activity} now={now} onOpenSchool={openSchool} />
            )}
          </div>
        )}
      </main>

      {selectedUser && (
        <UserDetailDialog user={selectedUser} schoolsById={derived.schoolsById} now={now}
          onClose={() => setSelectedUserId(null)} onOpenSchool={openSchool} />
      )}
      {selectedSchool && (
        <SchoolDetailDialog school={selectedSchool} users={data.users} activity={derived.activity.get(selectedSchool.id)}
          now={now} rangeLabel={range.option.label} onClose={() => setSelectedSchoolId(null)} onOpenUser={openUser} />
      )}
    </div>
  );
}
