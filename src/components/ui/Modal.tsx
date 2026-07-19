import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared modal shell (overlay + box + header + close button) — before this,
 * every view that needed a modal hand-rolled the same overlay/box/header
 * JSX from scratch (see Pipeline.tsx, Leads.tsx). Keeps only the chrome;
 * callers own everything below the header (tabs, forms, footer...).
 *
 * Always renders (never returns null) so AnimatePresence can play the exit
 * transition when `open` flips to false — a caller doing `{open && <Modal>}`
 * would unmount before the animation had a chance to run.
 */
export const Modal: React.FC<ModalProps> = ({ open, onClose, header, children }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line-strong bg-surface font-ui shadow-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="font-display text-base font-bold text-ink">{header}</div>
              <button
                className="rounded-sm p-1 text-ink-faint transition-colors hover:bg-hover hover:text-ink cursor-pointer"
                onClick={onClose}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
