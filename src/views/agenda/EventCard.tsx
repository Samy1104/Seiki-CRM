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
      className="py-4 flex flex-col gap-2 relative"
      style={{ borderTop: '1px solid rgba(242,237,228,0.07)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="text-[14px] leading-snug"
            style={{ color: past ? '#888880' : 'var(--color-charcoal-fg, #f2ede4)', fontWeight: 500 }}
          >
            {event.name}
          </span>
          <span
            className="text-[10px] tracking-[0.18em] uppercase px-2 py-0.5"
            style={{
              color: '#888880',
              border: '1px solid rgba(242,237,228,0.1)',
            }}
          >
            {event.segment || 'Général'}
          </span>
        </div>
        <div
          className="flex items-center gap-3 shrink-0 transition-opacity duration-150"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          <button
            type="button"
            onClick={onEdit}
            title="Modifier"
            className="cursor-pointer"
            style={{ color: '#555', lineHeight: 0 }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-charcoal-fg, #f2ede4)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#555')}
          >
            <Pencil size={13} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Supprimer"
            className="cursor-pointer"
            style={{ color: '#555', lineHeight: 0 }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-charcoal-danger, #e05252)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#555')}
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Calendar size={11} strokeWidth={1.5} style={{ color: '#555' }} />
          <span className="text-[12px]" style={{ color: '#666' }}>
            {formatDateFr(event.event_date)}
            {event.end_date ? ` au ${formatDateFr(event.end_date)}` : ''}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-1.5">
            <MapPin size={11} strokeWidth={1.5} style={{ color: '#555' }} />
            <span className="text-[12px]" style={{ color: '#666' }}>
              {event.location}
            </span>
          </div>
        )}
        {past && daysAgo !== undefined && (
          <span className="ml-auto text-[11px]" style={{ color: '#3a3a3a' }}>
            Passé de {daysAgo} jours
          </span>
        )}
      </div>

      {event.objective && (
        <div className="text-[12px] mt-0.5" style={{ color: 'var(--color-charcoal-fg-soft, #b0afa8)' }}>
          {event.objective}
        </div>
      )}
    </div>
  );
};

