import ExcelJS from 'exceljs';
import { supabase } from './supabaseClient';

export const LEAD_IMPORT_HEADERS = [
  'Nom de la société',
  'Segment',
  'Nom du contact',
  'Email',
  'Téléphone',
  'URL LinkedIn',
  'Site web',
  'Source',
  "Valeur de l'affaire (k€)",
  'Note',
] as const;

export const ALLOWED_SEGMENTS = ['Media', 'Retail', 'Instit'] as const;
export type LeadSegment = (typeof ALLOWED_SEGMENTS)[number];

export const ALLOWED_SOURCES = [
  'LinkedIn',
  'Événement',
  'Réseau',
  'AndZup',
  'Inbound',
  'Chrome Extension',
  'Autre',
] as const;

export interface RawImportRow {
  rowNumber: number;
  companyName: string;
  segment: string;
  contactName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  website: string;
  source: string;
  dealValue: string;
  note: string;
}

export interface RowError {
  rowNumber: number;
  reason: string;
}

export interface ExistingLeadRecord {
  id: string;
  contact_name: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  deal_value: number | null;
  note: string | null;
}

export interface NewLeadPayload {
  company_name: string;
  segment: LeadSegment;
  contact_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  source: string;
  deal_value: number;
  note: string | null;
  stage_id: string;
  owner_id: null;
  score: number;
  is_archived: boolean;
  email_verified: boolean;
  custom_fields: Record<string, string>;
}

export interface NewLeadRow {
  rowNumber: number;
  payload: NewLeadPayload;
}

export interface UpdateLeadRow {
  rowNumber: number;
  existingLeadId: string;
  fieldsToFill: Partial<
    Record<'contact_name' | 'phone' | 'linkedin_url' | 'website' | 'note' | 'deal_value', string | number>
  >;
}

export interface ImportValidationResult {
  toCreate: NewLeadRow[];
  toUpdate: UpdateLeadRow[];
  errors: RowError[];
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim() === '' || value.trim() === '—';
}

const COLUMN_COUNT = LEAD_IMPORT_HEADERS.length;

function cellText(row: ExcelJS.Row, col: number): string {
  const value = row.getCell(col).value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in (value as any)) {
    return String((value as any).text ?? '').trim();
  }
  return String(value).trim();
}

export const leadImportService = {
  async parseFile(file: File): Promise<RawImportRow[]> {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new Error('Le fichier ne contient aucune feuille de calcul.');
    }

    const headerRow = sheet.getRow(1);
    const actualHeaders = LEAD_IMPORT_HEADERS.map((_, i) => cellText(headerRow, i + 1));
    const headersMatch = LEAD_IMPORT_HEADERS.every((h, i) => actualHeaders[i] === h);
    if (!headersMatch) {
      throw new Error(
        "Le format du fichier ne correspond pas au modèle fourni. Merci de télécharger et d'utiliser le modèle."
      );
    }

    const rows: RawImportRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = Array.from({ length: COLUMN_COUNT }, (_, i) => cellText(row, i + 1));
      if (values.every((v) => v === '')) return;

      rows.push({
        rowNumber,
        companyName: values[0],
        segment: values[1],
        contactName: values[2],
        email: values[3],
        phone: values[4],
        linkedinUrl: values[5],
        website: values[6],
        source: values[7],
        dealValue: values[8],
        note: values[9],
      });
    });

    return rows;
  },

  validateRows(
    rows: RawImportRow[],
    existingLeadsByEmail: Map<string, ExistingLeadRecord>,
    prospectStageId: string
  ): ImportValidationResult {
    const toCreate: NewLeadRow[] = [];
    const toUpdate: UpdateLeadRow[] = [];
    const errors: RowError[] = [];
    const seenEmails = new Set<string>();

    // Normalize the existingLeadsByEmail map keys to lowercase for case-insensitive matching
    const normalizedExistingLeads = new Map<string, ExistingLeadRecord>();
    for (const [key, record] of existingLeadsByEmail.entries()) {
      normalizedExistingLeads.set(key.toLowerCase(), record);
    }

    for (const raw of rows) {
      const companyName = raw.companyName.trim();
      if (!companyName) {
        errors.push({ rowNumber: raw.rowNumber, reason: 'Nom de société manquant' });
        continue;
      }

      const segment = raw.segment.trim();
      if (!ALLOWED_SEGMENTS.includes(segment as LeadSegment)) {
        errors.push({
          rowNumber: raw.rowNumber,
          reason: `Segment invalide ou manquant (attendu : ${ALLOWED_SEGMENTS.join(', ')})`,
        });
        continue;
      }

      const rawSource = raw.source.trim();
      if (rawSource && !ALLOWED_SOURCES.includes(rawSource as (typeof ALLOWED_SOURCES)[number])) {
        errors.push({
          rowNumber: raw.rowNumber,
          reason: `Source invalide (attendu : ${ALLOWED_SOURCES.join(', ')})`,
        });
        continue;
      }
      const source = rawSource || 'Autre';

      const email = raw.email.trim();
      if (email && !email.includes('@')) {
        errors.push({ rowNumber: raw.rowNumber, reason: 'Adresse email invalide' });
        continue;
      }
      const emailKey = email.toLowerCase();

      if (emailKey) {
        if (seenEmails.has(emailKey)) {
          errors.push({
            rowNumber: raw.rowNumber,
            reason: 'Email en doublon dans le fichier (déjà vu ligne précédente)',
          });
          continue;
        }
        seenEmails.add(emailKey);
      }

      const dealValue = parseInt(raw.dealValue, 10) || 0;
      const existing = emailKey ? normalizedExistingLeads.get(emailKey) : undefined;

      if (existing) {
        const fieldsToFill: UpdateLeadRow['fieldsToFill'] = {};
        if (isBlank(existing.contact_name) && raw.contactName.trim()) {
          fieldsToFill.contact_name = raw.contactName.trim();
        }
        if (isBlank(existing.phone) && raw.phone.trim()) {
          fieldsToFill.phone = raw.phone.trim();
        }
        if (isBlank(existing.linkedin_url) && raw.linkedinUrl.trim()) {
          fieldsToFill.linkedin_url = raw.linkedinUrl.trim();
        }
        if (isBlank(existing.website) && raw.website.trim()) {
          fieldsToFill.website = raw.website.trim();
        }
        if (isBlank(existing.note) && raw.note.trim()) {
          fieldsToFill.note = raw.note.trim();
        }
        if (!existing.deal_value && dealValue) {
          fieldsToFill.deal_value = dealValue;
        }

        toUpdate.push({ rowNumber: raw.rowNumber, existingLeadId: existing.id, fieldsToFill });
        continue;
      }

      toCreate.push({
        rowNumber: raw.rowNumber,
        payload: {
          company_name: companyName,
          segment: segment as LeadSegment,
          contact_name: raw.contactName.trim() || '—',
          email: email || null,
          phone: raw.phone.trim() || null,
          linkedin_url: raw.linkedinUrl.trim() || null,
          website: raw.website.trim() || null,
          source,
          deal_value: dealValue,
          note: raw.note.trim() || null,
          stage_id: prospectStageId,
          owner_id: null,
          score: 0,
          is_archived: false,
          email_verified: false,
          custom_fields: {},
        },
      });
    }

    return { toCreate, toUpdate, errors };
  },

  async fetchExistingLeadsByEmail(): Promise<Map<string, ExistingLeadRecord>> {
    const { data, error } = await supabase
      .from('leads')
      .select('id, email, contact_name, phone, linkedin_url, website, deal_value, note')
      .not('email', 'is', null)
      .is('merged_into_id', null);

    if (error) throw error;

    const map = new Map<string, ExistingLeadRecord>();
    for (const lead of data || []) {
      if (lead.email) {
        map.set(lead.email.toLowerCase(), lead);
      }
    }
    return map;
  },

  async getProspectStageId(): Promise<string> {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('name', 'Prospect')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Étape "Prospect" introuvable dans le pipeline.');
    return data.id;
  },

  async commitImport(
    toCreate: NewLeadRow[],
    toUpdate: UpdateLeadRow[]
  ): Promise<{ created: number; updated: number }> {
    const CHUNK_SIZE = 100;
    let created = 0;

    for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
      const chunk = toCreate.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from('leads')
        .insert(chunk.map((r) => r.payload))
        .select('id');
      if (error) throw error;

      created += data?.length || 0;

      if (data && data.length > 0) {
        const historyRows = data.map((lead: { id: string }) => ({
          lead_id: lead.id,
          action_type: 'note',
          content: 'Lead créé (import en masse)',
          metadata: {},
        }));
        const { error: histError } = await supabase.from('history').insert(historyRows);
        if (histError) throw histError;
      }
    }

    let updated = 0;
    for (const row of toUpdate) {
      if (Object.keys(row.fieldsToFill).length === 0) continue;

      const { error } = await supabase
        .from('leads')
        .update({ ...row.fieldsToFill, updated_at: new Date().toISOString() })
        .eq('id', row.existingLeadId);
      if (error) throw error;

      const { error: histError } = await supabase.from('history').insert([
        {
          lead_id: row.existingLeadId,
          action_type: 'note',
          content: 'Lead mis à jour (import en masse)',
          metadata: { updates: row.fieldsToFill },
        },
      ]);
      if (histError) throw histError;

      updated += 1;
    }

    return { created, updated };
  },
};
