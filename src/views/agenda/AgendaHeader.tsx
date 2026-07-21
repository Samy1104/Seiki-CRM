import React from 'react';
import { Plus, Calendar as CalendarIcon, Download, Link, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface AgendaHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onOpenDatePicker: () => void;
  onExportIcal: () => void;
  onOpenFeedModal: () => void;
  onNewEventClick: () => void;
}

export const AgendaHeader: React.FC<AgendaHeaderProps> = ({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  onOpenDatePicker,
  onExportIcal,
  onOpenFeedModal,
  onNewEventClick,
}) => {
  const monthYearLabel = currentDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
      <div>
        <h1
          className="text-4xl font-bold tracking-tight text-[var(--text-primary)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Agenda &amp; Événements
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Planifiez vos salons, conférences et rendez-vous clés
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Month Navigation */}
        <div
          className="flex items-center gap-2 p-1.5 rounded-xl border border-[var(--border-subtle)]"
          style={{ background: 'var(--bg-panel)' }}
        >
          <button
            onClick={onPrevMonth}
            className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            aria-label="Mois précédent"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={onOpenDatePicker}
            className="flex items-center gap-2 px-3 py-1 text-sm font-semibold capitalize text-[var(--text-primary)] hover:text-[var(--gold)] transition-colors cursor-pointer"
          >
            <CalendarIcon size={14} />
            <span>{monthYearLabel}</span>
          </button>

          <button
            onClick={onNextMonth}
            className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            aria-label="Mois suivant"
          >
            <ChevronRight size={18} />
          </button>

          <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

          <button
            onClick={onToday}
            className="px-2.5 py-1 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            Aujourd'hui
          </button>
        </div>

        {/* iCal Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExportIcal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
            title="Télécharger l'agenda au format .ics"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Exporter .ics</span>
          </button>

          <button
            onClick={onOpenFeedModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
            title="S'abonner au flux iCal"
          >
            <Link size={14} />
            <span className="hidden sm:inline">Flux iCal</span>
          </button>
        </div>

        {/* Create Button */}
        <Button
          onClick={onNewEventClick}
          className="flex items-center gap-2 bg-[var(--gold)] text-black font-semibold hover:bg-[var(--gold)]/90"
        >
          <Plus size={16} />
          <span>Nouvel événement</span>
        </Button>
      </div>
    </div>
  );
};
