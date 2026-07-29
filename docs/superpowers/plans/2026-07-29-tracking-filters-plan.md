# Tracking Filters & Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement live text search and status/sentiment filter tabs with dynamic counts in `TrackingTab.tsx`.

**Architecture:** Add search input and filter pill UI controls to `TrackingTab.tsx`, filter `DisplayEntry[]` array via `useMemo`, and display empty state when filter matches nothing.

**Tech Stack:** React, Lucide Icons (`Search`, `X`), TypeScript, Vitest.

## Global Constraints
- Filters must compute dynamic counters.
- Reset button clears search and sets filter to `'all'`.
- All Vitest tests must pass.

---

### Task 1: Add Search & Filter Logic to `TrackingTab.tsx`

**Files:**
- Modify: `src/views/prospection/TrackingTab.tsx`

- [ ] **Step 1: Add search and filter state & computation in `TrackingTab.tsx`**

Add state variables:
- `searchQuery` (`string`)
- `statusFilter` (`'all' | 'positive' | 'negative' | 'opened' | 'bounced'`)

Add `filteredEntries` and `counts` computed via `useMemo`.

- [ ] **Step 2: Render Search Bar & Filter Pills UI**

Render search input bar with `Search` and `X` icons.
Render pill buttons for `Tous`, `Positif (IA)`, `Négatif (IA)`, `Ouverts non répondus`, `Rebonds`.

- [ ] **Step 3: Run Vitest tests**

Run: `npx vitest run src/components/Sidebar.test.tsx src/utils/emailParser.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/prospection/TrackingTab.tsx
git commit -m "feat: add live search and status/sentiment filter pills to TrackingTab"
```
