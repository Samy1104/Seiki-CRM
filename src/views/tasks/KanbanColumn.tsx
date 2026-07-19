import React from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import type { Task } from '../../services/tasksService';
import { TaskCardWidgets } from './TaskWidgets';
import type { TaskWidgetHandlers } from './TaskWidgets';
import { getPriorityInfo } from '../../utils/taskPriority';

// Board column drop indicator — a thin line inserted between cards showing
// exactly where the dragged card will land. Opacity is toggled imperatively
// (not via React state) so dragging over many cards doesn't cause re-renders.
const DropIndicator: React.FC<{ beforeId: string | null; column: string }> = ({ beforeId, column }) => (
  <div data-before={beforeId || '-1'} data-column={column} className="h-0.5 rounded-full bg-line-focus opacity-0 transition-opacity" />
);

interface KanbanColumnProps {
  status: 'todo' | 'in_progress' | 'done';
  label: string;
  borderColor: string;
  tasks: Task[];
  dragOverStatus: string | null;
  onDragOver: (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => void;
  onDragLeave: (status: 'todo' | 'in_progress' | 'done') => void;
  onDrop: (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onAddTask: () => void;
  widgets: TaskWidgetHandlers;
  renderCardActions: (task: Task) => React.ReactNode;
  cardStyle?: React.CSSProperties;
  descriptionStyle?: React.CSSProperties;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status, label, borderColor, tasks, dragOverStatus,
  onDragOver, onDragLeave, onDrop, onDragStart, onAddTask,
  widgets, renderCardActions, cardStyle, descriptionStyle,
}) => (
  <div
    className={`flex w-72 flex-shrink-0 flex-col rounded-surface border p-3 transition-colors ${dragOverStatus === status ? 'border-line-focus bg-amber-soft/20' : 'border-line bg-surface/40'}`}
    onDragOver={(e) => onDragOver(e, status)}
    onDragLeave={() => onDragLeave(status)}
    onDrop={(e) => onDrop(e, status)}
  >
    <div className="mb-3 flex items-center justify-between border-b-2 pb-2" style={{ borderBottomColor: borderColor }}>
      <span className="flex items-center gap-1.5 font-display text-[13.5px] font-bold text-ink">
        {label} <span className="font-ui text-[11px] font-normal text-ink-soft">{tasks.length}</span>
      </span>
      <button
        className="rounded-control p-1 text-ink-faint transition-colors hover:bg-hover hover:text-ink cursor-pointer"
        onClick={onAddTask}
        title="Ajouter une tâche"
      >
        <Plus size={13} />
      </button>
    </div>
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
      {tasks.map(task => {
        const pColor = getPriorityInfo(task.priority).color;
        return (
          <React.Fragment key={task.id}>
            <DropIndicator beforeId={task.id} column={status} />
            <div draggable="true" onDragStart={(e) => onDragStart(e, task.id)}>
              <motion.div
                layout
                layoutId={task.id}
                className="relative overflow-hidden rounded-control border border-line bg-elevated p-3"
                style={cardStyle}
              >
                <div className="mb-3 text-[13.5px] font-semibold text-ink" style={descriptionStyle}>
                  {task.description}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <TaskCardWidgets task={task} widgets={widgets} />
                </div>

                <div className="mt-2.5 flex gap-3 border-t border-line pt-2 text-[11px] font-medium text-ink-soft">
                  {renderCardActions(task)}
                </div>
                <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: pColor }}></div>
              </motion.div>
            </div>
          </React.Fragment>
        );
      })}
      <DropIndicator beforeId={null} column={status} />
    </div>
  </div>
);
