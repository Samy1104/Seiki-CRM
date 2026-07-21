import React from 'react';
import { KpiTile } from '../../components/ui/KpiTile';
import type { Lead } from '../../services/leadsService';
import type { Task } from '../../services/tasksService';

interface CodirKpiGridProps {
  totalVal: number;
  wonVal: number;
  leads: Lead[];
  wonLeads: Lead[];
  hotDeals: Lead[];
  pendingTasks: Task[];
  overdueTasks: Task[];
  slaBreaches: Lead[];
}

export const CodirKpiGrid: React.FC<CodirKpiGridProps> = ({
  totalVal,
  wonVal,
  leads,
  wonLeads,
  hotDeals,
  pendingTasks,
  overdueTasks,
  slaBreaches,
}) => {
  return (
    <div className="codir-kpi-grid mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiTile
        className="codir-kpi"
        label="Pipeline total"
        value={totalVal}
        formatValue={(v) => `${Math.round(v)}k€`}
        sub={`${leads.length} opportunités`}
        accent="neutral"
      />
      <KpiTile
        className="codir-kpi"
        label="Closés Gagnés"
        value={wonVal}
        formatValue={(v) => `${Math.round(v)}k€`}
        sub={`${wonLeads.length} deals signés`}
        accent="success"
      />
      <KpiTile
        className="codir-kpi"
        label="Deals Chauds"
        value={hotDeals.length}
        sub="ICP score ≥ 80"
        accent="amber"
      />
      <KpiTile
        className="codir-kpi"
        label="Tâches en cours"
        value={pendingTasks.length}
        sub={`${overdueTasks.length} en retard`}
        accent={overdueTasks.length > 0 ? 'danger' : 'neutral'}
      />
      <KpiTile
        className="codir-kpi"
        label="Alertes SLA"
        value={slaBreaches.length}
        sub="Retards critiques"
        accent={slaBreaches.length > 0 ? 'danger' : 'neutral'}
      />
    </div>
  );
};
