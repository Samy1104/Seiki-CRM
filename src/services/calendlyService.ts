// ============================================================
// calendlyService.ts
// Accès au compte Calendly connecté et aux rendez-vous synchronisés.
// ============================================================

import { supabase } from './supabaseClient';

export interface CalendlyAccount {
  id: string;
  calendly_user_uri: string;
  connected_at: string;
}

export interface CalendlyBooking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  invitee_name: string;
  invitee_email: string;
  location: string | null;
  status: 'active' | 'canceled';
  cancel_reason: string | null;
  lead_id: string | null;
}

export const calendlyService = {
  async getAccount(): Promise<CalendlyAccount | null> {
    const { data, error } = await supabase
      .from('calendly_accounts')
      .select('id, calendly_user_uri, connected_at')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async listBookings(): Promise<CalendlyBooking[]> {
    const { data, error } = await supabase
      .from('calendly_bookings')
      .select('id, title, start_time, end_time, invitee_name, invitee_email, location, status, cancel_reason, lead_id')
      .order('start_time', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  oauthConnectUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const params = new URLSearchParams({ origin: window.location.origin });
    return `${supabaseUrl}/functions/v1/calendly-oauth-start?${params.toString()}`;
  },
};
