import React, { useMemo, useState } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { PipelineStage } from '../services/settingsService';
import { tasksService } from '../services/tasksService';
import { useToast } from '../context/ToastContext';
import { isSlaBreached } from '../utils/leadMetrics';
import { useCachedResource } from '../hooks/useCachedResource';
import { AlertTriangle, Plus, Eye, EyeOff } from 'lucide-react';
import { LeadDetailModal } from './pipeline/LeadDetailModal';
import { AccentButton } from '../components/ui/AccentButton';
import { KpiTile } from '../components/ui/KpiTile';
import { DealCard } from './pipeline/DealCard';
import { SeikiKanbanBoard } from '../components/ui/SeikiKanbanBoard';

import { PageTitle } from '../components/ui/PageTitle';

interface PipelineProps {
  setView: (view: string) => void;
}

export const Pipeline: React.FC<PipelineProps> = ({ setView }) => {
  const { showToast } = useToast();
  const [showArchivedInLost, setShowArchivedInLost] = useState(false);

  const onError = (err: unknown) => {
    console.error('Error loading pipeline data:', err);
    showToast('Erreur de chargement des données', 'error');
  };

  const stagesRes = useCachedResource('pipelineStages', () => settingsService.getPipelineStages(), [], { onError });
  const leadsRes = useCachedResource('leads:false', () => leadsService.getLeads(false), [], { onError });
  const archivedLeadsRes = useCachedResource('leads:true', () => leadsService.getLeads(true), [], { onError });
  const teamMembersRes = useCachedResource('teamMembers', () => settingsService.getTeamMembers(), [], { onError });
  const tasksRes = useCachedResource('tasks', () => tasksService.getTasks(), [], { onError });
  const slaLimitsRes = useCachedResource('slaLimits', () => settingsService.getSlaLimits(), { Media: 5, Retail: 7, Instit: 14 }, { onError });

  const stages = stagesRes.data;
  const leads = leadsRes.data;
  const archivedLeads = archivedLeadsRes.data;
  const teamMembers = teamMembersRes.data;
  const tasks = tasksRes.data;
  const slaLimits = slaLimitsRes.data;
  const loading = stagesRes.loading || leadsRes.loading || teamMembersRes.loading || tasksRes.loading || slaLimitsRes.loading;

  const reloadPipelineData = () => Promise.all([
    stagesRes.reload(),
    leadsRes.reload(),
    archivedLeadsRes.reload(),
    teamMembersRes.reload(),
    tasksRes.reload(),
    slaLimitsRes.reload(),
  ]).then(() => {});

  // Modal state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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

  const displayLeads = useMemo(() => {
    if (!showArchivedInLost) return leads;
    const lostStageIds = stages
      .filter((st) => st.is_closed_lost || (st.name || '').toLowerCase().includes('perdu'))
      .map((st) => st.id);
    const archivedLostLeads = archivedLeads.filter((l) => lostStageIds.includes(l.stage_id));
    return [...leads, ...archivedLostLeads];
  }, [leads, archivedLeads, showArchivedInLost, stages]);

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
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-4 p-6 overflow-hidden">
      <div className="flex flex-shrink-0 items-center justify-between">
        <div>
          <PageTitle>Pipeline</PageTitle>
        </div>
        <AccentButton icon={<Plus size={15} strokeWidth={2.5} />} onClick={() => setView('add')}>Nouveau lead</AccentButton>
      </div>

      <div className="grid flex-shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Deals actifs" value={activeLeads.length} sub={`${wonLeads.length} closés gagnés`} accent="amber" />
        <KpiTile label="Pipeline" value={totalVal} formatValue={(v) => `${Math.round(v).toLocaleString()} €`} sub="Valeur totale" accent="neutral" />
        <KpiTile label="Score moyen" value={avgScore} formatValue={(v) => `${Math.round(v)}/100`} sub={`${hotCount} chauds ≥ 80`} accent="success" />
        <KpiTile label="Closés Gagnés" value={wonVal} formatValue={(v) => `${Math.round(v).toLocaleString()} €`} sub="Deals signés" accent="success" />
      </div>

      {slaBreaches.length > 0 && (
        <div className="flex flex-shrink-0 items-start gap-3 rounded-surface border border-danger/25 bg-danger/10 px-4 py-2.5">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-danger" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-ink">
              {slaBreaches.length} lead{slaBreaches.length > 1 ? 's' : ''} avec SLA dépassé — action requise aujourd'hui
            </span>
            <div className="text-[11px] text-ink-soft">
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

      <div className="flex-1 min-h-0 w-full overflow-hidden">
        <SeikiKanbanBoard<Lead, PipelineStage>
          columns={stages}
          cards={displayLeads}
          getColumnId={(st) => st.id}
          getColumnTitle={(st) => st.name}
          getColumnColor={(st) => st.color}
          getCardId={(l) => l.id}
          getCardColumnId={(l) => l.stage_id}
          fillWidth={false}
          renderColumnHeaderExtra={(st, count) => {
            const stageLeads = displayLeads.filter((l) => l.stage_id === st.id);
            const stageVal = stageLeads.reduce((acc, l) => acc + l.deal_value, 0);
            const isLostStage = Boolean(st.is_closed_lost || (st.name || '').toLowerCase().includes('perdu'));

            return (
              <div className="flex items-center gap-1.5">
                {isLostStage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowArchivedInLost((prev) => !prev);
                    }}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                      showArchivedInLost
                        ? 'bg-[#c8b89a]/20 text-[#c8b89a] border-[#c8b89a]/50 font-bold'
                        : 'bg-surface/50 text-ink-soft border-line hover:text-ink hover:border-line-focus'
                    }`}
                    title={showArchivedInLost ? 'Masquer les leads archivés' : 'Afficher les leads archivés'}
                  >
                    {showArchivedInLost ? <Eye size={11} /> : <EyeOff size={11} />}
                    <span>Archivés</span>
                  </button>
                )}
                <span className="text-[11px] font-normal text-ink-soft">
                  {count} · {stageVal.toLocaleString()} €
                </span>
              </div>
            );
          }}
          renderCard={(lead) => (
            <DealCard
              lead={lead}
              slaBreached={isSlaBreached(lead, slaLimits)}
              isTaskOverdue={getLeadPriorityTask(lead.id)}
              onOpen={handleOpenLead}
            />
          )}
          renderColumnFooter={() => (
            <button
              className="mt-2.5 w-full rounded-control border border-dashed border-line-strong py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-focus hover:text-ink cursor-pointer"
              onClick={() => setView('add')}
            >
              + Ajouter
            </button>
          )}
          onCardMove={async (leadId, _fromCol, toCol) => {
            const targetStage = stages.find((s) => s.id === toCol);
            const activeMatch = leadsRes.data.find((l) => l.id === leadId);
            const archivedMatch = archivedLeadsRes.data.find((l) => l.id === leadId);
            const currentLead = activeMatch || archivedMatch;

            if (currentLead) {
              const updatedLead: Lead = {
                ...currentLead,
                stage_id: toCol,
                stage: targetStage || currentLead.stage,
              };

              if (currentLead.is_archived) {
                archivedLeadsRes.setData((prev) =>
                  prev.map((l) => (l.id === leadId ? updatedLead : l))
                );
              } else {
                leadsRes.setData((prev) =>
                  prev.map((l) => (l.id === leadId ? updatedLead : l))
                );
              }
            }

            // Perform async network update in background
            try {
              await leadsService.updateLead(leadId, {
                stage_id: toCol,
              });
            } catch (err: any) {
              console.error('Error updating stage:', err);
              const detailMsg = err?.message ? `: ${err.message}` : '';
              showToast(`Erreur lors de la mise à jour${detailMsg}`, 'error');
              reloadPipelineData();
            }
          }}
          onCardClick={(lead) => handleOpenLead(lead.id)}
        />
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
          onChanged={reloadPipelineData}
        />
      )}
    </div>
  );
};
