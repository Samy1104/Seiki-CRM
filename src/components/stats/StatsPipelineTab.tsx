import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { Lead } from '../../services/leadsService';
import type { PipelineStage } from '../../services/settingsService';

interface StatsPipelineTabProps {
  leads: Lead[];
  stages: PipelineStage[];
}

const LOSS_COLORS = ['#ef4444', '#f97316', '#eab308', '#a855f7', '#64748b'];

export const StatsPipelineTab: React.FC<StatsPipelineTabProps> = ({ leads, stages }) => {
  // Forecast per stage
  const forecastData = useMemo(() => {
    return stages.map((st) => {
      const stageLeads = leads.filter((l) => l.stage_id === st.id && !l.stage?.is_closed_won && !l.is_archived);
      const rawVal = stageLeads.reduce((acc, l) => acc + (l.deal_value || 0), 0);
      const prob = (st as any).win_probability ?? (st as any).probability ?? 50;
      const weightedVal = Math.round((rawVal * prob) / 100);
      return {
        name: st.name,
        'Valeur Brute (€)': rawVal,
        'Valeur Pondérée (€)': weightedVal,
      };
    });
  }, [stages, leads]);

  const totalRawPipeline = useMemo(
    () => forecastData.reduce((acc, d) => acc + d['Valeur Brute (€)'], 0),
    [forecastData]
  );
  const totalWeightedForecast = useMemo(
    () => forecastData.reduce((acc, d) => acc + d['Valeur Pondérée (€)'], 0),
    [forecastData]
  );

  // Loss reasons breakdown
  const lossData = useMemo(() => {
    const lostLeads = leads.filter((l) => l.is_archived || (l.stage as any)?.is_closed_lost);
    const map: Record<string, number> = {};
    lostLeads.forEach((l) => {
      const reason = (l as any).loss_reason || (l as any).lost_reason || 'Motif inconnu';
      map[reason] = (map[reason] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [leads]);

  return (
    <div className="space-y-8 font-ui">
      {/* Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-1 hover:border-[#D4C4A8]/40 transition-colors">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#D4C4A8]">Pipeline Brut</div>
          <div className="text-3xl font-extrabold text-[#f2ede4] tracking-tight tabular-nums">
            {totalRawPipeline.toLocaleString()} €
          </div>
          <div className="text-xs text-ink-soft">Valeur totale des affaires en cours</div>
        </div>

        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-1 border-l-4 border-l-[#D4C4A8] hover:border-[#D4C4A8]/40 transition-colors">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#D4C4A8]">Forecast Pondéré</div>
          <div className="text-3xl font-extrabold text-[#D4C4A8] tracking-tight tabular-nums">
            {totalWeightedForecast.toLocaleString()} €
          </div>
          <div className="text-xs text-ink-soft">Valeur estimée selon probabilités</div>
        </div>

        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-1 hover:border-[#D4C4A8]/40 transition-colors">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#D4C4A8]">Motifs de Perte</div>
          <div className="text-3xl font-extrabold text-[#f2ede4] tracking-tight tabular-nums">
            {leads.filter((l) => l.is_archived || (l.stage as any)?.is_closed_lost).length}
          </div>
          <div className="text-xs text-ink-soft">Deals perdus sur la période</div>
        </div>
      </div>

      {/* Forecast Bar Chart */}
      <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#f2ede4]">Prévisions de Ventes (Forecast) par Étape</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={forecastData}>
              <XAxis dataKey="name" stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
              <YAxis stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#141414', borderColor: '#333', color: '#fff' }} />
              <Legend />
              <Bar dataKey="Valeur Brute (€)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Valeur Pondérée (€)" fill="#D4C4A8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Loss Analysis */}
      <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#f2ede4]">Analyse des Motifs de Perte</h3>
        <div className="h-60 w-full flex items-center justify-center">
          {lossData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={lossData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, value }: { name?: string; value?: number }) =>
                    `${name ?? ''}: ${value ?? 0}`
                  }
                >
                  {lossData.map((_, index) => (
                    <Cell key={`loss-${index}`} fill={LOSS_COLORS[index % LOSS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#141414', borderColor: '#333', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-xs text-ink-soft">Aucun deal perdu enregistré sur cette période.</div>
          )}
        </div>
      </div>
    </div>
  );
};
