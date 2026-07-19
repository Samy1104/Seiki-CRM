import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Login } from './Login';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the email/password form', () => {
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn(), logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument();
  });

  it('shows a validation error when submitted empty', () => {
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn(), logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: 'Accéder au CRM' }));
    expect(screen.getByText('Veuillez entrer votre email et votre mot de passe')).toBeInTheDocument();
  });

  it('calls login with the entered credentials', async () => {
    const login = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useAuth).mockReturnValue({ login, logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@seiki.co' } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accéder au CRM' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('a@seiki.co', 'secret'));
  });

  it('shows a French error message on invalid credentials', async () => {
    const login = vi.fn().mockResolvedValue({ success: false, error: 'Invalid login credentials' });
    vi.mocked(useAuth).mockReturnValue({ login, logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@seiki.co' } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accéder au CRM' }));

    await waitFor(() => expect(screen.getByText('Email ou mot de passe incorrect')).toBeInTheDocument());
  });
});
