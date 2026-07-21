# Kanban Charcoal/Beige Theme Regression Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `react-kanban-kit`'s default white column background from leaking through on the Pipeline and Tasks kanban boards, and keep drag-shadow placeholders on-theme, so both boards render fully charcoal/beige as originally specified.

**Architecture:** `SeikiKanbanBoard.tsx` (`src/components/ui/SeikiKanbanBoard.tsx`) is the single shared wrapper around the `react-kanban-kit` `<Kanban>` component, used by both `Pipeline.tsx` and `TaskBoardView.tsx`. It already sets `columnWrapperStyle` (targets the library's `.rkk-column-outer`) to charcoal/beige, but never sets `columnStyle` (targets the library's inner `.rkk-column`), which is why that inner layer still shows the library's default `#f0f0f0` background. Fixing the one shared component fixes both views. A second, unrelated default (white drag-shadow placeholders `.rkk-column-shadow` / `.rkk-card-shadow`) has no corresponding React prop in the library's API, so it's neutralized with a small global CSS override instead.

**Tech Stack:** React 19, TypeScript, `react-kanban-kit` (v0.0.2-beta.7), Vite, Vitest + `@testing-library/react` + `@testing-library/jest-dom`.

## Global Constraints

- Charcoal/beige palette values are fixed by the original integration spec (`docs/superpowers/specs/2026-07-20-react-kanban-kit-integration-design.md`): board/column base `#0d0d0d`, accent border `#c8b89a`. Reuse these exact values — do not introduce new colors.
- Do not touch `allowColumnDrag` (intentionally disabled) or any drag/drop event handlers — this is a styling-only fix.
- Do not touch the legacy `.pipe-wrap` / `.pipe-col` / `.deal-card` / `.tasks-board-fullscreen` CSS block in `src/index.css` (~lines 445-610, ~1474-1520) — it's dead code, out of scope for this fix.

---

### Task 1: Fix the white inner-column background

**Files:**
- Modify: `src/components/ui/SeikiKanbanBoard.tsx:208-215` (the `<Kanban ... />` JSX, right after the existing `columnWrapperStyle` prop)
- Test: `src/test/SeikiKanbanBoard.test.tsx`

**Interfaces:**
- Consumes: `react-kanban-kit`'s `columnStyle?: (column: BoardItem) => React.CSSProperties` prop (already part of the library's public `BoardProps` type imported in this file as `type ConfigMap = BoardProps['configMap']` etc. — `BoardProps` is already imported).
- Produces: nothing new consumed elsewhere; this is a leaf styling change.

- [ ] **Step 1: Write the failing test**

Add this test to `src/test/SeikiKanbanBoard.test.tsx`, inside the existing `describe('SeikiKanbanBoard', ...)` block, after the existing `it('renders column headers correctly', ...)` test:

```tsx
  it('renders the inner column area transparent, not the library default white', () => {
    const { container } = render(
      <SeikiKanbanBoard
        columns={columns}
        cards={cards}
        getColumnId={(col) => col.id}
        getColumnTitle={(col) => col.title}
        getColumnColor={(col) => col.color}
        getCardId={(card) => card.id}
        getCardColumnId={(card) => card.columnId}
        renderCard={(card) => <div>{card.title}</div>}
        onCardMove={vi.fn()}
      />
    );

    const innerColumn = container.querySelector('.rkk-column');
    expect(innerColumn).not.toBeNull();
    expect(innerColumn).toHaveStyle({ backgroundColor: 'transparent' });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/SeikiKanbanBoard.test.tsx`
Expected: FAIL — the new test's `toHaveStyle({ backgroundColor: 'transparent' })` assertion fails because `SeikiKanbanBoard` doesn't pass a `columnStyle` prop yet, so `.rkk-column` has no inline `background-color` set to `transparent`.

- [ ] **Step 3: Write minimal implementation**

In `src/components/ui/SeikiKanbanBoard.tsx`, the JSX currently ends with:

```tsx
      columnWrapperStyle={() => ({
        backgroundColor: '#0d0d0d',
        borderRadius: '8px',
        border: '1px solid rgba(200, 184, 154, 0.25)',
        padding: '12px',
        minWidth: '260px',
      })}
    />
  );
}
```

Change it to add a `columnStyle` prop right after `columnWrapperStyle`:

```tsx
      columnWrapperStyle={() => ({
        backgroundColor: '#0d0d0d',
        borderRadius: '8px',
        border: '1px solid rgba(200, 184, 154, 0.25)',
        padding: '12px',
        minWidth: '260px',
      })}
      columnStyle={() => ({
        backgroundColor: 'transparent',
      })}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/SeikiKanbanBoard.test.tsx`
Expected: PASS (both the existing test and the new one)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SeikiKanbanBoard.tsx src/test/SeikiKanbanBoard.test.tsx
git commit -m "fix: stop react-kanban-kit default white background from covering charcoal columns"
```

---

### Task 2: Neutralize white drag-shadow placeholders

**Files:**
- Modify: `src/index.css` (insert a new block right before the existing `/* KANBAN PIPELINE BOARD */` comment section, currently starting around line 445)

**Interfaces:**
- Consumes: nothing (global CSS, no component API).
- Produces: nothing consumed elsewhere; purely visual.

- [ ] **Step 1: Add the CSS override**

In `src/index.css`, find this existing block:

```css
@keyframes pulse-red {
  0% { box-shadow: 0 0 4px rgba(248, 113, 113, 0.1); }
  100% { box-shadow: 0 0 12px rgba(248, 113, 113, 0.2); }
}

/* ============================================================
   KANBAN PIPELINE BOARD
   ============================================================ */
```

Insert a new block between the `@keyframes pulse-red` closing brace and the `KANBAN PIPELINE BOARD` comment:

```css
@keyframes pulse-red {
  0% { box-shadow: 0 0 4px rgba(248, 113, 113, 0.1); }
  100% { box-shadow: 0 0 12px rgba(248, 113, 113, 0.2); }
}

/* ============================================================
   REACT-KANBAN-KIT THEME OVERRIDES
   Shared by SeikiKanbanBoard.tsx (Pipeline.tsx + TaskBoardView.tsx).
   The library ships default white drag-shadow placeholders
   (.rkk-column-shadow, .rkk-card-shadow: #ffffffb7 / #fff) with no
   React style prop to override them, and its CSS is injected via a
   runtime <style> tag whose load order relative to this file isn't
   guaranteed — !important makes the override reliable either way.
   ============================================================ */
.rkk-column-shadow,
.rkk-card-shadow {
  background-color: rgba(13, 13, 13, 0.7) !important;
  border: 1px solid rgba(200, 184, 154, 0.3) !important;
}

/* ============================================================
   KANBAN PIPELINE BOARD
   ============================================================ */
```

- [ ] **Step 2: Visually verify on the running dev server**

The dev server is already running at `http://localhost:5173` (logged in as `admin@admin.com`). With the browser tool:
1. Navigate to `/` and click through to Pipeline (if not already there) — reload the page.
2. Confirm every column's inner area is charcoal (matching the outer wrapper), with no white panel visible behind the cards, at both the left and right edges of the horizontally-scrolled board.
3. Navigate to Tasks → click "Tableau" — repeat the same check.
4. Use `computer` `left_click_drag` to drag a card a short distance within a column and screenshot mid-drag; confirm the drop-indicator area shows a dark/beige tone, not a white flash.
5. Check `read_console_messages` for any new errors.

Expected: no white background visible on either board, in both idle and mid-drag states; no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix: neutralize react-kanban-kit's default white drag-shadow placeholders"
```
