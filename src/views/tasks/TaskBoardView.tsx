import React from 'react';
import { Trash2 } from 'lucide-react';
import type { Task } from '../../services/tasksService';
import { SeikiKanbanBoard } from '../../components/ui/SeikiKanbanBoard';
import type { TaskWidgetHandlers } from './TaskWidgets';
import { TaskCardWidgets, TaskDescriptionWidget } from './TaskWidgets';
import { getPriorityInfo } from '../../utils/taskPriority';

interface TaskColumn {
  id: 'todo' | 'in_progress' | 'done';
  title: string;
  color: string;
}

const taskColumns: TaskColumn[] = [
  { id: 'todo', title: 'À faire', color: 'var(--color-danger)' },
  { id: 'in_progress', title: 'En cours', color: 'var(--color-amber)' },
  { id: 'done', title: 'Terminé', color: 'var(--color-success)' },
];

interface TaskBoardViewProps {
  todoTasks: Task[];
  inProgressTasks: Task[];
  doneTasks: Task[];
  dragOverStatus?: string | null;
  onDragOver?: (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => void;
  onDragLeave?: (status: 'todo' | 'in_progress' | 'done') => void;
  onDrop?: (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => void;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onAddTask: (status: 'todo' | 'in_progress' | 'done') => void;
  onUpdateStatus: (taskId: string, status: 'todo' | 'in_progress' | 'done') => void;
  onDeleteTask: (taskId: string) => void;
  widgets: TaskWidgetHandlers;
}

export const TaskBoardView: React.FC<TaskBoardViewProps> = ({
  todoTasks,
  inProgressTasks,
  doneTasks,
  onAddTask,
  onUpdateStatus,
  onDeleteTask,
  widgets,
}) => {
  const allTasks = [...todoTasks, ...inProgressTasks, ...doneTasks];

  return (
    <div className="w-full max-w-full overflow-hidden pb-2">
      <SeikiKanbanBoard<Task, TaskColumn>
        columns={taskColumns}
        cards={allTasks}
        getColumnId={(col) => col.id}
        getColumnTitle={(col) => col.title}
        getColumnColor={(col) => col.color}
        getCardId={(t) => t.id}
        getCardColumnId={(t) => t.status}
        fillWidth
        renderCard={(task) => {
          const pColor = getPriorityInfo(task.priority).color;
          const isDone = task.status === 'done';
          return (
            <div
              className="relative overflow-hidden rounded-xl p-3 transition-all group"
              style={{
                background: '#141414',
                border: '1px solid rgba(242,237,228,0.08)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                opacity: isDone ? 0.65 : 1,
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,196,168,0.25)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(242,237,228,0.08)')}
            >
              {/* Top right delete button */}
              <button
                type="button"
                aria-label="Supprimer la tâche"
                className="absolute right-2 top-2 rounded-md p-1 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 z-10"
                style={{ color: '#666' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-charcoal-danger, #e05252)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(224, 82, 82, 0.15)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#666';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTask(task.id);
                }}
              >
                <Trash2 size={13} />
              </button>

              <div className="mb-2 pr-6">
                <TaskDescriptionWidget
                  task={task}
                  onUpdateDescription={widgets.onUpdateDescription}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <TaskCardWidgets task={task} widgets={widgets} />
              </div>

              <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: pColor }}></div>
            </div>
          );
        }}
        renderColumnFooter={(col) => (
          <button
            type="button"
            className="mt-2.5 w-full rounded-lg py-2 text-[11px] uppercase tracking-[0.12em] font-medium transition-all cursor-pointer"
            style={{
              border: '1px dashed rgba(242,237,228,0.15)',
              color: 'var(--color-charcoal-fg-soft, #b0afa8)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-beige, #D4C4A8)';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-charcoal-fg, #f2ede4)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(212,196,168,0.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(242,237,228,0.15)';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-charcoal-fg-soft, #b0afa8)';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            onClick={() => onAddTask(col.id)}
          >
            + Ajouter une tâche
          </button>
        )}
        onCardMove={async (taskId, _fromCol, toCol) => {
          onUpdateStatus(taskId, toCol as 'todo' | 'in_progress' | 'done');
        }}
      />
    </div>
  );
};
