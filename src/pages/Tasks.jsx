import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Edit, Check, X, Flag, Tag,
  Calendar, Search, LayoutList, Columns, CheckSquare,
  Clock, AlertCircle, Star, ChevronDown
} from 'lucide-react';
import { useTasks } from '../context/TasksContext';
import { useLanguage } from '../context/LanguageContext';
import './Tasks.css';

/* ─── Constants ──────────────────────────────────────────── */
const STATUSES  = ['todo', 'inprogress', 'done'];
const STATUS_META = {
  todo:       { label: 'To Do',       emoji: '📋', color: 'hsl(var(--chart-4))'  },
  inprogress: { label: 'In Progress', emoji: '⚡', color: 'hsl(var(--chart-2))'  },
  done:       { label: 'Done',        emoji: '✅', color: 'hsl(var(--mood-happy))' },
};
const PRIORITIES = ['low', 'medium', 'high'];
const PRIORITY_META = {
  low:    { label: 'Low',    color: 'hsl(var(--mood-happy))',   icon: '🟢' },
  medium: { label: 'Medium', color: 'hsl(var(--mood-neutral))', icon: '🟡' },
  high:   { label: 'High',   color: 'hsl(var(--mood-sad))',     icon: '🔴' },
};
const STAFF_CATEGORIES = ['All', 'Grading', 'Prep', 'Admin', 'Meeting', 'Personal', 'Other'];
const STUDENT_CATEGORIES = ['All', 'Homework', 'Study', 'Project', 'Exams', 'Personal', 'Reading'];

/* ─── Custom Select Component ────────────────────────────── */
const CustomSelect = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="custom-select-container">
      <div 
        className={`tf-filter custom-select-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown size={14} className={`chevron ${isOpen ? 'rotate' : ''}`} />
      </div>
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="select-overlay" onClick={() => setIsOpen(false)} />
            <motion.div 
              className="select-popover glass"
              initial={{ opacity: 0, y: 5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              {options.map((opt) => (
                <div 
                  key={opt.value}
                  className={`select-option ${value === opt.value ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Add/Edit Modal ─────────────────────────────────────── */
const TaskModal = ({ task, onSave, onClose, userRole = 'student', categories = STUDENT_CATEGORIES, isAlbanian = false }) => {
  const defaultCategory = userRole === 'student' ? 'Homework' : 'Admin';
  const [form, setForm] = useState(task || {
    content: '', status: 'todo', priority: 'medium',
    category: defaultCategory, due: '', notes: '', role: userRole
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const availableCategories = categories.filter(c => c !== 'All');

  const getCategoryLabel = (c) => {
    if (!isAlbanian) return c;
    const catMap = {
      'Homework': 'Detyrë Shtëpie',
      'Study': 'Studim',
      'Project': 'Projekt',
      'Exams': 'Provime',
      'Personal': 'Personale',
      'Reading': 'Lexim',
      'Grading': 'Vlerësim',
      'Prep': 'Përgatitje',
      'Admin': 'Administratë',
      'Meeting': 'Mbledhje',
      'Other': 'Tjetër'
    };
    return catMap[c] || c;
  };

  const getPriorityLabel = (p) => {
    if (!isAlbanian) return PRIORITY_META[p].label;
    const pMap = { low: 'E Ulët', medium: 'Mesatare', high: 'E Lartë' };
    return pMap[p] || PRIORITY_META[p].label;
  };

  const getStatusLabel = (s) => {
    if (!isAlbanian) return STATUS_META[s].label;
    const sMap = { todo: 'Për të Bërë', inprogress: 'Në Progres', done: 'E Përfunduar' };
    return sMap[s] || STATUS_META[s].label;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="modal-box glass"
        initial={{ opacity: 0, scale: 0.93, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>
            {task ? (isAlbanian ? '✏️ Ndrysho Detyrën' : '✏️ Edit Task') : (userRole === 'student' ? (isAlbanian ? '✨ Detyrë e Re / Shtëpie' : '✨ New Homework / Task') : (isAlbanian ? '✨ Detyrë e Re' : '✨ New Task'))}
          </h3>
          <button className="icon-btn" onClick={onClose}><X size={20}/></button>
        </div>

        <div className="task-form">
          <div className="form-field">
            <label>{userRole === 'student' ? (isAlbanian ? 'Detyrë / Ushtrim' : 'Assignment / Task') : (isAlbanian ? 'Detyra' : 'Task')}<span className="required">*</span></label>
            <input
              className="tf-input"
              placeholder={userRole === 'student' ? (isAlbanian ? "p.sh., Lexo Kapitullin 4 në Fizikë, dorëzo detyrën..." : "e.g., Read Physics Chapter 4, submit draft...") : (isAlbanian ? "Çfarë duhet të bëhet?" : "What needs to be done?")}
              value={form.content}
              onChange={e => set('content', e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>{isAlbanian ? 'Statusi' : 'Status'}</label>
              <CustomSelect 
                value={form.status} 
                onChange={v => set('status', v)}
                options={STATUSES.map(s => ({ value: s, label: `${STATUS_META[s].emoji} ${getStatusLabel(s)}` }))}
              />
            </div>
            <div className="form-field">
              <label>{isAlbanian ? 'Prioriteti' : 'Priority'}</label>
              <CustomSelect 
                value={form.priority} 
                onChange={v => set('priority', v)}
                options={PRIORITIES.map(p => ({ value: p, label: `${PRIORITY_META[p].icon} ${getPriorityLabel(p)}` }))}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>{isAlbanian ? 'Kategoria' : 'Category'}</label>
              <CustomSelect 
                value={form.category} 
                onChange={v => set('category', v)}
                options={availableCategories.map(c => ({ value: c, label: getCategoryLabel(c) }))}
              />
            </div>
            <div className="form-field">
              <label>{isAlbanian ? 'Afati Përfundimtar' : 'Due Date'}</label>
              <input className="tf-input" type="date" value={form.due} onChange={e => set('due', e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label>{isAlbanian ? 'Shënime' : 'Notes'}</label>
            <textarea className="tf-input tf-textarea" placeholder={userRole === 'student' ? (isAlbanian ? "Faqet e librit, udhëzimet, shokët e grupit..." : "Page numbers, rubrics, study partners...") : (isAlbanian ? "Shtoni shënime…" : "Add any notes…")} value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary glass" onClick={onClose}>{isAlbanian ? 'Anulo' : 'Cancel'}</button>
          <button className="btn-primary" disabled={!form.content.trim()} onClick={() => onSave(form)}>
            <Check size={16}/> {task ? (isAlbanian ? 'Përditëso' : 'Update') : (userRole === 'student' ? (isAlbanian ? 'Ruaj Detyrën' : 'Save Task') : (isAlbanian ? 'Shto Detyrë' : 'Add Task'))}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ─── Single Task Card ───────────────────────────────────── */
const TaskCard = ({ task, onEdit, onDelete, onMove, compact, isAlbanian = false }) => {
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const isOverdue = task.due && new Date(task.due) < new Date() && task.status !== 'done';

  const getPriorityLabel = (p) => {
    if (!isAlbanian) return pm.label;
    const pMap = { low: 'E Ulët', medium: 'Mesatare', high: 'E Lartë' };
    return pMap[task.priority] || pm.label;
  };

  const getCategoryLabel = (c) => {
    if (!isAlbanian) return c;
    const catMap = {
      'Homework': 'Detyrë Shtëpie',
      'Study': 'Studim',
      'Project': 'Projekt',
      'Exams': 'Provime',
      'Personal': 'Personale',
      'Reading': 'Lexim',
      'Grading': 'Vlerësim',
      'Prep': 'Përgatitje',
      'Admin': 'Administratë',
      'Meeting': 'Mbledhje',
      'Other': 'Tjetër'
    };
    return catMap[c] || c;
  };

  return (
    <motion.div
      layout
      className={`task-card glass ${compact ? 'compact' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable
      onDragStart={e => e.dataTransfer.setData('taskId', task.id.toString())}
      style={{ borderLeft: `4px solid ${pm.color}` }}
    >
      <div className="task-card-top">
        <button
          className={`done-circle ${task.status === 'done' ? 'done' : ''}`}
          onClick={() => onMove(task.id, task.status === 'done' ? 'todo' : 'done')}
          title={task.status === 'done' ? (isAlbanian ? 'Shëno si të papërfunduar' : 'Mark undone') : (isAlbanian ? 'Shëno si të përfunduar' : 'Mark done')}
        >
          {task.status === 'done' && <Check size={12}/>}
        </button>
        <span className={`task-content-text ${task.status === 'done' ? 'strikethrough' : ''}`}>
          {task.content}
        </span>
        <div className="task-actions">
          <button className="icon-btn-xs" onClick={() => onEdit(task)} title={isAlbanian ? 'Ndrysho' : 'Edit'}><Edit size={13}/></button>
          <button className="icon-btn-xs destructive" onClick={() => onDelete(task.id)} title={isAlbanian ? 'Fshij' : 'Delete'}><Trash2 size={13}/></button>
        </div>
      </div>
      {!compact && (
        <div className="task-card-meta">
          <span className="task-badge" style={{ color: pm.color, background: `${pm.color}20` }}>{pm.icon} {getPriorityLabel(task.priority)}</span>
          {task.category && <span className="task-badge cat-badge">{getCategoryLabel(task.category)}</span>}
          {task.due && (
            <span className="task-badge" style={{ color: isOverdue ? 'hsl(var(--mood-sad))' : 'hsl(var(--muted-foreground))', background: isOverdue ? 'hsl(var(--mood-sad) / 0.12)' : 'hsl(var(--muted)/0.3)' }}>
              📅 {new Date(task.due).toLocaleDateString(isAlbanian ? 'sq-AL' : 'en-US', { month: 'short', day: 'numeric' })}
              {isOverdue && ' ⚠️'}
            </span>
          )}
          {task.notes && <span className="task-notes-preview">💬 {task.notes.slice(0, 45)}{task.notes.length > 45 ? '…' : ''}</span>}
        </div>
      )}
    </motion.div>
  );
};

/* ─── Kanban Column ──────────────────────────────────────── */
const KanbanCol = ({ status, tasks, onEdit, onDelete, onMove, isAlbanian = false }) => {
  const meta = STATUS_META[status];
  const [over, setOver] = useState(false);

  const getStatusLabel = (s) => {
    if (!isAlbanian) return meta.label;
    const sMap = { todo: 'Për të Bërë', inprogress: 'Në Progres', done: 'E Përfunduar' };
    return sMap[s] || meta.label;
  };

  return (
    <div
      className={`kanban-col glass ${over ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        setOver(false);
        const id = parseInt(e.dataTransfer.getData('taskId'));
        if (id) onMove(id, status);
      }}
      style={{ borderTop: `3px solid ${meta.color}` }}
    >
      <div className="kanban-col-header">
        <span className="kanban-col-label" style={{ color: meta.color }}>{meta.emoji} {getStatusLabel(status)}</span>
        <span className="task-count-badge" style={{ background: `${meta.color}22`, color: meta.color }}>{tasks.length}</span>
      </div>
      <div className="kanban-col-body">
        <AnimatePresence>
          {tasks.map(t => (
            <TaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} onMove={onMove} compact isAlbanian={isAlbanian} />
          ))}
        </AnimatePresence>
        {tasks.length === 0 && (
          <div className="kanban-empty">{isAlbanian ? 'Lëshoni detyrat këtu…' : 'Drop tasks here…'}</div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Tasks Page ────────────────────────────────────── */
const Tasks = ({ userRole = 'student' }) => {
  const { tasks, addTask, updateTask, deleteTask, moveTask } = useTasks();
  const { language, t, isAlbanian } = useLanguage();
  const [view, setView]         = useState('list');   // list | kanban
  const [modal, setModal]       = useState(null);     // null | 'new' | task obj
  const [filterCat, setFilterCat]     = useState('All');
  const [filterPri, setFilterPri]     = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQ, setSearchQ]   = useState('');
  const [sortBy, setSortBy]     = useState('due');

  const categories = userRole === 'student' ? STUDENT_CATEGORIES : STAFF_CATEGORIES;

  const getCategoryLabel = (c) => {
    if (!isAlbanian) return c;
    const catMap = {
      'All': 'Të Gjitha Kategoritë',
      'Homework': 'Detyrë Shtëpie',
      'Study': 'Studim',
      'Project': 'Projekt',
      'Exams': 'Provime',
      'Personal': 'Personale',
      'Reading': 'Lexim',
      'Grading': 'Vlerësim',
      'Prep': 'Përgatitje',
      'Admin': 'Administratë',
      'Meeting': 'Mbledhje',
      'Other': 'Tjetër'
    };
    return catMap[c] || c;
  };

  const getPriorityLabel = (p) => {
    if (!isAlbanian) return PRIORITY_META[p]?.label || p;
    const pMap = { low: 'E Ulët', medium: 'Mesatare', high: 'E Lartë' };
    return pMap[p] || PRIORITY_META[p]?.label || p;
  };

  const getStatusLabel = (s) => {
    if (!isAlbanian) return STATUS_META[s]?.label || s;
    const sMap = { todo: 'Për të Bërë', inprogress: 'Në Progres', done: 'E Përfunduar' };
    return sMap[s] || STATUS_META[s]?.label || s;
  };

  const handleSave = (form) => {
    if (modal === 'new') addTask(form);
    else updateTask(modal.id, form);
    setModal(null);
  };

  const roleBaseTasks = useMemo(() => {
    if (userRole === 'student') {
      return tasks.filter(t => t.role === 'student' || (!t.role && (t.category === 'Homework' || t.category === 'Study' || t.category === 'Project' || t.category === 'Exams' || t.category === 'Reading' || t.category === 'Personal')));
    }
    return tasks.filter(t => t.role !== 'student');
  }, [tasks, userRole]);

  const filtered = roleBaseTasks
    .filter(t => filterCat    === 'All' || t.category === filterCat)
    .filter(t => filterPri    === 'All' || t.priority === filterPri)
    .filter(t => filterStatus === 'All' || t.status   === filterStatus)
    .filter(t => t.content.toLowerCase().includes(searchQ.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'due')      return (a.due || '9999') < (b.due || '9999') ? -1 : 1;
    if (sortBy === 'priority') return PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority);
    if (sortBy === 'status')   return STATUSES.indexOf(a.status)     - STATUSES.indexOf(b.status);
    return 0;
  });

  const doneCount    = roleBaseTasks.filter(t => t.status === 'done').length;
  const totalCount   = roleBaseTasks.length;
  const overdueTasks = roleBaseTasks.filter(t => t.due && new Date(t.due) < new Date() && t.status !== 'done');

  return (
    <motion.div className="tasks-page" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>

      {/* ── Header ── */}
      <div className="tasks-header">
        <div>
          <h1 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {t('tasks.title')} <CheckSquare size={32} style={{ color: 'hsl(var(--primary))' }} />
          </h1>
          <p>{t('tasks.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('new')}>
          <Plus size={18}/> {t('tasks.addTask')}
        </button>
      </div>

      {/* ── Stats Strip ── */}
      <div className="tasks-stats">
        <div className="tstat glass">
          <span>📋</span>
          <div><strong>{totalCount}</strong><small>{t('common.total')}</small></div>
        </div>
        <div className="tstat glass">
          <span>⚡</span>
          <div><strong>{tasks.filter(t => t.status === 'inprogress').length}</strong><small>{t('tasks.inProgress')}</small></div>
        </div>
        <div className="tstat glass">
          <span>✅</span>
          <div><strong>{doneCount}</strong><small>{t('tasks.completed')}</small></div>
        </div>
        <div className="tstat glass" style={{ borderColor: overdueTasks.length ? 'hsl(var(--mood-sad)/0.4)' : undefined }}>
          <span>⚠️</span>
          <div>
            <strong style={{ color: overdueTasks.length ? 'hsl(var(--mood-sad))' : undefined }}>{overdueTasks.length}</strong>
            <small>{isAlbanian ? 'Të Vonuara' : 'Overdue'}</small>
          </div>
        </div>
        {/* Progress bar */}
        <div className="tasks-progress-wrap glass">
          <div className="tasks-progress-label">
            <span>{isAlbanian ? 'Përfundimi' : 'Completion'}</span>
            <strong>{totalCount ? Math.round((doneCount / totalCount) * 100) : 0}%</strong>
          </div>
          <div className="tasks-progress-bg">
            <motion.div
              className="tasks-progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="tasks-toolbar">
        <div className="tasks-search glass">
          <Search size={16}/>
          <input placeholder={isAlbanian ? 'Kërko detyrat…' : 'Search tasks…'} value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>
        <div className="tasks-filters">
          <CustomSelect 
            value={filterCat} 
            onChange={setFilterCat}
            options={categories.map(c => ({ value: c, label: getCategoryLabel(c) }))}
          />
          <CustomSelect 
            value={filterPri} 
            onChange={setFilterPri}
            options={[
              { value: 'All', label: isAlbanian ? 'Të Gjitha Prioritetet' : 'All Priorities' },
              ...PRIORITIES.map(p => ({ value: p, label: `${PRIORITY_META[p].icon} ${getPriorityLabel(p)}` }))
            ]}
          />
          <CustomSelect 
            value={filterStatus} 
            onChange={setFilterStatus}
            options={[
              { value: 'All', label: isAlbanian ? 'Të Gjitha Statuset' : 'All Statuses' },
              ...STATUSES.map(s => ({ value: s, label: `${STATUS_META[s].emoji} ${getStatusLabel(s)}` }))
            ]}
          />
          <CustomSelect 
            value={sortBy} 
            onChange={setSortBy}
            options={[
              { value: 'due',      label: isAlbanian ? 'Rendit: Sipas Afatit' : 'Sort: Due Date' },
              { value: 'priority', label: isAlbanian ? 'Rendit: Sipas Prioritetit' : 'Sort: Priority' },
              { value: 'status',   label: isAlbanian ? 'Rendit: Sipas Statusit' : 'Sort: Status' },
            ]}
          />
        </div>
        <div className="view-toggle glass">
          <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}><LayoutList size={17}/></button>
          <button className={`view-btn ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}><Columns size={17}/></button>
        </div>
      </div>

      {/* ── Overdue Banner ── */}
      <AnimatePresence>
        {overdueTasks.length > 0 && (
          <motion.div className="overdue-banner glass" initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
            <AlertCircle size={18} color="hsl(var(--mood-sad))"/>
            <span><strong>{overdueTasks.length} {isAlbanian ? 'detyra të vonuara' : `overdue task${overdueTasks.length > 1 ? 's' : ''}`}:</strong> {overdueTasks.map(t => t.content).join(' · ')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Views ── */}
      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <motion.div key="list" className="tasks-list" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
            {/* Group by status */}
            {STATUSES.map(status => {
              const group = sorted.filter(t => t.status === status);
              if (group.length === 0 && filterStatus !== 'All') return null;
              const meta = STATUS_META[status];
              return (
                <div key={status} className="task-group">
                  <div className="task-group-header" style={{ color: meta.color }}>
                    {meta.emoji} {getStatusLabel(status)}
                    <span className="task-count-badge" style={{ background: `${meta.color}20`, color: meta.color }}>{group.length}</span>
                  </div>
                  <AnimatePresence>
                    {group.map(t => (
                      <TaskCard key={t.id} task={t} onEdit={setModal} onDelete={deleteTask} onMove={moveTask} isAlbanian={isAlbanian} />
                    ))}
                  </AnimatePresence>
                  {group.length === 0 && (
                    <div className="group-empty">{isAlbanian ? 'Nuk ka detyra këtu — punë e shkëlqyer! 🎉' : 'No tasks here — great job! 🎉'}</div>
                  )}
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div className="empty-state"><Star size={32}/><p>{isAlbanian ? 'Asnjë detyrë nuk përputhet me filtrat tuaj.' : 'No tasks match your filters.'}</p></div>
            )}
          </motion.div>
        ) : (
          <motion.div key="kanban" className="kanban-board" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
            {STATUSES.map(status => (
              <KanbanCol
                key={status}
                status={status}
                tasks={sorted.filter(t => t.status === status)}
                onEdit={setModal}
                onDelete={deleteTask}
                onMove={moveTask}
                isAlbanian={isAlbanian}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal ── */}
      <AnimatePresence>
        {modal && (
          <TaskModal
            task={modal === 'new' ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
            userRole={userRole}
            categories={categories}
            isAlbanian={isAlbanian}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Tasks;
