import React from 'react';
import { Plus } from 'lucide-react';

interface HeaderActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const HeaderActionButton: React.FC<HeaderActionButtonProps> = ({ onClick, children }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-md text-[12px] uppercase tracking-[0.12em] font-semibold transition-all duration-150 cursor-pointer hover:opacity-90 active:scale-[0.98]"
      style={{
        background: "var(--color-beige, #D4C4A8)",
        color: "#0d0d0d",
        boxShadow: "0 2px 8px rgba(212, 196, 168, 0.15)",
      }}
    >
      <Plus size={15} strokeWidth={2.5} />
      <span>{children}</span>
    </button>
  );
};
