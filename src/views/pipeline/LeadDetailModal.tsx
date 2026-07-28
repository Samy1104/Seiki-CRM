import React, { useState, useRef } from 'react';
import { leadsService } from '../../services/leadsService';
import type { Lead } from '../../services/leadsService';
import type { PipelineStage, TeamMember, SlaLimits } from '../../services/settingsService';
import { tasksService } from '../../services/tasksService';
import type { Task } from '../../services/tasksService';
import { isSlaBreached } from '../../utils/leadMetrics';
import { confirmAction } from '../../utils/confirmAction';
import {
  Trash2,
  User,
  Info,
  Edit3,
  History,
  CheckSquare,
  Plus,
  Save,
  X,
  Phone,
  Mail,
  Link2,
  DollarSign,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Circle,
  Calendar,
} from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';
import CalendarModal from '../../components/CalendarModal';

interface LeadDetailModalProps {
  lead: Lead;
  stages: PipelineStage[];
  teamMembers: TeamMember[];
  tasks: Task[];
  slaLimits: SlaLimits;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onClose: () => void;
  onChanged: () => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead: initialLead,
  stages,
  teamMembers,
  tasks,
  slaLimits,
  showToast,
  onClose,
  onChanged,
}) => {
  const [lead, setLead] = useState(initialLead);
  const [modalTab, setModalTab] = useState<'info' | 'edit' | 'history' | 'tasks'>('info');

  const [editForm, setEditForm] = useState({
    company_name: initialLead.company_name,
    contact_name: initialLead.contact_name || '',
    phone: initialLead.phone || '',
    email: initialLead.email || '',
    linkedin_url: initialLead.linkedin_url || '',
    deal_value: initialLead.deal_value,
    stage_id: initialLead.stage_id,
    owner_id: initialLead.owner_id || '',
    note: initialLead.note || '',
  });

  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteContent, setEditedNoteContent] = useState('');

  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [showTaskCalendar, setShowTaskCalendar] = useState(false);
  const taskDateInputRef = useRef<HTMLButtonElement>(null);

  const refreshLead = async () => {
    const leadDetails = await leadsService.getLeadById(lead.id);
    setLead(leadDetails);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const oldStageId = lead.stage_id;
      const newStageId = editForm.stage_id;
      let stageChangeLog = undefined;

      if (oldStageId !== newStageId) {
        const oldStage = stages.find((s) => s.id === oldStageId)?.name || 'Inconnue';
        const newStage = stages.find((s) => s.id === newStageId)?.name || 'Inconnue';
        stageChangeLog = {
          type: 'stage_change',
          content: `Étape changée : ${oldStage} → ${newStage}`,
        };
      }

      await leadsService.updateLead(
        lead.id,
        {
          company_name: editForm.company_name,
          contact_name: editForm.contact_name,
          phone: editForm.phone || null,
          email: editForm.email || null,
          linkedin_url: editForm.linkedin_url || null,
          deal_value: editForm.deal_value,
          stage_id: editForm.stage_id,
          owner_id: editForm.owner_id || null,
          note: editForm.note || null,
        },
        stageChangeLog || { type: 'note', content: 'Informations mises à jour' }
      );

      showToast('Lead mis à jour avec succès');
      onChanged();
      onClose();
    } catch (err) {
      console.error('Error saving lead:', err);
      showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  const handleDeleteLead = async () => {
    if (confirmAction('Supprimer ce lead définitivement ?')) {
      try {
        await leadsService.deleteLead(lead.id);
        showToast('Lead supprimé');
        onChanged();
        onClose();
      } catch (err) {
        console.error('Error deleting lead:', err);
        showToast('Erreur lors de la suppression', 'error');
      }
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      const note = await leadsService.addHistoryNote(lead.id, newNote.trim());
      setLead((prev) => ({ ...prev, history: [note, ...(prev.history || [])] }));
      setNewNote('');
      showToast('Note ajoutée');
      onChanged();
    } catch (err) {
      console.error('Error adding note:', err);
      showToast("Erreur lors de l'ajout", 'error');
    }
  };

  const handleStartEditNote = (noteId: string, content: string) => {
    setEditingNoteId(noteId);
    setEditedNoteContent(content);
  };

  const handleSaveEditNote = async (noteId: string) => {
    if (!editedNoteContent.trim()) return;

    try {
      await leadsService.updateHistoryNote(noteId, editedNoteContent.trim());
      setLead((prev) => ({
        ...prev,
        history: (prev.history || []).map((h) =>
          h.id === noteId ? { ...h, content: editedNoteContent.trim() } : h
        ),
      }));
      setEditingNoteId(null);
      showToast('Note modifiée');
    } catch (err) {
      console.error('Error updating note:', err);
      showToast('Erreur lors de la modification', 'error');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (confirmAction('Supprimer cette note ?')) {
      try {
        await leadsService.deleteHistoryNote(noteId);
        setLead((prev) => ({ ...prev, history: (prev.history || []).filter((h) => h.id !== noteId) }));
        showToast('Note supprimée');
      } catch (err) {
        console.error('Error deleting note:', err);
        showToast('Erreur lors de la suppression', 'error');
      }
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskDesc.trim()) return;

    try {
      await tasksService.createTask({
        description: newTaskDesc.trim(),
        lead_id: lead.id,
        assigned_to: newTaskAssignee || null,
        created_by: null,
        priority: newTaskPriority,
        status: 'todo',
        due_date: newTaskDate || null,
      });

      setNewTaskDesc('');
      setNewTaskDate('');
      setNewTaskPriority('medium');
      setNewTaskAssignee('');
      showToast('Tâche créée');

      await refreshLead();
      onChanged();
    } catch (err) {
      console.error('Error creating task:', err);
      showToast('Erreur de création de tâche', 'error');
    }
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await tasksService.updateTask(taskId, { status: nextStatus });
      await refreshLead();
      onChanged();
      showToast(nextStatus === 'done' ? 'Tâche accomplie' : 'Tâche rouverte');
    } catch (err) {
      console.error('Error updating task status:', err);
      showToast('Erreur de mise à jour de la tâche', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirmAction('Supprimer cette tâche ?')) {
      try {
        await tasksService.deleteTask(taskId);
        await refreshLead();
        onChanged();
        showToast('Tâche supprimée');
      } catch (err) {
        console.error('Error deleting task:', err);
        showToast('Erreur de suppression de la tâche', 'error');
      }
    }
  };

  const slaBreached = isSlaBreached(lead, slaLimits);
  const leadTasks = tasks.filter((t) => t.lead_id === lead.id);

  const TABS = [
    { id: 'info', label: 'Infos', icon: Info },
    { id: 'edit', label: 'Modifier', icon: Edit3 },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'tasks', label: 'Tâches', icon: CheckSquare },
  ] as const;

  return (
    <Modal
      open
      onClose={onClose}
      header={
        <div className="flex flex-col gap-2.5 w-full">
          <div>
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 900,
                fontSize: '1.75rem',
                color: 'var(--color-charcoal-fg, #f2ede4)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              {lead.company_name}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink-soft flex-wrap">
              <span>{lead.contact_name || '—'}</span>
              {lead.phone && <span>· {lead.phone}</span>}
              {lead.email && <span>· {lead.email}</span>}
              {lead.source && <span>· Source : {lead.source}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="neutral">{lead.segment}</Badge>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#D4C4A8]/15 text-[#D4C4A8] border border-line-focus">
              {lead.stage?.name || 'Inconnue'}
            </span>
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded bg-surface border border-line ${lead.score >= 80 ? 'text-success' : lead.score >= 60 ? 'text-amber' : 'text-danger'
                }`}
            >
              Score : {lead.score}/100
            </span>
            <span className={`text-xs font-medium ${slaBreached ? 'text-danger flex items-center gap-1' : 'text-ink-faint'}`}>
              {slaBreached && <AlertTriangle size={12} />}
              J+{lead.days_in_stage}
            </span>
          </div>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        {/* Navigation Pill Tabs */}
        <div className="flex items-center gap-2 border-b border-line pb-4 font-ui">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = modalTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-control transition-all cursor-pointer border ${isActive
                  ? 'bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus shadow-sm'
                  : 'bg-surface text-ink-soft border-line-strong hover:text-ink hover:border-line-focus'
                  }`}
                onClick={() => setModalTab(tab.id as any)}
              >
                <Icon size={14} strokeWidth={2} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 1. INFO TAB */}
        {modalTab === 'info' && (
          <div className="space-y-6">
            <div className="rounded-surface border border-line bg-elevated p-5 space-y-3">
              {lead.phone && (
                <div className="flex items-center justify-between text-xs py-1 border-b border-line/50">
                  <span className="text-ink-soft flex items-center gap-1.5"><Phone size={13} /> Téléphone</span>
                  <a href={`tel:${lead.phone}`} className="text-[#D4C4A8] font-medium hover:underline">{lead.phone}</a>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center justify-between text-xs py-1 border-b border-line/50">
                  <span className="text-ink-soft flex items-center gap-1.5"><Mail size={13} /> Email</span>
                  <a href={`mailto:${lead.email}`} className="text-[#D4C4A8] font-medium hover:underline">{lead.email}</a>
                </div>
              )}
              {lead.linkedin_url && (
                <div className="flex items-center justify-between text-xs py-1 border-b border-line/50">
                  <span className="text-ink-soft flex items-center gap-1.5"><Link2 size={13} /> LinkedIn</span>
                  <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#D4C4A8] font-medium hover:underline">Voir le profil ↗</a>
                </div>
              )}
              <div className="flex items-center justify-between text-xs py-1 border-b border-line/50">
                <span className="text-ink-soft flex items-center gap-1.5"><DollarSign size={13} /> Valeur estimée</span>
                <span className="font-semibold text-ink font-display">{lead.deal_value?.toLocaleString()} €</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-ink-soft">Source de prospection</span>
                <span className="font-medium text-ink">{lead.source}</span>
              </div>
              {lead.note && (
                <div className="pt-2 border-t border-line">
                  <div className="text-xs font-semibold text-ink mb-1">Note</div>
                  <div className="text-xs text-ink-soft bg-surface p-3 rounded-control border border-line">{lead.note}</div>
                </div>
              )}
            </div>

            {/* ICP Scoring breakdown */}
            <div className="rounded-surface border border-line bg-elevated p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-[#D4C4A8]" />
                <h3 className="font-display text-sm font-bold text-ink">Scoring ICP détaillé</h3>
              </div>
              {lead.scores && lead.scores.length > 0 ? (
                <div className="space-y-3">
                  {lead.scores.map((s) => {
                    const pct = Math.round((s.value / s.max_value) * 100);
                    const color =
                      s.value >= s.max_value * 0.8 ? '#4ADE80' : s.value >= s.max_value * 0.5 ? '#F59E0B' : '#F87171';
                    return (
                      <div key={s.criterion} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="capitalize text-ink-soft">
                            {s.criterion === 'decideur' ? 'Accès décideur' : s.criterion === 'fit' ? 'Fit offre Seiki' : s.criterion}
                          </span>
                          <span className="font-mono text-ink font-semibold">{s.value}/{s.max_value}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-hover overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-ink-faint">Aucun critère de score calculé</div>
              )}
            </div>
          </div>
        )}

        {/* 2. EDIT TAB */}
        {modalTab === 'edit' && (
          <form onSubmit={handleSaveLead} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Société *">
                <input
                  type="text"
                  value={editForm.company_name}
                  onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                  required
                  className={inputClass}
                />
              </Field>

              <Field label="Contact">
                <input
                  type="text"
                  value={editForm.contact_name}
                  onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Téléphone">
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="LinkedIn URL">
                <input
                  type="url"
                  value={editForm.linkedin_url}
                  onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Valeur (€)">
                <input
                  type="number"
                  value={editForm.deal_value}
                  onChange={(e) => setEditForm({ ...editForm, deal_value: parseInt(e.target.value) || 0 })}
                  className={inputClass}
                />
              </Field>

              <Field label="Étape pipeline">
                <Select value={editForm.stage_id} onValueChange={(val) => setEditForm({ ...editForm, stage_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une étape" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((st) => (
                      <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Propriétaire" className="sm:col-span-2">
                <Select value={editForm.owner_id} onValueChange={(val) => setEditForm({ ...editForm, owner_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="— Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Aucun</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Note" className="sm:col-span-3">
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  rows={2}
                  className={`${inputClass} py-1.5`}
                />
              </Field>
            </div>

            <div className="pt-2 border-t border-line flex justify-end">
              <AccentButton type="submit" variant="primary" icon={<Save size={14} />}>
                Enregistrer les modifications
              </AccentButton>
            </div>
          </form>
        )}

        {/* 3. HISTORY TAB */}
        {modalTab === 'history' && (
          <div className="space-y-5">
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                placeholder="Ajouter une note d'activité (ex: RDV téléphoné, email envoyé...)"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className={`${inputClass} flex-1`}
              />
              <AccentButton type="submit" variant="primary" icon={<Plus size={14} />}>
                Ajouter
              </AccentButton>
            </form>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {lead.history && lead.history.length > 0 ? (
                lead.history.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3.5 rounded-control border border-line bg-surface/50">
                    <div className="h-2 w-2 rounded-full bg-[#D4C4A8] mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-1">
                      {editingNoteId === item.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            className={inputClass}
                            value={editedNoteContent}
                            onChange={(e) => setEditedNoteContent(e.target.value)}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <AccentButton type="button" variant="primary" icon={<CheckCircle2 size={13} />} onClick={() => handleSaveEditNote(item.id)}>
                              Enregistrer
                            </AccentButton>
                            <AccentButton type="button" variant="secondary" onClick={() => setEditingNoteId(null)}>
                              Annuler
                            </AccentButton>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs font-medium text-ink">{item.content}</div>
                          <div className="text-[10.5px] text-ink-faint">
                            {new Date(item.created_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {item.user ? ` · par ${item.user.full_name}` : ''}
                          </div>
                          {item.action_type === 'note' && !item.is_auto && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                className="text-[11px] font-medium text-[#D4C4A8] hover:underline cursor-pointer"
                                onClick={() => handleStartEditNote(item.id, item.content)}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                className="text-[11px] font-medium text-danger hover:underline cursor-pointer"
                                onClick={() => handleDeleteNote(item.id)}
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-ink-faint py-3 text-center">Aucune activité enregistrée</div>
              )}
            </div>
          </div>
        )}

        {/* 4. TASKS TAB */}
        {modalTab === 'tasks' && (
          <div className="space-y-5">
            <form onSubmit={handleCreateTask} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Nouvelle tâche..."
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                required
                className={`${inputClass} sm:col-span-2`}
              />
              <div className="relative">
                <button
                  ref={taskDateInputRef}
                  type="button"
                  onClick={() => setShowTaskCalendar(true)}
                  className={`${inputClass} flex items-center justify-between gap-2 text-left cursor-pointer`}
                >
                  <span className={newTaskDate ? 'text-ink font-mono text-xs' : 'text-ink-faint text-xs'}>
                    {newTaskDate
                      ? new Date(newTaskDate + 'T12:00:00').toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                        })
                      : 'Échéance'}
                  </span>
                  <Calendar size={14} className="text-ink-soft shrink-0" />
                </button>

                {showTaskCalendar && (
                  <CalendarModal
                    value={newTaskDate}
                    onChange={(val) => setNewTaskDate(val)}
                    onClose={() => setShowTaskCalendar(false)}
                    anchorRef={taskDateInputRef}
                  />
                )}
              </div>
              <AccentButton type="submit" variant="primary" icon={<Plus size={14} />}>
                Créer
              </AccentButton>
            </form>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {leadTasks.length > 0 ? (
                leadTasks.map((task) => {
                  const isDone = task.status === 'done';
                  const isOver =
                    task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && !isDone;

                  return (
                    <div
                      key={task.id}
                      className={`flex items-center justify-between p-3 rounded-control border border-line bg-surface/50 transition-all ${isDone ? 'opacity-50' : ''
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-ink-soft hover:text-[#D4C4A8] cursor-pointer"
                          onClick={() => handleToggleTaskStatus(task.id, task.status)}
                        >
                          {isDone ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} />}
                        </button>

                        <div>
                          <div className={`text-xs font-semibold ${isDone ? 'line-through text-ink-faint' : 'text-ink'}`}>
                            {task.description}
                          </div>
                          {task.assignee && (
                            <div className="text-[10px] text-ink-soft flex items-center gap-1 mt-0.5">
                              <User size={10} />
                              <span>{task.assignee.full_name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {task.due_date && (
                          <span className={`text-[11px] font-mono font-medium ${isOver ? 'text-danger' : 'text-ink-soft'}`}>
                            {new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                        <button
                          type="button"
                          className="p-1 text-ink-soft hover:text-danger rounded cursor-pointer"
                          onClick={() => handleDeleteTask(task.id)}
                          title="Supprimer la tâche"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-ink-faint py-3 text-center">Aucune tâche enregistrée pour ce lead</div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="pt-4 border-t border-line flex items-center justify-between">
          <AccentButton type="button" variant="secondary" icon={<Trash2 size={14} />} onClick={handleDeleteLead} className="!text-danger !border-danger/30 hover:!bg-danger/10">
            Supprimer le lead
          </AccentButton>
          <AccentButton type="button" variant="secondary" icon={<X size={14} />} onClick={onClose}>
            Fermer
          </AccentButton>
        </div>
      </div>
    </Modal>
  );
};
