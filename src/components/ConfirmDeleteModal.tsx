import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { AccentButton } from './ui/AccentButton';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title = "Supprimer l'événement",
  message = "Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.",
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      header={
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-full bg-[#e57373]/12 text-[#e57373]"
          >
            <AlertTriangle size={15} strokeWidth={2} />
          </div>
          <span className="text-[13px] font-medium tracking-[0.15em] uppercase text-[#f2ede4]">
            {title}
          </span>
        </div>
      }
    >
      {/* Content */}
      <div className="px-6 py-6">
        <p className="text-[13px] leading-relaxed text-[#b0afa8]">
          {message}
        </p>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-[#0a0a0a]">
        <AccentButton variant="secondary" onClick={onCancel}>
          Annuler
        </AccentButton>
        <AccentButton
          onClick={onConfirm}
          className="!bg-[#e57373] hover:!bg-[#ef5350] !text-[#0d0d0d]"
        >
          Supprimer
        </AccentButton>
      </div>
    </Modal>
  );
};
