import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Keep this list in sync with LEAD_IMPORT_HEADERS in src/services/leadImportService.ts.
// Drift is caught by src/services/leadImportTemplate.test.ts.
const HEADERS = [
  'Nom de la société',
  'Genre',
  'Prénom',
  'Nom',
  'Segment',
  'Email',
  'Téléphone',
  'URL LinkedIn',
  'Site web',
  'Source',
  "Valeur de l'affaire (k€)",
  'Note',
];

const EXAMPLE_ROW = [
  'Acme Corp',
  'M.',
  'Jean',
  'DUPONT',
  'Retail',
  'jean.dupont@acme.com',
  '+33612345678',
  'https://linkedin.com/in/jeandupont',
  'https://acme.com',
  'LinkedIn',
  '50',
  'Rencontré au salon X',
];

async function main() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Leads');

  sheet.columns = HEADERS.map(() => ({ width: 24 }));

  // Row 1: decorative title banner spanning all columns.
  const lastCol = String.fromCharCode('A'.charCodeAt(0) + HEADERS.length - 1);
  sheet.mergeCells(`A1:${lastCol}1`);
  const bannerCell = sheet.getCell('A1');
  bannerCell.value = "SEIKI — Modèle d'import de leads";
  bannerCell.font = { bold: true, size: 14, color: { argb: 'FFD4C4A8' } };
  bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF141414' } };
  bannerCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 28;

  // Row 2: headers.
  sheet.getRow(2).values = HEADERS;
  sheet.getRow(2).font = { bold: true };

  // Row 3+: example data.
  sheet.getRow(3).values = EXAMPLE_ROW;

  // Segment column (E) restricted to the DB's CHECK constraint values.
  sheet.dataValidations.add('E3:E1000', {
    type: 'list',
    allowBlank: false,
    formulae: ['"Media,Retail,Instit"'],
    showErrorMessage: true,
    errorTitle: 'Segment invalide',
    error: 'Merci de choisir Media, Retail ou Instit.',
  });

  const outDir = path.resolve(__dirname, '../public/templates');
  mkdirSync(outDir, { recursive: true });
  await workbook.xlsx.writeFile(path.join(outDir, 'leads-import-template.xlsx'));
  console.log('Template written to public/templates/leads-import-template.xlsx');
}

main();
