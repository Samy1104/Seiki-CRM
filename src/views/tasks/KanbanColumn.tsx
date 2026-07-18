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
  <div data-before={beforeId || '-1'} data-column={column} className="task-drop-indicator" />
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
    className={`pipe-col ${dragOverStatus === status ? 'drag-over' : ''}`}
    onDragOver={(e) => onDragOver(e, status)}
    onDragLeave={() => onDragLeave(status)}
    onDrop={(e) => onDrop(e, status)}
  >
    <div className="pipe-head" style={{ borderBottomColor: borderColor }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {label} <span>{tasks.length}</span>
      </span>
      <button className="pipe-head-add-btn" onClick={onAddTask} title="Ajouter une tâche">
        <Plus size={13} />
      </button>
    </div>
    <div className="pipe-cards-container">
      {tasks.map(task => {
        const pColor = getPriorityInfo(task.priority).color;
        return (
          <React.Fragment key={task.id}>
            <DropIndicator beforeId={task.id} column={status} />
            <div draggable="true" onDragStart={(e) => onDragStart(e, task.id)}>
              <motion.div layout layoutId={task.id} className="task-board-card" style={cardStyle}>
                <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-h)', marginBottom: '12px', ...descriptionStyle }}>
                  {task.description}
                </div>

                <div className="task-board-card-clickup-row">
                  <TaskCardWidgets task={task} widgets={widgets} />
                </div>

                <div className="task-card-actions">
                  {renderCardActions(task)}
                </div>
                <div className="task-card-priority-dot" style={{ background: pColor }}></div>
              </motion.div>
            </div>
          </React.Fragment>
        );
      })}
      <DropIndicator beforeId={null} column={status} />
    </div>
  </div>
);
