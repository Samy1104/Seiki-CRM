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

    expect(screen.getByLabelText(/Cohortes \(Y\)/i)).toHaveTextContent('Mois');
    expect(screen.getByLabelText(/Intervalles \(X\)/i)).toHaveTextContent('Semaines');
    expect(screen.getByLabelText(/Nombre de périodes/i)).toHaveTextContent('8');
    expect(screen.getByLabelText(/Statut Cible/i)).toHaveTextContent('Qualification'); // Default to Qualification
  });

  it('renders matrix with direct percentage display and beige background shading', () => {
    render(<CohortHeatmap leads={leads as any} stageHistory={stageHistory as any} stages={stages as any} deployedAtIso="2026-01-01T00:00:00.000Z" />);

    // Cohort row label
    expect(screen.getByText(/Mai 2026/)).toBeInTheDocument();

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
    const stageTrigger = screen.getByLabelText(/Statut Cible/i);
    fireEvent.click(stageTrigger);
    fireEvent.click(screen.getByText('Prospect'));
    expect(stageTrigger).toHaveTextContent('Prospect');

    // Change period count to 4
    const periodTrigger = screen.getByLabelText(/Nombre de périodes/i);
    fireEvent.click(periodTrigger);
    fireEvent.click(screen.getByText('4'));

    // Verify interval header 22/05 (4th week) exists but 29/05 (5th week) does not
    expect(screen.getAllByText('22/05').length).toBeGreaterThan(0);
    expect(screen.queryByText('29/05')).not.toBeInTheDocument();
  });

  it('opens drawer with lead details on cell click', () => {
    render(<CohortHeatmap leads={leads as any} stageHistory={stageHistory as any} stages={stages as any} deployedAtIso="2026-01-01T00:00:00.000Z" />);

    const cellButtons = screen.getAllByRole('button', { name: /50\.0%/i });
    fireEvent.click(cellButtons[0]);

    // Drawer should open and display Acme lead
    expect(screen.getByText(/Acme/i)).toBeInTheDocument();
  });

  it('displays partial history badge for cohorts prior to deployedAtIso', () => {
    render(<CohortHeatmap leads={leads as any} stageHistory={stageHistory as any} stages={stages as any} deployedAtIso="2026-06-01T00:00:00.000Z" />);

    expect(screen.getByText('Historique partiel')).toBeInTheDocument();
  });
});
