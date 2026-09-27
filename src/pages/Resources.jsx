import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Video, 
  Link as LinkIcon, 
  Download, 
  ExternalLink, 
  Search, 
  Filter, 
  Clock, 
  BookOpen,
  LayoutGrid,
  List,
  Star,
  Plus,
  X,
  Check,
  Bookmark,
  ChevronDown,
  Library,
  Trash2
} from 'lucide-react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './Resources.css';

const INITIAL_RESOURCES = [];

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


const RESOURCE_CLASS_GROUPS = [
  {
    category: 'General Overview',
    items: [
      { id: 'All', label: 'All Subjects & Classes', desc: 'Complete library of materials' }
    ]
  },
  {
    category: 'Academic Classes & Courses',
    items: [
      { id: 'Mathematics', label: 'Advanced Mathematics (MATH-301)', desc: 'Calculus, linear algebra, problem sets' },
      { id: 'Science', label: 'Physics Mechanics (PHYS-401)', desc: 'Mechanics, quantum, lab simulations' },
      { id: 'Literature', label: 'English Literature (ENG-101)', desc: 'Essays, study guides, drama scripts' },
      { id: 'History', label: 'World History (HIST-202)', desc: 'Timelines, documents, DBQ analysis' },
      { id: 'Arts', label: 'Digital Arts & Design (ART-110)', desc: 'Brush techniques, 3D modeling, palettes' },
      { id: 'Computer Science', label: 'Computer Science (CS-501)', desc: 'Python algorithms, data structures' }
    ]
  }
];

const CATEGORIES = ['All', 'Mathematics', 'Science', 'Literature', 'History', 'Arts', 'Computer Science'];

const FORMAT_TYPES = ['All Types', 'PDF', 'Video', 'Link', 'Doc'];

const ResourceCard = ({ resource, view, onToggleBookmark, onDownload, onDelete }) => {
  const getIcon = (type) => {
    switch(type) {
      case 'PDF': return <FileText size={24} color="hsl(var(--destructive))" />;
      case 'Video': return <Video size={24} color="hsl(var(--primary))" />;
      case 'Link': return <LinkIcon size={24} color="hsl(var(--mood-sad))" />;
      default: return <BookOpen size={24} color="hsl(var(--accent))" />;
    }
  };

  if (view === 'list') {
    return (
      <motion.div 
        className="resource-list-item glass bouncy"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ x: 6 }}
        layout
      >
        <div className="res-icon-wrap">{getIcon(resource.type)}</div>
        <div className="res-main">
          <h4>{resource.title}</h4>
          <p>{resource.category} • {resource.author}</p>
        </div>
        <div className="res-meta">
          <span>{resource.size}</span>
          <span className="dot">•</span>
          <span>{resource.date}</span>
        </div>
        <div className="res-actions">
          <button 
            type="button" 
            className={`bookmark-btn ${resource.isBookmarked ? 'active' : ''}`}
            onClick={() => onToggleBookmark(resource.id)}
            title={resource.isBookmarked ? "Remove Bookmark" : "Bookmark Resource"}
          >
            <Bookmark size={17} fill={resource.isBookmarked ? "hsl(var(--primary))" : "none"} />
          </button>
          <button 
            type="button" 
            className="res-action-btn"
            onClick={() => onDownload(resource)}
            title={resource.type === 'Link' ? "Open Resource" : "Download File"}
          >
            {resource.type === 'Link' ? <ExternalLink size={18} /> : <Download size={18} />}
          </button>
          {onDelete && (
            <button
              type="button"
              className="icon-btn-destructive"
              style={{ padding: '0.35rem' }}
              onClick={() => onDelete(resource.id)}
              title="Delete Resource"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="resource-card glass bouncy"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      layout
    >
      <div className="resource-header">
        <div className="res-icon-box" style={{ background: `hsla(var(${resource.type === 'PDF' ? '--destructive' : '--primary'}), 0.12)` }}>
          {getIcon(resource.type)}
        </div>
        <div className="res-header-right">
          <button 
            type="button" 
            className={`bookmark-btn ${resource.isBookmarked ? 'active' : ''}`}
            onClick={() => onToggleBookmark(resource.id)}
            title={resource.isBookmarked ? "Remove Bookmark" : "Bookmark"}
          >
            <Bookmark size={16} fill={resource.isBookmarked ? "hsl(var(--primary))" : "none"} />
          </button>
          <div className="res-rating">
            <Star size={13} fill="hsl(var(--mood-neutral))" color="hsl(var(--mood-neutral))" />
            <span>{resource.stars}</span>
          </div>
        </div>
      </div>
      
      <div className="resource-body">
        <span className="res-type-label">{resource.type}</span>
        <h3>{resource.title}</h3>
        <p className="res-info">{resource.category} • {resource.author}</p>
      </div>

      <div className="resource-footer">
        <div className="res-size">
          <Clock size={13} />
          <span>{resource.size}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button 
            type="button" 
            className="res-btn bouncy glass"
            onClick={() => onDownload(resource)}
            title={resource.type === 'Link' ? "Open Resource" : "Download File"}
          >
            {resource.type === 'Link' ? <ExternalLink size={17} /> : <Download size={17} />}
          </button>
          {onDelete && (
            <button
              type="button"
              className="icon-btn-destructive"
              style={{ width: '36px', height: '36px', borderRadius: '10px' }}
              onClick={() => onDelete(resource.id)}
              title="Delete Resource"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const Resources = () => {
  const { activeSchoolId, currentUser } = useAuth();
  const { t, isAlbanian } = useLanguage();
  const [resources, setResources] = useState(INITIAL_RESOURCES);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeType, setActiveType] = useState('All Types');
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState(null);

  // Real-time Firestore sync
  useEffect(() => {
    if (!activeSchoolId) return;
    const colRef = collection(db, 'schools', activeSchoolId, 'resources');
    const unsub = onSnapshot(colRef, (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
      setResources(items);
    }, (err) => console.warn('Resources sync notice:', err.message));
    return () => unsub();
  }, [activeSchoolId]);

  // Dropdown Filter State
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classDropdownSearch, setClassDropdownSearch] = useState('');
  const classDropdownRef = useRef(null);
  const classSearchInputRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus input
  useEffect(() => {
    if (isClassDropdownOpen && classSearchInputRef.current) {
      classSearchInputRef.current.focus();
    }
  }, [isClassDropdownOpen]);

  // Current selected option
  const currentClassOption = useMemo(() => {
    for (const group of RESOURCE_CLASS_GROUPS) {
      const match = group.items.find(item => item.id === activeCategory);
      if (match) return match;
    }
    return RESOURCE_CLASS_GROUPS[0].items[0];
  }, [activeCategory]);

  // Filtered dropdown items
  const filteredClassGroups = useMemo(() => {
    if (!classDropdownSearch.trim()) return RESOURCE_CLASS_GROUPS;
    const query = classDropdownSearch.toLowerCase();
    return RESOURCE_CLASS_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => 
        item.label.toLowerCase().includes(query) || 
        item.desc.toLowerCase().includes(query)
      )
    })).filter(group => group.items.length > 0);
  }, [classDropdownSearch]);

  // Form State
  const [newResource, setNewResource] = useState({
    title: '',
    category: 'Mathematics',
    type: 'PDF',
    size: '2.5 MB',
    author: 'Faculty Member'
  });

  const handleToggleBookmark = async (id) => {
    const res = resources.find(r => r.id === id);
    if (!res || !activeSchoolId) return;
    const nextVal = !res.isBookmarked;
    setResources(prev => prev.map(r => r.id === id ? { ...r, isBookmarked: nextVal } : r));
    try {
      await updateDoc(doc(db, 'schools', activeSchoolId, 'resources', String(id)), {
        isBookmarked: nextVal
      });
    } catch (e) {
      console.warn('Could not update bookmark:', e.message);
    }
  };

  const handleDeleteResource = async (id) => {
    if (!activeSchoolId) return;
    try {
      await deleteDoc(doc(db, 'schools', activeSchoolId, 'resources', String(id)));
    } catch (e) {
      console.warn('Could not delete resource:', e.message);
    }
  };

  const handleDownload = (res) => {
    setDownloadNotice(`Accessing "${res.title}"...`);
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newResource.title.trim() || !activeSchoolId) return;
    const resId = `res_${Date.now()}`;
    const added = {
      id: resId,
      title: newResource.title.trim(),
      category: newResource.category,
      type: newResource.type,
      size: newResource.size || '1.5 MB',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      author: newResource.author || currentUser?.displayName || 'Faculty Member',
      stars: 5.0,
      isBookmarked: false,
      createdAt: serverTimestamp()
    };
    try {
      await setDoc(doc(db, 'schools', activeSchoolId, 'resources', resId), added);
    } catch (e) {
      console.warn('Could not save resource to Firestore:', e.message);
    }
    setIsAddOpen(false);
    setNewResource({ title: '', category: 'Mathematics', type: 'PDF', size: '2.5 MB', author: 'Faculty Member' });
  };

  const filteredResources = resources.filter(r => {
    const matchCat = activeCategory === 'All' || r.category === activeCategory;
    const matchType = activeType === 'All Types' || r.type === activeType;
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.author.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchType && matchSearch;
  });

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
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              {t('resources.title', 'Resource Hub')}
              <Library size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">{resources.length} {t('resources.materials', 'Materials')}</span>
          </div>
          <p>{t('resources.subtitle', 'Access study materials, curriculum guides, video lectures, and syllabi.')}</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> {t('resources.addMaterial', 'Add Material')}
          </button>
          <div className="view-toggle glass">
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Grid View">
              <LayoutGrid size={18} />
            </button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="List View">
              <List size={18} />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Notification Toast */}
      {downloadNotice && (
        <motion.div 
          className="download-toast glass"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <Check size={16} color="hsl(var(--mood-happy))" />
          <span>{downloadNotice}</span>
        </motion.div>
      )}

      {/* Search & Filter Bar */}
      <motion.div className="resources-toolbar glass" variants={itemVariants}>
        <div className="toolbar-top-row">
          <div className="res-search glass">
            <Search size={18} />
            <input 
              type="text" 
              placeholder={t('resources.searchPlaceholder', 'Search materials, authors, topics...')} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button className="clear-btn" onClick={() => setSearch('')}><X size={14} /></button>}
          </div>

          {/* Class Filter Dropdown */}
          <div className="resource-class-filter-container" ref={classDropdownRef}>
            <button 
              type="button" 
              className={`resource-class-trigger glass ${isClassDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
            >
              <div className="trigger-left">
                <BookOpen size={16} className="trigger-icon" />
                <span className="trigger-label-muted">{isAlbanian ? 'Lënda:' : 'Class:'}</span>
                <strong className="trigger-value">
                  {isAlbanian && currentClassOption.id === 'All' ? 'Të Gjitha Lëndët & Klasat' : currentClassOption.label}
                </strong>
              </div>
              <ChevronDown size={16} className={`chevron-arrow ${isClassDropdownOpen ? 'open' : ''}`} />
            </button>

            <AnimatePresence>
              {isClassDropdownOpen && (
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
                      ref={classSearchInputRef}
                      type="text" 
                      placeholder={isAlbanian ? 'Kërko lëndët, kurset, apo fushat...' : 'Search classes, subjects, or courses...'} 
                      value={classDropdownSearch}
                      onChange={(e) => setClassDropdownSearch(e.target.value)}
                    />
                    {classDropdownSearch && (
                      <button 
                        type="button" 
                        className="dropdown-search-clear"
                        onClick={() => setClassDropdownSearch('')}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="dropdown-options-list">
                    {filteredClassGroups.length === 0 ? (
                      <div className="dropdown-empty-state">
                        <span>{isAlbanian ? 'Nuk u gjetën lëndë ose kurse përputhëse' : 'No matching classes or courses found'}</span>
                      </div>
                    ) : (
                      filteredClassGroups.map(group => (
                        <div key={group.category} className="dropdown-group">
                          <div className="dropdown-group-title">
                            {isAlbanian ? (
                              group.category === 'General Overview' ? 'Përmbledhje e Përgjithshme' :
                              group.category === 'Academic Classes & Courses' ? 'Lëndët & Kurset Akademike' : group.category
                            ) : group.category}
                          </div>
                          {group.items.map(item => (
                            <button 
                              key={item.id} 
                              type="button"
                              className={`dropdown-option-row ${activeCategory === item.id ? 'active' : ''}`}
                              onClick={() => {
                                setActiveCategory(item.id);
                                setIsClassDropdownOpen(false);
                                setClassDropdownSearch('');
                              }}
                            >
                              <div className="option-info">
                                <span className="option-name">
                                  {isAlbanian && item.id === 'All' ? 'Të Gjitha Lëndët & Klasat' : item.label}
                                </span>
                                <span className="option-desc">
                                  {isAlbanian && item.id === 'All' ? 'Libraria e plotë e materialeve' : item.desc}
                                </span>
                              </div>
                              {activeCategory === item.id && (
                                <Check size={16} className="option-check" />
                              )}
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

        {/* Format Selector Pills */}
        <div className="format-pills-row">
          <span className="format-label">{isAlbanian ? 'Formati:' : 'Format:'}</span>
          {FORMAT_TYPES.map(fmt => (
            <button 
              key={fmt}
              type="button"
              className={`format-pill ${activeType === fmt ? 'active' : ''}`}
              onClick={() => setActiveType(fmt)}
            >
              {isAlbanian && fmt === 'All Types' ? 'Të Gjitha Llojet' : fmt}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Resources Feed */}
      <motion.div className={view === 'grid' ? 'resources-grid' : 'resources-list'} variants={itemVariants}>
        <AnimatePresence mode="popLayout">
          {filteredResources.map(res => (
            <ResourceCard 
              key={res.id} 
              resource={res} 
              view={view} 
              onToggleBookmark={handleToggleBookmark}
              onDownload={handleDownload}
              onDelete={handleDeleteResource}
            />
          ))}
        </AnimatePresence>
        
        {filteredResources.length === 0 && (
          <motion.div className="empty-resources glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Filter size={44} />
            <h3>{isAlbanian ? 'Nuk u gjetën materiale' : 'No resources found'}</h3>
            <p>{isAlbanian ? 'Provoni të rregulloni kërkimin ose filtrin e formatit.' : 'Try adjusting your search query or format filter.'}</p>
          </motion.div>
        )}
      </motion.div>

      {/* ── MODAL: Add Resource ── */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="modal-overlay" onClick={() => setIsAddOpen(false)}>
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
                <p className="modal-subtitle">{isAlbanian ? 'Publikoni fletë pune, ligjërata me video, silabuse, ose materiale leximi.' : 'Publish a worksheet, video link, syllabus, or reading guide.'}</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="modal-form">
                <div className="input-group">
                  <label>{isAlbanian ? 'Titulli i Materialit' : 'Material Title'}</label>
                  <input 
                    type="text" 
                    required 
                    placeholder={isAlbanian ? 'p.sh. Udhëzues Studimi për Kapitullin 4 në Kimi' : 'e.g. Chapter 4 Chemistry Study Guide'} 
                    value={newResource.title}
                    onChange={e => setNewResource({ ...newResource, title: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Kategoria' : 'Category'}</label>
                    <select 
                      value={newResource.category} 
                      onChange={e => setNewResource({ ...newResource, category: e.target.value })}
                      className="custom-form-select"
                    >
                      {CATEGORIES.filter(c => c !== 'All').map(c => {
                        const catTrans = {
                          'Mathematics': 'Matematikë',
                          'Science': 'Shkencë',
                          'Literature': 'Letërsi',
                          'History': 'Histori',
                          'Arts': 'Arte',
                          'Computer Science': 'Shkenca Kompjuterike'
                        };
                        return (
                          <option key={c} value={c}>
                            {isAlbanian && catTrans[c] ? catTrans[c] : c}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Lloji i Formatit' : 'Format Type'}</label>
                    <select 
                      value={newResource.type} 
                      onChange={e => setNewResource({ ...newResource, type: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="PDF">{isAlbanian ? 'Dokument PDF' : 'PDF Document'}</option>
                      <option value="Video">{isAlbanian ? 'Ligjëratë Video' : 'Video Lecture'}</option>
                      <option value="Link">{isAlbanian ? 'Vegëz Interaktive Web' : 'Interactive Web Link'}</option>
                      <option value="Doc">{isAlbanian ? 'Dokument Word / Tekst' : 'Word / Text Doc'}</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>{isAlbanian ? 'Autori / Mësimdhënësi' : 'Author / Teacher'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. Dr. Sarah Smith' : 'e.g. Dr. Sarah Smith'}
                      value={newResource.author}
                      onChange={e => setNewResource({ ...newResource, author: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>{isAlbanian ? 'Madhësia / Kohëzgjatja' : 'File Size / Duration'}</label>
                    <input 
                      type="text" 
                      placeholder={isAlbanian ? 'p.sh. 3.2 MB ose 18:40' : 'e.g. 3.2 MB or 18:40'}
                      value={newResource.size}
                      onChange={e => setNewResource({ ...newResource, size: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddOpen(false)}>
                    {isAlbanian ? 'Anulo' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary">
                    {isAlbanian ? 'Publiko Materialin' : 'Publish Material'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Resources;
