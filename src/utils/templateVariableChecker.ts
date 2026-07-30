import type { GeneratedEmail } from '../services/emailsService';
import { templatesService, type EmailTemplate } from '../services/templatesService';
import { parseContactName } from './contactUtils';

export const VARIABLE_LABELS: Record<string, string> = {
  genre: 'Genre',
  prenom: 'Prénom',
  nom: 'Nom',
  contact_name: 'Nom du contact',
  company_name: 'Entreprise',
  poste: 'Poste',
  segment: 'Segment',
};

/**
 * Checks if any variable used in the email template (or generated email)
 * is missing from the lead's data.
 * Returns an array of human-readable missing variable names.
 */
export function detectMissingVariables(
  email: GeneratedEmail,
  templates: EmailTemplate[]
): string[] {
  const lead = email.lead;
  if (!lead) return [];

  // Determine template for this lead
  const segment = (lead.segment || 'Media') as EmailTemplate['segment'];
  const step = 'initial';
  const template = templatesService.resolveTemplate(templates, segment, step);

  // Collect all text sources (template subject/body and generated email subject/body)
  const fullTextSources = [
    template?.subject || '',
    template?.body || '',
    email.sujet || '',
    email.corps_du_mail || '',
  ].join('\n');

  // Match all {{variable}} occurrences
  const matches = fullTextSources.match(/\{\{([^}]+)\}\}/g);
  if (!matches || matches.length === 0) return [];

  const uniqueVars = Array.from(new Set(matches.map((m) => m.slice(2, -2).trim())));
  const missing: string[] = [];

  const { genre, prenom, nom } = parseContactName(lead.contact_name);

  for (const varKey of uniqueVars) {
    if (varKey === 'genre') {
      if (!genre || genre.trim() === '') {
        missing.push(VARIABLE_LABELS.genre);
      }
    } else if (varKey === 'prenom') {
      if (!prenom || prenom.trim() === '') {
        missing.push(VARIABLE_LABELS.prenom);
      }
    } else if (varKey === 'nom') {
      if (!nom || nom.trim() === '') {
        missing.push(VARIABLE_LABELS.nom);
      }
    } else if (varKey === 'contact_name') {
      if (!lead.contact_name || lead.contact_name.trim() === '' || lead.contact_name === '—') {
        missing.push(VARIABLE_LABELS.contact_name);
      }
    } else if (varKey === 'company_name') {
      if (!lead.company_name || lead.company_name.trim() === '') {
        missing.push(VARIABLE_LABELS.company_name);
      }
    } else if (varKey === 'poste') {
      if (!lead.poste || lead.poste.trim() === '') {
        missing.push(VARIABLE_LABELS.poste);
      }
    } else if (varKey === 'segment') {
      if (!lead.segment || lead.segment.trim() === '') {
        missing.push(VARIABLE_LABELS.segment);
      }
    } else if (varKey.startsWith('custom.')) {
      const customKey = varKey.replace('custom.', '');
      const customVal = lead.custom_fields?.[customKey];
      if (!customVal || customVal.trim() === '') {
        missing.push(`Champ : ${customKey}`);
      }
    }
  }

  return Array.from(new Set(missing));
}
