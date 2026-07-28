import { describe, it, expect } from 'vitest';
import { filterLeadsByDateAndRep, computeKpiMetrics, generateStatsCsv } from './statsCalculations';
import type { Lead } from '../services/leadsService';

describe('statsCalculations', () => {
  const mockLeads: Partial<Lead>[] = [
    {
      id: '1',
      deal_value: 10000,
      created_at: '2026-07-01T10:00:00Z',
      owner_id: 'rep-1',
      is_archived: false,
      company_name: 'Acme Corp',
      stage: { id: 's1', name: 'Gagné', is_closed_won: true, is_closed_lost: false } as any,
    },
    {
      id: '2',
      deal_value: 5000,
      created_at: '2026-07-15T10:00:00Z',
      owner_id: 'rep-2',
      is_archived: false,
      company_name: 'Globex',
      stage: { id: 's2', name: 'Négociation', is_closed_won: false, is_closed_lost: false } as any,
    },
  ];

  it('calculates KPI metrics correctly', () => {
    const kpis = computeKpiMetrics(mockLeads as Lead[], []);
    expect(kpis.totalWonVal).toBe(10000);
    expect(kpis.totalLeadsCount).toBe(2);
    expect(kpis.winRate).toBe(50);
    expect(kpis.averageDealSize).toBe(10000);
    expect(kpis.activeVal).toBe(5000);
    expect(kpis.activeCount).toBe(1);
  });

  it('filters leads by date and rep correctly', () => {
    const filteredByRep = filterLeadsByDateAndRep(mockLeads as Lead[], { preset: 'all' }, 'rep-1');
    expect(filteredByRep.length).toBe(1);
    expect(filteredByRep[0].id).toBe('1');
  });

  it('generates CSV string correctly', () => {
    const csv = generateStatsCsv(mockLeads as Lead[]);
    expect(csv).toContain('ID,Nom/Entreprise,Valeur (€),Étape,Gagné,Date Création');
    expect(csv).toContain('Acme Corp');
    expect(csv).toContain('10000');
  });
});
