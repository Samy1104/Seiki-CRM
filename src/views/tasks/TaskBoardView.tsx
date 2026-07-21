import React from 'react';
import { Trash2 } from 'lucide-react';
import type { Task } from '../../services/tasksService';
import { SeikiKanbanBoard } from '../../components/ui/SeikiKanbanBoard';
import type { TaskWidgetHandlers } from './TaskWidgets';
import { TaskCardWidgets } from './TaskWidgets';
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
            className="relative overflow-hidden rounded-control border border-[#c8b89a]/50 bg-[#1c1d22] p-3 transition-colors hover:border-[#c8b89a]"
            style={isDone ? { opacity: 0.7 } : undefined}
          >
            <div className="mb-3 text-[13.5px] font-semibold text-ink" style={isDone ? { textDecoration: 'line-through' } : undefined}>
              {task.description}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <TaskCardWidgets task={task} widgets={widgets} />
            </div>

            <div className="mt-2.5 flex justify-end border-t border-line pt-2">
              <button
                aria-label="Supprimer la tâche"
                className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                onClick={() => onDeleteTask(task.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: pColor }}></div>
          </div>
        );
      }}
      renderColumnFooter={(col) => (
        <button
          className="mt-2.5 w-full rounded-control border border-dashed border-line-strong py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-focus hover:text-ink cursor-pointer"
          onClick={() => onAddTask(col.id)}
        >
          + Ajouter une tâche
        </button>
      )}
      onCardMove={async (taskId, _fromCol, toCol) => {
        onUpdateStatus(taskId, toCol as 'todo' | 'in_progress' | 'done');
      }}
    />
  );
};
