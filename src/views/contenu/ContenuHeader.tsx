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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 900,
            fontSize: "2.25rem",
            color: "var(--color-charcoal-fg, #f2ede4)",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          LinkedIn
        </h1>
      </div>

      <div className="flex items-center gap-3 flex-wrap font-ui">
        <a
          href={linkedinService.oauthConnectUrl('personal', 'Jaafar')}
          className="text-xs flex items-center gap-2 px-3.5 py-2 rounded-control border border-line-strong bg-surface text-ink-soft hover:text-ink hover:border-line-focus transition-all duration-200 cursor-pointer"
        >
          {isJaafarConnected ? (
            <CheckCircle2 size={15} strokeWidth={2} className="text-success" />
          ) : (
            <Link2 size={15} strokeWidth={2} className="text-[#D4C4A8]" />
          )}
          <span className="font-medium">{isJaafarConnected ? 'Jaafar (Connecté)' : 'Connecter Jaafar'}</span>
        </a>

        <a
          href={linkedinService.oauthConnectUrl('company', 'Seiki')}
          className="text-xs flex items-center gap-2 px-3.5 py-2 rounded-control border border-line-strong bg-surface text-ink-soft hover:text-ink hover:border-line-focus transition-all duration-200 cursor-pointer"
        >
          {isSeikiConnected ? (
            <CheckCircle2 size={15} strokeWidth={2} className="text-success" />
          ) : (
            <Link2 size={15} strokeWidth={2} className="text-[#D4C4A8]" />
          )}
          <span className="font-medium">{isSeikiConnected ? 'Seiki (Connecté)' : 'Connecter Seiki'}</span>
        </a>
      </div>
    </div>
  );
};
