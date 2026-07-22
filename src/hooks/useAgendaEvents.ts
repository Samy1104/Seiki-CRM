import { eventsService, type EventItem } from '../services/eventsService';
import { useToast } from '../context/ToastContext';
import { useCachedResource } from './useCachedResource';

export function useAgendaEvents() {
  const { showToast } = useToast();
  const onError = (err: unknown) => {
    console.error('Error loading agenda events:', err);
    showToast('Erreur lors du chargement de l\'agenda', 'error');
  };

  const eventsRes = useCachedResource<EventItem[]>('agendaEvents', () => eventsService.getEvents(), [], { onError });
  const events = eventsRes.data;
  const loading = eventsRes.loading;
  const loadEvents = () => eventsRes.reload();

  const handleCreateEvent = async (eventData: Omit<EventItem, 'id' | 'created_at' | 'updated_at' | 'ical_uid'>) => {
    try {
      await eventsService.createEvent(eventData);
      showToast('Événement créé avec succès');
      loadEvents();
    } catch (err) {
      console.error('Error creating event:', err);
      showToast('Erreur de création de l\'événement', 'error');
    }
  };

  const handleUpdateEvent = async (id: string, updates: Partial<EventItem>) => {
    try {
      await eventsService.updateEvent(id, updates);
      showToast('Événement mis à jour');
      loadEvents();
    } catch (err) {
      console.error('Error updating event:', err);
      showToast('Erreur de mise à jour', 'error');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await eventsService.deleteEvent(id);
      showToast('Événement supprimé');
      loadEvents();
    } catch (err) {
      console.error('Error deleting event:', err);
      showToast('Erreur de suppression', 'error');
    }
  };

  return {
    events,
    loading,
    reloadEvents: loadEvents,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  };
}
