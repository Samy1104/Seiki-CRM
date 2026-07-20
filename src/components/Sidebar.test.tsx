import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { email: 'test@seiki.fr' }, logout: vi.fn() })),
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

  it('executes actions from collapsed avatar submenu when clicked', () => {
    const setActiveApp = vi.fn();
    const setView = vi.fn();
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: { email: 'test@seiki.fr' }, logout, isAuthenticated: true, loading: false } as any);

    render(<Sidebar section="crm" currentView="pipeline" setView={setView} setActiveApp={setActiveApp} />);

    // Collapse sidebar
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    // Click avatar button
    fireEvent.click(screen.getByTitle('test'));

    // Click "Retour au portail" in floating portal
    const portalBtn = screen.getByText('Retour au portail');
    fireEvent.click(portalBtn);
    expect(setActiveApp).toHaveBeenCalledWith('portal');
  });
});


