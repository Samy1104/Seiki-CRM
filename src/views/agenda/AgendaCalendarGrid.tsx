import React from 'react';
import type { EventItem } from '../../services/eventsService';
import { EventCard } from './EventCard';

interface AgendaCalendarGridProps {
  upcomingEvents: EventItem[];
  pastEvents: EventItem[];
  formatDateFr: (d: string) => string;
  getDaysAgo: (d: string) => number;
  onEdit: (event: EventItem) => void;
  onDelete: (id: string) => void;
}

export const AgendaCalendarGrid: React.FC<AgendaCalendarGridProps> = ({
  upcomingEvents,
  pastEvents,
  formatDateFr,
  getDaysAgo,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* À venir */}
      <div className="p-6 rounded-2xl border border-[var(--border-subtle)]" style={{ background: 'var(--bg-panel)' }}>
        <div className="flex items-baseline gap-2 mb-6 border-b border-[var(--border-subtle)] pb-4">
          <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-[var(--text-primary)]">
            À venir
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            ({upcomingEvents.length})
          </span>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            Aucun événement à venir
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {upcomingEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                formatDateFr={formatDateFr}
                onEdit={() => onEdit(event)}
                onDelete={() => onDelete(event.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Historique */}
      <div className="p-6 rounded-2xl border border-[var(--border-subtle)]" style={{ background: 'var(--bg-panel)' }}>
        <div className="flex items-baseline gap-2 mb-6 border-b border-[var(--border-subtle)] pb-4">
          <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-[var(--text-primary)]">
            Historique
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            ({pastEvents.length})
          </span>
        </div>

        {pastEvents.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            Aucun événement passé
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {pastEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                past
                daysAgo={getDaysAgo(event.event_date)}
                formatDateFr={formatDateFr}
                onEdit={() => onEdit(event)}
                onDelete={() => onDelete(event.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
