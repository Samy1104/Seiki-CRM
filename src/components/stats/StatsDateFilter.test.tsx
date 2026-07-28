import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StatsDateFilter } from './StatsDateFilter';

describe('StatsDateFilter', () => {
  const defaultProps = {
    filter: { preset: 'month' as const },
    onFilterChange: vi.fn(),
    salesReps: [
      { id: 'rep-1', name: 'Alice' },
      { id: 'rep-2', name: 'Bob' },
    ],
    selectedRep: 'all',
    onRepChange: vi.fn(),
    onExportCsv: vi.fn(),
  };

  it('renders presets and triggers filter change when preset clicked', () => {
    const onFilterChange = vi.fn();
    render(<StatsDateFilter {...defaultProps} onFilterChange={onFilterChange} />);

    expect(screen.getByText('Ce mois')).toBeInTheDocument();
    expect(screen.getByText('7 derniers jours')).toBeInTheDocument();
    expect(screen.getByText('Ce trimestre')).toBeInTheDocument();
    expect(screen.getByText('Année en cours')).toBeInTheDocument();
    expect(screen.getByText('Tout')).toBeInTheDocument();

    fireEvent.click(screen.getByText('7 derniers jours'));
    expect(onFilterChange).toHaveBeenCalledWith({ preset: '7d' });
  });

  it('opens custom modal, selects dates via calendar modal, and triggers onFilterChange with custom range', () => {
    const onFilterChange = vi.fn();
    render(<StatsDateFilter {...defaultProps} onFilterChange={onFilterChange} />);

    // Click on Personnalisé button
    const customButton = screen.getByText('Personnalisé');
    fireEvent.click(customButton);

    // Modal should appear
    expect(screen.getByText('Sélectionner une période')).toBeInTheDocument();

    const startButton = screen.getByLabelText('Date de début');
    const endButton = screen.getByLabelText('Date de fin');

    fireEvent.click(startButton);
    // Calendar modal for start date should open
    const day15 = screen.getAllByText('15')[0];
    fireEvent.click(day15);

    fireEvent.click(endButton);
    // Calendar modal for end date should open
    const day20 = screen.getAllByText('20')[0];
    fireEvent.click(day20);

    fireEvent.click(screen.getByText('Appliquer'));

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'custom',
      })
    );
  });

  it('handles sales rep select change', () => {
    const onRepChange = vi.fn();
    render(<StatsDateFilter {...defaultProps} onRepChange={onRepChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'rep-1' } });

    expect(onRepChange).toHaveBeenCalledWith('rep-1');
  });

  it('handles export CSV button click', () => {
    const onExportCsv = vi.fn();
    render(<StatsDateFilter {...defaultProps} onExportCsv={onExportCsv} />);

    const exportBtn = screen.getByText('Exporter (.csv)');
    fireEvent.click(exportBtn);

    expect(onExportCsv).toHaveBeenCalled();
  });
});
