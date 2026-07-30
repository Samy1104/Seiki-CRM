import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardPipelineTab } from './DashboardPipelineTab';

const stages = [
  { id: 's1', name: 'Prospect', position: 1, color: '#fff', is_closed_won: false, is_active: true },
  { id: 's2', name: 'Gagné', position: 2, color: '#0f0', is_closed_won: true, is_active: true },
] as any;

const leadsA = [
  { id: 'l1', stage_id: 's1', deal_value: 100, segment: 'Media', source: 'LinkedIn', days_in_stage: 2, is_archived: false } as any,
  { id: 'l2', stage_id: 's2', deal_value: 200, segment: 'Retail', source: 'Inbound', days_in_stage: 1, is_archived: false } as any,
];

describe('DashboardPipelineTab', () => {
  it('toggles between Volume and Valeur display for the funnel', () => {
    render(
      <DashboardPipelineTab leadsA={leadsA} leadsB={[]} stages={stages} historyA={[]} historyB={[]} stageHistory={[]} comparisonEndDate="2026-07-01T00:00:00.000Z" deployedAtIso="2026-01-01T00:00:00.000Z" />
    );
    expect(screen.getAllByText('1 leads (50%)')[0]).toBeInTheDocument();
    fireEvent.click(screen.getByText('Valeur'));
    expect(screen.getAllByText('100 €')[0]).toBeInTheDocument();
  });

  it('hides closed stages when the checkbox is checked', () => {
    render(
      <DashboardPipelineTab leadsA={leadsA} leadsB={[]} stages={stages} historyA={[]} historyB={[]} stageHistory={[]} comparisonEndDate="2026-07-01T00:00:00.000Z" deployedAtIso="2026-01-01T00:00:00.000Z" />
    );
    expect(screen.getByRole('button', { name: /Gagné/ })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Masquer les deals fermés'));
    expect(screen.queryByRole('button', { name: /Gagné/ })).not.toBeInTheDocument();
  });

  it('opens the drill-down drawer when a stage bar is clicked', () => {
    render(
      <DashboardPipelineTab leadsA={leadsA} leadsB={[]} stages={stages} historyA={[]} historyB={[]} stageHistory={[]} comparisonEndDate="2026-07-01T00:00:00.000Z" deployedAtIso="2026-01-01T00:00:00.000Z" />
    );
    fireEvent.click(screen.getByRole('button', { name: /Prospect/ }));
    expect(screen.getByText(/Leads en étape Prospect/)).toBeInTheDocument();
  });
});
