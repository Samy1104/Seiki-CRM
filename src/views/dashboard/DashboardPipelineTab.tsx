import React, { useState } from 'react';
import { GitCommit, Layers, PieChart, Share2, Clock, ArrowUpRight, ArrowDownRight, DollarSign, Hash, Euro } from 'lucide-react';
import type { Lead, LeadHistoryItem } from '../../services/leadsService';
import type { PipelineStage } from '../../services/settingsService';
import type { LeadStageHistoryEntry } from '../../services/pipelineHistoryService';
import { computeLeadsProgression, computeDelta, reconstructStageSnapshot, countByStage, type DeltaResult } from '../../utils/dashboardCalculations';
import { Drawer } from '../../components/ui/Drawer';
import { CohortHeatmap } from './CohortHeatmap';

export interface DashboardPipelineTabProps {
  leadsA: Lead[];
  leadsB: Lead[];
  stages: PipelineStage[];
  historyA: LeadHistoryItem[];
  historyB: LeadHistoryItem[];
  stageHistory: LeadStageHistoryEntry[];
  comparisonEndDate: string;
  deployedAtIso?: string;
}

const DeltaBadge: React.FC<{ delta: DeltaResult }> = ({ delta }) => {
  const isPositive = delta.percent > 0;
  const isNegative = delta.percent < 0;

  if (isPositive) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#D4C4A8]/10 text-[#D4C4A8] border border-[#D4C4A8]/30">
        <ArrowUpRight className="w-3.5 h-3.5" />
        +{delta.percent}% (+{delta.absolute})
      </span>
    );
  }

  if (isNegative) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
        <ArrowDownRight className="w-3.5 h-3.5" />
        {delta.percent}% ({delta.absolute})
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#1e1e1e] text-ink-soft border border-line">
      0%
    </span>
  );
};

export const DashboardPipelineTab: React.FC<DashboardPipelineTabProps> = ({
  leadsA,
  leadsB: _leadsB,
  stages,
  historyA,
  historyB,
  stageHistory,
  comparisonEndDate,
  deployedAtIso = '2026-07-30T00:00:00.000Z',
}) => {
  const [displayMode, setDisplayMode] = useState<'volume' | 'valeur'>('volume');
  const [hideClosed, setHideClosed] = useState(false);
  const [drilldown, setDrilldown] = useState<{ title: string; leads: Lead[] } | null>(null);

  // 1. Progression of Leads (Stage Changes) Metric
  const progressionA = computeLeadsProgression(historyA, '1970-01-01', '2099-12-31');
  const progressionB = computeLeadsProgression(historyB, '1970-01-01', '2099-12-31');
  const progressionDelta = computeDelta(progressionA, progressionB);

  // 2. Weighted Pipeline Value Calculation
  const sortedStages = [...stages].sort((a, b) => (a.position || 0) - (b.position || 0));

  const getStageWeight = (stageId: string): number => {
    const stg = stages.find((s) => s.id === stageId);
    if (!stg) return 0.2;
    if (stg.is_closed_won) return 1.0;
    if (stg.is_closed_lost) return 0.0;
    const index = sortedStages.findIndex((s) => s.id === stageId);
    if (index === -1) return 0.2;
    const ratio = (index + 1) / (sortedStages.length || 1);
    return Math.min(0.9, Math.max(0.1, ratio));
  };

  const totalRawValue = leadsA.reduce((sum, l) => sum + (l.deal_value || 0), 0);
  const weightedPipelineValue = Math.round(
    leadsA.reduce((sum, l) => sum + (l.deal_value || 0) * getStageWeight(l.stage_id), 0)
  );

  // 3. Funnel / Per Stage Metrics
  const comparisonSnapshot = reconstructStageSnapshot(stageHistory, comparisonEndDate);
  const comparisonCounts = countByStage(comparisonSnapshot);

  const totalLeadsCount = leadsA.length || 1;
  const visibleStages = hideClosed ? sortedStages.filter((s) => !s.is_closed_won && !s.is_closed_lost) : sortedStages;
  const stageStats = visibleStages.map((stage) => {
    const stageLeads = leadsA.filter((l) => l.stage_id === stage.id);
    const count = stageLeads.length;
    const totalVal = stageLeads.reduce((sum, l) => sum + (l.deal_value || 0), 0);
    const percent = Math.round((count / totalLeadsCount) * 100);
    const previousCount = comparisonCounts[stage.id] || 0;
    return {
      stage,
      count,
      totalVal,
      percent,
      leads: stageLeads,
      delta: count - previousCount,
    };
  });

  // 4. Segment Breakdown
  const segments: Array<'Media' | 'Retail' | 'Instit'> = ['Media', 'Retail', 'Instit'];
  const segmentStats = segments.map((seg) => {
    const segLeads = leadsA.filter((l) => l.segment === seg);
    const count = segLeads.length;
    const totalVal = segLeads.reduce((sum, l) => sum + (l.deal_value || 0), 0);
    const percent = Math.round((count / totalLeadsCount) * 100);
    return { seg, count, totalVal, percent };
  });

  // 5. Source Breakdown
  const sourceMap: Record<string, { count: number; totalVal: number }> = {};
  leadsA.forEach((l) => {
    const src = l.source || 'Autre / Inconnu';
    if (!sourceMap[src]) sourceMap[src] = { count: 0, totalVal: 0 };
    sourceMap[src].count += 1;
    sourceMap[src].totalVal += l.deal_value || 0;
  });
  const sourceStats = Object.entries(sourceMap)
    .map(([source, data]) => ({
      source,
      count: data.count,
      totalVal: data.totalVal,
      percent: Math.round((data.count / totalLeadsCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // 6. Average Sales Cycle Length (Days in stage / Lead Age)
  const avgSalesCycleDays = Math.round(
    leadsA.reduce((sum, l) => sum + (l.days_in_stage || 0), 0) / totalLeadsCount
  );

  return (
    <div className="space-y-6">
      {/* Top Metric Cards: Progression, Weighted Value, Cycle Length */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Leads Progression */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <GitCommit className="w-4 h-4 text-[#D4C4A8]" />
              <span>Mouvements d'Étape (Progression)</span>
            </div>
            <DeltaBadge delta={progressionDelta} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {progressionA} <span className="text-sm font-normal text-ink-soft">changements</span>
            </div>
            <p className="text-xs text-ink-soft mt-1">
              Nombre de progressions de leads enregistrées dans l'historique sur la période.
            </p>
          </div>
        </div>

        {/* Card 2: Weighted Pipeline Value */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <DollarSign className="w-4 h-4 text-[#D4C4A8]" />
              <span>Valeur Pondérée du Pipeline</span>
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {weightedPipelineValue.toLocaleString('fr-FR')} €
            </div>
            <p className="text-xs text-ink-soft mt-1">
              Valeur brute: <span className="font-semibold text-[#D4C4A8]">{totalRawValue.toLocaleString('fr-FR')} €</span> (ajustée selon probabilité par étape).
            </p>
          </div>
        </div>

        {/* Card 3: Average Sales Cycle */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <Clock className="w-4 h-4 text-[#D4C4A8]" />
              <span>Ancienneté Moyenne en Étape</span>
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {avgSalesCycleDays} <span className="text-sm font-normal text-ink-soft">jours</span>
            </div>
            <p className="text-xs text-ink-soft mt-1">
              Temps moyen passé par les leads actifs dans leur étape actuelle.
            </p>
          </div>
        </div>
      </div>

      {/* Funnel Chart Card */}
      <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D4C4A8]" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">Vue par Statut (Entonnoir & Deltas)</h3>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-ink-soft cursor-pointer">
              <input
                type="checkbox"
                aria-label="Masquer les deals fermés"
                checked={hideClosed}
                onChange={(e) => setHideClosed(e.target.checked)}
              />
              Masquer les deals fermés
            </label>

            <div className="flex items-center gap-1 bg-[#1e1e1e] border border-line rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setDisplayMode('volume')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${displayMode === 'volume' ? 'bg-[#D4C4A8] text-[#0d0d0d]' : 'text-ink-soft'}`}
              >
                <Hash className="w-3 h-3" /> Volume
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('valeur')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${displayMode === 'valeur' ? 'bg-[#D4C4A8] text-[#0d0d0d]' : 'text-ink-soft'}`}
              >
                <Euro className="w-3 h-3" /> Valeur
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {stageStats.map(({ stage, count, totalVal, percent, leads, delta }) => {
            const barWidth = Math.max(5, percent);
            return (
              <button
                type="button"
                key={stage.id}
                onClick={() => setDrilldown({ title: `Leads en étape ${stage.name} (${count})`, leads })}
                className="w-full text-left space-y-1 cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color || '#D4C4A8' }} />
                    <span className="font-bold text-[#f2ede4] group-hover:text-[#D4C4A8] transition-colors">{stage.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-ink-soft">
                    {displayMode === 'volume' ? (
                      <span>{count} leads ({percent}%)</span>
                    ) : (
                      <span className="font-semibold text-[#D4C4A8]">{totalVal.toLocaleString('fr-FR')} €</span>
                    )}
                    <span className={delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-ink-faint'}>
                      ({delta > 0 ? '+' : ''}{delta})
                    </span>
                  </div>
                </div>

                <div className="w-full bg-[#1e1e1e] h-3 rounded-full overflow-hidden border border-line/40">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: stage.color || '#D4C4A8' }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Segment & Source Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segment Breakdown */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-line/60 pb-3">
            <div className="p-2 bg-[#D4C4A8]/10 text-[#D4C4A8] rounded-xl border border-[#D4C4A8]/20">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">Répartition par Segment Métier</h3>
              <p className="text-[11px] text-ink-soft">Media, Retail et Institutionnel</p>
            </div>
          </div>

          <div className="space-y-3">
            {segmentStats.map(({ seg, count, totalVal, percent }) => (
              <div key={seg} className="p-3 bg-[#1e1e1e] rounded-xl border border-line/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#f2ede4]">{seg}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-ink-soft">{count} leads ({percent}%)</span>
                    <span className="text-[#D4C4A8] font-bold">{totalVal.toLocaleString('fr-FR')} €</span>
                  </div>
                </div>
                <div className="w-full bg-[#141414] h-2 rounded-full overflow-hidden border border-line/40">
                  <div
                    className="bg-[#D4C4A8] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, percent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Breakdown */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-line/60 pb-3">
            <div className="p-2 bg-[#D4C4A8]/10 text-[#D4C4A8] rounded-xl border border-[#D4C4A8]/20">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">Répartition par Canaux d'Acquisition</h3>
              <p className="text-[11px] text-ink-soft">Origine des leads dans le pipeline</p>
            </div>
          </div>

          {sourceStats.length === 0 ? (
            <div className="text-center py-6 text-xs text-ink-faint italic">Aucune donnée de source disponible.</div>
          ) : (
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {sourceStats.map(({ source, count, totalVal, percent }) => (
                <div key={source} className="p-3 bg-[#1e1e1e] rounded-xl border border-line/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#f2ede4]">{source}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-ink-soft">{count} leads ({percent}%)</span>
                      <span className="text-[#D4C4A8] font-bold">{totalVal.toLocaleString('fr-FR')} €</span>
                    </div>
                  </div>
                  <div className="w-full bg-[#141414] h-2 rounded-full overflow-hidden border border-line/40">
                    <div
                      className="bg-[#D4C4A8] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(2, percent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CohortHeatmap leads={leadsA} stageHistory={stageHistory} stages={stages} deployedAtIso={deployedAtIso} />

      <Drawer open={drilldown !== null} onClose={() => setDrilldown(null)} title={drilldown?.title || ''}>
        <div className="p-6 space-y-2">
          {(drilldown?.leads || []).map((lead) => (
            <div key={lead.id} className="p-3 bg-[#1e1e1e] border border-line/60 rounded-xl text-xs space-y-1">
              <div className="font-bold text-[#f2ede4]">{lead.company_name}</div>
              <div className="text-ink-soft">{(lead.deal_value || 0).toLocaleString('fr-FR')} € · {lead.stage?.name || 'Inconnue'}</div>
            </div>
          ))}
          {(drilldown?.leads || []).length === 0 && (
            <p className="text-xs text-ink-faint italic">Aucun lead sur cette étape.</p>
          )}
        </div>
      </Drawer>
    </div>
  );
};
