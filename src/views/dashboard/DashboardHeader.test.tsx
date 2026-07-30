import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardHeader } from './DashboardHeader';

const baseProps = {
  preset: 'since_last_codir' as const,
  setPreset: vi.fn(),
  customRange: { start: '2026-07-01', end: '2026-07-30' },
  setCustomRange: vi.fn(),
  codirMeetings: [{ id: 'm1', meeting_date: '2026-07-15T00:00:00.000Z', label: null }],
  onValidateCodir: vi.fn().mockResolvedValue(undefined),
  onExportCsv: vi.fn(),
};

describe('DashboardHeader', () => {
  it('renders the preset selector with the current preset selected', () => {
    render(<DashboardHeader {...baseProps} />);
    expect(screen.getByDisplayValue('Depuis le dernier CODIR')).toBeInTheDocument();
  });

  it('calls setPreset when a different preset is chosen', () => {
    render(<DashboardHeader {...baseProps} />);
    fireEvent.change(screen.getByLabelText('Période'), { target: { value: 'month' } });
    expect(baseProps.setPreset).toHaveBeenCalledWith('month');
  });

  it('shows custom date inputs only when the custom preset is active', () => {
    const { rerender } = render(<DashboardHeader {...baseProps} />);
    expect(screen.queryByLabelText('Début')).not.toBeInTheDocument();
    rerender(<DashboardHeader {...baseProps} preset="custom" />);
    expect(screen.getByLabelText('Début')).toBeInTheDocument();
  });

  it('opens a confirmation modal and calls onValidateCodir when confirmed', async () => {
    render(<DashboardHeader {...baseProps} />);
    fireEvent.click(screen.getByText('Valider le CODIR du jour'));
    expect(screen.getByText(/Confirmer l'enregistrement/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirmer'));
    expect(baseProps.onValidateCodir).toHaveBeenCalled();
  });

  it('calls onExportCsv when the export button is clicked', () => {
    render(<DashboardHeader {...baseProps} />);
    fireEvent.click(screen.getByText('Exporter CSV'));
    expect(baseProps.onExportCsv).toHaveBeenCalled();
  });
});
