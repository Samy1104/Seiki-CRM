# HeaderActionButton — Shared "New X" Button

**Date**: 2026-07-22
**Status**: Approved by user

## Goal

Bring the Pipeline page's "Nouveau lead" button in line with the existing
charcoal/beige kanban theme (see
`2026-07-20-kanban-theme-regression-fix-design.md`), and give the Leads page
its own "Nouveau lead" button — reusing one shared component instead of
duplicating markup a third time.

## Problem

`TasksHeader.tsx` already renders a "Nouvelle tâche" button styled to the
approved charcoal/beige theme (uppercase, tracked label, beige background,
dark text, Plus icon). `Pipeline.tsx`'s "Nouveau lead" button never got
migrated to this theme — it still uses the older shared amber `Button`
component (`variant="primary"`). The Leads page ("Tous les leads") has no
equivalent button at all, even though it already receives an unused `setView`
prop that can drive it.

## Design

### New component: `src/components/ui/HeaderActionButton.tsx`

Extracts the exact button markup currently inlined in `TasksHeader.tsx`
(lines 69-81) into a reusable component:

```tsx
interface HeaderActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}
```

Renders the same beige pill button with a baked-in `Plus` icon
(`size={15}`, `strokeWidth={2.5}`) — both current/planned usages are
identical apart from the label, so the icon is not made configurable.

### Changes to existing files

- **`TasksHeader.tsx`**: replace the inline button (lines 69-81) with
  `<HeaderActionButton onClick={onNewTaskClick}>Nouvelle tâche</HeaderActionButton>`.
  Pure extraction — no visual change.
- **`Pipeline.tsx`**: replace
  `<Button variant="primary" onClick={() => setView('add')}><Plus size={16} />Nouveau lead</Button>`
  with `<HeaderActionButton onClick={() => setView('add')}>Nouveau lead</HeaderActionButton>`.
  Remove the now-unused `Button` and `Plus` imports.
- **`Leads.tsx`**: destructure `setView` from `LeadsProps` (declared but
  currently unused). Add
  `<HeaderActionButton onClick={() => setView('add')}>Nouveau lead</HeaderActionButton>`
  inside the existing `<div className="flex gap-2">` row, after the
  Actifs/Archivés toggle buttons, so it lands to the right of them on the
  same row as the "Tous les leads" title.

## Out of scope

- No changes to `Button.tsx` itself — it's still used elsewhere (Leads'
  Actifs/Archivés toggle, Fusionner/Ignorer, Fermer, etc.).
- No changes to the "add lead" flow/view itself (`AddLead.tsx`) — `setView('add')`
  already works from Pipeline; Leads gets the same wiring.
- No new dependencies.

## Verification

1. `npm run build` — clean TypeScript compilation (catches unused-import
   errors from the `Button`/`Plus` removal in `Pipeline.tsx`).
2. `npm run dev` — visually confirm:
   - Tasks page "Nouvelle tâche" button unchanged.
   - Pipeline page "Nouveau lead" button now beige/uppercase, opens the add-lead view.
   - Leads page shows a matching "Nouveau lead" button to the right of
     Actifs/Archivés, opens the same add-lead view.
