import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Send, MoreVertical, Phone, Video, Smile, 
  CheckCheck, Hash, UserPlus, Paperclip, Mic, Pin, 
  Star, Image, FileText, Check, X, PhoneOff, MicOff, 
  VideoOff, Shield, GraduationCap, HeartHandshake, 
  Sparkles, Filter, MessageSquare, Download, Volume2, 
  ChevronRight, CornerDownLeft, Settings, Users, Trash2, 
  VolumeX, UserX, UserCheck, Lock, Megaphone, AlertCircle, 
  PlusCircle, FileDown, Eye
} from 'lucide-react';
import { useSchoolData } from '../context/SchoolDataContext';
import { useAuth } from '../context/AuthContext';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, query, where, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { conversationMemberIds, isPersistedConversation, viewerConversation } from '../features/messaging/conversationAccess';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from '../components/Avatar';
import { classGroupsById, studentClassLabel } from '../features/classGroups';
import { fetchStudentsByIds, useClassRoster, useStudentCounts, useStudentSearch } from '../features/students/studentData';
import './Messages.css';

const STUDENT_TOTAL_SPEC = [{ kind: 'all' }];

const INITIAL_CHATS = [];
const INITIAL_THREAD = {};
const EMOJI_REACTIONS = ['👍', '❤️', '🌟', '🎉', '🔥', '👏', '💡', '✅'];

const Messages = ({ userRole = 'admin' }) => {
  const { staffList = [], classGroups = [], myStudentRecord, studentsVersion } = useSchoolData();
  const { activeSchoolId, currentUser } = useAuth();
  const { t, isAlbanian } = useLanguage();
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher';
  const isStudentRole = userRole === 'student';
  const groupsById = useMemo(() => classGroupsById(classGroups), [classGroups]);
  // Students are never loaded in bulk: a student's classmates are a bounded
  // list, everyone else is found through the server-side search.
  const classmates = useClassRoster(activeSchoolId, isStudentRole ? myStudentRecord?.classGroupId || '' : '');
  const studentTotal = useStudentCounts(activeSchoolId, STUDENT_TOTAL_SPEC, studentsVersion).get(STUDENT_TOTAL_SPEC[0]);
  const studentLabel = useCallback(student => {
    const label = studentClassLabel(student, groupsById);
    return label ? `${isAlbanian ? 'Klasa' : 'Class'} ${label}` : (isAlbanian ? 'Nxënës' : 'Student');
  }, [groupsById, isAlbanian]);

  const [chats, setChats] = useState(INITIAL_CHATS);
  const [activeChat, setActiveChat] = useState(null);
  const [threads, setThreads] = useState(INITIAL_THREAD);
  const [messageInput, setMessageInput] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'direct', 'groups', 'starred'
  
  // Modals & Panels
  const [isTyping, setIsTyping] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isChannelSettingsOpen, setIsChannelSettingsOpen] = useState(false);
  const [channelSettingsTab, setChannelSettingsTab] = useState('members'); // 'members', 'files', 'settings'
  
  // Calling simulation
  const [callModal, setCallModal] = useState(null);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  
  // Interactive features
  const [selectedEmojiTarget, setSelectedEmojiTarget] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [searchInThread, setSearchInThread] = useState('');
  const [isThreadSearchOpen, setIsThreadSearchOpen] = useState(false);

  // New Chat Modal Form State
  const [newChatTab, setNewChatTab] = useState('all'); // 'all', 'staff', 'students', 'create_group'
  const [newChatSearch, setNewChatSearch] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTopic, setNewGroupTopic] = useState('');
  const [groupFilterTab, setGroupFilterTab] = useState('all'); // 'all', 'staff', 'students'
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  // Add Member to existing channel
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const messagesEndRef = useRef(null);
  // Conversation ids the server has confirmed; see isPersistedConversation.
  const syncedConversationIdsRef = useRef(new Set());
  // Names of direct-message partners that are not in the loaded directory
  // (students), read by id when a conversation does not carry them.
  const peerNamesRef = useRef({});
  const applyPeerName = useCallback((chat) => {
    if (!chat?.nameUnresolved || !chat.peerUid) return chat;
    const name = peerNamesRef.current[chat.peerUid];
    return name ? { ...chat, name, nameUnresolved: false } : chat;
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [threads, activeChat, isTyping]);

  // 1. Listen to real conversations from Firestore and merge with school members
  useEffect(() => {
    if (!activeSchoolId || !currentUser?.uid) return;
    // Only conversations this user belongs to; rules reject any wider read.
    const colRef = query(
      collection(db, 'schools', activeSchoolId, 'conversations'),
      where('memberIds', 'array-contains', currentUser.uid)
    );
    syncedConversationIdsRef.current = new Set();
    // Metadata changes report when a locally created chat reaches the server.
    const unsub = onSnapshot(colRef, { includeMetadataChanges: true }, (snapshot) => {
      const convs = [];
      snapshot.forEach(docSnap => {
        if (!docSnap.metadata.hasPendingWrites) syncedConversationIdsRef.current.add(docSnap.id);
        convs.push({ id: docSnap.id, ...docSnap.data(), syncedToServer: syncedConversationIdsRef.current.has(docSnap.id) });
      });

      // Directory contacts
      const dirContacts = [
        ...staffList.filter(s => s.id !== currentUser?.uid).map(s => ({
          id: `dm_${[currentUser?.uid || 'user', s.id].sort().join('_')}`,
          targetUid: s.id,
          name: s.name,
          role: s.roleName || s.department || 'Faculty',
          roleType: 'staff',
          lastMessage: 'Direct Message',
          time: 'Active',
          unread: 0,
          online: true,
          starred: false,
          isGroup: false,
          members: [
            { id: currentUser?.uid, name: currentUser?.displayName || currentUser?.email || '', role: 'Member' },
            { id: s.id, name: s.name, role: 'Faculty' }
          ]
        })),
        ...classmates.students.filter(st => st.id !== currentUser?.uid).map(st => ({
          id: `dm_${[currentUser?.uid || 'user', st.id].sort().join('_')}`,
          targetUid: st.id,
          name: st.name,
          role: studentLabel(st),
          roleType: 'student',
          lastMessage: 'Direct Message',
          time: 'Active',
          unread: 0,
          online: true,
          starred: false,
          isGroup: false,
          members: [
            { id: currentUser?.uid, name: currentUser?.displayName || currentUser?.email || '', role: 'Member' },
            { id: st.id, name: st.name, role: 'Student' }
          ]
        }))
      ];

      const mergedMap = new Map();
      dirContacts.forEach(c => mergedMap.set(c.id, c));
      convs.forEach(c => {
        const directoryEntry = mergedMap.get(c.id);
        let viewed = viewerConversation(c, directoryEntry, currentUser?.uid);
        // A direct message from someone outside the loaded directory: its stored
        // name is the sender's view, so resolve the other person's name by id.
        if (!directoryEntry && !c.isGroup && typeof c.id === 'string' && c.id.startsWith('dm_')) {
          const peerUid = c.id.slice(3).split('_').find(id => id && id !== currentUser?.uid);
          const storedPeer = Array.isArray(c.members) ? c.members.find(member => member?.id === peerUid) : null;
          if (peerUid && (!storedPeer?.name || storedPeer.name === 'You')) viewed = applyPeerName({ ...viewed, peerUid, nameUnresolved: true, name: '…' });
        }
        mergedMap.set(c.id, viewed);
      });

      const finalChats = Array.from(mergedMap.values());
      setChats(finalChats);

      setActiveChat(prev => {
        if (!prev && finalChats.length > 0) return finalChats[0];
        if (prev) {
          const updated = finalChats.find(c => c.id === prev.id);
          return updated ? { ...prev, ...updated } : prev;
        }
        return prev;
      });
    }, (err) => console.warn('Conversations sync notice:', err.message));

    return () => unsub();
  }, [activeSchoolId, staffList, classmates.students, studentLabel, currentUser?.uid, applyPeerName]);

  useEffect(() => {
    if (!activeSchoolId) return;
    const ids = [...new Set(chats.filter(chat => chat.nameUnresolved && chat.peerUid && !(chat.peerUid in peerNamesRef.current)).map(chat => chat.peerUid))];
    if (!ids.length) return;
    ids.forEach(id => { peerNamesRef.current[id] = ''; });
    fetchStudentsByIds(activeSchoolId, ids).then((students) => {
      students.forEach(student => { peerNamesRef.current[student.id] = student.name || ''; });
      setChats(previous => previous.map(applyPeerName));
      setActiveChat(previous => applyPeerName(previous));
    }).catch(error => console.warn('Could not load conversation names:', error.message));
  }, [chats, activeSchoolId, applyPeerName]);

  // 2. Listen to real messages in activeChat once its conversation document exists
  const activeChatPersisted = isPersistedConversation(activeChat, currentUser?.uid);
  useEffect(() => {
    if (!activeSchoolId || !activeChat?.id || !activeChatPersisted) return;
    const msgsCol = collection(db, 'schools', activeSchoolId, 'conversations', String(activeChat.id), 'messages');
    const msgsQuery = query(msgsCol, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(msgsQuery, (snapshot) => {
      const msgs = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const isMe = data.senderUid === currentUser?.uid || data.sender === 'me';
        msgs.push({
          id: docSnap.id,
          ...data,
          sender: isMe ? 'me' : 'them'
        });
      });
      setThreads(prev => ({
        ...prev,
        [activeChat.id]: msgs
      }));
    }, (err) => console.warn('Messages sync notice:', err.message));

    return () => unsub();
  }, [activeSchoolId, activeChat?.id, activeChatPersisted, currentUser?.uid]);

  const currentMessages = useMemo(() => {
    if (!activeChat) return [];
    const raw = threads[activeChat.id] || [];

    if (!searchInThread.trim()) return raw;
    return raw.filter(m => (m.text || '').toLowerCase().includes(searchInThread.toLowerCase()));
  }, [threads, activeChat, searchInThread]);

  // Filtered Chats in Left Sidebar
  const filteredChats = useMemo(() => {
    return chats.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(chatSearch.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(chatSearch.toLowerCase()) ||
        c.role.toLowerCase().includes(chatSearch.toLowerCase());

      if (!matchesSearch) return false;
      if (filterTab === 'starred') return !!c.starred;
      if (filterTab === 'groups') return !!c.isGroup;
      if (filterTab === 'direct') return !c.isGroup;
      return true;
    });
  }, [chats, chatSearch, filterTab]);

  // Staff are a short list searched locally; students come from the server.
  const chatStudentSearch = useStudentSearch(activeSchoolId, newChatSearch, { max: 30, enabled: isNewChatOpen && (newChatTab === 'all' || newChatTab === 'students') });
  const groupStudentSearch = useStudentSearch(activeSchoolId, groupSearchQuery, { max: 30, enabled: isNewChatOpen && newChatTab === 'create_group' && groupFilterTab !== 'staff' });
  const memberStudentSearch = useStudentSearch(activeSchoolId, memberSearch, { max: 20, enabled: isChannelSettingsOpen });
  const staffMatching = useCallback((text) => {
    const lower = text.trim().toLowerCase();
    return staffList.filter(member => member.id !== currentUser?.uid &&
      (!lower || [member.name, member.staffId, member.department, member.subject, member.roleName, member.email].some(value => String(value || '').toLowerCase().includes(lower))));
  }, [staffList, currentUser?.uid]);
  const studentsFor = useCallback((text, search) => (text.trim() ? search.results : classmates.students)
    .filter(student => student.id !== currentUser?.uid && student.status !== 'archived'), [classmates.students, currentUser?.uid]);

  // Filtered Directory in Direct Chat Tab
  const modalDirectoryUsers = useMemo(() => {
    let list = [];
    if (newChatTab === 'all' || newChatTab === 'staff') {
      list = [...list, ...staffMatching(newChatSearch).map(s => ({ ...s, userType: 'staff' }))];
    }
    if (newChatTab === 'all' || newChatTab === 'students') {
      list = [...list, ...studentsFor(newChatSearch, chatStudentSearch).map(st => ({ ...st, userType: 'student' }))];
    }
    return list;
  }, [newChatTab, newChatSearch, staffMatching, studentsFor, chatStudentSearch]);

  // Filtered Directory in Group Channel Creation Tab
  const filteredGroupCandidates = useMemo(() => {
    let list = [];
    if (groupFilterTab === 'all' || groupFilterTab === 'staff') {
      list = [...list, ...staffMatching(groupSearchQuery).map(s => ({ ...s, userType: 'staff' }))];
    }
    if (groupFilterTab === 'all' || groupFilterTab === 'students') {
      list = [...list, ...studentsFor(groupSearchQuery, groupStudentSearch).map(st => ({ ...st, userType: 'student' }))];
    }
    return list;
  }, [groupFilterTab, groupSearchQuery, staffMatching, studentsFor, groupStudentSearch]);

  const memberCandidates = useMemo(() => [
    ...staffMatching(memberSearch).map(member => ({ id: member.id, name: member.name, role: 'Faculty', detail: member.department || member.roleName || '' })),
    ...studentsFor(memberSearch, memberStudentSearch).map(student => ({ id: student.id, name: student.name, role: 'Student', detail: studentLabel(student) })),
  ], [memberSearch, staffMatching, studentsFor, memberStudentSearch, studentLabel]);

  const studentsHint = (text, search) => {
    if (text.trim()) return search.loading ? (isAlbanian ? 'Duke kërkuar nxënës…' : 'Searching students…') : '';
    return isStudentRole
      ? (isAlbanian ? 'Po shfaqen shokët e klasës. Shkruani për të kërkuar nxënës të tjerë.' : 'Showing your classmates. Type to find other students.')
      : (isAlbanian ? 'Shkruani emrin, email-in ose ID-në për të gjetur nxënës.' : 'Type a name, email or ID to find students.');
  };


  // Send Message
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!activeChat) return;
    if (!messageInput.trim() && !attachedFile) return;

    // Check if active channel is announcement only for non-moderators
    if (activeChat.isGroup && activeChat.announcementOnly && !isAdminOrTeacher) {
      alert("This channel is in Announcement Only mode. Only teachers and administrators can post.");
      return;
    }
    
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const textContent = messageInput.trim() + (attachedFile ? `\n📎 Attached: ${attachedFile.name}` : '');
    const msgId = `msg_${Date.now()}`;

    const newMsg = {
      id: msgId,
      senderUid: currentUser?.uid || 'user',
      senderName: currentUser?.displayName || currentUser?.email || 'User',
      sender: 'me',
      text: textContent,
      time: nowStr,
      status: 'sent',
      reactions: [],
      attachment: attachedFile ? { name: attachedFile.name, size: '2.5 MB' } : null,
      createdAt: serverTimestamp()
    };

    setMessageInput('');
    setAttachedFile(null);

    if (activeSchoolId && activeChat?.id) {
      try {
        const memberIds = conversationMemberIds(activeChat);
        if (!currentUser?.uid || !memberIds.includes(currentUser.uid)) {
          throw new Error('You are not a member of this conversation.');
        }
        const msgRef = doc(db, 'schools', activeSchoolId, 'conversations', String(activeChat.id), 'messages', msgId);
        const convRef = doc(db, 'schools', activeSchoolId, 'conversations', String(activeChat.id));
        // One batch: the first message of a new chat creates its conversation too.
        const batch = writeBatch(db);
        batch.set(convRef, {
          id: String(activeChat.id),
          memberIds,
          // Both participants' names, so each side can title the chat correctly.
          ...(!activeChat.isGroup && Array.isArray(activeChat.members) && activeChat.members.length
            ? { members: activeChat.members.filter(member => member?.id).map(member => ({
              id: String(member.id),
              name: member.id === currentUser?.uid ? (currentUser?.displayName || currentUser?.email || '') : String(member.name || ''),
              role: member.role || 'Member',
            })) }
            : {}),
          name: activeChat.name,
          role: activeChat.role || 'Member',
          roleType: activeChat.roleType || 'direct',
          isGroup: Boolean(activeChat.isGroup),
          topic: activeChat.topic || '',
          lastMessage: textContent,
          time: nowStr,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        batch.set(msgRef, newMsg);
        await batch.commit();
      } catch (err) {
        console.warn('Error saving message to Firestore:', err.message);
      }
    }
  };

  // Reactions
  const handleAddReaction = async (messageId, emoji) => {
    const thread = threads[activeChat?.id] || [];
    const msg = thread.find(m => m.id === messageId);
    if (!msg || !activeSchoolId || !activeChat?.id) return;
    const current = msg.reactions || [];
    const updated = current.includes(emoji)
      ? current.filter(e => e !== emoji)
      : [...current, emoji];

    setSelectedEmojiTarget(null);
    try {
      const msgRef = doc(db, 'schools', activeSchoolId, 'conversations', String(activeChat.id), 'messages', String(messageId));
      await updateDoc(msgRef, { reactions: updated });
    } catch (e) {
      console.warn('Could not update reaction:', e.message);
    }
  };

  // Moderate / Delete Message
  const handleDeleteMessage = async (messageId) => {
    if (!activeSchoolId || !activeChat?.id) return;
    try {
      const msgRef = doc(db, 'schools', activeSchoolId, 'conversations', String(activeChat.id), 'messages', String(messageId));
      await deleteDoc(msgRef);
    } catch (e) {
      console.warn('Could not delete message:', e.message);
    }
  };

  // Pin Message as Announcement
  const handlePinMessage = async (text) => {
    const cleanText = text.replace(/📎 Attached: .*/g, '').trim();
    if (!activeSchoolId || !activeChat?.id) return;
    try {
      const convRef = doc(db, 'schools', activeSchoolId, 'conversations', String(activeChat.id));
      await updateDoc(convRef, { pinnedMessage: cleanText });
    } catch (e) {
      console.warn('Could not pin message:', e.message);
    }
  };

  // Toggle chat bookmark / star
  const handleToggleChatStar = async (chatId) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat || !activeSchoolId) return;
    try {
      const convRef = doc(db, 'schools', activeSchoolId, 'conversations', String(chatId));
      await updateDoc(convRef, { starred: !chat.starred });
    } catch (e) {
      console.warn('Could not toggle star:', e.message);
    }
  };

  // Start Direct Chat
  const handleStartDirectChat = useCallback(async (user, type) => {
    const dmId = `dm_${[currentUser?.uid || 'user', user.id].sort().join('_')}`;
    const newChatObj = {
      id: dmId,
      targetUid: user.id,
      name: user.name,
      role: type === 'staff' ? (user.roleName || user.department || 'Faculty') : studentLabel(user),
      roleType: type,
      memberIds: conversationMemberIds({ id: dmId }),
      lastMessage: 'Direct conversation',
      time: 'Active',
      unread: 0,
      online: true,
      starred: false,
      isGroup: false,
      members: [
        { id: currentUser?.uid, name: currentUser?.displayName || currentUser?.email || '', role: 'Member' },
        { id: user.id, name: user.name, role: type }
      ]
    };

    setActiveChat(newChatObj);
    setIsNewChatOpen(false);

    if (activeSchoolId) {
      try {
        const convRef = doc(db, 'schools', activeSchoolId, 'conversations', dmId);
        await setDoc(convRef, newChatObj, { merge: true });
      } catch (e) {
        console.warn('Could not register conversation in Firestore:', e.message);
      }
    }
  }, [currentUser, activeSchoolId, studentLabel]);

  // Create Group Channel
  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || !activeSchoolId) return;

    const groupId = `grp_${Date.now()}`;
    const groupMembers = selectedGroupMembers.map(u => ({
      id: u.id,
      name: u.name,
      role: u.userType === 'staff' ? 'Faculty' : 'Student',
      muted: false
    }));

    const newGroup = {
      id: groupId,
      name: newGroupName.trim(),
      role: 'Group Channel',
      roleType: 'group',
      lastMessage: `Channel created with ${groupMembers.length + 1} members`,
      time: 'Just now',
      unread: 0,
      online: true,
      isGroup: true,
      announcementOnly: false,
      pinnedMessage: newGroupTopic.trim() || 'Welcome to the new channel!',
      members: [
        { id: currentUser?.uid, name: currentUser?.displayName || 'You (Host)', role: 'Moderator', isModerator: true, muted: false },
        ...groupMembers
      ],
      memberIds: [...new Set([currentUser?.uid, ...groupMembers.map(m => m.id)].filter(Boolean))],
      sharedFiles: [],
      starred: true,
      createdAt: serverTimestamp()
    };

    setActiveChat(newGroup);
    setIsNewChatOpen(false);
    setNewGroupName('');
    setNewGroupTopic('');
    setSelectedGroupMembers([]);

    try {
      const convRef = doc(db, 'schools', activeSchoolId, 'conversations', groupId);
      await setDoc(convRef, newGroup);
    } catch (e) {
      console.warn('Could not save group to Firestore:', e.message);
    }
  };

  // Moderation: Mute/Unmute Member
  const handleToggleMuteMember = (memberId) => {
    const updatedMembers = (activeChat.members || []).map(m => 
      m.id === memberId ? { ...m, muted: !m.muted } : m
    );
    const updated = { ...activeChat, members: updatedMembers };
    setActiveChat(updated);
    setChats(prev => prev.map(c => c.id === activeChat.id ? updated : c));
  };

  // Moderation: Remove Member from Group
  const handleRemoveMember = (memberId) => {
    const updatedMembers = (activeChat.members || []).filter(m => m.id !== memberId);
    const updated = { ...activeChat, members: updatedMembers };
    setActiveChat(updated);
    setChats(prev => prev.map(c => c.id === activeChat.id ? updated : c));
  };

  // Moderation: Add Member to Group
  const handleAddMemberToGroup = () => {
    if (!selectedMemberToAdd) return;
    const candidate = memberCandidates.find(u => String(u.id) === String(selectedMemberToAdd));
    if (!candidate) return;
    const userToAdd = { id: candidate.id, name: candidate.name, role: candidate.role };

    if (activeChat.members?.some(m => String(m.id) === String(userToAdd.id))) {
      alert("This member is already in the channel!");
      return;
    }

    const updatedMembers = [...(activeChat.members || []), { ...userToAdd, muted: false }];
    const updated = { ...activeChat, members: updatedMembers };
    setActiveChat(updated);
    setChats(prev => prev.map(c => c.id === activeChat.id ? updated : c));
    setSelectedMemberToAdd('');
  };

  // Moderation: Delete Shared File
  const handleDeleteSharedFile = (fileId) => {
    const updatedFiles = (activeChat.sharedFiles || []).filter(f => f.id !== fileId);
    const updated = { ...activeChat, sharedFiles: updatedFiles };
    setActiveChat(updated);
    setChats(prev => prev.map(c => c.id === activeChat.id ? updated : c));
  };

  // Moderation: Toggle Announcement Only
  const handleToggleAnnouncementMode = () => {
    const updated = { ...activeChat, announcementOnly: !activeChat.announcementOnly };
    setActiveChat(updated);
    setChats(prev => prev.map(c => c.id === activeChat.id ? updated : c));
  };

  return (
    <div className="messages-page full-immersion">
      {/* ── Left Sidebar ── */}
      <div className="messages-sidebar glass">
        <div className="messages-header">
          <div className="messages-title-row">
            <div className="title-with-badge">
              <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                {t('messages.title', 'Messages')}
                <MessageSquare size={24} style={{ color: 'hsl(var(--primary))' }} />
              </h2>
              <span className="msg-count-pill glass">
                {chats.reduce((acc, c) => acc + (c.unread || 0), 0)} {isAlbanian ? 'Të Paparë' : 'Unread'}
              </span>
            </div>
            <button 
              className="new-chat-btn bouncy" 
              onClick={() => setIsNewChatOpen(true)}
              title={t('messages.newChat', 'Start New Chat or Channel')}
            >
              <UserPlus size={18} />
            </button>
          </div>

          {/* Search bar */}
          <div className="chat-search-wrap">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder={t('messages.searchPlaceholder', 'Search conversations, staff, students...')} 
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
            />
            {chatSearch && (
              <button className="clear-btn" onClick={() => setChatSearch('')}><X size={14} /></button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="msg-filter-pills">
            <button 
              className={`msg-tab-pill ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              {t('common.all', 'All')} ({chats.length})
            </button>
            <button 
              className={`msg-tab-pill ${filterTab === 'direct' ? 'active' : ''}`}
              onClick={() => setFilterTab('direct')}
            >
              {t('messages.direct', 'Direct')}
            </button>
            <button 
              className={`msg-tab-pill ${filterTab === 'groups' ? 'active' : ''}`}
              onClick={() => setFilterTab('groups')}
            >
              {t('messages.channels', 'Channels')}
            </button>
            <button 
              className={`msg-tab-pill ${filterTab === 'starred' ? 'active' : ''}`}
              onClick={() => setFilterTab('starred')}
            >
              ⭐ {t('messages.starred', 'Starred')}
            </button>
          </div>
        </div>
        
        {/* Chat List */}
        <div className="chats-list">
          {filteredChats.length === 0 ? (
            <div className="empty-chats-box">
              <MessageSquare size={26} className="muted-icon" />
              <p>{isAlbanian ? 'Nuk u gjet asnjë bisedë' : 'No conversations found'}</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <motion.div 
                key={chat.id}
                className={`chat-preview glass ${activeChat?.id === chat.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveChat(chat);
                  setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
                }}
                whileHover={{ x: 3 }}
                layout
              >
                <div className="chat-avatar">
                  {chat.isGroup ? (
                    <div className="group-avatar-box">
                      <Hash size={22} />
                    </div>
                  ) : (
                    <Avatar alt={chat.name} />
                  )}
                  {chat.online && <span className="online-indicator"></span>}
                </div>

                <div className="chat-preview-info">
                  <div className="chat-preview-top">
                    <span className="chat-name">{chat.name}</span>
                    <span className="chat-time">{chat.time}</span>
                  </div>
                  <div className="chat-preview-bottom">
                    <span className="chat-last-msg">{chat.lastMessage}</span>
                    <div className="chat-preview-badges">
                      {chat.starred && <Star size={12} fill="hsl(var(--mood-neutral))" color="hsl(var(--mood-neutral))" />}
                      {chat.unread > 0 && <span className="chat-badge">{chat.unread}</span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* ── Main Chat Window ── */}
      <div className="chat-window glass">
        {!activeChat ? (
          <div className="empty-chat-pane glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', gap: '1.25rem', padding: '3rem 2rem', textAlign: 'center' }}>
            <div className="empty-icon-wrap" style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'hsla(var(--primary), 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))' }}>
              <MessageSquare size={34} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem', fontWeight: 700 }}>{t('messages.noConversation', 'No Conversation Selected')}</h3>
              <p style={{ margin: 0, color: 'hsl(var(--muted-foreground))', maxWidth: '360px', fontSize: '0.92rem', lineHeight: '1.5' }}>
                {t('messages.noConversationDesc', 'Select a conversation from the sidebar or click "New Chat" to connect with staff, teachers, or students.')}
              </p>
            </div>
            <button type="button" className="btn-primary" onClick={() => setIsNewChatOpen(true)}>
              <PlusCircle size={16} /> {t('messages.newConversation', 'New Conversation')}
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="chat-window-header">
          <div className="chat-header-user">
            <div className="chat-avatar large">
              {activeChat.isGroup ? (
                <div className="group-avatar-box large">
                  <Hash size={26} />
                </div>
              ) : (
                <Avatar alt={activeChat.name} />
              )}
              {activeChat.online && <span className="online-indicator"></span>}
            </div>
            <div className="chat-header-meta">
              <div className="chat-header-title-row">
                <h3>{activeChat.name}</h3>
                <button 
                  className={`star-chat-btn ${activeChat.starred ? 'active' : ''}`}
                  onClick={() => handleToggleChatStar(activeChat.id)}
                  title="Bookmark Conversation"
                >
                  <Star size={16} fill={activeChat.starred ? 'hsl(var(--mood-neutral))' : 'none'} />
                </button>
              </div>
              <p>
                {activeChat.isGroup 
                  ? `${activeChat.members?.length || 24} Members • ${activeChat.announcementOnly ? '📢 Announcement Mode' : 'Interactive Channel'}`
                  : `${activeChat.role} • ${activeChat.online ? '🟢 Online & Available' : '⚪ Offline'}`
                }
              </p>
            </div>
          </div>

          <div className="chat-header-actions">
            <button 
              className={`icon-btn bouncy ${isThreadSearchOpen ? 'active' : ''}`}
              onClick={() => setIsThreadSearchOpen(!isThreadSearchOpen)}
              title="Search in Thread"
            >
              <Search size={18} />
            </button>
            <button 
              className="icon-btn bouncy" 
              onClick={() => setCallModal({ type: 'audio', user: activeChat.name })}
              title="Start Voice Call"
            >
              <Phone size={18} />
            </button>
            <button 
              className="icon-btn bouncy" 
              onClick={() => setCallModal({ type: 'video', user: activeChat.name })}
              title="Start Video Meeting"
            >
              <Video size={18} />
            </button>
            <button 
              className={`icon-btn bouncy ${isChannelSettingsOpen ? 'active' : ''}`}
              onClick={() => setIsChannelSettingsOpen(!isChannelSettingsOpen)}
              title={activeChat.isGroup ? "Group Management & Settings" : "Chat Information"}
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Search in Thread Toolbar */}
        <AnimatePresence>
          {isThreadSearchOpen && (
            <motion.div 
              className="thread-search-bar glass"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <Search size={15} />
              <input 
                type="text" 
                placeholder="Search messages in this thread..." 
                value={searchInThread}
                onChange={(e) => setSearchInThread(e.target.value)}
                autoFocus
              />
              {searchInThread && (
                <button className="clear-search-btn" onClick={() => setSearchInThread('')}>
                  <X size={14} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pinned Announcement / Reminder Banner */}
        {activeChat.pinnedMessage && (
          <div className="pinned-message-banner glass">
            <div className="pin-icon-wrap">
              <Pin size={14} className="pin-icon" />
            </div>
            <div className="pin-text">
              <strong>Pinned Notice:</strong> {activeChat.pinnedMessage}
            </div>
          </div>
        )}

        {/* Message Thread Area */}
        <div className="chat-messages-area">
          <div className="conversation-start-badge glass">
            <span>🔒 End-to-end encrypted school communication</span>
          </div>

          {currentMessages.length === 0 && (
            <div style={{
              margin: 'auto',
              textAlign: 'center',
              padding: '2.5rem 1.5rem',
              maxWidth: '360px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'hsla(var(--primary), 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'hsl(var(--primary))'
              }}>
                <MessageSquare size={26} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'hsl(var(--card-foreground))' }}>
                {isAlbanian ? 'Filloni Bisedën' : 'Start the Conversation'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                {isAlbanian 
                  ? `Dërgoni mesazhin e parë për ${activeChat.name}. Biseda ruhet automatikisht në cloud.`
                  : `Send the first message to ${activeChat.name}. Your conversation is automatically saved in real time.`}
              </p>
            </div>
          )}

          <AnimatePresence>
            {currentMessages.map((msg) => (
              <motion.div 
                key={msg.id} 
                className={`message-bubble-wrapper ${msg.sender === 'me' ? 'sent' : 'received'}`}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                layout
              >
                {msg.sender === 'them' && (
                  <div className="message-avatar">
                    <Avatar alt={msg.senderName || activeChat.name} />
                  </div>
                )}

                <div className="message-content-column">
                  {activeChat.isGroup && msg.sender === 'them' && (
                    <span className="group-sender-label">{msg.senderName || activeChat.name}</span>
                  )}

                  <div className={`message-bubble ${msg.sender === 'me' ? 'me' : 'them'}`}>
                    <p>{msg.text}</p>
                    
                    <div className="message-meta-box">
                      <span className="message-time">{msg.time}</span>
                      {msg.sender === 'me' && (
                        <CheckCheck size={14} color={msg.status === 'read' ? 'hsl(var(--mood-happy))' : 'currentColor'} />
                      )}
                    </div>
                  </div>

                  {/* Reaction Badges */}
                  {(msg.reactions && msg.reactions.length > 0) && (
                    <div className="message-reactions-row">
                      {msg.reactions.map((r, i) => (
                        <span key={i} className="reaction-bubble glass" onClick={() => handleAddReaction(msg.id, r)}>
                          {r}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Message Hover Actions (Reactions, Pin, Delete) */}
                  <div className="message-hover-actions">
                    <button 
                      className="msg-action-icon-btn glass" 
                      onClick={() => setSelectedEmojiTarget(selectedEmojiTarget === msg.id ? null : msg.id)}
                      title="Add Reaction"
                    >
                      <Smile size={13} />
                    </button>

                    {isAdminOrTeacher && (
                      <button 
                        className="msg-action-icon-btn glass" 
                        onClick={() => handlePinMessage(msg.text)}
                        title="Pin as Notice"
                      >
                        <Pin size={13} />
                      </button>
                    )}

                    {(isAdminOrTeacher || msg.sender === 'me') && (
                      <button 
                        className="msg-action-icon-btn delete glass" 
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="Delete / Moderate Message"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}

                    {selectedEmojiTarget === msg.id && (
                      <div className="emoji-quick-picker glass">
                        {EMOJI_REACTIONS.map(emoji => (
                          <button key={emoji} onClick={() => handleAddReaction(msg.id, emoji)}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {isTyping && (
              <motion.div 
                className="message-bubble-wrapper received"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="message-avatar">
                  <Avatar alt={activeChat.name} />
                </div>
                <div className="message-bubble them typing-bubble">
                  <div className="typing-dots">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Attachment preview if selected */}

        {attachedFile && (
          <div className="attachment-preview-bar glass">
            <div className="attachment-chip">
              <FileText size={15} />
              <span>{attachedFile.name}</span>
            </div>
            <button className="remove-att-btn" onClick={() => setAttachedFile(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Message Input Form */}
        <div className="chat-input-area">
          <form className="chat-input-form glass" onSubmit={handleSend}>
            {/* Attachment Button */}
            <label className="icon-input-btn" title="Attach Document or Image">
              <Paperclip size={18} />
              <input 
                type="file" 
                style={{ display: 'none' }} 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setAttachedFile(e.target.files[0]);
                  }
                }} 
              />
            </label>

            <input 
              type="text" 
              placeholder={isAlbanian ? `Mesazh në ${activeChat.name}...` : `Message in ${activeChat.name}...`} 
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
            />

            <button 
              type="button" 
              className="icon-input-btn" 
              onClick={() => setMessageInput(prev => prev + " ✨")}
              title="Add Magic Sparkles"
            >
              <Sparkles size={18} />
            </button>

            <button 
              type="submit" 
              className="send-btn bouncy" 
              disabled={!messageInput.trim() && !attachedFile}
              title={t('messages.send', 'Send Message')}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
        </>
      )}
      </div>

      {/* ── Channel Management & Moderation Drawer ── */}
      <AnimatePresence>
        {isChannelSettingsOpen && activeChat && (
          <motion.div 
            className="channel-drawer glass"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          >
            <div className="drawer-header">
              <div className="drawer-title-wrap">
                <Settings size={20} className="drawer-icon" />
                <h3>{activeChat.isGroup ? 'Channel Settings' : 'Profile & Files'}</h3>
              </div>
              <button className="icon-btn-close" onClick={() => setIsChannelSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="drawer-tabs glass">
              <button 
                className={`drawer-tab ${channelSettingsTab === 'members' ? 'active' : ''}`}
                onClick={() => setChannelSettingsTab('members')}
              >
                <Users size={14} />
                {activeChat.isGroup ? `Members (${activeChat.members?.length || 0})` : 'Participants'}
              </button>
              <button 
                className={`drawer-tab ${channelSettingsTab === 'files' ? 'active' : ''}`}
                onClick={() => setChannelSettingsTab('files')}
              >
                <FileText size={14} />
                Files ({activeChat.sharedFiles?.length || 0})
              </button>
              {activeChat.isGroup && (
                <button 
                  className={`drawer-tab ${channelSettingsTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setChannelSettingsTab('settings')}
                >
                  <Shield size={14} />
                  Rules
                </button>
              )}
            </div>

            <div className="drawer-content">
              {/* TAB: Members & Moderation */}
              {channelSettingsTab === 'members' && (
                <div className="drawer-pane">
                  {/* Add Member Box for Admins/Teachers */}
                  {isAdminOrTeacher && activeChat.isGroup && (
                    <div className="add-member-widget glass">
                      <label>Add Participant:</label>
                      <div className="add-member-input-row">
                        <input
                          type="text"
                          value={memberSearch}
                          onChange={(e) => { setMemberSearch(e.target.value); setSelectedMemberToAdd(''); }}
                          placeholder={isAlbanian ? 'Kërko staf ose nxënës…' : 'Search staff or students…'}
                          aria-label={isAlbanian ? 'Kërko pjesëmarrës' : 'Search participants'}
                        />
                        <select 
                          value={selectedMemberToAdd}
                          onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                          className="custom-form-select"
                        >
                          <option value="">{isAlbanian ? 'Zgjidhni stafin ose nxënësin…' : 'Select faculty or student…'}</option>
                          {memberCandidates.map(u => <option key={`${u.role}_${u.id}`} value={u.id}>{u.name}{u.detail ? ` (${u.detail})` : ''}</option>)}
                        </select>
                        <button 
                          className="btn-primary btn-sm"
                          onClick={handleAddMemberToGroup}
                          disabled={!selectedMemberToAdd}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="drawer-members-list">
                    {(activeChat.members || []).map((member) => (
                      <div key={member.id} className="drawer-member-card glass">
                        <div className="member-avatar-box">
                          <Avatar alt={member.name} />
                          {member.muted && <span className="muted-badge" title="Student is Muted">🔇</span>}
                        </div>

                        <div className="member-meta">
                          <div className="member-name-row">
                            <strong>{member.name}</strong>
                            {member.isModerator && <span className="mod-pill">Mod</span>}
                          </div>
                          <span className="member-role-label">
                            {member.role || 'Member'}
                          </span>
                        </div>

                        {/* Moderation Actions for Admins/Teachers */}
                        {isAdminOrTeacher && activeChat.isGroup && (
                          <div className="member-mod-actions">
                            <button 
                              className={`mod-action-btn ${member.muted ? 'active-mute' : ''}`}
                              onClick={() => handleToggleMuteMember(member.id)}
                              title={member.muted ? "Unmute Student" : "Mute Student from Sending Messages"}
                            >
                              {member.muted ? <Volume2 size={14} /> : <VolumeX size={14} />}
                            </button>
                            <button 
                              className="mod-action-btn remove"
                              onClick={() => handleRemoveMember(member.id)}
                              title="Remove from Channel"
                            >
                              <UserX size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: Shared Files & Media */}
              {channelSettingsTab === 'files' && (
                <div className="drawer-pane">
                  <div className="drawer-files-list">
                    {(activeChat.sharedFiles || []).length === 0 ? (
                      <div className="empty-files-box">
                        <FileText size={28} className="muted-icon" />
                        <p>No documents or media shared yet.</p>
                      </div>
                    ) : (
                      (activeChat.sharedFiles || []).map((file) => (
                        <div key={file.id} className="drawer-file-card glass">
                          <div className="file-icon-box">
                            <FileText size={18} />
                          </div>
                          <div className="file-meta">
                            <strong>{file.name}</strong>
                            <span>{file.size} • By {file.sender}</span>
                          </div>
                          <div className="file-actions">
                            <button className="file-action-btn" title="Download Document">
                              <FileDown size={15} />
                            </button>
                            {isAdminOrTeacher && (
                              <button 
                                className="file-action-btn delete" 
                                title="Delete / Moderate File"
                                onClick={() => handleDeleteSharedFile(file.id)}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB: Rules & Settings */}
              {channelSettingsTab === 'settings' && activeChat.isGroup && (
                <div className="drawer-pane">
                  <div className="channel-rule-card glass">
                    <div className="rule-header">
                      <Megaphone size={18} className="rule-icon" />
                      <div>
                        <strong>Announcement Only Mode</strong>
                        <p>Only teachers and administrators can post in this channel.</p>
                      </div>
                    </div>
                    {isAdminOrTeacher ? (
                      <button 
                        className={`toggle-mode-btn ${activeChat.announcementOnly ? 'enabled' : 'disabled'}`}
                        onClick={handleToggleAnnouncementMode}
                      >
                        {activeChat.announcementOnly ? 'Enabled (Restricted)' : 'Disabled (Open Chat)'}
                      </button>
                    ) : (
                      <span className="rule-status-badge">{activeChat.announcementOnly ? 'Restricted' : 'Open'}</span>
                    )}
                  </div>

                  <div className="channel-rule-card glass">
                    <strong>Channel Topic</strong>
                    <input 
                      type="text" 
                      value={activeChat.pinnedMessage || ''}
                      placeholder="Set pinned channel topic..."
                      onChange={(e) => handlePinMessage(e.target.value)}
                      className="custom-form-select"
                      disabled={!isAdminOrTeacher}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Start New Chat & Group Creator ── */}
      <AnimatePresence>
        {isNewChatOpen && (
          <div className="modal-overlay" onClick={() => setIsNewChatOpen(false)}>
            <motion.div 
              className="modal-content new-chat-dialog-modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close Button */}
              <button className="icon-btn-close" onClick={() => setIsNewChatOpen(false)} aria-label="Close">
                <X size={16} />
              </button>

              {/* Main Mode Toggle: Direct Message vs Group Channel */}
              <div className="new-chat-mode-tabs">
                <button 
                  type="button"
                  className={`mode-tab-btn ${newChatTab !== 'create_group' ? 'active' : ''}`}
                  onClick={() => setNewChatTab('all')}
                >
                  <MessageSquare size={16} />
                  {isAlbanian ? 'Mesazh Direkt' : 'Direct Message'}
                </button>
                <button 
                  type="button"
                  className={`mode-tab-btn ${newChatTab === 'create_group' ? 'active' : ''}`}
                  onClick={() => setNewChatTab('create_group')}
                >
                  <Users size={16} />
                  {isAlbanian ? 'Kanal i Ri Grupor' : 'New Group Channel'}
                </button>
              </div>

              {/* MODE 1: Direct Message Directory */}
              {newChatTab !== 'create_group' && (
                <div className="direct-chat-pane">
                  {/* Category Filter Pills (Staff vs Students) */}
                  <div className="directory-filter-row">
                    <button 
                      type="button"
                      className={`dir-filter-pill ${newChatTab === 'all' ? 'active' : ''}`}
                      onClick={() => setNewChatTab('all')}
                    >
                      {isAlbanian ? 'Të Gjithë' : 'All Users'} ({studentTotal === undefined ? '…' : (staffList.length + studentTotal).toLocaleString()})
                    </button>
                    <button 
                      type="button"
                      className={`dir-filter-pill ${newChatTab === 'staff' ? 'active' : ''}`}
                      onClick={() => setNewChatTab('staff')}
                    >
                      👨‍🏫 {isAlbanian ? 'Mësimdhënësit & Stafi' : 'Faculty & Staff'} ({staffList.length})
                    </button>
                    <button 
                      type="button"
                      className={`dir-filter-pill ${newChatTab === 'students' ? 'active' : ''}`}
                      onClick={() => setNewChatTab('students')}
                    >
                      🎓 {isAlbanian ? 'Nxënësit' : 'Students'} ({studentTotal === undefined ? '…' : studentTotal.toLocaleString()})
                    </button>
                  </div>

                  {/* Prominent Search Bar */}
                  <div className="new-chat-search-bar">
                    <Search size={17} className="search-icon" />
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'Shkruani emrin, email-in, ID-në, departamentin ose rolin…' : 'Type a name, email, ID, department or role…'} 
                      value={newChatSearch}
                      onChange={(e) => setNewChatSearch(e.target.value)}
                      autoFocus
                    />
                    {newChatSearch && (
                      <button type="button" className="clear-btn" onClick={() => setNewChatSearch('')}>
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  {newChatTab !== 'staff' && studentsHint(newChatSearch, chatStudentSearch) && (
                    <p className="directory-hint">{studentsHint(newChatSearch, chatStudentSearch)}</p>
                  )}

                  {/* Scrollable User Directory */}
                  <div className="new-chat-user-list">
                    {modalDirectoryUsers.length === 0 ? (
                      <div className="empty-directory-state">
                        <Users size={32} className="muted-icon" />
                        <p>{newChatSearch.trim()
                          ? <>{isAlbanian ? 'Asnjë anëtar nuk përputhet me' : 'No members found matching'} "<strong>{newChatSearch}</strong>"</>
                          : (isAlbanian ? 'Shkruani një emër për të filluar.' : 'Type a name to begin.')}</p>
                      </div>
                    ) : (
                      modalDirectoryUsers.map(user => (
                        <div 
                          key={`${user.userType}_${user.id}`} 
                          className="new-chat-user-row bouncy"
                          onClick={() => handleStartDirectChat(user, user.userType)}
                        >
                          <div className="user-avatar-box">
                            <Avatar alt={user.name} />
                          </div>

                          <div className="user-details">
                            <div className="user-title-line">
                              <strong className="user-name">{user.name}</strong>
                              <span className={`user-category-tag ${user.userType}`}>
                                {user.userType === 'staff' ? (isAlbanian ? 'Staf' : 'Staff') : (isAlbanian ? 'Nxënës' : 'Student')}
                              </span>
                            </div>
                            <span className="user-meta-sub">
                              {user.userType === 'staff' 
                                ? (user.roleName || user.department || 'Faculty') 
                                : studentLabel(user)
                              }
                            </span>
                          </div>

                          <button type="button" className="btn-primary btn-sm">
                            <MessageSquare size={14} />
                            Chat
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* MODE 2: Create Group Channel */}
              {newChatTab === 'create_group' && (
                <form onSubmit={handleCreateGroupSubmit} className="group-creator-pane">
                  <div className="form-grid-2">
                    <div className="input-group">
                      <label>{isAlbanian ? 'Emri i Kanalit *' : 'Channel Name *'}</label>
                      <input 
                        type="text" 
                        required 
                        placeholder={isAlbanian ? 'p.sh. Laboratori i Fizikës 10-A, Klubi i Robotikës' : 'e.g. Physics 10-A Lab, Robotics Team'}
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                      />
                    </div>

                    <div className="input-group">
                      <label>{isAlbanian ? 'Tema e Kanalit (Opsionale)' : 'Channel Topic (Optional)'}</label>
                      <input 
                        type="text" 
                        placeholder={isAlbanian ? 'p.sh. Pyetje & Përgjigje për detyrat, oraret e laboratorit' : 'e.g. Homework Q&A, lab schedules'}
                        value={newGroupTopic}
                        onChange={(e) => setNewGroupTopic(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="group-members-section">
                    <div className="group-pick-header">
                      <div className="header-label-row">
                        <label>{isAlbanian ? 'Zgjidhni Anëtarët Fillestarë' : 'Select Initial Members'}</label>
                        <span className="selected-counter-badge">
                          {selectedGroupMembers.length} {isAlbanian ? 'Të Zgjedhur' : 'Selected'}
                        </span>
                      </div>

                      {/* Staff vs Student Toggle Pills */}
                      <div className="directory-filter-row">
                        <button 
                          type="button"
                          className={`dir-filter-pill ${groupFilterTab === 'all' ? 'active' : ''}`}
                          onClick={() => setGroupFilterTab('all')}
                        >
                          {isAlbanian ? 'Të Gjithë' : 'All'} ({studentTotal === undefined ? '…' : (staffList.length + studentTotal).toLocaleString()})
                        </button>
                        <button 
                          type="button"
                          className={`dir-filter-pill ${groupFilterTab === 'staff' ? 'active' : ''}`}
                          onClick={() => setGroupFilterTab('staff')}
                        >
                          👨‍🏫 {isAlbanian ? 'Stafi' : 'Staff'} ({staffList.length})
                        </button>
                        <button 
                          type="button"
                          className={`dir-filter-pill ${groupFilterTab === 'students' ? 'active' : ''}`}
                          onClick={() => setGroupFilterTab('students')}
                        >
                          🎓 {isAlbanian ? 'Nxënësit' : 'Students'} ({studentTotal === undefined ? '…' : studentTotal.toLocaleString()})
                        </button>
                      </div>
                    </div>

                    {/* Member Quick Filter Search */}
                    <div className="new-chat-search-bar compact">
                      <Search size={15} className="search-icon" />
                      <input 
                        type="text" 
                        placeholder={isAlbanian ? 'Kërko sipas emrit, email-it, ID-së ose departamentit…' : 'Search by name, email, ID or department…'} 
                        value={groupSearchQuery}
                        onChange={(e) => setGroupSearchQuery(e.target.value)}
                      />
                      {groupSearchQuery && (
                        <button type="button" className="clear-btn" onClick={() => setGroupSearchQuery('')}>
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {selectedGroupMembers.length > 0 && (
                      <div className="selected-member-chips">
                        {selectedGroupMembers.map(member => (
                          <span key={`${member.userType}_${member.id}`} className="selected-member-chip">
                            {member.name}
                            <button type="button" onClick={() => setSelectedGroupMembers(prev => prev.filter(sel => String(sel.id) !== String(member.id)))}
                              aria-label={isAlbanian ? `Hiq ${member.name}` : `Remove ${member.name}`}>
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {groupFilterTab !== 'staff' && studentsHint(groupSearchQuery, groupStudentSearch) && (
                      <p className="directory-hint">{studentsHint(groupSearchQuery, groupStudentSearch)}</p>
                    )}

                    {/* Candidate Member Cards (Unconstrained, flows naturally with single modal scrollbar) */}
                    <div className="group-members-grid">
                      {filteredGroupCandidates.length === 0 ? (
                        <div className="empty-group-candidates">
                          <p>{groupSearchQuery.trim()
                            ? (isAlbanian ? `Asnjë kandidat nuk përputhet me "${groupSearchQuery}"` : `No candidates found matching "${groupSearchQuery}"`)
                            : (isAlbanian ? 'Shkruani një emër për të gjetur anëtarë.' : 'Type a name to find members.')}</p>
                        </div>
                      ) : (
                        filteredGroupCandidates.map(u => {
                          const isSelected = selectedGroupMembers.some(sel => String(sel.id) === String(u.id));
                          return (
                            <div 
                              key={`${u.userType}_${u.id}`}
                              className={`group-pick-card ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedGroupMembers(prev => prev.filter(sel => String(sel.id) !== String(u.id)));
                                } else {
                                  setSelectedGroupMembers(prev => [...prev, u]);
                                }
                              }}
                            >
                              <div className="avatar-xs">
                                <Avatar alt={u.name} />
                              </div>
                              <div className="pick-card-info">
                                <strong>{u.name}</strong>
                                <span>{u.userType === 'staff' ? (u.roleName || u.department || 'Staff') : studentLabel(u)}</span>
                              </div>
                              <div className={`checkbox-indicator ${isSelected ? 'checked' : ''}`}>
                                {isSelected && <Check size={12} />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="modal-footer-actions">
                    <button type="button" className="btn-secondary" onClick={() => setIsNewChatOpen(false)}>
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button type="submit" className="btn-primary" disabled={!newGroupName.trim()}>
                      <Check size={18} />
                      {isAlbanian ? 'Krijo Kanalin' : 'Create Channel'}
                    </button>
                  </div>
                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ── MODAL: Interactive Call Simulation ── */}
      <AnimatePresence>
        {callModal && (
          <div className="modal-overlay" onClick={() => setCallModal(null)}>
            <motion.div 
              className="modal-content call-modal glass"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="call-avatar-pulse">
                <Avatar alt={callModal.user} className="call-avatar" />
                <div className="pulse-ring"></div>
              </div>

              <h3>{callModal.type === 'video' ? 'Video Conference' : 'Voice Call'}</h3>
              <p className="call-status-text">Connected with {callModal.user} • 00:42</p>

              <div className="call-controls-row">
                <button 
                  className={`call-ctrl-btn ${isCallMuted ? 'muted' : 'glass'}`}
                  onClick={() => setIsCallMuted(!isCallMuted)}
                  title={isCallMuted ? "Unmute" : "Mute Mic"}
                >
                  {isCallMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                {callModal.type === 'video' && (
                  <button 
                    className={`call-ctrl-btn ${isCamOff ? 'muted' : 'glass'}`}
                    onClick={() => setIsCamOff(!isCamOff)}
                    title={isCamOff ? "Turn Cam On" : "Turn Cam Off"}
                  >
                    {isCamOff ? <VideoOff size={20} /> : <Video size={20} />}
                  </button>
                )}

                <button 
                  className="call-ctrl-btn end-call"
                  onClick={() => setCallModal(null)}
                  title="End Call"
                >
                  <PhoneOff size={22} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Messages;
