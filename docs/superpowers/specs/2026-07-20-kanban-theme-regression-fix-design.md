# Kanban Charcoal/Beige Theme Regression Fix

**Date**: 2026-07-20
**Status**: Approved
**Target**: `src/components/ui/SeikiKanbanBoard.tsx` (shared by `Pipeline.tsx` and `TaskBoardView.tsx`)
**Related spec**: `2026-07-20-react-kanban-kit-integration-design.md` — this fixes a gap against that spec's §3.1, which calls for a charcoal (`#0d0d0d`) / beige (`#c8b89a`) board, but the current implementation renders a white inner column background.

---

## 1. Problem

Verified live on `/pipeline` and `/tasks` (Tableau view) after logging in: every kanban column shows a white/light-gray (`#f0f0f0`) panel behind the (correctly styled) dark cards, instead of the intended charcoal board.

**Root cause**: `react-kanban-kit` renders two nested elements per column — `.rkk-column-outer` (the outer wrapper) and `.rkk-column` (the inner scrollable content area). `SeikiKanbanBoard` only supplies `columnWrapperStyle`, which targets `.rkk-column-outer` and is correctly set to `#0d0d0d` with a beige border. It never supplies `columnStyle`, which targets `.rkk-column` — so that inner element falls back to the library's built-in default background (`#f0f0f0`), which paints over the charcoal wrapper.

The library also ships default white/translucent-white backgrounds on its drag-shadow placeholder elements (`.rkk-column-shadow`, `.rkk-card-shadow`: `#ffffffb7` and `#ffffff` respectively). The card drag indicator is already custom-rendered via `renderCardDragIndicator` (a beige glow line), but the shadow container it sits inside can still show a white flash behind it during drag, which would look inconsistent with the rest of the theme.

## 2. Fix

In `SeikiKanbanBoard.tsx`:

1. Add a `columnStyle` prop returning `{ backgroundColor: 'transparent' }` (plus no competing padding/border — the outer wrapper already owns those) so the inner `.rkk-column` layer stops overriding the charcoal wrapper.
2. Add a small scoped CSS override (in `src/index.css`, near the existing kanban section) neutralizing `.rkk-column-shadow` and `.rkk-card-shadow` default backgrounds to a dark, semi-transparent tone consistent with the theme, so drag-state visuals never flash white.

No changes to data flow, drag handlers, or persistence — this is a pure styling fix scoped to one shared component plus one small global CSS addition.

## 3. Out of scope

- `src/index.css` contains a `.pipe-wrap` / `.pipe-col` / `.deal-card` / `.tasks-board-fullscreen` CSS block (~150 lines) that is dead code left over from before the `react-kanban-kit` migration — no JSX references those classes anymore. Not touched by this fix; flagged separately for cleanup.
- Column drag reordering (`allowColumnDrag`) stays disabled, as intentionally set in a prior commit — not part of this fix.

## 4. Verification Plan

1. Reload `/pipeline` (logged in) — columns must show the charcoal background straight through, no white panel behind cards.
2. Reload `/tasks` → Tableau view — same check.
3. Visually confirm card drag (mouse down + move) shows no white flash behind the beige drag indicator.
4. Confirm no console errors and no visual regression to card content, headers, or column color accents.
