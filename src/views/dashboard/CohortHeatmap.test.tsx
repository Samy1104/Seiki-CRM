import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CohortHeatmap } from './CohortHeatmap';

const stages = [
  { id: 's1', name: 'Prospect', position: 1, color: '#fff', is_closed_won: false, is_active: true },
  { id: 's2', name: 'Qualification', position: 2, color: '#0af', is_closed_won: false, is_active: true },
  { id: 's3', name: 'Proposition', position: 3, color: '#0fa', is_closed_won: false, is_active: true },
];

const leads = [
  { id: 'l1', company_name: 'Acme', created_at: '2026-05-03T00:00:00.000Z', is_disqualified: false, stage_id: 's2' },
  { id: 'l2', company_name: 'Beta', created_at: '2026-05-20T00:00:00.000Z', is_disqualified: false, stage_id: 's1' },
];

const stageHistory = [
  { lead_id: 'l1', from_stage_id: 's1', to_stage_id: 's2', changed_at: '2026-05-10T00:00:00.000Z' },
];

describe('CohortHeatmap', () => {
  it('renders header controls with default values', () => {
    render(<CohortHeatmap leads={leads as any} stageHistory={stageHistory as any} stages={stages as any} deployedAtIso="2026-01-01T00:00:00.000Z" />);

    expect(screen.getByLabelText(/Cohortes \(Y\)/i)).toHaveValue('month');
    expect(screen.getByLabelText(/Intervalles \(X\)/i)).toHaveValue('week');
    expect(screen.getByLabelText(/Nombre de périodes/i)).toHaveValue('8');
    expect(screen.getByLabelText(/Statut Cible/i)).toHaveValue('s2'); // Default to Qualification
  });

  it('renders matrix with direct percentage display and beige background shading', () => {
    render(<CohortHeatmap leads={leads as any} stageHistory={stageHistory as any} stages={stages as any} deployedAtIso="2026-01-01T00:00:00.000Z" />);

    // Cohort row label
    expect(screen.getByText(/05\/2026/)).toBeInTheDocument();

    // Check cells display direct percentage text
    expect(screen.getAllByText('50.0%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 / 2').length).toBeGreaterThan(0);

    // Check button dynamic background style containing beige rgba
    const cellButtons = screen.getAllByRole('button', { name: /50\.0%/i });
    expect(cellButtons[0].getAttribute('style')).toContain('rgba(212, 196, 168');
  });

  it('updates target stage and period count when controls change', () => {
    render(<CohortHeatmap leads={leads as any} stageHistory={stageHistory as any} stages={stages as any} deployedAtIso="2026-01-01T00:00:00.000Z" />);

    // Change target stage to Prospect (s1)
    const stageSelect = screen.getByLabelText(/Statut Cible/i);
    fireEvent.change(stageSelect, { target: { value: 's1' } });
    expect(stageSelect).toHaveValue('s1');

    // Change period count to 4
    const periodSelect = screen.getByLabelText(/Nombre de périodes/i);
    fireEvent.change(periodSelect, { target: { value: '4' } });

    // Verify interval header S+4 exists but S+5 does not
    expect(screen.getByText('S+4')).toBeInTheDocument();
    expect(screen.queryByText('S+5')).not.toBeInTheDocument();
  });

  it('opens drawer with lead details on cell click', () => {
    render(<CohortHeatmap leads={leads as any} stageHistory={stageHistory as any} stages={stages as any} deployedAtIso="2026-01-01T00:00:00.000Z" />);

    const cellButtons = screen.getAllByRole('button', { name: /50\.0%/i });
    fireEvent.click(cellButtons[0]);

    // Drawer should open and display Acme lead
    expect(screen.getByText(/Acme/i)).toBeInTheDocument();
  });
});
