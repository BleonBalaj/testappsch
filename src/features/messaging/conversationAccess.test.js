import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationMemberIds, isPersistedConversation, viewerConversation } from './conversationAccess.js';

test('stored member lists win, then the DM id, then group members', () => {
  assert.deepEqual(conversationMemberIds({ id: 'dm_a_b', memberIds: ['a', 'b'] }), ['a', 'b']);
  assert.deepEqual(conversationMemberIds({ id: 'dm_a_b' }), ['a', 'b']);
  assert.deepEqual(conversationMemberIds({ id: 'grp_1', members: [{ id: 'host' }, { id: 's1' }, { id: 's1' }, {}] }), ['host', 's1']);
  assert.deepEqual(conversationMemberIds({ id: 'dm_a_a' }), []);
  assert.deepEqual(conversationMemberIds(null), []);
});

test('only server-confirmed conversations with this user count as persisted', () => {
  assert.equal(isPersistedConversation({ memberIds: ['a', 'b'], syncedToServer: true }, 'a'), true);
  assert.equal(isPersistedConversation({ memberIds: ['a', 'b'], syncedToServer: true }, 'c'), false);
  // A chat just created locally is not listenable until the server has it.
  assert.equal(isPersistedConversation({ memberIds: ['a', 'b'] }, 'a'), false);
  assert.equal(isPersistedConversation({ memberIds: ['a', 'b'], syncedToServer: false }, 'a'), false);
  assert.equal(isPersistedConversation({ id: 'dm_a_b' }, 'a'), false);
});

test('each DM participant sees the other person, not the name the creator stored', () => {
  const stored = { id: 'dm_a_b', isGroup: false, name: 'Bea', lastMessage: 'hi', memberIds: ['a', 'b'],
    members: [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bea' }] };
  const directory = { id: 'dm_a_b', name: 'Ada', role: 'Teacher', roleType: 'staff', targetUid: 'a', members: [] };
  const viewed = viewerConversation(stored, directory, 'b');
  assert.equal(viewed.name, 'Ada');
  assert.equal(viewed.lastMessage, 'hi');
  assert.deepEqual(viewed.memberIds, ['a', 'b']);
  assert.equal(viewerConversation(stored, null, 'b').name, 'Ada');
  assert.equal(viewerConversation({ ...stored, isGroup: true, name: 'Club' }, null, 'b').name, 'Club');
});
