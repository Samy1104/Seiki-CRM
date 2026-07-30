import { describe, it, expect } from 'vitest';
import { detectMissingVariables } from './templateVariableChecker';
import type { GeneratedEmail } from '../services/emailsService';
import type { EmailTemplate } from '../services/templatesService';

describe('templateVariableChecker', () => {
  const templates: EmailTemplate[] = [
    {
      id: 't-1',
      segment: 'Media',
      step: 'initial',
      subject: 'Bonjour {{prenom}} chez {{company_name}}',
      body: 'Bonjour {{genre}} {{nom}},\n\nVotre poste de {{poste}} chez {{company_name}}.',
      updated_at: new Date().toISOString(),
    },
    {
      id: 't-2',
      segment: 'Retail',
      step: 'initial',
      subject: 'Offre Retail pour {{company_name}}',
      body: 'Bonjour {{prenom}},\n\nDécouvrez nos solutions.',
      updated_at: new Date().toISOString(),
    },
  ];

  it('returns empty array when all variables used in template are present', () => {
    const email: GeneratedEmail = {
      id: 'email-1',
      lead_id: 'lead-1',
      sequence_step_id: null,
      sujet: 'Bonjour Jean chez LVMH',
      corps_du_mail: 'Bonjour M. DUPONT,\n\nVotre poste de Directeur chez LVMH.',
      icebreaker: null,
      statut_envoi: 'draft',
      model_used: 'gpt-4o',
      prompt_used: null,
      generation_ms: null,
      approved_by: null,
      approved_at: null,
      sent_at: null,
      scheduled_at: null,
      gmail_message_id: null,
      gmail_thread_id: null,
      created_at: new Date().toISOString(),
      lead: {
        contact_name: 'M. Jean DUPONT',
        company_name: 'LVMH',
        email: 'jean.dupont@lvmh.com',
        poste: 'Directeur',
        segment: 'Media',
      },
    };

    const missing = detectMissingVariables(email, templates);
    expect(missing).toEqual([]);
  });

  it('detects missing variables ONLY if they are used in the template', () => {
    // Retail template ONLY uses {{company_name}} and {{prenom}}.
    // Lead has no poste and no genre, BUT poste and genre are NOT in Retail template!
    const retailEmail: GeneratedEmail = {
      id: 'email-2',
      lead_id: 'lead-2',
      sequence_step_id: null,
      sujet: 'Offre Retail pour Fnac',
      corps_du_mail: 'Bonjour Marie,',
      icebreaker: null,
      statut_envoi: 'draft',
      model_used: 'gpt-4o',
      prompt_used: null,
      generation_ms: null,
      approved_by: null,
      approved_at: null,
      sent_at: null,
      scheduled_at: null,
      gmail_message_id: null,
      gmail_thread_id: null,
      created_at: new Date().toISOString(),
      lead: {
        contact_name: 'Marie CURIE',
        company_name: 'Fnac',
        email: 'marie@fnac.com',
        poste: null, // missing, but not in template
        segment: 'Retail',
      },
    };

    const missing = detectMissingVariables(retailEmail, templates);
    expect(missing).toEqual([]);
  });

  it('flags missing variables when template uses them and lead lacks them', () => {
    // Media template uses {{prenom}}, {{company_name}}, {{genre}}, {{nom}}, {{poste}}.
    // Lead lacks genre and poste.
    const mediaEmail: GeneratedEmail = {
      id: 'email-3',
      lead_id: 'lead-3',
      sequence_step_id: null,
      sujet: 'Bonjour Jean chez Canal+',
      corps_du_mail: 'Bonjour DUPONT,\n\nVotre poste chez Canal+.',
      icebreaker: null,
      statut_envoi: 'draft',
      model_used: 'gpt-4o',
      prompt_used: null,
      generation_ms: null,
      approved_by: null,
      approved_at: null,
      sent_at: null,
      scheduled_at: null,
      gmail_message_id: null,
      gmail_thread_id: null,
      created_at: new Date().toISOString(),
      lead: {
        contact_name: 'Jean DUPONT', // No genre (M./Mme)
        company_name: 'Canal+',
        email: 'jean@canal.fr',
        poste: '', // Empty poste!
        segment: 'Media',
      },
    };

    const missing = detectMissingVariables(mediaEmail, templates);
    expect(missing).toContain('Genre');
    expect(missing).toContain('Poste');
    expect(missing).not.toContain('Prénom');
    expect(missing).not.toContain('Nom');
    expect(missing).not.toContain('Entreprise');
  });
});
