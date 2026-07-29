# Tech Debt Audit — Seiki CRM

Generated: 2026-07-17 · Remediation pass: 2026-07-17 · Repeat-run: 2026-07-21 · Repeat-run: 2026-07-29 · **Repeat-run: 2026-07-29 (pass 2)**
Scope: full repo (`src/`, `supabase/functions/`, `archive/schema_*.sql`, CI/config, Docker, nginx). ~18,500+ LOC application TypeScript/TSX + ~4,400 LOC edge functions (96 TSX source files).
Prior audit: same file, pass 1 (2026-07-29). This pass covers changes observed since then: 5 new UI components, 1 new view (Portal), 2 new prospection tabs, Settings split into 4 sub-tab components, and pipeline stage color picker.

---

## What changed since the last pass (2026-07-29 pass 1 → pass 2)

This is a same-day second pass. The codebase changes appear to be an **extension sprint** — new features added without addressing any of the outstanding debt from the previous cycle. Four structural patterns were introduced:

1. **Settings was split into 4 sub-tab components** (`MembersTab.tsx`, `PipelineStagesTab.tsx`, `SlaTab.tsx`, `ProspectionSettingsTab.tsx`). The split is clean architecturally. `PipelineStagesTab` adds a pipeline-stage color picker via a new `ColorModal.tsx` component — both files bypass the established `Modal.tsx` infrastructure entirely, using raw portals and inline hex styles.

2. **Prospection gained a 4th tab (Relances/Follow-up)** via `FollowUpTab.tsx`. Clean logic, but continues the `text-[#D4C4A8]`/inline-hex pattern (F067).

3. **A `Portal.tsx` split-panel entry page was added** as the authenticated landing page, routing to CRM or Contenu. Heavy inline styles (intentional for animation), but carries `#c8b89a` as the accent color — the undocumented second beige value that has no token.

4. **`ConfirmDeleteModal.tsx` was created for Agenda** — a bespoke full-screen modal that bypasses `Modal.tsx`, `AccentButton`, and the Tailwind design tokens, while all other destructive confirmations in the app (`LeadDetailModal`, `Leads`, `Tasks`, `Settings`, `EmailPreviewCard`) use a `confirmAction()` wrapper that calls `window.confirm()` synchronously. Two incompatible patterns now coexist for the same user action.

Net: **zero prior findings were resolved**. The five highest-priority items from the last pass (F065, F069, F066, F068, F073) are all unchanged. F067 (hardcoded hex) is now materially wider — new files added this sprint add instances rather than removing them.

---

## Remediation status (F001–F095, all cycles)

### Resolved across all cycles
- **F052** (LeadDetailModal legacy CSS vocabulary) — ✅ RESOLVED
- **F053** (Sidebar 100% hardcoded hex) — ✅ RESOLVED
- **F054** (Sidebar dead ternary) — ✅ RESOLVED
- **F060** (nginx header divergence) — ✅ RESOLVED

### Still open (last pass status unchanged)
- **F002** (no `supabase/migrations/`) — still absent; 20 `schema_*.sql` files in `archive/`. Fourth consecutive cycle. Now has new structural relevance: the `addPipelineStage` fallback shim in `settingsService.ts:234-244` exists *because* no migration baseline is established — it silently retries the insert without `is_closed_lost` when `PGRST204` fires. F066 cannot be cleanly removed until this is resolved.
- **F019/F020** (OAuth tokens unencrypted-at-rest) — unchanged trade-off.
- **F051** (dead `src/views/tasks/KanbanColumn.tsx`) — still zero imports. **Fourth consecutive cycle.** Straight one-line quick win.
- **F055** (`loading-container`/`loading-spinner` legacy CSS classes) — still in Agenda, Tasks, Codir, Settings.
- **F057** (`react-kanban-kit` not exact-pinned, still `"^0.0.2-beta.7"`) — **third consecutive cycle.**
- **F058** (kanban board props-change/`onCardMove` untested) — unchanged.
- **F059** (`Select.tsx` 4× `as any` in children-traversal) — unchanged.
- **F061** (`npm audit` vulnerabilities) — still 14 (9 high, 5 moderate); the `react-router-dom` GHSA-qwww-vcr4-c8h2 advisory still sits in a production dependency.
- **F062** (`CalendarModal.tsx` pure date-grid functions untested) — unchanged.
- **F063** (README doesn't mention Docker) — **third consecutive cycle.**
- **F064/F086** (Node version 3-way split: CI 20, Docker 24.18.0, README "18+", no `engines` field) — unchanged.
- **F065** (CRITICAL — Gemini API key in URL query param, logged on every timeout) — **still open**. `geminiApi.ts:27` still has `?key=${geminiKey}`. This is the only Critical finding in four audit cycles; it's been flagged for two consecutive passes with a documented 5-line fix. Still in production logs.
- **F066** (5-way "is this a lost stage" computation) — **still open**. `leadsService.ts:175-178` still checks `stage.is_closed_lost || lostIds.includes(updates.stage_id) || stageName.includes('perdu') || stageName.includes('lost') || stageName.includes('abandon')`. `settingsService.ts:218-221` does the same triple fusion. Now has new context: the `addPipelineStage` fallback shim (lines 234-244) means cleanup is blocked on schema migration (see F002).
- **F067** (hardcoded `#D4C4A8`/`#c8b89a` hex across 46+ files) — **wider than last pass**. New files added this sprint (`PortalPipelineStagesTab.tsx`, `FollowUpTab.tsx`, `ValidationTab.tsx`, `ColorModal.tsx`, `ConfirmDeleteModal.tsx`, `SegmentedToggle.tsx`, `Portal.tsx`) all add fresh instances rather than consuming tokens. See F096-F100 for the new files specifically.
- **F068** (zero tests for rebuilt core: `LeadDetailModal`, `Leads`, `Pipeline`, `DealCard`, `AccentButton`) — unchanged. `LeadDetailModal` is now 743 lines (down from 805), still zero tests. `Leads.tsx` is 392 lines, still zero tests.
- **F069** (TrackingTab `opened` filter drift) — **still open**. `filteredEntries` at line 199 still missing the `!hasPos && !hasNeg` guard that `counts` has at line 172. The badge count and the filtered list can diverge.
- **F070** (TrackingTab zero tests, 2 hotfix commits in one week) — unchanged; no `TrackingTab.test.tsx` exists.
- **F071** (`settingsService.saveSetting` final `insert()` error discarded) — still at `settingsService.ts:138-140`; result is unused.
- **F072** (`AuthContext` no `useCallback`/`useMemo`) — still at `AuthContext.tsx:152`; provider value object recreated each render, `login`/`logout` not memoized.
- **F073** (2 failing `Select.test.tsx` tests on `main`) — **status uncertain**. `Select.tsx` was significantly reworked (click-outside now uses `setTimeout(0)` before adding the `mousedown` listener; keyboard navigation refactored). The `setTimeout(0)` pattern introduces a new potential test failure mode: `fireEvent.mouseDown` fires synchronously before the listener is registered. The keyboard-navigation test still appears to expect `'banana'` after 2 ArrowDowns, but the implementation focuses `keys[0]` on the first ArrowDown after opening (not `keys[1]`). Needs re-run to confirm; treat as potentially still failing until verified.
- **F074** (`Button.tsx` vs `AccentButton.tsx` two competing primaries) — unchanged; 8 files now import both.
- **F075** (Modal mounting anti-pattern, `open={true}` hardcoded, exit animation never plays) — unchanged; `LeadDetailModal`, `Leads`, `Pipeline` all still do `{open && <LeadDetailModal ...>}`.
- **F076** (`LeadDetailModal` 743 lines, 4 concerns) — unchanged in structure; line count decreased slightly.
- **F077** (prompt injection in `replySentimentClassifier.ts`) — unchanged.
- **F078** (`emailParser.ts` `QUOTE_HEADER_REGEX` false-positive risk) — unchanged.
- **F079** (`AgendaCalendarGrid.tsx` 87 lines, zero imports) — **still dead. Third consecutive cycle.**
- **F080** (`AgendaFilterBar.tsx` 82 lines, zero imports) — **still dead. Third consecutive cycle.**
- **F081** (`EmailGenerator.tsx` pure logic untested) — unchanged.
- **F082** (`icalHelpers.ts` duplicates edge-function copy, zero tests) — unchanged.
- **F083** (`TaskWidgets.tsx` dropdown mechanics duplicated 3×) — unchanged.
- **F084** (LinkedIn OAuth callback missing `origin` revalidation) — unchanged.
- **F085** (`npm audit` 14 vulns) — unchanged.
- **F087** (`Leads.tsx` merge catch blocks missing `console.error`) — unchanged.
- **F088** (`LeadDetailModal:400` unnecessary `as any` on tab-id cast) — unchanged.
- **F089** (`LeadDetailModal` history log `||` chain drops stage-change when score-change also present) — unchanged.
- **F090** (4 avoidable `as any` casts) — unchanged.
- **F091** (`EmailLog` interface missing columns the DB actually writes) — unchanged.
- **F092** (TrackingTab hard 100-row cap, no pagination indicator) — unchanged.
- **F093** (`useCachedResource` zero tests, high blast radius) — unchanged.
- **F094** (`track-email` unauthenticated pixel, acceptable as-is) — no change; still acceptable.
- **F095** (`processInboundMessage` 290-line function, low priority) — unchanged.

---

## Executive summary (current state)

- **F065 is still a live credential leak in production logs**: four audit cycles, two consecutive passes flagged with a documented 5-line fix. The Gemini key goes in the URL, timeouts log the full URL, the key rotates but the code doesn't. This is the audit's only Critical finding.
- **Zero findings were resolved in this sprint** — the work landed was entirely new features. The debt items that keep getting flagged (F065, F069, F071, F072, F073, F051, F079, F080, F063) are still open after a month of active development.
- **F067 is wider than it has ever been**: new files this sprint added more hardcoded hex instead of consuming the `--color-beige` token. `#c8b89a` (the undocumented second beige value) now appears in `Portal.tsx` prominently and is still tokened nowhere.
- **Two incompatible destructive-confirmation patterns now coexist** (NEW — F096): `window.confirm()` (synchronous, browser-styled) in 8+ callsites vs. `ConfirmDeleteModal` (async, custom React modal) in Agenda only. These can't be mixed or composed.
- **`ConfirmDeleteModal.tsx` is a second parallel modal implementation** (NEW — F097), bypassing `Modal.tsx` entirely — while `Modal.tsx` itself has unresolved issues (F075). There are now effectively three modal patterns in the repo.
- **`Portal.tsx`'s `setActiveApp` prop is dead code** (NEW — F099): `App.tsx` passes no props to `<Portal />`, so the `if (setActiveApp)` branches never execute.
- **The failing `Select.test.tsx` tests** (F073) may have changed character: the `setTimeout(0)` click-outside implementation could fix or break them differently — needs a fresh `vitest run` to confirm before calling CI green.
- **`addPipelineStage` has an overly-broad error-match condition** (NEW — F101): `String(error.message).includes('column')` could swallow unrelated column-constraint errors as if they were schema-version mismatches.

---

## Architectural mental model (updated)

Unchanged at the base: single-page React 19 + TypeScript + Vite, Supabase Postgres+RLS as the only backend, Deno edge functions for secrets/cron work, and a Tailwind design-token system that has finished migrating its two last holdout files (F052/F053) but is actively being bypassed again in new work (F067, F097, F098, F100).

**New this pass**: a `Portal.tsx` entry page now sits at `/portal` between login and the CRM/Contenu sections. It uses React Router `navigate()` to transition sections; the `setActiveApp` callback prop is a dead stub never wired by `App.tsx`.

**Settings architecture changed**: the monolithic `Settings.tsx` (344 lines of state + logic) now delegates rendering to 4 sub-tab components (`MembersTab`, `PipelineStagesTab`, `SlaTab`, `ProspectionSettingsTab`) via prop-drilling of state/handlers from the parent. The parent retains all state and all service calls — the tabs are pure rendering components. This is clean; the only debt introduced is in `PipelineStagesTab`'s use of a new `ColorModal` that bypasses the existing component system.

**The two-source `is_closed_lost` system is now load-bearing for schema compatibility**: the `addPipelineStage` and `updatePipelineStage` fallback shims in `settingsService.ts` silently retry operations without the `is_closed_lost` column if the DB column doesn't exist. This means the JSON shadow-list in `app_settings` (`pipeline_lost_stage_ids`) is not just legacy inconsistency — it's also the schema-compat fallback. F066 cannot be cleaned up until either the column is confirmed present via a proper migration (F002) or the fallback shim is removed with that column as a prerequisite.

---

## NEW findings (this pass)

| ID | Category | File:Line | Severity | Effort | Description | Recommendation |
|----|----------|-----------|----------|--------|-------------|----------------|
| F096 | Consistency rot | `src/utils/confirmAction.ts:3`, `src/views/Tasks.tsx:199`, `src/views/Settings.tsx:167,241`, `src/views/pipeline/LeadDetailModal.tsx:207,261,316`, `src/views/Leads.tsx:99,128`, `src/views/prospection/EmailPreviewCard.tsx:68`; vs `src/components/ConfirmDeleteModal.tsx`, `src/views/Agenda.tsx:271` | **Medium** | M | Two incompatible destructive-confirmation patterns coexist: `confirmAction()` wraps `window.confirm()` — synchronous, browser-styled, blocked by popup blockers in some embedded contexts — used in 8+ callsites across Tasks, Settings, LeadDetailModal, Leads, EmailPreviewCard. `ConfirmDeleteModal` is a custom async React modal, used in Agenda only. They cannot be composed (one returns a bool synchronously, the other uses callbacks). The intent of centralising via `confirmAction()` is sound, but was abandoned in favour of a new component for Agenda instead of upgrading the central function. | Upgrade `confirmAction()` to return a `Promise<boolean>` backed by a shared `<ConfirmDialog>` context (one portal, one modal component); async-ify the 8 calling sites. Or accept `window.confirm()` everywhere and delete `ConfirmDeleteModal`. Pick one. |
| F097 | Consistency rot / architectural decay | `src/components/ConfirmDeleteModal.tsx` (whole file) | **Medium** | S | A new bespoke full-screen modal that reimplements modal chrome from scratch: raw `fixed inset-0 z-[9999]` backdrop, close button, header, footer actions — all with inline styles (`#111111`, `#f2ede4`, `#b0afa8`, `#0a0a0a`, `#e57373`, `#ef5350`). No focus trap. No Escape-key handler (keyboard users cannot dismiss it). `onMouseEnter`/`onMouseLeave` JS for hover effects instead of Tailwind or CSS. No `aria-modal="true"` or `role="dialog"`. This is a third modal implementation alongside `Modal.tsx` (which F075 already flags as having broken exit-animation semantics). Future contributors see two radically different modal patterns with no guide for which to use. | Port to `Modal.tsx` + `AccentButton` for the primary action. The delete button's danger styling can be passed as a prop or variant. |
| F098 | Consistency rot | `src/components/ColorModal.tsx` (whole file) | **Low** | S | New color-picker popover that uses raw `createPortal` with inline styles throughout (`#141414`, `#f2ede4`, `#888`, `#1a1a1a`). No Escape-to-close, no arrow-key navigation for the color grid. Position calculation in `useState` initializer (`getInitialPos()`) is redundant with `useLayoutEffect` that overwrites it 5 lines later — the `useState` version is always stale on first render. `onMouseEnter`/`onMouseLeave` JS for button hover where a Tailwind `hover:` class would suffice. `focus:border-[#D4C4A8]` hardcodes the beige token inline. | Add Escape-key close handler (`useEffect` on `keydown`). Remove the redundant `useState(getInitialPos)` initializer — just start with `{ top: 0, left: 0, width: 0 }` and let `useLayoutEffect` set the real position. Replace hardcoded hex with CSS vars where available. |
| F099 | Dead code | `src/views/Portal.tsx:10`, `App.tsx:39` | **Low** | S | `Portal.tsx` declares `setActiveApp?: (app: 'portal' \| 'crm' \| 'contenu') => void` as an optional prop. `App.tsx` renders `<Portal />` with no props. The two `if (setActiveApp) setActiveApp('crm'/'contenu')` branches (lines 17, 22) never execute — all navigation goes through `navigate('/crm/pipeline')` / `navigate('/contenu/prospection')` alone. The prop is dead from birth. | Remove the `setActiveApp` prop from `Portal.tsx` and its interface. |
| F100 | Consistency rot (part of F067) | `src/views/Portal.tsx:82,88,125,143` | **Low** | S | `Portal.tsx` uses `#c8b89a` (the undocumented second beige value, still tokened nowhere) as the primary accent color in 4 places — the CRM panel's accent line, the `01` label, the "Entrer" arrow, and the divider line. This is the same value that appears throughout F067 findings and still has no `--color-muted-beige` token in `theme.css`. | Define `--color-muted-beige: #c8b89a` in `theme.css` (or decide it should collapse into `--color-beige`) and use the token. |
| F101 | Error handling | `src/services/settingsService.ts:235` | **Low** | S | `addPipelineStage`'s error-type guard includes `String(error.message).includes('column')` — a substring match too broad to distinguish a "column does not exist" schema error from other column-related errors (e.g. a `check constraint` on a column, a `foreign key` violation referencing a column). If a genuine column-constraint error fires, it is swallowed and silently retried as a narrower insert, potentially returning success when the underlying data was rejected. The precise `error.code === 'PGRST204'` check on the same line is safe; the string fallback is not. | Remove the `.includes('column')` catch-all; rely on `error.code === 'PGRST204'` alone for the schema-version fallback. |

---

## Prior findings table (F065–F095 summary, unchanged entries)

See previous pass for full table. Below is the current-cycle subset worth highlighting in context of new work:

| ID | Category | File:Line | Severity | Status |
|----|----------|-----------|----------|--------|
| F065 | Security | `supabase/functions/_shared/geminiApi.ts:27` | **Critical** | Still open — 5-line fix, key in URL, logged on every timeout |
| F069 | Correctness | `src/views/prospection/TrackingTab.tsx:199` | High | Still open — `!hasPos && !hasNeg` guard missing from `filteredEntries` |
| F066 | Architectural decay | `src/services/leadsService.ts:175-178`, `settingsService.ts:218-221` | High | Still open — cleanup now blocked on F002 (schema migration) |
| F068 | Test debt | LeadDetailModal, Leads, Pipeline, DealCard, AccentButton | High | Still open — zero tests |
| F073 | Test debt/CI | `src/components/ui/Select.test.tsx:97,113` | High | Status uncertain after `Select.tsx` rework — needs `vitest run` |
| F071 | Error handling | `src/services/settingsService.ts:138-140` | High | Still open — final insert() error discarded |
| F072 | Performance | `src/context/AuthContext.tsx:152` | High | Still open — no `useCallback`/`useMemo` |
| F051 | Dead code | `src/views/tasks/KanbanColumn.tsx` | Medium | Still open — 4th cycle |
| F079 | Dead code | `src/views/agenda/AgendaCalendarGrid.tsx` | Medium | Still open — 3rd cycle |
| F080 | Dead code | `src/views/agenda/AgendaFilterBar.tsx` | Medium | Still open — 3rd cycle |
| F067 | Consistency rot | 46+ files, now wider | High | Still open — new files add instances |

---

## Top 5 — if you fix nothing else, fix these

### 1. Stop logging the Gemini API key (F065) — *fourth cycle of flagging this*
`geminiApi.ts:27`: change `?key=${geminiKey}` to a `x-goog-api-key` header. Rotate the current key once done. This is a 5-line fix that has been documented across two consecutive audit passes. It is a live credential leak in production Supabase edge function logs every time a Gemini call times out.

### 2. Fix `TrackingTab.tsx` line 199's missing `!hasPos && !hasNeg` guard (F069)
The "Non répondus" badge count and the actual filtered list can show different numbers once a replied message has sentiment set. The fix is adding two conditions to line 199's `isOpened` check, matching what `counts` already does at line 172.

### 3. Fix or skip the two failing `Select.test.tsx` tests (F073)
Run `npx vitest run` to confirm their current state after the `Select.tsx` rework. If they still fail: fix the keyboard-navigation test (needs 3 ArrowDowns not 2, or first ArrowDown should also focus item 0) and the click-outside test (the `setTimeout(0)` listener registration may fire after the synchronous `fireEvent.mouseDown` in tests). A red CI suite that's become background noise is worse than no CI.

### 4. Collapse the two destructive-confirmation patterns (F096)
Either: upgrade `confirmAction()` to a `Promise<boolean>` backed by a shared dialog, or accept native `window.confirm()` everywhere and delete `ConfirmDeleteModal`. The current split — `window.confirm` in 8 callsites and a custom React modal in 1 — means the Agenda delete confirmation looks and behaves completely differently from every other delete in the app.

### 5. Token the five quick-win dead code deletes (F051, F079, F080) + insert error (F071) + AuthContext memoization (F072)
None of these take more than 30 minutes: delete 3 dead files, check 1 error return value, add `useCallback`+`useMemo` to AuthContext mirroring `ToastContext.tsx` (already a model in this codebase). Combined they remove 3 dead-code files, close a silent write failure, and stop re-rendering every `useAuth()` consumer on every auth-provider render.

---

## Quick wins (updated)

- [ ] **F065** — Move Gemini key to `x-goog-api-key` header in `geminiApi.ts:27`; rotate the key *(Critical, 5 lines)*
- [ ] **F051** — Delete dead `src/views/tasks/KanbanColumn.tsx` *(4th cycle)*
- [ ] **F079** — Delete dead `src/views/agenda/AgendaCalendarGrid.tsx` *(3rd cycle)*
- [ ] **F080** — Delete dead `src/views/agenda/AgendaFilterBar.tsx` *(3rd cycle)*
- [ ] **F069** — Add `!hasPos && !hasNeg` to `TrackingTab.tsx:199`'s `isOpened` check
- [ ] **F071** — Capture and throw/report the final `insert()` error in `settingsService.saveSetting` (line 140)
- [ ] **F073** — Run `npx vitest run`; fix or `.skip` with a reason the 2 failing `Select.test.tsx` tests
- [ ] **F099** — Remove dead `setActiveApp` prop from `Portal.tsx`
- [ ] **F101** — Remove `.includes('column')` from `settingsService.ts:235`'s error guard; keep `code === 'PGRST204'`
- [ ] **F057** — Pin `react-kanban-kit` to exact version *(3rd cycle)*
- [ ] **F086** — Add `"engines": {"node": ">=24"}` to `package.json`; bump CI to Node 24; fix README line *(3rd cycle)*
- [ ] **F063** — Add one-line Docker pointer to README *(3rd cycle)*
- [ ] **F087** — Add `console.error` to the two merge catch blocks in `Leads.tsx`
- [ ] **F088** — Remove unnecessary `as any` at `LeadDetailModal.tsx:400`

---

## Things that look bad but are actually fine

*(All items from last pass carry forward unchanged. New items:)*

- **`ColorModal.tsx`'s `useState(getInitialPos)` vs `useLayoutEffect`** — not a render-cycle bug. The `useState` starts with whatever the anchor position is at construction time; `useLayoutEffect` immediately overwrites it before the browser paints. The UX impact is zero since both computations are identical; the only cost is a redundant function call on mount.

- **`Portal.tsx`'s inline styles for animation** — the split-panel hover-driven flex transition (`flex: 1.45 → 0.55`) cannot be expressed with Tailwind's static class system; it requires JS-driven inline style values. The heavy use of inline styles in Portal is partially justified by the animation requirements. The concern is specifically `#c8b89a` and `#f2ede4` not using tokens (F100), not the animation mechanics themselves.

- **`PipelineStagesTab.tsx` passed as purely-render component** — Settings.tsx retains all state and service calls; the sub-tabs receive everything they need as props. This is a slightly over-prop-drilled design (PipelineStagesTab gets 13 props), but it keeps the sub-tabs testable as pure rendering components, which is the right tradeoff at this codebase's current test density.

- **`ConfirmDeleteModal.tsx`'s `if (!isOpen) return null`** — because this component doesn't have an exit animation (unlike `Modal.tsx` which was built for `AnimatePresence`), conditional mounting is appropriate here. The F075 concern about Modal.tsx doesn't apply. The actual issues are the inline styles and the lack of keyboard/accessibility support (F097).

- **`settingsService.ts:234-244` fallback shim** — the double-insert path for `addPipelineStage` looks like excessive complexity but is a deliberate schema-compatibility guard for environments where `is_closed_lost` hasn't been applied yet. The `PGRST204` code check is precise. The `.includes('column')` fallback check (F101) is the only actionable issue in this block.

- **`SegmentedToggle.tsx` inline flex values** — the active/inactive background and border colors are intentionally dynamic (computed from the active state), so some inline style usage is unavoidable. The `#141414` background is the only value that could/should be a CSS variable.

---

## Open questions for the maintainer

1. **Same as the last three cycles: which `schema_*.sql` files are applied to production, in what order?** Now 20 files. The `addPipelineStage` schema-compat shim (F101's context) makes this question directly load-bearing — knowing whether `is_closed_lost` exists in production determines whether F066's cleanup is safe.

2. **Is `window.confirm()` acceptable as a permanent solution for destructive confirmations** (F096)? The existing 8 callsites use it; Agenda was built around a custom modal instead. A decision here unblocks whether to delete `ConfirmDeleteModal` or upgrade `confirmAction`.

3. **Is `AccentButton` or `Button` the canonical primary action component going forward** (F074)? `AccentButton` is used in 20 files (now expanded further by new components); `Button` in 9. The split has been open since the last audit; the answer changes which component gets tests first.

4. **Was the CI `Select.tsx` test failure (F073) known and tolerated, or unnoticed?** The `Select.tsx` was reworked this sprint — a fresh `vitest run` on main will confirm whether the rework resolved the failures or changed their nature.

5. **Is `#c8b89a` a distinct "muted beige" design token, or is it drift from `#D4C4A8`?** `Portal.tsx` uses it intentionally for a slightly warmer/darker accent against the dark background. If it's intentional, it needs a `--color-muted-beige` token in `theme.css`. If it's drift, it should collapse into `--color-beige`.

6. **`.planning/` vs `docs/superpowers/`** — still open from two prior cycles. Not re-investigated this pass.
