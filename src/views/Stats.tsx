import React, { useState } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { PipelineStage } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { TrendingUp, Compass, Award } from 'lucide-react';
import { computeSegmentStats } from '../utils/leadMetrics';
import { useLoadOnMount } from '../hooks/useLoadOnMount';
import { withLoadingState } from '../utils/withLoadingState';
import { KpiTile } from '../components/ui/KpiTile';

export const Stats: React.FC = () => {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  useLoadOnMount(() => withLoadingState(async () => {
    const fetchedLeads = await leadsService.getLeads();
    const fetchedStages = await settingsService.getPipelineStages();
    setLeads(fetchedLeads);
    setStages(fetchedStages);
  }, {
    setLoading,
    onError: (err) => {
      console.error('Error loading stats data:', err);
      showToast('Erreur de chargement des statistiques', 'error');
    }
  }));

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="mt-3 text-ink-soft">Calcul des statistiques...</div>
      </div>
    );
  }

  // Calculations
  const totalLeads = leads.length;
  const wonLeads = leads.filter(l => l.stage?.is_closed_won);
  const activeLeads = leads.filter(l => !l.is_archived && l.stage?.name !== 'Gagné');

  const totalVal = leads.reduce((acc, l) => acc + l.deal_value, 0);
  const wonVal = wonLeads.reduce((acc, l) => acc + l.deal_value, 0);
  const averageDealValue = totalLeads ? Math.round(totalVal / totalLeads) : 0;

  const conversionRate = totalLeads ? Math.round((wonLeads.length / totalLeads) * 100) : 0;

  const funnelStages = stages.map(st => {
    const count = leads.filter(l => l.stage_id === st.id).length;
    const value = leads.filter(l => l.stage_id === st.id).reduce((acc, l) => acc + l.deal_value, 0);
    return { name: st.name, count, value, color: st.color };
  });

  const maxStageCount = Math.max(...funnelStages.map(f => f.count), 1);

  const segmentStats = computeSegmentStats(leads);
  const totalSegmentCount = Object.values(segmentStats).reduce((acc, curr) => acc + curr.count, 0);
  const segmentOpacity: Record<'Media' | 'Retail' | 'Instit', string> = {
    Media: 'bg-amber',
    Retail: 'bg-amber/70',
    Instit: 'bg-amber/40',
  };

  const sourceStats: Record<string, number> = {};
  leads.forEach(l => {
    sourceStats[l.source] = (sourceStats[l.source] || 0) + 1;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="font-display text-xl font-bold text-ink">Statistiques</div>
        <div className="mt-0.5 text-xs text-ink-soft">Indicateurs de performance commerciale</div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Panier Moyen" value={averageDealValue} formatValue={(v) => `${Math.round(v)}k€`} sub="Valeur moyenne de deal" accent="neutral" />
        <KpiTile label="Taux de conversion" value={conversionRate} formatValue={(v) => `${Math.round(v)}%`} sub="Deals gagnés / Total" accent="success" />
        <KpiTile label="Deals actifs" value={activeLeads.length} sub="Opportunités en cours" accent="amber" />
        <KpiTile label="Total Gagné" value={wonVal} formatValue={(v) => `${Math.round(v)}k€`} sub={`${wonLeads.length} contrats signés`} accent="success" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-surface border border-line bg-elevated p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <TrendingUp size={14} className="text-amber" />
            Entonnoir de conversion (Funnel)
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {funnelStages.map(f => {
              const pct = Math.round((f.count / maxStageCount) * 100);
              return (
                <div key={f.name} className="flex items-center gap-3">
                  <span className="w-28 flex-shrink-0 text-xs font-semibold text-ink-soft">{f.name}</span>
                  <div className="relative h-6 flex-1 overflow-hidden rounded-control bg-hover">
                    <div
                      className="h-full opacity-70 transition-all duration-700"
                      style={{ width: `${pct}%`, background: f.color || 'var(--color-amber)' }}
                    ></div>
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-ink">
                      {f.count} deal{f.count !== 1 ? 's' : ''} ({f.value}k€)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-surface border border-line bg-elevated p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Compass size={14} className="text-amber" />
            Sources d'acquisition
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {Object.entries(sourceStats).map(([src, count]) => {
              const pct = totalLeads ? Math.round((count / totalLeads) * 100) : 0;
              return (
                <div key={src} className="flex items-center gap-3">
                  <span className="w-28 flex-shrink-0 truncate text-xs text-ink-soft">{src}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-hover">
                    <div className="h-full rounded-full bg-amber transition-all duration-700" style={{ width: `${pct}%` }}></div>
                  </div>
                  <span className="w-14 flex-shrink-0 text-right text-xs tabular-nums text-ink-faint">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-surface border border-line bg-elevated p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <Award size={14} className="text-amber" />
          Répartition des leads par segment d'activité
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(['Media', 'Retail', 'Instit'] as const).map(seg => {
            const data = segmentStats[seg];
            const pct = totalSegmentCount ? Math.round((data.count / totalSegmentCount) * 100) : 0;

            return (
              <div key={seg} className="rounded-control border border-line bg-surface p-4 text-center">
                <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-soft">
                  <span className={`h-2 w-2 rounded-full ${segmentOpacity[seg]}`}></span>
                  {seg}
                </div>
                <div className="font-display text-2xl font-bold tabular-nums text-ink">{data.count}</div>
                <div className="mt-1 text-[11px] text-ink-faint">
                  {pct}% des leads · Valeur {data.val}k€
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
