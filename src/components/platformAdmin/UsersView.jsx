import React, { useDeferredValue, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { Avatar } from '../Avatar';
import { Badge, Card, EmptyState, Pagination } from './shared';
import { AccountBadges } from './Dialogs';
import { filterUsers, sortUsers, userSchoolIds, USER_SORTS, USER_STATUS_FILTERS } from '../../features/platformAdmin/metrics';
import { formatDate, formatDateTime, formatNumber, relativeTime, roleLabel } from '../../features/platformAdmin/format';

const PAGE_SIZE = 25;

function SchoolChips({ user, schoolsById }) {
  const ids = [...userSchoolIds(user)];
  if (!ids.length) return <span className="padm-muted">—</span>;
  const shown = ids.slice(0, 2);
  return (
    <span className="padm-chip-row">
      {shown.map(id => {
        const membership = user.memberships.find(item => item.schoolId === id);
        const role = membership?.role || (user.createdSchools?.includes(id) ? 'admin' : null);
        return <Badge key={id} title={schoolsById.get(id)?.name}>{roleLabel(role)} · {schoolsById.get(id)?.name || 'Unknown'}</Badge>;
      })}
      {ids.length > shown.length && <Badge>+{ids.length - shown.length}</Badge>}
    </span>
  );
}

export default function UsersView({ snapshot, range, schoolsById, now, onOpenUser }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('lastSeen');
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  const schoolNames = useMemo(() => new Map([...schoolsById].map(([id, school]) => [id, school.name])), [schoolsById]);
  const filtered = useMemo(
    () => sortUsers(filterUsers(snapshot.users, { query: deferredQuery, status, windowStart: range.start, schoolNames }), sort),
    [snapshot.users, deferredQuery, status, range.start, schoolNames, sort],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const resetPage = setter => value => { setter(value); setPage(1); };

  return (
    <Card title="All accounts" subtitle="Every login in Firebase Authentication, joined with school memberships">
      <div className="padm-toolbar">
        <label className="padm-search">
          <Search size={16} aria-hidden="true" />
          <span className="padm-sr-only">Search accounts</span>
          <input type="search" value={query} onChange={event => resetPage(setQuery)(event.target.value)} placeholder="Search name, email, user ID or school" />
        </label>
        <label className="padm-select">
          <span>Sort</span>
          <select className="custom-form-select" value={sort} onChange={event => resetPage(setSort)(event.target.value)}>
            {USER_SORTS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="padm-chips" role="group" aria-label="Filter accounts">
        {USER_STATUS_FILTERS.map(option => (
          <button key={option.id} type="button" className={`padm-chip ${status === option.id ? 'is-active' : ''}`}
            aria-pressed={status === option.id} onClick={() => resetPage(setStatus)(option.id)}>
            {option.id === 'active' ? `Active · ${range.option.label.toLowerCase()}` : option.label}
          </button>
        ))}
      </div>

      {rows.length ? (
        <div className="padm-table-wrap">
          <table className="padm-table">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col" className="padm-col-md">Schools &amp; roles</th>
                <th scope="col">Last seen</th>
                <th scope="col" className="padm-col-lg">Joined</th>
                <th scope="col" className="padm-col-lg padm-num">AI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(user => (
                <tr key={user.uid} onClick={() => onOpenUser(user.uid)}>
                  <td>
                    <button type="button" className="padm-row-link" onClick={event => { event.stopPropagation(); onOpenUser(user.uid); }}>
                      <Avatar src={user.photoURL} name={user.name} size={34} />
                      <span className="padm-list-main">
                        <span className="padm-list-title">{user.name}</span>
                        <span className="padm-list-sub">{user.email || user.uid}</span>
                      </span>
                    </button>
                    <span className="padm-badge-row padm-row-badges"><AccountBadges user={user} /></span>
                  </td>
                  <td className="padm-col-md"><SchoolChips user={user} schoolsById={schoolsById} /></td>
                  <td title={formatDateTime(user.lastSeenAt)}>{relativeTime(user.lastSeenAt, now)}</td>
                  <td className="padm-col-lg" title={formatDateTime(user.createdAt)}>{formatDate(user.createdAt, now)}</td>
                  <td className="padm-col-lg padm-num">{formatNumber(user.aiGenerations || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Users} title="No matching accounts">Try another search or filter.</EmptyState>
      )}
      <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} noun="accounts" onChange={setPage} />
    </Card>
  );
}
