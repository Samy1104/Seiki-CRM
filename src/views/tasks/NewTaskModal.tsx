import React from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import type { Lead } from '../../services/leadsService';
import type { TeamMember } from '../../services/settingsService';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import type { ActiveDropdown } from './TaskWidgets';

interface NewTaskModalProps {
  leads: Lead[];
  teamMembers: TeamMember[];
  desc: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  assigneeIds: string[];
  leadId: string;
  status: 'todo' | 'in_progress' | 'done';
  onDescChange: (v: string) => void;
  onDueDateChange: (v: string) => void;
  onPriorityChange: (v: 'high' | 'medium' | 'low') => void;
  onToggleAssigneeId: (memberId: string) => void;
  onLeadIdChange: (v: string) => void;
  onStatusChange: (v: 'todo' | 'in_progress' | 'done') => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  activeDropdown: ActiveDropdown | null;
  setActiveDropdown: (d: ActiveDropdown | null) => void;
  dropdownWrapperRef: React.RefObject<HTMLDivElement | null>;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  leads, teamMembers, desc, dueDate, priority, assigneeIds, leadId, status,
  onDescChange, onDueDateChange, onPriorityChange, onToggleAssigneeId, onLeadIdChange, onStatusChange,
  onSubmit, onClose, activeDropdown, setActiveDropdown, dropdownWrapperRef,
}) => {
  const isAssigneeDropdownOpen = activeDropdown?.taskId === 'new-task' && activeDropdown?.type === 'assignee';

  return (
    <Modal open onClose={onClose} header="Nouvelle tâche">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-6">
        <Field label="Description *">
          <input
            className={inputClass}
            placeholder="Écrire une tâche à faire..."
            value={desc}
            onChange={e => onDescChange(e.target.value)}
            required
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Échéance">
            <input
              className={inputClass}
              type="date"
              value={dueDate}
              onChange={e => onDueDateChange(e.target.value)}
            />
          </Field>
          <Field label="Priorité">
            <Select value={priority} onValueChange={val => onPriorityChange(val as 'high' | 'medium' | 'low')}>
              <SelectTrigger><SelectValue placeholder="Moyenne" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Haute</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="low">Basse</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Assignés">
            <div className="relative">
              <button
                type="button"
                className={`${inputClass} flex cursor-pointer items-center justify-between text-left`}
                onClick={(e) => {
                  if (isAssigneeDropdownOpen) { setActiveDropdown(null); return; }
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setActiveDropdown({ taskId: 'new-task', type: 'assignee', x: r.left, y: r.bottom + 4 });
                }}
              >
                <span className="truncate">
                  {assigneeIds.length === 0 ? 'Assigner' : `${assigneeIds.length} assigné(s)`}
                </span>
                <span className="text-[10px] text-ink-faint">▼</span>
              </button>

              {isAssigneeDropdownOpen && createPortal(
                <div
                  ref={dropdownWrapperRef}
                  className="rounded-surface border border-line-strong bg-surface p-1.5 shadow-modal min-w-[200px]"
                  style={{ position: 'fixed', top: activeDropdown!.y, left: activeDropdown!.x, zIndex: 9999, transform: 'none' }}
                >
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Assigner à...</div>
                  {teamMembers.map(m => {
                    const isSelected = assigneeIds.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center rounded-control px-2 py-1.5 text-xs cursor-pointer transition-colors ${isSelected ? 'bg-amber-soft text-ink' : 'text-ink-soft hover:bg-hover hover:text-ink'}`}
                        onClick={() => onToggleAssigneeId(m.id)}
                      >
                        <div className="w-4 flex-shrink-0 text-amber">{isSelected ? '✓' : ''}</div>
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
          </Field>
          <Field label="Lead lié">
            <Select value={leadId} onValueChange={onLeadIdChange}>
              <SelectTrigger><SelectValue placeholder="— Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Aucun</SelectItem>
                {leads.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Statut">
          <Select value={status} onValueChange={val => onStatusChange(val as 'todo' | 'in_progress' | 'done')}>
            <SelectTrigger><SelectValue placeholder="À faire" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">À faire</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="done">Terminé</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="flex justify-end gap-2.5 border-t border-line pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" size="sm">
            <Plus size={13} />
            Créer la tâche
          </Button>
        </div>
      </form>
    </Modal>
  );
};
