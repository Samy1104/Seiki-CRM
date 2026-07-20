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
      <style>{`
        /* Reset all default input styling, borders, focus lines, background boxes, and browser autofill overrides */
        .login-input,
        .login-input:focus,
        .login-input:hover,
        .login-input:active,
        .login-input:focus-visible {
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          background: transparent !important;
          background-color: transparent !important;
          border: none !important;
          border-top: none !important;
          border-bottom: none !important;
          border-left: none !important;
          border-right: none !important;
          border-color: transparent !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          -webkit-box-shadow: none !important;
          outline: none !important;
          font-family: 'Inter', sans-serif !important;
          color: #f2ede4 !important;
        }

        .login-input::placeholder {
          color: rgba(242, 237, 228, 0.4) !important;
          opacity: 1 !important;
          font-family: 'Inter', sans-serif !important;
        }

        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus,
        .login-input:-webkit-autofill:active {
          -webkit-text-fill-color: #f2ede4 !important;
          -webkit-box-shadow: 0 0 0px 1000px #0d0d0d inset !important;
          box-shadow: 0 0 0px 1000px #0d0d0d inset !important;
          transition: background-color 50000s ease-in-out 0s !important;
          border-radius: 0 !important;
          background-color: transparent !important;
        }

        .login-input::selection {
          background-color: rgba(200, 184, 154, 0.3) !important;
          color: #f2ede4 !important;
        }
      `}</style>

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
              style={{ color: '#888880', fontFamily: "'Inter', sans-serif" }}
            >
              Email
            </label>
            <div
              className="flex items-center"
              style={{
                borderBottom: `1px solid ${focused === 'email' ? '#c8b89a' : 'rgba(242, 237, 228, 0.15)'}`,
                transition: 'border-color 0.2s ease',
              }}
            >
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="vous@exemple.com"
                autoComplete="email"
                className="login-input w-full text-[14px] tracking-wide py-3 px-0"
                style={{
                  caretColor: '#c8b89a',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5 mt-2">
            <label
              htmlFor="password"
              className="text-[11px] tracking-[0.2em] uppercase"
              style={{ color: '#888880', fontFamily: "'Inter', sans-serif" }}
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
                className="login-input flex-1 text-[14px] tracking-wide py-3 px-0"
                style={{
                  caretColor: '#c8b89a',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 pb-0.5 transition-colors duration-150 outline-none focus:outline-none"
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
            <div
              className="text-center text-xs font-medium mt-2"
              style={{ color: '#F87171', fontFamily: "'Inter', sans-serif" }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="group mt-6 w-full flex items-center justify-between px-5 py-4 transition-all duration-200 outline-none focus:outline-none"
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
          <span
            className="text-[12px] tracking-[0.15em] uppercase font-medium"
            style={{ color: '#f2ede4', fontFamily: "'Inter', sans-serif" }}
          >
            Powered by Seiki
          </span>
        </div>
      </div>
    </div>
  );
};
