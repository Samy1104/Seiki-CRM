import React, { useState } from 'react';
import { eventsService } from '../services/eventsService';
import type { EventItem } from '../services/eventsService';
import { useToast } from '../context/ToastContext';
import { Plus, Calendar, MapPin, Target, Trash2, Download, Link2, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Field, inputClass } from '../components/ui/Field';
import { useLoadOnMount } from '../hooks/useLoadOnMount';
import { withLoadingState } from '../utils/withLoadingState';
import { confirmAction } from '../utils/confirmAction';

// ── iCal helpers ─────────────────────────────────────────────────────────────

function escapeIcal(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let i = 75;
  while (i < line.length) { chunks.push(' ' + line.slice(i, i + 74)); i += 74; }
  return chunks.join('\r\n');
}

function buildIcalContent(events: EventItem[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SEIKI CRM//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:SEIKI CRM – Agenda',
    'X-WR-CALDESC:Événements de prospection et salons professionnels SEIKI',
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
    if (event.segment) { if (description) description += '\\n'; description += `Segment : ${event.segment}`; }

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

// Edge Function URL for live calendar subscription
const ICAL_FEED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar`;

const countdownClass: Record<string, string> = {
  today: 'text-danger',
  tomorrow: 'text-amber',
  future: 'text-ink-faint',
  past: 'text-ink-faint',
};

export const Agenda: React.FC = () => {
  const { showToast } = useToast();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newSegment, setNewSegment] = useState<'Media' | 'Retail' | 'Instit' | ''>('');
  const [newObjective, setNewObjective] = useState('');

  // Edit State
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isFormCollapsed, setIsFormCollapsed] = useState(true);

  const loadEvents = () => withLoadingState(async () => {
    const fetched = await eventsService.getEvents();
    setEvents(fetched);
  }, {
    setLoading,
    onError: (err) => {
      console.error('Error loading events:', err);
      showToast('Erreur de chargement de l\'agenda', 'error');
    }
  });

  useLoadOnMount(loadEvents);

  // ── iCal export: download all events as a .ics file ──────────────────────
  const handleExportIcal = () => {
    if (events.length === 0) {
      showToast('Aucun événement à exporter', 'error');
      return;
    }
    const icalContent = buildIcalContent(events);
    const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seiki-agenda.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Fichier .ics téléchargé ✓');
  };

  // ── iCal subscription: copy the live feed URL to clipboard ───────────────
  const handleCopyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(ICAL_FEED_URL);
      showToast('URL d\'abonnement copiée dans le presse-papier ✓');
    } catch {
      // Fallback for browsers without clipboard API
      const input = document.createElement('input');
      input.value = ICAL_FEED_URL;
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(input);
      if (copied) {
        showToast('URL copiée ✓');
      } else {
        showToast("Impossible de copier l'URL — copiez-la manuellement", 'error');
      }
    }
  };

  const handleStartEdit = (event: EventItem) => {
    setEditingEventId(event.id);
    setNewName(event.name);
    setNewDate(event.event_date);
    setNewEndDate(event.end_date || '');
    setNewLocation(event.location || '');
    setNewSegment((event.segment as 'Media' | 'Retail' | 'Instit' | null) || '');
    setNewObjective(event.objective || '');
    setIsFormCollapsed(false);

    // Scroll smoothly to the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingEventId(null);
    setNewName('');
    setNewDate('');
    setNewEndDate('');
    setNewLocation('');
    setNewSegment('');
    setNewObjective('');
    setIsFormCollapsed(true);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newDate) return;

    try {
      const eventData = {
        name: newName.trim(),
        event_date: newDate,
        end_date: newEndDate || null,
        location: newLocation.trim() || null,
        segment: newSegment || null,
        objective: newObjective.trim() || null,
        created_by: null
      };

      if (editingEventId) {
        await eventsService.updateEvent(editingEventId, eventData);
        showToast('Événement modifié ✓');
        setEditingEventId(null);
      } else {
        await eventsService.createEvent(eventData);
        showToast('Événement ajouté à l\'agenda');
      }

      setNewName('');
      setNewDate('');
      setNewEndDate('');
      setNewLocation('');
      setNewSegment('');
      setNewObjective('');

      loadEvents();
    } catch (err) {
      console.error('Error saving event:', err);
      showToast(editingEventId ? 'Erreur lors de la modification de l\'événement' : 'Erreur lors de la création de l\'événement', 'error');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirmAction('Supprimer cet événement ?')) {
      try {
        await eventsService.deleteEvent(id);
        showToast('Événement supprimé');
        loadEvents();
      } catch (err) {
        console.error('Error deleting event:', err);
        showToast('Erreur lors de la suppression', 'error');
      }
    }
  };

  const getEventTimeDiff = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const evDate = new Date(dateStr);
    evDate.setHours(0, 0, 0, 0);

    const diffTime = evDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { text: 'Aujourd\'hui', cls: 'today' };
    if (diffDays === 1) return { text: 'Demain', cls: 'tomorrow' };
    if (diffDays > 1) return { text: `Dans ${diffDays} jours`, cls: 'future' };
    if (diffDays === -1) return { text: 'Hier', cls: 'past' };
    return { text: `Passé de ${Math.abs(diffDays)} jours`, cls: 'past' };
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="mt-3 text-ink-soft">Chargement de l'agenda...</div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter(e => e.event_date >= todayStr);
  const pastEvents = events.filter(e => e.event_date < todayStr).reverse();

  const renderEventCard = (e: EventItem, isPast: boolean) => {
    const diff = getEventTimeDiff(e.event_date);
    return (
      <div key={e.id} className={`rounded-surface border border-line bg-elevated p-4 ${isPast ? 'opacity-70' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <span className="font-display text-sm font-bold text-ink">{e.name}</span>
          <span className={`flex-shrink-0 text-[11px] font-semibold ${countdownClass[diff.cls]}`}>{diff.text}</span>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
          <Calendar size={12} className="flex-shrink-0" />
          <span>
            {isPast
              ? new Date(e.event_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
              : new Date(e.event_date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            {!isPast && e.end_date ? ` au ${new Date(e.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}` : ''}
          </span>
        </div>

        {e.location && (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-soft">
            <MapPin size={12} className="flex-shrink-0" />
            <span>{e.location}</span>
          </div>
        )}

        {!isPast && e.objective && (
          <div className="mt-2 flex items-start gap-2 text-xs text-ink">
            <Target size={12} className="mt-0.5 flex-shrink-0" />
            <span><strong>Objectif :</strong> {e.objective}</span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <Badge tone="neutral">{e.segment || 'Général'}</Badge>
          <div className="flex gap-1">
            <button
              className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-hover hover:text-ink cursor-pointer"
              onClick={() => handleStartEdit(e)}
              title="Modifier l'événement"
            >
              <Edit2 size={12} />
            </button>
            <button
              className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
              onClick={() => handleDeleteEvent(e.id)}
              title="Supprimer l'événement"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-bold text-ink">Agenda</div>
          <div className="mt-0.5 text-xs text-ink-soft">Événements de prospection et salons professionnels</div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportIcal} title="Télécharger tous les événements en fichier .ics">
            <Download size={13} />
            Exporter .ics
          </Button>
          <Button variant="primary" size="sm" onClick={handleCopyFeedUrl} title="Copier l'URL d'abonnement live pour Google/Apple/Outlook Calendar">
            <Link2 size={13} />
            Copier l'URL d'abonnement
          </Button>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-3 rounded-surface border border-line-focus bg-amber-soft/30 px-4 py-3 text-xs text-ink-soft">
        <Calendar size={15} className="flex-shrink-0 text-amber" />
        <span>
          <strong className="text-ink">Synchronisation calendrier :</strong>{' '}
          Cliquez sur <em>Exporter .ics</em> pour un import ponctuel, ou <em>Copier l'URL d'abonnement</em> pour une synchronisation live dans Google Calendar, Apple Calendar ou Outlook (Ajouter un calendrier → Via URL).
        </span>
      </div>

      <div className="mb-5 overflow-hidden rounded-surface border border-line">
        <div
          onClick={() => setIsFormCollapsed(!isFormCollapsed)}
          className="flex cursor-pointer select-none items-center justify-between bg-elevated px-4 py-3.5 transition-colors hover:bg-hover"
        >
          <div className="flex items-center gap-2.5">
            {editingEventId ? <Edit2 size={14} className="text-amber" /> : <Plus size={14} className="text-amber" />}
            <span className="text-sm font-bold text-ink">
              {editingEventId ? `MODE ÉDITION : Modifier "${newName}"` : 'AJOUTER UN ÉVÉNEMENT'}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-amber">
            {isFormCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            {isFormCollapsed ? 'Développer' : 'Réduire'}
          </span>
        </div>

        {!isFormCollapsed && (
          <form onSubmit={handleAddEvent} className="border-t border-line bg-surface p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nom de l'événement *">
                <input
                  type="text"
                  placeholder="ex : MIPIM Cannes"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Lieu">
                <input
                  type="text"
                  placeholder="ex : Cannes, France"
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <div className="flex gap-3">
                <Field label="Date de début *" className="flex-1">
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Date de fin" className="flex-1">
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={e => setNewEndDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Segment ciblé">
                <Select value={newSegment} onValueChange={val => setNewSegment(val as 'Media' | 'Retail' | 'Instit' | '')}>
                  <SelectTrigger><SelectValue placeholder="Tous les segments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tous les segments</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Instit">Instit</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Objectif / Action clé" className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="ex : Rencontre 5 prospects et qualification"
                  value={newObjective}
                  onChange={e => setNewObjective(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <div className="sm:col-span-2 flex justify-end gap-2.5">
                {editingEventId && (
                  <Button type="button" variant="secondary" onClick={handleCancelEdit}>Annuler</Button>
                )}
                <Button type="submit" variant="primary">
                  {editingEventId ? <Edit2 size={14} /> : <Plus size={14} />}
                  {editingEventId ? 'Sauvegarder' : "Créer l'événement"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <div className="border-b border-line-focus pb-1.5 text-[15px] font-bold text-ink">
            À VENIR ({upcomingEvents.length})
          </div>

          {upcomingEvents.length > 0 ? (
            upcomingEvents.map(e => renderEventCard(e, false))
          ) : (
            <div className="py-4 text-center text-sm text-ink-faint">Aucun événement à venir</div>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="border-b border-line pb-1.5 text-[15px] font-bold text-ink">
            HISTORIQUE DES ÉVÉNEMENTS ({pastEvents.length})
          </div>

          {pastEvents.length > 0 ? (
            pastEvents.map(e => renderEventCard(e, true))
          ) : (
            <div className="py-4 text-center text-sm text-ink-faint">Aucun événement passé</div>
          )}
        </div>
      </div>
    </div>
  );
};
