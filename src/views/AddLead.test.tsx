import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { AddLead } from './AddLead';
import { settingsService } from '../services/settingsService';
import { leadsService } from '../services/leadsService';

vi.mock('../services/settingsService', () => ({
  settingsService: {
    getPipelineStages: vi.fn(),
  },
}));

vi.mock('../services/leadsService', () => ({
  leadsService: {
    createLead: vi.fn(),
  },
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

const mockStages = [
  { id: 'stage-1', name: 'Prospect', position: 0, color: 'blue', is_closed_won: false, is_active: true },
  { id: 'stage-2', name: 'Qualification', position: 1, color: 'green', is_closed_won: false, is_active: true },
];

describe('AddLead View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsService.getPipelineStages).mockResolvedValue(mockStages);
  });

  it('renders lead form and fetches pipeline stages', async () => {
    render(<AddLead setView={vi.fn()} />);

    expect(screen.getByText('Ajouter un lead')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ex : LVMH')).toBeInTheDocument();

    await waitFor(() => {
      expect(settingsService.getPipelineStages).toHaveBeenCalled();
    });
  });

  it('allows filling the form and selecting custom Select values', async () => {
    const setViewMock = vi.fn();
    render(<AddLead setView={setViewMock} />);

    await waitFor(() => {
      expect(settingsService.getPipelineStages).toHaveBeenCalled();
    });

    // Fill Company Name
    const input = screen.getByPlaceholderText('ex : LVMH');
    fireEvent.change(input, { target: { value: 'Acme Corp' } });

    // Select Segment -> Media
    const segmentField = screen.getByText('Segment *').closest('.form-field') as HTMLElement;
    const segmentTrigger = within(segmentField).getByRole('button');
    fireEvent.click(segmentTrigger);
    const mediaOption = screen.getByText('Media');
    fireEvent.click(mediaOption);

    // Verify Segment is selected
    expect(segmentTrigger).toHaveTextContent('Media');

    // Select Source -> Événement
    const sourceField = screen.getByText('Source').closest('.form-field') as HTMLElement;
    const sourceTrigger = within(sourceField).getByRole('button');
    fireEvent.click(sourceTrigger);
    const eventOption = screen.getByText('Événement');
    fireEvent.click(eventOption);

    // Verify Source is selected
    expect(sourceTrigger).toHaveTextContent('Événement');
  });

  it('updates scores and recommendation when criteria dropdown changes', async () => {
    render(<AddLead setView={vi.fn()} />);

    // Wait for stages to load
    await waitFor(() => {
      expect(settingsService.getPipelineStages).toHaveBeenCalled();
    });

    // Verify initial score is 0
    expect(screen.getByText('0')).toBeInTheDocument();

    // Find "Taille entreprise" criteria item
    const critItem = screen.getByText('Taille entreprise').closest('.crit-item') as HTMLElement;
    const trigger = within(critItem).getByText('— Sélectionner');
    fireEvent.click(trigger);

    // Select option with 8 pts
    const option = screen.getByText('50–500 (8pts)');
    fireEvent.click(option);

    // Verify score is updated in criteria item
    expect(within(critItem).getByText('8pts')).toBeInTheDocument();

    // Verify total score is now 8
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('submits form and calls createLead with correct payload', async () => {
    const setViewMock = vi.fn();
    render(<AddLead setView={setViewMock} />);

    await waitFor(() => {
      expect(settingsService.getPipelineStages).toHaveBeenCalled();
    });

    // Fill Company Name
    fireEvent.change(screen.getByPlaceholderText('ex : LVMH'), { target: { value: 'Acme' } });

    // Select Segment
    fireEvent.click(screen.getByText('— Choisir'));
    fireEvent.click(screen.getByText('Media'));

    // Score "Taille entreprise"
    const sizeItem = screen.getByText('Taille entreprise').closest('.crit-item') as HTMLElement;
    fireEvent.click(within(sizeItem).getByText('— Sélectionner'));
    fireEvent.click(screen.getByText('50–500 (8pts)'));

    // Submit form
    const submitBtn = screen.getByText('Ajouter au pipeline');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(leadsService.createLead).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: 'Acme',
          segment: 'Media',
          stage_id: 'stage-1', // Default auto stage for score < 60
        }),
        expect.arrayContaining([
          expect.objectContaining({
            criterion: 'taille',
            value: 8,
            max_value: 15,
          }),
        ])
      );
    });

    expect(setViewMock).toHaveBeenCalledWith('pipeline');
  });
});
