import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutGrid, LogOut } from 'lucide-react';

interface ContenuProps {
  setActiveApp: (app: 'portal' | 'crm' | 'contenu') => void;
}

export const Contenu: React.FC<ContenuProps> = ({ setActiveApp }) => {
  const { logout } = useAuth();

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark-wrap">
            <img src="/grand_logo.png" alt="Seiki" className="logo-mark" />
          </div>
          <div className="logo-sub">CONTENU — IA PREDICtive</div>
        </div>

        <nav className="nav">
          <button className="nav-item on">
            <LayoutGrid size={16} />
            <span>Dashboard</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="btn-logout" style={{ marginBottom: '8px' }} onClick={() => setActiveApp('portal')}>
            <LayoutGrid size={14} style={{ marginRight: '6px' }} />
            Retour Portail
          </button>
          
          <button className="btn-logout" onClick={logout}>
            <LogOut size={14} style={{ marginRight: '6px' }} />
            Déconnexion
          </button>

          <div className="powered-by-seiki-footer">
            <span className="powered-text">Powered by</span>
            <img src="/seiki_logo_large.png" className="seiki-footer-logo" alt="Seiki Logo" />
            <span className="seiki-footer-name">Seiki</span>
          </div>
        </div>
      </aside>

      <main className="main-content flex items-center justify-center text-center p-8">
        <div className="max-w-md space-y-6 bg-[var(--bg-panel)] p-10 rounded-2xl border border-[var(--border-subtle)] backdrop-blur-md">
          <div className="flex justify-center">
            <span className="material-symbols-outlined text-[64px] text-[var(--gold)]" style={{ fontVariationSettings: "'FILL' 1" }}>
              query_stats
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-heading)' }}>
            Module Contenu
          </h1>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            Ce module d'analyse prédictive et de cartographie de marché sera développé ultérieurement.
          </p>
          <button 
            onClick={() => setActiveApp('portal')}
            className="nav-item on"
            style={{ 
              marginTop: '24px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: 'auto',
              padding: '10px 24px',
              borderRadius: 'var(--radius-btn)',
              cursor: 'pointer',
              margin: '0 auto'
            }}
          >
            <LayoutGrid size={14} style={{ marginRight: '8px' }} />
            Retour au Portail
          </button>
        </div>
      </main>
    </div>
  );
};
