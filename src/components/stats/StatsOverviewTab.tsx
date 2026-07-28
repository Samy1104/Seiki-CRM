import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { Lead } from '../../services/leadsService';
import type { PipelineStage } from '../../services/settingsService';
import type { KpiMetrics } from '../../utils/statsCalculations';

interface StatsOverviewTabProps {
  leads: Lead[];
  stages: PipelineStage[];
  kpis: KpiMetrics;
}

const COLORS = ['#D4C4A8', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export const StatsOverviewTab: React.FC<StatsOverviewTabProps> = ({ leads, stages, kpis }) => {
  // Timeline trend data
  const trendData = useMemo(() => {
    const map: Record<string, { date: string; ca: number; count: number }> = {};
    leads.forEach((l) => {
      if (!l.created_at) return;
      const d = l.created_at.slice(0, 10);
      if (!map[d]) map[d] = { date: d, ca: 0, count: 0 };
      map[d].count += 1;
      const isWon = l.stage?.is_closed_won || stages.find((s) => s.id === l.stage_id)?.is_closed_won;
      if (isWon) {
        map[d].ca += l.deal_value || 0;
      }
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [leads, stages]);

  // Source breakdown
  const sourceData = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      const src = l.source || 'Autre';
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [leads]);

  // Funnel breakdown
  const funnelStages = useMemo(() => {
    return stages.map((st) => {
      const stageLeads = leads.filter((l) => l.stage_id === st.id);
      return {
        name: st.name,
        count: stageLeads.length,
        value: stageLeads.reduce((acc, l) => acc + (l.deal_value || 0), 0),
        color: st.color || '#D4C4A8',
      };
    });
  }, [stages, leads]);

  const maxFunnelCount = Math.max(...funnelStages.map((f) => f.count), 1);

  return (
    <div className="space-y-8 font-ui">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-2 hover:border-[#D4C4A8]/40 transition-colors">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#D4C4A8]">
            Chiffre d'Affaires Gagné
          </div>
          <div className="text-4xl font-extrabold text-[#f2ede4] tracking-tight tabular-nums">
            {kpis.totalWonVal.toLocaleString()} <span className="text-xl font-normal text-ink-soft">€</span>
          </div>
          {kpis.wonValDeltaPct !== undefined && (
            <div className={`text-xs font-semibold ${kpis.wonValDeltaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {kpis.wonValDeltaPct >= 0 ? `+${kpis.wonValDeltaPct} %` : `${kpis.wonValDeltaPct}%`} vs préc.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-2 hover:border-[#D4C4A8]/40 transition-colors">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#D4C4A8]">
            Taux de conversion
          </div>
          <div className="text-4xl font-extrabold text-[#f2ede4] tracking-tight tabular-nums">
            {kpis.winRate}<span className="text-xl font-normal text-ink-soft"> %</span>
          </div>
          <div className="text-xs text-ink-faint">{kpis.wonCount} gagnés sur {kpis.totalLeadsCount} deals</div>
        </div>

        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-2 hover:border-[#D4C4A8]/40 transition-colors">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#D4C4A8]">
            Valeur moyenne
          </div>
          <div className="text-4xl font-extrabold text-[#f2ede4] tracking-tight tabular-nums">
            {kpis.averageDealSize.toLocaleString()} <span className="text-xl font-normal text-ink-soft">€</span>
          </div>
          <div className="text-xs text-ink-faint">Valeur moyenne des leads</div>
        </div>

        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-2 hover:border-[#D4C4A8]/40 transition-colors">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#D4C4A8]">
            Pipeline actif
          </div>
          <div className="text-4xl font-extrabold text-[#f2ede4] tracking-tight tabular-nums">
            {kpis.activeVal.toLocaleString()} <span className="text-xl font-normal text-ink-soft">€</span>
          </div>
          <div className="text-xs text-ink-faint">{kpis.activeCount} leads en cours</div>
        </div>
      </div>

      {/* Main Evolution Chart */}
      <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#f2ede4]">Évolution du CA Gagné & Nouveaux Leads</h3>
        <div className="h-72 w-full">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4C4A8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#D4C4A8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
                <YAxis stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141414', borderColor: '#333', color: '#fff' }}
                />
                <Area type="monotone" dataKey="ca" stroke="#D4C4A8" fillOpacity={1} fill="url(#colorCa)" name="CA Gagné (€)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-soft">
              Aucune donnée d'évolution disponible sur cette période.
            </div>
          )}
        </div>
      </div>

      {/* Grid: Funnel & Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
          <h3 className="text-lg font-bold text-[#f2ede4]">Entonnoir de Conversion</h3>
          <div className="space-y-3 pt-2">
            {funnelStages.map((f) => {
              const pct = Math.round((f.count / maxFunnelCount) * 100);
              return (
                <div key={f.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-[#f2ede4]">
                    <span>{f.name}</span>
                    <span className="font-mono text-[#D4C4A8]">{f.count} deal(s) · {f.value} €</span>
                  </div>
                  <div className="h-2.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: f.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sources Pie Chart */}
        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
          <h3 className="text-lg font-bold text-[#f2ede4]">Sources d'Acquisition</h3>
          <div className="h-56 w-full flex items-center justify-center">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                  >
                    {sourceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#141414', borderColor: '#333' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-ink-soft">Aucune source répertoriée.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
