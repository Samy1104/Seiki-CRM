import React from 'react';
import { Trash2, GripVertical } from 'lucide-react';
import type { Task } from '../../services/tasksService';
import { AssigneeWidget, DatePickerWidget, PriorityWidget, LeadWidget } from './TaskWidgets';
import type { TaskWidgetHandlers } from './TaskWidgets';

export interface ColWidths {
  name: number;
  assignee: number;
  date: number;
  priority: number;
  lead: number;
}

interface TaskListViewProps {
  todoTasks: Task[];
  inProgressTasks: Task[];
  doneTasks: Task[];
  colWidths: ColWidths;
  onStartResize: (e: React.MouseEvent, column: keyof ColWidths) => void;
  dragOverStatus: string | null;
  dragOverTaskId: string | null;
  draggedTaskId: string | null;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragOver: (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => void;
  onDragLeave: () => void;
  onDragOverTask: (e: React.DragEvent, taskId: string, status: 'todo' | 'in_progress' | 'done') => void;
  onDragLeaveTask: () => void;
  onDrop: (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => void;
  onToggleStatus: (taskId: string, currentStatus: string) => void;
  onDeleteTask: (taskId: string) => void;
  widgets: TaskWidgetHandlers;
}

const sectionAccent: Record<'todo' | 'in_progress' | 'done', string> = {
  todo: 'border-l-danger text-danger',
  in_progress: 'border-l-amber text-amber',
  done: 'border-l-success text-success',
};

export const TaskListView: React.FC<TaskListViewProps> = ({
  todoTasks, inProgressTasks, doneTasks,
  colWidths, onStartResize,
  dragOverStatus, dragOverTaskId, draggedTaskId,
  onDragStart, onDragOver, onDragLeave, onDragOverTask, onDragLeaveTask, onDrop,
  onToggleStatus, onDeleteTask, widgets,
}) => {
  const renderTableRows = (tasksList: Task[], statusKey: 'todo' | 'in_progress' | 'done') => (
    <div
      className={`flex flex-col rounded-b-surface border border-t-0 border-line transition-colors ${dragOverStatus === statusKey ? 'bg-amber-soft/10' : 'bg-surface'}`}
      onDragOver={(e) => onDragOver(e, statusKey)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, statusKey)}
    >
      {tasksList.length > 0 ? (
        tasksList.map(task => (
          <div
            key={task.id}
            className={`flex items-center border-b border-line px-2 py-2 last:border-b-0 hover:bg-hover ${dragOverTaskId === task.id && draggedTaskId !== task.id ? 'border-t-2 border-t-amber' : ''}`}
            draggable="true"
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragOver={(e) => onDragOverTask(e, task.id, statusKey)}
            onDragLeave={onDragLeaveTask}
          >
            <div className="flex flex-shrink-0 items-center justify-center text-ink-faint" style={{ width: 32 }}>
              <GripVertical size={14} className="cursor-grab" />
            </div>

            <div className="flex flex-shrink-0 items-center justify-center" style={{ width: 36 }}>
              <div
                className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded-control border text-[11px] transition-colors ${task.status === 'done' ? 'border-success bg-success/15 text-success' : 'border-line-strong text-transparent hover:border-line-focus'}`}
                onClick={() => onToggleStatus(task.id, task.status)}
              >
                {task.status === 'done' ? '✓' : ''}
              </div>
            </div>

            <div className="flex-shrink-0 overflow-hidden text-ellipsis whitespace-nowrap px-1" style={{ width: colWidths.name }}>
              <span className={`text-[13px] ${task.status === 'done' ? 'text-ink-faint line-through' : 'text-ink'}`}>
                {task.description}
              </span>
            </div>

            <div className="flex-shrink-0 px-1" style={{ width: colWidths.assignee }}>
              <AssigneeWidget
                task={task}
                teamMembers={widgets.teamMembers}
                onToggleAssignee={widgets.onToggleAssignee}
                activeDropdown={widgets.activeDropdown}
                setActiveDropdown={widgets.setActiveDropdown}
                dropdownWrapperRef={widgets.dropdownWrapperRef}
              />
            </div>

            <div className="flex-shrink-0 px-1" style={{ width: colWidths.date }}>
              <DatePickerWidget task={task} onUpdateDueDate={widgets.onUpdateDueDate} />
            </div>

            <div className="flex-shrink-0 px-1" style={{ width: colWidths.priority }}>
              <PriorityWidget
                task={task}
                onUpdatePriority={widgets.onUpdatePriority}
                activeDropdown={widgets.activeDropdown}
                setActiveDropdown={widgets.setActiveDropdown}
                dropdownWrapperRef={widgets.dropdownWrapperRef}
              />
            </div>

            <div className="flex-shrink-0 px-1" style={{ width: colWidths.lead }}>
              <LeadWidget
                task={task}
                leads={widgets.leads}
                onUpdateLead={widgets.onUpdateLead}
                activeDropdown={widgets.activeDropdown}
                setActiveDropdown={widgets.setActiveDropdown}
                dropdownWrapperRef={widgets.dropdownWrapperRef}
              />
            </div>

            <div className="flex flex-shrink-0 items-center justify-center" style={{ width: 50 }}>
              <button
                className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                onClick={() => onDeleteTask(task.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="px-4 py-6 text-center text-xs text-ink-faint">Aucune tâche dans cette section</div>
      )}
    </div>
  );

  const header = (
    <div className="flex items-center rounded-t-surface border border-line bg-elevated px-2 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft">
      <div className="flex-shrink-0" style={{ width: 32 }}></div>
      <div className="flex-shrink-0" style={{ width: 36 }}></div>

      <div className="relative flex-shrink-0 px-1" style={{ width: colWidths.name }}>
        Tâche
        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-line-focus" onMouseDown={(e) => onStartResize(e, 'name')} />
      </div>

      <div className="relative flex-shrink-0 px-1" style={{ width: colWidths.assignee }}>
        Assignés
        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-line-focus" onMouseDown={(e) => onStartResize(e, 'assignee')} />
      </div>

      <div className="relative flex-shrink-0 px-1" style={{ width: colWidths.date }}>
        Échéance
        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-line-focus" onMouseDown={(e) => onStartResize(e, 'date')} />
      </div>

      <div className="relative flex-shrink-0 px-1" style={{ width: colWidths.priority }}>
        Priorité
        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-line-focus" onMouseDown={(e) => onStartResize(e, 'priority')} />
      </div>

      <div className="relative flex-shrink-0 px-1" style={{ width: colWidths.lead }}>
        Lead associé
        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-line-focus" onMouseDown={(e) => onStartResize(e, 'lead')} />
      </div>

      <div className="flex-shrink-0" style={{ width: 50 }}></div>
    </div>
  );

  const section = (title: string, tasksList: Task[], statusKey: 'todo' | 'in_progress' | 'done', extraClass = '') => (
    <div className={extraClass}>
      <div className={`flex items-center gap-2 rounded-control border-l-4 bg-elevated px-3 py-2 ${sectionAccent[statusKey]}`}>
        <span className="text-[11px] font-bold uppercase tracking-wide">{title}</span>
        <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">{tasksList.length}</span>
      </div>
      {renderTableRows(tasksList, statusKey)}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {header}
      {section('À faire', todoTasks, 'todo')}
      {section('En cours', inProgressTasks, 'in_progress', 'mt-5')}
      {section('Terminées', doneTasks, 'done', 'mt-5')}
    </div>
  );
};
