import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

import { LEAD_IMPORT_HEADERS } from './leadImportService';

const TEMPLATE_PATH = path.resolve(__dirname, '../../public/templates/leads-import-template.xlsx');

describe('lead import template file', () => {
  it('has a decorative title banner on row 1', async () => {
    const buffer = readFileSync(TEMPLATE_PATH);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const bannerCell = sheet.getCell('A1');
    expect(String(bannerCell.value)).toContain("Modèle d'import de leads");
  });

  it('has the exact expected header row on row 2', async () => {
    const buffer = readFileSync(TEMPLATE_PATH);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const headerRow = sheet.getRow(2);
    const headers = LEAD_IMPORT_HEADERS.map((_, i) => String(headerRow.getCell(i + 1).value));
    expect(headers).toEqual([...LEAD_IMPORT_HEADERS]);
  });

  it('restricts the Segment column to a Media/Retail/Instit dropdown starting at the first data row', async () => {
    const buffer = readFileSync(TEMPLATE_PATH);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const cell = sheet.getCell('E3');
    expect(cell.dataValidation?.type).toBe('list');
    expect(cell.dataValidation?.formulae?.[0]).toContain('Media');
  });

  it('restricts the Genre column to an M./Mme/Autre dropdown that allows blank', async () => {
    const buffer = readFileSync(TEMPLATE_PATH);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const cell = sheet.getCell('B3');
    expect(cell.dataValidation?.type).toBe('list');
    expect(cell.dataValidation?.allowBlank).toBe(true);
    expect(cell.dataValidation?.formulae?.[0]).toContain('Mme');
  });
});
