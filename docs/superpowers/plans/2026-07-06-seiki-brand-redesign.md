# Seiki Brand Redesign (Pass 1: Design System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Seiki CRM's approximate dark-purple theme with the exact seiki.co brand tokens (colors, fonts, radii) in the design-system layer (`src/index.css` root tokens, Sidebar, Login, shared primitives), so every one of the 9 views inherits the corrected brand look without per-view edits yet.

**Architecture:** Pure CSS token + selector edit in the existing single stylesheet `src/index.css` (no new build tooling, no component restructuring). Two self-hosted font families are added via `@font-face` referencing files already copied to `src/assets/fonts/`. New CSS custom properties (`--purple`, `--gold`, `--font-heading`, `--font-body`, `--radius-btn`, `--radius-card`, etc.) are introduced/updated in `:root`; downstream selectors either already reference these vars (auto-update for free) or currently hardcode the old hex/rgba values (need explicit edits).

**Tech Stack:** Vanilla CSS (no preprocessor), Vite (asset resolution for `@font-face` `url()`), React/TSX views (untouched in this pass — no `.tsx` files change).

## Global Constraints

- Exact seiki.co hex values only: purple `#8f37ff`, deep purple `#431a80`, light purple `#a7aefc`, gold `#f7b700`, backgrounds `#000010` / `#1f1f2d` tint. Do not introduce new hex values not in the spec.
- Green (`--green`) and red (`--red`) tokens are semantic (success/danger/won/lost/SLA) — never recolor or repurpose them in this pass.
- Buttons: 10px radius app-wide (`--radius-btn`), never the marketing site's 100px pill.
- Cards/KPI tiles: 16px radius (`--radius-card`).
- No `.tsx` file changes in this pass — CSS only. If a view visibly breaks (text overflow, clipped content) because of a radius/font change, that's a signal to stop and flag it, not to silently patch the component.
- Font fallback stack (`Sora`, `Manrope`) must stay in the `font-family` declarations alongside `Codan`/`Museo Sans` for resilience if a font file fails to load.

---

### Task 1: Design tokens + self-hosted fonts

**Files:**
- Modify: `src/index.css:1-44` (Google Fonts `@import` line + `:root` token block)

**Interfaces:**
- Consumes: font files at `src/assets/fonts/codan/Codan-Regular.woff2`, `src/assets/fonts/codan/Codan-Regular.woff`, `src/assets/fonts/museo-sans/MuseoSans-300.otf`, `src/assets/fonts/museo-sans/MuseoSans-500.otf`, `src/assets/fonts/museo-sans/MuseoSans-700.otf` (already committed to the repo).
- Produces (consumed by Tasks 2-4): CSS custom properties `--purple` (`#8f37ff`), `--purple-deep` (`#431a80`), `--purple-light` (`#a7aefc`), `--purple-glow` (`rgba(143, 55, 255, 0.25)`), `--gold` (`#f7b700`), `--gold-glow` (`rgba(247, 183, 0, 0.25)`), `--bg-deep` (`#000010`), `--bg-panel` (`rgba(31, 31, 45, 0.55)`), `--border-active` (`rgba(143, 55, 255, 0.4)`), `--font-heading` (`'Codan', 'Sora', system-ui, sans-serif`), `--font-body` (`'Museo Sans', 'Manrope', system-ui, sans-serif`), `--radius-btn` (`10px`), `--radius-card` (`16px`). `--green`, `--red`, `--text-*`, `--border-subtle`, `--instit*` are unchanged.

- [ ] **Step 1: Replace the Google Fonts import and add self-hosted `@font-face` rules**

Current (`src/index.css:7`):
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Manrope:wght@300;400;500;600;700;800&family=Outfit:wght@100..900&display=swap');
```

Replace with:
```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Sora:wght@300;400;500;600;700;800&display=swap');

@font-face {
  font-family: 'Codan';
  src: url('./assets/fonts/codan/Codan-Regular.woff2') format('woff2'),
       url('./assets/fonts/codan/Codan-Regular.woff') format('woff');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Museo Sans';
  src: url('./assets/fonts/museo-sans/MuseoSans-300.otf') format('opentype');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Museo Sans';
  src: url('./assets/fonts/museo-sans/MuseoSans-500.otf') format('opentype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Museo Sans';
  src: url('./assets/fonts/museo-sans/MuseoSans-700.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

- [ ] **Step 2: Replace the `:root` token block**

Current (`src/index.css:9-44`):
```css
:root {
  /* Color Palette */
  --bg-deep: #05050A;
  --bg-main: #0A0A14;
  --bg-panel: rgba(20, 20, 35, 0.55);

  --text-primary: #F3F4F6;
  --text-secondary: #9CA3AF;
  --text-muted: #6B7280;

  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-active: rgba(107, 95, 230, 0.4);

  --purple: #6B5FE6;
  --purple-glow: rgba(107, 95, 230, 0.25);

  --gold: #F5B731;
  --gold-glow: rgba(245, 183, 49, 0.25);

  --green: #4ADE80;
  --green-glow: rgba(74, 222, 128, 0.25);

  --red: #F87171;
  --red-glow: rgba(248, 113, 113, 0.25);

  --instit: #8B5CF6;
  --instit-glow: rgba(139, 92, 246, 0.25);
  --instit-tc: #A78BFA;

  /* Fonts */
  --font-heading: 'Outfit', system-ui, sans-serif;
  --font-body: 'DM Sans', system-ui, sans-serif;

  /* Layout constraints */
  box-sizing: border-box;
}
```

Replace with:
```css
:root {
  /* Color Palette — exact seiki.co brand tokens */
  --bg-deep: #000010;
  --bg-main: #08080f;
  --bg-panel: rgba(31, 31, 45, 0.55);

  --text-primary: #F3F4F6;
  --text-secondary: #9CA3AF;
  --text-muted: #6B7280;

  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-active: rgba(143, 55, 255, 0.4);

  --purple: #8f37ff;
  --purple-deep: #431a80;
  --purple-light: #a7aefc;
  --purple-glow: rgba(143, 55, 255, 0.25);

  --gold: #f7b700;
  --gold-glow: rgba(247, 183, 0, 0.25);

  --green: #4ADE80;
  --green-glow: rgba(74, 222, 128, 0.25);

  --red: #F87171;
  --red-glow: rgba(248, 113, 113, 0.25);

  --instit: #8B5CF6;
  --instit-glow: rgba(139, 92, 246, 0.25);
  --instit-tc: #A78BFA;

  /* Fonts */
  --font-heading: 'Codan', 'Sora', system-ui, sans-serif;
  --font-body: 'Museo Sans', 'Manrope', system-ui, sans-serif;

  /* Radii */
  --radius-btn: 10px;
  --radius-card: 16px;

  /* Layout constraints */
  box-sizing: border-box;
}
```

- [ ] **Step 3: Verify the build still compiles**

Run: `npm run build`
Expected: exits 0, no CSS parse errors, `dist/` regenerated.

- [ ] **Step 4: Visual smoke check**

Run: `npm run dev`, open `http://localhost:5173` in the preview browser tool.
Expected: app loads with no console errors about missing fonts (check devtools Network tab — the 5 new font files return 200, not 404). Colors won't fully reflect the brand yet everywhere (Tasks 2-4 still pending) but nothing should be visually broken.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat: adopt seiki.co brand tokens and self-hosted fonts"
```

---

### Task 2: Sidebar recolor

**Files:**
- Modify: `src/index.css:183-245` (`.nav-item.on`, `.nav-item-codir.on`, `.btn-logout`)

**Interfaces:**
- Consumes: `--radius-btn` from Task 1. (Note: `.logo-wordmark` at `src/index.css:133-142` and `.seiki-footer-name` at `src/index.css:271-277` already reference `var(--purple)`, `var(--gold)`, `var(--font-heading)` — they recolor automatically from Task 1 with no edit needed here.)
- Produces: nothing consumed by later tasks (leaf styling).

- [ ] **Step 1: Recolor the active nav-item state**

Current (`src/index.css:183-188`):
```css
.nav-item.on {
  background: rgba(107, 95, 230, 0.12);
  color: #fff;
  border-color: rgba(107, 95, 230, 0.25);
  box-shadow: 0 0 10px rgba(107, 95, 230, 0.1);
}
```

Replace with:
```css
.nav-item.on {
  background: rgba(143, 55, 255, 0.12);
  color: #fff;
  border-color: rgba(143, 55, 255, 0.25);
  box-shadow: 0 0 10px rgba(143, 55, 255, 0.1);
}
```

- [ ] **Step 2: Recolor the CODIR nav-item accent**

Current (`src/index.css:190-195`):
```css
.nav-item-codir.on {
  background: rgba(245, 183, 49, 0.1);
  color: #fff;
  border-color: rgba(245, 183, 49, 0.25);
  box-shadow: 0 0 10px rgba(245, 183, 49, 0.1);
}
```

Replace with:
```css
.nav-item-codir.on {
  background: rgba(247, 183, 0, 0.1);
  color: #fff;
  border-color: rgba(247, 183, 0, 0.25);
  box-shadow: 0 0 10px rgba(247, 183, 0, 0.1);
}
```

- [ ] **Step 3: Switch `.btn-logout` to the shared button radius token**

Current (`src/index.css:225-239`):
```css
.btn-logout {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  font-size: 11px;
  font-family: var(--font-body);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  margin-top: 8px;
}
```

Replace with:
```css
.btn-logout {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  border-radius: var(--radius-btn);
  padding: 6px;
  cursor: pointer;
  font-size: 11px;
  font-family: var(--font-body);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  margin-top: 8px;
}
```

- [ ] **Step 4: Visual verification**

Run: `npm run dev` (or reload if already running), log in, open the preview browser.
Expected (use `preview_inspect` on `.nav-item.on` and `.logo-wordmark`): active nav item's computed `border-color` resolves to `rgba(143, 55, 255, 0.25)`; logo wordmark renders in Codan (or Sora fallback while font loads) with the purple→gold gradient. Click through the CODIR nav item and confirm its accent is gold, not the old muted amber.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "style: recolor sidebar nav states to brand purple/gold"
```

---

### Task 3: Login recolor

**Files:**
- Modify: `src/index.css:1981-2115` (`.lock-screen-container`, `.lock-screen-hero h1`, `.lock-screen-hero p`, `.lock-input`, `.lock-input:focus`)

**Interfaces:**
- Consumes: `--font-heading`, `--font-body` from Task 1.
- Produces: nothing consumed by later tasks (leaf view).

- [ ] **Step 1: Recolor the hero background glow and switch its base font to the token**

Current (`src/index.css:1981-1998`):
```css
.lock-screen-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  background-color: #05050a;
  background-image:
    radial-gradient(circle at 50% 30%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 30% 70%, rgba(107, 95, 230, 0.08) 0%, transparent 45%),
    linear-gradient(to right, rgba(255, 255, 255, 0.015) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 100% 100%, 100% 100%, 40px 40px, 40px 40px;
  font-family: 'Manrope', sans-serif;
  color: #ffffff;
  overflow: hidden;
}
```

Replace with:
```css
.lock-screen-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  background-color: #000010;
  background-image:
    radial-gradient(circle at 50% 30%, rgba(143, 55, 255, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 30% 70%, rgba(247, 183, 0, 0.06) 0%, transparent 45%),
    linear-gradient(to right, rgba(255, 255, 255, 0.015) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 100% 100%, 100% 100%, 40px 40px, 40px 40px;
  font-family: var(--font-body);
  color: #ffffff;
  overflow: hidden;
}
```

- [ ] **Step 2: Switch the headline to the brand heading font**

Current (`src/index.css:2013-2023`):
```css
.lock-screen-hero h1 {
  font-family: 'Manrope', sans-serif;
  font-size: 36px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -1px;
  margin: 0 0 12px 0;
  background: linear-gradient(180deg, #FFFFFF 0%, #D1D5DB 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

Replace with:
```css
.lock-screen-hero h1 {
  font-family: var(--font-heading);
  font-size: 36px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -1px;
  margin: 0 0 12px 0;
  background: linear-gradient(180deg, #FFFFFF 0%, #D1D5DB 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

- [ ] **Step 3: Switch the subtext and inputs to the brand body font**

Current (`src/index.css:2025-2031`):
```css
.lock-screen-hero p {
  font-family: 'Manrope', sans-serif;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  font-weight: 400;
}
```

Replace with:
```css
.lock-screen-hero p {
  font-family: var(--font-body);
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  font-weight: 400;
}
```

Current (`src/index.css:2058-2071`):
```css
.lock-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 15px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: #ffffff;
  font-family: 'Manrope', sans-serif;
  box-sizing: border-box;
  text-align: center;
  transition: all 0.3s ease;
  letter-spacing: 2px;
}
```

Replace with:
```css
.lock-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 15px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-btn);
  color: #ffffff;
  font-family: var(--font-body);
  box-sizing: border-box;
  text-align: center;
  transition: all 0.3s ease;
  letter-spacing: 2px;
}
```

- [ ] **Step 4: Recolor the input focus glow to brand purple**

Current (`src/index.css:2073-2078`):
```css
.lock-input:focus {
  outline: none;
  border-color: rgba(139, 92, 246, 0.6);
  box-shadow: 0 0 15px rgba(139, 92, 246, 0.25);
  background: rgba(0, 0, 0, 0.6);
}
```

Replace with:
```css
.lock-input:focus {
  outline: none;
  border-color: rgba(143, 55, 255, 0.6);
  box-shadow: 0 0 15px rgba(143, 55, 255, 0.25);
  background: rgba(0, 0, 0, 0.6);
}
```

- [ ] **Step 5: Visual verification**

Run: reload the preview browser at the login screen (logged-out state — use `preview_eval` to clear auth/localStorage if needed, or use an incognito-style reload).
Expected: `preview_screenshot` shows a near-black (`#000010`) background with a purple radial glow (no more violet `#8B5CF6`-tinted glow), headline rendering in Codan/Sora, input focus ring purple. `preview_inspect` on `.lock-input:focus` (after `preview_click` + checking `:focus` state via computed styles) confirms `border-color` is `rgba(143, 55, 255, 0.6)`.

- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "style: recolor login hero and inputs to brand purple, apply brand fonts"
```

---

### Task 4: Shared primitives (`.btn`, `.card`, `.kpi`)

**Files:**
- Modify: `src/index.css:305-312` (`.card`), `src/index.css:326-340` (`.kpi`, `.kpi:hover`), `src/index.css:682-713` (`.btn`, `.btn-grad`, `.btn-grad:hover`)

**Interfaces:**
- Consumes: `--radius-card`, `--radius-btn`, `--purple`, `--purple-deep`, `--purple-light`, `--purple-glow` from Task 1.
- Produces: nothing consumed by later tasks — this is the last task of Pass 1. All 9 views inherit these classes as-is (no per-view edits in this plan).

- [ ] **Step 1: Bump card radius and brand-tint the border**

Current (`src/index.css:305-312`):
```css
.card {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  box-sizing: border-box;
}
```

Replace with:
```css
.card {
  background: var(--bg-panel);
  border: 1px solid rgba(143, 55, 255, 0.08);
  border-radius: var(--radius-card);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  box-sizing: border-box;
}
```

- [ ] **Step 2: Bump KPI tile radius and brand-tint the border**

Current (`src/index.css:326-335`):
```css
.kpi {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
```

Replace with:
```css
.kpi {
  background: var(--bg-panel);
  border: 1px solid rgba(143, 55, 255, 0.08);
  border-radius: var(--radius-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
```

- [ ] **Step 3: Give the KPI hover state a brand-deep border accent**

Current (`src/index.css:337-340`):
```css
.kpi:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}
```

Replace with:
```css
.kpi:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  border-color: var(--purple-deep);
}
```

- [ ] **Step 4: Bump button radius and recolor the gradient variant to brand purple**

Current (`src/index.css:682-713`):
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 8px 16px;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--text-secondary);
}

.btn-grad {
  background: linear-gradient(135deg, var(--purple) 0%, #8b5cf6 100%);
  border: none;
  color: #fff;
  box-shadow: 0 2px 10px var(--purple-glow);
}

.btn-grad:hover {
  background: linear-gradient(135deg, #7c70f7 0%, #9066fa 100%);
  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
}
```

Replace with:
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  border-radius: var(--radius-btn);
  padding: 8px 16px;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--text-secondary);
}

.btn-grad {
  background: linear-gradient(135deg, var(--purple) 0%, var(--purple-light) 100%);
  border: none;
  color: #fff;
  box-shadow: 0 2px 10px var(--purple-glow);
}

.btn-grad:hover {
  background: linear-gradient(135deg, #9f52ff 0%, var(--purple-light) 100%);
  box-shadow: 0 4px 15px rgba(143, 55, 255, 0.4);
}
```

- [ ] **Step 5: Verify the build still compiles**

Run: `npm run build`
Expected: exits 0, no CSS errors.

- [ ] **Step 6: Visual verification across views**

Run: `npm run dev`, open the preview browser, navigate to Pipeline (uses `.kpi` row and `.card`), then any view with a `.btn-grad` action (e.g. AddLead's submit button).
Expected: `preview_inspect` on a `.kpi` element shows `border-radius: 16px`; `preview_inspect` on a `.btn-grad` element shows `border-radius: 10px` and a purple gradient background (no `#8b5cf6` violet). Hover a `.kpi` tile and confirm the border tints to `--purple-deep` (`#431a80`). `preview_screenshot` each view to confirm no clipped text or broken layout from the radius change.

- [ ] **Step 7: Commit**

```bash
git add src/index.css
git commit -m "style: apply brand radius tokens and purple gradient to shared card/kpi/button primitives"
```

---

## Out of Scope (future plans)

View-specific classes (`.pipe-*`, `.leads-table*`, `.deal-card*`, `.form-*`, `.score-*`, Stats charts, Codir dashboard, Settings panels, Prospection/EmailGenerator UI) are not touched by this plan. Each view gets its own follow-up plan applying the tokens established here, in order: Pipeline → Leads → AddLead → Tasks → Agenda → Stats → Codir → Settings → Prospection.
