import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Stats } from './Stats';

// Mock ResizeObserver which is needed by Recharts
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockShowToast = vi.fn();

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

let mockLoading = false;

vi.mock('../hooks/useCachedResource', () => ({
  useCachedResource: (key: string) => {
    if (mockLoading) {
      return { data: [], loading: true, reload: vi.fn() };
    }
    if (key === 'leads:false') {
      return {
        data: [
          {
            id: 'l1',
            company_name: 'Acme Corp',
            contact_name: 'John Doe',
            deal_value: 5000,
            stage_id: 's1',
            segment: 'Media',
            source: 'LinkedIn',
            score: 85,
            created_at: '2026-07-01T10:00:00Z',
            stage: { id: 's1', name: 'Prospect', is_closed_won: false, color: '#3b82f6' },
          },
          {
            id: 'l2',
            company_name: 'Beta Tech',
            contact_name: 'Jane Smith',
            deal_value: 10000,
            stage_id: 's2',
            segment: 'Retail',
            source: 'Outbound',
            score: 65,
            created_at: '2026-07-15T10:00:00Z',
            stage: { id: 's2', name: 'Gagné', is_closed_won: true, color: '#22c55e' },
          },
        ],
        loading: false,
        reload: vi.fn(),
      };
    }
    if (key === 'pipelineStages') {
      return {
        data: [
          { id: 's1', name: 'Prospect', is_closed_won: false, color: '#3b82f6' },
          { id: 's2', name: 'Gagné', is_closed_won: true, color: '#22c55e' },
        ],
        loading: false,
        reload: vi.fn(),
      };
    }
    return { data: [], loading: false, reload: vi.fn() };
  },
}));

describe('Stats View Integration', () => {
  beforeEach(() => {
    mockLoading = false;
    vi.clearAllMocks();
  });

  it('renders stats header, date filters, and tab navigation', () => {
    render(<Stats />);
    expect(screen.getByText('Statistiques & Performance')).toBeInTheDocument();
    expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument();
    expect(screen.getByText('Pipeline & Forecast')).toBeInTheDocument();
    expect(screen.getByText('Activité & Équipe')).toBeInTheDocument();
    expect(screen.getByText('Exporter (.csv)')).toBeInTheDocument();
  });

  it('allows switching between tabs', () => {
    render(<Stats />);
    
    // Overview tab content by default
    expect(screen.getByText("Chiffre d'Affaires Gagné")).toBeInTheDocument();

    // Click Pipeline tab
    fireEvent.click(screen.getByText('Pipeline & Forecast'));
    expect(screen.getByText('Pipeline Brut')).toBeInTheDocument();
    expect(screen.getByText('Forecast Pondéré')).toBeInTheDocument();

    // Click Activity tab
    fireEvent.click(screen.getByText('Activité & Équipe'));
    expect(screen.getByText("Volume d'Activités Hebdomadaire")).toBeInTheDocument();
    expect(screen.getByText("Leaderboard de l'Équipe")).toBeInTheDocument();
  });

  it('triggers CSV export when clicking the export button', () => {
    // Mock URL methods for downloading
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');

    render(<Stats />);
    const exportBtn = screen.getByText('Exporter (.csv)');
    fireEvent.click(exportBtn);

    expect(mockShowToast).toHaveBeenCalledWith('Rapport CSV téléchargé !', 'success');

    URL.createObjectURL = originalCreateObjectURL;
  });

  it('renders skeleton loading state when loading', () => {
    mockLoading = true;
    const { container } = render(<Stats />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
