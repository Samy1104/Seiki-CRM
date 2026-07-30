import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardCodirTab } from './DashboardCodirTab';

describe('DashboardCodirTab', () => {
  it('shows a Vélocité card computed from stageHistory and wonStageId', () => {
    render(
      <DashboardCodirTab
        leadsA={[{ id: 'l1', created_at: '2026-07-01T00:00:00.000Z', stage_id: 'won', stage_changed_at: '2026-07-06T00:00:00.000Z', deal_value: 0 } as any]}
        leadsB={[]}
        targets={{ target_ca: 100, target_leads_count: 20, target_win_rate: 20, target_prospection_positive: 10 }}
        historyA={[]}
        historyB={[]}
        stageHistory={[]}
        wonStageId="won"
      />
    );
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('jours')).toBeInTheDocument();
  });
});
