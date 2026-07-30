import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CohortHeatmap } from './CohortHeatmap';

const stages = [
  { id: 's1', name: 'Prospect', position: 1, color: '#fff', is_closed_won: false, is_active: true },
  { id: 's2', name: 'Démo', position: 2, color: '#0af', is_closed_won: false, is_active: true },
] as any;

const leads = [
  { id: 'l1', company_name: 'Acme', created_at: '2026-05-03T00:00:00.000Z', is_disqualified: false } as any,
  { id: 'l2', company_name: 'Beta', created_at: '2026-05-20T00:00:00.000Z', is_disqualified: false } as any,
];

const stageHistory = [
  { lead_id: 'l1', to_stage_id: 's1', changed_at: '2026-05-03T00:00:00.000Z' } as any,
  { lead_id: 'l1', to_stage_id: 's2', changed_at: '2026-05-10T00:00:00.000Z' } as any,
];

describe('CohortHeatmap', () => {
  it('renders one row per cohort month with the lead count', () => {
    render(<CohortHeatmap leads={leads} stageHistory={stageHistory} stages={stages} deployedAtIso="2026-01-01T00:00:00.000Z" />);
    expect(screen.getByText(/Mai 2026/)).toBeInTheDocument();
    expect(screen.getByText(/2 leads/)).toBeInTheDocument();
  });

  it('marks a cohort month before the deploy date as partial history', () => {
    render(<CohortHeatmap leads={leads} stageHistory={stageHistory} stages={stages} deployedAtIso="2026-06-01T00:00:00.000Z" />);
    expect(screen.getByText('Historique partiel')).toBeInTheDocument();
  });

  it('opens the drawer with the reaching leads when a cell is clicked', () => {
    render(<CohortHeatmap leads={leads} stageHistory={stageHistory} stages={stages} deployedAtIso="2026-01-01T00:00:00.000Z" />);
    fireEvent.click(screen.getAllByText('50%')[1]);
    expect(screen.getByText(/ayant atteint l'étape Démo/)).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });
});
