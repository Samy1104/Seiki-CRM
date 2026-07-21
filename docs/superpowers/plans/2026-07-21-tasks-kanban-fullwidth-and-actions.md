# Tasks Kanban Full-Width Layout & Simplified Card Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Tasks page's kanban board (Tableau view) fill the available page width with its 3 fixed columns, and replace each card's status-switch buttons with a single icon-only delete action.

**Architecture:** Two independent, sequential changes. Task 1 adds an opt-in `fillWidth` prop to the shared `SeikiKanbanBoard` wrapper component (used by both `Pipeline.tsx` and `TaskBoardView.tsx`) so only the Tasks board's columns switch from fixed-width to flexible equal-width, while Pipeline's columns keep their current fixed-width, horizontally-scrollable behavior unchanged. Task 2 wires that prop into `TaskBoardView.tsx` and simplifies its card-action rendering.

**Tech Stack:** React 19, TypeScript, `react-kanban-kit` (v0.0.2-beta.7), `lucide-react`, Vite, Vitest + `@testing-library/react` + `@testing-library/jest-dom`.

## Global Constraints

- `Pipeline.tsx` and `DealCard.tsx` are not touched — the fix is scoped to the Tasks kanban board only.
- `Sidebar.tsx` is not touched — the board must fill `.main-content`'s available width via CSS (`flex`), which already reactively resizes with the sidebar; no sidebar-aware code is added.
- The existing charcoal/beige palette values stay exactly as they are (`#0d0d0d` background, `rgba(200, 184, 154, 0.25)` border) — only sizing properties change.
- The new delete button matches `TaskListView.tsx`'s existing icon-only delete button pattern: `Trash2` from `lucide-react`, `size={15}`, class `rounded-control p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer`.

---

### Task 1: Add `fillWidth` prop to `SeikiKanbanBoard`

**Files:**
- Modify: `src/components/ui/SeikiKanbanBoard.tsx`
- Test: `src/test/SeikiKanbanBoard.test.tsx`

**Interfaces:**
- Produces: `SeikiKanbanBoardProps<TCard, TColumn>.fillWidth?: boolean` (default `false`). When `true`, columns become `flex: 1 1 0` with `minWidth: '220px'` and `maxWidth: 'none'`, and the board root gets `width: '100%'`. When omitted/`false`, behavior is byte-for-byte identical to today (columns fixed at `minWidth: '260px'`, capped by the library's own `max-width: 264px`).

- [ ] **Step 1: Write the failing tests**

Add these two tests to `src/test/SeikiKanbanBoard.test.tsx`, inside the existing `describe('SeikiKanbanBoard', ...)` block, after the existing `it('renders the inner column area transparent, not the library default white', ...)` test:

```tsx
  it('fillWidth: columns flex to fill available width with no max-width cap', () => {
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
        fillWidth
      />
    );

    const columnOuter = container.querySelector('.rkk-column-outer');
    expect(columnOuter).not.toBeNull();
    expect(columnOuter).toHaveStyle({ minWidth: '220px', maxWidth: 'none' });
  });

  it('without fillWidth, columns keep the existing fixed-width behavior (Pipeline unchanged)', () => {
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

    const columnOuter = container.querySelector('.rkk-column-outer');
    expect(columnOuter).not.toBeNull();
    expect(columnOuter).toHaveStyle({ minWidth: '260px', maxWidth: '264px' });
  });
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `npx vitest run src/test/SeikiKanbanBoard.test.tsx`
Expected: the `fillWidth` test FAILS (component doesn't accept/apply the prop yet, so `.rkk-column-outer` has no inline `maxWidth: 'none'`); the "without fillWidth" test PASSES already (it just documents current behavior) — that's fine, it's there to catch a future regression, not required to fail now.

- [ ] **Step 3: Write minimal implementation**

In `src/components/ui/SeikiKanbanBoard.tsx`, make these three changes:

1. Add the new prop to the interface — change:

```ts
  allowColumnDrag?: boolean;
  cardsGap?: number;
}
```

to:

```ts
  allowColumnDrag?: boolean;
  cardsGap?: number;
  fillWidth?: boolean;
}
```

2. Destructure it with a default — change:

```ts
  allowColumnDrag = false,
  cardsGap = 10,
}: SeikiKanbanBoardProps<TCard, TColumn>) {
```

to:

```ts
  allowColumnDrag = false,
  cardsGap = 10,
  fillWidth = false,
}: SeikiKanbanBoardProps<TCard, TColumn>) {
```

3. Use it in the `<Kanban>` JSX — change:

```tsx
      onCardMove={handleCardMove}
      onColumnMove={handleColumnMove}
      rootClassName="rkk-seiki-board"
```

to:

```tsx
      onCardMove={handleCardMove}
      onColumnMove={handleColumnMove}
      rootClassName="rkk-seiki-board"
      rootStyle={fillWidth ? { width: '100%' } : undefined}
```

and change:

```tsx
      columnWrapperStyle={() => ({
        backgroundColor: '#0d0d0d',
        borderRadius: '8px',
        border: '1px solid rgba(200, 184, 154, 0.25)',
        padding: '12px',
        minWidth: '260px',
      })}
```

to:

```tsx
      columnWrapperStyle={() =>
        fillWidth
          ? {
              backgroundColor: '#0d0d0d',
              borderRadius: '8px',
              border: '1px solid rgba(200, 184, 154, 0.25)',
              padding: '12px',
              flex: '1 1 0',
              minWidth: '220px',
              maxWidth: 'none',
            }
          : {
              backgroundColor: '#0d0d0d',
              borderRadius: '8px',
              border: '1px solid rgba(200, 184, 154, 0.25)',
              padding: '12px',
              minWidth: '260px',
            }
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/SeikiKanbanBoard.test.tsx`
Expected: PASS (all 4 tests: the 2 pre-existing ones plus the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SeikiKanbanBoard.tsx src/test/SeikiKanbanBoard.test.tsx
git commit -m "feat: add opt-in fillWidth prop to SeikiKanbanBoard for flexible equal-width columns"
```

---

### Task 2: Apply `fillWidth` to the Tasks board and simplify card actions to a single delete icon

**Files:**
- Modify: `src/views/tasks/TaskBoardView.tsx`
- Test: Create `src/test/TaskBoardView.test.tsx`

**Interfaces:**
- Consumes: `SeikiKanbanBoardProps.fillWidth` from Task 1 (boolean prop on `<SeikiKanbanBoard>`).
- Produces: no new exports; `TaskBoardView`'s existing prop signature (`TaskBoardViewProps`) is unchanged — `onUpdateStatus` stays on the interface (still used by the drag-and-drop `onCardMove` handler), only its use inside card-action rendering is removed.

- [ ] **Step 1: Write the failing tests**

Create `src/test/TaskBoardView.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskBoardView } from '../views/tasks/TaskBoardView';
import type { Task } from '../services/tasksService';
import type { TaskWidgetHandlers } from '../views/tasks/TaskWidgets';

const makeTask = (overrides: Partial<Task>): Task => ({
  id: 'task-1',
  description: 'Test task',
  lead_id: null,
  assigned_to: null,
  created_by: null,
  priority: 'medium',
  status: 'todo',
  due_date: null,
  completed_at: null,
  position: 0,
  is_auto_generated: false,
  sequence_step_id: null,
  created_at: '2026-07-21T00:00:00Z',
  updated_at: '2026-07-21T00:00:00Z',
  ...overrides,
});

const mockWidgets: TaskWidgetHandlers = {
  teamMembers: [],
  leads: [],
  activeDropdown: null,
  setActiveDropdown: vi.fn(),
  dropdownWrapperRef: { current: null },
  onToggleAssignee: vi.fn(),
  onUpdateDueDate: vi.fn(),
  onUpdatePriority: vi.fn(),
  onUpdateLead: vi.fn(),
};

describe('TaskBoardView', () => {
  const todoTask = makeTask({ id: 'task-todo', description: 'Todo task', status: 'todo' });
  const inProgressTask = makeTask({ id: 'task-in-progress', description: 'In progress task', status: 'in_progress' });
  const doneTask = makeTask({ id: 'task-done', description: 'Done task', status: 'done' });

  it('renders no status-switch buttons for any task status', () => {
    render(
      <TaskBoardView
        todoTasks={[todoTask]}
        inProgressTasks={[inProgressTask]}
        doneTasks={[doneTask]}
        onAddTask={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteTask={vi.fn()}
        widgets={mockWidgets}
      />
    );

    expect(screen.queryByText(/En cours/)).not.toBeInTheDocument();
    expect(screen.queryByText(/À faire/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fini/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ouvrir/)).not.toBeInTheDocument();
    expect(screen.queryByText('Supprimer')).not.toBeInTheDocument();
  });

  it('renders exactly one delete button per card, each calling onDeleteTask with its own task id', () => {
    const onDeleteTask = vi.fn();
    render(
      <TaskBoardView
        todoTasks={[todoTask]}
        inProgressTasks={[inProgressTask]}
        doneTasks={[doneTask]}
        onAddTask={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteTask={onDeleteTask}
        widgets={mockWidgets}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer la tâche' });
    expect(deleteButtons).toHaveLength(3);

    fireEvent.click(deleteButtons[0]);
    expect(onDeleteTask).toHaveBeenCalledWith('task-todo');

    fireEvent.click(deleteButtons[1]);
    expect(onDeleteTask).toHaveBeenCalledWith('task-in-progress');

    fireEvent.click(deleteButtons[2]);
    expect(onDeleteTask).toHaveBeenCalledWith('task-done');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/TaskBoardView.test.tsx`
Expected: FAIL — the current `renderCardActions` still renders status-switch button text ("En cours →", "← À faire", etc.), so the first test's `not.toBeInTheDocument()` assertions fail; the second test fails because there's no button with accessible name "Supprimer la tâche" yet (current buttons are plain text "Supprimer" with no `aria-label`, and the in-progress task has no delete button at all today).

- [ ] **Step 3: Write minimal implementation**

In `src/views/tasks/TaskBoardView.tsx`:

1. Add the `Trash2` import — change:

```tsx
import React from 'react';
import type { Task } from '../../services/tasksService';
```

to:

```tsx
import React from 'react';
import { Trash2 } from 'lucide-react';
import type { Task } from '../../services/tasksService';
```

2. Delete the entire `renderCardActions` function (it currently sits between the component's opening and the `return` statement):

```tsx
  const renderCardActions = (task: Task) => {
    if (task.status === 'todo') {
      return (
        <>
          <button className="transition-colors hover:text-ink cursor-pointer" onClick={() => onUpdateStatus(task.id, 'in_progress')}>En cours →</button>
          <button className="transition-colors hover:text-danger cursor-pointer" onClick={() => onDeleteTask(task.id)}>Supprimer</button>
        </>
      );
    }
    if (task.status === 'in_progress') {
      return (
        <>
          <button className="transition-colors hover:text-ink cursor-pointer" onClick={() => onUpdateStatus(task.id, 'todo')}>← À faire</button>
          <button className="transition-colors hover:text-ink cursor-pointer" onClick={() => onUpdateStatus(task.id, 'done')}>Fini ✓</button>
        </>
      );
    }
    return (
      <>
        <button className="transition-colors hover:text-ink cursor-pointer" onClick={() => onUpdateStatus(task.id, 'in_progress')}>← Ouvrir</button>
        <button className="transition-colors hover:text-danger cursor-pointer" onClick={() => onDeleteTask(task.id)}>Supprimer</button>
      </>
    );
  };

```

Remove this function entirely (delete all of the above, including the blank line after it).

3. Replace the card-actions footer inside `renderCard` — change:

```tsx
            <div className="mt-2.5 flex gap-3 border-t border-line pt-2 text-[11px] font-medium text-ink-soft">
              {renderCardActions(task)}
            </div>
```

to:

```tsx
            <div className="mt-2.5 flex justify-end border-t border-line pt-2">
              <button
                aria-label="Supprimer la tâche"
                className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                onClick={() => onDeleteTask(task.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
```

4. Pass `fillWidth` to `<SeikiKanbanBoard>` — change:

```tsx
      getCardColumnId={(t) => t.status}
      renderCard={(task) => {
```

to:

```tsx
      getCardColumnId={(t) => t.status}
      fillWidth
      renderCard={(task) => {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/TaskBoardView.test.tsx`
Expected: PASS (both tests)

Then run the full suite once to confirm no regressions:

Run: `npx vitest run`
Expected: all tests pass, pristine output (no new warnings)

- [ ] **Step 5: Commit**

```bash
git add src/views/tasks/TaskBoardView.tsx src/test/TaskBoardView.test.tsx
git commit -m "feat: fill Tasks kanban board width and simplify card actions to a single delete icon"
```

- [ ] **Step 6: Live verification on the running dev server**

The dev server is already running at `http://localhost:5173`, logged in as `admin@admin.com`. With the browser tool:
1. Navigate to Tâches → Tableau. Confirm the 3 columns (À faire / En cours / Terminé) now visually fill the available width, with no empty dead space to the right of "Terminé".
2. Confirm every card shows exactly one icon-only delete button (trash icon) and no text buttons like "En cours →", "← À faire", "Fini ✓", or "← Ouvrir".
3. Click a delete button on a card in each of the 3 columns and confirm the existing delete confirmation flow still works and the task is removed.
4. Toggle the sidebar collapse button and confirm the board reflows to use the freed-up width.
5. Check `read_console_messages` for any new errors.
6. Navigate to Pipeline and confirm its board is visually unchanged (columns still fixed-width, horizontally scrollable) — this proves `fillWidth` didn't leak into the shared component's default behavior.
