# React Kanban Kit Integration Design

**Date**: 2026-07-20  
**Status**: Approved  
**Target Views**: `Pipeline.tsx` (CRM Leads Pipeline) & `Tasks.tsx` (Tasks Management)  
**Package**: `react-kanban-kit` (located in `node_modules/react-kanban-kit`)

---

## 1. Executive Summary

This specification defines the integration of `react-kanban-kit` into the Seiki CRM website. It replaces the existing custom Kanban views in `Pipeline.tsx` and `Tasks.tsx` with a unified, high-performance, drag-and-drop Kanban engine powered by `@atlaskit/pragmatic-drag-and-drop` via `react-kanban-kit`.

The visual aesthetic strictly adheres to the dark/gold/cream design language of the Seiki Portal and Sidebar (`#0d0d0d`, `#c8b89a`, `#f2ede4`).

---

## 2. Architecture & Component Structure

### 2.1 Reusable Wrapper: `<SeikiKanbanBoard />`
Location: `src/components/ui/SeikiKanbanBoard.tsx`

The `<SeikiKanbanBoard />` component serves as a generic wrapper around `react-kanban-kit`'s `Kanban` component:

```tsx
interface SeikiKanbanBoardProps<TCard, TColumn> {
  columns: TColumn[];
  cards: TCard[];
  getColumnId: (col: TColumn) => string;
  getColumnTitle: (col: TColumn) => string;
  getColumnColor?: (col: TColumn) => string;
  getCardId: (card: TCard) => string;
  getCardColumnId: (card: TCard) => string;
  renderCard: (card: TCard, column: TColumn) => React.ReactNode;
  renderColumnHeaderExtra?: (column: TColumn, cardsCount: number) => React.ReactNode;
  onCardMove: (cardId: string, fromColumnId: string, toColumnId: string, newPosition: number) => Promise<void>;
  onColumnMove?: (columnId: string, fromIndex: number, toIndex: number) => Promise<void>;
  onCardClick?: (card: TCard) => void;
  onAddCardClick?: (columnId: string) => void;
  allowColumnDrag?: boolean;
}
```

### 2.2 Data Transformer Utilities
- Utility functions map `TColumn[]` and `TCard[]` into `react-kanban-kit`'s `BoardData` format (`root` node containing ordered `children` column IDs, each column node containing ordered `children` card IDs, and card nodes).
- `dropHandler` and `dropColumnHandler` from `react-kanban-kit` compute updated `BoardData` state on drag end.

---

## 3. Visual Aesthetics & Styling (Sidebar & Portal Design Language)

### 3.1 Color Palette & Typography
- **Board Background**: `#0d0d0d` / subtle surface neutral dark.
- **Column Container**: `bg-surface/40`, border `border-line` with top/bottom accent border matching column accent color (`#c8b89a` or stage color).
- **Cards**: Surface dark background with border `border-line`, smooth hover transition (`translate-y-[-2px]`), typography set in `Inter`.
- **Drag Previews**:
  - `renderCardDragPreview`: Rotated (4deg) card clone with drop shadow and gold accent border (`#c8b89a`).
  - `renderColumnDragPreview`: Styled column preview.
- **Drop Indicators**:
  - `renderCardDragIndicator`: Gold highlight indicator (`#c8b89a`).
  - `renderColumnDragIndicator`: Vertical gold bar line.

---

## 4. Integration Details per View

### 4.1 `Pipeline.tsx`
- **Columns**: `PipelineStage[]`
- **Cards**: `Lead[]`
- **Card Content**: Displays company name, deal value, segment badge, SLA breach alert icon, overdue task indicator, and owner avatar.
- **Persistence**: Moving a lead to a new column calls `leadsService.updateLead(leadId, { stage_id: newColumnId })`.

### 4.2 `Tasks.tsx`
- **Columns**: Task statuses (`À faire`, `En cours`, `Terminé`, `Bloqué`, etc.)
- **Cards**: `Task[]`
- **Card Content**: Displays task title, priority badge, due date status, and associated lead name.
- **Persistence**: Moving a task calls `tasksService.updateTask(taskId, { status: newStatus })`.

---

## 5. Error Handling & State Reversion

- State updates are performed **optimistically** using `dropHandler` to maintain 60fps drag-and-drop feedback.
- If the background API call (`leadsService.updateLead` or `tasksService.updateTask`) fails, the board state rolls back to the pre-drag snapshot, and an error toast notification is shown to the user.

---

## 6. Verification Plan

1. Verify `react-kanban-kit` imports cleanly in Vite/React setup.
2. Test dragging cards between columns in Pipeline view & verify DB stage updates.
3. Test dragging cards between columns in Tasks view & verify DB status updates.
4. Verify column reordering via `allowColumnDrag` if enabled.
5. Verify responsive layout and visual theme matching Portal & Sidebar.
