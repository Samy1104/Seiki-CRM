import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Keep this list in sync with LEAD_IMPORT_HEADERS in src/services/leadImportService.ts.
// Drift is caught by src/services/leadImportTemplate.test.ts.
const HEADERS = [
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
];

const EXAMPLE_ROW = [
  'Acme Corp',
  'Retail',
  'Jean Dupont',
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

  sheet.addRow(HEADERS);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = HEADERS.map(() => ({ width: 24 }));
  sheet.addRow(EXAMPLE_ROW);

  // Segment column (B) restricted to the DB's CHECK constraint values.
  sheet.dataValidations.add('B2:B1000', {
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
