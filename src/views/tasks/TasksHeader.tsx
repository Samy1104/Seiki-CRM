import React from 'react';
import { List, Kanban, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';

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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1
          className="text-4xl font-bold tracking-tight text-[var(--text-primary)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Gestion des Tâches
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Suivez et organisez vos actions commerciales
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Switcher vue Liste / Tableau */}
        <div
          className="flex items-center p-1 rounded-xl border border-[var(--border-subtle)]"
          style={{ background: 'var(--bg-panel)' }}
        >
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
              viewMode === 'list'
                ? 'bg-[var(--gold)] text-black font-semibold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <List size={14} />
            <span>Liste</span>
          </button>
          <button
            onClick={() => setViewMode('board')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
              viewMode === 'board'
                ? 'bg-[var(--gold)] text-black font-semibold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Kanban size={14} />
            <span>Tableau</span>
          </button>
        </div>

        <Button
          onClick={onNewTaskClick}
          className="flex items-center gap-2 bg-[var(--gold)] text-black font-semibold hover:bg-[var(--gold)]/90"
        >
          <Plus size={16} />
          <span>Nouvelle tâche</span>
        </Button>
      </div>
    </div>
  );
};
