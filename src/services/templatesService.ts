// ============================================================
// templatesService.ts
// CRUD de la bibliothèque de templates (segment x étape) et
// fusion de variables côté client (miroir de render_template()
// en base — utilisé pour la génération manuelle et l'aperçu live
// de l'éditeur de templates).
// ============================================================

import { supabase } from './supabaseClient';
import type { Lead } from './leadsService';

export interface EmailTemplate {
  id: string;
  segment: 'Media' | 'Retail' | 'Instit' | 'All';
  step: 'initial' | 'relance_1' | 'relance_2';
  subject: string;
  body: string;
  updated_at: string;
}

/**
 * Escapes literal $ characters in replacement values to prevent
 * JavaScript's special replacement patterns ($&, $$, $`, $') from
 * being interpreted. Matches SQL's plain literal string replacement behavior.
 */
function escapeReplacement(value: string): string {
  return value.replace(/\$/g, '$$$$');
}

function fillOne(template: string, lead: Lead): string {
  // D'anciens templates ont été enregistrés avec des "\n" littéraux (texte)
  // au lieu de vrais retours à la ligne — on les normalise avant la fusion.
  let result = template
    .replace(/\\n/g, '\n')
    .replace(/\{\{contact_name\}\}/g, escapeReplacement(lead.contact_name || ''))
    .replace(/\{\{company_name\}\}/g, escapeReplacement(lead.company_name || ''))
    .replace(/\{\{poste\}\}/g, escapeReplacement((lead as unknown as { poste?: string }).poste || ''))
    .replace(/\{\{segment\}\}/g, escapeReplacement(lead.segment || ''));

  const customFields = (lead as unknown as { custom_fields?: Record<string, string> }).custom_fields || {};
  for (const [key, value] of Object.entries(customFields)) {
    result = result.replaceAll(`{{custom.${key}}}`, escapeReplacement(value ?? ''));
  }
  return result;
}

export const templatesService = {
  async getTemplates(): Promise<EmailTemplate[]> {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('segment')
      .order('step');
    if (error) throw error;
    return (data || []) as EmailTemplate[];
  },

  async upsertTemplate(
    segment: EmailTemplate['segment'],
    step: EmailTemplate['step'],
    subject: string,
    body: string,
  ): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from('email_templates')
      .upsert([{ segment, step, subject, body, updated_at: new Date().toISOString() }], { onConflict: 'segment,step' })
      .select()
      .single();
    if (error) throw error;
    return data as EmailTemplate;
  },

  resolveTemplate(
    templates: EmailTemplate[],
    segment: EmailTemplate['segment'],
    step: EmailTemplate['step'],
  ): EmailTemplate | null {
    return (
      templates.find((t) => t.segment === segment && t.step === step) ||
      templates.find((t) => t.segment === 'All' && t.step === step) ||
      null
    );
  },

  renderTemplate(template: { subject: string; body: string }, lead: Lead): { subject: string; body: string } {
    return {
      subject: fillOne(template.subject, lead),
      body: fillOne(template.body, lead),
    };
  },
};
