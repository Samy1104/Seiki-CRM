import React from 'react';
import { Trash2, GripVertical } from 'lucide-react';
import type { Task } from '../../services/tasksService';
import { AssigneeWidget, DatePickerWidget, PriorityWidget, LeadWidget, TaskDescriptionWidget } from './TaskWidgets';
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

const sectionAccent: Record<'todo' | 'in_progress' | 'done', { border: string; text: string; bg: string }> = {
  todo: { border: 'var(--color-charcoal-danger, #e05252)', text: 'var(--color-charcoal-danger, #e05252)', bg: 'rgba(224, 82, 82, 0.08)' },
  in_progress: { border: 'var(--color-amber, #F59E0B)', text: 'var(--color-amber, #F59E0B)', bg: 'rgba(245, 158, 11, 0.08)' },
  done: { border: 'var(--color-success, #4ADE80)', text: 'var(--color-success, #4ADE80)', bg: 'rgba(74, 222, 128, 0.08)' },
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
      className="flex flex-col rounded-b-xl transition-colors"
      style={{
        background: dragOverStatus === statusKey ? 'rgba(212,196,168,0.06)' : '#0d0d0d',
        border: '1px solid rgba(242,237,228,0.08)',
        borderTop: 'none',
      }}
      onDragOver={(e) => onDragOver(e, statusKey)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, statusKey)}
    >
      {tasksList.length > 0 ? (
        tasksList.map(task => (
          <div
            key={task.id}
            className="flex items-center px-3 py-2.5 transition-colors cursor-pointer"
            style={{
              borderBottom: '1px solid rgba(242,237,228,0.06)',
              borderTop: dragOverTaskId === task.id && draggedTaskId !== task.id ? '2px solid var(--color-beige, #D4C4A8)' : 'none',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#161616')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            draggable="true"
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragOver={(e) => onDragOverTask(e, task.id, statusKey)}
            onDragLeave={onDragLeaveTask}
          >
            <div className="flex flex-shrink-0 items-center justify-center" style={{ width: 32, color: '#444' }}>
              <GripVertical size={13} className="cursor-grab hover:text-[#888]" />
            </div>

            <div className="flex flex-shrink-0 items-center justify-center" style={{ width: 36 }}>
              <div
                className="flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-md text-[10px] transition-all"
                style={{
                  border: task.status === 'done' ? '1px solid var(--color-success, #4ADE80)' : '1px solid rgba(242,237,228,0.2)',
                  background: task.status === 'done' ? 'rgba(74, 222, 128, 0.15)' : 'transparent',
                  color: task.status === 'done' ? 'var(--color-success, #4ADE80)' : 'transparent',
                }}
                onClick={() => onToggleStatus(task.id, task.status)}
              >
                {task.status === 'done' ? '✓' : ''}
              </div>
            </div>

            <div className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-2" style={{ minWidth: 150 }}>
              <TaskDescriptionWidget
                task={task}
                onUpdateDescription={widgets.onUpdateDescription}
              />
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
                type="button"
                className="rounded-md p-1.5 transition-colors cursor-pointer"
                style={{ color: '#555' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-charcoal-danger, #e05252)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(224, 82, 82, 0.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#555';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                onClick={() => onDeleteTask(task.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="px-4 py-6 text-center text-[12px]" style={{ color: '#555' }}>
          Aucune tâche dans cette section
        </div>
      )}
    </div>
  );

  const header = (
    <div
      className="flex items-center rounded-t-xl px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] w-full"
      style={{
        background: '#141414',
        border: '1px solid rgba(242,237,228,0.08)',
        color: 'var(--color-charcoal-fg-soft, #b0afa8)',
      }}
    >
      <div className="flex-shrink-0" style={{ width: 32 }}></div>
      <div className="flex-shrink-0" style={{ width: 36 }}></div>

      <div className="relative flex-1 min-w-0 px-2" style={{ minWidth: 150 }}>
        Tâche
        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--color-beige,#D4C4A8)] transition-colors" onMouseDown={(e) => onStartResize(e, 'name')} />
      </div>

      <div className="relative flex-shrink-0 px-1" style={{ width: colWidths.assignee }}>
        Assignés
        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--color-beige,#D4C4A8)] transition-colors" onMouseDown={(e) => onStartResize(e, 'assignee')} />
      </div>

      <div className="relative flex-shrink-0 px-1" style={{ width: colWidths.date }}>
        Échéance
        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--color-beige,#D4C4A8)] transition-colors" onMouseDown={(e) => onStartResize(e, 'date')} />
      </div>

      <div className="relative flex-shrink-0 px-1" style={{ width: colWidths.priority }}>
        Priorité
        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--color-beige,#D4C4A8)] transition-colors" onMouseDown={(e) => onStartResize(e, 'priority')} />
      </div>

      <div className="relative flex-shrink-0 px-1" style={{ width: colWidths.lead }}>
        Lead associé
        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--color-beige,#D4C4A8)] transition-colors" onMouseDown={(e) => onStartResize(e, 'lead')} />
      </div>

      <div className="flex-shrink-0" style={{ width: 50 }}></div>
    </div>
  );

  const section = (title: string, tasksList: Task[], statusKey: 'todo' | 'in_progress' | 'done', extraClass = '') => (
    <div className={extraClass}>
      <div
        className="flex items-center gap-2.5 rounded-t-xl px-3.5 py-2"
        style={{
          background: '#141414',
          borderLeft: `3px solid ${sectionAccent[statusKey].border}`,
          borderTop: '1px solid rgba(242,237,228,0.08)',
          borderRight: '1px solid rgba(242,237,228,0.08)',
        }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: sectionAccent[statusKey].text }}
        >
          {title}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: sectionAccent[statusKey].bg,
            color: sectionAccent[statusKey].text,
          }}
        >
          {tasksList.length}
        </span>
      </div>
      {renderTableRows(tasksList, statusKey)}
    </div>
  );

  return (
    <div className="w-full max-w-full overflow-hidden rounded-xl">
      <div className="flex flex-col gap-4 mt-2 w-full">
        {header}
        {section('À faire', todoTasks, 'todo')}
        {section('En cours', inProgressTasks, 'in_progress', 'mt-4')}
        {section('Terminées', doneTasks, 'done', 'mt-4')}
      </div>
    </div>
  );
};
