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
  Library
} from 'lucide-react';
import './Resources.css';

const INITIAL_RESOURCES = [
  { id: 1, title: 'Calculus Cheat Sheet', category: 'Mathematics', type: 'PDF', size: '2.4 MB', date: 'Oct 12, 2026', author: 'Dr. Sarah Smith', stars: 4.8, isBookmarked: true },
  { id: 2, title: 'Intro to Quantum Physics', category: 'Science', type: 'Video', size: '15:20', date: 'Oct 15, 2026', author: 'Prof. James Wilson', stars: 4.9, isBookmarked: false },
  { id: 3, title: 'Macbeth Study Guide', category: 'Literature', type: 'Doc', size: '1.1 MB', date: 'Sep 28, 2026', author: 'Ms. Emily Brown', stars: 4.5, isBookmarked: false },
  { id: 4, title: 'World War II Timeline', category: 'History', type: 'PDF', size: '5.8 MB', date: 'Nov 02, 2026', author: 'Mr. David Clark', stars: 4.7, isBookmarked: true },
  { id: 5, title: 'Periodic Table Interactive', category: 'Science', type: 'Link', size: 'Web App', date: 'Oct 20, 2026', author: 'Dr. Arthur Pendelton', stars: 4.6, isBookmarked: false },
  { id: 6, title: 'Brush Techniques 101', category: 'Arts', type: 'Video', size: '12:45', date: 'Nov 05, 2026', author: 'Ms. Clara Oswald', stars: 4.3, isBookmarked: false },
  { id: 7, title: 'Algebraic Expressions PDF', category: 'Mathematics', type: 'PDF', size: '3.1 MB', date: 'Oct 10, 2026', author: 'Dr. Sarah Smith', stars: 4.4, isBookmarked: false },
  { id: 8, title: 'DNA Structure 3D Simulation', category: 'Science', type: 'Link', size: 'Web App', date: 'Oct 25, 2026', author: 'Dr. Arthur Pendelton', stars: 5.0, isBookmarked: true },
  { id: 9, title: 'Python Algorithms & Data Structures', category: 'Computer Science', type: 'Doc', size: '3.4 MB', date: 'Nov 01, 2026', author: 'Prof. Alan Turing', stars: 4.9, isBookmarked: false },
];

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

const ResourceCard = ({ resource, view, onToggleBookmark, onDownload }) => {
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
        <button 
          type="button" 
          className="res-btn bouncy glass"
          onClick={() => onDownload(resource)}
          title={resource.type === 'Link' ? "Open Resource" : "Download File"}
        >
          {resource.type === 'Link' ? <ExternalLink size={17} /> : <Download size={17} />}
        </button>
      </div>
    </motion.div>
  );
};

const Resources = () => {
  const [resources, setResources] = useState(INITIAL_RESOURCES);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeType, setActiveType] = useState('All Types');
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState(null);

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

  const handleToggleBookmark = (id) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, isBookmarked: !r.isBookmarked } : r));
  };

  const handleDownload = (res) => {
    setDownloadNotice(`Accessing "${res.title}"...`);
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newResource.title.trim()) return;
    const added = {
      id: Date.now(),
      title: newResource.title,
      category: newResource.category,
      type: newResource.type,
      size: newResource.size || '1.5 MB',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      author: newResource.author || 'Faculty Member',
      stars: 5.0,
      isBookmarked: false
    };
    setResources([added, ...resources]);
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
    <div className="resources-page">
      <header className="page-header">
        <div className="header-left">
          <div className="title-group">
            <h1 className="gradient-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              Resource Hub
              <Library size={32} style={{ color: 'hsl(var(--primary))' }} />
            </h1>
            <span className="count-pill glass">{resources.length} Materials</span>
          </div>
          <p>Access study materials, curriculum guides, video lectures, and syllabi.</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> Add Material
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
      </header>

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
      <div className="resources-toolbar glass">
        <div className="toolbar-top-row">
          <div className="res-search glass">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search materials, authors, topics..." 
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
                <span className="trigger-label-muted">Class:</span>
                <strong className="trigger-value">{currentClassOption.label}</strong>
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
                      placeholder="Search classes, subjects, or courses..."
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
                        <span>No matching classes or courses found</span>
                      </div>
                    ) : (
                      filteredClassGroups.map(group => (
                        <div key={group.category} className="dropdown-group">
                          <div className="dropdown-group-title">{group.category}</div>
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
                                <span className="option-name">{item.label}</span>
                                <span className="option-desc">{item.desc}</span>
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
          <span className="format-label">Format:</span>
          {FORMAT_TYPES.map(fmt => (
            <button 
              key={fmt}
              type="button"
              className={`format-pill ${activeType === fmt ? 'active' : ''}`}
              onClick={() => setActiveType(fmt)}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Resources Feed */}
      <div className={view === 'grid' ? 'resources-grid' : 'resources-list'}>
        <AnimatePresence mode="popLayout">
          {filteredResources.map(res => (
            <ResourceCard 
              key={res.id} 
              resource={res} 
              view={view} 
              onToggleBookmark={handleToggleBookmark}
              onDownload={handleDownload}
            />
          ))}
        </AnimatePresence>
        
        {filteredResources.length === 0 && (
          <motion.div className="empty-resources glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Filter size={44} />
            <h3>No resources found</h3>
            <p>Try adjusting your search query or format filter.</p>
          </motion.div>
        )}
      </div>

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
                <h3>Add Study Material</h3>
                <p className="modal-subtitle">Publish a worksheet, video link, syllabus, or reading guide.</p>
                <button type="button" className="icon-btn-close" onClick={() => setIsAddOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="modal-form">
                <div className="input-group">
                  <label>Material Title</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Chapter 4 Chemistry Study Guide" 
                    value={newResource.title}
                    onChange={e => setNewResource({ ...newResource, title: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Category</label>
                    <select 
                      value={newResource.category} 
                      onChange={e => setNewResource({ ...newResource, category: e.target.value })}
                      className="custom-form-select"
                    >
                      {CATEGORIES.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Format Type</label>
                    <select 
                      value={newResource.type} 
                      onChange={e => setNewResource({ ...newResource, type: e.target.value })}
                      className="custom-form-select"
                    >
                      <option value="PDF">PDF Document</option>
                      <option value="Video">Video Lecture</option>
                      <option value="Link">Interactive Web Link</option>
                      <option value="Doc">Word / Text Doc</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Author / Teacher</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Dr. Sarah Smith"
                      value={newResource.author}
                      onChange={e => setNewResource({ ...newResource, author: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>File Size / Duration</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 3.2 MB or 18:40"
                      value={newResource.size}
                      onChange={e => setNewResource({ ...newResource, size: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Publish Material
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Resources;
