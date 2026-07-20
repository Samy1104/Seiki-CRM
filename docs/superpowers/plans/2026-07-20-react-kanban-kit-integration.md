# React Kanban Kit Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace custom Kanban logic in `Pipeline.tsx` and `TaskBoardView.tsx` with a unified `react-kanban-kit` board component matching the Portal & Sidebar visual theme.

**Architecture:** Create a generic component `src/components/ui/SeikiKanbanBoard.tsx` that transforms application data (leads/stages, tasks/statuses) into `react-kanban-kit`'s `BoardData`, handles `onCardMove` and `onColumnMove` with `dropHandler`/`dropColumnHandler`, and provides custom theme renderers.

**Tech Stack:** React 19, TypeScript, `react-kanban-kit`, `@atlaskit/pragmatic-drag-and-drop`, Tailwind CSS v4, Lucide React icons.

## Global Constraints

- **Package**: Use `react-kanban-kit` (imported from `react-kanban-kit`).
- **Styling**: Must strictly follow the Portal & Sidebar dark/gold design tokens (`#0d0d0d`, `#c8b89a`, `#f2ede4`, `border-line`, `bg-surface`).
- **DRY**: Shared logic must reside in `SeikiKanbanBoard.tsx`.
- **TDD**: Include tests for data transformer and move handlers.

---

### Task 1: Create the generic `<SeikiKanbanBoard />` component

**Files:**
- Create: `src/components/ui/SeikiKanbanBoard.tsx`
- Create: `src/test/SeikiKanbanBoard.test.tsx`

**Interfaces:**
- Produces: `SeikiKanbanBoard` React component accepting generic columns and cards with movement callbacks.

- [ ] **Step 1: Write tests for `SeikiKanbanBoard` data conversion & drop handling**

```tsx
// src/test/SeikiKanbanBoard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { SeikiKanbanBoard } from '../components/ui/SeikiKanbanBoard';

describe('SeikiKanbanBoard', () => {
  const columns = [
    { id: 'col-1', title: 'To Do', color: '#ff0000' },
    { id: 'col-2', title: 'Done', color: '#00ff00' },
  ];

  const cards = [
    { id: 'card-1', columnId: 'col-1', title: 'First Task' },
    { id: 'card-2', columnId: 'col-2', title: 'Second Task' },
  ];

  it('renders column headers correctly', () => {
    render(
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

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('First Task')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/SeikiKanbanBoard.test.tsx`
Expected: FAIL (Cannot find module `SeikiKanbanBoard`)

- [ ] **Step 3: Implement `SeikiKanbanBoard`**

```tsx
// src/components/ui/SeikiKanbanBoard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Kanban, dropHandler, dropColumnHandler } from 'react-kanban-kit';
import type { BoardData, BoardItem, ConfigMap, CardMove, ColumnMove } from 'react-kanban-kit';

export interface SeikiKanbanBoardProps<TCard, TColumn> {
  columns: TColumn[];
  cards: TCard[];
  getColumnId: (col: TColumn) => string;
  getColumnTitle: (col: TColumn) => string;
  getColumnColor?: (col: TColumn) => string;
  getCardId: (card: TCard) => string;
  getCardColumnId: (card: TCard) => string;
  renderCard: (card: TCard, column: TColumn) => React.ReactNode;
  renderColumnHeaderExtra?: (column: TColumn, cardsCount: number) => React.ReactNode;
  renderColumnFooter?: (column: TColumn) => React.ReactNode;
  onCardMove: (cardId: string, fromColumnId: string, toColumnId: string, position: number) => Promise<void>;
  onColumnMove?: (columnId: string, fromIndex: number, toIndex: number) => Promise<void>;
  onCardClick?: (card: TCard) => void;
  allowColumnDrag?: boolean;
  cardsGap?: number;
}

export function SeikiKanbanBoard<TCard, TColumn>({
  columns,
  cards,
  getColumnId,
  getColumnTitle,
  getColumnColor,
  getCardId,
  getCardColumnId,
  renderCard,
  renderColumnHeaderExtra,
  renderColumnFooter,
  onCardMove,
  onColumnMove,
  onCardClick,
  allowColumnDrag = false,
  cardsGap = 10,
}: SeikiKanbanBoardProps<TCard, TColumn>) {
  // Map lookup for rapid card/col retrieval
  const columnMap = useMemo(() => {
    const map = new Map<string, TColumn>();
    columns.forEach((col) => map.set(getColumnId(col), col));
    return map;
  }, [columns, getColumnId]);

  const cardMap = useMemo(() => {
    const map = new Map<string, TCard>();
    cards.forEach((card) => map.set(getCardId(card), card));
    return map;
  }, [cards, getCardId]);

  // Transform generic props to BoardData for react-kanban-kit
  const buildBoardData = (): BoardData => {
    const colIds = columns.map(getColumnId);
    const data: BoardData = {
      root: {
        id: 'root',
        title: 'Root',
        children: colIds,
        totalChildrenCount: colIds.length,
        parentId: null,
      },
    };

    // Columns
    columns.forEach((col) => {
      const colId = getColumnId(col);
      const colCards = cards.filter((c) => getCardColumnId(c) === colId);
      const cardIds = colCards.map(getCardId);

      data[colId] = {
        id: colId,
        title: getColumnTitle(col),
        children: cardIds,
        totalChildrenCount: cardIds.length,
        parentId: 'root',
        content: col,
      };
    });

    // Cards
    cards.forEach((card) => {
      const cardId = getCardId(card);
      const colId = getCardColumnId(card);
      data[cardId] = {
        id: cardId,
        title: cardId,
        parentId: colId,
        children: [],
        totalChildrenCount: 0,
        type: 'card',
        content: card,
      };
    });

    return data;
  };

  const [dataSource, setDataSource] = useState<BoardData>(buildBoardData);

  useEffect(() => {
    setDataSource(buildBoardData());
  }, [columns, cards]);

  const configMap: ConfigMap = {
    card: {
      render: ({ data }) => {
        const cardObj = cardMap.get(data.id) || (data.content as TCard);
        const colObj = columnMap.get(data.parentId || '') || ({} as TColumn);
        return (
          <div
            onClick={() => cardObj && onCardClick?.(cardObj)}
            className="cursor-pointer transition-all hover:translate-y-[-1px]"
          >
            {cardObj && renderCard(cardObj, colObj)}
          </div>
        );
      },
      isDraggable: true,
    },
  };

  const handleCardMove = (move: CardMove) => {
    const updated = dropHandler(move, dataSource, () => {});
    setDataSource(updated);
    onCardMove(move.cardId, move.fromColumnId, move.toColumnId, move.position).catch(() => {
      // Revert on error
      setDataSource(buildBoardData());
    });
  };

  const handleColumnMove = (move: ColumnMove) => {
    if (!onColumnMove) return;
    const updated = dropColumnHandler(move, dataSource);
    setDataSource(updated);
    onColumnMove(move.columnId, move.fromIndex, move.toIndex).catch(() => {
      setDataSource(buildBoardData());
    });
  };

  return (
    <Kanban
      dataSource={dataSource}
      configMap={configMap}
      allowColumnDrag={allowColumnDrag}
      cardsGap={cardsGap}
      onCardMove={handleCardMove}
      onColumnMove={handleColumnMove}
      rootClassName="rkk-seiki-board"
      renderColumnHeader={(colItem) => {
        const colObj = columnMap.get(colItem.id);
        const colCardsCount = colItem.children?.length || 0;
        const borderCol = colObj && getColumnColor ? getColumnColor(colObj) : '#c8b89a';

        return (
          <div
            className="mb-3 flex items-center justify-between border-b-2 pb-2 font-display text-[13.5px] font-bold text-ink"
            style={{ borderBottomColor: borderCol }}
          >
            <span>{colItem.title}</span>
            {colObj && renderColumnHeaderExtra ? (
              renderColumnHeaderExtra(colObj, colCardsCount)
            ) : (
              <span className="text-[11px] font-normal text-ink-soft">{colCardsCount}</span>
            )}
          </div>
        );
      }}
      renderColumnFooter={(colItem) => {
        const colObj = columnMap.get(colItem.id);
        return colObj ? renderColumnFooter?.(colObj) : null;
      }}
      columnWrapperStyle={() => ({
        backgroundColor: 'rgba(13, 13, 13, 0.4)',
        borderRadius: '8px',
        border: '1px solid var(--color-line, #2a2a2a)',
        padding: '12px',
        minWidth: '260px',
      })}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/SeikiKanbanBoard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```bash
git add src/components/ui/SeikiKanbanBoard.tsx src/test/SeikiKanbanBoard.test.tsx
git commit -m "feat: add SeikiKanbanBoard wrapper component for react-kanban-kit"
```

---

### Task 2: Refactor `Pipeline.tsx` to use `<SeikiKanbanBoard />`

**Files:**
- Modify: `src/views/Pipeline.tsx`

**Interfaces:**
- Consumes: `SeikiKanbanBoard` from `src/components/ui/SeikiKanbanBoard.tsx`

- [ ] **Step 1: Update `Pipeline.tsx` to use `SeikiKanbanBoard`**

Replace custom column mapping with `<SeikiKanbanBoard />` rendering `DealCard`:

```tsx
<SeikiKanbanBoard<Lead, PipelineStage>
  columns={stages}
  cards={leads}
  getColumnId={(st) => st.id}
  getColumnTitle={(st) => st.name}
  getColumnColor={(st) => st.color}
  getCardId={(l) => l.id}
  getCardColumnId={(l) => l.stage_id}
  renderColumnHeaderExtra={(st, count) => {
    const stageLeads = leads.filter((l) => l.stage_id === st.id);
    const stageVal = stageLeads.reduce((acc, l) => acc + l.deal_value, 0);
    return (
      <span className="text-[11px] font-normal text-ink-soft">
        {count} · {stageVal}k€
      </span>
    );
  }}
  renderCard={(lead) => (
    <DealCard
      lead={lead}
      slaBreached={isSlaBreached(lead, slaLimits)}
      isTaskOverdue={getLeadPriorityTask(lead.id)}
      onOpen={handleOpenLead}
    />
  )}
  renderColumnFooter={() => (
    <button
      className="mt-2.5 w-full rounded-control border border-dashed border-line-strong py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-focus hover:text-ink cursor-pointer"
      onClick={() => setView('add')}
    >
      + Ajouter
    </button>
  )}
  onCardMove={async (leadId, _fromCol, toCol) => {
    await leadsService.updateLead(leadId, { stage_id: toCol });
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage_id: toCol } : l))
    );
  }}
  onCardClick={(lead) => handleOpenLead(lead.id)}
/>
```

- [ ] **Step 2: Run application tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit Task 2**

```bash
git add src/views/Pipeline.tsx
git commit -m "refactor: integrate react-kanban-kit into Pipeline view"
```

---

### Task 3: Refactor `TaskBoardView.tsx` to use `<SeikiKanbanBoard />`

**Files:**
- Modify: `src/views/tasks/TaskBoardView.tsx`

**Interfaces:**
- Consumes: `SeikiKanbanBoard` from `src/components/ui/SeikiKanbanBoard.tsx`

- [ ] **Step 1: Update `TaskBoardView.tsx` to use `SeikiKanbanBoard`**

```tsx
import React from 'react';
import type { Task } from '../../services/tasksService';
import { SeikiKanbanBoard } from '../../components/ui/SeikiKanbanBoard';
import type { TaskWidgetHandlers } from './TaskWidgets';
import { TaskCard } from './TaskCard';

interface TaskColumn {
  id: 'todo' | 'in_progress' | 'done';
  title: string;
  color: string;
}

const taskColumns: TaskColumn[] = [
  { id: 'todo', title: 'À faire', color: 'var(--color-danger)' },
  { id: 'in_progress', title: 'En cours', color: 'var(--color-amber)' },
  { id: 'done', title: 'Terminé', color: 'var(--color-success)' },
];

interface TaskBoardViewProps {
  todoTasks: Task[];
  inProgressTasks: Task[];
  doneTasks: Task[];
  onAddTask: (status: 'todo' | 'in_progress' | 'done') => void;
  onUpdateStatus: (taskId: string, status: 'todo' | 'in_progress' | 'done') => void;
  onDeleteTask: (taskId: string) => void;
  widgets: TaskWidgetHandlers;
}

export const TaskBoardView: React.FC<TaskBoardViewProps> = ({
  todoTasks,
  inProgressTasks,
  doneTasks,
  onAddTask,
  onUpdateStatus,
  onDeleteTask,
  widgets,
}) => {
  const allTasks = [...todoTasks, ...inProgressTasks, ...doneTasks];

  return (
    <SeikiKanbanBoard<Task, TaskColumn>
      columns={taskColumns}
      cards={allTasks}
      getColumnId={(col) => col.id}
      getColumnTitle={(col) => col.title}
      getColumnColor={(col) => col.color}
      getCardId={(t) => t.id}
      getCardColumnId={(t) => t.status}
      renderCard={(task) => (
        <TaskCard
          task={task}
          widgets={widgets}
          onUpdateStatus={onUpdateStatus}
          onDeleteTask={onDeleteTask}
        />
      )}
      renderColumnFooter={(col) => (
        <button
          className="mt-2.5 w-full rounded-control border border-dashed border-line-strong py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-focus hover:text-ink cursor-pointer"
          onClick={() => onAddTask(col.id)}
        >
          + Ajouter une tâche
        </button>
      )}
      onCardMove={async (taskId, _fromCol, toCol) => {
        onUpdateStatus(taskId, toCol as 'todo' | 'in_progress' | 'done');
      }}
    />
  );
};
```

- [ ] **Step 2: Run test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit Task 3**

```bash
git add src/views/tasks/TaskBoardView.tsx
git commit -m "refactor: integrate react-kanban-kit into TaskBoardView"
```

---

### Task 4: End-to-End Build and Verification

- [ ] **Step 1: Run project build**

Run: `npm run build`
Expected: Build finishes cleanly without TypeScript or bundler errors.

- [ ] **Step 2: Run full test suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 3: Commit final verification**

```bash
git add .
git commit -m "chore: verify react-kanban-kit integration across views"
```
