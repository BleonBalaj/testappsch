import { createPortal } from 'react-dom';
import { useLayoutEffect, useState } from 'react';
import { createDialogBackgroundManager } from '../features/theme/dialog-background';

const background = createDialogBackgroundManager();

// Full-screen dialogs must escape page/card stacking and backdrop roots.
// React context and event handlers are retained by the portal.
export default function DialogPortal({ children }) {
  const [previousFocus] = useState(() => typeof document === 'undefined' ? null : document.activeElement);
  useLayoutEffect(() => {
    const release = background.lock(document, window);
    return () => {
      release();
      if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
    };
  }, [previousFocus]);
  return typeof document === 'undefined' ? null : createPortal(<div data-app-dialog-portal="true">{children}</div>, document.body);
}
