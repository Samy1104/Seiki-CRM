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
    expect(screen.getByPlaceholderText('vous@exemple.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('shows a validation error when submitted empty', () => {
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn(), logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));
    expect(screen.getByText('Veuillez entrer votre email et votre mot de passe')).toBeInTheDocument();
  });

  it('toggles password visibility when eye icon button is clicked', () => {
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn(), logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const toggleBtn = screen.getByRole('button', { name: /afficher le mot de passe/i });
    expect(passwordInput).toHaveAttribute('type', 'password');
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: /masquer le mot de passe/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('calls login with the entered credentials', async () => {
    const login = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useAuth).mockReturnValue({ login, logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('vous@exemple.com'), { target: { value: 'a@seiki.co' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('a@seiki.co', 'secret'));
  });

  it('shows a French error message on invalid credentials', async () => {
    const login = vi.fn().mockResolvedValue({ success: false, error: 'Invalid login credentials' });
    vi.mocked(useAuth).mockReturnValue({ login, logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('vous@exemple.com'), { target: { value: 'a@seiki.co' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => expect(screen.getByText('Email ou mot de passe incorrect')).toBeInTheDocument());
  });
});
