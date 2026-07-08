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

function fillOne(template: string, lead: Lead): string {
  let result = template
    .replace(/\{\{contact_name\}\}/g, lead.contact_name || '')
    .replace(/\{\{company_name\}\}/g, lead.company_name || '')
    .replace(/\{\{poste\}\}/g, (lead as unknown as { poste?: string }).poste || '')
    .replace(/\{\{segment\}\}/g, lead.segment || '');

  const customFields = (lead as unknown as { custom_fields?: Record<string, string> }).custom_fields || {};
  for (const [key, value] of Object.entries(customFields)) {
    result = result.replaceAll(`{{custom.${key}}}`, value ?? '');
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
