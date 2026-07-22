import React from 'react';
import { List, Kanban, Plus } from 'lucide-react';
import { AccentButton } from '../../components/ui/AccentButton';
import { SegmentedToggle } from '../../components/ui/SegmentedToggle';

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
        <SegmentedToggle
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'list', label: 'Liste', icon: <List size={13} /> },
            { value: 'board', label: 'Tableau', icon: <Kanban size={13} /> },
          ]}
        />

        <AccentButton icon={<Plus size={15} strokeWidth={2.5} />} onClick={onNewTaskClick}>Nouvelle tâche</AccentButton>
      </div>
    </div>
  );
};
