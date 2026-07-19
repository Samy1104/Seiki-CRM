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
import { Button } from '../components/ui/Button';
import { KpiTile } from '../components/ui/KpiTile';
import { DealCard } from './pipeline/DealCard';

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
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="font-heading text-xl font-bold text-ink">Pipeline</div>
          <div className="mt-0.5 text-xs text-ink-soft">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} · {totalVal}k€ de valeur totale
          </div>
        </div>
        <Button variant="primary" onClick={() => setView('add')}>
          <Plus size={16} />
          Nouveau lead
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-3">
        <KpiTile label="Deals actifs" value={activeLeads.length} sub={`${wonLeads.length} closés gagnés`} accent="amber" />
        <KpiTile label="Pipeline" value={totalVal} formatValue={(v) => `${Math.round(v)}k€`} sub="Valeur totale" accent="neutral" />
        <KpiTile label="Score moyen" value={avgScore} formatValue={(v) => `${Math.round(v)}/100`} sub={`${hotCount} chauds ≥ 80`} accent="success" />
        <KpiTile label="Closés Gagnés" value={wonVal} formatValue={(v) => `${Math.round(v)}k€`} sub="Deals signés" accent="success" />
      </div>

      {slaBreaches.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-danger/25 bg-danger/10 px-4 py-3">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-danger" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-ink">
              {slaBreaches.length} lead{slaBreaches.length > 1 ? 's' : ''} avec SLA dépassé — action requise aujourd'hui
            </span>
            <div className="text-xs text-ink-soft">
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

      <div className="flex flex-1 gap-3 overflow-x-auto pb-3">
        {stages.map(st => {
          const stageLeads = leads.filter(l => l.stage_id === st.id);
          const stageVal = stageLeads.reduce((acc, l) => acc + l.deal_value, 0);

          return (
            <div key={st.id} className="flex w-64 flex-shrink-0 flex-col rounded-md border border-line bg-surface/40 p-3">
              <div
                className="mb-3 flex items-center justify-between border-b-2 pb-2 font-heading text-[13.5px] font-bold text-ink"
                style={{ borderBottomColor: st.color }}
              >
                {st.name}
                <span className="text-[11px] font-normal text-ink-soft">{stageLeads.length} · {stageVal}k€</span>
              </div>

              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
                {stageLeads.map(l => (
                  <DealCard
                    key={l.id}
                    lead={l}
                    slaBreached={isSlaBreached(l, slaLimits)}
                    isTaskOverdue={getLeadPriorityTask(l.id)}
                    onOpen={handleOpenLead}
                  />
                ))}
              </div>

              <button
                className="mt-2.5 rounded-sm border border-dashed border-line-strong py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-focus hover:text-ink cursor-pointer"
                onClick={() => setView('add')}
              >
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
