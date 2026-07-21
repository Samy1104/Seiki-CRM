# Design Specification: Agenda.tsx Modular Refactoring

**Date**: 2026-07-21  
**Status**: Approved by User  
**Author**: Full-Stack Developer  

---

## 1. Overview & Objective

Decompose the monolithic `Agenda.tsx` (833 lines / 29.7 KB) into clean custom hooks, utility modules, and single-responsibility sub-components.

### Goals
- Move iCal generation & line-folding logic to `src/utils/icalHelpers.ts`.
- Extract event state, API requests, and mutation handlers into `useAgendaEvents.ts`.
- Extract header navigation & action buttons into `AgendaHeader.tsx`.
- Extract search & segment filtering into `AgendaFilterBar.tsx`.
- Extract monthly calendar grid rendering into `AgendaCalendarGrid.tsx`.
- Extract event creation/editing modal into `EventFormModal.tsx`.
- Extract iCal feed subscription modal into `IcalFeedModal.tsx`.
- Reduce `Agenda.tsx` from 833 lines to ~45 lines of clean orchestrator code.

---

## 2. Target Component & Hook Architecture

```
src/
├── utils/
│   └── icalHelpers.ts             # iCal format builder, string escaper, and file downloader
├── hooks/
│   └── useAgendaEvents.ts         # Data fetching, event creation, update, and deletion handlers
│
└── views/agenda/
    ├── AgendaHeader.tsx           # Page title, Month/Year controls, iCal export, & "+ Nouvel événement" button
    ├── AgendaFilterBar.tsx        # Search bar & Segment filter dropdown
    ├── AgendaCalendarGrid.tsx     # Monthly calendar grid, day cells, & event badges
    ├── EventFormModal.tsx         # Create / Edit Event modal dialog
    ├── IcalFeedModal.tsx          # iCal Feed URL subscription modal dialog
    └── Agenda.tsx                 # Clean ~45-line orchestrator component
```

---

## 3. Verification Plan

1. **Unit Tests**: Run `npm run test` (`vitest run`) to verify all 61 tests pass.
2. **Build Check**: Run `npm run build` (`tsc -b && vite build`) to confirm zero TypeScript build errors.
3. **Functional Check**: Verify month navigation, event filtering, event creation/editing, and iCal exports work seamlessly.
