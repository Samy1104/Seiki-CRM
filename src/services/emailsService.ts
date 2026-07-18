// ============================================================
// emailsService.ts
// Gère les emails générés (drafts, approbation, envoi).
// Fait le pont entre le UI React et Supabase (DB + Edge Fns).
// ============================================================

import { supabase } from './supabaseClient';
import { callEdgeFunction } from './edgeFunctions';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GeneratedEmail {
  id: string;
  lead_id: string;
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

// ── Service ────────────────────────────────────────────────────────────────────

export const emailsService = {

  /** Récupère tous les emails générés, filtrés optionnellement par statut (un seul ou plusieurs) */
  async getGeneratedEmails(
    statut?: GeneratedEmail['statut_envoi'] | GeneratedEmail['statut_envoi'][]
  ): Promise<GeneratedEmail[]> {
    let query = supabase
      .from('generated_emails')
      .select(`
        *,
        lead:leads!lead_id(contact_name, company_name, email, poste, segment)
      `)
      .order('created_at', { ascending: false });

    if (Array.isArray(statut)) {
      query = query.in('statut_envoi', statut);
    } else if (statut) {
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
    const data = await callEdgeFunction<SendResult & { success: boolean; error?: string }>(
      'send-email',
      { generatedEmailId, ...options }
    );

    if (!data.success) {
      throw new Error(data.error || 'Erreur envoi');
    }

    return data;
  },

  /** Déclenche la purge de la file d'envoi du jour (bouton manuel) */
  async flushSendQueue(): Promise<{ processed: number; sent: number; failed: number; skipped?: string }> {
    return callEdgeFunction('flush-send-queue', { triggeredBy: 'manual-button' });
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
