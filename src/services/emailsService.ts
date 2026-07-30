// ============================================================
// emailsService.ts
// Gère les emails générés (drafts, approbation, envoi).
// Fait le pont entre le UI React et Supabase (DB + Edge Fns).
// ============================================================

import { supabase } from './supabaseClient';
import { callEdgeFunction } from './edgeFunctions';
import { templatesService } from './templatesService';
import type { Lead } from './leadsService';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GeneratedEmail {
  id: string;
  lead_id: string;
  sequence_step_id: string | null;
  sujet: string;
  corps_du_mail: string;
  icebreaker: string | null;
  statut_envoi: 'draft' | 'approved' | 'scheduled' | 'sending' | 'sent' | 'failed';
  model_used: string;
  prompt_used: string | null;
  generation_ms: number | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  created_at: string;
  lead?: {
    id?: string;
    contact_name: string;
    company_name: string;
    email: string | null;
    poste: string | null;
    segment: string;
    custom_fields?: Record<string, string>;
  } | null;
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
        lead:leads!lead_id(id, contact_name, company_name, email, poste, segment, custom_fields)
      `)
      .order('created_at', { ascending: false });

    if (Array.isArray(statut)) {
      query = query.in('statut_envoi', statut);
    } else if (statut) {
      query = query.eq('statut_envoi', statut);
    }

    const { data, error } = await query;
    if (error) throw error;
    const emails = (data || []) as GeneratedEmail[];

    // Auto-render placeholders if any raw {{variable}} tags exist in draft subject or body
    for (const email of emails) {
      if (email.lead && (email.sujet?.includes('{{') || email.corps_du_mail?.includes('{{'))) {
        const rendered = templatesService.renderTemplate(
          { subject: email.sujet, body: email.corps_du_mail },
          email.lead as unknown as Lead
        );
        if (rendered.subject !== email.sujet || rendered.body !== email.corps_du_mail) {
          email.sujet = rendered.subject;
          email.corps_du_mail = rendered.body;
          // Persist rendered subject and body to DB asynchronously
          supabase
            .from('generated_emails')
            .update({ sujet: rendered.subject, corps_du_mail: rendered.body })
            .eq('id', email.id)
            .then(() => {});
        }
      }
    }

    return emails;
  },

  /** Récupère un email généré par ID */
  async getGeneratedEmailById(id: string): Promise<GeneratedEmail> {
    const { data, error } = await supabase
      .from('generated_emails')
      .select(`
        *,
        lead:leads!lead_id(id, contact_name, company_name, email, poste, segment, custom_fields)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    const email = data as GeneratedEmail;
    if (email.lead && (email.sujet?.includes('{{') || email.corps_du_mail?.includes('{{'))) {
      const rendered = templatesService.renderTemplate(
        { subject: email.sujet, body: email.corps_du_mail },
        email.lead as unknown as Lead
      );
      email.sujet = rendered.subject;
      email.corps_du_mail = rendered.body;
    }
    return email;
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

  /** Approuve un email — rejoint la file de pacing (schedule-gmail-sends l'y prendra) */
  async approveAndSchedule(generatedEmailId: string): Promise<void> {
    const { error } = await supabase
      .from('generated_emails')
      .update({ statut_envoi: 'approved', scheduled_at: null, approved_at: new Date().toISOString() })
      .eq('id', generatedEmailId);
    if (error) throw error;
  },

  /** Approuve et envoie immédiatement un email (bypass la planification) */
  async sendNow(generatedEmailId: string): Promise<void> {
    const now = new Date(Date.now() - 60000).toISOString(); // 1 minute dans le passé pour garantir scheduled_at <= NOW()
    const { error } = await supabase
      .from('generated_emails')
      .update({
        statut_envoi: 'scheduled',
        scheduled_at: now,
        approved_at: new Date().toISOString(),
      })
      .eq('id', generatedEmailId);

    if (error) throw error;
    await callEdgeFunction('dispatch-gmail-sends', { triggeredBy: 'manual-button', emailId: generatedEmailId });
  },

  /** Lance immédiatement un cycle pacing + dispatch (bouton manuel de test) */
  async runPacingCycleNow(): Promise<{ scheduled: number; processed: number; sent: number; failed: number }> {
    const scheduleResult = await callEdgeFunction<{ scheduled?: number; skipped?: string }>(
      'schedule-gmail-sends', { triggeredBy: 'manual-button' }
    );
    const dispatchResult = await callEdgeFunction<{ processed: number; sent: number; failed: number }>(
      'dispatch-gmail-sends', { triggeredBy: 'manual-button' }
    );
    return { scheduled: scheduleResult.scheduled ?? 0, processed: dispatchResult.processed, sent: dispatchResult.sent, failed: dispatchResult.failed };
  },

  /** Envoi manuel ad-hoc (test) — hors pipeline de pacing, pas de lead requis */
  async sendTestEmail(toEmail: string, subject: string, body: string): Promise<{ to: string; sentAt: string }> {
    const data = await callEdgeFunction<{ success: boolean; to: string; sentAt: string; error?: string }>(
      'send-test-email', { toEmail, subject, body }
    );
    if (!data.success) throw new Error(data.error || 'Erreur envoi test');
    return { to: data.to, sentAt: data.sentAt };
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
