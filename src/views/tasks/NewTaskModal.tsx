import React from 'react';
import { createPortal } from 'react-dom';
import { X, Plus } from 'lucide-react';
import type { Lead } from '../../services/leadsService';
import type { TeamMember } from '../../services/settingsService';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';
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
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nouvelle tâche</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={onSubmit} className="modal-form">
          <div className="gen-field-group">
            <label className="gen-label">Description *</label>
            <input
              className="gen-input"
              placeholder="Écrire une tâche à faire..."
              value={desc}
              onChange={e => onDescChange(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="gen-field-row">
            <div className="gen-field-group">
              <label className="gen-label">Échéance</label>
              <input
                className="gen-input"
                type="date"
                value={dueDate}
                onChange={e => onDueDateChange(e.target.value)}
              />
            </div>
            <div className="gen-field-group">
              <label className="gen-label">Priorité</label>
              <Select
                value={priority}
                onValueChange={val => onPriorityChange(val as 'high' | 'medium' | 'low')}
              >
                <SelectTrigger className="gen-select">
                  <SelectValue placeholder="Moyenne" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="low">Basse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="gen-field-row">
            <div className="gen-field-group">
              <label className="gen-label">Assignés</label>
              <div className="clickup-inline-dropdown-wrap">
                <button
                  type="button"
                  className="gen-select"
                  onClick={(e) => {
                    if (isAssigneeDropdownOpen) { setActiveDropdown(null); return; }
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setActiveDropdown({ taskId: 'new-task', type: 'assignee', x: r.left, y: r.bottom + 4 });
                  }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {assigneeIds.length === 0 ? 'Assigner' : `${assigneeIds.length} assigné(s)`}
                  </span>
                  <span style={{ fontSize: '10px' }}>▼</span>
                </button>

                {isAssigneeDropdownOpen && createPortal(
                  <div
                    ref={dropdownWrapperRef}
                    className="clickup-dropdown-menu"
                    style={{ position: 'fixed', top: activeDropdown!.y, left: activeDropdown!.x, zIndex: 9999, transform: 'none' }}
                  >
                    <div className="clickup-dropdown-title">Assigner à...</div>
                    {teamMembers.map(m => {
                      const isSelected = assigneeIds.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          className={`clickup-dropdown-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => onToggleAssigneeId(m.id)}
                        >
                          <div className="clickup-dropdown-checkbox">{isSelected ? '✓' : ''}</div>
                          <div className="member-avatar small-avatar" style={{ background: m.color, marginRight: '8px' }}>{m.initials}</div>
                          <span>{m.full_name}</span>
                        </div>
                      );
                    })}
                  </div>,
                  document.body
                )}
              </div>
            </div>
            <div className="gen-field-group">
              <label className="gen-label">Lead lié</label>
              <Select value={leadId} onValueChange={onLeadIdChange}>
                <SelectTrigger className="gen-select">
                  <SelectValue placeholder="— Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Aucun</SelectItem>
                  {leads.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="gen-field-group">
            <label className="gen-label">Statut</label>
            <Select
              value={status}
              onValueChange={val => onStatusChange(val as 'todo' | 'in_progress' | 'done')}
            >
              <SelectTrigger className="gen-select">
                <SelectValue placeholder="À faire" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">À faire</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="done">Terminé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost-sm" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary-sm">
              <Plus size={13} />
              Créer la tâche
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
