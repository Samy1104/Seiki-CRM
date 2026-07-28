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
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
    expect(screen.getByText('7 derniers jours')).toBeInTheDocument();
    expect(screen.getByText('Ce trimestre')).toBeInTheDocument();
    expect(screen.getByText('Année en cours')).toBeInTheDocument();
    expect(screen.getByText('Tout')).toBeInTheDocument();

    fireEvent.click(screen.getByText('7 derniers jours'));
    expect(onFilterChange).toHaveBeenCalledWith({ preset: '7d' });
  });

  it('opens custom modal, submits dates, and triggers onFilterChange with custom range', () => {
    const onFilterChange = vi.fn();
    render(<StatsDateFilter {...defaultProps} onFilterChange={onFilterChange} />);

    // Click on Personnalisé button
    const customButton = screen.getByText('Personnalisé');
    fireEvent.click(customButton);

    // Modal should appear
    expect(screen.getByText('Sélectionner une période')).toBeInTheDocument();

    const startInput = screen.getByLabelText('Date de début');
    const endInput = screen.getByLabelText('Date de fin');

    fireEvent.change(startInput, { target: { value: '2026-01-01' } });
    fireEvent.change(endInput, { target: { value: '2026-01-31' } });

    fireEvent.click(screen.getByText('Appliquer'));

    expect(onFilterChange).toHaveBeenCalledWith({
      preset: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
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
