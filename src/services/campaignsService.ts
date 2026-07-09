// ============================================================
// campaigns.service.ts
// Gère les campagnes et les emails générés par IA.
// Fait le pont entre le UI React et Supabase (DB + Edge Fns).
// ============================================================

import { supabase } from './supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  objective: string;
  target_segment: 'Media' | 'Retail' | 'Instit' | 'All' | null;
  sequence_id: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed';
  system_prompt: string | null;
  tone: 'professionnel' | 'décontracté' | 'direct' | 'consultatif';
  created_by: string | null;
  emails_sent: number;
  emails_opened: number;
  emails_replied: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignMetrics extends Campaign {
  total_generated: number;
  total_sent: number;
  total_draft: number;
  total_opened: number;
  total_replied: number;
  open_rate: number | null;
  reply_rate: number | null;
}

export interface GeneratedEmail {
  id: string;
  lead_id: string;
  campaign_id: string | null;
  sequence_step_id: string | null;
  sujet: string;
  corps_du_mail: string;
  icebreaker: string | null;
  statut_envoi: 'draft' | 'approved' | 'sending' | 'sent' | 'failed';
  model_used: string;
  prompt_used: string | null;
  generation_ms: number | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
  resend_message_id: string | null;
  created_at: string;
  // Données du lead joinées
  lead?: {
    contact_name: string;
    company_name: string;
    email: string | null;
    poste: string | null;
    segment: string;
  } | null;
}

export interface SendResult {
  success: boolean;
  resendMessageId: string;
  sentAt: string;
  to: string;
}

// ── CRUD Campagnes ─────────────────────────────────────────────────────────────

export const campaignsService = {

  /** Récupère toutes les campagnes avec métriques agrégées */
  async getCampaigns(): Promise<CampaignMetrics[]> {
    const { data, error } = await supabase
      .from('campaign_metrics')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as CampaignMetrics[];
  },

  /** Récupère une campagne par ID */
  async getCampaignById(id: string): Promise<Campaign> {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Campaign;
  },

  /** Crée une nouvelle campagne */
  async createCampaign(
    campaign: Omit<Campaign, 'id' | 'emails_sent' | 'emails_opened' | 'emails_replied' | 'created_at' | 'updated_at'>
  ): Promise<Campaign> {
    const { data, error } = await supabase
      .from('campaigns')
      .insert([campaign])
      .select()
      .single();

    if (error) throw error;
    return data as Campaign;
  },

  /** Met à jour une campagne */
  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<void> {
    const { error } = await supabase
      .from('campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /** Supprime une campagne */
  async deleteCampaign(id: string): Promise<void> {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // ── Emails générés ───────────────────────────────────────────────────────────

  /** Récupère tous les emails générés d'une campagne */
  async getGeneratedEmails(
    campaignId: string,
    statut?: GeneratedEmail['statut_envoi']
  ): Promise<GeneratedEmail[]> {
    let query = supabase
      .from('generated_emails')
      .select(`
        *,
        lead:leads!lead_id(contact_name, company_name, email, poste, segment)
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (statut) {
      query = query.eq('statut_envoi', statut);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as GeneratedEmail[];
  },

  /** Récupère les emails générés hors campagne (flux automatique par lead) */
  async getUnassignedGeneratedEmails(statut?: GeneratedEmail['statut_envoi']): Promise<GeneratedEmail[]> {
    let query = supabase
      .from('generated_emails')
      .select(`
        *,
        lead:leads!lead_id(contact_name, company_name, email, poste, segment)
      `)
      .is('campaign_id', null)
      .order('created_at', { ascending: false });

    if (statut) {
      query = query.eq('statut_envoi', statut);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as GeneratedEmail[];
  },

  /** Récupère un email généré par ID */
  async getGeneratedEmailById(id: string): Promise<GeneratedEmail> {
    const { data, error } = await supabase
      .from('generated_emails')
      .select(`
        *,
        lead:leads!lead_id(contact_name, company_name, email, poste, segment)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as GeneratedEmail;
  },

  /** Met à jour le corps/sujet d'un email généré (édition manuelle) */
  async updateGeneratedEmail(
    id: string,
    updates: Partial<Pick<GeneratedEmail, 'sujet' | 'corps_du_mail' | 'icebreaker' | 'statut_envoi' | 'scheduled_at'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('generated_emails')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  /** Approuve un email ET le planifie sous quota */
  async approveAndSchedule(generatedEmailId: string): Promise<{ scheduledAt: string }> {
    const { data, error } = await supabase.rpc('schedule_send', { p_generated_email_id: generatedEmailId });
    if (error) throw error;
    return { scheduledAt: data as string };
  },

  /**
   * Envoie un email approuvé via l'Edge Function Resend.
   */
  async sendEmail(
    generatedEmailId: string,
    options?: { fromEmail?: string; fromName?: string }
  ): Promise<SendResult> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ generatedEmailId, ...options }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `Erreur envoi (${response.status})`);
    }

    return data as SendResult;
  },

  /** Déclenche la purge de la file d'envoi du jour (bouton manuel) */
  async flushSendQueue(): Promise<{ processed: number; sent: number; failed: number; skipped?: string }> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/flush-send-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ triggeredBy: 'manual-button' }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Erreur purge file (${response.status})`);
    }
    return data;
  },

  /** Supprime un email généré */
  async deleteGeneratedEmail(id: string): Promise<void> {
    const { error } = await supabase
      .from('generated_emails')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
