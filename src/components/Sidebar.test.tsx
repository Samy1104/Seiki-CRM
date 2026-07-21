import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { email: 'test@seiki.fr' }, logout: vi.fn() })),
}));

const renderWithRouter = (ui: React.ReactElement, { initialEntries = ['/crm/pipeline'] } = {}) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
    </MemoryRouter>
  );
};

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders crm nav items and highlights active item', () => {
    renderWithRouter(<Sidebar section="crm" currentView="pipeline" setView={vi.fn()} setActiveApp={vi.fn()} />);

    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Leads')).toBeInTheDocument();
    expect(screen.getByText('Tâches')).toBeInTheDocument();
    expect(screen.getByText('Dashboard CODIR')).toBeInTheDocument();
  });

  it('calls setView when a crm nav item is clicked', () => {
    const setView = vi.fn();
    renderWithRouter(<Sidebar section="crm" currentView="pipeline" setView={setView} setActiveApp={vi.fn()} />);

    fireEvent.click(screen.getByText('Tâches'));
    expect(setView).toHaveBeenCalledWith('tasks');
  });

  it('executes actions from collapsed avatar submenu when clicked', () => {
    const setActiveApp = vi.fn();
    const setView = vi.fn();
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: { email: 'test@seiki.fr' }, logout, isAuthenticated: true, loading: false } as any);

    renderWithRouter(<Sidebar section="crm" currentView="pipeline" setView={setView} setActiveApp={setActiveApp} />);

    // Collapse sidebar
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    // Click avatar button
    fireEvent.click(screen.getByTitle('test'));

    // Click "Retour au portail" in floating portal
    const portalBtn = screen.getByText('Retour au portail');
    fireEvent.click(portalBtn);
    expect(setActiveApp).toHaveBeenCalledWith('portal');
  });

  it('switches to crm and sets view to settings when clicking Paramètres in contenu section', () => {
    const setActiveApp = vi.fn();
    const setView = vi.fn();

    renderWithRouter(
      <Sidebar
        section="contenu"
        contenuView="linkedin"
        setContenuView={vi.fn()}
        setActiveApp={setActiveApp}
        setView={setView}
      />,
      { initialEntries: ['/contenu/linkedin'] }
    );

    // Open profile menu
    fireEvent.click(screen.getByText('test'));

    // Click "Paramètres"
    const settingsBtn = screen.getByText('Paramètres');
    fireEvent.click(settingsBtn);

    expect(setActiveApp).toHaveBeenCalledWith('crm');
    expect(setView).toHaveBeenCalledWith('settings');
  });
});
