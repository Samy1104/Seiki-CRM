import React, { useEffect, useMemo, useState } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { PipelineStage, TeamMember } from '../services/settingsService';
import { tasksService } from '../services/tasksService';
import type { Task } from '../services/tasksService';
import { useToast } from '../context/ToastContext';
import { AlertTriangle, Plus, Trash2, User } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/Select';

interface PipelineProps {
  setView: (view: string) => void;
}

export const Pipeline: React.FC<PipelineProps> = ({ setView }) => {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [slaLimits, setSlaLimits] = useState<Record<string, number>>({ Media: 5, Retail: 7, Instit: 14 });
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'info' | 'edit' | 'history' | 'tasks'>('info');

  // Edit lead form state
  const [editForm, setEditForm] = useState({
    company_name: '',
    contact_name: '',
    phone: '',
    email: '',
    linkedin_url: '',
    deal_value: 0,
    stage_id: '',
    owner_id: '',
    note: ''
  });

  // History note state
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteContent, setEditedNoteContent] = useState('');

  // Task creation state
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  const loadPipelineData = async () => {
    try {
      const fetchedStages = await settingsService.getPipelineStages();
      const fetchedLeads = await leadsService.getLeads();
      const fetchedMembers = await settingsService.getTeamMembers();
      const fetchedTasks = await tasksService.getTasks();
      const settings = await settingsService.getSettings();

      setStages(fetchedStages);
      setLeads(fetchedLeads);
      setTeamMembers(fetchedMembers);
      setTasks(fetchedTasks);

      // Load SLA settings
      const limits: Record<string, number> = { Media: 5, Retail: 7, Instit: 14 };
      settings.forEach(s => {
        if (s.key === 'sla_media' && s.value.days) limits.Media = s.value.days;
        if (s.key === 'sla_retail' && s.value.days) limits.Retail = s.value.days;
        if (s.key === 'sla_instit' && s.value.days) limits.Instit = s.value.days;
      });
      setSlaLimits(limits);
    } catch (err) {
      console.error('Error loading pipeline data:', err);
      showToast('Erreur de chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipelineData();
  }, []);

  const handleOpenLead = async (leadId: string) => {
    try {
      const leadDetails = await leadsService.getLeadById(leadId);
      setSelectedLead(leadDetails);
      setSelectedLeadId(leadId);
      setModalTab('info');
      setEditForm({
        company_name: leadDetails.company_name,
        contact_name: leadDetails.contact_name || '',
        phone: leadDetails.phone || '',
        email: leadDetails.email || '',
        linkedin_url: leadDetails.linkedin_url || '',
        deal_value: leadDetails.deal_value,
        stage_id: leadDetails.stage_id,
        owner_id: leadDetails.owner_id || '',
        note: leadDetails.note || ''
      });
      setModalOpen(true);
    } catch (err) {
      console.error('Error getting lead details:', err);
      showToast('Impossible de charger les détails du lead', 'error');
    }
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !selectedLead) return;

    try {
      const oldStageId = selectedLead.stage_id;
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

      await leadsService.updateLead(selectedLeadId, {
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
      setModalOpen(false);
      loadPipelineData();
    } catch (err) {
      console.error('Error saving lead:', err);
      showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLeadId) return;
    if (window.confirm('Supprimer ce lead définitivement ?')) {
      try {
        await leadsService.deleteLead(selectedLeadId);
        showToast('Lead supprimé');
        setModalOpen(false);
        loadPipelineData();
      } catch (err) {
        console.error('Error deleting lead:', err);
        showToast('Erreur lors de la suppression', 'error');
      }
    }
  };

  // History action handlers
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !newNote.trim()) return;

    try {
      const note = await leadsService.addHistoryNote(selectedLeadId, newNote.trim());
      setSelectedLead(prev => {
        if (!prev) return null;
        return {
          ...prev,
          history: [note, ...(prev.history || [])]
        };
      });
      setNewNote('');
      showToast('Note ajoutée');
      loadPipelineData();
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
      setSelectedLead(prev => {
        if (!prev) return null;
        return {
          ...prev,
          history: (prev.history || []).map(h => h.id === noteId ? { ...h, content: editedNoteContent.trim() } : h)
        };
      });
      setEditingNoteId(null);
      showToast('Note modifiée');
    } catch (err) {
      console.error('Error updating note:', err);
      showToast('Erreur lors de la modification', 'error');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (window.confirm('Supprimer cette note ?')) {
      try {
        await leadsService.deleteHistoryNote(noteId);
        setSelectedLead(prev => {
          if (!prev) return null;
          return {
            ...prev,
            history: (prev.history || []).filter(h => h.id !== noteId)
          };
        });
        showToast('Note supprimée');
      } catch (err) {
        console.error('Error deleting note:', err);
        showToast('Erreur lors de la suppression', 'error');
      }
    }
  };

  // Task handlers
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !newTaskDesc.trim()) return;

    try {
      await tasksService.createTask({
        description: newTaskDesc.trim(),
        lead_id: selectedLeadId,
        assigned_to: newTaskAssignee || null,
        created_by: null,
        priority: newTaskPriority,
        status: 'todo',
        due_date: newTaskDate || null
      });

      // Update local state in lead details modal
      setSelectedLead(prev => {
        if (!prev) return null;
        // Update mock history logs from service side
        return prev;
      });

      setNewTaskDesc('');
      setNewTaskDate('');
      setNewTaskPriority('medium');
      setNewTaskAssignee('');
      showToast('Tâche créée');
      
      // Reload details to sync history & tasks
      const leadDetails = await leadsService.getLeadById(selectedLeadId);
      setSelectedLead(leadDetails);
      loadPipelineData();
    } catch (err) {
      console.error('Error creating task:', err);
      showToast('Erreur de création de tâche', 'error');
    }
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await tasksService.updateTask(taskId, { status: nextStatus });
      if (selectedLeadId) {
        const leadDetails = await leadsService.getLeadById(selectedLeadId);
        setSelectedLead(leadDetails);
      }
      loadPipelineData();
      showToast(nextStatus === 'done' ? 'Tâche accomplie' : 'Tâche rouverte');
    } catch (err) {
      console.error('Error updating task status:', err);
      showToast('Erreur de mise à jour de la tâche', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Supprimer cette tâche ?')) {
      try {
        await tasksService.deleteTask(taskId);
        if (selectedLeadId) {
          const leadDetails = await leadsService.getLeadById(selectedLeadId);
          setSelectedLead(leadDetails);
        }
        loadPipelineData();
        showToast('Tâche supprimée');
      } catch (err) {
        console.error('Error deleting task:', err);
        showToast('Erreur de suppression de la tâche', 'error');
      }
    }
  };

  // Helper selectors
  const getSlaStatus = (lead: Lead) => {
    const maxDays = slaLimits[lead.segment] || 7;
    return lead.days_in_stage > maxDays;
  };

  const getLeadPriorityTask = (leadId: string) => {
    const leadTasks = tasks.filter(t => t.lead_id === leadId && t.status !== 'done');
    const hasOverdue = leadTasks.some(t => t.due_date && t.due_date < new Date().toISOString().slice(0, 10));
    return hasOverdue;
  };

  // Calculations
  const activeLeads = useMemo(
    () => leads.filter(l => !l.is_archived && l.stage?.name !== 'Gagné'),
    [leads]
  );
  const wonLeads = useMemo(() => leads.filter(l => l.stage?.is_closed_won), [leads]);
  const totalVal = useMemo(() => leads.reduce((acc, l) => acc + l.deal_value, 0), [leads]);
  const wonVal = useMemo(() => wonLeads.reduce((acc, l) => acc + l.deal_value, 0), [wonLeads]);
  const avgScore = useMemo(
    () => (leads.length ? Math.round(leads.reduce((acc, l) => acc + l.score, 0) / leads.length) : 0),
    [leads]
  );
  const hotCount = useMemo(() => leads.filter(l => l.score >= 80).length, [leads]);

  const slaBreaches = useMemo(
    () => activeLeads.filter(l => getSlaStatus(l)),
    [activeLeads, slaLimits]
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Chargement du Pipeline...</div>
      </div>
    );
  }

  return (
    <div className="view-section on">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Pipeline</div>
          <div className="page-sub">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} · {totalVal}k€ de valeur totale
          </div>
        </div>
        <button className="btn btn-grad" onClick={() => setView('add')}>
          <Plus size={16} style={{ marginRight: '6px' }} />
          Nouveau lead
        </button>
      </div>

      {/* KPI metric Cards */}
      <div className="kpi-grid">
        <div className="kpi" style={{ borderTop: '2px solid var(--purple)' }}>
          <div className="kpi-label">Deals actifs</div>
          <div className="kpi-val">{activeLeads.length}</div>
          <div className="kpi-sub">{wonLeads.length} closés gagnés</div>
        </div>
        
        <div className="kpi" style={{ borderTop: '2px solid var(--gold)' }}>
          <div className="kpi-label">Pipeline</div>
          <div className="kpi-val">{totalVal}k€</div>
          <div className="kpi-sub">Valeur totale</div>
        </div>

        <div className="kpi" style={{ borderTop: '2px solid var(--green)' }}>
          <div className="kpi-label">Score moyen</div>
          <div className="kpi-val">{avgScore}/100</div>
          <div className="kpi-sub">{hotCount} chauds ≥ 80</div>
        </div>

        <div className="kpi" style={{ borderTop: '2px solid var(--instit)' }}>
          <div className="kpi-label">Closés Gagnés</div>
          <div className="kpi-val">{wonVal}k€</div>
          <div className="kpi-sub">Deals signés</div>
        </div>
      </div>

      {/* SLA breach alert banner */}
      {slaBreaches.length > 0 && (
        <div className="sla-alert-banner">
          <AlertTriangle size={18} className="sla-alert-icon" />
          <div className="sla-alert-content">
            <span className="sla-alert-title">
              {slaBreaches.length} lead{slaBreaches.length > 1 ? 's' : ''} avec SLA dépassé — action requise aujourd'hui
            </span>
            <div className="sla-alert-list">
              {slaBreaches.map((l, i) => (
                <span key={l.id}>
                  {l.company_name} (J+{l.days_in_stage}, max {slaLimits[l.segment] || 7}j)
                  {i < slaBreaches.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board columns */}
      <div className="pipe-wrap">
        {stages.map(st => {
          const stageLeads = leads.filter(l => l.stage_id === st.id);
          const stageVal = stageLeads.reduce((acc, l) => acc + l.deal_value, 0);

          return (
            <div key={st.id} className="pipe-col">
              <div className="pipe-head" style={{ borderBottomColor: st.color }}>
                {st.name}
                <span>{stageLeads.length} · {stageVal}k€</span>
              </div>

              <div className="pipe-cards-container">
                {stageLeads.map(l => {
                  const isSlaBreached = getSlaStatus(l);
                  const isTaskOverdue = getLeadPriorityTask(l.id);
                  
                  let cardClass = 'deal-card';
                  if (isSlaBreached) cardClass += ' sla-warn';
                  else if (isTaskOverdue) cardClass += ' task-due';

                  const scoreColor = l.score >= 80 ? 'var(--green)' : l.score >= 60 ? 'var(--gold)' : 'var(--red)';

                  return (
                    <div 
                      key={l.id} 
                      className={cardClass}
                      onClick={() => handleOpenLead(l.id)}
                    >
                      <div className="deal-name">
                        <span>{l.company_name}</span>
                        <span style={{ color: scoreColor, fontWeight: '700' }}>{l.score}</span>
                      </div>
                      
                      <div className="deal-meta">{l.contact_name || '—'}</div>
                      <div className="deal-meta" style={{ margin: '2px 0', fontWeight: '500', color: 'var(--text)' }}>
                        {l.deal_value}k€
                      </div>

                      <div className="deal-card-footer">
                        <span className={`badge badge-${l.segment.toLowerCase()}`}>{l.segment}</span>
                        <span className="deal-age-indicator" style={{ color: isSlaBreached ? 'var(--red)' : 'var(--text-muted)' }}>
                          J+{l.days_in_stage}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="btn-add-pipe-card" onClick={() => setView('add')}>
                + Ajouter
              </button>
            </div>
          );
        })}
      </div>

      {/* LEAD MODAL DETAILS */}
      {modalOpen && selectedLead && (
        <div className="modal-overlay open" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <div className="modal-title">{selectedLead.company_name}</div>
                <div className="modal-sub">
                  {selectedLead.contact_name || '—'} 
                  {selectedLead.phone ? ` · ${selectedLead.phone}` : ''}
                  {selectedLead.email ? ` · ${selectedLead.email}` : ''}
                  {selectedLead.source ? ` · Source : ${selectedLead.source}` : ''}
                </div>
                <div className="modal-badges-row">
                  <span className={`badge badge-${selectedLead.segment.toLowerCase()}`}>{selectedLead.segment}</span>
                  <span className="stage-pill">{selectedLead.stage?.name}</span>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: selectedLead.score >= 80 ? 'var(--green)' : selectedLead.score >= 60 ? 'var(--gold)' : 'var(--red)' }}>
                    Score : {selectedLead.score}/100
                  </span>
                  <span style={{ fontSize: '11px', color: getSlaStatus(selectedLead) ? 'var(--red)' : 'var(--text-muted)' }}>
                    J+{selectedLead.days_in_stage} {getSlaStatus(selectedLead) ? '⚠' : ''}
                  </span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            {/* Modal Tabs navigation */}
            <div className="tab-row">
              <button 
                className={`mtab ${modalTab === 'info' ? 'on' : ''}`}
                onClick={() => setModalTab('info')}
              >
                Infos
              </button>
              <button 
                className={`mtab ${modalTab === 'edit' ? 'on' : ''}`}
                onClick={() => setModalTab('edit')}
              >
                Modifier
              </button>
              <button 
                className={`mtab ${modalTab === 'history' ? 'on' : ''}`}
                onClick={() => setModalTab('history')}
              >
                Historique
              </button>
              <button 
                className={`mtab ${modalTab === 'tasks' ? 'on' : ''}`}
                onClick={() => setModalTab('tasks')}
              >
                Tâches
              </button>
            </div>

            {/* Tab Panels */}
            {/* 1. INFO TAB */}
            {modalTab === 'info' && (
              <div className="mtab-panel on">
                {selectedLead.phone && (
                  <div className="detail-row">
                    <span className="detail-key">Téléphone</span>
                    <a href={`tel:${selectedLead.phone}`} className="detail-link">{selectedLead.phone}</a>
                  </div>
                )}
                {selectedLead.email && (
                  <div className="detail-row">
                    <span className="detail-key">Email</span>
                    <a href={`mailto:${selectedLead.email}`} className="detail-link">{selectedLead.email}</a>
                  </div>
                )}
                {selectedLead.linkedin_url && (
                  <div className="detail-row">
                    <span className="detail-key">LinkedIn</span>
                    <a href={selectedLead.linkedin_url} target="_blank" rel="noopener noreferrer" className="detail-link">Voir profil ↗</a>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-key">Valeur</span>
                  <span className="detail-val">{selectedLead.deal_value}k€</span>
                </div>
                <div className="detail-row">
                  <span className="detail-key">Source</span>
                  <span className="detail-val">{selectedLead.source}</span>
                </div>
                {selectedLead.note && (
                  <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="detail-key" style={{ marginBottom: '4px' }}>Note</span>
                    <span className="detail-val" style={{ textAlign: 'left', opacity: '0.8', width: '100%' }}>{selectedLead.note}</span>
                  </div>
                )}

                {/* Score breakdown */}
                <div style={{ marginTop: '20px' }}>
                  <div className="detail-title">Scoring ICP</div>
                  {selectedLead.scores && selectedLead.scores.length > 0 ? (
                    selectedLead.scores.map(s => {
                      const pct = Math.round((s.value / s.max_value) * 100);
                      const color = s.value >= s.max_value * 0.8 ? 'var(--green)' : s.value >= s.max_value * 0.5 ? 'var(--gold)' : 'var(--red)';
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
                {/* Add note form */}
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

                {/* History list */}
                <div className="history-list-container">
                  {selectedLead.history && selectedLead.history.length > 0 ? (
                    selectedLead.history.map(item => (
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
                                  <button 
                                    className="hist-btn"
                                    onClick={() => handleStartEditNote(item.id, item.content)}
                                  >
                                    ✏ Modifier
                                  </button>
                                  <button 
                                    className="hist-btn del"
                                    onClick={() => handleDeleteNote(item.id)}
                                  >
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
                {/* Quick Add Task Form */}
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
                        onValueChange={val => setNewTaskPriority(val as any)}
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

                {/* Lead-specific Tasks List */}
                <div className="tasks-list-container">
                  {tasks.filter(t => t.lead_id === selectedLeadId).length > 0 ? (
                    tasks.filter(t => t.lead_id === selectedLeadId).map(task => {
                      const isOver = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && task.status !== 'done';
                      const isTod = task.due_date === new Date().toISOString().slice(0, 10) && task.status !== 'done';
                      const cls = task.status === 'done' ? 'done' : isOver ? 'overdue' : isTod ? 'today' : 'future';
                      
                      const pColor = task.priority === 'high' ? 'var(--red)' : task.priority === 'medium' ? 'var(--gold)' : 'var(--green)';

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
              <button className="btn btn-sm" onClick={() => setModalOpen(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
