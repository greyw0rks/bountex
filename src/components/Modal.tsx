import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
export function Modal({
  open,
  title,
  children,
  onClose,
  wide = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(
      () =>
        dialog.current?.querySelector<HTMLElement>('button,input,textarea,[tabindex="0"]')?.focus(),
      30,
    );
    function keys(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const list = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
        );
        if (!list?.length) return;
        const first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', keys);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = original;
      document.removeEventListener('keydown', keys);
      previous?.focus();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialog}
            className={`modal ${wide ? 'modal-wide' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={reduced ? false : { y: 24, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={reduced ? {} : { y: 12, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="modal-header">
              <h2 id="modal-title">{title}</h2>
              <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
