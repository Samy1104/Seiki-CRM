import { calendlyService, type CalendlyBooking } from '../services/calendlyService';
import { useToast } from '../context/ToastContext';
import { useCachedResource } from './useCachedResource';

export function useCalendlyBookings() {
  const { showToast } = useToast();
  const onError = (err: unknown) => {
    console.error('Error loading Calendly bookings:', err);
    showToast('Erreur lors du chargement des rendez-vous Calendly', 'error');
  };

  const bookingsRes = useCachedResource<CalendlyBooking[]>(
    'calendlyBookings',
    () => calendlyService.listBookings(),
    [],
    { onError },
  );

  return {
    bookings: bookingsRes.data,
    loadingBookings: bookingsRes.loading,
    reloadBookings: bookingsRes.reload,
  };
}
