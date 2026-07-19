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

const dropdownMenuClass = 'rounded-surface border border-line-strong bg-surface p-1.5 shadow-modal min-w-[180px]';
const dropdownTitleClass = 'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint';
const dropdownItemClass = (selected: boolean) =>
  `flex items-center rounded-control px-2 py-1.5 text-xs cursor-pointer transition-colors ${
    selected ? 'bg-amber-soft text-ink' : 'text-ink-soft hover:bg-hover hover:text-ink'
  }`;

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
    <div className="relative inline-block">
      <div
        onClick={(e) => {
          if (isDropdownOpen) { setActiveDropdown(null); return; }
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setActiveDropdown({ taskId: task.id, type: 'assignee', x: r.left, y: r.bottom + 4 });
        }}
        className="cursor-pointer"
      >
        {taskAssignees.length > 0 ? (
          <div className="flex items-center">
            {taskAssignees.slice(0, 3).map((a, idx) => (
              <div
                key={a.id}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-elevated text-[9px] font-bold text-white"
                style={{ background: a.color, zIndex: 10 - idx, marginLeft: idx > 0 ? '-6px' : '0px' }}
                title={a.full_name}
              >
                {a.initials}
              </div>
            ))}
            {taskAssignees.length > 3 && (
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-elevated bg-chart-neutral text-[9px] font-bold text-white"
                style={{ zIndex: 5, marginLeft: '-6px' }}
                title={`${taskAssignees.length} personnes assignées`}
              >
                +{taskAssignees.length - 3}
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-line-strong text-ink-faint"
            title="Assigner des membres"
          >
            <User size={12} />
          </div>
        )}
      </div>

      {isDropdownOpen && createPortal(
        <div
          ref={dropdownWrapperRef}
          className={dropdownMenuClass}
          style={{ position: 'fixed', top: activeDropdown!.y, left: activeDropdown!.x, zIndex: 9999, transform: 'none' }}
        >
          <div className={dropdownTitleClass}>Assigner des membres...</div>
          {teamMembers.map(m => {
            const isAssigned = taskAssignees.some(a => a.id === m.id);
            return (
              <div
                key={m.id}
                className={dropdownItemClass(isAssigned)}
                onClick={() => onToggleAssignee(task, m.id)}
              >
                <div className="w-4 flex-shrink-0 text-amber">{isAssigned ? '✓' : ''}</div>
                <div
                  className="mr-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: m.color }}
                >
                  {m.initials}
                </div>
                <span className="truncate">{m.full_name}</span>
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

  const toneClass = isOverdue ? 'text-danger bg-danger/10' : isToday ? 'text-amber bg-amber-soft' : task.due_date ? 'text-ink-soft bg-hover' : 'text-ink-faint';

  return (
    <div className="relative inline-block">
      <button
        className={`inline-flex items-center gap-1 rounded-control px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-hover cursor-pointer ${toneClass}`}
        title={task.due_date ? `Échéance : ${task.due_date}` : "Définir l'échéance"}
      >
        <Calendar size={13} />
        {task.due_date ? (
          <span>{new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
        ) : (
          <span>—</span>
        )}
      </button>
      <input
        type="date"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
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
    <div className="relative inline-block">
      <div
        onClick={(e) => {
          if (isDropdownOpen) { setActiveDropdown(null); return; }
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setActiveDropdown({ taskId: task.id, type: 'priority', x: r.left, y: r.bottom + 4 });
        }}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-control px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-hover ${task.priority ? 'text-ink-soft' : 'text-ink-faint'}`}
        title={`Priorité : ${prio.label}`}
      >
        <Flag size={13} style={{ color: task.priority ? prio.color : 'currentColor' }} />
        <span>{prio.label}</span>
      </div>

      {isDropdownOpen && createPortal(
        <div
          ref={dropdownWrapperRef}
          className={dropdownMenuClass}
          style={{ position: 'fixed', top: activeDropdown!.y, left: activeDropdown!.x, zIndex: 9999, transform: 'none' }}
        >
          <div className={dropdownTitleClass}>Priorité</div>
          <div
            className={dropdownItemClass(task.priority === 'high')}
            onClick={() => { onUpdatePriority(task.id, 'high'); setActiveDropdown(null); }}
          >
            <Flag size={12} className="mr-2 text-danger" />
            Urgent
          </div>
          <div
            className={dropdownItemClass(task.priority === 'medium')}
            onClick={() => { onUpdatePriority(task.id, 'medium'); setActiveDropdown(null); }}
          >
            <Flag size={12} className="mr-2 text-amber" />
            Normal
          </div>
          <div
            className={dropdownItemClass(task.priority === 'low')}
            onClick={() => { onUpdatePriority(task.id, 'low'); setActiveDropdown(null); }}
          >
            <Flag size={12} className="mr-2 text-success" />
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
    <div className="relative inline-block">
      <div
        onClick={(e) => {
          if (isDropdownOpen) { setActiveDropdown(null); return; }
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setActiveDropdown({ taskId: task.id, type: 'lead', x: r.left, y: r.bottom + 4 });
        }}
        className={`inline-flex max-w-[140px] cursor-pointer items-center gap-1.5 rounded-control px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-hover ${task.lead_id ? 'text-ink-soft' : 'text-ink-faint'}`}
        title={task.lead ? `Lead : ${task.lead.company_name}` : "Associer un Lead"}
      >
        <Tag size={13} className={task.lead_id ? 'flex-shrink-0 text-amber' : 'flex-shrink-0'} />
        <span className="truncate">{task.lead ? task.lead.company_name : 'Lier lead'}</span>
      </div>

      {isDropdownOpen && createPortal(
        <div
          ref={dropdownWrapperRef}
          className={`${dropdownMenuClass} max-h-60 overflow-y-auto`}
          style={{ position: 'fixed', top: activeDropdown!.y, left: activeDropdown!.x, zIndex: 9999, transform: 'none' }}
        >
          <div className={dropdownTitleClass}>Lier à un lead...</div>
          {leads.map(l => (
            <div
              key={l.id}
              className={dropdownItemClass(task.lead_id === l.id)}
              onClick={() => { onUpdateLead(task.id, l.id); setActiveDropdown(null); }}
            >
              <span className="truncate">{l.company_name}</span>
            </div>
          ))}
          {task.lead_id && (
            <div
              className="mt-1 cursor-pointer rounded-control border-t border-line px-2 py-1.5 pt-2.5 text-xs text-danger transition-colors hover:bg-danger/10"
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
