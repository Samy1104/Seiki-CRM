import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Right-anchored slide-over, same overlay/AnimatePresence shell as Modal.tsx
 * but sliding horizontally instead of scaling from center — used for
 * click-to-drill-down panels (stage bars, cohort cells, KPI cards).
 */
export const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="drawer-overlay"
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="h-full w-full max-w-md overflow-y-auto border-l border-line-strong bg-surface font-ui shadow-modal sm:max-w-lg"
            onClick={(e) => e.stopPropagation()}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="font-display text-sm font-bold text-ink">{title}</div>
              <button
                className="rounded-control p-1 text-ink-faint transition-colors hover:bg-hover hover:text-ink cursor-pointer"
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
