# Seiki CRM — Brand Redesign (Pass 1: Design System)

## Goal
Align Seiki CRM's visual identity with the real seiki.co brand (verified from
seiki.co's live Webflow CSS, not guesswork), replacing the current
approximate dark-purple theme with exact brand tokens, while keeping the CRM
usable as a dense data tool (not a marketing page).

## Scope of this pass
Design tokens + Sidebar + Login + shared primitives (`.btn`, `.card`, `.kpi`,
`.badge`) in `src/index.css`. These primitives cascade into all 9 views
(Pipeline, Leads, AddLead, Tasks, Agenda, Stats, Codir, Settings,
Prospection), so this pass changes their look everywhere without touching
view-specific classes yet. View-specific redesign (kanban cards, tables,
forms) is out of scope here — follow-up passes, one per view, in the order
listed above.

## Brand facts (verified from seiki.co)
- Purple: `#8f37ff` — Deep purple: `#431a80` — Light purple: `#a7aefc` / `#6a4ceb`
- Gold: `#f7b700`
- Backgrounds: `#000010` (deepest), `#1f1f2d` (panel tint)
- Text/neutrals: `#758696`, `#515750`, white `#ffffff`/`#fafafa`
- Fonts: Museo Sans (300/500/700, body), Codan (headings/display), Manrope (secondary)
- Radii: 16px cards, 100px pill buttons/badges (marketing site), 50% avatars

## Decisions (confirmed with user)
- Exact seiki.co hex values replace the CRM's current approximate palette.
- Fonts: self-hosted Museo Sans + Codan using files supplied at
  `D:\Stage\SEIKI\fonts`, copied into `src/assets/fonts/`. Fallback stack
  (Sora/Manrope) stays in the `font-family` list for resilience.
- Buttons use moderate 10px radius app-wide (not the marketing site's 100px
  pill) — pill shape doesn't suit dense toolbars/tables. Cards/KPI tiles use
  the brand's 16px radius.
- Green/red are kept for semantic meaning (success/danger, won/lost, SLA
  alerts) — the brand palette (purple/gold) covers identity, not state.

## 1. Design tokens (`src/index.css` `:root`)
```css
--purple:       #8f37ff;   /* was #6B5FE6 */
--purple-deep:  #431a80;   /* new: hover/border shade */
--purple-light: #a7aefc;   /* new: subtle highlight/glow tint */
--purple-glow:  rgba(143, 55, 255, 0.25);
--gold:         #f7b700;   /* was #F5B731 */
--gold-glow:    rgba(247, 183, 0, 0.25);
--bg-deep:      #000010;   /* was #05050A */
--bg-panel:     rgba(31, 31, 45, 0.55);  /* tint from #1f1f2d, was rgba(20,20,35,.55) */
--font-heading: 'Codan', 'Sora', system-ui, sans-serif;
--font-body:    'Museo Sans', 'Manrope', system-ui, sans-serif;
--radius-btn:   10px;      /* was 6px on .btn, .btn-logout */
--radius-card:  16px;      /* was 12px on .card, .kpi */
```
`--green`, `--red`, text-primary/secondary/muted stay unchanged.

`@font-face` declarations added for Codan (woff2/woff) and Museo Sans
(otf, weights 300/500/700) pointing at `src/assets/fonts/`.

## 2. Sidebar (`.sidebar`, `.nav-item`, `.logo-wordmark`, footer)
- Logo wordmark gradient: `--purple` → `--gold` (exact hex, was approximate).
- Active nav-item: background `rgba(143,55,255,0.12)`, border
  `rgba(143,55,255,0.3)`, glow retuned to `--purple-glow`.
- CODIR nav-item keeps its gold-accent treatment, recolored to `--gold`.
- Footer stats, logout button, "Powered by Seiki" block: same structure,
  recolored only.

## 3. Login (`.lock-screen-*`)
- Background radial glow recolored: brand purple `#8f37ff` + gold accent on
  `#000010` base (was generic violet).
- Headline (`.lock-screen-hero h1`) switches to `--font-heading` (Codan),
  gradient white → light gray kept.
- Card, inputs: same glass-panel structure, border/glow recolored to brand
  purple. Already at 10px radius — no radius change needed here.
- CTA button (`.lock-btn`): unchanged structurally, brand purple used in
  focus/hover glow.

## 4. Shared primitives
- `.btn`: radius 6px → 10px. `.btn-grad` gradient becomes `--purple` →
  `--purple-light` (was `--purple` → off-brand `#8b5cf6`).
- `.card`, `.kpi`: radius 12px → 16px, border tinted with brand purple at low
  opacity (was plain white-alpha).
- `.badge`, `.nav-badge`: unchanged (semantic colors, e.g. red for pending
  count).

## Out of scope (future passes)
View-specific classes: `.pipe-*` (kanban), `.leads-table*`, `.deal-card*`,
`.form-*`, `.score-*`, Stats charts, Codir dashboard, Settings panels,
Prospection/EmailGenerator UI. Each gets its own follow-up pass applying the
tokens above to its specific components, in view order: Pipeline → Leads →
AddLead → Tasks → Agenda → Stats → Codir → Settings → Prospection.

## Testing
Visual verification via dev server (`npm run dev`) — screenshot Sidebar,
Login, and one view using shared primitives (e.g. Pipeline's KPI row) before
and after, confirm no layout breakage (button text still fits at 10px
radius, card content unaffected by radius change, fonts load without FOUT
issues).
