# Seiki CRM — Full Visual Rebuild ("Graphite Amber")

## Goal

Rebuild the Seiki CRM's visual layer to a $10k-agency standard: a new, cohesive
"polished enterprise" dark design system applied consistently across every
view, unified on Tailwind v4, with tasteful animation and real responsive
support — while leaving the existing Supabase data layer, services, and
features untouched. This supersedes the unfinished 2026-07-06 brand-redesign
pass (which only covered tokens + sidebar + login + shared primitives and
explicitly deferred every view); that pass's brand tokens (purple/gold) are
discarded in favor of a new palette chosen below.

## Decisions (confirmed with user)

- **New visual direction**, not an extension of the old purple/gold brand
  system — full creative freedom, no anchor to seiki.co's marketing palette.
- **Dark mode only** — no light theme, no toggle.
- **Scope: everything.** All ~10 views (Pipeline, Leads, AddLead, Tasks,
  Agenda, Stats, Codir, Settings, Prospection, Contenu) plus Login and Portal.
  Actual implementation still ships view-by-view (see Rollout below) — "one
  pass" describes coverage, not that every file changes in a single commit.
- **Unify on Tailwind v4** for every view (already a dependency; already used
  in Contenu/Prospection). The legacy hand-written `src/index.css` (68KB) is
  replaced.
- **Animation level: subtle & professional** — polished micro-interactions,
  not flashy/expressive motion.
- **New dependencies are fine** — this is being treated as a real $10k-caliber
  build, not a constrained patch. Concrete additions are listed under
  Technical Approach; more may be added during implementation as needs
  surface.
- Palette/typography/density were chosen through iterative visual review
  (mockups in `.superpowers/brainstorm/`), landing on the tokens below after
  comparing 3 palette directions, 2 density options, and 2 rounds of font
  pairings (informed by reference screenshots the user supplied in
  `Idées de design/`).

## 1. Visual identity

### Palette — "Graphite Amber"

Neutral charcoal surfaces, a single amber accent carrying all brand/CTA
weight, no blue or purple anywhere in the UI chrome.

```css
--bg-base:      #0A0B0D;  /* app background */
--bg-surface:   #111214;  /* sidebar, panel wrappers */
--bg-elevated:  #18191C;  /* cards, KPI tiles, table rows, kanban cards */
--bg-hover:     #202126;  /* hover elevation */

--border-subtle:   rgba(255,255,255,0.06);
--border-default:  rgba(255,255,255,0.10);
--border-emphasis: rgba(245,158,11,0.35); /* focus/active, amber-tinted */

--text-primary:   #F5F5F4;
--text-secondary: #9A9A93;
--text-muted:     #6B6B64;

--amber:          #F59E0B;  /* sole brand/CTA/active accent */
--amber-soft-bg:  rgba(245,158,11,0.14); /* active nav, badges, chips */
--amber-glow:     rgba(245,158,11,0.18);

--success:  #4ADE80;  /* won, positive delta */
--danger:   #F87171;  /* lost, SLA breach */

--chart-neutral: #64748B; /* desaturated slate — charts only, never UI chrome */
```

The one deliberate exception to "no blue/purple": multi-series charts (Stats,
Codir) need a 4th neutral color beyond amber/green/red for comparison series
— `--chart-neutral` (slate-gray) fills that role. It never appears on
buttons, nav, or badges.

Elevation is flat: soft box-shadows for lift, no backdrop-blur/glassmorphism
(a deliberate break from the previous dark-glass aesthetic).

```css
--shadow-hover: 0 8px 24px rgba(0,0,0,0.35);
--shadow-modal: 0 20px 60px rgba(0,0,0,0.4);
```

### Typography

- **Headings & KPI numbers**: Sora (600/700/800), self-hosted.
- **Body & UI text**: General Sans (400/500/600), self-hosted via Fontshare
  (same self-hosting pattern already used for Codan/Museo Sans — files land
  in `src/assets/fonts/`, `@font-face` declared, no runtime CDN dependency).
- Numeric values use `font-variant-numeric: tabular-nums` throughout (tables,
  KPIs, deal values) for alignment.

### Density & radius — "Structured & Comfortable"

```css
--radius-sm:   8px;   /* inputs, small buttons, badges */
--radius-md:   12px;  /* cards, kanban cards, table containers */
--radius-lg:   16px;  /* modals, major panels */
--radius-pill: 999px; /* badges/chips only */
```

Buttons use `--radius-sm` (8px) — not `--radius-pill` — dense toolbars and
repeated action buttons don't suit a marketing-style pill shape.

Generous padding (16-20px inside cards/panels, 20-24px between sections) —
prioritizes comfort over maximum information density.

## 2. Motion system

- **Timing**: 150ms hover/focus feedback, 200-250ms panel/modal transitions.
  `ease-out` on entrances, `ease-in` on exits. No bounce/spring easing except
  the kanban drag itself.
- **Micro-interactions**: buttons/cards lift 1-2px + soft shadow on hover;
  active nav item slides rather than snaps; inputs get a soft amber focus
  ring.
- **Data feels alive**: KPI numbers count up on load/refresh; list/table rows
  fade+slide in with a small stagger (~30ms/row) instead of appearing all at
  once.
- **Structural motion**: kanban cards use real drag physics via the `motion`
  library (already installed) with spring-back on drop; modals/toasts
  slide+fade from their anchor edge; skeleton loaders shimmer while data
  loads (no bare spinners).
- **Respect for the user**: everything collapses to near-instant under
  `prefers-reduced-motion`; animations trigger only on genuine state changes
  (load, create, status change), never on every re-render.

## 3. Component library & per-view rollout

One definition per shared primitive, reused everywhere: buttons, cards/panels,
inputs, badges, tables, modals, toasts, tabs, sidebar nav, KPI tiles, kanban
cards, skeleton loaders.

View-specific notes:
- **Pipeline** (flagship, already validated at full scale): kanban cards with
  status-color left border, deal value in Sora, avatar stack + SLA badge.
- **Leads / Tasks (list view)**: sticky header, tabular-nums, row-hover
  highlight, sortable columns; on mobile, rows become stacked cards rather
  than a horizontally-scrolling table.
- **Stats / Codir**: gauge + sparkline chart treatments (reference: the
  Pixel Mags-style dashboard in `Idées de design/`), redrawn in
  amber/green/red/slate rather than that reference's teal palette.
- **AddLead / Settings**: consistent input/select/textarea styling, inline
  validation states.
- **Login / Portal**: same tokens, but more visual weight (larger hero type,
  more breathing room) since it's the first impression.
- **Prospection / Contenu**: already on Tailwind with their own look —
  re-pointed at the new tokens so they stop feeling like a separate app.

### Rollout order

Shared tokens/primitives first, then per view in the order the team actually
uses them day-to-day: **Pipeline → Leads → AddLead → Tasks → Agenda → Stats →
Codir → Settings → Prospection → Contenu → Login/Portal.** This sequencing is
mechanics for the implementation plan — the design applies to all of them,
none are deferred to "later."

## 4. Responsive strategy

Breakpoints: 375px (mobile), 768px (tablet portrait), 1024px (tablet
landscape/small laptop), 1440px+ (desktop, primary).

- **Sidebar**: full labeled nav ≥1024px → icon-only rail on tablet →
  slide-over drawer behind a hamburger <768px. Same nav items throughout.
- **Kanban (Pipeline)**: horizontal-scroll columns on tablet; single-column
  view with a stage-switcher (tabs) on mobile instead of squeezed columns.
- **Tables (Leads, Tasks list)**: collapse to stacked cards on mobile, same
  data per row.
- **KPI rows**: 4-across desktop → 2x2 tablet → stacked mobile.
- **Forms/modals**: full-screen sheet on mobile instead of a centered modal.
- **Touch targets**: minimum 40px hit area on mobile regardless of visual
  size.

This is real per-view engineering (alternate layouts, not just reflow), not a
single global media-query pass.

## 5. Technical approach

- **Tailwind v4 as the single styling system.** Design tokens (colors, radii,
  spacing, fonts, shadows) defined via `@theme` in a new `src/theme.css`,
  replacing the current hand-written `src/index.css`. Contenu/Prospection
  (already Tailwind) get re-pointed at the new tokens; the remaining views
  (Pipeline, Leads, Tasks, Agenda, Stats, Codir, Settings, AddLead, Login,
  Portal, Sidebar) are converted from vanilla-CSS classNames to Tailwind
  utilities as part of their redesign pass.
- **Fonts**: Sora + General Sans self-hosted under `src/assets/fonts/`,
  following the existing Codan/Museo Sans pattern.
- **Motion**: continue using the `motion` library already installed — no new
  animation dependency.
- **New dependencies anticipated**:
  - A charting library for Stats/Codir gauge/sparkline treatments — no chart
    library exists in the project today. Likely **Recharts** (React-native
    API, good Tailwind/dark-theme compatibility).
  - `clsx` (and possibly `tailwind-merge`) for conditional/composable utility
    classes in shared components.
  - More may be added during implementation if a specific component
    genuinely needs it (user has pre-approved this).
- **No functional changes**: this is a visual/UX rebuild on top of the
  existing Supabase schema, services, and business logic. No new features,
  no schema changes, no behavior changes.
- **Verification**: each view is checked against real Supabase data in the
  dev server — not just static mockups — at 375/768/1024/1440px before being
  considered done.

## Out of scope

- Any of the features listed as pending in `progress.md` (multichannel
  sequences, automatic prospecting, SMTP/IMAP inbox, Chrome extension, AI
  scoring) — purely visual/UX work here.
- Light mode / theme toggle.
- Migrating off state-based navigation to a router (not needed for the
  responsive/drawer approach chosen above).
- Schema or service-layer changes.

## Testing

Visual verification via `npm run dev` against real Supabase data, per view,
at all four breakpoints, plus a `prefers-reduced-motion` pass and a keyboard/
focus-visible pass per the standard pre-delivery checklist (contrast, cursor
affordances, no emoji-as-icons, consistent Lucide icon set).
