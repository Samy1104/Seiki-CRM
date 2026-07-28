import React from 'react';
import { List, Kanban, Plus } from 'lucide-react';
import { AccentButton } from '../../components/ui/AccentButton';
import { SegmentedToggle } from '../../components/ui/SegmentedToggle';
import { PageTitle } from '../../components/ui/PageTitle';

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
        <PageTitle>Gestion des Tâches</PageTitle>
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
