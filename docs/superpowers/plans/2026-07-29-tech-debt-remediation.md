# Technical Debt Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solve and remediate all technical debt findings from `TECH_DEBT_AUDIT.md` (F001–F101) across Seiki CRM codebase.

**Architecture:** Systematic refactoring and bug fixing grouped into 3 bite-sized, test-driven phases: (1) Critical security, correctness, and failing test fixes, (2) Code hygiene, quick win deletions, and config alignment, (3) Structural consistency and design token harmonization.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Vitest, Supabase Postgres & Edge Functions.

## Global Constraints

- Preserve existing component APIs unless refactoring with explicit deprecation path.
- Maintain 100% passing Vitest test suite (`npx vitest run`).
- No hardcoded hex colors for beige accents (`#D4C4A8`, `#c8b89a`) in newly created or refactored files — use CSS variables or Tailwind token classes.

---

### Task 1: Fix Critical Security & Edge Function API Key Leak (F065)

**Files:**
- Modify: `supabase/functions/_shared/geminiApi.ts:25-35`

**Interfaces:**
- Consumes: Gemini API Key from environment variable `GEMINI_API_KEY`.
- Produces: Secure HTTP request with `x-goog-api-key` header instead of URL parameter.

- [ ] **Step 1: Inspect `geminiApi.ts` URL construction**
- [ ] **Step 2: Update `geminiApi.ts` to pass key in `x-goog-api-key` header**
- [ ] **Step 3: Run edge function tests to ensure no regressions**

Run: `npx vitest run supabase/functions/`
Expected: All edge function tests pass.

---

### Task 2: Fix Failing Unit Tests in `Select.test.tsx` (F073)

**Files:**
- Modify: `src/components/ui/Select.tsx`
- Modify: `src/components/ui/Select.test.tsx`

**Interfaces:**
- Consumes: `Select` component props and state.
- Produces: 100% passing tests for keyboard navigation and click-outside dismissal.

- [ ] **Step 1: Run `Select.test.tsx` to observe exact test failures**

Run: `npx vitest run src/components/ui/Select.test.tsx`
Expected: 2 tests fail.

- [ ] **Step 2: Update `Select.tsx` keyboard navigation & event listener handling**
- [ ] **Step 3: Re-run `Select.test.tsx` to verify all tests pass**

Run: `npx vitest run src/components/ui/Select.test.tsx`
Expected: PASS (all tests pass).

---

### Task 3: Fix Logic Bugs & Performance Issues (F069, F071, F072, F099, F101)

**Files:**
- Modify: `src/views/prospection/TrackingTab.tsx:199`
- Modify: `src/services/settingsService.ts:138-140,235`
- Modify: `src/context/AuthContext.tsx:150-160`
- Modify: `src/views/Portal.tsx:10`

- [ ] **Step 1: Fix `TrackingTab.tsx` line 199 filter guard**
- [ ] **Step 2: Capture `insert()` error in `settingsService.ts` & remove `.includes('column')` substring check**
- [ ] **Step 3: Wrap `AuthContext` value in `useMemo` and functions in `useCallback`**
- [ ] **Step 4: Remove dead `setActiveApp` prop from `Portal.tsx`**
- [ ] **Step 5: Run tests to verify**

Run: `npx vitest run`
Expected: PASS.

---

### Task 4: Quick Wins & Dead Code Deletion (F051, F079, F080, F057, F063, F086, F087, F088)

**Files:**
- Delete: `src/views/tasks/KanbanColumn.tsx`
- Delete: `src/views/agenda/AgendaCalendarGrid.tsx`
- Delete: `src/views/agenda/AgendaFilterBar.tsx`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `src/views/Leads.tsx`
- Modify: `src/views/pipeline/LeadDetailModal.tsx`

- [ ] **Step 1: Remove dead files (`KanbanColumn.tsx`, `AgendaCalendarGrid.tsx`, `AgendaFilterBar.tsx`)**
- [ ] **Step 2: Pin `react-kanban-kit` & add Node engines to `package.json`**
- [ ] **Step 3: Update `README.md` with Docker instructions**
- [ ] **Step 4: Fix `Leads.tsx` catch blocks and `LeadDetailModal.tsx` `as any` cast**
- [ ] **Step 5: Verify build & test suite**

Run: `npx vitest run`
Expected: PASS.

---

### Task 5: Component & Design Token Alignment (F067, F096, F097, F098, F100)

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/ConfirmDeleteModal.tsx`
- Modify: `src/components/ColorModal.tsx`
- Modify: `src/utils/confirmAction.ts`
- Modify: `src/views/Portal.tsx`

- [ ] **Step 1: Define `--color-muted-beige` token in `src/index.css`**
- [ ] **Step 2: Refactor `ConfirmDeleteModal.tsx` using `Modal.tsx`, `AccentButton`, and keyboard listeners**
- [ ] **Step 3: Refactor `ColorModal.tsx` to fix redundant state & add Escape listener**
- [ ] **Step 4: Upgrade `confirmAction.ts` to support asynchronous modal confirmations**
- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.
