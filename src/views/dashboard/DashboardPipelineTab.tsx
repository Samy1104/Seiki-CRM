import React from 'react';
import { GitCommit, Layers, PieChart, Share2, Clock, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';
import type { Lead, LeadHistoryItem } from '../../services/leadsService';
import type { PipelineStage } from '../../services/settingsService';
import { computeLeadsProgression, computeDelta, type DeltaResult } from '../../utils/dashboardCalculations';

export interface DashboardPipelineTabProps {
  leadsA: Lead[];
  leadsB: Lead[];
  stages: PipelineStage[];
  historyA: LeadHistoryItem[];
  historyB: LeadHistoryItem[];
}

const DeltaBadge: React.FC<{ delta: DeltaResult }> = ({ delta }) => {
  const isPositive = delta.percent > 0;
  const isNegative = delta.percent < 0;

  if (isPositive) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/10 text-[#F59E0B] border border-amber-500/30">
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
}) => {
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
  const totalLeadsCount = leadsA.length || 1;
  const stageStats = sortedStages.map((stage) => {
    const stageLeads = leadsA.filter((l) => l.stage_id === stage.id);
    const count = stageLeads.length;
    const totalVal = stageLeads.reduce((sum, l) => sum + (l.deal_value || 0), 0);
    const percent = Math.round((count / totalLeadsCount) * 100);
    return {
      stage,
      count,
      totalVal,
      percent,
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
              <GitCommit className="w-4 h-4 text-[#F59E0B]" />
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
            <span className="text-xs font-mono px-2 py-0.5 bg-[#1e1e1e] border border-line rounded-md text-[#D4C4A8]">
              Forecast IA
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {weightedPipelineValue.toLocaleString('fr-FR')} €
            </div>
            <div className="text-xs text-ink-soft mt-1">
              Brut: <span className="text-[#f2ede4] font-medium">{totalRawValue.toLocaleString('fr-FR')} €</span> (Pondération par probabilité d'étape)
            </div>
          </div>
        </div>

        {/* Card 3: Average Sales Cycle */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <Clock className="w-4 h-4 text-[#F59E0B]" />
              <span>Durée Moyenne de Stagnation</span>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 bg-[#1e1e1e] border border-line rounded-md text-ink-soft">
              Stagnation
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {avgSalesCycleDays} <span className="text-sm font-normal text-ink-soft">jours / étape</span>
            </div>
            <p className="text-xs text-ink-soft mt-1">
              Temps moyen passé par les leads actifs dans leur étape actuelle.
            </p>
          </div>
        </div>
      </div>

      {/* Funnel Chart / Stage Breakdown */}
      <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#D4C4A8]/10 text-[#D4C4A8] rounded-xl border border-[#D4C4A8]/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f2ede4]">Funnel Commercial & Répartition par Étape</h3>
              <p className="text-[11px] text-ink-soft">Distribution des leads et valeur cumulée à chaque étape du pipe</p>
            </div>
          </div>
          <span className="text-xs font-mono text-ink-soft">
            {leadsA.length} leads au total
          </span>
        </div>

        <div className="space-y-3">
          {stageStats.map(({ stage, count, totalVal, percent }) => {
            const weight = getStageWeight(stage.id);

            return (
              <div key={stage.id} className="space-y-1.5 bg-[#1e1e1e]/60 p-3 rounded-xl border border-line/60">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: stage.color || '#D4C4A8' }}
                    />
                    <span className="font-bold text-[#f2ede4]">{stage.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-[#141414] text-ink-soft rounded border border-line">
                      Pondération {Math.round(weight * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-4 font-mono">
                    <span className="text-[#f2ede4] font-bold">{count} leads ({percent}%)</span>
                    <span className="text-[#F59E0B] font-extrabold">{totalVal.toLocaleString('fr-FR')} €</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#141414] h-2.5 rounded-full overflow-hidden border border-line/40">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(3, percent)}%`,
                      backgroundColor: stage.color || '#D4C4A8',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Segment & Source Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segment Breakdown */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-line/60 pb-3">
            <div className="p-2 bg-amber-500/10 text-[#F59E0B] rounded-xl border border-amber-500/20">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f2ede4]">Répartition par Segment Métier</h3>
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
              <h3 className="text-sm font-bold text-[#f2ede4]">Répartition par Canaux d'Acquisition</h3>
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
                      <span className="text-[#F59E0B] font-bold">{totalVal.toLocaleString('fr-FR')} €</span>
                    </div>
                  </div>
                  <div className="w-full bg-[#141414] h-2 rounded-full overflow-hidden border border-line/40">
                    <div
                      className="bg-[#F59E0B] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(2, percent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
