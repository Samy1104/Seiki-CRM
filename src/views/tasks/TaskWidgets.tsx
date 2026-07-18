import React from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Flag, Tag, User } from 'lucide-react';
import type { Task } from '../../services/tasksService';
import type { TeamMember } from '../../services/settingsService';
import type { Lead } from '../../services/leadsService';
import { getPriorityInfo } from '../../utils/taskPriority';

export interface ActiveDropdown {
  taskId: string;
  type: 'assignee' | 'priority' | 'lead';
  x: number;
  y: number;
}

interface DropdownProps {
  activeDropdown: ActiveDropdown | null;
  setActiveDropdown: (d: ActiveDropdown | null) => void;
  dropdownWrapperRef: React.RefObject<HTMLDivElement | null>;
}

/** Shared bag of data + callbacks the four inline widgets need — passed down as one prop from Tasks.tsx. */
export interface TaskWidgetHandlers {
  teamMembers: TeamMember[];
  leads: Lead[];
  activeDropdown: ActiveDropdown | null;
  setActiveDropdown: (d: ActiveDropdown | null) => void;
  dropdownWrapperRef: React.RefObject<HTMLDivElement | null>;
  onToggleAssignee: (task: Task, memberId: string) => void;
  onUpdateDueDate: (taskId: string, value: string | null) => void;
  onUpdatePriority: (taskId: string, priority: 'high' | 'medium' | 'low') => void;
  onUpdateLead: (taskId: string, leadId: string | null) => void;
}

interface AssigneeWidgetProps extends DropdownProps {
  task: Task;
  teamMembers: TeamMember[];
  onToggleAssignee: (task: Task, memberId: string) => void;
}

export const AssigneeWidget: React.FC<AssigneeWidgetProps> = ({
  task, teamMembers, onToggleAssignee, activeDropdown, setActiveDropdown, dropdownWrapperRef,
}) => {
  const isDropdownOpen = activeDropdown?.taskId === task.id && activeDropdown?.type === 'assignee';
  const taskAssignees = task.assignees || [];

  return (
    <div className="clickup-inline-dropdown-wrap">
      <div
        onClick={(e) => {
          if (isDropdownOpen) { setActiveDropdown(null); return; }
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setActiveDropdown({ taskId: task.id, type: 'assignee', x: r.left, y: r.bottom + 4 });
        }}
        className="clickup-assignees-trigger-list"
        style={{ cursor: 'pointer' }}
      >
        {taskAssignees.length > 0 ? (
          <div className="assignees-overlapping-list">
            {taskAssignees.slice(0, 3).map((a, idx) => (
              <div
                key={a.id}
                className="member-avatar small-avatar"
                style={{ background: a.color, zIndex: 10 - idx, marginLeft: idx > 0 ? '-6px' : '0px' }}
                title={a.full_name}
              >
                {a.initials}
              </div>
            ))}
            {taskAssignees.length > 3 && (
              <div
                className="member-avatar small-avatar count"
                style={{ background: '#334155', zIndex: 5, marginLeft: '-6px' }}
                title={`${taskAssignees.length} personnes assignées`}
              >
                +{taskAssignees.length - 3}
              </div>
            )}
          </div>
        ) : (
          <div className="avatar-placeholder-btn" title="Assigner des membres">
            <User size={12} />
          </div>
        )}
      </div>

      {isDropdownOpen && createPortal(
        <div
          ref={dropdownWrapperRef}
          className="clickup-dropdown-menu"
          style={{ position: 'fixed', top: activeDropdown!.y, left: activeDropdown!.x, zIndex: 9999, transform: 'none' }}
        >
          <div className="clickup-dropdown-title">Assigner des membres...</div>
          {teamMembers.map(m => {
            const isAssigned = taskAssignees.some(a => a.id === m.id);
            return (
              <div
                key={m.id}
                className={`clickup-dropdown-item ${isAssigned ? 'selected' : ''}`}
                onClick={() => onToggleAssignee(task, m.id)}
              >
                <div className="clickup-dropdown-checkbox">{isAssigned ? '✓' : ''}</div>
                <div className="member-avatar small-avatar" style={{ background: m.color, marginRight: '8px' }}>{m.initials}</div>
                <span>{m.full_name}</span>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

interface DatePickerWidgetProps {
  task: Task;
  onUpdateDueDate: (taskId: string, value: string | null) => void;
}

export const DatePickerWidget: React.FC<DatePickerWidgetProps> = ({ task, onUpdateDueDate }) => {
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && task.status !== 'done';
  const isToday = task.due_date === new Date().toISOString().slice(0, 10) && task.status !== 'done';

  let dueClass = 'card-icon-btn';
  if (task.due_date) {
    dueClass += ' active';
    if (isOverdue) dueClass += ' overdue';
    else if (isToday) dueClass += ' today';
  }

  return (
    <div className="clickup-inline-date-picker-wrap">
      <button className={dueClass} title={task.due_date ? `Échéance : ${task.due_date}` : "Définir l'échéance"}>
        <Calendar size={13} style={{ marginRight: task.due_date ? '4px' : '0' }} />
        {task.due_date ? (
          <span style={{ fontSize: '11px', fontWeight: '700' }}>
            {new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </span>
        ) : (
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.3)' }}>—</span>
        )}
      </button>
      <input
        type="date"
        className="clickup-hidden-date-input"
        value={task.due_date || ''}
        onChange={(e) => onUpdateDueDate(task.id, e.target.value || null)}
      />
    </div>
  );
};

interface PriorityWidgetProps extends DropdownProps {
  task: Task;
  onUpdatePriority: (taskId: string, priority: 'high' | 'medium' | 'low') => void;
}

export const PriorityWidget: React.FC<PriorityWidgetProps> = ({
  task, onUpdatePriority, activeDropdown, setActiveDropdown, dropdownWrapperRef,
}) => {
  const isDropdownOpen = activeDropdown?.taskId === task.id && activeDropdown?.type === 'priority';
  const prio = getPriorityInfo(task.priority);

  return (
    <div className="clickup-inline-dropdown-wrap">
      <div
        onClick={(e) => {
          if (isDropdownOpen) { setActiveDropdown(null); return; }
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setActiveDropdown({ taskId: task.id, type: 'priority', x: r.left, y: r.bottom + 4 });
        }}
        className={`card-icon-btn ${task.priority ? 'active' : ''}`}
        style={{ gap: '6px' }}
        title={`Priorité : ${prio.label}`}
      >
        <Flag size={13} style={{ color: task.priority ? prio.color : 'inherit' }} />
        <span style={{ fontSize: '11px', fontWeight: '600' }}>{prio.label}</span>
      </div>

      {isDropdownOpen && createPortal(
        <div
          ref={dropdownWrapperRef}
          className="clickup-dropdown-menu"
          style={{ position: 'fixed', top: activeDropdown!.y, left: activeDropdown!.x, zIndex: 9999, transform: 'none' }}
        >
          <div className="clickup-dropdown-title">Priorité</div>
          <div
            className={`clickup-dropdown-item ${task.priority === 'high' ? 'selected' : ''}`}
            onClick={() => { onUpdatePriority(task.id, 'high'); setActiveDropdown(null); }}
          >
            <Flag size={12} style={{ color: 'var(--red)', marginRight: '8px' }} />
            Urgent
          </div>
          <div
            className={`clickup-dropdown-item ${task.priority === 'medium' ? 'selected' : ''}`}
            onClick={() => { onUpdatePriority(task.id, 'medium'); setActiveDropdown(null); }}
          >
            <Flag size={12} style={{ color: 'var(--gold)', marginRight: '8px' }} />
            Normal
          </div>
          <div
            className={`clickup-dropdown-item ${task.priority === 'low' ? 'selected' : ''}`}
            onClick={() => { onUpdatePriority(task.id, 'low'); setActiveDropdown(null); }}
          >
            <Flag size={12} style={{ color: 'var(--green)', marginRight: '8px' }} />
            Basse
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

interface TaskCardWidgetsProps {
  task: Task;
  widgets: TaskWidgetHandlers;
}

/** Renders the assignee/date/priority/lead widgets together — used by both the list rows and every kanban column. */
export const TaskCardWidgets: React.FC<TaskCardWidgetsProps> = ({ task, widgets }) => (
  <>
    <AssigneeWidget
      task={task}
      teamMembers={widgets.teamMembers}
      onToggleAssignee={widgets.onToggleAssignee}
      activeDropdown={widgets.activeDropdown}
      setActiveDropdown={widgets.setActiveDropdown}
      dropdownWrapperRef={widgets.dropdownWrapperRef}
    />
    <DatePickerWidget task={task} onUpdateDueDate={widgets.onUpdateDueDate} />
    <PriorityWidget
      task={task}
      onUpdatePriority={widgets.onUpdatePriority}
      activeDropdown={widgets.activeDropdown}
      setActiveDropdown={widgets.setActiveDropdown}
      dropdownWrapperRef={widgets.dropdownWrapperRef}
    />
    <LeadWidget
      task={task}
      leads={widgets.leads}
      onUpdateLead={widgets.onUpdateLead}
      activeDropdown={widgets.activeDropdown}
      setActiveDropdown={widgets.setActiveDropdown}
      dropdownWrapperRef={widgets.dropdownWrapperRef}
    />
  </>
);

interface LeadWidgetProps extends DropdownProps {
  task: Task;
  leads: Lead[];
  onUpdateLead: (taskId: string, leadId: string | null) => void;
}

export const LeadWidget: React.FC<LeadWidgetProps> = ({
  task, leads, onUpdateLead, activeDropdown, setActiveDropdown, dropdownWrapperRef,
}) => {
  const isDropdownOpen = activeDropdown?.taskId === task.id && activeDropdown?.type === 'lead';

  return (
    <div className="clickup-inline-dropdown-wrap">
      <div
        onClick={(e) => {
          if (isDropdownOpen) { setActiveDropdown(null); return; }
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setActiveDropdown({ taskId: task.id, type: 'lead', x: r.left, y: r.bottom + 4 });
        }}
        className={`card-icon-btn ${task.lead_id ? 'active' : ''}`}
        style={{ gap: '6px' }}
        title={task.lead ? `Lead : ${task.lead.company_name}` : "Associer un Lead"}
      >
        <Tag size={13} style={{ color: task.lead_id ? 'var(--purple)' : 'inherit' }} />
        <span style={{ fontSize: '11px', fontWeight: '600' }}>
          {task.lead ? task.lead.company_name : 'Lier lead'}
        </span>
      </div>

      {isDropdownOpen && createPortal(
        <div
          ref={dropdownWrapperRef}
          className="clickup-dropdown-menu scrollable"
          style={{ position: 'fixed', top: activeDropdown!.y, left: activeDropdown!.x, zIndex: 9999, transform: 'none' }}
        >
          <div className="clickup-dropdown-title">Lier à un lead...</div>
          {leads.map(l => (
            <div
              key={l.id}
              className={`clickup-dropdown-item ${task.lead_id === l.id ? 'selected' : ''}`}
              onClick={() => { onUpdateLead(task.id, l.id); setActiveDropdown(null); }}
            >
              <span>{l.company_name}</span>
            </div>
          ))}
          {task.lead_id && (
            <div
              className="clickup-dropdown-item clear-btn"
              onClick={() => { onUpdateLead(task.id, null); setActiveDropdown(null); }}
            >
              Retirer le lead
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
