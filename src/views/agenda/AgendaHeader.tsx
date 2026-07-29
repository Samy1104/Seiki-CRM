import React from 'react';
import { Download, Link, Link2, CheckCircle2 } from 'lucide-react';
import { PageTitle } from '../../components/ui/PageTitle';
import type { CalendlyAccount } from '../../services/calendlyService';

interface AgendaHeaderProps {
  onExportIcal: () => void;
  onCopyFeedUrl: () => void;
  calendlyAccount: CalendlyAccount | null;
  calendlyConnectUrl: string;
}

export const AgendaHeader: React.FC<AgendaHeaderProps> = ({
  onExportIcal,
  onCopyFeedUrl,
  calendlyAccount,
  calendlyConnectUrl,
}) => {
  return (
    <div className="flex items-end justify-between mb-10">
      <PageTitle>Agenda</PageTitle>
      <div className="flex items-center gap-5">
        <a
          href={calendlyConnectUrl}
          className="flex items-center gap-1.5 transition-colors duration-150 text-[11px] tracking-[0.15em] uppercase cursor-pointer"
          style={{ color: calendlyAccount ? 'var(--color-success, #4caf7d)' : '#555' }}
        >
          {calendlyAccount ? (
            <CheckCircle2 size={12} strokeWidth={2} />
          ) : (
            <Link2 size={12} strokeWidth={2} />
          )}
          {calendlyAccount ? 'Calendly connecté' : 'Connecter Calendly'}
        </a>
        <button
          type="button"
          className="flex items-center gap-1.5 transition-colors duration-150 text-[11px] tracking-[0.15em] uppercase cursor-pointer"
          style={{ color: "#555" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-charcoal-fg-soft, #b0afa8)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#555")}
          onClick={onExportIcal}
        >
          <Download size={12} strokeWidth={1.5} />
          Exporter .ics
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 transition-colors duration-150 text-[11px] tracking-[0.15em] uppercase cursor-pointer"
          style={{ color: "#555" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-charcoal-fg-soft, #b0afa8)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#555")}
          onClick={onCopyFeedUrl}
        >
          <Link size={12} strokeWidth={1.5} />
          URL d'abonnement
        </button>
      </div>
    </div>
  );
};
