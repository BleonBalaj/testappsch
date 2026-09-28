/**
 * The uids allowed to see a conversation. Stored on the conversation as
 * `memberIds`; Firestore rules only let those accounts read or write it.
 * Keep in sync with deriveConversationMemberIds in functions/platformAdmin.js.
 */
export function conversationMemberIds(chat) {
  if (Array.isArray(chat?.memberIds) && chat.memberIds.length) return chat.memberIds;
  if (typeof chat?.id === 'string' && chat.id.startsWith('dm_')) {
    // Direct-message ids are `dm_<uidA>_<uidB>` with the pair sorted.
    const parts = chat.id.slice(3).split('_');
    if (parts.length === 2 && parts.every(Boolean) && parts[0] !== parts[1]) return parts;
  }
  const ids = Array.isArray(chat?.members)
    ? chat.members.map(member => member?.id).filter(id => typeof id === 'string' && id && !id.includes('/'))
    : [];
  return [...new Set(ids)];
}

/**
 * True once the server has confirmed the conversation document with this user
 * in it. Message listeners attach only then: rules check the stored document,
 * so listening earlier would be denied and the listener would stop.
 */
export function isPersistedConversation(chat, uid) {
  return Boolean(uid) && chat?.syncedToServer === true && Array.isArray(chat.memberIds) && chat.memberIds.includes(uid);
}

/**
 * Direct-message documents store the creator's view (the other person's name).
 * Show each participant their own view: the directory entry when there is one,
 * otherwise the other member's stored name.
 */
export function viewerConversation(stored, directoryEntry, uid) {
  if (stored.isGroup) return { ...(directoryEntry || {}), ...stored };
  if (directoryEntry) {
    return {
      ...directoryEntry,
      ...stored,
      name: directoryEntry.name,
      role: directoryEntry.role,
      roleType: directoryEntry.roleType,
      targetUid: directoryEntry.targetUid,
      members: directoryEntry.members,
    };
  }
  const other = Array.isArray(stored.members) ? stored.members.find(member => member?.id && member.id !== uid) : null;
  return other?.name ? { ...stored, name: other.name } : stored;
}
