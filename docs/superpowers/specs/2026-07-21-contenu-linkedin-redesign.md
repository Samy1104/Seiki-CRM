# Design Spec: Contenu LinkedIn Page Redesign (Graphite & Gold Theme)

**Date**: 2026-07-21  
**Status**: Approved by User  

## Overview
Redesign the LinkedIn Content creation studio page (`src/views/Contenu.tsx` and subcomponents in `src/views/contenu/`) to match the new global design system (Graphite & Gold / Amber theme tokens) established in `src/theme.css` and `src/index.css`, aligning visually with the Login, Portal, and Agenda views.

## Key Design Requirements & Tokens

### 1. Typography & Hierarchy
- **Primary Headings**: Use `Sora` font via `var(--font-heading)`, `font-bold`, `tracking-tight`, and color `var(--text-primary)` (`#F5F5F4`).
- **Subtitles & Section Titles**: Uppercase tracking-widest style (`text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)]`).
- **Body & Controls**: Use `General Sans` / `Inter` via `var(--font-body)`.

### 2. Color Palette & Token Mapping
- **Background Root**: `var(--bg-deep)` (`#0A0B0D`).
- **Panels & Cards**: `var(--bg-panel)` (`#111214` / `#0d0d0d`) with `rounded-2xl` and `border border-[var(--border-subtle)]`.
- **Borders**: `var(--border-subtle)` (`rgba(255, 255, 255, 0.06)`), transition to `#c8b89a` / `var(--border-active)` (`rgba(245, 158, 11, 0.35)`) on focus.
- **Accents & Action Buttons**: `var(--gold)` (`#F59E0B`) and `#c8b89a` for primary CTAs, `@alias` tags, and active focus highlights.
- **Form Control Inputs**: `bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[#c8b89a]` with smooth transitions.

## Component Breakdown

### 1. Header (`src/views/contenu/ContenuHeader.tsx`)
- Display page title in `Sora` font (`var(--font-heading)`) with clear subtitle.
- Redesign LinkedIn connection buttons ("Jaafar" personal & "Seiki" company) as dark pill cards with border hover transitions (`#c8b89a`), connection status indicators, and subtle icons.

### 2. Generator Form (`src/views/contenu/PostGeneratorForm.tsx`)
- Panel container using `bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)]`.
- Brief textarea & selects (Voix, Langue) styled with dark translucent backgrounds (`bg-black/40`), custom focus rings (`#c8b89a`), and crisp typography.
- Primary CTA button "GÉNÉRER" styled with `var(--gold)` background, dark text, uppercase tracking, and hover glow.

### 3. TagBook Panel (`src/views/contenu/TagBookPanel.tsx`)
- Panel container using `bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)]`.
- Existing tag pills styled with `@alias` in `#c8b89a` / `var(--gold)` with delete action icons.
- Add tag inputs (Alias, Nom affiché, URN LinkedIn) matching global input styling.

### 4. Post Editor & Preview (`src/views/contenu/PostEditorPreview.tsx`)
- Panel container using `bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)]`.
- Editor split into Hook (Accroche) and Corps fields with focus glow.
- `@mention` popup menu styled as dark elevated panel (`bg-[var(--bg-panel)] border border-[var(--border-subtle)] shadow-modal`) with gold alias highlights.
- Top-right action buttons ("Valider et enregistrer", "Copier") styled with subtle icons and hover states.

### 5. Post Scheduler Panel (`src/views/contenu/PostSchedulerPanel.tsx`)
- Panel container using `bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)]`.
- Target account dropdown, Date, Time, and Image input controls styled with dark input tokens.
- Queue listing displaying scheduled posts with semantic status badges (`scheduled`: amber/muted, `posted`: `--color-success`, `failed`: `--color-danger`).

## Verification Plan
1. Visual audit of `src/views/Contenu.tsx` and all 5 subcomponents.
2. Build verification using `npm run build` or `npx tsc --noEmit` to confirm no TypeScript or syntax regressions.
