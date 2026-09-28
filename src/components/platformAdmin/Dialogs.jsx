import React, { useMemo } from 'react';
import { Crown, School as SchoolIcon, Users } from 'lucide-react';
import { Avatar } from '../Avatar';
import { Badge, CopyButton, Dialog, EmptyState } from './shared';
import { formatDateTime, formatNumber, relativeTime, roleLabel } from '../../features/platformAdmin/format';
import { userSchoolIds } from '../../features/platformAdmin/metrics';

function Fact({ label, value, hint }) {
  return (
    <div className="padm-fact">
      <span className="padm-fact-label">{label}</span>
      <span className="padm-fact-value" title={hint}>{value}</span>
    </div>
  );
}

export function AccountBadges({ user }) {
  return (
    <>
      {user.isPlatformAdmin && <Badge tone="primary">Platform admin</Badge>}
      {user.disabled && <Badge tone="critical">Disabled</Badge>}
      {!user.lastSeenAt && <Badge tone="neutral">Never signed in</Badge>}
      {!user.hasProfile && <Badge tone="warning" title="No users/{uid} profile document">No profile</Badge>}
    </>
  );
}

export function UserDetailDialog({ user, schoolsById, now, onClose, onOpenSchool }) {
  const schoolRows = useMemo(() => {
    const byId = new Map();
    for (const membership of user.memberships || []) {
      byId.set(membership.schoolId, { ...membership, creator: false });
    }
    for (const schoolId of user.createdSchools || []) {
      byId.set(schoolId, { schoolId, role: byId.get(schoolId)?.role || 'admin', status: byId.get(schoolId)?.status || 'active', creator: true });
    }
    return [...byId.values()].sort((a, b) => (schoolsById.get(a.schoolId)?.name || '').localeCompare(schoolsById.get(b.schoolId)?.name || ''));
  }, [user, schoolsById]);

  return (
    <Dialog title={user.name} subtitle={user.email ? undefined : 'No email on this account'} onClose={onClose} wide>
      <div className="padm-dialog-identity">
        <Avatar src={user.photoURL} name={user.name} size={52} />
        <div className="padm-dialog-identity-text">
          <div className="padm-badge-row"><AccountBadges user={user} /></div>
          {user.email && (
            <span className="padm-inline-copy">{user.email}<CopyButton value={user.email} label="email" /></span>
          )}
          <span className="padm-inline-copy padm-mono">{user.uid}<CopyButton value={user.uid} label="user ID" /></span>
        </div>
      </div>

      <div className="padm-facts">
        <Fact label="Last seen" value={relativeTime(user.lastSeenAt, now)} hint={formatDateTime(user.lastSeenAt)} />
        <Fact label="Last sign-in" value={relativeTime(user.lastSignInAt, now)} hint={formatDateTime(user.lastSignInAt)} />
        <Fact label="Account created" value={formatDateTime(user.createdAt)} />
        <Fact label="AI lesson generations" value={formatNumber(user.aiGenerations || 0)} />
      </div>
      <p className="padm-footnote">
        Last seen comes from Firebase Authentication and updates about once an hour while the app is open, so it cannot be faked by the user.
      </p>

      <h4 className="padm-section-title">Schools &amp; roles</h4>
      {schoolRows.length ? (
        <ul className="padm-list">
          {schoolRows.map(row => {
            const school = schoolsById.get(row.schoolId);
            return (
              <li key={row.schoolId}>
                <button type="button" className="padm-list-row" onClick={() => school && onOpenSchool(school.id)} disabled={!school}>
                  <span className="padm-list-icon" aria-hidden="true"><SchoolIcon size={16} /></span>
                  <span className="padm-list-main">
                    <span className="padm-list-title">{school?.name || row.schoolId}</span>
                    <span className="padm-list-sub">{roleLabel(row.role)}{row.status !== 'active' ? ` · ${row.status}` : ''}</span>
                  </span>
                  {row.creator && <Badge tone="primary"><Crown size={12} aria-hidden="true" /> Creator</Badge>}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={SchoolIcon} title="Not in any school">This account only sees the "not part of any school" screen.</EmptyState>
      )}
    </Dialog>
  );
}

export function SchoolDetailDialog({ school, users, activity, now, rangeLabel, onClose, onOpenUser }) {
  const members = useMemo(() => users
    .filter(user => userSchoolIds(user).has(school.id))
    .map(user => ({
      user,
      role: user.memberships.find(item => item.schoolId === school.id)?.role || (user.createdSchools?.includes(school.id) ? 'admin' : null),
    }))
    .sort((a, b) => (b.user.lastSeenAt || '').localeCompare(a.user.lastSeenAt || '')), [users, school.id]);
  const roles = Object.entries(school.members.byRole).sort((a, b) => b[1] - a[1]);

  return (
    <Dialog title={school.name} subtitle={`Created ${formatDateTime(school.createdAt)}${school.academicYear ? ` · ${school.academicYear}` : ''}`} onClose={onClose} wide>
      <div className="padm-facts">
        <Fact label="Active members" value={formatNumber(school.members.active)} />
        <Fact label={`Active · ${rangeLabel.toLowerCase()}`} value={formatNumber(activity?.activeMembers || 0)} />
        <Fact label="Classes" value={school.classes === null ? '—' : formatNumber(school.classes)} />
        <Fact label="Lesson plans" value={school.lessonPlans === null ? '—' : formatNumber(school.lessonPlans)} />
        <Fact label="Last activity" value={relativeTime(activity?.lastActiveAt, now)} hint={formatDateTime(activity?.lastActiveAt)} />
        <Fact label="Creator" value={school.creatorEmail || '—'} hint={school.creatorExists ? undefined : 'Creator account no longer exists'} />
      </div>
      {!school.creatorExists && <p className="padm-footnote padm-footnote-warn">The creator's account no longer exists.</p>}
      {roles.length > 0 && (
        <div className="padm-badge-row padm-role-row">
          {roles.map(([role, count]) => <Badge key={role}>{roleLabel(role)} · {formatNumber(count)}</Badge>)}
        </div>
      )}
      <span className="padm-inline-copy padm-mono">{school.id}<CopyButton value={school.id} label="school ID" /></span>

      <h4 className="padm-section-title">Members by last seen</h4>
      {members.length ? (
        <ul className="padm-list">
          {members.map(({ user, role }) => (
            <li key={user.uid}>
              <button type="button" className="padm-list-row" onClick={() => onOpenUser(user.uid)}>
                <Avatar src={user.photoURL} name={user.name} size={32} />
                <span className="padm-list-main">
                  <span className="padm-list-title">{user.name}</span>
                  <span className="padm-list-sub">{roleLabel(role)} · {user.email || user.uid}</span>
                </span>
                <span className="padm-list-meta" title={formatDateTime(user.lastSeenAt)}>{relativeTime(user.lastSeenAt, now)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Users} title="No active members" />
      )}
    </Dialog>
  );
}
