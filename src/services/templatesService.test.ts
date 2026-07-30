import { describe, it, expect } from 'vitest';
import { templatesService } from './templatesService';
import type { Lead } from './leadsService';

describe('templatesService.renderTemplate', () => {
  const sampleLead: Lead = {
    id: 'lead-123',
    owner_id: null,
    company_name: 'Acme Corp',
    contact_name: 'Mme Marie Curie',
    email: 'marie.curie@acme.com',
    email_verified: true,
    phone: null,
    linkedin_url: null,
    website: null,
    domain: 'acme.com',
    segment: 'Media',
    stage_id: 'stage-1',
    score: 85,
    deal_value: 50000,
    source: 'LinkedIn',
    note: null,
    days_in_stage: 2,
    stage_changed_at: new Date().toISOString(),
    is_archived: false,
    is_disqualified: false,
    merged_into_id: null,
    sequence_id: null,
    sequence_status: 'idle',
    custom_fields: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('replaces {{genre}}, {{prenom}}, and {{nom}} variables correctly', () => {
    const template = {
      subject: 'Bonjour {{genre}} {{nom}}',
      body: 'Bonjour {{prenom}},\n\nMerci de travailler avec {{company_name}}.',
    };

    const rendered = templatesService.renderTemplate(template, sampleLead);

    expect(rendered.subject).toBe('Bonjour Madame Curie');
    expect(rendered.body).toBe('Bonjour Marie,\n\nMerci de travailler avec Acme Corp.');

    const maleLead = { ...sampleLead, contact_name: 'M. Jean Dupont' };
    const renderedMale = templatesService.renderTemplate(template, maleLead);
    expect(renderedMale.subject).toBe('Bonjour Monsieur Dupont');
  });

  it('maintains backwards compatibility for {{contact_name}}', () => {
    const template = {
      subject: 'Pour {{contact_name}}',
      body: 'Bonjour {{contact_name}},',
    };

    const rendered = templatesService.renderTemplate(template, sampleLead);

    expect(rendered.subject).toBe('Pour Mme Marie Curie');
    expect(rendered.body).toBe('Bonjour Mme Marie Curie,');
  });
});
