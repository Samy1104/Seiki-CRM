import React, { useState } from 'react';
import { Flame as HeatmapIcon } from 'lucide-react';
import type { Lead } from '../../services/leadsService';
import type { PipelineStage } from '../../services/settingsService';
import type { LeadStageHistoryEntry } from '../../services/pipelineHistoryService';
import { computeCohortMatrix } from '../../utils/dashboardCalculations';
import { Drawer } from '../../components/ui/Drawer';

export interface CohortHeatmapProps {
  leads: Lead[];
  stageHistory: LeadStageHistoryEntry[];
  stages: PipelineStage[];
  deployedAtIso: string;
}

const cellBackground = (percent: number): string => {
  // Ocre foncé (100%) -> beige clair/neutre (0%), cohérent avec l'accent #D4C4A8
  const alpha = Math.max(0.08, percent / 100);
  return `rgba(212, 196, 168, ${alpha})`;
};

export const CohortHeatmap: React.FC<CohortHeatmapProps> = ({ leads, stageHistory, stages, deployedAtIso }) => {
  const [drilldown, setDrilldown] = useState<{ title: string; leadIds: string[] } | null>(null);

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const rows = computeCohortMatrix(leads, stageHistory, sortedStages);
  const leadsById = new Map(leads.map((l) => [l.id, l]));
  const currentMonthKey = new Date().toISOString().slice(0, 7);

  const drilldownLeads = (drilldown?.leadIds || [])
    .map((id) => leadsById.get(id))
    .filter((l): l is Lead => Boolean(l));

  return (
    <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2.5 border-b border-line/60 pb-3">
        <div className="p-2 bg-[#D4C4A8]/10 text-[#D4C4A8] rounded-xl border border-[#D4C4A8]/20">
          <HeatmapIcon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">Vue Cohorte (Matrice de Performance Temporelle)</h3>
          <p className="text-[11px] text-ink-soft">Pourcentage de chaque cohorte mensuelle ayant atteint chaque étape</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-xs text-ink-faint italic">Aucune cohorte disponible.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#f2ede4]">
            <thead>
              <tr className="border-b border-line/80 text-ink-soft font-semibold text-[11px] uppercase tracking-wider">
                <th className="pb-3 pl-2">Cohorte</th>
                {sortedStages.map((stage) => (
                  <th key={stage.id} className="pb-3 text-center">{stage.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {rows.map((row) => {
                const isPartial = row.monthKey < deployedAtIso.slice(0, 7);
                const isCurrent = row.monthKey === currentMonthKey;
                return (
                  <tr key={row.monthKey}>
                    <td className="py-3 pl-2 font-bold text-[#f2ede4] whitespace-nowrap">
                      {row.monthLabel} · {row.totalLeads} leads
                      {isCurrent && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#D4C4A8]/10 text-[#D4C4A8]">En cours</span>}
                      {isPartial && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300">Historique partiel</span>}
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.stageId} className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setDrilldown({
                              title: `Leads de la cohorte ${row.monthLabel} ayant atteint l'étape ${sortedStages.find((s) => s.id === cell.stageId)?.name} (${cell.reachedCount} leads)`,
                              leadIds: cell.leadIds,
                            })
                          }
                          className="w-full py-2 rounded-md font-bold cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: cellBackground(cell.percent), color: '#0d0d0d' }}
                        >
                          {cell.percent}%
                        </button>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={drilldown !== null} onClose={() => setDrilldown(null)} title={drilldown?.title || ''}>
        <div className="p-6 space-y-2">
          {drilldownLeads.map((lead) => (
            <div key={lead.id} className="p-3 bg-[#1e1e1e] border border-line/60 rounded-xl text-xs space-y-1">
              <div className="font-bold text-[#f2ede4]">{lead.company_name}</div>
              <div className="text-ink-soft">{(lead.deal_value || 0).toLocaleString('fr-FR')} € · {lead.stage?.name || 'Inconnue'}</div>
            </div>
          ))}
          {drilldownLeads.length === 0 && <p className="text-xs text-ink-faint italic">Aucun lead.</p>}
        </div>
      </Drawer>
    </div>
  );
};
