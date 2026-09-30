import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Info, School as SchoolIcon, Sparkles, UserPlus, Users, Wrench, XCircle,
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { Badge, Card, Delta, EmptyState, StatTile } from './shared';
import { RecencyChart, SignupChart } from './Charts';
import { formatDateTime, formatNumber, formatPercent, relativeTime, roleLabel } from '../../features/platformAdmin/format';
import { compareIsoDesc } from '../../features/platformAdmin/metrics';

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2, ok: 3 };
const SEVERITY_ICON = { critical: XCircle, warning: AlertTriangle, info: Info, ok: CheckCircle2 };
const SEVERITY_LABEL = { critical: 'Critical', warning: 'Needs attention', info: 'For information', ok: 'OK' };

function primaryMembership(user, schoolsById) {
  const membership = user.memberships.find(item => item.status === 'active');
  if (membership) return `${roleLabel(membership.role)} · ${schoolsById.get(membership.schoolId)?.name || 'Unknown school'}`;
  if (user.createdSchools?.length) return `Creator · ${schoolsById.get(user.createdSchools[0])?.name || 'Unknown school'}`;
  return user.isPlatformAdmin ? 'Platform admin' : 'No school';
}

function PersonRow({ user, meta, metaTitle, sub, onOpen }) {
  return (
    <li>
      <button type="button" className="padm-list-row" onClick={() => onOpen(user.uid)}>
        <Avatar src={user.photoURL} name={user.name} size={34} />
        <span className="padm-list-main">
          <span className="padm-list-title">{user.name}</span>
          <span className="padm-list-sub">{sub}</span>
        </span>
        <span className="padm-list-meta" title={metaTitle}>{meta}</span>
      </button>
    </li>
  );
}

function HealthCheck({ check, repairing, onRepair }) {
  const [open, setOpen] = useState(false);
  const Icon = SEVERITY_ICON[check.severity];
  return (
    <li className={`padm-health-item padm-sev-${check.severity}`}>
      <div className="padm-health-head">
        <span className="padm-health-icon" aria-hidden="true"><Icon size={18} /></span>
        <div className="padm-health-text">
          <span className="padm-health-title">
            {check.title}
            <span className="padm-sr-only"> ({SEVERITY_LABEL[check.severity]})</span>
          </span>
          {check.severity !== 'ok' && <span className="padm-health-desc">{check.description}</span>}
        </div>
        <span className="padm-health-count">{check.severity === 'ok' ? 'OK' : formatNumber(check.count)}</span>
      </div>
      {check.severity !== 'ok' && (
        <div className="padm-health-actions">
          {check.sample.length > 0 && check.id !== 'conversationIndex' && (
            <button type="button" className="padm-link-btn" onClick={() => setOpen(value => !value)} aria-expanded={open}>
              {open ? 'Hide details' : `Show ${check.count > check.sample.length ? `first ${check.sample.length}` : 'details'}`}
            </button>
          )}
          {check.fix && (
            <button type="button" className="btn-secondary padm-small-btn" onClick={() => onRepair(check.fix)} disabled={Boolean(repairing)}>
              <Wrench size={14} />
              {repairing === check.fix ? 'Fixing…' : 'Fix now'}
            </button>
          )}
        </div>
      )}
      {open && (
        <ul className="padm-health-sample">
          {check.sample.map(item => (
            <li key={item.id}>
              <span>{item.label}</span>
              {item.detail && <span className="padm-list-sub">{item.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OverviewView({
  snapshot, kpis, series, recency, range, activity, schoolsById, now, onOpenUser, onOpenSchool, repairing, repairResult, onRepair,
}) {
  const periodLabel = range.option.unit === 'month' ? '12 months' : `${range.option.count} days`;
  const recentlyActive = useMemo(() => snapshot.users.filter(user => user.lastSeenAt).slice(0, 8), [snapshot.users]);
  const newest = useMemo(
    () => [...snapshot.users].sort((a, b) => compareIsoDesc(a.createdAt, b.createdAt)).slice(0, 8),
    [snapshot.users],
  );
  const topSchools = useMemo(() => snapshot.schools
    .map(school => ({ school, activity: activity.get(school.id) }))
    .sort((a, b) => (b.activity?.activeMembers || 0) - (a.activity?.activeMembers || 0) || compareIsoDesc(a.activity?.lastActiveAt, b.activity?.lastActiveAt))
    .slice(0, 6), [snapshot.schools, activity]);
  const health = useMemo(() => [...snapshot.health].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]), [snapshot.health]);
  const issues = health.filter(check => check.severity !== 'ok').length;
  const signupTotal = series.reduce((sum, bucket) => sum + bucket.signups, 0);

  return (
    <div className="padm-stack">
      <div className="padm-kpis">
        <StatTile label="Total accounts" value={formatNumber(kpis.totalUsers)} icon={Users}>
          <span>{formatNumber(kpis.neverSignedIn)} never signed in · {formatNumber(kpis.disabledUsers)} disabled</span>
        </StatTile>
        <StatTile label={`Active · ${range.option.label.toLowerCase()}`} value={formatNumber(kpis.activeUsers)} icon={Activity}>
          <span>{formatPercent(kpis.activeShare)} of all accounts</span>
          <span>24h {formatNumber(kpis.dau)} · 7d {formatNumber(kpis.wau)} · 30d {formatNumber(kpis.mau)}</span>
        </StatTile>
        <StatTile label="New accounts" value={formatNumber(kpis.newSignups)} icon={UserPlus}>
          <Delta current={kpis.newSignups} previous={kpis.previousSignups} periodLabel={periodLabel} />
        </StatTile>
        <StatTile label="Schools" value={formatNumber(kpis.totalSchools)} icon={SchoolIcon}>
          <span>{formatNumber(kpis.activeSchools)} active · {formatNumber(kpis.newSchools)} new in range</span>
        </StatTile>
        <StatTile label="AI lesson plans" value={formatNumber(snapshot.ai.totalGenerations)} icon={Sparkles}>
          <span>by {formatNumber(snapshot.ai.users)} {snapshot.ai.users === 1 ? 'person' : 'people'}, all time</span>
        </StatTile>
      </div>

      <div className="padm-grid padm-grid-chart">
        <Card
          title="New accounts"
          subtitle={`${formatNumber(signupTotal)} created · ${range.option.label.toLowerCase()} · per ${range.option.unit}`}
          className="padm-span-2"
        >
          <SignupChart series={series} unit={range.option.unit} />
        </Card>
        <Card title="Last seen" subtitle="Every account by its most recent activity">
          <RecencyChart buckets={recency} />
        </Card>
      </div>

      <div className="padm-grid padm-grid-halves">
        <Card title="Recently active" subtitle="Who used the app last, and when">
          {recentlyActive.length ? (
            <ul className="padm-list">
              {recentlyActive.map(user => (
                <PersonRow key={user.uid} user={user} sub={primaryMembership(user, schoolsById)}
                  meta={relativeTime(user.lastSeenAt, now)} metaTitle={formatDateTime(user.lastSeenAt)} onOpen={onOpenUser} />
              ))}
            </ul>
          ) : <EmptyState icon={Activity} title="No activity yet" />}
        </Card>
        <Card title="Newest accounts" subtitle="Most recently created logins">
          {newest.length ? (
            <ul className="padm-list">
              {newest.map(user => (
                <PersonRow key={user.uid} user={user} sub={user.email || primaryMembership(user, schoolsById)}
                  meta={user.lastSeenAt ? `Joined ${relativeTime(user.createdAt, now).toLowerCase()}` : 'Never signed in'}
                  metaTitle={formatDateTime(user.createdAt)} onOpen={onOpenUser} />
              ))}
            </ul>
          ) : <EmptyState icon={UserPlus} title="No accounts yet" />}
        </Card>
      </div>

      <div className="padm-grid padm-grid-chart">
        <Card
          title="Data health"
          subtitle={issues ? `${issues} ${issues === 1 ? 'check needs' : 'checks need'} a look` : 'All checks passed'}
          className="padm-span-2"
        >
          {repairResult && (
            <p className={`padm-inline-alert ${repairResult.error ? 'is-error' : 'is-success'}`} role="status">
              {repairResult.error || `Done: ${formatNumber(repairResult.updated)} updated of ${formatNumber(repairResult.scanned)} checked${repairResult.skipped ? `, ${formatNumber(repairResult.skipped)} skipped` : ''}.`}
            </p>
          )}
          <ul className="padm-health">
            {health.map(check => <HealthCheck key={check.id} check={check} repairing={repairing} onRepair={onRepair} />)}
          </ul>
        </Card>
        <Card title="Most active schools" subtitle={`Members active · ${range.option.label.toLowerCase()}`}>
          {topSchools.length ? (
            <ul className="padm-list">
              {topSchools.map(({ school, activity: schoolActivity }) => (
                <li key={school.id}>
                  <button type="button" className="padm-list-row" onClick={() => onOpenSchool(school.id)}>
                    <span className="padm-list-icon" aria-hidden="true"><SchoolIcon size={16} /></span>
                    <span className="padm-list-main">
                      <span className="padm-list-title">{school.name}</span>
                      <span className="padm-list-sub" title={formatDateTime(schoolActivity?.lastActiveAt)}>
                        {schoolActivity?.lastActiveAt ? `Last activity ${relativeTime(schoolActivity.lastActiveAt, now).toLowerCase()}` : 'No activity yet'}
                      </span>
                    </span>
                    <Badge>{formatNumber(schoolActivity?.activeMembers || 0)} / {formatNumber(school.members.active)}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={SchoolIcon} title="No schools yet" />}
        </Card>
      </div>
    </div>
  );
}
