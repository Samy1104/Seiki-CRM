import React from 'react';
import type { Task } from '../../services/tasksService';
import { KanbanColumn } from './KanbanColumn';
import type { TaskWidgetHandlers } from './TaskWidgets';

interface TaskBoardViewProps {
  todoTasks: Task[];
  inProgressTasks: Task[];
  doneTasks: Task[];
  dragOverStatus: string | null;
  onDragOver: (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => void;
  onDragLeave: (status: 'todo' | 'in_progress' | 'done') => void;
  onDrop: (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onAddTask: (status: 'todo' | 'in_progress' | 'done') => void;
  onUpdateStatus: (taskId: string, status: 'todo' | 'in_progress' | 'done') => void;
  onDeleteTask: (taskId: string) => void;
  widgets: TaskWidgetHandlers;
}

export const TaskBoardView: React.FC<TaskBoardViewProps> = ({
  todoTasks, inProgressTasks, doneTasks,
  dragOverStatus, onDragOver, onDragLeave, onDrop, onDragStart, onAddTask,
  onUpdateStatus, onDeleteTask, widgets,
}) => (
  <div className="pipe-wrap" style={{ gap: '16px' }}>
    <KanbanColumn
      status="todo"
      label="À faire"
      borderColor="var(--red)"
      tasks={todoTasks}
      dragOverStatus={dragOverStatus}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragStart={onDragStart}
      onAddTask={() => onAddTask('todo')}
      widgets={widgets}
      renderCardActions={(task) => (
        <>
          <button className="hist-btn" onClick={() => onUpdateStatus(task.id, 'in_progress')}>En cours →</button>
          <button className="hist-btn del" onClick={() => onDeleteTask(task.id)}>Supprimer</button>
        </>
      )}
    />

    <KanbanColumn
      status="in_progress"
      label="En cours"
      borderColor="var(--gold)"
      tasks={inProgressTasks}
      dragOverStatus={dragOverStatus}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragStart={onDragStart}
      onAddTask={() => onAddTask('in_progress')}
      widgets={widgets}
      renderCardActions={(task) => (
        <>
          <button className="hist-btn" onClick={() => onUpdateStatus(task.id, 'todo')}>← À faire</button>
          <button className="hist-btn" onClick={() => onUpdateStatus(task.id, 'done')}>Fini ✓</button>
        </>
      )}
    />

    <KanbanColumn
      status="done"
      label="Terminé"
      borderColor="var(--green)"
      tasks={doneTasks}
      dragOverStatus={dragOverStatus}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragStart={onDragStart}
      onAddTask={() => onAddTask('done')}
      widgets={widgets}
      cardStyle={{ opacity: 0.7 }}
      descriptionStyle={{ textDecoration: 'line-through' }}
      renderCardActions={(task) => (
        <>
          <button className="hist-btn" onClick={() => onUpdateStatus(task.id, 'in_progress')}>← Ouvrir</button>
          <button className="hist-btn del" onClick={() => onDeleteTask(task.id)}>Supprimer</button>
        </>
      )}
    />
  </div>
);
