import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { leadImportService, LEAD_IMPORT_HEADERS, type RawImportRow } from './leadImportService';

async function buildXlsxFile(
  rows: (string | number)[][],
  headers: readonly string[] = LEAD_IMPORT_HEADERS
): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Leads');
  sheet.addRow([...headers]);
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('leadImportService.parseFile', () => {
  it('parses valid rows into RawImportRow objects with 1-based Excel row numbers', async () => {
    const file = await buildXlsxFile([
      ['Acme Corp', 'Retail', 'Jean Dupont', 'jean@acme.com', '0600000000', 'https://li.com/jean', 'https://acme.com', 'LinkedIn', '50', 'note'],
      ['Beta SA', 'Media', '', '', '', '', '', '', '', ''],
    ]);

    const rows = await leadImportService.parseFile(file);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      rowNumber: 2,
      companyName: 'Acme Corp',
      segment: 'Retail',
      contactName: 'Jean Dupont',
      email: 'jean@acme.com',
      phone: '0600000000',
      linkedinUrl: 'https://li.com/jean',
      website: 'https://acme.com',
      source: 'LinkedIn',
      dealValue: '50',
      note: 'note',
    });
    expect(rows[1].rowNumber).toBe(3);
    expect(rows[1].companyName).toBe('Beta SA');
  });

  it('skips fully blank rows', async () => {
    const file = await buildXlsxFile([
      ['Acme Corp', 'Retail', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
    ]);

    const rows = await leadImportService.parseFile(file);
    expect(rows).toHaveLength(1);
  });

  it('rejects a file whose header row does not match the template', async () => {
    const file = await buildXlsxFile(
      [['Acme Corp', 'Retail']],
      ['Wrong Header', 'Segment', ...LEAD_IMPORT_HEADERS.slice(2)]
    );

    await expect(leadImportService.parseFile(file)).rejects.toThrow(/modèle fourni/);
  });
});

describe('leadImportService.validateRows', () => {
  const stageId = 'stage-prospect-id';

  function row(overrides: Partial<RawImportRow> = {}, rowNumber = 2): RawImportRow {
    return {
      rowNumber,
      companyName: 'Acme Corp',
      segment: 'Retail',
      contactName: 'Jean Dupont',
      email: 'jean@acme.com',
      phone: '0600000000',
      linkedinUrl: '',
      website: '',
      source: '',
      dealValue: '50',
      note: '',
      ...overrides,
    };
  }

  it('creates a new lead payload for a fully valid row with no DB match', () => {
    const result = leadImportService.validateRows([row()], new Map(), stageId);
    expect(result.errors).toEqual([]);
    expect(result.toUpdate).toEqual([]);
    expect(result.toCreate).toHaveLength(1);
    expect(result.toCreate[0].payload).toMatchObject({
      company_name: 'Acme Corp',
      segment: 'Retail',
      contact_name: 'Jean Dupont',
      email: 'jean@acme.com',
      source: 'Autre',
      deal_value: 50,
      stage_id: stageId,
      owner_id: null,
      score: 0,
    });
  });

  it('rejects a row with a blank company name', () => {
    const result = leadImportService.validateRows([row({ companyName: '' })], new Map(), stageId);
    expect(result.toCreate).toEqual([]);
    expect(result.errors).toEqual([{ rowNumber: 2, reason: 'Nom de société manquant' }]);
  });

  it('rejects a row with a missing or invalid segment', () => {
    const result = leadImportService.validateRows([row({ segment: 'Bogus' })], new Map(), stageId);
    expect(result.errors[0].reason).toMatch(/Segment/);
  });

  it('rejects an invalid source but accepts a blank source as Autre', () => {
    const bad = leadImportService.validateRows([row({ source: 'Bogus' })], new Map(), stageId);
    expect(bad.errors[0].reason).toMatch(/Source/);

    const blank = leadImportService.validateRows([row({ source: '' })], new Map(), stageId);
    expect(blank.toCreate[0].payload.source).toBe('Autre');
  });

  it('rejects a row with a malformed email', () => {
    const result = leadImportService.validateRows([row({ email: 'not-an-email' })], new Map(), stageId);
    expect(result.errors[0].reason).toMatch(/email/i);
  });

  it('flags the second occurrence of a duplicate email within the same file', () => {
    const result = leadImportService.validateRows(
      [row({}, 2), row({ companyName: 'Other Co' }, 3)],
      new Map(),
      stageId
    );
    expect(result.toCreate).toHaveLength(1);
    expect(result.errors).toEqual([{ rowNumber: 3, reason: expect.stringContaining('doublon') }]);
  });

  it('routes a row whose email matches an existing lead to toUpdate, filling only blank fields', () => {
    const existing = new Map([
      [
        'jean@acme.com',
        {
          id: 'lead-1',
          contact_name: '—',
          phone: '0699999999',
          linkedin_url: null,
          website: null,
          deal_value: 0,
          note: null,
        },
      ],
    ]);

    const result = leadImportService.validateRows([row()], existing, stageId);

    expect(result.toCreate).toEqual([]);
    expect(result.toUpdate).toEqual([
      {
        rowNumber: 2,
        existingLeadId: 'lead-1',
        fieldsToFill: {
          contact_name: 'Jean Dupont',
          deal_value: 50,
        },
      },
    ]);
  });
});
