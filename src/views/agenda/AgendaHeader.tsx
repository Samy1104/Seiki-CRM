import React from 'react';
import { Download, Link, Link2, CheckCircle2, RotateCcw } from 'lucide-react';
import { PageTitle } from '../../components/ui/PageTitle';
import type { CalendlyAccount } from '../../services/calendlyService';

interface AgendaHeaderProps {
  onExportIcal: () => void;
  onCopyFeedUrl: () => void;
  calendlyAccount: CalendlyAccount | null;
  calendlyConnectUrl: string;
  onCalendlyDisconnect: () => void;
}

export const AgendaHeader: React.FC<AgendaHeaderProps> = ({
  onExportIcal,
  onCopyFeedUrl,
  calendlyAccount,
  calendlyConnectUrl,
  onCalendlyDisconnect,
}) => {
  return (
    <div className="flex items-end justify-between mb-10">
      <PageTitle>Agenda</PageTitle>
      <div className="flex items-center gap-5">
        {calendlyAccount ? (
          <span className="flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 text-[11px] tracking-[0.15em] uppercase"
              style={{ color: 'var(--color-success, #4caf7d)' }}
            >
              <CheckCircle2 size={12} strokeWidth={2} />
              Calendly connecté
            </span>
            <button
              type="button"
              title="Reconnecter Calendly"
              className="flex items-center gap-1 transition-colors duration-150 text-[11px] tracking-[0.15em] uppercase cursor-pointer"
              style={{ color: '#555' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-charcoal-fg-soft, #b0afa8)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#555')}
              onClick={onCalendlyDisconnect}
            >
              <RotateCcw size={11} strokeWidth={1.5} />
              Reconnecter
            </button>
          </span>
        ) : (
          <a
            href={calendlyConnectUrl}
            className="flex items-center gap-1.5 transition-colors duration-150 text-[11px] tracking-[0.15em] uppercase cursor-pointer"
            style={{ color: "#555" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-charcoal-fg-soft, #b0afa8)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#555")}
          >
            <Link2 size={12} strokeWidth={2} />
            Connecter Calendly
          </a>
        )}
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
