import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, Minus, X } from 'lucide-react';
import { formatNumber } from '../../features/platformAdmin/format';

export function Card({ title, subtitle, actions, className = '', children }) {
  return (
    <section className={`padm-card ${className}`}>
      {(title || actions) && (
        <header className="padm-card-header">
          <div>
            {title && <h2 className="padm-card-title">{title}</h2>}
            {subtitle && <p className="padm-card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="padm-card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Signed change against a named period; up is good for every metric shown here. */
export function Delta({ current, previous, periodLabel }) {
  const diff = current - previous;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const text = direction === 'flat' ? 'No change' : `${diff > 0 ? '+' : '−'}${formatNumber(Math.abs(diff))}`;
  return (
    <span className={`padm-delta padm-delta-${direction}`}>
      <Icon size={14} aria-hidden="true" />
      {text} vs previous {periodLabel}
    </span>
  );
}

export function StatTile({ label, value, icon: Icon, children }) {
  return (
    <div className="padm-stat">
      <div className="padm-stat-top">
        <span className="padm-stat-label">{label}</span>
        {Icon && <span className="padm-stat-icon" aria-hidden="true"><Icon size={16} /></span>}
      </div>
      <div className="padm-stat-value">{value}</div>
      {children && <div className="padm-stat-meta">{children}</div>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children, title }) {
  return <span className={`padm-badge padm-badge-${tone}`} title={title}>{children}</span>;
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="padm-empty">
      {Icon && <Icon size={28} aria-hidden="true" />}
      <p className="padm-empty-title">{title}</p>
      {children && <p className="padm-empty-text">{children}</p>}
    </div>
  );
}

export function Pagination({ page, pageCount, total, pageSize, noun, onChange }) {
  if (!total) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <footer className="padm-pagination">
      <span>Showing {formatNumber(first)}–{formatNumber(last)} of {formatNumber(total)} {noun}</span>
      {pageCount > 1 && (
        <div className="padm-pagination-controls">
          <button type="button" className="padm-icon-btn" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          <span className="padm-pagination-page">Page {page} of {pageCount}</span>
          <button type="button" className="padm-icon-btn" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </footer>
  );
}

export function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className="padm-icon-btn padm-copy" onClick={copy} aria-label={copied ? `${label} copied` : `Copy ${label}`} title={copied ? 'Copied' : `Copy ${label}`}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

/** Standard app dialog shell (see .agents/agents.md §4): one scrolling body. */
export function Dialog({ title, subtitle, onClose, wide = false, children }) {
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className={`modal-content padm-dialog ${wide ? 'padm-dialog-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </motion.div>
    </div>
  );
}
