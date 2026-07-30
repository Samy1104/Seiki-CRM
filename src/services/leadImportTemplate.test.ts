import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { LEAD_IMPORT_HEADERS } from './leadImportService';

const TEMPLATE_PATH = path.resolve(__dirname, '../../public/templates/leads-import-template.xlsx');

describe('lead import template file', () => {
  it('has the exact expected header row', async () => {
    const buffer = readFileSync(TEMPLATE_PATH);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    const headerRow = sheet.getRow(1);
    const headers = LEAD_IMPORT_HEADERS.map((_, i) => String(headerRow.getCell(i + 1).value));
    expect(headers).toEqual([...LEAD_IMPORT_HEADERS]);
  });

  it('restricts the Segment column to a Media/Retail/Instit dropdown', async () => {
    const buffer = readFileSync(TEMPLATE_PATH);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    const cell = sheet.getCell('B2');
    expect(cell.dataValidation?.type).toBe('list');
    expect(cell.dataValidation?.formulae?.[0]).toContain('Media');
  });
});
