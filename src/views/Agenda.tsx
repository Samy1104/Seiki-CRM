import React, { useState, useMemo } from 'react';
import { useAgendaEvents } from '../hooks/useAgendaEvents';
import { downloadIcalFile, ICAL_FEED_URL } from '../utils/icalHelpers';
import { useToast } from '../context/ToastContext';
import { AgendaHeader } from './agenda/AgendaHeader';
import { AgendaForm } from './agenda/AgendaForm';
import { AgendaTabs } from './agenda/AgendaTabs';
import { EventCard } from './agenda/EventCard';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import type { EventItem } from '../services/eventsService';

export const Agenda: React.FC = () => {
  const {
    events,
    loading,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useAgendaEvents();
  const { showToast } = useToast();

  const [formOpen, setFormOpen] = useState(true);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleCopyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(ICAL_FEED_URL);
      showToast("URL d'abonnement copiée dans le presse-papier");
    } catch {
      showToast("Erreur lors de la copie de l'URL", "error");
    }
  };

  // Split events into Upcoming and Past
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingEvents = useMemo(
    () => events.filter((e) => e.event_date >= todayStr),
    [events, todayStr]
  );
  const pastEvents = useMemo(
    () => events.filter((e) => e.event_date < todayStr),
    [events, todayStr]
  );

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
          upcomingCount={upcomingEvents.length}
          pastCount={pastEvents.length}
        />

        {/* Tab Content / Events List */}
        <div key={activeTab} className="mt-6 animate-tab-fade">
          {activeTab === 'upcoming' &&
            (upcomingEvents.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[13px]" style={{ color: '#444' }}>
                  Aucun événement à venir
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {upcomingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    formatDateFr={formatDateFr}
                    onEdit={() => handleStartEdit(event)}
                    onDelete={() => confirmDelete(event.id)}
                  />
                ))}
              </div>
            ))}

          {activeTab === 'past' &&
            (pastEvents.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[13px]" style={{ color: '#444' }}>
                  Aucun événement dans l'historique
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {pastEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    past
                    daysAgo={getDaysAgo(event.event_date)}
                    formatDateFr={formatDateFr}
                    onEdit={() => handleStartEdit(event)}
                    onDelete={() => confirmDelete(event.id)}
                  />
                ))}
              </div>
            ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};

export default Agenda;
