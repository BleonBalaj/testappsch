import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Video,
  Link as LinkIcon,
  ExternalLink,
  Search,
  Filter,
  Clock,
  BookOpen,
  LayoutGrid,
  List,
  Plus,
  X,
  Check,
  Bookmark,
  ChevronDown,
  Library,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useSchoolData } from '../context/SchoolDataContext';
import { useLanguage } from '../context/LanguageContext';
import { classGroupsById } from '../features/classGroups';
import { normalizeWebLink, safeWebLink } from '../features/links';
import './Resources.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' }
  }
};

const FORMAT_TYPES = ['All Types', 'PDF', 'Video', 'Link', 'Doc', 'Slides'];
const EMPTY_FORM = { title: '', type: 'PDF', url: '', courseId: '', classGroupId: '', author: '' };

const typeIcon = (type) => {
  switch (type) {
    case 'PDF': return <FileText size={24} color="hsl(var(--destructive))" />;
    case 'Video': return <Video size={24} color="hsl(var(--primary))" />;
    case 'Link': return <LinkIcon size={24} color="hsl(var(--mood-sad))" />;
    default: return <BookOpen size={24} color="hsl(var(--accent))" />;
  }
};

const ResourceCard = ({ resource, view, contextLabel, isBookmarked, onToggleBookmark, onDelete, isAlbanian }) => {
  const url = safeWebLink(resource.url);
  const openButton = url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={view === 'list' ? 'res-action-btn' : 'res-btn bouncy glass'}
      title={isAlbanian ? 'Hap materialin' : 'Open material'} aria-label={isAlbanian ? `Hap ${resource.title}` : `Open ${resource.title}`}>
      <ExternalLink size={view === 'list' ? 18 : 17} />
    </a>
  ) : (
    <span className={view === 'list' ? 'res-action-btn is-disabled' : 'res-btn glass is-disabled'} title={isAlbanian ? 'Ky material nuk ka lidhje' : 'This material has no link'}>
      <ExternalLink size={view === 'list' ? 18 : 17} />
    </span>
  );
  const bookmarkButton = (
    <button
      type="button"
      className={`bookmark-btn ${isBookmarked ? 'active' : ''}`}
      onClick={() => onToggleBookmark(resource.id)}
      title={isBookmarked ? (isAlbanian ? 'Hiq nga të ruajturat' : 'Remove bookmark') : (isAlbanian ? 'Ruaje' : 'Bookmark')}
      aria-pressed={isBookmarked}
    >
      <Bookmark size={view === 'list' ? 17 : 16} fill={isBookmarked ? "hsl(var(--primary))" : "none"} />
    </button>
  );
  const deleteButton = onDelete && (
    <button
      type="button"
      className="icon-btn-destructive"
      style={view === 'list' ? { padding: '0.35rem' } : { width: '36px', height: '36px', borderRadius: '10px' }}
      onClick={() => onDelete(resource)}
      title={isAlbanian ? 'Fshij materialin' : 'Delete material'}
      aria-label={isAlbanian ? `Fshij ${resource.title}` : `Delete ${resource.title}`}
    >
      <Trash2 size={view === 'list' ? 16 : 15} />
    </button>
  );
  const info = [contextLabel, resource.author].filter(Boolean).join(' • ');

  if (view === 'list') {
    return (
      <motion.div
        className="resource-list-item glass bouncy"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <div className="res-icon-wrap">{typeIcon(resource.type)}</div>
        <div className="res-main">
          <h4>{resource.title}</h4>
          <p>{info}</p>
        </div>
        <div className="res-meta">
          <span>{resource.date || ''}</span>
        </div>
        <div className="res-actions">
          {bookmarkButton}
          {openButton}
          {deleteButton}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="resource-card glass bouncy"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="resource-header">
        <div className="res-icon-box" style={{ background: `hsla(var(${resource.type === 'PDF' ? '--destructive' : '--primary'}), 0.12)` }}>
          {typeIcon(resource.type)}
        </div>
        <div className="res-header-right">
          {bookmarkButton}
        </div>
      </div>

      <div className="resource-body">
        <span className="res-type-label">{resource.type}</span>
        <h3>{resource.title}</h3>
        <p className="res-info">{info}</p>
      </div>

      <div className="resource-footer">
        <div className="res-size">
          <Clock size={13} />
          <span>{resource.date || '—'}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {openButton}
          {deleteButton}
        </div>
      </div>
    </motion.div>
  );
};

const Resources = ({ userRole = 'student' }) => {
  const canAddResources = ['admin', 'teacher', 'dept_head'].includes(userRole);
  const isAdmin = userRole === 'admin';
  const { activeSchoolId, currentUser } = useAuth();
  const { classesList = [], classGroups = [] } = useSchoolData();
  const { t, isAlbanian } = useLanguage();
  const groupsById = useMemo(() => classGroupsById(classGroups), [classGroups]);
  const [resourceState, setResourceState] = useState({ schoolId: null, items: [], error: null });
  const [bookmarkState, setBookmarkState] = useState({ key: '', ids: [] });
  const [activeScope, setActiveScope] = useState('all');
  const [activeType, setActiveType] = useState('All Types');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  // Real-time school library.
  useEffect(() => {
    if (!activeSchoolId) return undefined;
    const schoolId = activeSchoolId;
    return onSnapshot(collection(db, 'schools', schoolId, 'resources'), (snapshot) => {
      setResourceState({ schoolId, items: snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })), error: null });
    }, (err) => setResourceState({ schoolId, items: [], error: err }));
  }, [activeSchoolId]);
  const resources = useMemo(() => (resourceState.schoolId === activeSchoolId ? resourceState.items : []), [resourceState, activeSchoolId]);
  const resourcesLoaded = resourceState.schoolId === activeSchoolId;

  // Bookmarks are private to each person (users/{uid}/resourceBookmarks/{schoolId}).
  const bookmarkKey = currentUser?.uid && activeSchoolId ? `${currentUser.uid}|${activeSchoolId}` : '';
  useEffect(() => {
    if (!bookmarkKey) return undefined;
    return onSnapshot(doc(db, 'users', currentUser.uid, 'resourceBookmarks', activeSchoolId),
      (snapshot) => setBookmarkState({ key: bookmarkKey, ids: Array.isArray(snapshot.data()?.resourceIds) ? snapshot.data().resourceIds.map(String) : [] }),
      () => setBookmarkState({ key: bookmarkKey, ids: [] }));
  }, [bookmarkKey, currentUser?.uid, activeSchoolId]);
  const bookmarkIds = useMemo(() => new Set(bookmarkState.key === bookmarkKey ? bookmarkState.ids : []), [bookmarkState, bookmarkKey]);

  const courseById = useMemo(() => new Map(classesList.map(course => [String(course.id), course])), [classesList]);
  const contextLabel = (resource) => {
    const course = resource.courseId ? courseById.get(String(resource.courseId)) : null;
    const group = resource.classGroupId ? groupsById.get(String(resource.classGroupId)) : null;
    return [course?.name, group && `${isAlbanian ? 'Klasa' : 'Class'} ${group.label}`].filter(Boolean).join(' · ') || resource.category || (isAlbanian ? 'E gjithë shkolla' : 'Whole school');
  };

  // Filter menu built from the school's real courses and classes.
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const [scopeSearch, setScopeSearch] = useState('');
  const scopeRef = useRef(null);
  const scopeSearchRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target)) setIsScopeOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    if (isScopeOpen) scopeSearchRef.current?.focus();
  }, [isScopeOpen]);

  const scopeGroups = useMemo(() => [
    { category: isAlbanian ? 'Përgjithshme' : 'General', items: [
      { id: 'all', label: isAlbanian ? 'Të gjitha materialet' : 'All materials', desc: isAlbanian ? 'E gjithë biblioteka' : 'The whole library' },
      { id: 'school', label: isAlbanian ? 'E gjithë shkolla' : 'Whole school', desc: isAlbanian ? 'Pa lëndë ose klasë' : 'Not tied to a course or class' },
    ] },
    ...(classesList.length ? [{ category: isAlbanian ? 'Lëndët' : 'Courses', items: classesList.map(course => ({
      id: `course:${course.id}`, label: course.name, desc: [course.code, course.classGroupId && groupsById.get(String(course.classGroupId)) && `${isAlbanian ? 'Klasa' : 'Class'} ${groupsById.get(String(course.classGroupId)).label}`, course.teacher].filter(Boolean).join(' • '),
    })) }] : []),
    ...(classGroups.length ? [{ category: isAlbanian ? 'Klasat' : 'Classes', items: classGroups.map(group => ({
      id: `class:${group.id}`, label: `${isAlbanian ? 'Klasa' : 'Class'} ${group.label}`, desc: group.homeroomTeacherName || '',
    })) }] : []),
  ], [classesList, classGroups, groupsById, isAlbanian]);
  const currentScope = scopeGroups.flatMap(group => group.items).find(item => item.id === activeScope) || scopeGroups[0].items[0];
  const filteredScopeGroups = useMemo(() => {
    const query = scopeSearch.trim().toLowerCase();
    if (!query) return scopeGroups;
    return scopeGroups.map(group => ({ ...group, items: group.items.filter(item => `${item.label} ${item.desc}`.toLowerCase().includes(query)) }))
      .filter(group => group.items.length > 0);
  }, [scopeGroups, scopeSearch]);

  const matchesScope = (resource) => {
    if (activeScope === 'all') return true;
    if (activeScope === 'school') return !resource.courseId && !resource.classGroupId;
    if (activeScope.startsWith('course:')) return String(resource.courseId || '') === activeScope.slice(7);
    if (activeScope.startsWith('class:')) {
      const groupId = activeScope.slice(6);
      // A class's materials include those of the courses linked to it.
      return String(resource.classGroupId || '') === groupId ||
        String(courseById.get(String(resource.courseId || ''))?.classGroupId || '') === groupId;
    }
    return true;
  };

  const query = search.trim().toLowerCase();
  const filteredResources = resources
    .filter(r => matchesScope(r) &&
      (activeType === 'All Types' || r.type === activeType) &&
      (!bookmarkedOnly || bookmarkIds.has(String(r.id))) &&
      (!query || [r.title, r.author, contextLabel(r)].some(value => String(value || '').toLowerCase().includes(query))))
    .sort((a, b) => String(b.createdAtMs || b.id).localeCompare(String(a.createdAtMs || a.id)));

  const canDelete = (resource) => isAdmin || (canAddResources && resource.createdByUid && resource.createdByUid === currentUser?.uid);

  const handleToggleBookmark = async (id) => {
    if (!currentUser?.uid || !activeSchoolId) return;
    const key = String(id);
    try {
      await setDoc(doc(db, 'users', currentUser.uid, 'resourceBookmarks', activeSchoolId), {
        resourceIds: bookmarkIds.has(key) ? arrayRemove(key) : arrayUnion(key),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.warn('Could not update bookmark:', e.message);
    }
  };

  const openAdd = () => {
    const scopedCourse = activeScope.startsWith('course:') ? activeScope.slice(7) : '';
    const scopedClass = activeScope.startsWith('class:') ? activeScope.slice(6) : '';
    setForm({ ...EMPTY_FORM, courseId: scopedCourse, classGroupId: scopedClass, author: currentUser?.displayName || '' });
    setFormError('');
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!activeSchoolId || saving) return;
    if (!form.title.trim()) { setFormError(isAlbanian ? 'Shkruani titullin.' : 'Enter a title.'); return; }
    const link = normalizeWebLink(form.url);
    if (!link.url) {
      setFormError(link.error
        ? (isAlbanian ? 'Përdorni një lidhje interneti, p.sh. https://drive.google.com/…' : 'Use a web link, for example https://drive.google.com/…')
        : (isAlbanian ? 'Shtoni lidhjen ku gjendet materiali (Google Drive, OneDrive, YouTube…).' : 'Add the link where the material lives (Google Drive, OneDrive, YouTube…).'));
      return;
    }
    const resId = `res_${Date.now()}`;
    const now = Date.now();
    const added = {
      id: resId,
      title: form.title.trim().slice(0, 200),
      type: form.type,
      url: link.url,
      courseId: form.courseId && courseById.has(form.courseId) ? form.courseId : '',
      classGroupId: form.classGroupId && groupsById.has(form.classGroupId) ? form.classGroupId : '',
      author: (form.author || currentUser?.displayName || '').trim().slice(0, 120),
      date: new Date(now).toLocaleDateString(isAlbanian ? 'sq-AL' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      createdAtMs: now,
      createdByUid: currentUser?.uid || '',
      createdAt: serverTimestamp()
    };
    setSaving(true);
    try {
      await setDoc(doc(db, 'schools', activeSchoolId, 'resources', resId), added);
      setIsAddOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setFormError(err.message || (isAlbanian ? 'Materiali nuk u ruajt.' : 'The material could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!resourceToDelete || !activeSchoolId) return;
    try {
      await deleteDoc(doc(db, 'schools', activeSchoolId, 'resources', String(resourceToDelete.id)));
      setResourceToDelete(null);
      setDeleteError('');
    } catch (err) {
      setDeleteError(err.message || (isAlbanian ? 'Materiali nuk u fshi.' : 'The material could not be deleted.'));
    }
  };

  return (
    <motion.div
      className="resources-page"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.header className="page-header" variants={itemVariants}>
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text">
              {t('resources.title', 'Resource Hub')}
              <Library size={30} className="page-title-icon" aria-hidden="true" />
            </h1>
            <span className="count-pill glass">{resources.length} {t('resources.materials', 'Materials')}</span>
          </div>
          <p>{t('resources.subtitle', 'Access study materials, curriculum guides, video lectures, and syllabi.')}</p>
        </div>
        <div className="header-actions">
          {canAddResources && <button className="btn-primary" onClick={openAdd}>
            <Plus size={16} /> {t('resources.addMaterial', 'Add Material')}
          </button>}
          <div className="view-toggle glass">
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title={isAlbanian ? 'Pamje me karta' : 'Grid view'} aria-pressed={view === 'grid'}>
              <LayoutGrid size={18} />
            </button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title={isAlbanian ? 'Pamje me listë' : 'List view'} aria-pressed={view === 'list'}>
              <List size={18} />
            </button>
          </div>
        </div>
      </motion.header>

      <motion.div className="resources-toolbar glass" variants={itemVariants}>
        <div className="toolbar-top-row">
          <div className="res-search glass">
            <Search size={18} />
            <input
              type="text"
              placeholder={isAlbanian ? 'Kërko materiale, autorë, lëndë…' : 'Search materials, authors, courses…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={isAlbanian ? 'Kërko materiale' : 'Search materials'}
            />
            {search && <button className="clear-btn" onClick={() => setSearch('')} aria-label={isAlbanian ? 'Pastro' : 'Clear'}><X size={14} /></button>}
          </div>

          <div className="resource-class-filter-container" ref={scopeRef}>
            <button
              type="button"
              className={`resource-class-trigger glass ${isScopeOpen ? 'active' : ''}`}
              onClick={() => setIsScopeOpen(!isScopeOpen)}
              aria-haspopup="listbox"
              aria-expanded={isScopeOpen}
            >
              <div className="trigger-left">
                <BookOpen size={16} className="trigger-icon" />
                <span className="trigger-label-muted">{isAlbanian ? 'Për:' : 'For:'}</span>
                <strong className="trigger-value">{currentScope.label}</strong>
              </div>
              <ChevronDown size={16} className={`chevron-arrow ${isScopeOpen ? 'open' : ''}`} />
            </button>

            <AnimatePresence>
              {isScopeOpen && (
                <motion.div
                  className="searchable-dropdown-popover glass"
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  <div className="dropdown-search-box">
                    <Search size={15} className="dropdown-search-icon" />
                    <input
                      ref={scopeSearchRef}
                      type="text"
                      placeholder={isAlbanian ? 'Kërko lëndët ose klasat…' : 'Search courses or classes…'}
                      value={scopeSearch}
                      onChange={(e) => setScopeSearch(e.target.value)}
                    />
                    {scopeSearch && (
                      <button type="button" className="dropdown-search-clear" onClick={() => setScopeSearch('')} aria-label={isAlbanian ? 'Pastro' : 'Clear'}>
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="dropdown-options-list">
                    {filteredScopeGroups.length === 0 ? (
                      <div className="dropdown-empty-state">
                        <span>{isAlbanian ? 'Nuk u gjet lëndë ose klasë' : 'No matching course or class'}</span>
                      </div>
                    ) : (
                      filteredScopeGroups.map(group => (
                        <div key={group.category} className="dropdown-group">
                          <div className="dropdown-group-title">{group.category}</div>
                          {group.items.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              className={`dropdown-option-row ${activeScope === item.id ? 'active' : ''}`}
                              onClick={() => { setActiveScope(item.id); setIsScopeOpen(false); setScopeSearch(''); }}
                            >
                              <div className="option-info">
                                <span className="option-name">{item.label}</span>
                                {item.desc && <span className="option-desc">{item.desc}</span>}
                              </div>
                              {activeScope === item.id && <Check size={16} className="option-check" />}
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="format-pills-row">
          <span className="format-label">{isAlbanian ? 'Formati:' : 'Format:'}</span>
          {FORMAT_TYPES.map(fmt => (
            <button
              key={fmt}
              type="button"
              className={`format-pill ${activeType === fmt ? 'active' : ''}`}
              onClick={() => setActiveType(fmt)}
            >
              {fmt === 'All Types' ? (isAlbanian ? 'Të Gjitha Llojet' : 'All Types') : fmt}
            </button>
          ))}
          <button type="button" className={`format-pill ${bookmarkedOnly ? 'active' : ''}`} onClick={() => setBookmarkedOnly(value => !value)} aria-pressed={bookmarkedOnly}>
            <Bookmark size={12} /> {isAlbanian ? 'Të ruajturat' : 'Bookmarked'}
          </button>
        </div>
      </motion.div>

      {resourceState.error && resourcesLoaded && (
        <div className="res-notice is-error" role="alert">{isAlbanian ? 'Materialet nuk mund të ngarkohen. Kontrolloni lejet.' : 'Materials could not be loaded. Check your access.'}</div>
      )}

      <motion.div className={view === 'grid' ? 'resources-grid' : 'resources-list'} variants={itemVariants}>
        <AnimatePresence mode="popLayout">
          {filteredResources.map(res => (
            <ResourceCard
              key={res.id}
              resource={res}
              view={view}
              contextLabel={contextLabel(res)}
              isBookmarked={bookmarkIds.has(String(res.id))}
              onToggleBookmark={handleToggleBookmark}
              onDelete={canDelete(res) ? (resource) => { setDeleteError(''); setResourceToDelete(resource); } : undefined}
              isAlbanian={isAlbanian}
            />
          ))}
        </AnimatePresence>

        {filteredResources.length === 0 && (
          <motion.div className="empty-resources glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Filter size={44} />
            <h3>{!resourcesLoaded ? (isAlbanian ? 'Po ngarkohen materialet…' : 'Loading materials…') : resources.length === 0 ? (isAlbanian ? 'Ende nuk ka materiale' : 'No materials yet') : (isAlbanian ? 'Nuk u gjetën materiale' : 'No materials found')}</h3>
            <p>{resources.length === 0
              ? (canAddResources ? (isAlbanian ? 'Shtoni materialin e parë me lidhjen e tij.' : 'Add the first material with its link.') : '')
              : (isAlbanian ? 'Provoni të rregulloni kërkimin ose filtrat.' : 'Try adjusting your search or filters.')}</p>
          </motion.div>
        )}
      </motion.div>

      {/* ── MODAL: Add Material ── */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="modal-overlay" onClick={() => !saving && setIsAddOpen(false)}>
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Shto Material Studimi' : 'Add Study Material'}</h3>
                <p className="modal-subtitle">{isAlbanian ? 'Ndani një lidhje për fletë pune, video, prezantime ose udhëzues.' : 'Share a link to a worksheet, video, slides or reading guide.'}</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddOpen(false)} aria-label={isAlbanian ? 'Mbyll' : 'Close'} disabled={saving}>
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="modal-form" noValidate>
                {formError && <div className="res-notice is-error" role="alert"><AlertTriangle size={15} /> {formError}</div>}
                <div className="input-group">
                  <label htmlFor="res-title">{isAlbanian ? 'Titulli i Materialit' : 'Material Title'}</label>
                  <input
                    id="res-title"
                    type="text"
                    required
                    maxLength={200}
                    placeholder={isAlbanian ? 'p.sh. Udhëzues për Kapitullin 4 në Kimi' : 'e.g. Chapter 4 Chemistry Study Guide'}
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="res-url">{isAlbanian ? 'Lidhja e materialit' : 'Link to the material'}</label>
                  <input
                    id="res-url"
                    type="url"
                    required
                    placeholder="https://drive.google.com/…"
                    value={form.url}
                    onChange={e => setForm({ ...form, url: e.target.value })}
                  />
                  <small>{isAlbanian ? 'Google Drive, OneDrive, YouTube ose çdo faqe interneti. Sigurohuni që nxënësit kanë qasje.' : 'Google Drive, OneDrive, YouTube or any web page. Make sure students have access.'}</small>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="res-course">{isAlbanian ? 'Lënda (opsionale)' : 'Course (optional)'}</label>
                    <select id="res-course" className="custom-form-select" value={form.courseId}
                      onChange={e => {
                        const course = courseById.get(e.target.value);
                        setForm({ ...form, courseId: e.target.value, classGroupId: course?.classGroupId && groupsById.has(String(course.classGroupId)) ? String(course.classGroupId) : form.classGroupId });
                      }}>
                      <option value="">{isAlbanian ? 'Asnjë lëndë' : 'No course'}</option>
                      {classesList.map(course => <option key={course.id} value={String(course.id)}>{course.name}{course.code ? ` (${course.code})` : ''}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label htmlFor="res-class">{isAlbanian ? 'Klasa (opsionale)' : 'Class (optional)'}</label>
                    <select id="res-class" className="custom-form-select" value={form.classGroupId} onChange={e => setForm({ ...form, classGroupId: e.target.value })}>
                      <option value="">{isAlbanian ? 'Të gjitha klasat' : 'All classes'}</option>
                      {classGroups.map(group => <option key={group.id} value={group.id}>{isAlbanian ? 'Klasa' : 'Class'} {group.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="res-type">{isAlbanian ? 'Lloji' : 'Type'}</label>
                    <select
                      id="res-type"
                      value={form.type}
                      onChange={e => setForm({ ...form, type: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="PDF">{isAlbanian ? 'Dokument PDF' : 'PDF Document'}</option>
                      <option value="Video">{isAlbanian ? 'Video' : 'Video'}</option>
                      <option value="Slides">{isAlbanian ? 'Prezantim' : 'Slides'}</option>
                      <option value="Doc">{isAlbanian ? 'Dokument Word / Tekst' : 'Word / Text Doc'}</option>
                      <option value="Link">{isAlbanian ? 'Faqe interneti' : 'Web page'}</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label htmlFor="res-author">{isAlbanian ? 'Autori / Mësimdhënësi' : 'Author / Teacher'}</label>
                    <input
                      id="res-author"
                      type="text"
                      maxLength={120}
                      value={form.author}
                      onChange={e => setForm({ ...form, author: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddOpen(false)} disabled={saving}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? (isAlbanian ? 'Duke ruajtur…' : 'Saving…') : (isAlbanian ? 'Publiko Materialin' : 'Publish Material')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Delete Material ── */}
      <AnimatePresence>
        {resourceToDelete && (
          <div className="modal-overlay" onClick={() => setResourceToDelete(null)}>
            <motion.div
              className="modal-content"
              style={{ maxWidth: '440px' }}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{isAlbanian ? 'Fshij materialin?' : 'Delete material?'}</h3>
                <p className="modal-subtitle">{resourceToDelete.title}</p>
                <button type="button" className="icon-btn-close" onClick={() => setResourceToDelete(null)} aria-label={isAlbanian ? 'Mbyll' : 'Close'}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-form">
                <p>{isAlbanian ? 'Materiali hiqet nga biblioteka për të gjithë. Skedari në lidhje nuk preket.' : 'The material is removed from the library for everyone. The linked file itself is not touched.'}</p>
                {deleteError && <div className="res-notice is-error" role="alert">{deleteError}</div>}
                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setResourceToDelete(null)}>{isAlbanian ? 'Anulo' : 'Cancel'}</button>
                  <button type="button" className="btn-destructive" onClick={confirmDelete}><Trash2 size={15} /> {isAlbanian ? 'Fshij' : 'Delete'}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Resources;
