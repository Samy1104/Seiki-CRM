import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

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
    <div className="lock-screen-container">
      {/* Hero Section styled exactly like Seiki.co */}
      <div className="lock-screen-hero">
        <img src="/grand_logo.png" className="lock-logo-large" alt="Seiki Logo" />
        <h1>Sharper decisions <br />with mobility data</h1>
        <p>CRM interne à Seiki</p>
      </div>

      {/* Glassmorphic Credentials Card */}
      <div className="lock-screen-card">
        <form onSubmit={handleSubmit} className="lock-screen-form">
          <div className="lock-input-wrapper">
            <input
              type="email"
              id="email-input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              autoComplete="username"
              className="lock-input"
            />
          </div>
          <div className="lock-input-wrapper">
            <input
              type="password"
              id="pwd-input"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="current-password"
              className="lock-input"
            />
          </div>

          {error && <div className="lock-error">{error}</div>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="lock-btn"
          >
            {isSubmitting ? 'Connexion en cours...' : 'Accéder au CRM'}
          </button>
        </form>
      </div>
    </div>
  );
};
