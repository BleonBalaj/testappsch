import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import DialogPortal from './DialogPortal';
export default function LessonSharingDialog({ title, children, side = false, onClose }) {
  const ref = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const elements = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]')].filter(element=>element.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (!elements.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); };
  }, []);
  return <DialogPortal><div className={`lesson-sharing-overlay ${side ? 'is-side' : ''}`} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><section ref={ref} className="lesson-sharing-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><header><h2 id={titleId}>{title}</h2><button type="button" className="lesson-icon-button" onClick={onClose} aria-label="Close / Mbyll"><X size={21} /></button></header><div className="lesson-sharing-dialog-body">{children}</div></section></div></DialogPortal>;
}
