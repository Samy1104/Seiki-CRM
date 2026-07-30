# Bulk Lead Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user download a fixed `.xlsx` template, fill it with leads, upload it back on the Add Lead page, and have valid rows created as new leads in the "Prospect" pipeline stage — with rows whose email matches an existing lead routed to a non-destructive update instead of a duplicate.

**Architecture:** A new `leadImportService.ts` handles parsing (`exceljs`), pure row validation/classification, and the Supabase writes (bulk insert + per-row update + history logging), fully decoupled from React. A new `BulkImportPanel.tsx` drives a 3-step UI (select → preview → done) and is wired into the existing `AddLead.tsx` behind a `SegmentedToggle`.

**Tech Stack:** React 19 + TypeScript, Vite, Supabase JS client, Vitest + Testing Library, new dependency `exceljs`.

## Global Constraints

- Fixed template only — no column-mapping UI. Header row must match exactly or the whole file is rejected.
- Template accepts `.xlsx` only (not `.csv`).
- Required columns: Company Name, Segment. All others optional.
- `Segment` must be one of `Media` / `Retail` / `Instit`. `Source` must be one of `LinkedIn` / `Événement` / `Réseau` / `AndZup` / `Inbound` / `Chrome Extension` / `Autre`, or blank (defaults to `Autre`).
- Every imported lead gets `stage_id` = the "Prospect" pipeline stage, `score` = 0, `is_archived` = false, `owner_id` = null.
- Duplicate rule: exact email match against an existing lead → route to an **update** that fills only that lead's currently-blank fields (never overwrite non-blank data). Same company name with a different email is never a duplicate.
- Within the same file, a second row reusing an email already seen earlier in the file is a row error (first occurrence wins).
- Partial success: valid rows are created/updated; invalid rows are skipped and reported with row number + reason. Nothing is written until the user confirms the preview.
- Tests: Vitest + Testing Library, colocated `*.test.ts(x)` files, matching the codebase's existing service/component test conventions.

---

## File Structure

- `Projet/scripts/generate-lead-import-template.mjs` (new) — one-off Node script that generates the static template workbook.
- `Projet/public/templates/leads-import-template.xlsx` (new, generated binary) — the downloadable template.
- `Projet/src/services/leadImportService.ts` (new) — column constants, types, `parseFile`, `validateRows`, `fetchExistingLeadsByEmail`, `getProspectStageId`, `commitImport`.
- `Projet/src/services/leadImportTemplate.test.ts` (new) — verifies the generated template's header row and Segment dropdown.
- `Projet/src/services/leadImportService.test.ts` (new) — `parseFile` + `validateRows` tests (pure logic, no mocking).
- `Projet/src/services/leadImportService.supabase.test.ts` (new) — `fetchExistingLeadsByEmail` / `getProspectStageId` / `commitImport` tests (mocked Supabase client).
- `Projet/src/views/addlead/BulkImportPanel.tsx` (new) — upload/preview/results UI.
- `Projet/src/views/addlead/BulkImportPanel.test.tsx` (new) — component test with the service mocked.
- `Projet/src/views/AddLead.tsx` (modify) — add the single/bulk `SegmentedToggle`.
- `Projet/src/views/AddLead.test.tsx` (new) — toggle switches between the two panels.
- `Projet/package.json` (modify) — add `exceljs` dependency.

---

### Task 1: Add `exceljs` and generate the downloadable template

**Files:**
- Create: `Projet/scripts/generate-lead-import-template.mjs`
- Create: `Projet/src/services/leadImportService.ts`
- Create: `Projet/src/services/leadImportTemplate.test.ts`
- Create (generated binary): `Projet/public/templates/leads-import-template.xlsx`
- Modify: `Projet/package.json`

**Interfaces:**
- Produces: `LEAD_IMPORT_HEADERS: readonly string[]`, `ALLOWED_SEGMENTS: readonly ['Media','Retail','Instit']`, `type LeadSegment`, `ALLOWED_SOURCES: readonly string[]` — used by every later task.

- [ ] **Step 1: Write the failing test**

```ts
// Projet/src/services/leadImportTemplate.test.ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- leadImportTemplate`
Expected: FAIL — `Cannot find module './leadImportService'` (and/or `ENOENT` for the template file, since neither exists yet).

- [ ] **Step 3: Install exceljs**

```bash
npm install exceljs
```

- [ ] **Step 4: Create the shared constants file**

```ts
// Projet/src/services/leadImportService.ts
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
```

- [ ] **Step 5: Create the template generator script**

```js
// Projet/scripts/generate-lead-import-template.mjs
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
```

- [ ] **Step 6: Run the generator**

```bash
node scripts/generate-lead-import-template.mjs
```

Expected: `Template written to public/templates/leads-import-template.xlsx` and the file now exists.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test -- leadImportTemplate`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json scripts/generate-lead-import-template.mjs src/services/leadImportService.ts src/services/leadImportTemplate.test.ts public/templates/leads-import-template.xlsx
git commit -m "feat: add lead import template generator and downloadable xlsx"
```

---

### Task 2: `parseFile` — read an uploaded workbook into raw rows

**Files:**
- Modify: `Projet/src/services/leadImportService.ts`
- Create: `Projet/src/services/leadImportService.test.ts`

**Interfaces:**
- Consumes: `LEAD_IMPORT_HEADERS` (Task 1)
- Produces: `interface RawImportRow`, `leadImportService.parseFile(file: File): Promise<RawImportRow[]>` — used by Task 3 (as input) and by `BulkImportPanel` (Task 5).

- [ ] **Step 1: Write the failing test**

```ts
// Projet/src/services/leadImportService.test.ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- leadImportService.test.ts`
Expected: FAIL — `leadImportService.parseFile is not a function`

- [ ] **Step 3: Implement `parseFile`**

```ts
// Projet/src/services/leadImportService.ts (append below the Task 1 constants)
import ExcelJS from 'exceljs';

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- leadImportService.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/leadImportService.ts src/services/leadImportService.test.ts
git commit -m "feat: parse uploaded lead import workbooks into raw rows"
```

---

### Task 3: `validateRows` — classify rows into create / update / error

**Files:**
- Modify: `Projet/src/services/leadImportService.ts`
- Modify: `Projet/src/services/leadImportService.test.ts`

**Interfaces:**
- Consumes: `RawImportRow` (Task 2), `ALLOWED_SEGMENTS`, `ALLOWED_SOURCES`, `LeadSegment` (Task 1)
- Produces: `interface RowError`, `interface ExistingLeadRecord`, `interface NewLeadPayload`, `interface NewLeadRow`, `interface UpdateLeadRow`, `interface ImportValidationResult`, `leadImportService.validateRows(rows, existingLeadsByEmail, prospectStageId): ImportValidationResult` — consumed by Task 4 (`commitImport` inputs) and Task 5 (UI).

- [ ] **Step 1: Write the failing tests**

```ts
// Projet/src/services/leadImportService.test.ts (append)
import type { RawImportRow } from './leadImportService';

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- leadImportService.test.ts`
Expected: FAIL — `leadImportService.validateRows is not a function`

- [ ] **Step 3: Implement `validateRows`**

```ts
// Projet/src/services/leadImportService.ts (append types above the object, add the method inside it)

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

// Inside the `leadImportService` object literal, alongside `parseFile`:
  validateRows(
    rows: RawImportRow[],
    existingLeadsByEmail: Map<string, ExistingLeadRecord>,
    prospectStageId: string
  ): ImportValidationResult {
    const toCreate: NewLeadRow[] = [];
    const toUpdate: UpdateLeadRow[] = [];
    const errors: RowError[] = [];
    const seenEmails = new Set<string>();

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
      const existing = emailKey ? existingLeadsByEmail.get(emailKey) : undefined;

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- leadImportService.test.ts`
Expected: PASS (10 tests total: 3 from Task 2 + 7 here)

- [ ] **Step 5: Commit**

```bash
git add src/services/leadImportService.ts src/services/leadImportService.test.ts
git commit -m "feat: validate and classify lead import rows (create/update/error)"
```

---

### Task 4: Supabase-backed lookups and the commit step

**Files:**
- Modify: `Projet/src/services/leadImportService.ts`
- Create: `Projet/src/services/leadImportService.supabase.test.ts`

**Interfaces:**
- Consumes: `NewLeadRow`, `UpdateLeadRow`, `ExistingLeadRecord` (Task 3), `supabase` client from `./supabaseClient`
- Produces: `leadImportService.fetchExistingLeadsByEmail(): Promise<Map<string, ExistingLeadRecord>>`, `leadImportService.getProspectStageId(): Promise<string>`, `leadImportService.commitImport(toCreate, toUpdate): Promise<{ created: number; updated: number }>` — all consumed by `BulkImportPanel` in Task 5.

- [ ] **Step 1: Write the failing tests**

```ts
// Projet/src/services/leadImportService.supabase.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from './supabaseClient';
import { leadImportService } from './leadImportService';
import type { NewLeadRow, UpdateLeadRow } from './leadImportService';

function queryResult<T>(data: T, error: any = null) {
  const promise: any = Promise.resolve({ data, error });
  const chain = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'is', 'not', 'order', 'maybeSingle', 'single'];
  chain.forEach((method) => {
    promise[method] = vi.fn(() => promise);
  });
  return promise;
}

const mockedFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedFrom.mockReset();
});

describe('leadImportService.fetchExistingLeadsByEmail', () => {
  it('returns a map of existing leads keyed by lowercased email', async () => {
    mockedFrom.mockReturnValue(
      queryResult([
        {
          id: 'lead-1',
          email: 'Jean@Acme.com',
          contact_name: '—',
          phone: null,
          linkedin_url: null,
          website: null,
          deal_value: 0,
          note: null,
        },
      ])
    );

    const map = await leadImportService.fetchExistingLeadsByEmail();

    expect(mockedFrom).toHaveBeenCalledWith('leads');
    expect(map.get('jean@acme.com')?.id).toBe('lead-1');
  });
});

describe('leadImportService.getProspectStageId', () => {
  it('returns the id of the stage named Prospect', async () => {
    mockedFrom.mockReturnValue(queryResult({ id: 'stage-1' }));
    const id = await leadImportService.getProspectStageId();
    expect(id).toBe('stage-1');
  });

  it('throws if no Prospect stage exists', async () => {
    mockedFrom.mockReturnValue(queryResult(null));
    await expect(leadImportService.getProspectStageId()).rejects.toThrow(/Prospect/);
  });
});

describe('leadImportService.commitImport', () => {
  it('inserts new leads, logs history for each, and updates matched leads with only their fill fields', async () => {
    const leadsQuery = queryResult([{ id: 'new-1' }]);
    const historyQuery = queryResult([]);

    mockedFrom.mockImplementation((table: string) => {
      if (table === 'leads') return leadsQuery;
      if (table === 'history') return historyQuery;
      throw new Error(`unexpected table ${table}`);
    });

    const toCreate: NewLeadRow[] = [
      {
        rowNumber: 2,
        payload: {
          company_name: 'Acme Corp',
          segment: 'Retail',
          contact_name: 'Jean Dupont',
          email: 'jean@acme.com',
          phone: null,
          linkedin_url: null,
          website: null,
          source: 'Autre',
          deal_value: 50,
          note: null,
          stage_id: 'stage-1',
          owner_id: null,
          score: 0,
          is_archived: false,
          email_verified: false,
          custom_fields: {},
        },
      },
    ];
    const toUpdate: UpdateLeadRow[] = [
      { rowNumber: 3, existingLeadId: 'lead-9', fieldsToFill: { phone: '0600000000' } },
      { rowNumber: 4, existingLeadId: 'lead-10', fieldsToFill: {} },
    ];

    const summary = await leadImportService.commitImport(toCreate, toUpdate);

    expect(summary).toEqual({ created: 1, updated: 1 });
    expect(leadsQuery.insert).toHaveBeenCalledWith([toCreate[0].payload]);
    expect(leadsQuery.update).toHaveBeenCalledWith(expect.objectContaining({ phone: '0600000000' }));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- leadImportService.supabase.test.ts`
Expected: FAIL — `leadImportService.fetchExistingLeadsByEmail is not a function`

- [ ] **Step 3: Implement the three methods**

```ts
// Projet/src/services/leadImportService.ts (add near the top, alongside the ExcelJS import)
import { supabase } from './supabaseClient';

// Inside the `leadImportService` object literal, alongside `parseFile` / `validateRows`:
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- leadImportService.supabase.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/leadImportService.ts src/services/leadImportService.supabase.test.ts
git commit -m "feat: fetch existing leads and commit bulk-import writes to Supabase"
```

---

### Task 5: `BulkImportPanel` — upload, preview, confirm UI

**Files:**
- Create: `Projet/src/views/addlead/BulkImportPanel.tsx`
- Create: `Projet/src/views/addlead/BulkImportPanel.test.tsx`

**Interfaces:**
- Consumes: `leadImportService.{parseFile,fetchExistingLeadsByEmail,getProspectStageId,validateRows,commitImport}` (Tasks 2–4), `Button` (`../../components/ui/Button`), `useToast` (`../../context/ToastContext`)
- Produces: `BulkImportPanel: React.FC<{ setView: (view: string) => void }>` — consumed by `AddLead.tsx` in Task 6.

- [ ] **Step 1: Write the failing test**

```tsx
// Projet/src/views/addlead/BulkImportPanel.test.tsx
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '../../context/ToastContext';

vi.mock('../../services/leadImportService', () => ({
  leadImportService: {
    parseFile: vi.fn(),
    fetchExistingLeadsByEmail: vi.fn(),
    getProspectStageId: vi.fn(),
    validateRows: vi.fn(),
    commitImport: vi.fn(),
  },
}));

import { leadImportService } from '../../services/leadImportService';
import { BulkImportPanel } from './BulkImportPanel';

function renderPanel() {
  return render(
    <ToastProvider>
      <BulkImportPanel setView={vi.fn()} />
    </ToastProvider>
  );
}

describe('BulkImportPanel', () => {
  beforeEach(() => {
    vi.mocked(leadImportService.parseFile).mockReset();
    vi.mocked(leadImportService.fetchExistingLeadsByEmail).mockReset();
    vi.mocked(leadImportService.getProspectStageId).mockReset();
    vi.mocked(leadImportService.validateRows).mockReset();
    vi.mocked(leadImportService.commitImport).mockReset();
  });

  it('parses the selected file, shows a preview summary, then commits on confirm', async () => {
    vi.mocked(leadImportService.parseFile).mockResolvedValue([{ rowNumber: 2 } as any]);
    vi.mocked(leadImportService.fetchExistingLeadsByEmail).mockResolvedValue(new Map());
    vi.mocked(leadImportService.getProspectStageId).mockResolvedValue('stage-1');
    vi.mocked(leadImportService.validateRows).mockReturnValue({
      toCreate: [{ rowNumber: 2, payload: {} as any }],
      toUpdate: [],
      errors: [{ rowNumber: 3, reason: 'Nom de société manquant' }],
    });
    vi.mocked(leadImportService.commitImport).mockResolvedValue({ created: 1, updated: 0 });

    renderPanel();

    const file = new File(['dummy'], 'leads.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(screen.getByLabelText(/importer un fichier/i), { target: { files: [file] } });

    await waitFor(() => expect(leadImportService.validateRows).toHaveBeenCalled());
    expect(screen.getByText('1 lead(s) prêt(s) à être créé(s)')).toBeInTheDocument();
    expect(screen.getByText('1 erreur(s)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "Confirmer l'import" }));

    await waitFor(() =>
      expect(leadImportService.commitImport).toHaveBeenCalledWith(
        [{ rowNumber: 2, payload: {} }],
        []
      )
    );
    expect(await screen.findByText('1 lead(s) créé(s), 0 mis à jour')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- BulkImportPanel`
Expected: FAIL — `Cannot find module './BulkImportPanel'`

- [ ] **Step 3: Implement the component**

```tsx
// Projet/src/views/addlead/BulkImportPanel.tsx
import React, { useRef, useState } from 'react';
import { Download, Upload, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import {
  leadImportService,
  type NewLeadRow,
  type UpdateLeadRow,
  type RowError,
} from '../../services/leadImportService';

type Step = 'select' | 'preview' | 'done';

interface BulkImportPanelProps {
  setView: (view: string) => void;
}

export const BulkImportPanel: React.FC<BulkImportPanelProps> = ({ setView }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('select');
  const [loading, setLoading] = useState(false);
  const [toCreate, setToCreate] = useState<NewLeadRow[]>([]);
  const [toUpdate, setToUpdate] = useState<UpdateLeadRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const rows = await leadImportService.parseFile(file);
      const [existingByEmail, prospectStageId] = await Promise.all([
        leadImportService.fetchExistingLeadsByEmail(),
        leadImportService.getProspectStageId(),
      ]);
      const validation = leadImportService.validateRows(rows, existingByEmail, prospectStageId);
      setToCreate(validation.toCreate);
      setToUpdate(validation.toUpdate);
      setErrors(validation.errors);
      setStep('preview');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la lecture du fichier', 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const summary = await leadImportService.commitImport(toCreate, toUpdate);
      setResult(summary);
      setStep('done');
    } catch (err) {
      showToast("Erreur lors de l'import des leads", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setToCreate([]);
    setToUpdate([]);
    setErrors([]);
    setResult(null);
    setStep('select');
  };

  return (
    <div className="flex flex-col gap-5 rounded-overlay border border-line-strong bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-bold text-ink">Import en masse</h3>
          <p className="text-xs text-ink-soft">Téléchargez le modèle, remplissez-le, puis importez-le ici.</p>
        </div>
        <a
          href="/templates/leads-import-template.xlsx"
          download
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber hover:underline"
        >
          <Download size={14} />
          Télécharger le modèle
        </a>
      </div>

      {step === 'select' && (
        <label
          htmlFor="bulk-import-file"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-control border border-dashed border-line-strong px-6 py-10 text-center text-ink-soft hover:border-amber/60"
        >
          <Upload size={20} />
          <span className="text-sm">Importer un fichier (.xlsx)</span>
          <input
            id="bulk-import-file"
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleFileChange}
            disabled={loading}
          />
        </label>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm text-ink">
            <span>{toCreate.length} lead(s) prêt(s) à être créé(s)</span>
            <span>{toUpdate.length} lead(s) existant(s) sera(ont) mis à jour</span>
            <span>{errors.length} erreur(s)</span>
          </div>

          {errors.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-control border border-line bg-elevated p-3 text-xs text-danger">
              {errors.map((err) => (
                <li key={err.rowNumber}>
                  Ligne {err.rowNumber} : {err.reason}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleReset}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={loading || (toCreate.length === 0 && toUpdate.length === 0)}
            >
              Confirmer l'import
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 size={28} className="text-success" />
          <p className="text-sm text-ink">
            {result.created} lead(s) créé(s), {result.updated} mis à jour
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleReset}>
              Importer un autre fichier
            </Button>
            <Button variant="primary" onClick={() => setView('pipeline')}>
              Voir le pipeline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- BulkImportPanel`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/views/addlead/BulkImportPanel.tsx src/views/addlead/BulkImportPanel.test.tsx
git commit -m "feat: add bulk import upload/preview/confirm panel"
```

---

### Task 6: Wire the toggle into `AddLead.tsx`

**Files:**
- Modify: `Projet/src/views/AddLead.tsx`
- Create: `Projet/src/views/AddLead.test.tsx`

**Interfaces:**
- Consumes: `BulkImportPanel` (Task 5), `SegmentedToggle` (`../components/ui/SegmentedToggle`, pre-existing), `useAddLeadForm` (pre-existing)

- [ ] **Step 1: Write the failing test**

```tsx
// Projet/src/views/AddLead.test.tsx
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AddLead } from './AddLead';

vi.mock('../hooks/useAddLeadForm', () => ({
  useAddLeadForm: () => ({
    form: {},
    setForm: vi.fn(),
    scores: {},
    handleScoreChange: vi.fn(),
    customFields: [],
    addCustomField: vi.fn(),
    updateCustomField: vi.fn(),
    removeCustomField: vi.fn(),
    stages: [],
    totalScore: 0,
    recommendation: { text: '', className: '' },
    handleReset: vi.fn(),
    handleSubmit: vi.fn(),
  }),
}));

vi.mock('./addlead/LeadGeneralInfoSection', () => ({
  LeadGeneralInfoSection: () => <div data-testid="single-lead-form" />,
}));
vi.mock('./addlead/LeadScoringSection', () => ({
  LeadScoringSection: () => <div data-testid="scoring-section" />,
}));
vi.mock('./addlead/BulkImportPanel', () => ({
  BulkImportPanel: () => <div data-testid="bulk-import-panel" />,
}));

describe('AddLead', () => {
  it('defaults to the single-lead form and switches to bulk import when toggled', () => {
    render(<AddLead setView={vi.fn()} />);

    expect(screen.getByTestId('single-lead-form')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-import-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /import en masse/i }));

    expect(screen.getByTestId('bulk-import-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('single-lead-form')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- AddLead.test.tsx`
Expected: FAIL — toggle button "import en masse" does not exist yet

- [ ] **Step 3: Update `AddLead.tsx`**

```tsx
// Projet/src/views/AddLead.tsx
import React, { useState } from 'react';
import { useAddLeadForm } from '../hooks/useAddLeadForm';
import { LeadGeneralInfoSection } from './addlead/LeadGeneralInfoSection';
import { LeadScoringSection } from './addlead/LeadScoringSection';
import { BulkImportPanel } from './addlead/BulkImportPanel';
import { PageTitle } from '../components/ui/PageTitle';
import { SegmentedToggle } from '../components/ui/SegmentedToggle';

interface AddLeadProps {
  setView: (view: string) => void;
}

type AddLeadMode = 'single' | 'bulk';

export const AddLead: React.FC<AddLeadProps> = ({ setView }) => {
  const [mode, setMode] = useState<AddLeadMode>('single');
  const {
    form,
    setForm,
    scores,
    handleScoreChange,
    customFields,
    addCustomField,
    updateCustomField,
    removeCustomField,
    stages,
    totalScore,
    recommendation,
    handleReset,
    handleSubmit,
  } = useAddLeadForm(setView);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Ajouter un lead</PageTitle>
        <SegmentedToggle
          value={mode}
          onChange={setMode}
          options={[
            { value: 'single', label: 'Lead unique' },
            { value: 'bulk', label: 'Import en masse' },
          ]}
        />
      </div>

      {mode === 'single' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <LeadGeneralInfoSection
            form={form}
            setForm={setForm}
            customFields={customFields}
            addCustomField={addCustomField}
            updateCustomField={updateCustomField}
            removeCustomField={removeCustomField}
            stages={stages}
            onSubmit={handleSubmit}
            onReset={handleReset}
          />
          <LeadScoringSection
            scores={scores}
            onScoreChange={handleScoreChange}
            totalScore={totalScore}
            recommendation={recommendation}
          />
        </div>
      ) : (
        <BulkImportPanel setView={setView} />
      )}
    </div>
  );
};

export default AddLead;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- AddLead.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: PASS (all tests, including Tasks 1–6)

- [ ] **Step 6: Commit**

```bash
git add src/views/AddLead.tsx src/views/AddLead.test.tsx
git commit -m "feat: add single/bulk toggle to the Add Lead page"
```
