import React, { useDeferredValue, useMemo, useState } from 'react';
import { AlertTriangle, School as SchoolIcon, Search } from 'lucide-react';
import { Card, EmptyState, Pagination } from './shared';
import { formatDate, formatDateTime, formatNumber, relativeTime } from '../../features/platformAdmin/format';
import { compareIsoDesc } from '../../features/platformAdmin/metrics';

const PAGE_SIZE = 25;
const SORTS = [
  { id: 'activity', label: 'Last activity' },
  { id: 'members', label: 'Most members' },
  { id: 'newest', label: 'Newest' },
  { id: 'name', label: 'Name' },
];

export default function SchoolsView({ snapshot, range, activity, now, onOpenSchool }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('activity');
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const list = snapshot.schools.filter(school => !needle || [school.name, school.id, school.creatorEmail]
      .some(value => typeof value === 'string' && value.toLowerCase().includes(needle)));
    const lastActive = school => activity.get(school.id)?.lastActiveAt || '';
    return list.sort((a, b) => {
      if (sort === 'members') return b.members.active - a.members.active;
      if (sort === 'newest') return compareIsoDesc(a.createdAt, b.createdAt);
      if (sort === 'name') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return compareIsoDesc(lastActive(a), lastActive(b));
    });
  }, [snapshot.schools, deferredQuery, sort, activity]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Card title="All schools" subtitle="Rosters, content, and when each school was last used">
      <div className="padm-toolbar">
        <label className="padm-search">
          <Search size={16} aria-hidden="true" />
          <span className="padm-sr-only">Search schools</span>
          <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search school, ID or creator email" />
        </label>
        <label className="padm-select">
          <span>Sort</span>
          <select className="custom-form-select" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}>
            {SORTS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {rows.length ? (
        <div className="padm-table-wrap">
          <table className="padm-table">
            <thead>
              <tr>
                <th scope="col">School</th>
                <th scope="col" className="padm-num">Members</th>
                <th scope="col" className="padm-num padm-col-md">Active · {range.option.label.toLowerCase()}</th>
                <th scope="col" className="padm-num padm-col-lg">Courses</th>
                <th scope="col" className="padm-num padm-col-lg">Classes</th>
                <th scope="col" className="padm-num padm-col-lg">Lesson plans</th>
                <th scope="col">Last activity</th>
                <th scope="col" className="padm-col-lg">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(school => {
                const schoolActivity = activity.get(school.id);
                const students = school.members.byRole.student || 0;
                return (
                  <tr key={school.id} onClick={() => onOpenSchool(school.id)}>
                    <td>
                      <button type="button" className="padm-row-link" onClick={event => { event.stopPropagation(); onOpenSchool(school.id); }}>
                        <span className="padm-list-icon" aria-hidden="true"><SchoolIcon size={16} /></span>
                        <span className="padm-list-main">
                          <span className="padm-list-title">{school.name}</span>
                          <span className="padm-list-sub">
                            {!school.creatorExists && <AlertTriangle size={12} className="padm-warn-icon" aria-label="Creator account missing" />}
                            {school.creatorEmail || 'Unknown creator'}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="padm-num" title={`${students} students · ${school.members.active - students} staff`}>
                      {formatNumber(school.members.active)}
                      <span className="padm-list-sub padm-cell-sub">{formatNumber(students)} students</span>
                    </td>
                    <td className="padm-num padm-col-md">{formatNumber(schoolActivity?.activeMembers || 0)}</td>
                    <td className="padm-num padm-col-lg">{school.courses == null ? '—' : formatNumber(school.courses)}</td>
                    <td className="padm-num padm-col-lg">{school.classGroups == null ? '—' : formatNumber(school.classGroups)}</td>
                    <td className="padm-num padm-col-lg">{school.lessonPlans === null ? '—' : formatNumber(school.lessonPlans)}</td>
                    <td title={formatDateTime(schoolActivity?.lastActiveAt)}>
                      {relativeTime(schoolActivity?.lastActiveAt, now)}
                      {schoolActivity?.lastActiveName && <span className="padm-list-sub padm-cell-sub">{schoolActivity.lastActiveName}</span>}
                    </td>
                    <td className="padm-col-lg" title={formatDateTime(school.createdAt)}>{formatDate(school.createdAt, now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={SchoolIcon} title={snapshot.schools.length ? 'No matching schools' : 'No schools yet'} />
      )}
      <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} noun="schools" onChange={setPage} />
    </Card>
  );
}
