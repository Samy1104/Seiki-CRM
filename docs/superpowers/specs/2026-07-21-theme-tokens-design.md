# Design Specification: Centralized Theme & Design Tokens System

**Date**: 2026-07-21  
**Status**: Approved by User  
**Author**: Full-Stack Developer  

---

## 1. Overview & Objective

Unify all design tokens, color palettes, surfaces, borders, typography, and elevation rules into a single source of truth in [src/theme.css](file:///d:/Stage/SEIKI/Projet/src/theme.css).

### Goals
- Establish a single, central CSS file (`src/theme.css`) controlling 100% of the application's visual theme.
- Eliminate hardcoded inline hex colors across components.
- Map legacy CSS variables in `src/index.css` (`--bg-main`, `--text-primary`, `--border-subtle`) to the unified Tailwind v4 `@theme` design tokens.
- Allow 1-line global palette customization (e.g. changing accent color or surface dark tones in 1 place updates the entire application).

---

## 2. Token Architecture & Mapping

```css
/* src/theme.css - Tailwind v4 @theme Block */
@theme {
  /* Surfaces */
  --color-base: #0A0B0D;       /* App background */
  --color-surface: #111214;    /* Cards, panels, sidebars */
  --color-elevated: #18191C;   /* Modals, popovers, dropdowns */
  --color-hover: #202126;      /* Interactive hover state */

  /* Text & Ink */
  --color-ink: #F5F5F4;        /* Primary text */
  --color-ink-soft: #9A9A93;   /* Secondary text */
  --color-ink-faint: #6B6B64;  /* Muted / disabled text */

  /* Borders & Dividers */
  --color-line: rgba(255, 255, 255, 0.06);
  --color-line-strong: rgba(255, 255, 255, 0.10);
  --color-line-focus: rgba(245, 158, 11, 0.35);

  /* Primary Accent (Amber / Brand) */
  --color-amber: #F59E0B;
  --color-amber-soft: rgba(245, 158, 11, 0.14);
  --color-amber-glow: rgba(245, 158, 11, 0.18);

  /* Semantic Feedback */
  --color-success: #4ADE80;
  --color-danger: #F87171;

  /* Typography */
  --font-display: 'Sora', system-ui, sans-serif;
  --font-ui: 'General Sans', system-ui, sans-serif;
}
```

### Bridge Mapping in `src/index.css`:
```css
:root {
  /* Legacy compatibility aliases pointing to unified tokens */
  --bg-deep: var(--color-base);
  --bg-main: var(--color-base);
  --bg-panel: var(--color-surface);
  --text-primary: var(--color-ink);
  --text-secondary: var(--color-ink-soft);
  --text-muted: var(--color-ink-faint);
  --border-subtle: var(--color-line);
}
```

---

## 3. Verification Plan

1. **Build Check**: Run `npm run build` (`tsc -b && vite build`) to confirm zero CSS syntax or build errors.
2. **Unit Tests**: Run `npm run test` (`vitest run`) to ensure UI components pass all tests.
3. **Visual Verification**: Check `Portal.tsx`, `Login.tsx`, and CRM pages to confirm theme consistency and theme token propagation.
