import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SideBar } from './SideBar';
import { leadsService } from '../services/leadsService';
import { tasksService } from '../services/tasksService';

vi.mock('../services/leadsService', () => ({
  leadsService: { getLeads: vi.fn() },
}));
vi.mock('../services/tasksService', () => ({
  tasksService: { getTasks: vi.fn() },
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

describe('SideBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(leadsService.getLeads).mockResolvedValue([]);
    vi.mocked(tasksService.getTasks).mockResolvedValue([]);
  });

  it('renders every nav item and highlights the current view', async () => {
    render(<SideBar currentView="pipeline" setView={vi.fn()} />);
    await waitFor(() => expect(leadsService.getLeads).toHaveBeenCalled());

    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Tous les leads')).toBeInTheDocument();
    expect(screen.getByText('Tâches')).toBeInTheDocument();
    expect(screen.getByText('Dashboard CODIR')).toBeInTheDocument();
  });

  it('calls setView when a nav item is clicked', async () => {
    const setView = vi.fn();
    render(<SideBar currentView="pipeline" setView={setView} />);
    await waitFor(() => expect(leadsService.getLeads).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Tâches'));
    expect(setView).toHaveBeenCalledWith('tasks');
  });

  it('opens the mobile drawer when the hamburger button is clicked', async () => {
    render(<SideBar currentView="pipeline" setView={vi.fn()} />);
    await waitFor(() => expect(leadsService.getLeads).toHaveBeenCalled());

    const hamburger = screen.getByRole('button', { name: 'Ouvrir le menu' });
    expect(screen.queryByTestId('sidebar-drawer')).not.toBeInTheDocument();

    fireEvent.click(hamburger);
    expect(screen.getByTestId('sidebar-drawer')).toBeInTheDocument();
  });
});
