import type { EventItem } from '../services/eventsService';

export function escapeIcal(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let i = 75;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join('\r\n');
}

export function buildIcalContent(events: EventItem[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SEIKI CRM//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:SEIKI CRM – Agenda',
    'X-WR-CALDESC:Événements SEIKI',
    'X-WR-TIMEZONE:Europe/Paris',
  ];

  for (const event of events) {
    const uid = event.ical_uid || `${event.id}@seiki-crm`;
    const dtstart = event.event_date.replace(/-/g, '');

    let dtend: string;
    if (event.end_date) {
      const endDate = new Date(event.end_date);
      endDate.setDate(endDate.getDate() + 1);
      dtend = endDate.toISOString().slice(0, 10).replace(/-/g, '');
    } else {
      const startDate = new Date(event.event_date);
      startDate.setDate(startDate.getDate() + 1);
      dtend = startDate.toISOString().slice(0, 10).replace(/-/g, '');
    }

    let description = '';
    if (event.objective) description += `Objectif : ${event.objective}`;
    if (event.segment) {
      if (description) description += '\\n';
      description += `Segment : ${event.segment}`;
    }

    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${uid}`));
    lines.push(foldLine(`DTSTAMP:${now}`));
    lines.push(foldLine(`DTSTART;VALUE=DATE:${dtstart}`));
    lines.push(foldLine(`DTEND;VALUE=DATE:${dtend}`));
    lines.push(foldLine(`SUMMARY:${escapeIcal(event.name)}`));
    if (event.location) lines.push(foldLine(`LOCATION:${escapeIcal(event.location)}`));
    if (description) lines.push(foldLine(`DESCRIPTION:${escapeIcal(description)}`));
    lines.push(foldLine(`CREATED:${now}`));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcalFile(events: EventItem[]): void {
  const content = buildIcalContent(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'seiki-agenda.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ICAL_FEED_URL = `${import.meta.env.VITE_SUPABASE_URL || 'https://seiki-crm.supabase.co'}/functions/v1/calendar`;
