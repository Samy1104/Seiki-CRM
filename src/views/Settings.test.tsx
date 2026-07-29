import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Settings } from './Settings';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/settingsService', () => ({
  settingsService: {
    getTeamMembers: vi.fn().mockResolvedValue([]),
    getPipelineStages: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue([]),
  },
}));

describe('Settings View', () => {
  it('renders page header and navigation tabs', async () => {
    render(
      <ToastProvider>
        <Settings />
      </ToastProvider>
    );
    expect(await screen.findByText('Paramètres')).toBeDefined();
    expect(screen.getAllByText("Membres de l'équipe").length).toBeGreaterThan(0);
    expect(screen.getByText('Étapes du Pipeline')).toBeDefined();
  });

  it('supports pipeline stage editing state', async () => {
    const mockStages = [
      { id: 'stg_1', name: 'Négociation', position: 1, color: '#6B5FE6', is_closed_won: false, is_active: true }
    ];

    const { settingsService } = await import('../services/settingsService');
    vi.mocked(settingsService.getPipelineStages).mockResolvedValueOnce(mockStages);

    render(
      <ToastProvider>
        <Settings />
      </ToastProvider>
    );

    const pipelineTab = screen.getByText('Étapes du Pipeline');
    pipelineTab.click();

    expect(await screen.findByText('Négociation')).toBeDefined();
    const editBtn = screen.getByTitle("Modifier l'étape");
    expect(editBtn).toBeDefined();
  });

  it('displays lost stage checkbox and badge in pipeline tab', async () => {
    const mockStages = [
      { id: 'stg_lost', name: 'Perdu / Abandonné', position: 1, color: '#EF4444', is_closed_won: false, is_closed_lost: true, is_active: true }
    ];

    const { settingsService } = await import('../services/settingsService');
    vi.mocked(settingsService.getPipelineStages).mockResolvedValueOnce(mockStages);

    render(
      <ToastProvider>
        <Settings />
      </ToastProvider>
    );

    const pipelineTab = screen.getByText('Étapes du Pipeline');
    pipelineTab.click();

    expect(await screen.findByText('Perdu / Abandonné')).toBeDefined();
    expect(screen.getByText('Perdu')).toBeDefined();
    expect(screen.getByText('Marquer comme étape de perte (Lead perdu & archivé)')).toBeDefined();
  });
});

