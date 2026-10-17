import test from 'node:test';
import assert from 'node:assert/strict';
import { filterHistoryGroups, hasHistoryFilters, HISTORY_FILTER_DEFAULTS } from './historyFilters.js';
import { groupHistoryEvents } from './historySessions.js';

const filters = patch => ({ ...HISTORY_FILTER_DEFAULTS, ...patch });
const event = (id, minute, extra = {}) => ({ eventId: id, at: new Date(Date.UTC(2026, 9, 15, 21, minute)), actorUid: 'author', actorName: 'Shqipe', actorEmail: 'shqipe@school.test', action: 'update', shareToken: 's', reviewStatus: 'pending', plan: { homework: id, lessonUnit: 'Bashkësitë', subject: 'Matematikë' }, ...extra });
const rows = [event('last', 30), event('middle', 20, { plan: { homework: 'Krahaso elementet', lessonUnit: 'Bashkësitë', subject: 'Matematikë' } }), event('first', 10), event('shared', 0, { action: 'share', plan: { homework: 'Fillimi', lessonUnit: 'Bashkësitë' } })];

test('one Comments filter includes new messages and earlier feedback/replies without mixing review actions',()=>{
 const groups=groupHistoryEvents(['comment','feedback','reply','review'].map((action,index)=>event(action,30-index,{action,feedback:{message:'A message'}})));
 const found=filterHistoryGroups(groups,filters({action:'comment'}));
 assert.deepEqual(found.map(group=>group.latest.action),['comment','feedback','reply']);
 assert.equal(filterHistoryGroups(groups,filters({action:'comment',search:'message'})).length,3);
});

test('history search matches Albanian accents, person/email, translated fields and intermediate changed text', () => {
  const groups = groupHistoryEvents(rows);
  assert.equal(filterHistoryGroups(groups, filters({ search: 'bashkesite' }), { language: 'sq' }).length, 2);
  assert.equal(filterHistoryGroups(groups, filters({ search: 'shqipe@school.test elementet' }), { language: 'sq' }).length, 1);
  assert.equal(filterHistoryGroups(groups, filters({ search: 'detyrat' }), { language: 'sq' }).length, 1);
  const [session] = filterHistoryGroups(groups, filters({ search: 'Krahaso elementet' }));
  assert.equal(session.events.length, 3);
  assert.equal(session.changes[0].before, 'Fillimi');
  assert.equal(session.changes[0].after, 'last');
});

test('history criteria must match the same event and never merge sessions across review actions', () => {
  const review = event('review', 25, { actorUid: 'admin', actorName: 'Admin', action: 'review', reviewStatus: 'reviewing' });
  const groups = groupHistoryEvents([rows[0], review, ...rows.slice(1)]);
  assert.equal(groups.length, 4);
  assert.equal(filterHistoryGroups(groups, filters({ actor: 'admin', action: 'review', status: 'reviewing' })).length, 1);
  assert.equal(filterHistoryGroups(groups, filters({ actor: 'author', action: 'review' })).length, 0);
  const mixed = groupHistoryEvents([event('pending', 30), event('old-state', 20, { reviewStatus: 'reviewing' }), rows.at(-1)]);
  assert.equal(filterHistoryGroups(mixed, filters({ search: 'pending', status: 'reviewing' })).length, 0);
});

test('history date filters use local action dates and keep an entire session that crosses midnight', () => {
  const groups = groupHistoryEvents([event('after-midnight', 65), event('before-midnight', 50), event('share', 40, { action: 'share' })]);
  const options = { now: new Date('2026-10-16T12:00:00Z') };
  const [session] = filterHistoryGroups(groups, filters({ date: 'today' }), options);
  assert.equal(session.events.length, 2);
  assert.equal(session.oldest.eventId, 'before-midnight');
  assert.equal(filterHistoryGroups(groups, filters({ date: 'custom', from: '2026-10-16', to: '2026-10-16' })).length, 1);
  assert.equal(filterHistoryGroups(groups, filters({ date: 'custom', to: '2026-10-15' })).length, 2);
  assert.equal(filterHistoryGroups(groups, filters({ date: 'custom', from: '2026-10-17', to: '2026-10-15' })).length, 0);
});

test('system actions and archived review states can be found independently from author edits', () => {
  const groups = groupHistoryEvents([
    event('system', 40, { actorUid: 'system', action: 'auto_reopen' }),
    event('admin', 35, { actorUid: 'admin', action: 'review', reviewStatus: 'archived' }), ...rows,
  ]);
  assert.equal(filterHistoryGroups(groups, filters({ search: 'automatik', actor: 'system' }), { language: 'sq' })[0].latest.eventId, 'system');
  assert.equal(filterHistoryGroups(groups, filters({ status: 'archived' }))[0].latest.eventId, 'admin');
  assert.equal(filterHistoryGroups(groups, filters({ action: 'unshare' })).length, 0);
  assert.equal(hasHistoryFilters(filters({ from: '2026-10-01' })), false);
  assert.equal(hasHistoryFilters(filters({ date: 'custom' })), true);
  assert.equal(hasHistoryFilters(filters({ search: '  ' })), false);
});

test('timestamps from Firestore work with inclusive date boundaries and invalid dates are not matched', () => {
  const groups = groupHistoryEvents([
    event('firestore', 30, { action: 'share', at: { toDate: () => new Date('2026-10-15T22:00:00Z'), toMillis: () => Date.parse('2026-10-15T22:00:00Z') } }),
    event('invalid', 20, { action: 'share', at: 'bad-date' }),
  ]);
  assert.deepEqual(filterHistoryGroups(groups, filters({ date: 'custom', from: '2026-10-16', to: '2026-10-16' })).map(group => group.key), ['firestore']);
});
