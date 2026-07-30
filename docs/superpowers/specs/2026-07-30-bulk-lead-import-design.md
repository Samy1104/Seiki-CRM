# Bulk Lead Import — Design Spec

Date: 2026-07-30

## Problem

Leads currently must be entered one-by-one via `/crm/add`. User wants to import many leads at once from a spreadsheet, using a fixed downloadable template, with new leads landing in the "Prospect" pipeline stage (already `position 1` in `pipeline_stages`).

## Entry point

`AddLead.tsx` (`/crm/add`) gains a `SegmentedToggle` (existing component): **"Single lead"** (current form, unchanged) vs **"Bulk import"** (new panel).

## Template

Static `.xlsx` file at `public/templates/leads-import-template.xlsx`, one header row + one example data row. Columns, in order:

| Column | Required | DB field | Notes |
|---|---|---|---|
| Company Name | Yes | `company_name` | row rejected if blank |
| Segment | Yes | `segment` | must be `Media` / `Retail` / `Instit`; xlsx data-validation dropdown on the column; row rejected if blank or invalid |
| Contact Name | No | `contact_name` | defaults to `—` if blank |
| Email | No | `email` | used for duplicate matching; light sanity check only (must contain `@` if present, not full RFC validation) |
| Phone | No | `phone` | |
| LinkedIn URL | No | `linkedin_url` | |
| Website | No | `website` | |
| Source | No | `source` | if provided must be one of `LinkedIn` / `Événement` / `Réseau` / `AndZup` / `Inbound` / `Chrome Extension` / `Autre`, else row error; if blank, defaults to `Autre` |
| Deal Value (k€) | No | `deal_value` | defaults to `0` |
| Note | No | `note` | |

Fixed template only — no column-mapping UI. If the uploaded file's header row doesn't match the template's headers exactly, the whole file is rejected upfront with a "please use the provided template" message (no per-row processing attempted).

Fields not on the template, and their value for every imported lead:
- `stage_id` — the "Prospect" stage's id (looked up once from `pipeline_stages`)
- `score` — `0` (no ICP scoring computed from the sheet)
- `is_archived` — `false`
- `owner_id` — `null` (owner assignment is a manual step elsewhere; note: `owner_id` was flagged as apparently unused entirely — a possible separate cleanup task, out of scope here)
- `sequence_status` — `'idle'`
- `domain` — derived from `email` the same way the existing single-lead path does

## Validation & duplicate rules

Per row, in order:
1. Company Name blank → error, row skipped.
2. Segment blank or not in the allowed set → error, row skipped.
3. Source provided but not in the allowed set → error, row skipped. Blank Source → defaults to `Autre`.
4. Email present but obviously malformed (no `@`) → error, row skipped.
5. Email matches another row **earlier in the same file** → error ("duplicate email within file, see row N"), first occurrence wins and proceeds normally.
6. Email exactly matches an existing lead already in the DB (fetched once as an id+email map before validation) → **not a new lead**. Queued as an **update**: only the existing lead's currently-blank fields are filled in from the row (non-destructive merge); reported separately in the summary as "updated", not "created" or "error".

Explicitly **not** run for bulk import: the existing domain-based merge-proposal duplicate detection (`detectDuplicates`, used by manual single-lead creation) — because same company / same domain with a different contact is a legitimate, distinct lead, not a duplicate. Only exact email match counts here.

## Flow

1. User clicks "Bulk import" tab, downloads the template, fills it in Excel, uploads the `.xlsx` back (drag-and-drop or file picker).
2. Client parses the workbook (`exceljs`, new dependency) and runs validation above against:
   - the pipeline stages (to resolve "Prospect" stage id)
   - a one-time fetched map of existing lead emails → lead id
3. **Preview screen** (nothing written to DB yet): counts of rows to create / rows that will update an existing lead (with which fields will change) / rows with errors (row number + reason).
4. User clicks "Confirm import":
   - New rows → batched inserts into `leads` (chunked, e.g. 100 rows/request)
   - Update rows → per-row update of only the blank fields on the matched existing lead
   - A `history` log entry is written for each created and each updated lead, consistent with how the single-lead form logs history today
5. Results summary shown: created X, updated Y, errored Z (with reasons). No error-file re-download in this version.

## Architecture

- New dependency: `exceljs` (parses `.xlsx`; the template file itself is static, not generated at runtime).
- `src/services/leadImportService.ts` (new):
  - `parseLeadImportFile(file: File): RawImportRow[]`
  - `validateImportRows(rows, existingLeadEmailMap, prospectStageId): { toCreate, toUpdate, errors }`
  - `commitImport(toCreate, toUpdate): ImportSummary`
- `src/views/addlead/BulkImportPanel.tsx` (new): upload dropzone, preview table, confirm button, results view. Reuses existing `Modal` / `Button` / `Field` / `SegmentedToggle` components for visual consistency with the rest of the app.
- `AddLead.tsx`: add the `SegmentedToggle` switching between the existing single-lead form and `BulkImportPanel`.

## Testing

- Vitest unit tests for `leadImportService.ts`:
  - valid template parses correctly
  - wrong/renamed headers → whole-file rejection
  - missing Company Name / invalid Segment / invalid Source → row error
  - in-file duplicate email → second occurrence errors
  - DB duplicate email → routed to `toUpdate`, not `toCreate`
  - blank-fields-only merge logic doesn't overwrite existing non-blank fields
- Manual QA: run the real flow in-browser with a small real `.xlsx` file covering all the above cases, confirm Pipeline board shows new leads under "Prospect".

## Out of scope (this spec)

- Column-mapping UI (fixed template only, by decision)
- Removing the apparently-unused `owner_id` field — separate cleanup task
- ICP scoring from imported data
- CSV upload support (xlsx only, by decision)
- Error-row re-download after import
