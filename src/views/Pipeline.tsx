import React, { useMemo, useState } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { PipelineStage, TeamMember, SlaLimits } from '../services/settingsService';
import { tasksService } from '../services/tasksService';
import type { Task } from '../services/tasksService';
import { useToast } from '../context/ToastContext';
import { isSlaBreached } from '../utils/leadMetrics';
import { useLoadOnMount } from '../hooks/useLoadOnMount';
import { withLoadingState } from '../utils/withLoadingState';
import { AlertTriangle, Plus } from 'lucide-react';
import { LeadDetailModal } from './pipeline/LeadDetailModal';

interface PipelineProps {
  setView: (view: string) => void;
}

export const Pipeline: React.FC<PipelineProps> = ({ setView }) => {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [slaLimits, setSlaLimits] = useState<SlaLimits>({ Media: 5, Retail: 7, Instit: 14 });
  const [loading, setLoading] = useState(true);

  // Modal state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadPipelineData = () => withLoadingState(async () => {
    const fetchedStages = await settingsService.getPipelineStages();
    const fetchedLeads = await leadsService.getLeads();
    const fetchedMembers = await settingsService.getTeamMembers();
    const fetchedTasks = await tasksService.getTasks();
    const limits = await settingsService.getSlaLimits();

    setStages(fetchedStages);
    setLeads(fetchedLeads);
    setTeamMembers(fetchedMembers);
    setTasks(fetchedTasks);
    setSlaLimits(limits);
  }, {
    setLoading,
    onError: (err) => {
      console.error('Error loading pipeline data:', err);
      showToast('Erreur de chargement des données', 'error');
    }
  });

  useLoadOnMount(loadPipelineData);

  const handleOpenLead = async (leadId: string) => {
    try {
      const leadDetails = await leadsService.getLeadById(leadId);
      setSelectedLead(leadDetails);
      setModalOpen(true);
    } catch (err) {
      console.error('Error getting lead details:', err);
      showToast('Impossible de charger les détails du lead', 'error');
    }
  };

  // Helper selectors
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
    () => activeLeads.filter(l => isSlaBreached(l, slaLimits)),
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
                  const slaBreached = isSlaBreached(l, slaLimits);
                  const isTaskOverdue = getLeadPriorityTask(l.id);

                  let cardClass = 'deal-card';
                  if (slaBreached) cardClass += ' sla-warn';
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
                        <span className="deal-age-indicator" style={{ color: slaBreached ? 'var(--red)' : 'var(--text-muted)' }}>
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
        <LeadDetailModal
          key={selectedLead.id}
          lead={selectedLead}
          stages={stages}
          teamMembers={teamMembers}
          tasks={tasks}
          slaLimits={slaLimits}
          showToast={showToast}
          onClose={() => setModalOpen(false)}
          onChanged={loadPipelineData}
        />
      )}
    </div>
  );
};
