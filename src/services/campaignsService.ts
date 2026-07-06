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

export interface GenerateResult {
  success: boolean;
  generatedEmail: GeneratedEmail;
  meta: {
    model: string;
    generationMs: number;
    tokens: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };
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

  // ── Génération IA ────────────────────────────────────────────────────────────

  /**
   * Génère un email personnalisé pour UN lead via l'Edge Function.
   * @returns L'email généré (en statut 'draft') avec toutes ses données.
   */
  async generateEmailForLead(leadId: string, campaignId: string): Promise<GenerateResult> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ leadId, campaignId }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `Erreur Edge Function (${response.status})`);
    }

    return data as GenerateResult;
  },

  /**
   * Génère des emails pour PLUSIEURS leads (batch) avec rate-limiting.
   * Envoie 1 requête à la fois avec 300ms de délai entre chaque.
   * @returns Résultats {success, failed} avec les emails générés.
   */
  async bulkGenerateEmails(
    leadIds: string[],
    campaignId: string,
    onProgress?: (current: number, total: number, leadId: string) => void
  ): Promise<{ success: GeneratedEmail[]; failed: Array<{ leadId: string; error: string }> }> {
    const success: GeneratedEmail[] = [];
    const failed: Array<{ leadId: string; error: string }> = [];

    for (let i = 0; i < leadIds.length; i++) {
      const leadId = leadIds[i];

      try {
        onProgress?.(i + 1, leadIds.length, leadId);
        const result = await this.generateEmailForLead(leadId, campaignId);
        success.push(result.generatedEmail);
      } catch (err) {
        failed.push({
          leadId,
          error: err instanceof Error ? err.message : 'Erreur inconnue',
        });
      }

      // Délai de 300ms entre chaque génération pour éviter le rate-limiting OpenAI
      if (i < leadIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    return { success, failed };
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

  /** Approuve un email (statut draft → approved) */
  async approveEmail(id: string, approverId?: string): Promise<void> {
    const { error } = await supabase
      .from('generated_emails')
      .update({
        statut_envoi: 'approved',
        approved_by: approverId || null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
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

  /** Supprime un email généré */
  async deleteGeneratedEmail(id: string): Promise<void> {
    const { error } = await supabase
      .from('generated_emails')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
