# CRM Visual Rebuild — Foundation, Sidebar, Login, Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Graphite Amber design-system foundation (Tailwind v4 tokens, self-hosted fonts, shared UI primitives) and apply it to the Sidebar, Login, and Pipeline — the app-shell and flagship view — per `docs/superpowers/specs/2026-07-19-crm-visual-rebuild-design.md`.

**Architecture:** Tailwind v4 theme tokens are added globally via a new `src/theme.css` (theme+utilities layers only, no preflight — same technique already used in `src/views/prospection.css`, so it can't collide with the legacy plain-CSS views that haven't migrated yet). New shared primitives (`Button`, `Badge`, `KpiTile`) live in `src/components/ui/`. Sidebar, Login, and Pipeline are rewritten to consume Tailwind utilities + these primitives instead of the legacy `.nav-item`/`.lock-*`/`.kpi`/`.pipe-*`/`.deal-*` classes in `src/index.css` (which stay in place, untouched, for the views not yet migrated).

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4 (`@tailwindcss/vite`, already installed), `motion` (already installed, `import { motion } from 'motion/react'`), Vitest + Testing Library (already configured).

## Global Constraints

- No functional/behavior changes to any view — this is a visual rebuild only. Do not add, remove, or change what any button/form/service call does.
- Dark mode only. No light theme, no toggle.
- Palette: neutral charcoal surfaces + a single amber (`#F59E0B`) accent. No blue or purple anywhere in UI chrome (charts are the one exception, out of scope for this plan).
- Typography: Sora (headings/KPI numbers), General Sans (body/UI text). Both self-hosted — no runtime CDN font dependency.
- Buttons use `--radius-sm` (8px), not a pill shape.
- Respect `prefers-reduced-motion` in every animated component.
- Legacy `src/index.css` is not deleted or edited in this plan — other views still depend on it until their own redesign pass.

---

## File Structure

**Create:**
- `src/theme.css` — Tailwind v4 `@theme` tokens (Graphite Amber palette, fonts, radii, shadows) + `@font-face` declarations.
- `src/assets/fonts/sora/Sora-600.woff2`, `Sora-700.woff2`, `Sora-800.woff2`
- `src/assets/fonts/general-sans/GeneralSans-400.woff2`, `GeneralSans-500.woff2`, `GeneralSans-600.woff2`
- `src/components/ui/Button.tsx` + `src/components/ui/Button.test.tsx`
- `src/components/ui/Badge.tsx` + `src/components/ui/Badge.test.tsx`
- `src/components/ui/KpiTile.tsx` + `src/components/ui/KpiTile.test.tsx`
- `src/components/ui/Modal.test.tsx`
- `src/components/SideBar.test.tsx`
- `src/views/Login.test.tsx`
- `src/views/pipeline/DealCard.tsx` — extracted kanban card (mirrors the existing `src/views/tasks/KanbanColumn.tsx` extraction pattern)

**Modify:**
- `src/main.tsx` — import `./theme.css`
- `src/components/ui/Modal.tsx` — restyle to new tokens, same props/API
- `src/components/SideBar.tsx` — full rewrite: Tailwind utilities, responsive (full nav ≥1024px, icon rail 768–1023px, drawer <768px)
- `src/views/Login.tsx` — full rewrite: Tailwind utilities, same form logic
- `src/views/Pipeline.tsx` — page header, KPI row, SLA banner, and kanban board rewritten to Tailwind + new components

---

### Task 1: Global Tailwind v4 theme tokens

**Files:**
- Create: `src/theme.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: Tailwind utility classes usable anywhere in the app going forward: `bg-base`, `bg-surface`, `bg-elevated`, `bg-hover`, `border-line`, `border-line-strong`, `border-line-focus`, `text-ink`, `text-ink-soft`, `text-ink-faint`, `bg-amber`/`text-amber`/`border-amber`, `bg-amber-soft`, `text-success`, `text-danger`, `text-chart-neutral`, `font-heading`, `font-body`, `rounded-sm`/`rounded-md`/`rounded-lg`, `shadow-hover`, `shadow-modal`.

- [ ] **Step 1: Create `src/theme.css`**

```css
/* ============================================================
   Graphite Amber — Tailwind v4 theme tokens.
   Theme + utilities layers only, no preflight — same technique as
   src/views/prospection.css, so this can never override the legacy
   plain-CSS views (unlayered CSS always wins over layered CSS,
   regardless of import order). Safe to import globally.
   ============================================================ */
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);

@font-face {
  font-family: 'Sora';
  src: url('./assets/fonts/sora/Sora-600.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Sora';
  src: url('./assets/fonts/sora/Sora-700.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Sora';
  src: url('./assets/fonts/sora/Sora-800.woff2') format('woff2');
  font-weight: 800;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'General Sans';
  src: url('./assets/fonts/general-sans/GeneralSans-400.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'General Sans';
  src: url('./assets/fonts/general-sans/GeneralSans-500.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'General Sans';
  src: url('./assets/fonts/general-sans/GeneralSans-600.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}

@theme {
  /* surfaces */
  --color-base: #0A0B0D;
  --color-surface: #111214;
  --color-elevated: #18191C;
  --color-hover: #202126;

  /* borders */
  --color-line: rgba(255, 255, 255, 0.06);
  --color-line-strong: rgba(255, 255, 255, 0.10);
  --color-line-focus: rgba(245, 158, 11, 0.35);

  /* text */
  --color-ink: #F5F5F4;
  --color-ink-soft: #9A9A93;
  --color-ink-faint: #6B6B64;

  /* accent */
  --color-amber: #F59E0B;
  --color-amber-soft: rgba(245, 158, 11, 0.14);
  --color-amber-glow: rgba(245, 158, 11, 0.18);

  /* semantic */
  --color-success: #4ADE80;
  --color-danger: #F87171;
  --color-chart-neutral: #64748B;

  /* type */
  --font-heading: 'Sora', system-ui, sans-serif;
  --font-body: 'General Sans', system-ui, sans-serif;

  /* radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  /* elevation */
  --shadow-hover: 0 8px 24px rgba(0, 0, 0, 0.35);
  --shadow-modal: 0 20px 60px rgba(0, 0, 0, 0.4);
}
```

- [ ] **Step 2: Import it globally in `src/main.tsx`**

Modify `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no errors (font files don't exist on disk yet at this point, which is fine — `url()` references in CSS aren't resolved/validated until Task 2 adds the actual files; Vite doesn't fail the build over a missing asset referenced only in CSS `url()`, it just 404s that specific request at runtime, which is why Task 2 must land before Task 3 in the rollout).

- [ ] **Step 4: Commit**

```bash
git add src/theme.css src/main.tsx
git commit -m "feat: add global Tailwind v4 theme tokens for CRM visual rebuild"
```

---

### Task 2: Self-hosted Sora + General Sans fonts

**Files:**
- Create: `src/assets/fonts/sora/Sora-600.woff2`, `src/assets/fonts/sora/Sora-700.woff2`, `src/assets/fonts/sora/Sora-800.woff2`
- Create: `src/assets/fonts/general-sans/GeneralSans-400.woff2`, `src/assets/fonts/general-sans/GeneralSans-500.woff2`, `src/assets/fonts/general-sans/GeneralSans-600.woff2`

**Interfaces:**
- Consumes: the `@font-face` declarations already written in `src/theme.css` (Task 1), which point at these exact file paths.
- Produces: `font-heading` / `font-body` Tailwind utilities now render actual Sora/General Sans glyphs instead of falling back to `system-ui`.

- [ ] **Step 1: Download the font files**

These exact URLs were verified working during planning (real files, confirmed via `file` — WOFF2/TrueType, ~15-23KB each):

```bash
mkdir -p src/assets/fonts/sora src/assets/fonts/general-sans

curl -sL -o src/assets/fonts/sora/Sora-600.woff2 "https://fonts.gstatic.com/s/sora/v17/xMQOuFFYT72X5wkB_18qmnndmSeMmU-NKQI.woff2"
curl -sL -o src/assets/fonts/sora/Sora-700.woff2 "https://fonts.gstatic.com/s/sora/v17/xMQOuFFYT72X5wkB_18qmnndmSe1mU-NKQI.woff2"
curl -sL -o src/assets/fonts/sora/Sora-800.woff2 "https://fonts.gstatic.com/s/sora/v17/xMQOuFFYT72X5wkB_18qmnndmSfSmU-NKQI.woff2"

curl -sL -o src/assets/fonts/general-sans/GeneralSans-400.woff2 "https://cdn.fontshare.com/wf/MFQT7HFGCR2L5ULQTW6YXYZXXHMPKLJ3/YWQ244D6TACUX5JBKATPOW5I5MGJ3G73/7YY3ZAAE3TRV2LANYOLXNHTPHLXVWTKH.woff2"
curl -sL -o src/assets/fonts/general-sans/GeneralSans-500.woff2 "https://cdn.fontshare.com/wf/3RZHWSNONLLWJK3RLPEKUZOMM56GO4LJ/BPDRY7AHVI3MCDXXVXTQQ76H3UXA63S3/SB2OEB6IKZPRR6JT4GFJ2TFT6HBB6AZN.woff2"
curl -sL -o src/assets/fonts/general-sans/GeneralSans-600.woff2 "https://cdn.fontshare.com/wf/K46YRH762FH3QJ25IQM3VAXAKCHEXXW4/ISLWQPUZHZF33LRIOTBMFOJL57GBGQ4B/3ZLMEXZEQPLTEPMHTQDAUXP5ZZXCZAEN.woff2"
```

- [ ] **Step 2: Verify all 6 files downloaded correctly**

Run: `file src/assets/fonts/sora/*.woff2 src/assets/fonts/general-sans/*.woff2`
Expected: all 6 lines report `Web Open Font Format (Version 2)` — if `curl` returned an HTML error page instead (e.g. a link expired), the file will be a few hundred bytes of text/HTML instead of a WOFF2 binary; re-fetch from Google Fonts' CSS2 API (`https://fonts.googleapis.com/css2?family=Sora:wght@600&display=swap` with a modern `-A` User-Agent string, the "latin" `src: url(...)` entry) or Fontshare's API (`https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap`) if any link has gone stale.

- [ ] **Step 3: Confirm fonts load in the dev server**

Run the dev server (`npm run dev`), open the app in a browser, open DevTools → Network → filter by "Font". Reload. Expected: `Sora-700.woff2` and `GeneralSans-400.woff2` (at minimum) appear with a 200 status — nothing currently renders Sora/General Sans text yet (that starts in Task 7+), so this step just confirms the `@font-face` `url()` paths resolve correctly relative to `src/theme.css`, not that any visible text uses them yet.

- [ ] **Step 4: Commit**

```bash
git add src/assets/fonts/sora src/assets/fonts/general-sans
git commit -m "feat: self-host Sora and General Sans font files"
```

---

### Task 3: `Button` shared component

**Files:**
- Create: `src/components/ui/Button.tsx`
- Test: `src/components/ui/Button.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
  type ButtonSize = 'sm' | 'md';
  interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant; // default 'secondary'
    size?: ButtonSize;       // default 'md'
  }
  export const Button: React.FC<ButtonProps>;
  ```
  Renders a native `<button>` — all standard button props (`onClick`, `disabled`, `type`, etc.) pass through.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/Button.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders its children and responds to clicks', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Nouveau lead</Button>);

    const btn = screen.getByRole('button', { name: 'Nouveau lead' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to the secondary variant and md size', () => {
    render(<Button>Action</Button>);
    const btn = screen.getByRole('button', { name: 'Action' });
    expect(btn.className).toContain('bg-elevated');
    expect(btn.className).toContain('px-4');
  });

  it('applies primary variant styling', () => {
    render(<Button variant="primary">Nouveau lead</Button>);
    const btn = screen.getByRole('button', { name: 'Nouveau lead' });
    expect(btn.className).toContain('bg-amber');
  });

  it('applies danger variant styling', () => {
    render(<Button variant="danger">Supprimer</Button>);
    const btn = screen.getByRole('button', { name: 'Supprimer' });
    expect(btn.className).toContain('text-danger');
  });

  it('respects the disabled prop', () => {
    render(<Button disabled>Nouveau lead</Button>);
    expect(screen.getByRole('button', { name: 'Nouveau lead' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- Button.test.tsx`
Expected: FAIL — `Cannot find module './Button'`

- [ ] **Step 3: Implement `Button`**

Create `src/components/ui/Button.tsx`:

```tsx
import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-amber text-base hover:bg-amber/90 shadow-[0_2px_10px_var(--color-amber-glow)]',
  secondary: 'bg-elevated text-ink border border-line-strong hover:bg-hover',
  ghost: 'bg-transparent text-ink-soft border border-transparent hover:bg-elevated hover:text-ink',
  danger: 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}) => {
  const classes = [
    'inline-flex items-center justify-center gap-1.5 rounded-sm font-body font-semibold',
    'transition-colors duration-150 ease-out cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ].join(' ');

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- Button.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Button.test.tsx
git commit -m "feat: add shared Button component"
```

---

### Task 4: `Badge` shared component

**Files:**
- Create: `src/components/ui/Badge.tsx`
- Test: `src/components/ui/Badge.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning';
  interface BadgeProps {
    tone?: BadgeTone; // default 'neutral'
    children: React.ReactNode;
    className?: string;
  }
  export const Badge: React.FC<BadgeProps>;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/Badge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Media</Badge>);
    expect(screen.getByText('Media')).toBeInTheDocument();
  });

  it('defaults to the neutral tone', () => {
    render(<Badge>Media</Badge>);
    expect(screen.getByText('Media').className).toContain('text-ink-soft');
  });

  it('applies the success tone', () => {
    render(<Badge tone="success">Gagné</Badge>);
    expect(screen.getByText('Gagné').className).toContain('text-success');
  });

  it('applies the danger tone', () => {
    render(<Badge tone="danger">Perdu</Badge>);
    expect(screen.getByText('Perdu').className).toContain('text-danger');
  });

  it('applies the warning tone', () => {
    render(<Badge tone="warning">SLA 2j</Badge>);
    expect(screen.getByText('SLA 2j').className).toContain('text-amber');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- Badge.test.tsx`
Expected: FAIL — `Cannot find module './Badge'`

- [ ] **Step 3: Implement `Badge`**

Create `src/components/ui/Badge.tsx`:

```tsx
import React from 'react';

export type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning';

export interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-elevated text-ink-soft border-line-strong',
  success: 'bg-success/15 text-success border-success/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
  warning: 'bg-amber-soft text-amber border-line-focus',
};

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', children, className = '' }) => (
  <span
    className={[
      'inline-flex items-center rounded-sm border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
      toneClasses[tone],
      className,
    ].join(' ')}
  >
    {children}
  </span>
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- Badge.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Badge.tsx src/components/ui/Badge.test.tsx
git commit -m "feat: add shared Badge component"
```

---

### Task 5: `KpiTile` shared component (with count-up)

**Files:**
- Create: `src/components/ui/KpiTile.tsx`
- Test: `src/components/ui/KpiTile.test.tsx`

**Interfaces:**
- Consumes: `motion`, `useMotionValue`, `useTransform`, `animate` from `'motion/react'` (already installed, same import path as `src/views/tasks/KanbanColumn.tsx`).
- Produces:
  ```ts
  type KpiAccent = 'amber' | 'success' | 'danger' | 'neutral';
  interface KpiTileProps {
    label: string;
    value: number;
    sub?: string;
    accent?: KpiAccent; // default 'neutral'
    formatValue?: (v: number) => string; // default: Math.round(v).toLocaleString('fr-FR')
  }
  export const KpiTile: React.FC<KpiTileProps>;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/KpiTile.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { KpiTile } from './KpiTile';

describe('KpiTile', () => {
  it('renders the label and sub text immediately', () => {
    render(<KpiTile label="Pipeline" value={248} sub="Valeur totale" />);
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Valeur totale')).toBeInTheDocument();
  });

  it('counts up to the target value', async () => {
    render(<KpiTile label="Pipeline" value={248} />);
    await waitFor(
      () => expect(screen.getByTestId('kpi-value')).toHaveTextContent('248'),
      { timeout: 2000 }
    );
  });

  it('applies a custom formatter', async () => {
    render(<KpiTile label="Pipeline" value={248} formatValue={(v) => `${Math.round(v)}k€`} />);
    await waitFor(
      () => expect(screen.getByTestId('kpi-value')).toHaveTextContent('248k€'),
      { timeout: 2000 }
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- KpiTile.test.tsx`
Expected: FAIL — `Cannot find module './KpiTile'`

- [ ] **Step 3: Implement `KpiTile`**

Create `src/components/ui/KpiTile.tsx`:

```tsx
import React, { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';

export type KpiAccent = 'amber' | 'success' | 'danger' | 'neutral';

export interface KpiTileProps {
  label: string;
  value: number;
  sub?: string;
  accent?: KpiAccent;
  formatValue?: (v: number) => string;
}

const accentBorder: Record<KpiAccent, string> = {
  amber: 'border-t-amber',
  success: 'border-t-success',
  danger: 'border-t-danger',
  neutral: 'border-t-line-strong',
};

const defaultFormat = (v: number) => Math.round(v).toLocaleString('fr-FR');

export const KpiTile: React.FC<KpiTileProps> = ({
  label,
  value,
  sub,
  accent = 'neutral',
  formatValue = defaultFormat,
}) => {
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (v) => formatValue(v));

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const controls = animate(motionValue, value, {
      duration: prefersReducedMotion ? 0 : 0.6,
      ease: 'easeOut',
    });
    return () => controls.stop();
  }, [value, motionValue]);

  return (
    <div className={`rounded-md border-t-2 bg-elevated border border-line p-4 ${accentBorder[accent]}`}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <motion.div
        data-testid="kpi-value"
        className="mt-1.5 font-heading text-2xl font-bold text-ink tabular-nums"
      >
        {display}
      </motion.div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- KpiTile.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/KpiTile.tsx src/components/ui/KpiTile.test.tsx
git commit -m "feat: add shared KpiTile component with count-up animation"
```

---

### Task 6: Restyle `Modal` to the new tokens

**Files:**
- Modify: `src/components/ui/Modal.tsx`
- Test: `src/components/ui/Modal.test.tsx`

**Interfaces:**
- Consumes: `motion`, `AnimatePresence` from `'motion/react'` (same imports already used in `src/components/ui/Select.tsx:10`) for the enter/exit transition the spec calls for ("modals/toasts slide+fade in from their anchor edge").
- Produces: unchanged — `ModalProps` (`open`, `onClose`, `header`, `children`) stays exactly as defined today at `src/components/ui/Modal.tsx:3-8`.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/Modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={vi.fn()} header="Titre">Contenu</Modal>);
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument();
  });

  it('renders header and children when open', () => {
    render(<Modal open onClose={vi.fn()} header="Détail du lead">Contenu</Modal>);
    expect(screen.getByText('Détail du lead')).toBeInTheDocument();
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} header="Titre">Contenu</Modal>);
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when the modal box itself is clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} header="Titre">Contenu</Modal>);
    fireEvent.click(screen.getByText('Contenu'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} header="Titre">Contenu</Modal>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails or passes against the old markup**

Run: `npm run test -- Modal.test.tsx`
Expected: PASS already (the existing implementation satisfies this behavior) — this test's job is to lock in current behavior *before* the restyle in Step 3, so Step 4 can prove nothing broke.

- [ ] **Step 3: Restyle the implementation with enter/exit motion**

Modify `src/components/ui/Modal.tsx`:

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared modal shell (overlay + box + header + close button) — before this,
 * every view that needed a modal hand-rolled the same overlay/box/header
 * JSX from scratch (see Pipeline.tsx, Leads.tsx). Keeps only the chrome;
 * callers own everything below the header (tabs, forms, footer...).
 *
 * Always renders (never returns null) so AnimatePresence can play the exit
 * transition when `open` flips to false — a caller doing `{open && <Modal>}`
 * would unmount before the animation had a chance to run.
 */
export const Modal: React.FC<ModalProps> = ({ open, onClose, header, children }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line-strong bg-surface font-body shadow-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="font-heading text-base font-bold text-ink">{header}</div>
              <button
                className="rounded-sm p-1 text-ink-faint transition-colors hover:bg-hover hover:text-ink cursor-pointer"
                onClick={onClose}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

- [ ] **Step 4: Run the test to verify it still passes**

Run: `npm run test -- Modal.test.tsx`
Expected: PASS (5 tests) — confirms the restyle didn't change behavior.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Modal.tsx src/components/ui/Modal.test.tsx
git commit -m "style: restyle shared Modal to Graphite Amber tokens"
```

---

### Task 7: Sidebar rewrite (responsive: full nav / icon rail / drawer)

**Files:**
- Modify: `src/components/SideBar.tsx`
- Test: `src/components/SideBar.test.tsx`

**Interfaces:**
- Consumes: `Badge` (Task 4) for the task-count pill; `useAuth` from `../context/AuthContext` (unchanged); `leadsService`/`tasksService` (unchanged).
- Produces: same `SideBarProps` as today (`currentView`, `setView`, `setActiveApp?`) — no prop changes, callers (`App.tsx`) need no changes.

- [ ] **Step 1: Write the failing test**

Create `src/components/SideBar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SideBar } from './SideBar';
import { leadsService } from '../services/leadsService';
import { tasksService } from '../services/tasksService';

vi.mock('../services/leadsService', () => ({
  leadsService: { getLeads: vi.fn() },
}));
vi.mock('../services/tasksService', () => ({
  tasksService: { getTasks: vi.fn() },
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

describe('SideBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(leadsService.getLeads).mockResolvedValue([]);
    vi.mocked(tasksService.getTasks).mockResolvedValue([]);
  });

  it('renders every nav item and highlights the current view', async () => {
    render(<SideBar currentView="pipeline" setView={vi.fn()} />);
    await waitFor(() => expect(leadsService.getLeads).toHaveBeenCalled());

    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Tous les leads')).toBeInTheDocument();
    expect(screen.getByText('Tâches')).toBeInTheDocument();
    expect(screen.getByText('Dashboard CODIR')).toBeInTheDocument();
  });

  it('calls setView when a nav item is clicked', async () => {
    const setView = vi.fn();
    render(<SideBar currentView="pipeline" setView={setView} />);
    await waitFor(() => expect(leadsService.getLeads).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Tâches'));
    expect(setView).toHaveBeenCalledWith('tasks');
  });

  it('opens the mobile drawer when the hamburger button is clicked', async () => {
    render(<SideBar currentView="pipeline" setView={vi.fn()} />);
    await waitFor(() => expect(leadsService.getLeads).toHaveBeenCalled());

    const hamburger = screen.getByRole('button', { name: 'Ouvrir le menu' });
    expect(screen.queryByTestId('sidebar-drawer')).not.toBeInTheDocument();

    fireEvent.click(hamburger);
    expect(screen.getByTestId('sidebar-drawer')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- SideBar.test.tsx`
Expected: FAIL — `Unable to find role="button" and name "Ouvrir le menu"` (the hamburger doesn't exist yet)

- [ ] **Step 3: Rewrite `SideBar.tsx`**

Modify `src/components/SideBar.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { leadsService } from '../services/leadsService';
import { tasksService } from '../services/tasksService';
import { Badge } from './ui/Badge';
import {
  KanbanSquare,
  Users,
  Sliders,
  CheckSquare,
  Calendar,
  BarChart3,
  Target,
  Settings,
  LogOut,
  LayoutGrid,
  Menu,
  X,
} from 'lucide-react';

interface SideBarProps {
  currentView: string;
  setView: (view: string) => void;
  setActiveApp?: (app: 'portal' | 'crm' | 'contenu') => void;
}

const navItems = [
  { id: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
  { id: 'leads', label: 'Tous les leads', icon: Users },
  { id: 'add', label: 'Ajouter / Scorer', icon: Sliders },
  { id: 'tasks', label: 'Tâches', icon: CheckSquare },
  { id: 'agenda', label: 'Agenda', icon: Calendar },
  { id: 'stats', label: 'Statistiques', icon: BarChart3 },
  { id: 'codir', label: 'Dashboard CODIR', icon: Target, isCodir: true },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export const SideBar: React.FC<SideBarProps> = ({ currentView, setView, setActiveApp }) => {
  const { logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stats, setStats] = useState({ leadsCount: 0, totalVal: 0, avgScore: 0, pendingTasks: 0 });

  const loadStats = async () => {
    try {
      const leads = await leadsService.getLeads();
      const tasks = await tasksService.getTasks();

      const val = leads.reduce((acc, l) => acc + l.deal_value, 0);
      const avg = leads.length ? Math.round(leads.reduce((acc, l) => acc + l.score, 0) / leads.length) : 0;
      const pending = tasks.filter(t => t.status !== 'done').length;

      setStats({ leadsCount: leads.length, totalVal: val, avgScore: avg, pendingTasks: pending });
    } catch (err) {
      console.error('Error loading sidebar stats:', err);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [currentView]);

  const handleNavClick = (id: string) => {
    setView(id);
    setDrawerOpen(false);
  };

  const renderNav = (showLabels: boolean) => (
    <nav className="flex flex-1 flex-col gap-1">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        const activeClasses = item.isCodir
          ? 'bg-amber-soft text-ink border-line-focus'
          : 'bg-amber-soft text-ink border-line-focus';

        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={[
              'relative flex items-center gap-3 rounded-sm border border-transparent px-3 py-2.5 text-left font-body text-[13px] font-medium transition-colors cursor-pointer',
              isActive ? activeClasses : 'text-ink-soft hover:bg-hover hover:text-ink',
              showLabels ? '' : 'justify-center',
            ].join(' ')}
            title={showLabels ? undefined : item.label}
          >
            <Icon size={16} />
            {showLabels && <span>{item.label}</span>}
            {showLabels && item.id === 'tasks' && stats.pendingTasks > 0 && (
              <Badge tone="danger" className="ml-auto">{stats.pendingTasks}</Badge>
            )}
          </button>
        );
      })}
    </nav>
  );

  const footer = (showLabels: boolean) => (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      {showLabels && (
        <>
          <div className="text-[11px] text-ink-soft">Leads : <strong className="text-ink">{stats.leadsCount}</strong></div>
          <div className="text-[11px] text-ink-soft">Pipeline : <strong className="text-ink">{stats.totalVal}k€</strong></div>
          <div className="text-[11px] text-ink-soft">Score moyen : <strong className="text-ink">{stats.avgScore}/100</strong></div>
        </>
      )}

      {setActiveApp && (
        <button
          className="flex items-center justify-center gap-1.5 rounded-sm border border-line-strong py-1.5 text-[11px] text-ink-soft transition-colors hover:bg-hover cursor-pointer"
          onClick={() => setActiveApp('portal')}
        >
          <LayoutGrid size={14} />
          {showLabels && 'Retour Portail'}
        </button>
      )}

      <button
        className="flex items-center justify-center gap-1.5 rounded-sm border border-line-strong py-1.5 text-[11px] text-ink-soft transition-colors hover:border-danger/30 hover:bg-danger/10 hover:text-danger cursor-pointer"
        onClick={logout}
      >
        <LogOut size={14} />
        {showLabels && 'Déconnexion'}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger — visible only below md */}
      <button
        className="fixed left-4 top-4 z-40 rounded-sm border border-line-strong bg-surface p-2 text-ink md:hidden cursor-pointer"
        onClick={() => setDrawerOpen(true)}
        aria-label="Ouvrir le menu"
      >
        <Menu size={18} />
      </button>

      {/* Tablet icon-rail (md–lg) + desktop full nav (lg+) */}
      <aside className="hidden h-screen w-16 flex-shrink-0 flex-col border-r border-line bg-surface p-3 md:flex lg:hidden">
        {renderNav(false)}
        {footer(false)}
      </aside>
      <aside className="hidden h-screen w-60 flex-shrink-0 flex-col border-r border-line bg-surface p-5 lg:flex">
        <div className="mb-6 border-b border-line pb-4">
          <img src="/grand_logo.png" alt="Seiki" className="h-8 w-auto" />
          <div className="mt-0.5 text-[9.5px] font-medium uppercase tracking-wide text-ink-faint">
            CRM — Mobilité intelligente
          </div>
        </div>
        {renderNav(true)}
        {footer(true)}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" data-testid="sidebar-drawer">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-surface p-5">
            <button
              className="absolute right-4 top-4 text-ink-soft cursor-pointer"
              onClick={() => setDrawerOpen(false)}
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
            <div className="mb-6 border-b border-line pb-4">
              <img src="/grand_logo.png" alt="Seiki" className="h-8 w-auto" />
            </div>
            {renderNav(true)}
            {footer(true)}
          </aside>
        </div>
      )}
    </>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- SideBar.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/SideBar.tsx src/components/SideBar.test.tsx
git commit -m "style: rewrite Sidebar to Graphite Amber tokens with responsive rail/drawer"
```

---

### Task 8: Login rewrite

**Files:**
- Modify: `src/views/Login.tsx`
- Test: `src/views/Login.test.tsx`

**Interfaces:**
- Consumes: `Button` (Task 3); `useAuth` from `../context/AuthContext` (unchanged signature: `login(email, password) => Promise<{success, error?}>`).

- [ ] **Step 1: Write the failing test**

Create `src/views/Login.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Login } from './Login';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the email/password form', () => {
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn(), logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument();
  });

  it('shows a validation error when submitted empty', () => {
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn(), logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: 'Accéder au CRM' }));
    expect(screen.getByText('Veuillez entrer votre email et votre mot de passe')).toBeInTheDocument();
  });

  it('calls login with the entered credentials', async () => {
    const login = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useAuth).mockReturnValue({ login, logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@seiki.co' } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accéder au CRM' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('a@seiki.co', 'secret'));
  });

  it('shows a French error message on invalid credentials', async () => {
    const login = vi.fn().mockResolvedValue({ success: false, error: 'Invalid login credentials' });
    vi.mocked(useAuth).mockReturnValue({ login, logout: vi.fn(), isAuthenticated: false, user: null, loading: false });
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@seiki.co' } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accéder au CRM' }));

    await waitFor(() => expect(screen.getByText('Email ou mot de passe incorrect')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails or passes against the old markup**

Run: `npm run test -- Login.test.tsx`
Expected: PASS already (locks in current behavior before the restyle, same purpose as Task 6 Step 2).

- [ ] **Step 3: Rewrite `Login.tsx`**

Modify `src/views/Login.tsx`:

```tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Veuillez entrer votre email et votre mot de passe');
      return;
    }
    setIsSubmitting(true);
    setError('');

    const { success, error: loginError } = await login(email, password);
    setIsSubmitting(false);

    if (!success) {
      setError(loginError === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : (loginError || 'Erreur de connexion'));
      setPassword('');
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-base font-body text-ink">
      <div className="mb-10 max-w-md text-center">
        <img src="/grand_logo.png" className="mx-auto mb-8 h-16 w-auto" alt="Seiki Logo" />
        <h1 className="font-heading text-4xl font-bold leading-tight text-ink">
          Sharper decisions <br />with mobility data
        </h1>
        <p className="mt-3 text-sm text-ink-soft">CRM interne à Seiki</p>
      </div>

      <div className="w-96 rounded-lg border border-line-strong bg-surface p-10 shadow-modal">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            autoFocus
            autoComplete="username"
            className="w-full rounded-sm border border-line-strong bg-base px-4 py-3 text-center text-sm text-ink outline-none transition-colors focus:border-line-focus"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            autoComplete="current-password"
            className="w-full rounded-sm border border-line-strong bg-base px-4 py-3 text-center text-sm text-ink outline-none transition-colors focus:border-line-focus"
          />

          {error && <div className="text-center text-xs font-medium text-danger">{error}</div>}

          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2 w-full py-3">
            {isSubmitting ? 'Connexion en cours...' : 'Accéder au CRM'}
          </Button>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run the test to verify it still passes**

Run: `npm run test -- Login.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/views/Login.tsx src/views/Login.test.tsx
git commit -m "style: rewrite Login view to Graphite Amber tokens"
```

---

### Task 9: Pipeline — page header, KPI row, SLA banner

**Files:**
- Modify: `src/views/Pipeline.tsx:100-161` (page header through SLA banner, leave the kanban board below untouched — that's Task 10)

**Interfaces:**
- Consumes: `Button` (Task 3), `KpiTile` (Task 5).
- No changes to `PipelineProps`, data loading, or the `LeadDetailModal` integration.

- [ ] **Step 1: Manual regression baseline**

Before editing, run `npm run dev`, log in, open Pipeline, and note the current KPI values shown (deals actifs, pipeline total, score moyen, closés gagnés) and that the SLA banner appears when `slaBreaches.length > 0`. There's no existing automated test for Pipeline (mocking 4 services is heavy for a pure restyle); this manual baseline plus the "no functional changes" constraint is the safety net for Steps 2-3 — Task 11 does the full breakpoint/regression pass.

- [ ] **Step 2: Rewrite the header/KPI/SLA section**

Modify `src/views/Pipeline.tsx`, replacing lines 100-161 (from `return (` through the closing of the SLA banner block) with:

```tsx
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="font-heading text-xl font-bold text-ink">Pipeline</div>
          <div className="mt-0.5 text-xs text-ink-soft">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} · {totalVal}k€ de valeur totale
          </div>
        </div>
        <Button variant="primary" onClick={() => setView('add')}>
          <Plus size={16} />
          Nouveau lead
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-3">
        <KpiTile label="Deals actifs" value={activeLeads.length} sub={`${wonLeads.length} closés gagnés`} accent="amber" />
        <KpiTile label="Pipeline" value={totalVal} formatValue={(v) => `${Math.round(v)}k€`} sub="Valeur totale" accent="neutral" />
        <KpiTile label="Score moyen" value={avgScore} formatValue={(v) => `${Math.round(v)}/100`} sub={`${hotCount} chauds ≥ 80`} accent="success" />
        <KpiTile label="Closés Gagnés" value={wonVal} formatValue={(v) => `${Math.round(v)}k€`} sub="Deals signés" accent="success" />
      </div>

      {slaBreaches.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-danger/25 bg-danger/10 px-4 py-3">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-danger" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-ink">
              {slaBreaches.length} lead{slaBreaches.length > 1 ? 's' : ''} avec SLA dépassé — action requise aujourd'hui
            </span>
            <div className="text-xs text-ink-soft">
              {slaBreaches.map((l, i) => (
                <span key={l.id}>
                  {l.company_name} (J+{l.days_in_stage}, max {slaLimits[l.segment] || 7}j)
                  {i < slaBreaches.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
```

Also add the import at the top of the file:

```tsx
import { Button } from '../components/ui/Button';
import { KpiTile } from '../components/ui/KpiTile';
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, log in, open Pipeline. Expected: same 4 KPI values as the Step 1 baseline (now with a count-up animation on load), same SLA banner behavior, "Nouveau lead" button still navigates to the Add Lead view.

- [ ] **Step 4: Run the existing test suite**

Run: `npm run test`
Expected: all existing tests still PASS (no test currently covers Pipeline directly, but this confirms nothing else broke — e.g. a bad import).

- [ ] **Step 5: Commit**

```bash
git add src/views/Pipeline.tsx
git commit -m "style: rewrite Pipeline header, KPI row, and SLA banner to Graphite Amber tokens"
```

---

### Task 10: Pipeline — kanban board (`DealCard` extraction)

**Files:**
- Create: `src/views/pipeline/DealCard.tsx`
- Modify: `src/views/Pipeline.tsx:163-220` (the `pipe-wrap` kanban board block)

**Interfaces:**
- Produces:
  ```ts
  interface DealCardProps {
    lead: Lead; // from '../../services/leadsService'
    slaBreached: boolean;
    isTaskOverdue: boolean;
    onOpen: (leadId: string) => void;
  }
  export const DealCard: React.FC<DealCardProps>;
  ```
- Consumes: `Badge` (Task 4), `motion` from `'motion/react'` (same `layout`/`layoutId` pattern as `src/views/tasks/KanbanColumn.tsx:59-72` — no native drag-and-drop is added here, since Pipeline doesn't have any today and adding it would be a new feature, out of scope for a visual rebuild. The `motion.div layout layoutId={lead.id}` wrapper animates the card smoothly if its stage changes via the existing `LeadDetailModal` flow.).

- [ ] **Step 1: Extract `DealCard`**

Create `src/views/pipeline/DealCard.tsx`:

```tsx
import React from 'react';
import { motion } from 'motion/react';
import type { Lead } from '../../services/leadsService';
import { Badge } from '../../components/ui/Badge';

export interface DealCardProps {
  lead: Lead;
  slaBreached: boolean;
  isTaskOverdue: boolean;
  onOpen: (leadId: string) => void;
}

const scoreColorClass = (score: number) => {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-amber';
  return 'text-danger';
};

export const DealCard: React.FC<DealCardProps> = ({ lead, slaBreached, isTaskOverdue, onOpen }) => {
  const borderClass = slaBreached
    ? 'border-l-danger'
    : isTaskOverdue
      ? 'border-l-amber'
      : 'border-l-line-strong';

  return (
    <motion.div
      layout
      layoutId={lead.id}
      onClick={() => onOpen(lead.id)}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`cursor-pointer rounded-md border border-line border-l-[3px] bg-elevated p-3 shadow-hover/0 hover:shadow-hover ${borderClass}`}
    >
      <div className="flex items-start justify-between text-[12.5px] font-bold text-ink">
        <span>{lead.company_name}</span>
        <span className={scoreColorClass(lead.score)}>{lead.score}</span>
      </div>

      <div className="mt-1 truncate text-[11px] text-ink-soft">{lead.contact_name || '—'}</div>
      <div className="mt-0.5 font-heading text-[13px] font-semibold text-ink">{lead.deal_value}k€</div>

      <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2">
        <Badge tone="neutral">{lead.segment}</Badge>
        <span className={`text-[10px] font-semibold ${slaBreached ? 'text-danger' : 'text-ink-faint'}`}>
          J+{lead.days_in_stage}
        </span>
      </div>
    </motion.div>
  );
};
```

- [ ] **Step 2: Wire `DealCard` into the Pipeline board**

Modify `src/views/Pipeline.tsx`, replacing the `pipe-wrap` block (originally lines 163-220) with:

```tsx
      <div className="flex flex-1 gap-3 overflow-x-auto pb-3">
        {stages.map(st => {
          const stageLeads = leads.filter(l => l.stage_id === st.id);
          const stageVal = stageLeads.reduce((acc, l) => acc + l.deal_value, 0);

          return (
            <div key={st.id} className="flex w-64 flex-shrink-0 flex-col rounded-md border border-line bg-surface/40 p-3">
              <div
                className="mb-3 flex items-center justify-between border-b-2 pb-2 font-heading text-[13.5px] font-bold text-ink"
                style={{ borderBottomColor: st.color }}
              >
                {st.name}
                <span className="text-[11px] font-normal text-ink-soft">{stageLeads.length} · {stageVal}k€</span>
              </div>

              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
                {stageLeads.map(l => (
                  <DealCard
                    key={l.id}
                    lead={l}
                    slaBreached={isSlaBreached(l, slaLimits)}
                    isTaskOverdue={getLeadPriorityTask(l.id)}
                    onOpen={handleOpenLead}
                  />
                ))}
              </div>

              <button
                className="mt-2.5 rounded-sm border border-dashed border-line-strong py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-focus hover:text-ink cursor-pointer"
                onClick={() => setView('add')}
              >
                + Ajouter
              </button>
            </div>
          );
        })}
      </div>
```

Add the import at the top of `src/views/Pipeline.tsx`:

```tsx
import { DealCard } from './pipeline/DealCard';
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, log in, open Pipeline. Expected: same columns/cards/counts as before this task, cards show company name, score (colored by threshold), contact, deal value, segment badge, and `J+N` age indicator; SLA-breached cards show a red left border, task-overdue cards show an amber left border; clicking a card still opens `LeadDetailModal`.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/pipeline/DealCard.tsx src/views/Pipeline.tsx
git commit -m "style: rewrite Pipeline kanban board with extracted DealCard component"
```

---

### Task 11: Responsive + reduced-motion verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full regression run**

Run: `npm run build && npm run test`
Expected: build succeeds, all tests PASS.

- [ ] **Step 2: Breakpoint check — Sidebar**

In the dev server, resize the viewport (or use browser devtools device toolbar) to each of 375px, 768px, 1024px, 1440px width. Expected:
- 375px: sidebar hidden, hamburger button visible top-left; clicking it opens the full-label drawer with an overlay; clicking the overlay or the X closes it.
- 768px–1023px: icon-only rail visible on the left (no labels, no hamburger).
- ≥1024px: full 240px sidebar with labels, stats footer, and logout button.

- [ ] **Step 3: Breakpoint check — Login and Pipeline**

At the same four widths: Login's card stays centered and legible (no horizontal scroll); Pipeline's KPI row and kanban board don't cause horizontal overflow of the page itself (the kanban board's own internal horizontal scroll, from `overflow-x-auto`, is expected and correct).

- [ ] **Step 4: `prefers-reduced-motion` check**

In the browser devtools, enable "Emulate CSS media feature prefers-reduced-motion: reduce" (Chrome DevTools → Rendering tab). Reload Pipeline. Expected: KPI numbers appear at their final value immediately (no count-up animation) per the check in `KpiTile.tsx`'s `useEffect` (Task 5); deal-card hover lift may still occur (a 150ms transform is not disallowed by the spec's reduced-motion rule, which targets larger/structural motion) — no action needed here, this step is confirmation only.

- [ ] **Step 5: Commit** (only if any fixes were needed in Steps 2-4; skip if the pass was clean)

```bash
git add -A
git commit -m "fix: address responsive/reduced-motion issues found in verification pass"
```
