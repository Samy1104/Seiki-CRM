import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@seiki.fr' }, logout: vi.fn() }),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders crm nav items and highlights active item', () => {
    render(<Sidebar section="crm" currentView="pipeline" setView={vi.fn()} setActiveApp={vi.fn()} />);

    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Leads')).toBeInTheDocument();
    expect(screen.getByText('Tâches')).toBeInTheDocument();
    expect(screen.getByText('Dashboard CODIR')).toBeInTheDocument();
  });

  it('calls setView when a crm nav item is clicked', () => {
    const setView = vi.fn();
    render(<Sidebar section="crm" currentView="pipeline" setView={setView} setActiveApp={vi.fn()} />);

    fireEvent.click(screen.getByText('Tâches'));
    expect(setView).toHaveBeenCalledWith('tasks');
  });

  it('toggles collapse mode when collapse button is clicked', () => {
    render(<Sidebar section="crm" currentView="pipeline" setView={vi.fn()} setActiveApp={vi.fn()} />);

    const toggleBtn = screen.getByRole('button', { name: 'Collapse sidebar' });
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });
});

