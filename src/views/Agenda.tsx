import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAgendaEvents } from '../hooks/useAgendaEvents';
import { useCalendlyBookings } from '../hooks/useCalendlyBookings';
import { calendlyService, type CalendlyAccount, type CalendlyBooking } from '../services/calendlyService';
import { downloadIcalFile, ICAL_FEED_URL } from '../utils/icalHelpers';
import { useToast } from '../context/ToastContext';
import { AgendaHeader } from './agenda/AgendaHeader';
import { AgendaForm } from './agenda/AgendaForm';
import { AgendaTabs } from './agenda/AgendaTabs';
import { EventCard } from './agenda/EventCard';
import { BookingCard } from './agenda/BookingCard';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import type { EventItem } from '../services/eventsService';

type AgendaItem =
  | { kind: 'event'; sortKey: number; event: EventItem }
  | { kind: 'booking'; sortKey: number; booking: CalendlyBooking };

export const Agenda: React.FC = () => {
  const {
    events,
    loading,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useAgendaEvents();
  const { bookings, reloadBookings } = useCalendlyBookings();
  const { showToast } = useToast();

  const [formOpen, setFormOpen] = useState(true);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [calendlyAccount, setCalendlyAccount] = useState<CalendlyAccount | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendlyStatus = params.get('calendly');
    // Après un retour de connexion réussie, l'appel ci-dessous récupère déjà
    // le compte à jour — pas besoin d'un second getAccount() avant.
    calendlyService.getAccount().then(setCalendlyAccount).catch(() => {});

    if (calendlyStatus === 'connected') {
      showToast('Compte Calendly connecté.', 'success');
      reloadBookings();
    } else if (calendlyStatus === 'error') {
      showToast(params.get('message') || 'Connexion Calendly échouée.', 'error');
    }
    if (calendlyStatus) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Les rendez-vous Calendly sont synchronisés côté serveur toutes les 5 min
  // (poll-calendly-bookings) indépendamment de cette page — sans ce polling,
  // un nouveau rendez-vous ou une annulation n'apparaîtrait qu'après un
  // rechargement manuel de l'onglet Agenda.
  // reloadBookings est une nouvelle référence à chaque rendu (useCachedResource
  // ne la mémoïse pas) : passer par une ref évite de relancer l'intervalle à
  // chaque re-rendu de la page, ce qui l'empêcherait quasiment de se déclencher.
  const reloadBookingsRef = useRef(reloadBookings);
  reloadBookingsRef.current = reloadBookings;

  useEffect(() => {
    const intervalId = setInterval(() => {
      reloadBookingsRef.current();
    }, 60_000);
    return () => clearInterval(intervalId);
  }, []);

  const handleCalendlyDisconnect = async () => {
    try {
      if (calendlyAccount) await calendlyService.disconnect(calendlyAccount.id);
      setCalendlyAccount(null);
      window.location.href = calendlyService.oauthConnectUrl();
    } catch {
      showToast('Erreur lors de la déconnexion Calendly.', 'error');
    }
  };

  const handleCopyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(ICAL_FEED_URL);
      showToast("URL d'abonnement copiée dans le presse-papier");
    } catch {
      showToast("Erreur lors de la copie de l'URL", "error");
    }
  };

  // Fusionne événements manuels et rendez-vous Calendly en une seule
  // timeline triée. Les event_date (jour seul) sont comparés à minuit pour
  // rester cohérents avec les start_time (horodatage précis) des bookings.
  const allItems = useMemo<AgendaItem[]>(() => {
    const eventItems: AgendaItem[] = events.map((event) => ({
      kind: 'event',
      sortKey: new Date(`${event.event_date}T00:00:00`).getTime(),
      event,
    }));
    const bookingItems: AgendaItem[] = bookings.map((booking) => ({
      kind: 'booking',
      sortKey: new Date(booking.start_time).getTime(),
      booking,
    }));
    return [...eventItems, ...bookingItems].sort((a, b) => a.sortKey - b.sortKey);
  }, [events, bookings]);

  const nowMs = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayStartMs = new Date(`${todayStr}T00:00:00`).getTime();
  // Frontière volontairement asymétrique : les bookings (horodatage précis)
  // basculent en Historique dès que passés, alors que les events (jour
  // seul) restent en À venir toute leur journée — cohérent avec le sens de
  // chaque type de donnée.
  const isUpcoming = (item: AgendaItem) =>
    item.sortKey >= (item.kind === 'booking' ? nowMs : todayStartMs);

  const upcomingItems = useMemo(() => allItems.filter(isUpcoming), [allItems, nowMs, todayStartMs]);
  const pastItems = useMemo(() => allItems.filter((item) => !isUpcoming(item)), [allItems, nowMs, todayStartMs]);

  const formatDateFr = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getDaysAgo = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const evDate = new Date(dateStr + 'T12:00:00');
    evDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - evDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  };

  const handleStartEdit = (event: EventItem) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingEvent(null);
  };

  const confirmDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      handleDeleteEvent(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  const handleConfirmDeleteBooking = async () => {
    if (!deleteBookingId) return;
    try {
      await calendlyService.deleteBooking(deleteBookingId);
      reloadBookings();
    } catch {
      showToast('Erreur lors de la suppression du rendez-vous.', 'error');
    } finally {
      setDeleteBookingId(null);
    }
  };

  const handleSaveEvent = async (eventData: {
    name: string;
    event_date: string;
    end_date: string | null;
    location: string | null;
    segment: string | null;
    objective: string | null;
  }) => {
    if (editingEvent) {
      await handleUpdateEvent(editingEvent.id, eventData);
      setEditingEvent(null);
    } else {
      await handleCreateEvent({ ...eventData, created_by: null });
    }
  };

  if (loading) {
    return (
      <div
        className="size-full flex flex-col items-center justify-center py-20"
        style={{ background: 'var(--color-charcoal, #0d0d0d)', color: 'var(--color-charcoal-fg-soft, #b0afa8)' }}
      >
        <div className="loading-spinner mb-3" />
        <span className="text-xs tracking-widest uppercase">Chargement de l'agenda...</span>
      </div>
    );
  }

  return (
    <div
      className="size-full overflow-y-auto"
      style={{
        background: 'var(--color-charcoal, #0d0d0d)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Header */}
        <AgendaHeader
          onExportIcal={() => downloadIcalFile(events)}
          onCopyFeedUrl={handleCopyFeedUrl}
          calendlyAccount={calendlyAccount}
          calendlyConnectUrl={calendlyService.oauthConnectUrl()}
          onCalendlyDisconnect={handleCalendlyDisconnect}
        />

        {/* Collapsible Form (Add / Edit) */}
        <AgendaForm
          formOpen={formOpen}
          setFormOpen={setFormOpen}
          editingEvent={editingEvent}
          onSaveEvent={handleSaveEvent}
          onCancelEdit={handleCancelEdit}
        />

        {/* Tabs Switcher */}
        <AgendaTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          upcomingCount={upcomingItems.length}
          pastCount={pastItems.length}
        />

        {/* Tab Content / Events List */}
        <div key={activeTab} className="mt-6 animate-tab-fade">
          {activeTab === 'upcoming' &&
            (upcomingItems.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[13px]" style={{ color: '#444' }}>
                  Aucun événement à venir
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {upcomingItems.map((item) =>
                  item.kind === 'event' ? (
                    <EventCard
                      key={`event-${item.event.id}`}
                      event={item.event}
                      formatDateFr={formatDateFr}
                      onEdit={() => handleStartEdit(item.event)}
                      onDelete={() => confirmDelete(item.event.id)}
                    />
                  ) : (
                    <BookingCard key={`booking-${item.booking.id}`} booking={item.booking} onDelete={() => setDeleteBookingId(item.booking.id)} />
                  ),
                )}
              </div>
            ))}

          {activeTab === 'past' &&
            (pastItems.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[13px]" style={{ color: '#444' }}>
                  Aucun événement dans l'historique
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {pastItems.map((item) =>
                  item.kind === 'event' ? (
                    <EventCard
                      key={`event-${item.event.id}`}
                      event={item.event}
                      past
                      daysAgo={getDaysAgo(item.event.event_date)}
                      formatDateFr={formatDateFr}
                      onEdit={() => handleStartEdit(item.event)}
                      onDelete={() => confirmDelete(item.event.id)}
                    />
                  ) : (
                    <BookingCard key={`booking-${item.booking.id}`} booking={item.booking} onDelete={() => setDeleteBookingId(item.booking.id)} />
                  ),
                )}
              </div>
            ))}
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
      <ConfirmDeleteModal
        isOpen={!!deleteBookingId}
        onConfirm={handleConfirmDeleteBooking}
        onCancel={() => setDeleteBookingId(null)}
      />
    </div>
  );
};

export default Agenda;
