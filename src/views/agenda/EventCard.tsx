import React, { useState } from 'react';
import { Calendar, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { EventItem } from '../../services/eventsService';

interface EventCardProps {
  event: EventItem;
  past?: boolean;
  daysAgo?: number;
  formatDateFr: (d: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  past,
  daysAgo,
  formatDateFr,
  onEdit,
  onDelete,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="py-4 flex flex-col gap-2 relative border-t border-[var(--border-subtle)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className="text-[14px] leading-snug font-medium"
          style={{ color: past ? 'var(--text-muted)' : 'var(--text-primary)' }}
        >
          {event.name}
        </span>
        <div
          className="flex items-center gap-3 shrink-0 transition-opacity duration-150"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          <button
            onClick={onEdit}
            title="Modifier"
            className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Pencil size={13} strokeWidth={1.5} />
          </button>
          <button
            onClick={onDelete}
            title="Supprimer"
            className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--color-danger)] transition-colors"
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <Calendar size={11} strokeWidth={1.5} className="text-[var(--text-muted)]" />
          <span>
            {formatDateFr(event.event_date)}
            {event.end_date ? ` au ${formatDateFr(event.end_date)}` : ''}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <MapPin size={11} strokeWidth={1.5} className="text-[var(--text-muted)]" />
            <span>{event.location}</span>
          </div>
        )}
        {past && daysAgo !== undefined && (
          <span className="ml-auto text-[11px] text-[var(--text-muted)]">
            Passé de {daysAgo} jours
          </span>
        )}
      </div>

      {event.objective && (
        <div className="text-[12px] mt-0.5 text-[var(--text-secondary)]">
          Objectif : {event.objective}
        </div>
      )}

      <div className="mt-1 flex">
        <span className="text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 border border-[var(--border-subtle)] text-[var(--text-secondary)] rounded-md">
          {event.segment || 'Général'}
        </span>
      </div>
    </div>
  );
};
