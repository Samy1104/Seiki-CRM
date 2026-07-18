import React from 'react';

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
 */
export const Modal: React.FC<ModalProps> = ({ open, onClose, header, children }) => {
  if (!open) return null;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>{header}</div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};
