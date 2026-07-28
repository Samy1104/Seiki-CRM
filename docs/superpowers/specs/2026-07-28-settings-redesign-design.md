# Settings Page Redesign (Charcoal & Beige Theme)

## Goal
Redesign the frontend UI/UX of the Settings page (`src/views/Settings.tsx` and sub-components in `src/views/settings/`) to align with the application's global design system (Charcoal `#0d0d0d`, Beige `#D4C4A8`, Playfair Display 900 typography, Sora headings, and custom `Button` / `AccentButton` components).

---

## 1. Page Header & Navigation
- **Page Header**: 
  - Title in `Playfair Display` 900 (`var(--color-charcoal-fg, #f2ede4)`), size `2.25rem`, tracking `-0.02em`.
  - Subtitle in `General Sans` (`text-ink-soft`), size `0.875rem`.
- **Top Navigation Bar**:
  - Horizontal pill-style tab buttons matching `ProspectionHeader` patterns.
  - Active tab: `bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus shadow-sm`.
  - Inactive tab: `bg-surface text-ink-soft border-line-strong hover:text-ink hover:border-line-focus`.
  - Lucide icons: `Users` (Membres), `GitBranch` (Pipeline), `Sliders` (SLA), `Mail` (Prospection).

---

## 2. Tab Component Redesigns

### A. MembersTab (`src/views/settings/MembersTab.tsx`)
- **Layout**: 2-column responsive grid (`lg:grid-cols-[1.6fr_1fr]`).
- **Left Panel (Active Members)**:
  - Charcoal elevated surface card (`bg-elevated border border-line rounded-surface p-5`).
  - Sora bold heading with member count badge (`#f2ede4`).
  - Redesigned table / user rows with:
    - Initials avatar with smooth color backgrounds.
    - Full Name (`text-ink font-semibold`), Email (`text-ink-soft`), and Role badge (`Collaborateur` in `#D4C4A8` tone).
    - Quick-action buttons (Edit icon, Delete icon with hover danger states).
- **Right Panel (Add / Edit Member Form)**:
  - Elevated card with title `"Ajouter un membre"` or `"Modifier le membre"`.
  - Input fields using `Field` + `inputClass` styled with focus ring `border-line-focus`.
  - Primary action: `AccentButton` in primary variant (`bg-[#D4C4A8] text-[#0d0d0d] font-semibold uppercase tracking-[0.12em]`).
  - Secondary action: Cancel button in secondary accent variant.

### B. PipelineStagesTab (`src/views/settings/PipelineStagesTab.tsx`)
- **Layout**: 2-column responsive grid (`lg:grid-cols-[1.6fr_1fr]`).
- **Left Panel (Commercial Pipeline Stages)**:
  - Sequence card layout for stages showing position chips (`#1`, `#2`), stage color indicators, stage name, and "Closed Won" / "Actif" badges.
  - Deletion button with validation safety state.
- **Right Panel (Add Stage Form)**:
  - Form fields for Stage Name, Color Picker (with color preview dot and hex code), and "Etape finale de succès (Gagné)" checkbox.
  - Primary submission: `AccentButton` with `Plus` icon.

### C. SlaTab (`src/views/settings/SlaTab.tsx`)
- **Layout**: Full-width elevated card (`bg-elevated border border-line rounded-surface p-6`).
- **SLA Cards**:
  - Segment Media SLA (days), Segment Retail SLA (days), Segment Instit SLA (days).
  - Clean numeric inputs with helper text badges describing alert conditions.
- **AI ICP Scoring Feature Box**:
  - Border-t divider, title `"Enrichissement et scoring automatique"`.
  - Styled toggle switch using `#D4C4A8` / amber accent for active state.
- **Save Button**: `AccentButton` ("Enregistrer les paramètres").

### D. ProspectionSettingsTab (`src/views/settings/ProspectionSettingsTab.tsx`)
- **Layout**: Vertical stack of 2 elevated cards.
- **Card 1: Gmail Sending & Anti-Spam Pacing**:
  - Warm-up start date input, daily cap ceiling input, send window start/end time inputs, and Gmail From Name input.
  - Informative callout banner explaining anti-spam protection rules.
  - Save button (`AccentButton`).
- **Card 2: Relances & Archiving**:
  - Follow-up 1 delay, Follow-up 2 delay, and auto-archive limit inputs.
  - Save button (`AccentButton`).

---

## 3. UI Tokens & Styling Specifications
- **Surfaces**: `--color-base` (`#0d0d0d`), `--color-elevated` (`#141414`), `--color-hover` (`#1a1a1a`).
- **Borders**: `--color-line` (`rgba(255, 255, 255, 0.06)`), `--color-line-strong` (`rgba(255, 255, 255, 0.10)`), `--color-line-focus` (`rgba(212, 196, 168, 0.35)`).
- **Text**: Ink primary (`#F5F5F4`), Ink soft (`#9A9A93`), Charcoal FG (`#f2ede4`), Beige (`#D4C4A8`).
- **Buttons**: `AccentButton` primary variant (Beige `#D4C4A8`, dark text `#0d0d0d`, uppercase tracking) and secondary variant.
