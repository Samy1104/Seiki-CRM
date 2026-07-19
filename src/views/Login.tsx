import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setError(loginError === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : (loginError || 'Erreur de connexion'));
      setPassword('');
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-base font-ui text-ink px-4">
      <div className="mb-10 w-full max-w-md text-center">
        <img src="/grand_logo.png" className="mx-auto mb-8 h-16 w-auto" alt="Seiki Logo" />
        <h1 className="font-display text-4xl font-bold leading-tight text-ink">
          Sharper decisions <br />with mobility data
        </h1>
        <p className="mt-3 text-sm text-ink-soft">CRM interne à Seiki</p>
      </div>

      <div className="w-full max-w-96 rounded-lg border border-line-strong bg-surface p-10 shadow-modal">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            autoFocus
            autoComplete="username"
            className="w-full rounded-sm border border-line-strong bg-base px-4 py-3 text-center text-sm text-ink outline-none transition-colors focus:border-line-focus"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            autoComplete="current-password"
            className="w-full rounded-sm border border-line-strong bg-base px-4 py-3 text-center text-sm text-ink outline-none transition-colors focus:border-line-focus"
          />

          {error && <div className="text-center text-xs font-medium text-danger">{error}</div>}

          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2 w-full py-3">
            {isSubmitting ? 'Connexion en cours...' : 'Accéder au CRM'}
          </Button>
        </form>
      </div>
    </div>
  );
};
