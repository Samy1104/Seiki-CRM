import React, { useState, useRef, useMemo } from 'react';
import { useAgendaEvents } from '../hooks/useAgendaEvents';
import { downloadIcalFile } from '../utils/icalHelpers';
import { confirmAction } from '../utils/confirmAction';
import { AgendaHeader } from './agenda/AgendaHeader';
import { AgendaFilterBar } from './agenda/AgendaFilterBar';
import { AgendaCalendarGrid } from './agenda/AgendaCalendarGrid';
import { EventFormModal } from './agenda/EventFormModal';
import { IcalFeedModal } from './agenda/IcalFeedModal';
import CalendarModal from '../components/CalendarModal';
import type { EventItem } from '../services/eventsService';

export const Agenda: React.FC = () => {
  const {
    events,
    loading,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useAgendaEvents();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('Tous les segments');

  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [feedModalOpen, setFeedModalOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const monthPickerRef = useRef<HTMLButtonElement>(null);

  // Filter events by search term and segment
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchSearch =
        !searchTerm ||
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.location && e.location.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchSegment =
        !selectedSegment ||
        selectedSegment === 'Tous les segments' ||
        e.segment === selectedSegment;
      return matchSearch && matchSegment;
    });
  }, [events, searchTerm, selectedSegment]);

  // Split into Upcoming and Past events
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingEvents = useMemo(
    () => filteredEvents.filter((e) => e.event_date >= todayStr),
    [filteredEvents, todayStr]
  );
  const pastEvents = useMemo(
    () => filteredEvents.filter((e) => e.event_date < todayStr),
    [filteredEvents, todayStr]
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
    const evDate = new Date(dateStr);
    evDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - evDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  };

  const handleStartEdit = (event: EventItem) => {
    setEditingEvent(event);
    setEventModalOpen(true);
  };

  const confirmDelete = (id: string) => {
    if (confirmAction('Voulez-vous vraiment supprimer cet événement ?')) {
      handleDeleteEvent(id);
    }
  };

  const handleSaveEvent = async (eventData: Omit<EventItem, 'id' | 'created_at' | 'updated_at' | 'ical_uid'>) => {
    if (editingEvent) {
      await handleUpdateEvent(editingEvent.id, eventData);
    } else {
      await handleCreateEvent(eventData);
    }
    setEditingEvent(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>
          Chargement de l'agenda...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6" style={{ overflowY: 'auto' }}>
      {/* Header */}
      <AgendaHeader
        currentDate={currentDate}
        onPrevMonth={() =>
          setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
        }
        onNextMonth={() =>
          setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
        }
        onToday={() => setCurrentDate(new Date())}
        onOpenDatePicker={() => setDatePickerOpen(true)}
        onExportIcal={() => downloadIcalFile(events)}
        onOpenFeedModal={() => setFeedModalOpen(true)}
        onNewEventClick={() => {
          setEditingEvent(null);
          setEventModalOpen(true);
        }}
      />

      {/* Filter Bar */}
      <AgendaFilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedSegment={selectedSegment}
        setSelectedSegment={setSelectedSegment}
      />

      {/* Main Grid Views (Upcoming & Past) */}
      <AgendaCalendarGrid
        upcomingEvents={upcomingEvents}
        pastEvents={pastEvents}
        formatDateFr={formatDateFr}
        getDaysAgo={getDaysAgo}
        onEdit={handleStartEdit}
        onDelete={confirmDelete}
      />

      {/* Create / Edit Event Modal */}
      <EventFormModal
        isOpen={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
        }}
        editingEvent={editingEvent}
        onSubmit={handleSaveEvent}
        formatDateFr={formatDateFr}
      />

      {/* iCal Feed Modal */}
      <IcalFeedModal
        isOpen={feedModalOpen}
        onClose={() => setFeedModalOpen(false)}
      />

      {/* DatePicker Popup */}
      {datePickerOpen && (
        <CalendarModal
          value={currentDate.toISOString().slice(0, 10)}
          onChange={(v) => {
            setCurrentDate(new Date(v + 'T12:00:00'));
            setDatePickerOpen(false);
          }}
          onClose={() => setDatePickerOpen(false)}
          anchorRef={monthPickerRef}
        />
      )}
    </div>
  );
};

export default Agenda;
