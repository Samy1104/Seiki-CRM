import React from 'react';
import { Clock, Mail, Video, Link as LinkIcon } from 'lucide-react';
import type { CalendlyBooking } from '../../services/calendlyService';

interface BookingCardProps {
  booking: CalendlyBooking;
  formatDateFr: (d: string) => string;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, formatDateFr }) => {
  const canceled = booking.status === 'canceled';
  const timeLabel = new Date(booking.start_time).toLocaleTimeString('fr-FR', {
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
            {formatDateFr(booking.start_time.slice(0, 10))} à {timeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mail size={11} strokeWidth={1.5} style={{ color: '#555' }} />
          <span className="text-[12px]" style={{ color: '#666' }}>{booking.invitee_email}</span>
        </div>
        {booking.location && (
          <a
            href={isLink ? booking.location : undefined}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5"
          >
            {isLink ? (
              <Video size={11} strokeWidth={1.5} style={{ color: '#555' }} />
            ) : (
              <LinkIcon size={11} strokeWidth={1.5} style={{ color: '#555' }} />
            )}
            <span className="text-[12px]" style={{ color: '#666' }}>{booking.location}</span>
          </a>
        )}
      </div>
    </div>
  );
};
