import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from './Dashboard';

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('../services/leadsService', () => ({
  leadsService: {
    getLeads: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/settingsService', () => ({
  settingsService: {
    getPipelineStages: vi.fn().mockResolvedValue([]),
    getTeamMembers: vi.fn().mockResolvedValue([]),
    getDashboardTargets: vi.fn().mockResolvedValue({
      target_ca: 100,
      target_leads_count: 20,
      target_win_rate: 20,
      target_prospection_positive: 10,
    }),
    getCodirHistory: vi.fn().mockResolvedValue([]),
    getSlaLimits: vi.fn().mockResolvedValue({ Media: 7, Retail: 5, Instit: 10 }),
  },
}));

vi.mock('../services/tasksService', () => ({
  tasksService: {
    getTasks: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/prospectionService', () => ({
  prospectionService: {
    getRecentEmailLogs: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/pipelineHistoryService', () => ({
  pipelineHistoryService: {
    getStageHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [] }),
      }),
    }),
  },
}));

describe('Dashboard View', () => {
  it('renders dashboard tabs after loading', async () => {
    render(<Dashboard />);
    expect(await screen.findByText('Objectifs & CODIR')).toBeInTheDocument();
    expect(screen.getByText('Pipeline & Conversions')).toBeInTheDocument();
    expect(screen.getByText('Prospection & Emails')).toBeInTheDocument();
    expect(screen.getByText('Tâches par Membre')).toBeInTheDocument();
  });
});
