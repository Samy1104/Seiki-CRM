# Bulk Lead Import Page Redesign — Design Spec

Date: 2026-07-30

## Overview

Redesign `BulkImportPanel.tsx` in the CRM Add Lead section to align with global component styling, eliminate obsolete hint text ("astuce"), and elevate the visual aesthetics and usability of the bulk import workflow.

## Key Changes

1. **Remove Astuce Text**
   - Remove `<p className="text-xs text-ink-soft">Astuce : supprimez la ligne d'exemple du modèle avant de l'importer.</p>` from the file selection step.

2. **Global Download Template Button**
   - Replace the plain `<a>` link (`inline-flex items-center gap-1.5 text-xs font-semibold text-beige hover:underline`) with global UI component `Button` (or `AccentButton` variant `secondary`) with `<Download size={14} />`.
   - Accessible as a proper button/link element downloading `/templates/leads-import-template.xlsx`.

3. **Enhanced Visual Layout (Option 1 - Clean Modern Card)**
   - **Header**: Flex container with clear title ("Import en masse"), descriptive subtitle, and the secondary download button on the right.
   - **Dropzone**: Refined dropzone container with subtle background hover states, upload icon, clear title, and concise format hint (`Formats supportés : .xlsx`).
   - **Preview Step**: Clear stat indicator tiles (Leads à créer, Leads à mettre à jour, Erreurs de validation) and formatted error list with line tags.
   - **Actions**: Clean alignment of `Button` / `AccentButton` components across all steps (`select`, `preview`, `done`).

## Component Impact

- [MODIFY] `src/views/addlead/BulkImportPanel.tsx`
- [MODIFY] `src/views/addlead/BulkImportPanel.test.tsx` (ensure tests pass with new button element)

## Verification Plan

- Run Vitest tests for `BulkImportPanel.test.tsx` and `AddLead.test.tsx`.
- Ensure clean compilation without any lint or TypeScript errors.
