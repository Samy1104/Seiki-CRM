import React from 'react';
import { List, Kanban, Plus } from 'lucide-react';

interface TasksHeaderProps {
  viewMode: 'list' | 'board';
  setViewMode: (mode: 'list' | 'board') => void;
  onNewTaskClick: () => void;
}

export const TasksHeader: React.FC<TasksHeaderProps> = ({
  viewMode,
  setViewMode,
  onNewTaskClick,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
      <div>
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 900,
            fontSize: "2.25rem",
            color: "var(--color-charcoal-fg, #f2ede4)",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Gestion des Tâches
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Switcher vue Liste / Tableau */}
        <div
          className="flex items-center p-1 rounded-lg"
          style={{
            background: "#141414",
            border: "1px solid rgba(242,237,228,0.08)",
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] uppercase tracking-[0.12em] font-medium transition-all duration-150 cursor-pointer"
            style={{
              background: viewMode === 'list' ? 'rgba(212,196,168,0.14)' : 'transparent',
              color: viewMode === 'list' ? 'var(--color-beige, #D4C4A8)' : '#666',
              border: viewMode === 'list' ? '1px solid rgba(212,196,168,0.25)' : '1px solid transparent',
            }}
          >
            <List size={13} />
            <span>Liste</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] uppercase tracking-[0.12em] font-medium transition-all duration-150 cursor-pointer"
            style={{
              background: viewMode === 'board' ? 'rgba(212,196,168,0.14)' : 'transparent',
              color: viewMode === 'board' ? 'var(--color-beige, #D4C4A8)' : '#666',
              border: viewMode === 'board' ? '1px solid rgba(212,196,168,0.25)' : '1px solid transparent',
            }}
          >
            <Kanban size={13} />
            <span>Tableau</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onNewTaskClick}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-[12px] uppercase tracking-[0.12em] font-semibold transition-all duration-150 cursor-pointer hover:opacity-90 active:scale-[0.98]"
          style={{
            background: "var(--color-beige, #D4C4A8)",
            color: "#0d0d0d",
            boxShadow: "0 2px 8px rgba(212, 196, 168, 0.15)",
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>Nouvelle tâche</span>
        </button>
      </div>
    </div>
  );
};
