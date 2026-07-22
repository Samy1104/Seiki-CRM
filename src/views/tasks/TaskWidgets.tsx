import React from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Flag, Tag, User } from 'lucide-react';
import type { Task } from '../../services/tasksService';
import type { TeamMember } from '../../services/settingsService';
import type { Lead } from '../../services/leadsService';
import { getPriorityInfo } from '../../utils/taskPriority';

import CalendarModal from '../../components/CalendarModal';

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
  onUpdateDescription: (taskId: string, description: string) => void;
}

const dropdownMenuClass = 'rounded-xl border border-[rgba(242,237,228,0.15)] bg-[#141414] p-2 shadow-[0_12px_36px_rgba(0,0,0,0.6)] min-w-[180px]';
const dropdownTitleClass = 'px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#666] border-b border-[rgba(242,237,228,0.06)] mb-1';
const dropdownItemClass = (selected: boolean) =>
  `flex items-center rounded-md px-2.5 py-1.5 text-[12px] cursor-pointer transition-colors ${
    selected
      ? 'bg-[rgba(212,196,168,0.14)] text-[var(--color-beige,#D4C4A8)] font-medium'
      : 'text-[#b0afa8] hover:bg-[#1a1a1a] hover:text-[#f2ede4]'
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
  const [openCal, setOpenCal] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const isOverdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && task.status !== 'done';
  const isToday = task.due_date === new Date().toISOString().slice(0, 10) && task.status !== 'done';

  const toneStyle = isOverdue
    ? { color: 'var(--color-charcoal-danger, #e05252)', background: 'rgba(224, 82, 82, 0.12)' }
    : isToday
    ? { color: 'var(--color-amber, #F59E0B)', background: 'rgba(245, 158, 11, 0.14)' }
    : task.due_date
    ? { color: '#b0afa8', background: '#1a1a1a' }
    : { color: '#555', background: 'transparent' };

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpenCal(!openCal)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all cursor-pointer"
        style={{
          ...toneStyle,
          border: '1px solid rgba(242,237,228,0.08)',
        }}
        title={task.due_date ? `Échéance : ${task.due_date}` : "Définir l'échéance"}
      >
        <Calendar size={12} />
        {task.due_date ? (
          <span>{new Date(task.due_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
        ) : (
          <span>—</span>
        )}
      </button>
      {openCal && (
        <CalendarModal
          value={task.due_date || ''}
          onChange={(val) => onUpdateDueDate(task.id, val || null)}
          onClose={() => setOpenCal(false)}
          anchorRef={btnRef}
        />
      )}
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

interface TaskDescriptionWidgetProps {
  task: Task;
  onUpdateDescription: (taskId: string, description: string) => void;
  className?: string;
}

export const TaskDescriptionWidget: React.FC<TaskDescriptionWidgetProps> = ({
  task,
  onUpdateDescription,
  className = '',
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [text, setText] = React.useState(task.description);
  const [localDesc, setLocalDesc] = React.useState(task.description);

  React.useEffect(() => {
    setLocalDesc(task.description);
    if (!isEditing) {
      setText(task.description);
    }
  }, [task.description, isEditing]);

  const handleCommit = (newText: string) => {
    const trimmed = newText.trim();
    setIsEditing(false);
    if (trimmed && trimmed !== task.description) {
      setLocalDesc(trimmed);
      onUpdateDescription(task.id, trimmed);
    } else {
      setText(localDesc);
    }
  };

  if (isEditing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleCommit(text);
        }}
        className="w-full min-w-0 flex items-center"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          autoFocus
          value={text}
          draggable={false}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => handleCommit(text)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setText(localDesc);
              setIsEditing(false);
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
          className="w-full bg-transparent rounded-none text-[13px] font-medium py-1 px-0 outline-none focus:outline-none focus:ring-0 transition-colors duration-200"
          style={{
            color: "var(--color-charcoal-fg, #f2ede4)",
            caretColor: "var(--color-beige, #D4C4A8)",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderRadius: 0,
            borderBottom: "1px solid var(--color-beige, #D4C4A8)",
          }}
        />
      </form>
    );
  }

  const isDone = task.status === 'done';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setText(localDesc);
        setIsEditing(true);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      title="Cliquer pour modifier le nom"
      className={`cursor-pointer group flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-[#1a1a1a] transition-colors overflow-hidden text-ellipsis whitespace-nowrap min-w-0 w-full ${className}`}
    >
      <span
        className="text-[13px] font-medium truncate"
        style={{
          color: isDone ? '#555' : 'var(--color-charcoal-fg, #f2ede4)',
          textDecoration: isDone ? 'line-through' : 'none',
        }}
      >
        {localDesc}
      </span>
      <span className="opacity-0 group-hover:opacity-100 text-[10px] text-[#888] transition-opacity ml-1 flex-shrink-0">
        ✎
      </span>
    </div>
  );
};
