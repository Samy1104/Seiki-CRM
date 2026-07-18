import React, { useState } from 'react';
import { eventsService } from '../services/eventsService';
import type { EventItem } from '../services/eventsService';
import { useToast } from '../context/ToastContext';
import { Plus, Calendar, MapPin, Target, Trash2, Download, Link2, Edit2 } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/Select';
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
        <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Chargement de l'agenda...</div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter(e => e.event_date >= todayStr);
  const pastEvents = events.filter(e => e.event_date < todayStr).reverse(); // Order from most recent past to oldest

  return (
    <div className="view-section on">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Agenda</div>
          <div className="page-sub">Événements de prospection et salons professionnels</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-sm" onClick={handleExportIcal} title="Télécharger tous les événements en fichier .ics">
            <Download size={13} style={{ marginRight: '6px' }} />
            Exporter .ics
          </button>
          <button className="btn btn-sm btn-grad" onClick={handleCopyFeedUrl} title="Copier l'URL d'abonnement live pour Google/Apple/Outlook Calendar">
            <Link2 size={13} style={{ marginRight: '6px' }} />
            Copier l'URL d'abonnement
          </button>
        </div>
      </div>

      {/* iCal info banner */}
      <div style={{
        background: 'rgba(107, 95, 230, 0.08)',
        border: '1px solid rgba(107, 95, 230, 0.25)',
        borderRadius: '10px',
        padding: '10px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '12.5px',
        color: 'var(--text-secondary)'
      }}>
        <Calendar size={15} style={{ color: '#fff', flexShrink: 0 }} />
        <span>
          <strong style={{ color: 'var(--text-h)' }}>Synchronisation calendrier :</strong>{' '}
          Cliquez sur <em>Exporter .ics</em> pour un import ponctuel, ou <em>Copier l'URL d'abonnement</em> pour une synchronisation live dans Google Calendar, Apple Calendar ou Outlook (Ajouter un calendrier → Via URL).
        </span>
      </div>

      {/* Add/Edit Event Collapsible Form Box */}
      <div className="card" style={{ padding: '0px', marginBottom: '20px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <div 
          onClick={() => setIsFormCollapsed(!isFormCollapsed)}
          style={{ 
            padding: '14px 18px', 
            background: 'rgba(255, 255, 255, 0.02)', 
            borderBottom: isFormCollapsed ? 'none' : '1px solid var(--border-subtle)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'background 0.2s ease'
          }}
          className="form-toggle-header"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {editingEventId ? <Edit2 size={14} style={{ color: 'var(--purple)' }} /> : <Plus size={14} style={{ color: 'var(--purple)' }} />}
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-h)', letterSpacing: '0.3px' }}>
              {editingEventId ? `MODE ÉDITION : Modifier "${newName}"` : 'AJOUTER UN ÉVÉNEMENT'}
            </span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {isFormCollapsed ? 'Développer ▼' : 'Réduire ▲'}
          </span>
        </div>
        
        {!isFormCollapsed && (
          <form onSubmit={handleAddEvent} style={{ padding: '18px 18px 14px 18px' }}>
            <div className="form-grid" style={{ marginBottom: '14px' }}>
              <div className="form-field">
                <div className="field-label">Nom de l'événement *</div>
                <input 
                  type="text" 
                  placeholder="ex : MIPIM Cannes" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <div className="field-label">Lieu</div>
                <input 
                  type="text" 
                  placeholder="ex : Cannes, France" 
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-field" style={{ flex: 1 }}>
                  <div className="field-label">Date de début *</div>
                  <input 
                    type="date" 
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <div className="field-label">Date de fin</div>
                  <input 
                    type="date" 
                    value={newEndDate}
                    onChange={e => setNewEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-field">
                <div className="field-label">Segment ciblé</div>
                <Select 
                  value={newSegment}
                  onValueChange={val => setNewSegment(val as 'Media' | 'Retail' | 'Instit' | '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les segments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tous les segments</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Instit">Instit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="form-field" style={{ gridColumn: 'span 2' }}>
                <div className="field-label">Objectif / Action clé</div>
                <input 
                  type="text" 
                  placeholder="ex : Rencontre 5 prospects et qualification" 
                  value={newObjective}
                  onChange={e => setNewObjective(e.target.value)}
                />
              </div>
               <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                {editingEventId && (
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={handleCancelEdit} 
                    style={{ height: '38px', minWidth: '100px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                  >
                    Annuler
                  </button>
                )}
                <button type="submit" className="btn btn-grad" style={{ height: '38px', minWidth: '160px' }}>
                  {editingEventId ? <Edit2 size={14} style={{ marginRight: '4px' }} /> : <Plus size={14} style={{ marginRight: '4px' }} />}
                  {editingEventId ? 'Sauvegarder' : "Créer l'événement"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Events Columns Lists */}
      <div className="two-col" style={{ gap: '20px' }}>
        {/* Upcoming events list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: '1' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', borderBottom: '1.5px solid var(--purple)', paddingBottom: '6px', marginBottom: '8px' }}>
            À VENIR ({upcomingEvents.length})
          </div>
          
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map(e => {
              const diff = getEventTimeDiff(e.event_date);
              return (
                <div key={e.id} className="event-card">
                  <div className="event-header">
                    <span className="event-title">{e.name}</span>
                    <span className={`event-countdown ${diff.cls}`}>{diff.text}</span>
                  </div>
                  
                  <div className="event-date-row">
                    <Calendar size={12} style={{ color: '#fff' }} />
                    <span>
                      {new Date(e.event_date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                      {e.end_date ? ` au ${new Date(e.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}` : ''}
                    </span>
                  </div>

                  {e.location && (
                    <div className="event-meta-row">
                      <MapPin size={12} />
                      <span>{e.location}</span>
                    </div>
                  )}

                  {e.objective && (
                    <div className="event-meta-row" style={{ marginTop: '8px', color: 'var(--text)' }}>
                      <Target size={12} />
                      <span><strong>Objectif :</strong> {e.objective}</span>
                    </div>
                  )}

                  <div className="event-footer">
                    {e.segment ? (
                      <span className={`badge badge-${e.segment.toLowerCase()}`}>{e.segment}</span>
                    ) : (
                      <span className="badge badge-neutral">Général</span>
                    )}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        className="btn-icon" 
                        onClick={() => handleStartEdit(e)} 
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}
                        title="Modifier l'événement"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button className="btn-icon-del" onClick={() => handleDeleteEvent(e.id)} title="Supprimer l'événement">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>Aucun événement à venir</div>
          )}
        </div>

        {/* Past events list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: '1' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', borderBottom: '1.5px solid var(--border)', paddingBottom: '6px', marginBottom: '8px' }}>
            HISTORIQUE DES ÉVÉNEMENTS ({pastEvents.length})
          </div>

          {pastEvents.length > 0 ? (
            pastEvents.map(e => {
              const diff = getEventTimeDiff(e.event_date);
              return (
                <div key={e.id} className="event-card" style={{ opacity: '0.7' }}>
                  <div className="event-header">
                    <span className="event-title">{e.name}</span>
                    <span className={`event-countdown ${diff.cls}`}>{diff.text}</span>
                  </div>
                  
                  <div className="event-date-row">
                    <Calendar size={12} style={{ color: '#fff' }} />
                    <span>
                      {new Date(e.event_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                  {e.location && (
                    <div className="event-meta-row">
                      <MapPin size={12} />
                      <span>{e.location}</span>
                    </div>
                  )}

                  <div className="event-footer">
                    {e.segment ? (
                      <span className={`badge badge-${e.segment.toLowerCase()}`}>{e.segment}</span>
                    ) : (
                      <span className="badge badge-neutral">Général</span>
                    )}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        className="btn-icon" 
                        onClick={() => handleStartEdit(e)} 
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}
                        title="Modifier l'événement"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button className="btn-icon-del" onClick={() => handleDeleteEvent(e.id)} title="Supprimer l'événement">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>Aucun événement passé</div>
          )}
        </div>
      </div>
    </div>
  );
};
