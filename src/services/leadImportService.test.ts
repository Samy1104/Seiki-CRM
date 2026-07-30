import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { leadImportService, LEAD_IMPORT_HEADERS } from './leadImportService';

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
