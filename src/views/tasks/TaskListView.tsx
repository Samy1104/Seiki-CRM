import React from 'react';
import { Trash2 } from 'lucide-react';
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

export const TaskListView: React.FC<TaskListViewProps> = ({
  todoTasks, inProgressTasks, doneTasks,
  colWidths, onStartResize,
  dragOverStatus, dragOverTaskId, draggedTaskId,
  onDragStart, onDragOver, onDragLeave, onDragOverTask, onDragLeaveTask, onDrop,
  onToggleStatus, onDeleteTask, widgets,
}) => {
  const renderTableRows = (tasksList: Task[], statusKey: 'todo' | 'in_progress' | 'done') => (
    <div
      className={`clickup-section-body ${dragOverStatus === statusKey ? 'drag-over' : ''}`}
      onDragOver={(e) => onDragOver(e, statusKey)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, statusKey)}
    >
      {tasksList.length > 0 ? (
        tasksList.map(task => (
          <div
            key={task.id}
            className={`clickup-task-row${dragOverTaskId === task.id && draggedTaskId !== task.id ? ' drag-insert-before' : ''}`}
            draggable="true"
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragOver={(e) => onDragOverTask(e, task.id, statusKey)}
            onDragLeave={onDragLeaveTask}
          >
            <div className="clickup-cell clickup-cell-drag" style={{ width: 32, flexGrow: 0, flexShrink: 0 }}>
              <div className="drag-handle">⋮⋮</div>
            </div>

            <div className="clickup-cell clickup-cell-check" style={{ width: 36, flexGrow: 0, flexShrink: 0 }}>
              <div
                className={`task-check ${task.status === 'done' ? 'done' : ''}`}
                onClick={() => onToggleStatus(task.id, task.status)}
              >
                {task.status === 'done' ? '✓' : ''}
              </div>
            </div>

            <div className="clickup-cell clickup-cell-name" style={{ width: colWidths.name, flexGrow: 0, flexShrink: 1 }}>
              <span className={`task-text ${task.status === 'done' ? 'done' : ''}`}>
                {task.description}
              </span>
            </div>

            <div className="clickup-cell clickup-cell-assignee" style={{ width: colWidths.assignee, flexGrow: 0, flexShrink: 1 }}>
              <AssigneeWidget
                task={task}
                teamMembers={widgets.teamMembers}
                onToggleAssignee={widgets.onToggleAssignee}
                activeDropdown={widgets.activeDropdown}
                setActiveDropdown={widgets.setActiveDropdown}
                dropdownWrapperRef={widgets.dropdownWrapperRef}
              />
            </div>

            <div className="clickup-cell clickup-cell-date" style={{ width: colWidths.date, flexGrow: 0, flexShrink: 1 }}>
              <DatePickerWidget task={task} onUpdateDueDate={widgets.onUpdateDueDate} />
            </div>

            <div className="clickup-cell clickup-cell-priority" style={{ width: colWidths.priority, flexGrow: 0, flexShrink: 1 }}>
              <PriorityWidget
                task={task}
                onUpdatePriority={widgets.onUpdatePriority}
                activeDropdown={widgets.activeDropdown}
                setActiveDropdown={widgets.setActiveDropdown}
                dropdownWrapperRef={widgets.dropdownWrapperRef}
              />
            </div>

            <div className="clickup-cell clickup-cell-lead" style={{ width: colWidths.lead, flexGrow: 0, flexShrink: 1 }}>
              <LeadWidget
                task={task}
                leads={widgets.leads}
                onUpdateLead={widgets.onUpdateLead}
                activeDropdown={widgets.activeDropdown}
                setActiveDropdown={widgets.setActiveDropdown}
                dropdownWrapperRef={widgets.dropdownWrapperRef}
              />
            </div>

            <div className="clickup-cell clickup-cell-actions" style={{ width: 50, flexGrow: 0, flexShrink: 0 }}>
              <button className="btn-icon-del" onClick={() => onDeleteTask(task.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="clickup-row-empty">Aucune tâche dans cette section</div>
      )}
    </div>
  );

  return (
    <div className="clickup-list-container">
      <div className="clickup-table-header">
        <div className="clickup-hdr-cell clickup-cell-drag" style={{ width: 32, flexGrow: 0, flexShrink: 0 }}></div>
        <div className="clickup-hdr-cell clickup-cell-check" style={{ width: 36, flexGrow: 0, flexShrink: 0 }}></div>

        <div className="clickup-hdr-cell clickup-cell-name" style={{ width: colWidths.name, flexGrow: 0, flexShrink: 1, position: 'relative' }}>
          Tâche
          <div className="clickup-col-resizer" onMouseDown={(e) => onStartResize(e, 'name')} />
        </div>

        <div className="clickup-hdr-cell clickup-cell-assignee" style={{ width: colWidths.assignee, flexGrow: 0, flexShrink: 1, position: 'relative' }}>
          Assignés
          <div className="clickup-col-resizer" onMouseDown={(e) => onStartResize(e, 'assignee')} />
        </div>

        <div className="clickup-hdr-cell clickup-cell-date" style={{ width: colWidths.date, flexGrow: 0, flexShrink: 1, position: 'relative' }}>
          Échéance
          <div className="clickup-col-resizer" onMouseDown={(e) => onStartResize(e, 'date')} />
        </div>

        <div className="clickup-hdr-cell clickup-cell-priority" style={{ width: colWidths.priority, flexGrow: 0, flexShrink: 1, position: 'relative' }}>
          Priorité
          <div className="clickup-col-resizer" onMouseDown={(e) => onStartResize(e, 'priority')} />
        </div>

        <div className="clickup-hdr-cell clickup-cell-lead" style={{ width: colWidths.lead, flexGrow: 0, flexShrink: 1, position: 'relative' }}>
          Lead associé
          <div className="clickup-col-resizer" onMouseDown={(e) => onStartResize(e, 'lead')} />
        </div>

        <div className="clickup-hdr-cell clickup-cell-actions" style={{ width: 50, flexGrow: 0, flexShrink: 0 }}></div>
      </div>

      <div className="clickup-section">
        <div className="clickup-section-header" style={{ borderLeft: '4px solid var(--red)' }}>
          <span className="sect-title" style={{ color: 'var(--red)' }}>À FAIRE</span>
          <span className="sect-count">{todoTasks.length}</span>
        </div>
        {renderTableRows(todoTasks, 'todo')}
      </div>

      <div className="clickup-section" style={{ marginTop: '20px' }}>
        <div className="clickup-section-header" style={{ borderLeft: '4px solid var(--gold)' }}>
          <span className="sect-title" style={{ color: 'var(--gold)' }}>EN COURS</span>
          <span className="sect-count">{inProgressTasks.length}</span>
        </div>
        {renderTableRows(inProgressTasks, 'in_progress')}
      </div>

      <div className="clickup-section" style={{ marginTop: '20px' }}>
        <div className="clickup-section-header" style={{ borderLeft: '4px solid var(--green)' }}>
          <span className="sect-title" style={{ color: 'var(--green)' }}>TERMINÉES</span>
          <span className="sect-count">{doneTasks.length}</span>
        </div>
        {renderTableRows(doneTasks, 'done')}
      </div>
    </div>
  );
};
