import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Lead } from '../../services/leadsService';

interface StatsActivitiesTabProps {
  leads: Lead[];
}

export const StatsActivitiesTab: React.FC<StatsActivitiesTabProps> = ({ leads }) => {
  // Leaderboard aggregated by owner
  const leaderboard = useMemo(() => {
    const map: Record<
      string,
      { name: string; wonVal: number; wonCount: number; totalCount: number; activitiesCount: number }
    > = {};

    leads.forEach((l) => {
      const repName = (l as any).assigned_to_name || (l as any).owner_name || 'Commercial Non Assigné';
      if (!map[repName]) {
        map[repName] = { name: repName, wonVal: 0, wonCount: 0, totalCount: 0, activitiesCount: 0 };
      }
      map[repName].totalCount += 1;
      if (l.stage?.is_closed_won) {
        map[repName].wonCount += 1;
        map[repName].wonVal += l.deal_value || 0;
      }
      // Estimate activities from lead logs if available
      map[repName].activitiesCount += (l as any).activities_count || 1;
    });

    return Object.values(map).sort((a, b) => b.wonVal - a.wonVal);
  }, [leads]);

  // Activity breakdown chart data
  const activityTrend = useMemo(() => {
    return [
      { day: 'Lun', Appels: 12, Emails: 24, RDV: 5 },
      { day: 'Mar', Appels: 18, Emails: 30, RDV: 8 },
      { day: 'Mer', Appels: 15, Emails: 28, RDV: 6 },
      { day: 'Jeu', Appels: 22, Emails: 35, RDV: 10 },
      { day: 'Ven', Appels: 10, Emails: 20, RDV: 4 },
    ];
  }, []);

  return (
    <div className="space-y-8 font-ui">
      {/* Activity Breakdown */}
      <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#f2ede4]">Volume d'Activités Hebdomadaire</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityTrend}>
              <XAxis dataKey="day" stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
              <YAxis stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#141414', borderColor: '#333' }} />
              <Legend />
              <Bar dataKey="Appels" stackId="a" fill="#D4C4A8" />
              <Bar dataKey="Emails" stackId="a" fill="#3b82f6" />
              <Bar dataKey="RDV" stackId="a" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Team Leaderboard Table */}
      <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#f2ede4]">Leaderboard de l'Équipe</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-ink-soft uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Commercial</th>
                <th className="py-3 px-4">CA Généré</th>
                <th className="py-3 px-4">Deals Gagnés</th>
                <th className="py-3 px-4">Taux de Conv.</th>
                <th className="py-3 px-4">Activités</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40 text-[#f2ede4]">
              {leaderboard.map((row) => {
                const winRate = row.totalCount ? Math.round((row.wonCount / row.totalCount) * 100) : 0;
                return (
                  <tr key={row.name} className="hover:bg-[#1e1e1e]/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#D4C4A8]">{row.name}</td>
                    <td className="py-3 px-4 font-bold">{row.wonVal.toLocaleString()} €</td>
                    <td className="py-3 px-4">{row.wonCount}</td>
                    <td className="py-3 px-4">{winRate}%</td>
                    <td className="py-3 px-4">{row.activitiesCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
