import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './FilterSelect.css';

// A themed listbox. Native <option> menus are OS-painted and cannot carry
// Nature's rounded surfaces, selected colours or bounded popup geometry.
export default function FilterSelect({ label, value, options, onChange }) {
  const id = useId();
  const trigger = useRef(null), menu = useRef(null), typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null);
  const [lastPicked, setLastPicked] = useState(null);
  const selected = options.findIndex(option => option.value === value);
  const pick = index => {
    if (!options[index]) return;
    setLastPicked(options[index]); onChange(options[index].value); setOpen(false); trigger.current?.focus({ preventScroll: true });
  };
  const show = () => { setActive(Math.max(0, selected)); setOpen(true); };
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      const width = Math.min(Math.max(box.width, 230), window.innerWidth - 24);
      const below = window.innerHeight - box.bottom - 20, above = box.top - 20;
      const upward = below < 180 && above > below;
      setPosition({ width, left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)),
        maxHeight: Math.max(90, Math.min(340, upward ? above : below)),
        ...(upward ? { bottom: window.innerHeight - box.top + 7 } : { top: box.bottom + 7 }) });
    };
    const outside = event => { if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false); };
    const scroll = event => { if (!menu.current?.contains(event.target)) place(); };
    place();
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', place);
    return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', place); };
  }, [open]);
  useEffect(() => { if (open) menu.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [open, active, position]);
  const onKeyDown = event => {
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Escape') { setOpen(false); event.stopPropagation(); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(); return; }
      if (event.key === 'Enter' || event.key === ' ') { pick(active); return; }
      setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      typed.current = { at: now, text: (now - typed.current.at < 700 ? typed.current.text : '') + event.key.toLocaleLowerCase() };
      const index = options.findIndex(option => String(option.label).toLocaleLowerCase().startsWith(typed.current.text));
      if (index >= 0) { setActive(index); setOpen(true); }
    }
  };
  return <div className="app-filter-select">
    <button type="button" className="app-filter-trigger" ref={trigger} role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${id}-menu`} aria-haspopup="listbox" aria-activedescendant={open ? `${id}-${active}` : undefined} onKeyDown={onKeyDown} onClick={() => open ? setOpen(false) : show()}><span>{options[selected]?.label || (lastPicked?.value === value ? lastPicked.label : label)}</span><ChevronDown size={16} aria-hidden="true" /></button>
    {open && position && createPortal(<div ref={menu} id={`${id}-menu`} role="listbox" aria-label={label} className="app-filter-popover" style={position} onPointerDown={event => { if (event.target.closest('[role="option"]')) event.preventDefault(); }}>{options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={option.value === value} data-active={index === active} className={`app-filter-option ${option.value === value ? 'is-selected' : ''}`} onPointerMove={() => setActive(index)} onClick={() => pick(index)}><span>{option.label}</span>{option.value === value && <Check size={16} aria-hidden="true" />}</div>)}</div>, document.body)}
  </div>;
}
