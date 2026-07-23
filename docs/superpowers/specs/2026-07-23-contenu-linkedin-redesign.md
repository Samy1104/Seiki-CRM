# Design Specification: Contenu LinkedIn Page Redesign (Global Design System & Components)

**Date**: 2026-07-23  
**Status**: Approved by User  
**Author**: Antigravity Assistant  

---

## 1. Overview & Goal

Redesign the LinkedIn Content Creation Studio (`src/views/Contenu.tsx` and subcomponents under `src/views/contenu/`) to fully adopt the global design tokens (`src/theme.css`) and shared UI components (`src/components/ui/`).

### Key Goals
- Migrate hardcoded inline colors and legacy CSS variable references (`var(--bg-panel)`, `var(--gold)`, `#c8b89a`) to centralized `@theme` tokens (`--color-surface`, `--color-base`, `--color-amber`, `--color-line-strong`, `--color-line-focus`, `--color-ink`, `--color-ink-soft`, etc.).
- Replace raw HTML form elements and custom inline badges with shared UI components: `Field`, `inputClass`, `Button`, `AccentButton`, and `Badge`.
- Maintain existing stacked panel structure while establishing visual consistency with Login, Portal, CRM, and Agenda views.

---

## 2. Token Mapping & Component Specifications

### Token References
- **Backgrounds**: `bg-surface` (`#0d0d0d` / `#141414`) for panel cards, `bg-base` (`#0d0d0d`) for inputs and inner item cards.
- **Borders**: `border-line-strong` (`rgba(255,255,255,0.10)`) default, `border-line-focus` (`rgba(212,196,168,0.35)`) on focus.
- **Typography**: Headings use `font-display` (`Sora`), body and form labels use `font-ui` (`General Sans`).
- **Text colors**: Primary `text-ink` (`#F5F5F4`), Secondary `text-ink-soft` (`#9A9A93`), Muted `text-ink-faint` (`#6B6B64`).
- **Accents**: `text-amber` / `bg-amber` / `bg-amber-soft` (`#F59E0B`).

---

## 3. Subcomponent Breakdown

### 1. `src/views/contenu/ContenuHeader.tsx`
- Heading styled with `font-display` (`Sora`), `text-3xl sm:text-4xl font-bold tracking-tight text-ink`.
- Subtitle & eyebrow using `font-ui`, uppercase tracking.
- Connection action buttons refactored using `bg-surface border border-line-strong text-ink-soft hover:text-ink hover:border-line-focus rounded-control transition-all`.

### 2. `src/views/contenu/PostGeneratorForm.tsx`
- Panel card styled with `bg-surface border border-line-strong rounded-surface p-6 shadow-hover`.
- Brief textarea and Voice/Language selects wrapped in `Field` with `inputClass`.
- CTA "GÉNÉRER" button updated to `Button` variant `primary`.

### 3. `src/views/contenu/TagBookPanel.tsx`
- Panel card: `bg-surface border border-line-strong rounded-surface p-6 shadow-hover`.
- Alias tag pills: `text-amber bg-amber-soft border border-line-focus px-2 py-0.5 rounded-control font-semibold`.
- Alias, Nom affiché, and URN input fields wrapped in `Field` with `inputClass`.
- "Ajouter" CTA button updated to `Button` variant `primary`.

### 4. `src/views/contenu/PostEditorPreview.tsx`
- Panel card: `bg-surface border border-line-strong rounded-surface p-6 shadow-hover`.
- Hook (Accroche), Corps, and Hashtags fields styled with `inputClass`.
- Action buttons ("Valider & apprendre", "Copier") updated to `Button` variant `secondary` or `ghost`.
- `@mention` popup menu styled with `bg-elevated border border-line-strong shadow-modal rounded-overlay text-ink`.

### 5. `src/views/contenu/PostSchedulerPanel.tsx`
- Panel card: `bg-surface border border-line-strong rounded-surface p-6 shadow-hover`.
- Target Account dropdown, Date, Time, and Image inputs styled with `Field` and `inputClass`.
- Queue list items styled with `bg-base border border-line-strong rounded-control p-3.5`.
- Status badges migrated to `Badge` component:
  - `scheduled` -> `<Badge tone="warning">Programmé</Badge>`
  - `posted` -> `<Badge tone="success">Publié</Badge>`
  - `failed` -> `<Badge tone="danger">Échec</Badge>`

---

## 4. Verification Plan

1. **Build & Type Checking**: Run `npx tsc --noEmit` and `npm run build`.
2. **Unit Tests**: Run `npm run test` (`vitest run`) to confirm zero component regressions.
3. **Visual Verification**: Check `/contenu/linkedin` view in browser tab.
