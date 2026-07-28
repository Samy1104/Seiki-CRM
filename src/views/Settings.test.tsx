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
    expect(screen.getByText("Membres de l'équipe")).toBeDefined();
    expect(screen.getByText('Étapes du Pipeline')).toBeDefined();
  });
});
