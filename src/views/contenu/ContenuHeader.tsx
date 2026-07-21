import React from 'react';
import { Link2, CheckCircle2 } from 'lucide-react';
import { linkedinService, type LinkedinAccount } from '../../services/linkedinService';

interface ContenuHeaderProps {
  accounts: LinkedinAccount[];
}

export const ContenuHeader: React.FC<ContenuHeaderProps> = ({ accounts }) => {
  const isJaafarConnected = accounts.some((a) => a.target_type === 'personal');
  const isSeikiConnected = accounts.some((a) => a.target_type === 'company');

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
      <div>
        <span
          className="text-[11px] font-medium tracking-[0.2em] uppercase block mb-1 text-[var(--text-muted)]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Studio de création &amp; distribution
        </span>
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Générateur de posts LinkedIn
        </h1>
        <p
          className="text-sm text-[var(--text-secondary)] mt-1.5"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Rédigez, adaptez au style de votre marque et planifiez vos publications
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <a
          href={linkedinService.oauthConnectUrl('personal', 'Jaafar')}
          className="text-xs flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#c8b89a]/50 transition-all duration-200 cursor-pointer"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {isJaafarConnected ? (
            <CheckCircle2 size={14} className="text-emerald-400" />
          ) : (
            <Link2 size={14} className="text-[#c8b89a]" />
          )}
          <span>{isJaafarConnected ? 'Jaafar (Connecté)' : 'Connecter Jaafar'}</span>
        </a>

        <a
          href={linkedinService.oauthConnectUrl('company', 'Seiki')}
          className="text-xs flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#c8b89a]/50 transition-all duration-200 cursor-pointer"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {isSeikiConnected ? (
            <CheckCircle2 size={14} className="text-emerald-400" />
          ) : (
            <Link2 size={14} className="text-[#c8b89a]" />
          )}
          <span>{isSeikiConnected ? 'Seiki (Connecté)' : 'Connecter Seiki'}</span>
        </a>
      </div>
    </div>
  );
};

