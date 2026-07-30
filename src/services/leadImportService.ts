import ExcelJS from 'exceljs';

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
};
