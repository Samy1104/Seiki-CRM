import React from 'react';
import { Download, Link } from 'lucide-react';
import { PageTitle } from '../../components/ui/PageTitle';

interface AgendaHeaderProps {
  onExportIcal: () => void;
  onCopyFeedUrl: () => void;
}

export const AgendaHeader: React.FC<AgendaHeaderProps> = ({
  onExportIcal,
  onCopyFeedUrl,
}) => {
  return (
    <div className="flex items-end justify-between mb-10">
      <PageTitle>Agenda</PageTitle>
      <div className="flex items-center gap-5">
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

