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
import { Avatar } from '../components/Avatar';
import './Messages.css';

const INITIAL_CHATS = [
  { 
    id: 1, 
    name: 'Luna Star', 
    role: 'Student (10A)', 
    roleType: 'student', 
    lastMessage: 'Thanks for the assignment help! 🌟', 
    time: '10:42 AM', 
    unread: 2, 
    online: true,
    starred: true,
    pinnedMessage: 'Assignment 4 due this Friday at 5:00 PM',
    members: [
      { id: 101, name: 'Luna Star', role: 'Student', grade: '10A', muted: false }
    ],
    sharedFiles: [
      { id: 'f1', name: 'Calculus_Problem_Set_3.pdf', size: '2.4 MB', date: 'Yesterday', sender: 'Luna Star' }
    ]
  },
  { 
    id: 2, 
    name: 'Class 10-A Physics & Lab', 
    role: 'Course Channel', 
    roleType: 'group', 
    lastMessage: 'Prof. Wilson: Don\'t forget safety goggles for tomorrow\'s lab.', 
    time: '11:05 AM', 
    unread: 0, 
    online: true, 
    isGroup: true,
    announcementOnly: false,
    pinnedMessage: 'Midterm lab exam scheduled for Wednesday in Science Center Lab 1',
    members: [
      { id: 201, name: 'Dr. Sarah Smith', role: 'Faculty', isModerator: true, muted: false },
      { id: 202, name: 'Prof. James Wilson', role: 'Lead Instructor', isModerator: true, muted: false },
      { id: 203, name: 'Luna Star', role: 'Student', grade: '10A', muted: false },
      { id: 204, name: 'Oliver Twist', role: 'Student', grade: '9B', muted: false },
      { id: 205, name: 'Sophie Miller', role: 'Student', grade: '11C', muted: false },
      { id: 206, name: 'Felix Cat', role: 'Student', grade: '12A', muted: false }
    ],
    sharedFiles: [
      { id: 'f2', name: 'Physics_Lab_Safety_Protocol.pdf', size: '1.8 MB', date: '2 days ago', sender: 'Prof. James Wilson' },
      { id: 'f3', name: 'Oscilloscope_Experiment_Guide.docx', size: '3.1 MB', date: '3 days ago', sender: 'Dr. Sarah Smith' }
    ],
    starred: true
  },
  { 
    id: 3, 
    name: 'Dr. Sarah Smith', 
    role: 'Head of Mathematics', 
    roleType: 'staff', 
    lastMessage: 'The syllabus has been updated for AP Calculus.', 
    time: 'Yesterday', 
    unread: 0, 
    online: false,
    starred: false,
    members: [
      { id: 301, name: 'Dr. Sarah Smith', role: 'Faculty', muted: false }
    ],
    sharedFiles: []
  },
  { 
    id: 4, 
    name: 'Prof. James Wilson', 
    role: 'Senior Teacher (Physics)', 
    roleType: 'staff', 
    lastMessage: 'Lab equipment calibration is complete for Period 2.', 
    time: 'Yesterday', 
    unread: 0, 
    online: true,
    starred: false,
    members: [
      { id: 401, name: 'Prof. James Wilson', role: 'Faculty', muted: false }
    ],
    sharedFiles: []
  },
  { 
    id: 5, 
    name: 'Ms. Emily Brown', 
    role: 'Academic Counselor', 
    roleType: 'staff', 
    lastMessage: 'Meeting scheduled with student council tomorrow at 10.', 
    time: 'Tuesday', 
    unread: 0, 
    online: true,
    starred: false,
    members: [
      { id: 501, name: 'Ms. Emily Brown', role: 'Counselor', muted: false }
    ],
    sharedFiles: []
  },
  { 
    id: 6, 
    name: 'Oliver Twist', 
    role: 'Student (9B)', 
    roleType: 'student', 
    lastMessage: 'Can you check my math homework questions?', 
    time: 'Tuesday', 
    unread: 1, 
    online: true,
    starred: false,
    members: [
      { id: 601, name: 'Oliver Twist', role: 'Student', grade: '9B', muted: false }
    ],
    sharedFiles: []
  }
];

const INITIAL_THREAD = {
  1: [
    { id: 101, sender: 'them', text: 'Hi! I had a quick question about the calculus problem set.', time: '10:30 AM', status: 'read', reactions: ['👍'] },
    { id: 102, sender: 'me', text: 'Sure thing Luna! What part of problem #4 do you need help with?', time: '10:35 AM', status: 'read', reactions: [] },
    { id: 103, sender: 'them', text: 'Are we allowed to use numerical approximation or do we need the exact integration steps?', time: '10:40 AM', status: 'read', reactions: [] },
    { id: 104, sender: 'me', text: 'Please write out the step-by-step integration steps for full credit 📝', time: '10:41 AM', status: 'read', reactions: ['❤️'] },
    { id: 105, sender: 'them', text: 'Got it, thank you so much for the assignment help! 🌟', time: '10:42 AM', status: 'read', reactions: ['🎉'] },
  ],
  2: [
    { id: 201, sender: 'them', senderName: 'Oliver Twist', text: 'Did everyone finish the pre-lab questions?', time: '10:50 AM', status: 'read', reactions: ['👍'] },
    { id: 202, sender: 'them', senderName: 'Dr. Sarah Smith', text: 'Remember to review Section 4.2 before class tomorrow.', time: '11:00 AM', status: 'read', reactions: ['📚'] },
    { id: 203, sender: 'them', senderName: 'Prof. Wilson', text: 'Don\'t forget safety goggles for tomorrow\'s lab.', time: '11:05 AM', status: 'read', reactions: ['🔬', '🔥'] },
  ]
};

const CANNED_RESPONSES = [
  "Received! I will review this by EOD 📝",
  "Great question! Let's discuss in class tomorrow ⏰",
  "Office hours are open today 3:00–4:30 PM 🏢",
  "Approved! Keep up the fantastic progress 🌟"
];

const EMOJI_REACTIONS = ['👍', '❤️', '🌟', '🎉', '🔥', '👏', '💡', '✅'];

const Messages = ({ userRole = 'admin' }) => {
  const { staffList, studentsList } = useSchoolData();
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher';

  const [chats, setChats] = useState(INITIAL_CHATS);
  const [activeChat, setActiveChat] = useState(INITIAL_CHATS[0]);
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

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [threads, activeChat, isTyping]);

  const currentMessages = useMemo(() => {
    const raw = threads[activeChat.id] || [
      { id: 999, sender: 'them', text: `Hello! This is the start of your conversation in ${activeChat.name}.`, time: 'Earlier', status: 'read', reactions: [] }
    ];

    if (!searchInThread.trim()) return raw;
    return raw.filter(m => m.text.toLowerCase().includes(searchInThread.toLowerCase()));
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

  // Filtered Directory in Direct Chat Tab
  const modalDirectoryUsers = useMemo(() => {
    let list = [];
    if (newChatTab === 'all' || newChatTab === 'staff') {
      list = [...list, ...staffList.map(s => ({ ...s, userType: 'staff' }))];
    }
    if (newChatTab === 'all' || newChatTab === 'students') {
      list = [...list, ...studentsList.map(st => ({ ...st, userType: 'student' }))];
    }

    if (!newChatSearch.trim()) return list;
    const lower = newChatSearch.toLowerCase();
    return list.filter(u => 
      u.name.toLowerCase().includes(lower) || 
      (u.studentId && u.studentId.toLowerCase().includes(lower)) ||
      (u.staffId && u.staffId.toLowerCase().includes(lower)) ||
      (u.department && u.department.toLowerCase().includes(lower)) ||
      (u.subject && u.subject.toLowerCase().includes(lower)) ||
      (u.grade && u.grade.toLowerCase().includes(lower)) ||
      (u.roleName && u.roleName.toLowerCase().includes(lower))
    );
  }, [newChatTab, newChatSearch, staffList, studentsList]);

  // Filtered Directory in Group Channel Creation Tab
  const filteredGroupCandidates = useMemo(() => {
    let list = [];
    if (groupFilterTab === 'all' || groupFilterTab === 'staff') {
      list = [...list, ...staffList.map(s => ({ ...s, userType: 'staff' }))];
    }
    if (groupFilterTab === 'all' || groupFilterTab === 'students') {
      list = [...list, ...studentsList.map(st => ({ ...st, userType: 'student' }))];
    }

    if (!groupSearchQuery.trim()) return list;
    const lower = groupSearchQuery.toLowerCase();
    return list.filter(u => 
      u.name.toLowerCase().includes(lower) || 
      (u.studentId && u.studentId.toLowerCase().includes(lower)) ||
      (u.staffId && u.staffId.toLowerCase().includes(lower)) ||
      (u.department && u.department.toLowerCase().includes(lower)) ||
      (u.subject && u.subject.toLowerCase().includes(lower)) ||
      (u.grade && u.grade.toLowerCase().includes(lower)) ||
      (u.roleName && u.roleName.toLowerCase().includes(lower))
    );
  }, [groupFilterTab, groupSearchQuery, staffList, studentsList]);


  // Send Message
  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() && !attachedFile) return;

    // Check if active channel is announcement only for non-moderators
    if (activeChat.isGroup && activeChat.announcementOnly && !isAdminOrTeacher) {
      alert("This channel is in Announcement Only mode. Only teachers and administrators can post.");
      return;
    }
    
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const textContent = messageInput.trim() + (attachedFile ? `\n📎 Attached: ${attachedFile.name}` : '');

    const newMsg = {
      id: Date.now(),
      sender: 'me',
      text: textContent,
      time: nowStr,
      status: 'sent',
      reactions: [],
      attachment: attachedFile ? { name: attachedFile.name, size: '2.5 MB' } : null
    };
    
    setThreads(prev => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] || []), newMsg]
    }));

    if (attachedFile) {
      setChats(prev => prev.map(c => c.id === activeChat.id ? {
        ...c,
        sharedFiles: [
          ...(c.sharedFiles || []),
          { id: `f_${Date.now()}`, name: attachedFile.name, size: '2.5 MB', date: 'Just now', sender: 'You' }
        ]
      } : c));
    }

    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, lastMessage: textContent, time: nowStr } : c));

    setMessageInput('');
    setAttachedFile(null);

    // Auto-reply simulation for direct chats
    if (!activeChat.isGroup) {
      setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          const replyText = `Thanks for your message! I'm reviewing this right now. ✨`;
          const replyMsg = {
            id: Date.now() + 1,
            sender: 'them',
            text: replyText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'read',
            reactions: []
          };
          setThreads(prev => ({
            ...prev,
            [activeChat.id]: [...(prev[activeChat.id] || []), replyMsg]
          }));
          setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, lastMessage: replyText, time: replyMsg.time } : c));
        }, 1600);
      }, 800);
    }
  };

  // Reactions
  const handleAddReaction = (messageId, emoji) => {
    setThreads(prev => ({
      ...prev,
      [activeChat.id]: (prev[activeChat.id] || []).map(m => {
        if (m.id === messageId) {
          const current = m.reactions || [];
          const updated = current.includes(emoji)
            ? current.filter(e => e !== emoji)
            : [...current, emoji];
          return { ...m, reactions: updated };
        }
        return m;
      })
    }));
    setSelectedEmojiTarget(null);
  };

  // Moderate / Delete Message
  const handleDeleteMessage = (messageId) => {
    setThreads(prev => ({
      ...prev,
      [activeChat.id]: (prev[activeChat.id] || []).filter(m => m.id !== messageId)
    }));
  };

  // Pin Message as Announcement
  const handlePinMessage = (text) => {
    const cleanText = text.replace(/📎 Attached: .*/g, '').trim();
    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, pinnedMessage: cleanText } : c));
    setActiveChat(prev => ({ ...prev, pinnedMessage: cleanText }));
  };

  // Toggle chat bookmark / star
  const handleToggleChatStar = (chatId) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, starred: !c.starred } : c));
  };

  // Start Direct Chat
  const handleStartDirectChat = useCallback((user, type) => {
    const existing = chats.find(c => c.name === user.name && !c.isGroup);
    if (existing) {
      setActiveChat(existing);
    } else {
      const generatedId = Date.now();
      const newChatObj = {
        id: generatedId,
        name: user.name,
        role: type === 'staff' ? (user.roleName || user.department || 'Faculty') : `Student (${user.grade})`,
        roleType: type,
        lastMessage: 'Conversation started',
        time: 'Just now',
        unread: 0,
        online: true,
        starred: false,
        members: [{ id: user.id || generatedId, name: user.name, role: type, muted: false }],
        sharedFiles: []
      };
      setChats(prev => [newChatObj, ...prev]);
      setActiveChat(newChatObj);
    }
    setIsNewChatOpen(false);
  }, [chats]);

  // Create Group Channel
  const handleCreateGroupSubmit = (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const groupMembers = selectedGroupMembers.map(u => ({
      id: u.id,
      name: u.name,
      role: u.userType === 'staff' ? 'Faculty' : 'Student',
      muted: false
    }));

    const newGroup = {
      id: Date.now(),
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
        { id: 999, name: 'You (Host)', role: 'Moderator', isModerator: true, muted: false },
        ...groupMembers
      ],
      sharedFiles: [],
      starred: true
    };

    setChats(prev => [newGroup, ...prev]);
    setActiveChat(newGroup);
    setIsNewChatOpen(false);
    setNewGroupName('');
    setNewGroupTopic('');
    setSelectedGroupMembers([]);
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
    const allUsers = [
      ...staffList.map(s => ({ id: s.id, name: s.name, role: 'Faculty' })),
      ...studentsList.map(st => ({ id: st.id, name: st.name, role: 'Student' }))
    ];
    const userToAdd = allUsers.find(u => u.name === selectedMemberToAdd);
    if (!userToAdd) return;

    if (activeChat.members?.some(m => m.name === userToAdd.name)) {
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
                Messages
                <MessageSquare size={24} style={{ color: 'hsl(var(--primary))' }} />
              </h2>
              <span className="msg-count-pill glass">
                {chats.reduce((acc, c) => acc + (c.unread || 0), 0)} Unread
              </span>
            </div>
            <button 
              className="new-chat-btn bouncy" 
              onClick={() => setIsNewChatOpen(true)}
              title="Start New Chat or Channel"
            >
              <UserPlus size={18} />
            </button>
          </div>

          {/* Search bar */}
          <div className="chat-search-wrap">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search conversations, staff, students..." 
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
              All ({chats.length})
            </button>
            <button 
              className={`msg-tab-pill ${filterTab === 'direct' ? 'active' : ''}`}
              onClick={() => setFilterTab('direct')}
            >
              Direct
            </button>
            <button 
              className={`msg-tab-pill ${filterTab === 'groups' ? 'active' : ''}`}
              onClick={() => setFilterTab('groups')}
            >
              Channels
            </button>
            <button 
              className={`msg-tab-pill ${filterTab === 'starred' ? 'active' : ''}`}
              onClick={() => setFilterTab('starred')}
            >
              ⭐ Starred
            </button>
          </div>
        </div>
        
        {/* Chat List */}
        <div className="chats-list">
          {filteredChats.length === 0 ? (
            <div className="empty-chats-box">
              <MessageSquare size={26} className="muted-icon" />
              <p>No conversations found</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <motion.div 
                key={chat.id}
                className={`chat-preview glass ${activeChat.id === chat.id ? 'active' : ''}`}
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
              placeholder={`Message in ${activeChat.name}...`} 
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
              title="Send Message"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* ── Channel Management & Moderation Drawer ── */}
      <AnimatePresence>
        {isChannelSettingsOpen && (
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
                        <select 
                          value={selectedMemberToAdd}
                          onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                          className="custom-form-select"
                        >
                          <option value="">Select faculty or student...</option>
                          <optgroup label="Faculty & Staff">
                            {staffList.map(s => <option key={s.id} value={s.name}>{s.name} ({s.department})</option>)}
                          </optgroup>
                          <optgroup label="Enrolled Students">
                            {studentsList.map(st => <option key={st.id} value={st.name}>{st.name} (Grade {st.grade})</option>)}
                          </optgroup>
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
                            {member.role || 'Member'} {member.grade ? `• Grade ${member.grade}` : ''}
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
                  Direct Message
                </button>
                <button 
                  type="button"
                  className={`mode-tab-btn ${newChatTab === 'create_group' ? 'active' : ''}`}
                  onClick={() => setNewChatTab('create_group')}
                >
                  <Users size={16} />
                  New Group Channel
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
                      All Users ({staffList.length + studentsList.length})
                    </button>
                    <button 
                      type="button"
                      className={`dir-filter-pill ${newChatTab === 'staff' ? 'active' : ''}`}
                      onClick={() => setNewChatTab('staff')}
                    >
                      👨‍🏫 Faculty & Staff ({staffList.length})
                    </button>
                    <button 
                      type="button"
                      className={`dir-filter-pill ${newChatTab === 'students' ? 'active' : ''}`}
                      onClick={() => setNewChatTab('students')}
                    >
                      🎓 Students ({studentsList.length})
                    </button>
                  </div>

                  {/* Prominent Search Bar */}
                  <div className="new-chat-search-bar">
                    <Search size={17} className="search-icon" />
                    <input 
                      type="text" 
                      placeholder="Type a name, department, role, or grade..." 
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

                  {/* Scrollable User Directory */}
                  <div className="new-chat-user-list">
                    {modalDirectoryUsers.length === 0 ? (
                      <div className="empty-directory-state">
                        <Users size={32} className="muted-icon" />
                        <p>No members found matching "<strong>{newChatSearch}</strong>"</p>
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
                                {user.userType === 'staff' ? 'Staff' : 'Student'}
                              </span>
                            </div>
                            <span className="user-meta-sub">
                              {user.userType === 'staff' 
                                ? (user.roleName || user.department || 'Faculty') 
                                : `Grade ${user.grade} • Enrolled Student`
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
                      <label>Channel Name *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Physics 10-A Lab, Robotics Team"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                      />
                    </div>

                    <div className="input-group">
                      <label>Channel Topic (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Homework Q&A, lab schedules"
                        value={newGroupTopic}
                        onChange={(e) => setNewGroupTopic(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="group-members-section">
                    <div className="group-pick-header">
                      <div className="header-label-row">
                        <label>Select Initial Members</label>
                        <span className="selected-counter-badge">
                          {selectedGroupMembers.length} Selected
                        </span>
                      </div>

                      {/* Staff vs Student Toggle Pills */}
                      <div className="directory-filter-row">
                        <button 
                          type="button"
                          className={`dir-filter-pill ${groupFilterTab === 'all' ? 'active' : ''}`}
                          onClick={() => setGroupFilterTab('all')}
                        >
                          All ({staffList.length + studentsList.length})
                        </button>
                        <button 
                          type="button"
                          className={`dir-filter-pill ${groupFilterTab === 'staff' ? 'active' : ''}`}
                          onClick={() => setGroupFilterTab('staff')}
                        >
                          👨‍🏫 Staff ({staffList.length})
                        </button>
                        <button 
                          type="button"
                          className={`dir-filter-pill ${groupFilterTab === 'students' ? 'active' : ''}`}
                          onClick={() => setGroupFilterTab('students')}
                        >
                          🎓 Students ({studentsList.length})
                        </button>
                      </div>
                    </div>

                    {/* Member Quick Filter Search */}
                    <div className="new-chat-search-bar compact">
                      <Search size={15} className="search-icon" />
                      <input 
                        type="text" 
                        placeholder="Filter candidates by name, subject, grade..." 
                        value={groupSearchQuery}
                        onChange={(e) => setGroupSearchQuery(e.target.value)}
                      />
                      {groupSearchQuery && (
                        <button type="button" className="clear-btn" onClick={() => setGroupSearchQuery('')}>
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Candidate Member Cards (Unconstrained, flows naturally with single modal scrollbar) */}
                    <div className="group-members-grid">
                      {filteredGroupCandidates.length === 0 ? (
                        <div className="empty-group-candidates">
                          <p>No candidates found matching "{groupSearchQuery}"</p>
                        </div>
                      ) : (
                        filteredGroupCandidates.map(u => {
                          const isSelected = selectedGroupMembers.some(sel => sel.name === u.name);
                          return (
                            <div 
                              key={`${u.userType}_${u.id}`}
                              className={`group-pick-card ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedGroupMembers(prev => prev.filter(sel => sel.name !== u.name));
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
                                <span>{u.userType === 'staff' ? (u.roleName || u.department || 'Staff') : `Student • Gr. ${u.grade}`}</span>
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
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={!newGroupName.trim()}>
                      <Check size={18} />
                      Create Channel
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
