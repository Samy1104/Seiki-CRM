# Design Specification: Tasks.tsx Modular Refactoring

**Date**: 2026-07-21  
**Status**: Approved by User  
**Author**: Full-Stack Developer  

---

## 1. Overview & Objective

Decompose the monolithic `Tasks.tsx` (700 lines / 27.4 KB) into single-responsibility custom hooks and sub-components.

### Goals
- Extract data fetching and task mutation handlers into `useTasksData.ts`.
- Extract filtering and sorting logic into `useTaskFilters.ts`.
- Extract header and view-switching UI into `TasksHeader.tsx`.
- Extract filter bar UI into `TasksFilterBar.tsx`.
- Reduce `Tasks.tsx` from 700 lines to ~45 lines of clean, readable orchestration code.

---

## 2. Target Component & Hook Architecture

```
src/
├── hooks/
│   ├── useTasksData.ts            # Data fetching & task mutation handlers (create, delete, status toggle)
│   └── useTaskFilters.ts           # Filtering (priority, lead, assignee, search, sorting)
│
└── views/tasks/
    ├── TasksHeader.tsx            # Title, View Switcher (List/Board), and "Nouvelle Tâche" button
    ├── TasksFilterBar.tsx         # Priority, Lead, Assignee, and Sort dropdown filter toolbar
    ├── TaskListView.tsx           # Interactive Table View (existing)
    ├── TaskBoardView.tsx          # Drag-and-drop Kanban Board View (existing)
    ├── NewTaskModal.tsx           # Task creation modal dialog (existing)
    └── Tasks.tsx                  # Clean ~45-line orchestrator component assembling hooks and views
```

---

## 3. Detailed File Specifications

### 1. `src/hooks/useTasksData.ts`
- Encapsulates fetching `tasks`, `leads`, and `teamMembers`.
- Exposes `handleStatusToggle`, `handleDeleteTask`, `handlePriorityChange`, `handleAssigneeToggle`.
- Manages `loading` state.

### 2. `src/hooks/useTaskFilters.ts`
- Encapsulates `filterPriority`, `filterLeadId`, `filterAssigneeId`, `sortByDue`.
- Computes `filteredTasks` array using `useMemo`.
- Exposes `clearFilters()`.

### 3. `src/views/tasks/TasksHeader.tsx`
- Displays page title ("Gestion des Tâches").
- Renders List / Board toggle buttons.
- Renders "Nouvelle tâche" primary button.

### 4. `src/views/tasks/TasksFilterBar.tsx`
- Renders priority, lead, assignee, and sort selects.
- Displays "Effacer les filtres" button when filters are active.

### 5. `src/views/Tasks.tsx`
- Calls `useTasksData()` and `useTaskFilters()`.
- Passes state and handlers cleanly to `TasksHeader`, `TasksFilterBar`, `TaskListView`, and `TaskBoardView`.

---

## 4. Verification Plan

1. **Unit Tests**: Run `npm run test` (`vitest run`) to verify all 61 tests pass.
2. **Build Check**: Run `npm run build` (`tsc -b && vite build`) to verify clean TypeScript compilation.
3. **Functional Check**: Verify list view, kanban view, filtering, task creation, and status toggles work seamlessly.
