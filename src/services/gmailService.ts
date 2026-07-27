// ============================================================
// gmailService.ts
// Accès au compte Gmail connecté pour l'envoi de prospection.
// ============================================================

import { supabase } from './supabaseClient';

export interface GmailAccount {
  id: string;
  email: string;
  expires_at: string;
  connected_at: string;
}

export const gmailService = {
  async getAccount(): Promise<GmailAccount | null> {
    const { data, error } = await supabase
      .from('gmail_accounts')
      .select('id, email, expires_at, connected_at')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  oauthConnectUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const params = new URLSearchParams({ origin: window.location.origin });
    return `${supabaseUrl}/functions/v1/gmail-oauth-start?${params.toString()}`;
  },
};
