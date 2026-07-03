import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Veuillez entrer le mot de passe');
      return;
    }
    setIsSubmitting(true);
    setError('');

    const success = await login(password);
    setIsSubmitting(false);

    if (!success) {
      setError('Mot de passe incorrect');
      setPassword('');
    }
  };

  return (
    <div className="lock-screen-container">
      <div className="lock-screen-card">
        {/* Large Logo */}
        <div className="lock-screen-logo">
          <img src="/seiki_logo.png" className="lock-logo-img" alt="Seiki Logo" />
          <span className="lock-logo-name">seiki</span>
        </div>
        <div className="lock-screen-title">CRM — Accès sécurisé</div>
        
        <form onSubmit={handleSubmit} className="lock-screen-form">
          <input 
            type="password" 
            id="pwd-input" 
            placeholder="Mot de passe" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            autoFocus
            className="lock-input"
          />
          
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
