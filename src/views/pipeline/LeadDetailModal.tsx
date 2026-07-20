import React, { useState } from 'react';
import { leadsService } from '../../services/leadsService';
import type { Lead } from '../../services/leadsService';
import type { PipelineStage, TeamMember, SlaLimits } from '../../services/settingsService';
import { tasksService } from '../../services/tasksService';
import type { Task } from '../../services/tasksService';
import { isSlaBreached } from '../../utils/leadMetrics';
import { confirmAction } from '../../utils/confirmAction';
import { Trash2, User } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';

interface LeadDetailModalProps {
  lead: Lead;
  stages: PipelineStage[];
  teamMembers: TeamMember[];
  tasks: Task[];
  slaLimits: SlaLimits;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onClose: () => void;
  /** Called after any successful mutation so the parent board/list can reload. */
  onChanged: () => void;
}

/**
 * Full lead detail modal (info/edit/history/tasks tabs). Extracted from
 * Pipeline.tsx, which was an 880-line god component owning the kanban board
 * AND this modal's four tabs. Mount with `key={lead.id}` from the parent so
 * opening a different lead resets this component's local form/tab state.
 */
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
    note: initialLead.note || ''
  });

  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteContent, setEditedNoteContent] = useState('');

  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

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
        const oldStage = stages.find(s => s.id === oldStageId)?.name || 'Inconnue';
        const newStage = stages.find(s => s.id === newStageId)?.name || 'Inconnue';
        stageChangeLog = {
          type: 'stage_change',
          content: `Étape changée : ${oldStage} → ${newStage}`
        };
      }

      await leadsService.updateLead(lead.id, {
        company_name: editForm.company_name,
        contact_name: editForm.contact_name,
        phone: editForm.phone || null,
        email: editForm.email || null,
        linkedin_url: editForm.linkedin_url || null,
        deal_value: editForm.deal_value,
        stage_id: editForm.stage_id,
        owner_id: editForm.owner_id || null,
        note: editForm.note || null
      }, stageChangeLog || { type: 'note', content: 'Informations mises à jour' });

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
      setLead(prev => ({ ...prev, history: [note, ...(prev.history || [])] }));
      setNewNote('');
      showToast('Note ajoutée');
      onChanged();
    } catch (err) {
      console.error('Error adding note:', err);
      showToast('Erreur lors de l\'ajout', 'error');
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
      setLead(prev => ({
        ...prev,
        history: (prev.history || []).map(h => h.id === noteId ? { ...h, content: editedNoteContent.trim() } : h)
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
        setLead(prev => ({ ...prev, history: (prev.history || []).filter(h => h.id !== noteId) }));
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
        due_date: newTaskDate || null
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
  const leadTasks = tasks.filter(t => t.lead_id === lead.id);

  return (
    <Modal
      open
      onClose={onClose}
      header={
        <>
          <div className="modal-title">{lead.company_name}</div>
          <div className="modal-sub">
            {lead.contact_name || '—'}
            {lead.phone ? ` · ${lead.phone}` : ''}
            {lead.email ? ` · ${lead.email}` : ''}
            {lead.source ? ` · Source : ${lead.source}` : ''}
          </div>
          <div className="modal-badges-row">
            <span className={`badge badge-${lead.segment.toLowerCase()}`}>{lead.segment}</span>
            <span className="stage-pill">{lead.stage?.name}</span>
            <span style={{ fontSize: '12px', fontWeight: '500', color: lead.score >= 80 ? 'var(--green)' : lead.score >= 60 ? 'var(--color-amber)' : 'var(--red)' }}>
              Score : {lead.score}/100
            </span>
            <span style={{ fontSize: '11px', color: slaBreached ? 'var(--red)' : 'var(--text-muted)' }}>
              J+{lead.days_in_stage} {slaBreached ? '⚠' : ''}
            </span>
          </div>
        </>
      }
    >
        {/* Modal Tabs navigation */}
        <div className="tab-row">
          <button className={`mtab ${modalTab === 'info' ? 'on' : ''}`} onClick={() => setModalTab('info')}>
            Infos
          </button>
          <button className={`mtab ${modalTab === 'edit' ? 'on' : ''}`} onClick={() => setModalTab('edit')}>
            Modifier
          </button>
          <button className={`mtab ${modalTab === 'history' ? 'on' : ''}`} onClick={() => setModalTab('history')}>
            Historique
          </button>
          <button className={`mtab ${modalTab === 'tasks' ? 'on' : ''}`} onClick={() => setModalTab('tasks')}>
            Tâches
          </button>
        </div>

        {/* 1. INFO TAB */}
        {modalTab === 'info' && (
          <div className="mtab-panel on">
            {lead.phone && (
              <div className="detail-row">
                <span className="detail-key">Téléphone</span>
                <a href={`tel:${lead.phone}`} className="detail-link">{lead.phone}</a>
              </div>
            )}
            {lead.email && (
              <div className="detail-row">
                <span className="detail-key">Email</span>
                <a href={`mailto:${lead.email}`} className="detail-link">{lead.email}</a>
              </div>
            )}
            {lead.linkedin_url && (
              <div className="detail-row">
                <span className="detail-key">LinkedIn</span>
                <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="detail-link">Voir profil ↗</a>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-key">Valeur</span>
              <span className="detail-val">{lead.deal_value}k€</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Source</span>
              <span className="detail-val">{lead.source}</span>
            </div>
            {lead.note && (
              <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="detail-key" style={{ marginBottom: '4px' }}>Note</span>
                <span className="detail-val" style={{ textAlign: 'left', opacity: '0.8', width: '100%' }}>{lead.note}</span>
              </div>
            )}

            {/* Score breakdown */}
            <div style={{ marginTop: '20px' }}>
              <div className="detail-title">Scoring ICP</div>
              {lead.scores && lead.scores.length > 0 ? (
                lead.scores.map(s => {
                  const pct = Math.round((s.value / s.max_value) * 100);
                  const color = s.value >= s.max_value * 0.8 ? 'var(--green)' : s.value >= s.max_value * 0.5 ? 'var(--color-amber)' : 'var(--red)';
                  return (
                    <div key={s.criterion} className="bar-row">
                      <span className="bar-label" style={{ textTransform: 'capitalize' }}>
                        {s.criterion === 'decideur' ? 'Accès décideur' : s.criterion === 'fit' ? 'Fit offre Seiki' : s.criterion}
                      </span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${pct}%`, background: color }}></div>
                      </div>
                      <span className="bar-val">{s.value}/{s.max_value}</span>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Aucun critère de score calculé</div>
              )}
            </div>
          </div>
        )}

        {/* 2. EDIT TAB */}
        {modalTab === 'edit' && (
          <div className="mtab-panel on">
            <form onSubmit={handleSaveLead}>
              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="form-field">
                  <div className="field-label">Société</div>
                  <input
                    type="text"
                    value={editForm.company_name}
                    onChange={e => setEditForm({ ...editForm, company_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-field">
                  <div className="field-label">Contact</div>
                  <input
                    type="text"
                    value={editForm.contact_name}
                    onChange={e => setEditForm({ ...editForm, contact_name: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <div className="field-label">Téléphone</div>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <div className="field-label">Email</div>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <div className="field-label">LinkedIn</div>
                  <input
                    type="url"
                    value={editForm.linkedin_url}
                    onChange={e => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <div className="field-label">Valeur (k€)</div>
                  <input
                    type="number"
                    value={editForm.deal_value}
                    onChange={e => setEditForm({ ...editForm, deal_value: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-field">
                  <div className="field-label">Étape</div>
                  <Select
                    value={editForm.stage_id}
                    onValueChange={val => setEditForm({ ...editForm, stage_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une étape" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map(st => (
                        <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-field">
                  <div className="field-label">Propriétaire</div>
                  <Select
                    value={editForm.owner_id}
                    onValueChange={val => setEditForm({ ...editForm, owner_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— Aucun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Aucun</SelectItem>
                      {teamMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-field full">
                  <div className="field-label">Note</div>
                  <textarea
                    value={editForm.note}
                    onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-grad btn-sm">
                Enregistrer les modifications
              </button>
            </form>
          </div>
        )}

        {/* 3. HISTORY TAB */}
        {modalTab === 'history' && (
          <div className="mtab-panel on">
            <form onSubmit={handleAddNote} style={{ marginBottom: '16px' }}>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Ajouter une note (ex: RDV pris, appel effectué...)"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                />
                <button type="submit" className="btn btn-sm btn-grad">Ajouter</button>
              </div>
            </form>

            <div className="history-list-container">
              {lead.history && lead.history.length > 0 ? (
                lead.history.map(item => (
                  <div key={item.id} className="hist-item">
                    <div className="hist-dot"></div>
                    <div style={{ flex: '1' }}>
                      {editingNoteId === item.id ? (
                        <div style={{ marginTop: '4px' }}>
                          <input
                            type="text"
                            className="hist-edit-input"
                            value={editedNoteContent}
                            onChange={e => setEditedNoteContent(e.target.value)}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <button className="hist-btn" onClick={() => handleSaveEditNote(item.id)}>✓ Enregistrer</button>
                            <button className="hist-btn" onClick={() => setEditingNoteId(null)}>Annuler</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="hist-text">{item.content}</div>
                          <div className="hist-time">
                            {new Date(item.created_at).toLocaleString('fr-FR', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                            {item.user ? ` · par ${item.user.full_name}` : ''}
                          </div>
                          {item.action_type === 'note' && !item.is_auto && (
                            <div className="hist-actions">
                              <button className="hist-btn" onClick={() => handleStartEditNote(item.id, item.content)}>
                                ✏ Modifier
                              </button>
                              <button className="hist-btn del" onClick={() => handleDeleteNote(item.id)}>
                                ✕ Supprimer
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '12px 0' }}>Aucune activité enregistrée</div>
              )}
            </div>
          </div>
        )}

        {/* 4. TASKS TAB */}
        {modalTab === 'tasks' && (
          <div className="mtab-panel on">
            <form onSubmit={handleCreateTask} style={{ marginBottom: '16px' }}>
              <div className="quick-task-form">
                <input
                  type="text"
                  placeholder="Nouvelle tâche pour ce lead..."
                  value={newTaskDesc}
                  onChange={e => setNewTaskDesc(e.target.value)}
                  required
                  style={{ flex: '1' }}
                />
                <input
                  type="date"
                  value={newTaskDate}
                  onChange={e => setNewTaskDate(e.target.value)}
                  style={{ width: '130px' }}
                />
                <div style={{ width: '100px' }}>
                  <Select
                    value={newTaskPriority}
                    onValueChange={val => setNewTaskPriority(val as 'high' | 'medium' | 'low')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Moyenne" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">Haute</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="low">Basse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ width: '130px' }}>
                  <Select
                    value={newTaskAssignee}
                    onValueChange={val => setNewTaskAssignee(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— Assigné" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Assigné</SelectItem>
                      {teamMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <button type="submit" className="btn btn-sm btn-grad">+</button>
              </div>
            </form>

            <div className="tasks-list-container">
              {leadTasks.length > 0 ? (
                leadTasks.map(task => {
                  const isOver = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && task.status !== 'done';
                  const isTod = task.due_date === new Date().toISOString().slice(0, 10) && task.status !== 'done';
                  const cls = task.status === 'done' ? 'done' : isOver ? 'overdue' : isTod ? 'today' : 'future';
                  const pColor = task.priority === 'high' ? 'var(--red)' : task.priority === 'medium' ? 'var(--color-amber)' : 'var(--green)';

                  return (
                    <div key={task.id} className="task-item">
                      <div
                        className={`task-check ${task.status === 'done' ? 'done' : ''}`}
                        onClick={() => handleToggleTaskStatus(task.id, task.status)}
                      >
                        {task.status === 'done' ? '✓' : ''}
                      </div>

                      <div style={{ flex: '1' }}>
                        <div className={`task-text ${task.status === 'done' ? 'done' : ''}`}>{task.description}</div>
                        {task.assignee && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={10} />
                            <span>Assigné à {task.assignee.full_name}</span>
                          </div>
                        )}
                        <div className="hist-actions" style={{ marginTop: '4px' }}>
                          <button className="hist-btn del" onClick={() => handleDeleteTask(task.id)}>✕ Supprimer</button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: pColor }} title={`Priorité ${task.priority}`}></span>
                        {task.due_date && (
                          <span className={`task-due ${cls}`}>
                            {new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '12px 0' }}>Aucune tâche pour ce lead</div>
              )}
            </div>
          </div>
        )}

      {/* Modal Actions Footer */}
      <div className="modal-footer" style={{ borderTop: '0.5px solid var(--border)', marginTop: '14px', paddingTop: '14px', display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-sm btn-danger" onClick={handleDeleteLead}>
          <Trash2 size={12} style={{ marginRight: '4px' }} />
          Supprimer le lead
        </button>
        <button className="btn btn-sm" onClick={onClose}>Fermer</button>
      </div>
    </Modal>
  );
};
