import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-md bg-[#111111] overflow-hidden"
        style={{
          borderTop: "1px solid var(--color-beige, #D4C4A8)",
          borderLeft: "1px solid rgba(242,237,228,0.08)",
          borderRight: "1px solid rgba(242,237,228,0.08)",
          borderBottom: "1px solid rgba(242,237,228,0.08)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full"
              style={{ background: "rgba(229,115,115,0.12)", color: "#e57373" }}
            >
              <AlertTriangle size={15} strokeWidth={2} />
            </div>
            <h3 className="text-[13px] font-medium tracking-[0.15em] uppercase" style={{ color: "#f2ede4" }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-white transition-colors cursor-pointer p-1 outline-none focus:outline-none"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-[13px] leading-relaxed text-[#b0afa8]">
            {message}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-[#0a0a0a]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-[11px] tracking-[0.15em] uppercase font-medium text-[#b0afa8] hover:text-[#f2ede4] transition-colors cursor-pointer outline-none focus:outline-none"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 text-[11px] tracking-[0.15em] uppercase font-semibold transition-all duration-150 cursor-pointer outline-none focus:outline-none"
            style={{
              background: "#e57373",
              color: "#0d0d0d",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#ef5350")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#e57373")}
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
};
