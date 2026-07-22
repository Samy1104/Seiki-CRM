import React from 'react';
import { Calendar, Plus } from 'lucide-react';
import CalendarModal from '../../components/CalendarModal';
import type { Lead } from '../../services/leadsService';
import type { TeamMember } from '../../services/settingsService';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

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
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  leads, teamMembers, desc, dueDate, priority, assigneeIds, leadId, status,
  onDescChange, onDueDateChange, onPriorityChange, onToggleAssigneeId, onLeadIdChange, onStatusChange,
  onSubmit, onClose,
}) => {
  const [openCal, setOpenCal] = React.useState(false);
  const dueDateRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Modal open onClose={onClose} header="Nouvelle tâche">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-6">
        <Field label="Description *">
          <input
            autoComplete="off"
            placeholder="Écrire une tâche à faire..."
            value={desc}
            onChange={e => onDescChange(e.target.value)}
            required
            autoFocus
            className="w-full bg-transparent rounded-none text-[13px] py-2 px-0 outline-none focus:outline-none focus:ring-0 transition-colors duration-200"
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
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Échéance">
            <div className="relative">
              <button
                ref={dueDateRef}
                type="button"
                className={`${inputClass} flex cursor-pointer items-center justify-between text-left`}
                onClick={() => setOpenCal(!openCal)}
              >
                <span>
                  {dueDate
                    ? new Date(dueDate + "T12:00:00").toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "jj/mm/aaaa"}
                </span>
                <Calendar size={13} style={{ color: "#555" }} />
              </button>
              {openCal && (
                <CalendarModal
                  value={dueDate}
                  onChange={onDueDateChange}
                  onClose={() => setOpenCal(false)}
                  anchorRef={dueDateRef}
                />
              )}
            </div>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Assignés">
            <Select
              value={assigneeIds[0] || ''}
              onValueChange={(val) => {
                if (val) onToggleAssigneeId(val);
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    assigneeIds.length === 0
                      ? 'Tous les membres'
                      : teamMembers
                          .filter((m) => assigneeIds.includes(m.id))
                          .map((m) => m.full_name)
                          .join(', ') || 'Assigné'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[12px] uppercase tracking-[0.12em] font-semibold transition-all duration-150 cursor-pointer hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "var(--color-beige, #D4C4A8)",
              color: "#0d0d0d",
              boxShadow: "0 2px 8px rgba(212, 196, 168, 0.15)",
            }}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Créer la tâche</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
