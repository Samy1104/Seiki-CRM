# Tasks Kanban Board: Full-Width Layout & Simplified Card Actions

**Date**: 2026-07-21
**Status**: Approved
**Target**: `src/components/ui/SeikiKanbanBoard.tsx`, `src/views/tasks/TaskBoardView.tsx`
**Related**: `2026-07-20-react-kanban-kit-integration-design.md` (original integration), `2026-07-20-kanban-theme-regression-fix-design.md` (charcoal/beige styling fix)

---

## 1. Problem

The Tasks page's Tableau (kanban board) view has two issues, verified live on the running dev server:

1. **Board doesn't fill available width.** `react-kanban-kit` hardcodes `.rkk-column-outer { max-width: 264px }` by default. `SeikiKanbanBoard.tsx` only adds a `minWidth: 260px` on top via `columnWrapperStyle`, so with the Tasks board's fixed 3 columns (À faire / En cours / Terminé), each column renders at a fixed ~260px and the rest of the screen's width goes unused. Measured on a 1280px viewport: `.main-content` (the app's content area) was 1060px wide, but the 3 fixed-width columns only used ~796px of the board's 964px, leaving a dead gap.

2. **Card action buttons are redundant and inconsistent.** `TaskBoardView.tsx`'s `renderCardActions` branches per task status to render status-transition buttons ("En cours →", "← À faire", "Fini ✓", "← Ouvrir") — redundant now that drag-and-drop (`onCardMove`) already moves cards between columns. It also only shows a delete ("Supprimer") button on `todo` and `done` cards, not `in_progress`, so those cards would be left with zero actions once the status buttons are removed.

## 2. Fix

### 2.1 Full-width board (Tasks only, not Pipeline)

`SeikiKanbanBoard` is shared between `Pipeline.tsx` (variable number of stages, needs horizontal scroll with fixed-width columns) and `TaskBoardView.tsx` (always exactly 3 fixed statuses, should fill the screen). Add a new opt-in prop:

```ts
fillWidth?: boolean; // default false — preserves Pipeline's current fixed-width scrolling columns
```

When `fillWidth` is true:
- `rootStyle={{ width: '100%' }}` is passed to `<Kanban>`.
- `columnWrapperStyle` returns `flex: '1 1 0'`, `minWidth: '220px'`, `maxWidth: 'none'` (overriding the library's 264px cap) instead of the current fixed `minWidth: '260px'` with no explicit `flex`/`maxWidth`.

`TaskBoardView.tsx` passes `fillWidth`. `Pipeline.tsx` passes nothing, so `fillWidth` defaults to `false` and its columns keep today's exact behavior (fixed 260px min-width, capped at the library's 264px, horizontally scrollable).

No changes to `Sidebar.tsx` or page padding: `.main-content` is already `flex: 1` inside the app's flex-row layout alongside the sidebar `<aside>`, so it already reactively resizes when the sidebar collapses/expands — confirmed working live. The Tasks board keeps the same page margins every other view uses (`.main-content`'s existing `padding: 24px` plus the view's own `p-6` wrapper) — it fills the space *between* those margins, not the literal viewport edge.

### 2.2 Simplified card actions

In `TaskBoardView.tsx`, `renderCardActions` is collapsed to a single, status-independent action: an icon-only delete button using `Trash2` from `lucide-react`, matching the exact existing pattern from `TaskListView.tsx`:

```tsx
<button
  className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
  onClick={() => onDeleteTask(task.id)}
>
  <Trash2 size={15} />
</button>
```

This button appears on every card regardless of status (`todo`, `in_progress`, `done`), replacing all four status-transition text buttons and the old text-based "Supprimer" button. The footer row (`mt-2.5 flex ... border-t border-line pt-2`) switches from a left-aligned multi-button row (`gap-3`) to right-aligning the single icon (`justify-end`), since there's now only one element in it.

The `onUpdateStatus` prop stays on `TaskBoardViewProps` (still used by the drag-and-drop `onCardMove` handler to persist status changes) — only its use inside `renderCardActions` is removed.

## 3. Out of scope

- `Pipeline.tsx` / `DealCard.tsx` — untouched, no fillWidth, no action-button changes.
- `TaskListView.tsx` — untouched; its own delete button (already icon-only `Trash2`) and status checkbox are a different UI pattern, not in scope (user's request was specifically about the kanban board).
- `Sidebar.tsx` — untouched; the collapse/expand width behavior already works correctly in a real browser (an earlier apparent width-measurement mismatch was a browser-automation-tool artifact, not a real bug).

## 4. Verification Plan

1. Unit test: extend `src/test/SeikiKanbanBoard.test.tsx` to verify `fillWidth` produces `flex: 1 1 0` / no `max-width` cap on the inner column style, while the default (no `fillWidth`) still produces the existing fixed `minWidth: 260px` behavior.
2. New unit test file `src/test/TaskBoardView.test.tsx`: for a task in each of the three statuses, assert no button with text "En cours", "À faire", "Fini", or "Ouvrir" is rendered, exactly one delete button (containing the `Trash2` icon) is rendered, and clicking it calls `onDeleteTask` with the correct task id.
3. Live verification on the running dev server: Tasks → Tableau — the 3 columns visually fill the available width (no dead space to the right of "Terminé"), collapsing/expanding the sidebar reflows the board width accordingly, and every card shows exactly one delete icon with no status-switch buttons.
