import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Edit, Check, X, Flag, Tag,
  Calendar, Search, LayoutList, Columns, CheckSquare,
  Clock, AlertCircle, Star, ChevronDown
} from 'lucide-react';
import { useTasks } from '../context/TasksContext';
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
const CATEGORIES = ['All', 'Grading', 'Prep', 'Admin', 'Meeting', 'Personal', 'Other'];

/* ─── Custom Select Component ────────────────────────────── */
const CustomSelect = ({ value, onChange, options, placeholder }) => {
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
const TaskModal = ({ task, onSave, onClose }) => {
  const [form, setForm] = useState(task || {
    content: '', status: 'todo', priority: 'medium',
    category: 'Admin', due: '', notes: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
          <h3>{task ? '✏️ Edit Task' : '✨ New Task'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={20}/></button>
        </div>

        <div className="task-form">
          <div className="form-field">
            <label>Task<span className="required">*</span></label>
            <input
              className="tf-input"
              placeholder="What needs to be done?"
              value={form.content}
              onChange={e => set('content', e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Status</label>
              <CustomSelect 
                value={form.status} 
                onChange={v => set('status', v)}
                options={STATUSES.map(s => ({ value: s, label: `${STATUS_META[s].emoji} ${STATUS_META[s].label}` }))}
              />
            </div>
            <div className="form-field">
              <label>Priority</label>
              <CustomSelect 
                value={form.priority} 
                onChange={v => set('priority', v)}
                options={PRIORITIES.map(p => ({ value: p, label: `${PRIORITY_META[p].icon} ${PRIORITY_META[p].label}` }))}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Category</label>
              <CustomSelect 
                value={form.category} 
                onChange={v => set('category', v)}
                options={CATEGORIES.filter(c => c !== 'All').map(c => ({ value: c, label: c }))}
              />
            </div>
            <div className="form-field">
              <label>Due Date</label>
              <input className="tf-input" type="date" value={form.due} onChange={e => set('due', e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label>Notes</label>
            <textarea className="tf-input tf-textarea" placeholder="Add any notes…" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary glass" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!form.content.trim()} onClick={() => onSave(form)}>
            <Check size={16}/> {task ? 'Update' : 'Add Task'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ─── Single Task Card ───────────────────────────────────── */
const TaskCard = ({ task, onEdit, onDelete, onMove, compact }) => {
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const sm = STATUS_META[task.status]     || STATUS_META.todo;
  const isOverdue = task.due && new Date(task.due) < new Date() && task.status !== 'done';

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
          title={task.status === 'done' ? 'Mark undone' : 'Mark done'}
        >
          {task.status === 'done' && <Check size={12}/>}
        </button>
        <span className={`task-content-text ${task.status === 'done' ? 'strikethrough' : ''}`}>
          {task.content}
        </span>
        <div className="task-actions">
          <button className="icon-btn-xs" onClick={() => onEdit(task)} title="Edit"><Edit size={13}/></button>
          <button className="icon-btn-xs destructive" onClick={() => onDelete(task.id)} title="Delete"><Trash2 size={13}/></button>
        </div>
      </div>
      {!compact && (
        <div className="task-card-meta">
          <span className="task-badge" style={{ color: pm.color, background: `${pm.color}20` }}>{pm.icon} {pm.label}</span>
          {task.category && <span className="task-badge cat-badge">{task.category}</span>}
          {task.due && (
            <span className="task-badge" style={{ color: isOverdue ? 'hsl(var(--mood-sad))' : 'hsl(var(--muted-foreground))', background: isOverdue ? 'hsl(var(--mood-sad) / 0.12)' : 'hsl(var(--muted)/0.3)' }}>
              📅 {new Date(task.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
const KanbanCol = ({ status, tasks, onEdit, onDelete, onMove }) => {
  const meta = STATUS_META[status];
  const [over, setOver] = useState(false);
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
        <span className="kanban-col-label" style={{ color: meta.color }}>{meta.emoji} {meta.label}</span>
        <span className="task-count-badge" style={{ background: `${meta.color}22`, color: meta.color }}>{tasks.length}</span>
      </div>
      <div className="kanban-col-body">
        <AnimatePresence>
          {tasks.map(t => (
            <TaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} onMove={onMove} compact />
          ))}
        </AnimatePresence>
        {tasks.length === 0 && (
          <div className="kanban-empty">Drop tasks here…</div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Tasks Page ────────────────────────────────────── */
const Tasks = () => {
  const { tasks, addTask, updateTask, deleteTask, moveTask } = useTasks();
  const [view, setView]         = useState('list');   // list | kanban
  const [modal, setModal]       = useState(null);     // null | 'new' | task obj
  const [filterCat, setFilterCat]     = useState('All');
  const [filterPri, setFilterPri]     = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQ, setSearchQ]   = useState('');
  const [sortBy, setSortBy]     = useState('due');

  const handleSave = (form) => {
    if (modal === 'new') addTask(form);
    else updateTask(modal.id, form);
    setModal(null);
  };

  const filtered = tasks
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

  const doneCount    = tasks.filter(t => t.status === 'done').length;
  const totalCount   = tasks.length;
  const overdueTasks = tasks.filter(t => t.due && new Date(t.due) < new Date() && t.status !== 'done');

  return (
    <motion.div className="tasks-page" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>

      {/* ── Header ── */}
      <div className="tasks-header">
        <div>
          <h1 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            My Tasks <CheckSquare size={32} style={{ color: 'hsl(var(--primary))' }} />
          </h1>
          <p>Stay on top of everything, one task at a time.</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('new')}>
          <Plus size={18}/> New Task
        </button>
      </div>

      {/* ── Stats Strip ── */}
      <div className="tasks-stats">
        <div className="tstat glass">
          <span>📋</span>
          <div><strong>{totalCount}</strong><small>Total</small></div>
        </div>
        <div className="tstat glass">
          <span>⚡</span>
          <div><strong>{tasks.filter(t => t.status === 'inprogress').length}</strong><small>In Progress</small></div>
        </div>
        <div className="tstat glass">
          <span>✅</span>
          <div><strong>{doneCount}</strong><small>Completed</small></div>
        </div>
        <div className="tstat glass" style={{ borderColor: overdueTasks.length ? 'hsl(var(--mood-sad)/0.4)' : undefined }}>
          <span>⚠️</span>
          <div>
            <strong style={{ color: overdueTasks.length ? 'hsl(var(--mood-sad))' : undefined }}>{overdueTasks.length}</strong>
            <small>Overdue</small>
          </div>
        </div>
        {/* Progress bar */}
        <div className="tasks-progress-wrap glass">
          <div className="tasks-progress-label">
            <span>Completion</span>
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
          <input placeholder="Search tasks…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>
        <div className="tasks-filters">
          <CustomSelect 
            value={filterCat} 
            onChange={setFilterCat}
            options={CATEGORIES.map(c => ({ value: c, label: c === 'All' ? 'All Categories' : c }))}
          />
          <CustomSelect 
            value={filterPri} 
            onChange={setFilterPri}
            options={[
              { value: 'All', label: 'All Priorities' },
              ...PRIORITIES.map(p => ({ value: p, label: `${PRIORITY_META[p].icon} ${PRIORITY_META[p].label}` }))
            ]}
          />
          <CustomSelect 
            value={filterStatus} 
            onChange={setFilterStatus}
            options={[
              { value: 'All', label: 'All Statuses' },
              ...STATUSES.map(s => ({ value: s, label: `${STATUS_META[s].emoji} ${STATUS_META[s].label}` }))
            ]}
          />
          <CustomSelect 
            value={sortBy} 
            onChange={setSortBy}
            options={[
              { value: 'due',      label: 'Sort: Due Date' },
              { value: 'priority', label: 'Sort: Priority' },
              { value: 'status',   label: 'Sort: Status' },
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
            <span><strong>{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}:</strong> {overdueTasks.map(t => t.content).join(' · ')}</span>
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
                    {meta.emoji} {meta.label}
                    <span className="task-count-badge" style={{ background: `${meta.color}20`, color: meta.color }}>{group.length}</span>
                  </div>
                  <AnimatePresence>
                    {group.map(t => (
                      <TaskCard key={t.id} task={t} onEdit={setModal} onDelete={deleteTask} onMove={moveTask} />
                    ))}
                  </AnimatePresence>
                  {group.length === 0 && (
                    <div className="group-empty">No tasks here — great job! 🎉</div>
                  )}
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div className="empty-state"><Star size={32}/><p>No tasks match your filters.</p></div>
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
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Tasks;
