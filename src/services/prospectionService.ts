// ============================================================
// prospectionService.ts
// Logique métier de séquençage et de suivi des relances.
// Gère l'état des séquences (idle → active → completed/replied)
// et détecte les leads à relancer.
// ============================================================

import { supabase } from './supabaseClient';
import type { Lead } from './leadsService';
import { settingsService } from './settingsService';
import { templatesService } from './templatesService';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProspectionLead extends Lead {
  poste: string | null;
  enrichi_contexte: string | null;
}

export interface EmailLog {
  id: string;
  lead_id: string;
  generated_email_id: string | null;
  direction: 'outbound' | 'inbound';
  from_email: string;
  to_email: string;
  subject: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | 'failed';
  opened_at: string | null;
  replied_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface FollowUpCandidate {
  lead: ProspectionLead;
  lastEmailSentAt: string;
  daysSinceLastEmail: number;
  hasOpened: boolean;
  hasReplied: boolean;
  followUpCount: number;    // Nombre de relances déjà envoyées
  recommendedAction: 'follow_up_1' | 'follow_up_2' | 'archive' | 'wait';
}

// ── Service ────────────────────────────────────────────────────────────────────

export const prospectionService = {

  /**
   * Récupère les leads éligibles à la prospection :
   * - Non archivés
   * - Email présent et vérifié (ou au moins présent)
   * - Séquence idle (pas encore contactés) ou active
   * - Segement optionnel
   */
  async getLeadsReadyForProspection(
    segment?: 'Media' | 'Retail' | 'Instit'
  ): Promise<ProspectionLead[]> {
    let query = supabase
      .from('leads')
      .select(`
        *,
        owner:team_members!owner_id(*),
        stage:pipeline_stages!stage_id(*)
      `)
      .eq('is_archived', false)
      .is('merged_into_id', null)
      .not('email', 'is', null)     // Email obligatoire
      .in('sequence_status', ['idle', 'active'])
      .order('score', { ascending: false });

    if (segment) {
      query = query.eq('segment', segment);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as ProspectionLead[];
  },

  async getFollowUpCandidates(): Promise<FollowUpCandidate[]> {
    const { followup_1_days, followup_2_days, archive_after_followups } = await settingsService.getProspectionSettings();
    const daysThreshold = followup_1_days;

    const { data: sentEmails, error } = await supabase
      .from('generated_emails')
      .select(`
        lead_id,
        sent_at,
        lead:leads!lead_id(
          id, contact_name, company_name, email, segment, sequence_status,
          is_archived, merged_into_id, poste, enrichi_contexte, custom_fields,
          score, stage_id, owner_id, created_at, updated_at,
          note, email_verified, phone, linkedin_url, website, domain,
          deal_value, source, days_in_stage, stage_changed_at
        )
      `)
      .eq('statut_envoi', 'sent')
      .gte('sent_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('sent_at', { ascending: false });

    if (error) throw error;

    const leadIds = [...new Set((sentEmails || []).map((e) => e.lead_id as string))];
    if (leadIds.length === 0) return [];

    const { data: logs } = await supabase
      .from('email_logs')
      .select('lead_id, status, opened_at, replied_at, generated_email_id')
      .in('lead_id', leadIds)
      .eq('direction', 'outbound');

    const now = Date.now();
    const candidates: FollowUpCandidate[] = [];
    const processedLeads = new Set<string>();

    for (const sentEmail of sentEmails || []) {
      const leadId = sentEmail.lead_id as string;
      if (processedLeads.has(leadId)) continue;
      processedLeads.add(leadId);

      const lead = sentEmail.lead as unknown as ProspectionLead;
      if (!lead || lead.is_archived || lead.merged_into_id) continue;
      if (lead.sequence_status === 'replied' || lead.sequence_status === 'completed') continue;

      const leadLogs = (logs || []).filter((l) => l.lead_id === leadId);
      const hasOpened = leadLogs.some((l) => l.status === 'opened');
      const hasReplied = leadLogs.some((l) => l.status === 'replied');

      if (hasReplied) continue;

      const sentAt = sentEmail.sent_at as string;
      const daysSince = Math.floor((now - new Date(sentAt).getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince < daysThreshold) continue;

      const followUpCount = (sentEmails || []).filter((e) => e.lead_id === leadId).length - 1;

      let recommendedAction: FollowUpCandidate['recommendedAction'] = 'wait';
      if (daysSince >= followup_1_days && followUpCount === 0) {
        recommendedAction = 'follow_up_1';
      } else if (daysSince >= followup_2_days && followUpCount === 1) {
        recommendedAction = 'follow_up_2';
      } else if (followUpCount >= archive_after_followups) {
        recommendedAction = 'archive';
      }

      candidates.push({
        lead, lastEmailSentAt: sentAt, daysSinceLastEmail: daysSince,
        hasOpened, hasReplied, followUpCount, recommendedAction,
      });
    }

    return candidates.sort((a, b) => {
      const order = { follow_up_1: 0, follow_up_2: 1, archive: 2, wait: 3 };
      return order[a.recommendedAction] - order[b.recommendedAction];
    });
  },

  /** Crée un draft de relance (relance_1 ou relance_2) pour un lead, à partir du template de la bibliothèque */
  async createFollowUpDraft(
    lead: ProspectionLead,
    step: 'relance_1' | 'relance_2',
  ): Promise<{ id: string; sujet: string; corps_du_mail: string }> {
    const templates = await templatesService.getTemplates();
    const template = templatesService.resolveTemplate(templates, lead.segment, step);
    if (!template) {
      throw new Error(`Aucun template trouvé pour ${lead.segment}/${step}`);
    }

    const rendered = templatesService.renderTemplate(template, lead as unknown as Lead);

    const { data, error } = await supabase
      .from('generated_emails')
      .insert([{
        lead_id: lead.id,
        step,
        sujet: rendered.subject,
        corps_du_mail: rendered.body,
        statut_envoi: 'draft',
        model_used: 'template',
      }])
      .select('id, sujet, corps_du_mail')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Récupère l'historique email complet d'un lead.
   */
  async getLeadEmailHistory(leadId: string): Promise<EmailLog[]> {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as EmailLog[];
  },

  /**
   * Met à jour le statut de séquence d'un lead.
   */
  async updateLeadSequenceStatus(
    leadId: string,
    status: Lead['sequence_status']
  ): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .update({ sequence_status: status, updated_at: new Date().toISOString() })
      .eq('id', leadId);

    if (error) throw error;

    // Log dans history
    const statusLabels: Record<string, string> = {
      idle: 'Séquence réinitialisée',
      active: 'Séquence activée',
      paused: 'Séquence mise en pause',
      completed: 'Séquence terminée',
      replied: 'Réponse reçue — séquence terminée',
    };

    await supabase.from('history').insert([{
      lead_id: leadId,
      action_type: 'sequence_start',
      content: statusLabels[status] || `Statut séquence → ${status}`,
      metadata: { sequence_status: status },
      is_auto: false,
    }]);
  },

  /**
   * Met à jour le contexte enrichi d'un lead (informations IA).
   */
  async updateEnrichmentContext(leadId: string, contexte: string): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .update({
        enrichi_contexte: contexte,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    if (error) throw error;
  },

  /**
   * Met à jour le poste d'un lead (pour la personnalisation IA).
   */
  async updateLeadPoste(leadId: string, poste: string): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .update({ poste, updated_at: new Date().toISOString() })
      .eq('id', leadId);

    if (error) throw error;
  },

  /**
   * Statistiques globales de prospection pour le dashboard.
   */
  async getProspectionStats(): Promise<{
    totalLeadsWithEmail: number;
    totalEmailsSent: number;
    totalOpened: number;
    totalReplied: number;
    globalOpenRate: number;
    globalReplyRate: number;
    leadsInSequence: number;
  }> {
    const [leadsResult, emailsResult, logsResult] = await Promise.all([
      supabase
        .from('leads')
        .select('id, sequence_status', { count: 'exact' })
        .eq('is_archived', false)
        .not('email', 'is', null),
      supabase
        .from('generated_emails')
        .select('id', { count: 'exact' })
        .eq('statut_envoi', 'sent'),
      supabase
        .from('email_logs')
        .select('status', { count: 'exact' })
        .eq('direction', 'outbound'),
    ]);

    const allLeads = leadsResult.data || [];
    const totalLeadsWithEmail = leadsResult.count || 0;
    const totalEmailsSent = emailsResult.count || 0;
    const allLogs = logsResult.data || [];

    const totalOpened = allLogs.filter((l) => l.status === 'opened').length;
    const totalReplied = allLogs.filter((l) => l.status === 'replied').length;
    const leadsInSequence = allLeads.filter((l) => l.sequence_status === 'active').length;

    return {
      totalLeadsWithEmail,
      totalEmailsSent,
      totalOpened,
      totalReplied,
      globalOpenRate: totalEmailsSent > 0
        ? Math.round((totalOpened / totalEmailsSent) * 100 * 10) / 10
        : 0,
      globalReplyRate: totalEmailsSent > 0
        ? Math.round((totalReplied / totalEmailsSent) * 100 * 10) / 10
        : 0,
      leadsInSequence,
    };
  },
};
