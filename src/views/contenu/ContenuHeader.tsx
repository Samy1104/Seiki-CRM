import React from 'react';
import { Link2 } from 'lucide-react';
import { linkedinService, type LinkedinAccount } from '../../services/linkedinService';

interface ContenuHeaderProps {
  accounts: LinkedinAccount[];
}

export const ContenuHeader: React.FC<ContenuHeaderProps> = ({ accounts }) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1
          className="text-4xl font-bold tracking-tight text-[var(--text-primary)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Générateur de posts LinkedIn
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Rédigez, adaptez au style de votre marque et planifiez vos publications
        </p>
      </div>

      <div className="flex items-center gap-3">
        <a
          href={linkedinService.oauthConnectUrl('personal', 'Jaafar')}
          className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors"
        >
          <Link2 size={14} />
          {accounts.some((a) => a.target_type === 'personal') ? 'Reconnecter Jaafar' : 'Connecter Jaafar'}
        </a>
        <a
          href={linkedinService.oauthConnectUrl('company', 'Seiki')}
          className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors"
        >
          <Link2 size={14} />
          {accounts.some((a) => a.target_type === 'company') ? 'Reconnecter Seiki' : 'Connecter Seiki'}
        </a>
      </div>
    </div>
  );
};
