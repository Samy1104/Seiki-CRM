import React from 'react';
import { Clock, Mail, Video, MapPin, UserRound } from 'lucide-react';
import type { CalendlyBooking } from '../../services/calendlyService';

interface BookingCardProps {
  booking: CalendlyBooking;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking }) => {
  const canceled = booking.status === 'canceled';
  // Date et heure dérivées du même instant Europe/Paris — start_time est un
  // horodatage UTC, donc slice(0, 10) donnerait la date UTC (fausse d'une
  // journée pour les RDV entre 00h et 2h heure de Paris).
  const startDate = new Date(booking.start_time);
  const dateLabel = startDate.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });
  const timeLabel = startDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
  const isLink = booking.location?.startsWith('http') ?? false;

  return (
    <div
      className="py-4 flex flex-col gap-2 relative"
      style={{ borderTop: '1px solid rgba(242,237,228,0.07)', opacity: canceled ? 0.5 : 1 }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="text-[14px] leading-snug"
            style={{
              color: canceled ? '#888880' : 'var(--color-charcoal-fg, #f2ede4)',
              fontWeight: 500,
              textDecoration: canceled ? 'line-through' : 'none',
            }}
          >
            {booking.invitee_name || booking.invitee_email}
          </span>
          <span
            className="text-[10px] tracking-[0.18em] uppercase px-2 py-0.5"
            style={{ color: '#888880', border: '1px solid rgba(242,237,228,0.1)' }}
          >
            via Calendly
          </span>
          {canceled && (
            <span
              className="text-[10px] tracking-[0.18em] uppercase px-2 py-0.5"
              style={{ color: '#e05252', border: '1px solid rgba(224,82,82,0.3)' }}
            >
              Annulé
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Clock size={11} strokeWidth={1.5} style={{ color: '#555' }} />
          <span className="text-[12px]" style={{ color: '#666' }}>
            {dateLabel} à {timeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mail size={11} strokeWidth={1.5} style={{ color: '#555' }} />
          <span className="text-[12px]" style={{ color: '#666' }}>{booking.invitee_email}</span>
        </div>
        {booking.location && (
          isLink ? (
            <a href={booking.location} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
              <Video size={11} strokeWidth={1.5} style={{ color: '#555' }} />
              <span className="text-[12px]" style={{ color: '#666' }}>{booking.location}</span>
            </a>
          ) : (
            <div className="flex items-center gap-1.5">
              <MapPin size={11} strokeWidth={1.5} style={{ color: '#555' }} />
              <span className="text-[12px]" style={{ color: '#666' }}>{booking.location}</span>
            </div>
          )
        )}
        {booking.lead_id && (
          <a href={`/crm/leads?leadId=${booking.lead_id}`} className="flex items-center gap-1.5">
            <UserRound size={11} strokeWidth={1.5} style={{ color: '#555' }} />
            <span className="text-[12px]" style={{ color: '#666' }}>Voir le lead</span>
          </a>
        )}
      </div>

      {booking.title && (
        <div className="text-[12px] mt-0.5" style={{ color: 'var(--color-charcoal-fg-soft, #b0afa8)' }}>
          {booking.title}
        </div>
      )}
    </div>
  );
};
