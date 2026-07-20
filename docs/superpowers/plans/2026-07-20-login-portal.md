# Login Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current login page with the exact login portal design from `D:\Stage\SEIKI\Login Portal with Buttons\src\app\pages\Login.tsx`, retaining original logo size and headline font.

**Architecture:** Update `src/views/Login.tsx` with the new JSX/CSS structure and password visibility toggle state. Connect submission to `AuthContext` login. Update unit test `src/views/Login.test.tsx`.

**Tech Stack:** React, Tailwind CSS / inline CSS, Lucide React (`Eye`, `EyeOff`, `ArrowRight`).

## Global Constraints
- Preserve logo height `h-16 w-auto` with `/grand_logo.png`.
- Preserve display font `font-display` for `"Sharper decisions with mobility data"`.
- Implement show/hide password toggle using Lucide icons.
- Ensure all tests in `src/views/Login.test.tsx` pass cleanly.

---

### Task 1: Update Login View Component

**Files:**
- Modify: `src/views/Login.tsx:1-82`

**Interfaces:**
- Consumes: `useAuth()` from `../context/AuthContext`
- Produces: `Login` React Component exported from `src/views/Login.tsx`

- [ ] **Step 1: Write updated Login component in `src/views/Login.tsx`**

Replace `src/views/Login.tsx` with:

```tsx
import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Veuillez entrer votre email et votre mot de passe');
      return;
    }
    setIsSubmitting(true);
    setError('');

    const { success, error: loginError } = await login(email, password);
    setIsSubmitting(false);

    if (!success) {
      setError(
        loginError === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect'
          : loginError || 'Erreur de connexion'
      );
      setPassword('');
    }
  };

  return (
    <div
      className="size-full flex items-center justify-center relative min-h-screen"
      style={{ fontFamily: "'Inter', sans-serif", background: '#0d0d0d' }}
    >
      {/* Background slot */}
      <div className="absolute inset-0 z-0" id="login-background" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm px-6 flex flex-col gap-10">
        {/* Logo */}
        <div className="flex justify-center">
          <img
            src="/grand_logo.png"
            alt="Seiki"
            className="h-16 w-auto object-contain"
          />
        </div>

        {/* Headline */}
        <div>
          <h1
            className="leading-[1.1] text-center font-display"
            style={{
              fontWeight: 900,
              fontSize: 'clamp(2rem, 5vw, 2.75rem)',
              color: '#f2ede4',
              letterSpacing: '-0.02em',
            }}
          >
            Sharper decisions with mobility data
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-[11px] tracking-[0.2em] uppercase"
              style={{ color: '#888880' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="vous@exemple.com"
              autoComplete="email"
              className="w-full bg-transparent outline-none text-[14px] tracking-wide py-3 px-0"
              style={{
                color: '#f2ede4',
                borderBottom: `1px solid ${focused === 'email' ? '#c8b89a' : 'rgba(242, 237, 228, 0.15)'}`,
                transition: 'border-color 0.2s ease',
                caretColor: '#c8b89a',
              }}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5 mt-2">
            <label
              htmlFor="password"
              className="text-[11px] tracking-[0.2em] uppercase"
              style={{ color: '#888880' }}
            >
              Mot de passe
            </label>
            <div
              className="flex items-center"
              style={{
                borderBottom: `1px solid ${focused === 'password' ? '#c8b89a' : 'rgba(242, 237, 228, 0.15)'}`,
                transition: 'border-color 0.2s ease',
              }}
            >
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="flex-1 bg-transparent outline-none text-[14px] tracking-wide py-3 px-0"
                style={{ color: '#f2ede4', caretColor: '#c8b89a' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 pb-0.5 transition-colors duration-150"
                style={{ color: '#555', lineHeight: 0 }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#f2ede4')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#555')}
                tabIndex={-1}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? (
                  <EyeOff size={15} strokeWidth={1.5} />
                ) : (
                  <Eye size={15} strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-center text-xs font-medium text-danger mt-2" style={{ color: '#F87171' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="group mt-6 w-full flex items-center justify-between px-5 py-4 transition-all duration-200"
            style={{
              background: '#f2ede4',
              color: '#0d0d0d',
              opacity: isSubmitting ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) (e.currentTarget as HTMLElement).style.background = '#e8e3da';
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) (e.currentTarget as HTMLElement).style.background = '#f2ede4';
            }}
          >
            <span
              className="text-[13px] tracking-[0.15em] uppercase font-medium"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
            </span>
            <ArrowRight
              size={15}
              strokeWidth={1.5}
              style={{
                transition: 'transform 0.2s ease',
              }}
              className="group-hover:translate-x-1"
            />
          </button>
        </form>

        {/* Footer */}
        <div className="text-center">
          <span className="text-[10px] tracking-[0.15em] uppercase" style={{ color: '#333' }}>
            Powered by Seiki
          </span>
        </div>
      </div>
    </div>
  );
};
```

---

### Task 2: Update and Verify Unit Tests

**Files:**
- Modify: `src/views/Login.test.tsx:1-53`

- [ ] **Step 1: Update `src/views/Login.test.tsx` to reflect new placeholder and submit button text**

```tsx
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
```

- [ ] **Step 2: Run test suite to verify implementation**

Run: `npm test` or `npx vitest run src/views/Login.test.tsx`
Expected: All tests PASS.
