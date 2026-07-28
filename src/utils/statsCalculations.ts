import { Lead } from '../services/leadsService';

export interface DateFilterState {
  preset: 'today' | '7d' | 'month' | 'quarter' | 'year' | 'all' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface KpiMetrics {
  totalWonVal: number;
  wonCount: number;
  totalLeadsCount: number;
  winRate: number;
  averageDealSize: number;
  activeVal: number;
  activeCount: number;
  wonValDeltaPct?: number;
}

export function filterLeadsByDateAndRep(
  leads: Lead[],
  filter: DateFilterState,
  repId?: string
): Lead[] {
  let result = leads;
  if (repId && repId !== 'all') {
    result = result.filter((l) => (l as any).assigned_to === repId || (l as any).owner_id === repId);
  }

  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;

  if (filter.preset === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (filter.preset === '7d') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (filter.preset === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (filter.preset === 'quarter') {
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), qMonth, 1);
  } else if (filter.preset === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (filter.preset === 'custom' && filter.startDate && filter.endDate) {
    start = new Date(filter.startDate);
    end = new Date(filter.endDate);
    end.setHours(23, 59, 59, 999);
  }

  if (start) {
    result = result.filter((l) => new Date(l.created_at) >= start!);
  }
  if (end) {
    result = result.filter((l) => new Date(l.created_at) <= end!);
  }

  return result;
}

export function computeKpiMetrics(currentLeads: Lead[], previousLeads: Lead[] = []): KpiMetrics {
  const totalLeadsCount = currentLeads.length;
  const wonLeads = currentLeads.filter((l) => l.stage?.is_closed_won);
  const activeLeads = currentLeads.filter((l) => !l.is_archived && !l.stage?.is_closed_won);

  const totalWonVal = wonLeads.reduce((acc, l) => acc + (l.deal_value || 0), 0);
  const activeVal = activeLeads.reduce((acc, l) => acc + (l.deal_value || 0), 0);
  const wonCount = wonLeads.length;
  const activeCount = activeLeads.length;

  const winRate = totalLeadsCount ? Math.round((wonCount / totalLeadsCount) * 100) : 0;
  const averageDealSize = wonCount ? Math.round(totalWonVal / wonCount) : 0;

  let wonValDeltaPct: number | undefined = undefined;
  if (previousLeads.length > 0) {
    const prevWonVal = previousLeads
      .filter((l) => l.stage?.is_closed_won)
      .reduce((acc, l) => acc + (l.deal_value || 0), 0);
    if (prevWonVal > 0) {
      wonValDeltaPct = Math.round(((totalWonVal - prevWonVal) / prevWonVal) * 100);
    }
  }

  return {
    totalWonVal,
    wonCount,
    totalLeadsCount,
    winRate,
    averageDealSize,
    activeVal,
    activeCount,
    wonValDeltaPct,
  };
}

export function generateStatsCsv(leads: Lead[]): string {
  const headers = ['ID', 'Nom/Entreprise', 'Valeur (€)', 'Étape', 'Gagné', 'Date Création'];
  const rows = leads.map((l) => [
    l.id,
    `"${(l.company_name || l.contact_name || '').replace(/"/g, '""')}"`,
    l.deal_value || 0,
    `"${(l.stage?.name || '').replace(/"/g, '""')}"`,
    l.stage?.is_closed_won ? 'Oui' : 'Non',
    l.created_at,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
