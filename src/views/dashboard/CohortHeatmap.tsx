import React, { useState, useMemo } from 'react';
import { Flame as HeatmapIcon } from 'lucide-react';
import type { Lead } from '../../services/leadsService';
import type { PipelineStage } from '../../services/settingsService';
import type { LeadStageHistoryEntry } from '../../services/pipelineHistoryService';
import {
  computeFlexibleCohortMatrix,
  type CohortGranularity,
  type IntervalGranularity,
} from '../../utils/dashboardCalculations';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../components/ui/Select';
import { Drawer } from '../../components/ui/Drawer';

export interface CohortHeatmapProps {
  leads: Lead[];
  stageHistory: LeadStageHistoryEntry[];
  stages: PipelineStage[];
  deployedAtIso?: string;
}

export const CohortHeatmap: React.FC<CohortHeatmapProps> = ({
  leads,
  stageHistory,
  stages,
  deployedAtIso,
}) => {
  const [cohortGranularity, setCohortGranularity] = useState<CohortGranularity>('month');
  const [intervalGranularity, setIntervalGranularity] = useState<IntervalGranularity>('week');
  const [periodCount, setPeriodCount] = useState<number>(8);
  const [selectedTargetStageId, setSelectedTargetStageId] = useState<string>('');

  const [drilldown, setDrilldown] = useState<{ title: string; leads: Lead[] } | null>(null);

  const activeStages = useMemo(() => {
    return [...stages].filter((s) => s.is_active !== false).sort((a, b) => a.position - b.position);
  }, [stages]);

  const defaultTargetStageId = useMemo(() => {
    const qualStage = activeStages.find((s) => s.name.toLowerCase().includes('qualification'));
    return qualStage?.id || activeStages[1]?.id || activeStages[0]?.id || '';
  }, [activeStages]);

  const currentTargetStageId = selectedTargetStageId || defaultTargetStageId;

  const { rows, intervalHeaderLabels } = useMemo(() => {
    return computeFlexibleCohortMatrix(leads, stageHistory, {
      cohortGranularity,
      intervalGranularity,
      periodCount,
      targetStageId: currentTargetStageId,
      allStages: stages,
    });
  }, [leads, stageHistory, cohortGranularity, intervalGranularity, periodCount, currentTargetStageId, stages]);

  const stagesById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  return (
    <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
      {/* Header title */}
      <div className="flex items-center gap-2.5 border-b border-line/60 pb-3">
        <div className="p-2 bg-[#D4C4A8]/10 text-[#D4C4A8] rounded-xl border border-[#D4C4A8]/20">
          <HeatmapIcon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">
            Vue Cohorte (Matrice de Performance Temporelle)
          </h3>
          <p className="text-[11px] text-ink-soft">
            Pourcentage cumulé de chaque cohorte ayant atteint l'étape cible sur plusieurs intervalles de temps
          </p>
        </div>
      </div>

      {/* Header controls bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[#1a1a1a] p-3 rounded-xl border border-line/60">
        <div>
          <label htmlFor="cohort-granularity" className="block text-[10px] font-semibold uppercase tracking-wider text-ink-soft mb-1">
            Cohortes (Y)
          </label>
          <Select value={cohortGranularity} onValueChange={(val) => setCohortGranularity(val as CohortGranularity)}>
            <SelectTrigger id="cohort-granularity" aria-label="Cohortes (Y)">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mois</SelectItem>
              <SelectItem value="fortnight">Quinzaine (15j)</SelectItem>
              <SelectItem value="week">Semaine</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="interval-granularity" className="block text-[10px] font-semibold uppercase tracking-wider text-ink-soft mb-1">
            Intervalles (X)
          </label>
          <Select value={intervalGranularity} onValueChange={(val) => setIntervalGranularity(val as IntervalGranularity)}>
            <SelectTrigger id="interval-granularity" aria-label="Intervalles (X)">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Jours</SelectItem>
              <SelectItem value="week">Semaines</SelectItem>
              <SelectItem value="month">Mois</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="period-count" className="block text-[10px] font-semibold uppercase tracking-wider text-ink-soft mb-1">
            Nombre de périodes
          </label>
          <Select value={String(periodCount)} onValueChange={(val) => setPeriodCount(Number(val))}>
            <SelectTrigger id="period-count" aria-label="Nombre de périodes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="6">6</SelectItem>
              <SelectItem value="8">8</SelectItem>
              <SelectItem value="12">12</SelectItem>
              <SelectItem value="16">16</SelectItem>
              <SelectItem value="24">24</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="target-stage" className="block text-[10px] font-semibold uppercase tracking-wider text-ink-soft mb-1">
            Statut Cible
          </label>
          <Select value={currentTargetStageId} onValueChange={(val) => setSelectedTargetStageId(val)}>
            <SelectTrigger id="target-stage" aria-label="Statut Cible">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activeStages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cohort Matrix Table */}
      {rows.length === 0 ? (
        <div className="text-center py-8 text-xs text-ink-faint italic">
          Aucune cohorte disponible pour la configuration sélectionnée.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#f2ede4]">
            <thead>
              <tr className="border-b border-line/80 text-ink-soft font-semibold text-[11px] uppercase tracking-wider">
                <th className="pb-3 pl-2">Cohorte</th>
                {intervalHeaderLabels.map((label) => (
                  <th key={label} className="pb-3 text-center min-w-[70px]">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {rows.map((row) => {
                const isPartial = Boolean(
                  deployedAtIso &&
                    row.cohortStart &&
                    row.cohortStart.getTime() < new Date(deployedAtIso).getTime()
                );

                return (
                  <tr key={row.cohortId}>
                    <td className="py-3 pl-2 font-bold text-[#f2ede4] whitespace-nowrap">
                      {row.cohortLabel}
                      <span className="ml-2 text-[10px] text-ink-soft font-normal">
                        ({row.totalLeads} {row.totalLeads > 1 ? 'leads' : 'lead'})
                      </span>
                      {isPartial && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300">
                          Historique partiel
                        </span>
                      )}
                    </td>
                  {row.cells.map((cell) => {
                    const opacity = 0.08 + (cell.reachPercentage / 100) * 0.72;
                    const bgStyle = `rgba(212, 196, 168, ${opacity.toFixed(2)})`;
                    const textColor = opacity > 0.45 ? '#141414' : '#f2ede4';

                    return (
                      <td key={cell.intervalIndex} className="p-1 text-center">
                        <button
                          type="button"
                          aria-label={`${cell.reachPercentage.toFixed(1)}%`}
                          onClick={() =>
                            setDrilldown({
                              title: `Leads cohorte ${row.cohortLabel} (${cell.intervalLabel}) — ${cell.reachedCount}/${cell.totalCount} qualifiés`,
                              leads: cell.reachedLeads,
                            })
                          }
                          className="w-full py-2 px-1 rounded-md cursor-pointer hover:opacity-85 transition-opacity flex flex-col items-center justify-center gap-0.5"
                          style={{ backgroundColor: bgStyle, color: textColor }}
                        >
                          <span className="font-bold text-xs">{cell.reachPercentage.toFixed(1)}%</span>
                          <span className="text-[10px] opacity-80 font-normal">
                            {cell.reachedCount} / {cell.totalCount}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drill-down Drawer */}
      <Drawer open={drilldown !== null} onClose={() => setDrilldown(null)} title={drilldown?.title || ''}>
        <div className="p-6 space-y-2">
          {(drilldown?.leads || []).map((lead) => {
            const currentStage = stagesById.get(lead.stage_id);
            return (
              <div key={lead.id} className="p-3 bg-[#1e1e1e] border border-line/60 rounded-xl text-xs space-y-1">
                <div className="font-bold text-[#f2ede4]">{lead.company_name || lead.contact_name || 'Sans nom'}</div>
                <div className="text-ink-soft">
                  {(lead.deal_value || 0).toLocaleString('fr-FR')} € · {currentStage?.name || lead.stage?.name || 'Étape inconnue'}
                </div>
              </div>
            );
          })}
          {(drilldown?.leads || []).length === 0 && (
            <p className="text-xs text-ink-faint italic">Aucun lead qualifié dans ce créneau.</p>
          )}
        </div>
      </Drawer>
    </div>
  );
};
