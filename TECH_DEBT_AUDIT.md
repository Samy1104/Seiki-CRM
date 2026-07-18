# Tech Debt Audit — Seiki CRM

Generated: 2026-07-17 · Remediation pass applied: 2026-07-17
Scope: full repo (`src/`, `supabase/functions/`, root-level `schema_*.sql`, CI/config). ~7,900 LOC of application TypeScript/TSX + ~1,100 LOC of edge functions + ~1,070 LOC of ad-hoc SQL.

---

## Remediation status

Every finding below was addressed in this pass except the two noted as deferred. **47 of 50 fixed in the repo**, verified after each change with `tsc -b --noEmit`, `oxlint`, `vitest run`, and `npm run build` (all clean, 28/28 tests passing — up from 19, three new test files added). 1 finding (F036) needed no action. 2 findings are deferred because they require information or access this session doesn't have.

**Deferred — needs your input, not implemented:**
- **F002** (no migration system) — establishing a `supabase/migrations/` baseline requires knowing which SQL files are actually applied to the live production DB, which only you can confirm (Top 5 item 4 still describes the recommended approach).
- **F020** (LinkedIn tokens unencrypted) — partially addressed: `schema_linkedin_security_addon.sql` now restricts `authenticated`-role column access to the token columns (defense in depth), but full encryption-at-rest (pgsodium/Vault) was left as a separate, larger effort rather than risking a half-tested crypto change.

**Fixed but needs your action to take effect (these are code/SQL changes in the repo — none of it has been deployed or run against your live Supabase project):**
- All `schema_*.sql` changes (F001, F003, F005, F007, F020, F021) need to be run against the actual database via the Supabase SQL editor, in the order the files are numbered. `schema_leads_merge_addon.sql` and `schema_linkedin_security_addon.sql` are new files.
- `supabase/config.toml`'s `verify_jwt` changes (F004) and every edge function change (F008, F012, F022–F027) need `supabase functions deploy` (or your existing deploy pipeline) to reach production.
- **F027 (auth checks) is the one change here I'd most want you to test before relying on it.** It changes what token the frontend sends to Edge Functions (real user session instead of the static anon key) and adds server-side validation — I verified it compiles and the existing test suite still passes, but I have no way to exercise real Supabase Auth login or a deployed function in this environment, so please log in and click through the LinkedIn/email-send flows once after deploying.

Everything else (all the TypeScript/React changes: god-file splits, shared abstractions, dead code removal, type fixes, doc updates) is committed to the working tree already and covered by the green `tsc`/`oxlint`/`vitest`/`build` run — no further action needed for those.

---

## Executive summary

- **The DB has no migration system.** Eight ad-hoc `schema_*.sql` files at repo root are the only record of schema history, there's no `supabase/migrations/`, and nothing tracks what's actually applied to production. `schema_supabase.sql` unconditionally `DROP TABLE ... CASCADE`s every core table — replaying it against a live DB destroys all CRM data. (F001–F003)
- **Three edge functions are very likely 401ing in production right now.** `track-email`, `calendar`, and `resend-webhook` all receive calls with no Supabase JWT (email-client pixel loads, external calendar polling, Resend's own server), yet `supabase/config.toml` only disables `verify_jwt` for the two LinkedIn OAuth functions. (F004)
- **The lead-merge flow can leave data half-merged.** `leadsService.resolveMergeProposal` does 4 sequential DB writes with no transaction — a failure between steps leaves history/tasks reassigned but the lead not yet archived, or vice versa. (F005)
- **`ToastContext`'s value is unmemoized**, so every toast fired anywhere in the app changes a reference that other components list in `useEffect` deps (e.g. `Prospection.tsx`'s validation-queue loader), causing silent extra refetches app-wide. (F006)
- **Test coverage is thin and skewed away from risk.** 5 test files cover roughly 2 of 9 services, 1 of 12 views, 0 of 10 edge functions — including zero coverage on the merge-transaction and quota-scheduling logic flagged above. CI does run lint/test/build correctly; the gap is what's under test, not the pipeline. (F033–F035)
- **Planning docs are stale and describe a different project than what shipped.** `.planning/ROADMAP.md`/`STATE.md` (last touched 2026-07-03, never updated since) list 9 unstarted phases (Sequences, SMTP, IMAP, dedup UI, SLA polish...) while 40+ commits since then shipped brand redesign, prospection rework, VM deployment, a dual-access portal, and a full LinkedIn scheduler — none of which appear in the roadmap. (F045)
- **Three god files** (`Tasks.tsx` 1,353 lines, `Pipeline.tsx` 881 lines, `Settings.tsx` 632 lines) each own rendering, CRUD, and multi-tab modal state in one component. (F009–F011)
- **The same four patterns are reimplemented 3–8 times each** instead of being shared: the manual fetch-to-edge-function call, the `loadXxxData`-on-mount try/catch, hand-rolled modal JSX, and `window.confirm` with inconsistent wording. (F012–F018)
- **A blanket `USING (true)` RLS policy applies to every table**, including one storing unencrypted LinkedIn OAuth tokens — reasonable for a ≤10-person trusted team today, but worth a named exception before the team grows. (F026, F027)
- **`npm audit` is clean (0 vulnerabilities)** and env-var documentation is 95% accurate — two undocumented vars (`ALLOWED_ORIGIN`, `RESEND_WEBHOOK_SECRET`) are exactly the ones that gate CORS and webhook-signature security. (F036, F037)

---

## Architectural mental model

Seiki CRM is a single-page React 19 + TypeScript + Vite app with no client-side router — navigation is a `currentView` string held in `App.tsx` state and passed down as props, plus a separate `activeApp` switch between three "mini-apps" (`Portal`, main CRM, `Contenu`/prospection). Backend is entirely Supabase: Postgres with RLS as the only authorization layer, `@supabase/supabase-js` called directly from ~9 flat service modules (no repository/query abstraction beyond that), and a dozen Deno edge functions for anything that needs a secret (Resend, Gemini, LinkedIn OAuth/REST) or a scheduled/cron job. There is no ORM and no migration tool — schema changes are hand-written SQL files applied manually through the Supabase SQL editor.

The product itself is two things bolted together under one shell: a fairly conventional sales CRM (pipeline/leads/tasks/agenda/stats, all "done" per `.planning/PROJECT.md`) and a separately-evolved outbound/content module (`Prospection.tsx` + `Contenu.tsx`) for AI-assisted email sequencing and LinkedIn post scheduling, which has had three rewrites in its short life (`prospection-refonte` → `prospection-simplify` → ongoing). The `.planning/` GSD scaffolding describes only the first half of that picture and was abandoned after initialization — it should not be trusted as a current source of truth (see F045).

Given the ≤10-user internal-tool context stated in `.planning/PROJECT.md`, several choices that would be red flags at scale (no router, blanket RLS policy, service-layer duplication) are reasonable trade-offs today; they're flagged below as things to revisit before they become load-bearing, not things to fix immediately.

---

## Findings

| ID | Category | File:Line | Severity | Effort | Description | Recommendation |
|----|----------|-----------|----------|--------|-------------|-----------------|
| F001 | Architectural decay | `schema_supabase.sql:14-27` | Critical | S | Unconditional `DROP TABLE ... CASCADE` on every core table (leads, users, tasks...) with no guard against running on a provisioned DB. | Add a header guard/runbook note: "fresh-install only, never re-run against prod." Better: move to a real migration tool (see F002). |
| F002 | Architectural decay | repo root (8 `schema_*.sql` files) | Critical | L | No `supabase/migrations/`, no applied-migrations ledger; ordering is inferable only from filenames/prose comments. | Adopt `supabase migration new` going forward; backfill existing files as numbered migrations once their applied state is confirmed against prod. |
| F003 | Architectural decay | `schema_prospection_addon.sql:43,46`; `schema_prospection_v2_addon.sql:38,41`; `schema_linkedin_scheduler_addon.sql:28,57,74-84` | High | S | `CREATE TABLE IF NOT EXISTS` is used, but sibling `CREATE TRIGGER`/`CREATE POLICY` statements aren't guarded — Postgres has no `IF NOT EXISTS` for triggers and errors on duplicate policy names, so replaying any of these files twice fails partway through. | Wrap each in `DROP TRIGGER IF EXISTS ...` / `DROP POLICY IF EXISTS ...` before create, matching the pattern already used correctly in `schema_prospection_v3_cleanup.sql`. |
| F004 | Security hygiene | `supabase/config.toml:416-420` | Critical | S | `verify_jwt` is only set `false` for `linkedin-oauth-start`/`linkedin-oauth-callback`. `track-email` (pixel loaded by email clients), `calendar` (iCal feed polled by external calendar apps), and `resend-webhook` (Resend's server calling in) have no entry and default to `verify_jwt = true` — none of those callers can attach a Supabase JWT. | Add `[functions.track-email]`, `[functions.calendar]`, `[functions.resend-webhook]` blocks with `verify_jwt = false`, matching the existing pattern. Verify against the deployed project's actual function settings, not just this file. |
| F005 | Error handling | `src/services/leadsService.ts:301-360` | Critical | M | `resolveMergeProposal` performs 4 sequential Supabase writes (history reassign → tasks reassign → mark source archived → log target history) with no transaction. A failure between steps leaves the merge half-applied with no rollback. | Move the merge body into a single Postgres function (`RPC`) executed in one transaction; call it via `supabase.rpc('resolve_merge_proposal', ...)`. |
| F006 | Error handling | `src/context/ToastContext.tsx:13,24` | High | S | `showToast` is redefined every render and the context value `{ showToast }` is a new object every render. Any effect that lists `showToast` in its deps (e.g. `Prospection.tsx` validation-queue loader) re-runs on every toast fired anywhere in the app, not just on mount. | Wrap `showToast` in `useCallback([])` and memoize the provider value with `useMemo`. |
| F007 | Architectural decay | `schema_prospection_v2_functions.sql:52-63` | High | S | `schedule_send()`'s day-search `LOOP ... EXIT WHEN v_used_today < v_quota` has no iteration cap. If quota ever reaches 0 (currently blocked by `min={1}` in `Settings.tsx:604`, but not enforced at the DB layer), the loop never exits and hangs the trigger that calls it on every lead insert. | Add `EXIT WHEN v_day - CURRENT_DATE > 365` (or similar) as a hard backstop independent of the UI constraint. |
| F008 | Security hygiene | `supabase/functions/resend-webhook/index.ts:54-56` | High | S | If `RESEND_WEBHOOK_SECRET` is unset, signature verification is skipped (`console.warn` only) and the webhook still processes and writes to `email_logs`/`leads`/`history`. Fails open. | Return `403` when the secret isn't configured instead of proceeding unverified. |
| F009 | Architectural decay | `src/views/Tasks.tsx` (1,353 lines, whole file) | High | L | God component: list view, kanban board, 3x near-duplicated column JSX, inline dropdown widgets, resize logic, and drag/drop all in one file. | Extract `renderAssigneeWidget`/`renderPriorityWidget`/`renderLeadWidget`/`renderDatePickerWidget` into standalone components; extract the kanban column into one parameterized `<TaskColumn status=.../>`. |
| F010 | Architectural decay | `src/views/Pipeline.tsx` (881 lines, whole file) | High | M | Kanban board + a 4-tab lead-detail modal (info/edit/history/tasks), each tab with its own handlers, all in one component. | Extract `LeadDetailModal` as its own component with one subcomponent per tab. |
| F011 | Architectural decay | `src/views/Settings.tsx` (632 lines, whole file) | Medium | M | 4 unrelated tabs (members/pipeline stages/SLA/prospection settings), each with independent form state, in one component. | Split into `MembersTab.tsx`, `PipelineStagesTab.tsx`, `SlaTab.tsx`, `ProspectionSettingsTab.tsx`. |
| F012 | Consistency rot | `src/services/emailsService.ts:110-134,137-156`; `src/services/contentService.ts:32-57,59-78` | Medium | M | 4 sites manually rebuild the same "construct URL from `import.meta.env`, set headers, `fetch`, parse JSON, check `response.ok`" edge-function-call pattern. | Extract a shared `callEdgeFunction(name, body)` helper in a new `src/services/edgeFunctions.ts`. |
| F013 | Consistency rot | `Pipeline.tsx:55-86`, `Settings.tsx:41-71`, `Agenda.tsx:91-105`, `Leads.tsx:32-51`, `Codir.tsx:22-53`, `Stats.tsx:16-30` | Medium | M | Same `try { fetch... } catch { console.error; showToast } finally { setLoading(false) }` shape hand-written 6 times. | Extract a shared `useAsyncData(fetcher)` hook. |
| F014 | Consistency rot | `Pipeline.tsx:469-877`, `Leads.tsx:293-342` | Medium | M | No shared `Modal` component exists anywhere in `src/components`; both files hand-roll identical `modal-overlay`/`modal-header`/close-button JSX. | Extract a `<Modal>` component (title, onClose, children) and migrate both call sites. |
| F015 | Consistency rot | `Tasks.tsx:230`, `Settings.tsx:144,188`, `Leads.tsx:65`, `Pipeline.tsx:153,215,289`, `Agenda.tsx:207`, `Prospection.tsx:465` | Low | S | `window.confirm` called ad hoc with different wording at 8 sites; `Prospection.tsx:465` even calls bare `confirm(...)` instead of `window.confirm`. | Extract a `confirmAction(message)` helper (or a proper confirm-dialog component) and standardize the call site. |
| F016 | Type & contract debt | `Tasks.tsx:904,1238,1327`, `Pipeline.tsx:786`, `Agenda.tsx:149,361`, `AddLead.tsx:342` | Low | S | `Select`'s `onValueChange` result is cast `as any` at 7+ sites instead of the component's generic value type being threaded through. | Make `Select`/`SelectItem` generic over the value union so `onValueChange` is typed without a cast. |
| F017 | Architectural decay | `src/components/SideBar.tsx:53-58` | Low | S | Only component doing background polling (`setInterval` every 10s for stats) regardless of tab focus; every other view relies on reload-after-mutation. | Either drop the interval in favor of reload-on-navigation, or pause it on `document.visibilitychange`. |
| F018 | Consistency rot | `Contenu.tsx`/`Prospection.tsx` (Tailwind + inline style objects) vs. `Pipeline.tsx`/`Leads.tsx`/`Settings.tsx` (global CSS classnames) | Medium | M | Two competing styling systems coexist with no documented migration direction. | Document (in `.planning/` or a README section) whether Tailwind is the target for all new views, so contributors stop guessing. |
| F019 | Security hygiene | root `authenticated_full_access` policies: `schema_supabase.sql:455-468`, `schema_prospection_addon.sql:43-44,77-78`, `schema_prospection_v2_addon.sql:38-39`, `schema_linkedin_scheduler_addon.sql:28-29,57-58` | Medium | L | Every table uses a single `USING (true) WITH CHECK (true)` policy — any authenticated user can read/write any row in any table. Reasonable for a ≤10-person trusted team, but see F020 for the one table where this is riskier. | Track as a documented, revisit-if-team-grows decision rather than silent default; no change needed today. |
| F020 | Security hygiene | `schema_linkedin_scheduler_addon.sql:25-29` | High | M | `linkedin_accounts.access_token`/`refresh_token` are stored in plaintext (comment on line 25 explicitly says protection is "RLS only"), under the same blanket policy as F019 — any team member can read any connected account's live OAuth token via PostgREST. | Encrypt at rest (`pgsodium`/Vault) or restrict this table's policy to service-role-only access, with the frontend never querying it directly. |
| F021 | Security hygiene | `schema_prospection_v2_cron.sql:19-33`, `schema_linkedin_scheduler_cron.sql:14-28` | Medium | M | Once `<SERVICE_ROLE_KEY>` is substituted at deploy time, it's embedded in plaintext inside `cron.job`'s stored `net.http_post` call, persisting unencrypted in the DB indefinitely. | Reference the key via `vault.decrypted_secrets`/`current_setting` instead of a literal in the cron job body. |
| F022 | Security hygiene | `supabase/functions/resend-webhook/index.ts:16` | Low | S | Hardcodes `Access-Control-Allow-Origin: "*"` instead of the shared, origin-restricted `_shared/cors.ts` used by every other function. | Import and use `_shared/cors.ts` for consistency, even though CORS is moot for a server-to-server webhook. |
| F023 | Consistency rot | `resend-webhook/index.ts` (plain-text error bodies) vs. every other function (`{ error: message }` JSON) | Low | S | Inconsistent error response shape across edge functions. | Standardize on JSON error bodies everywhere. |
| F024 | Consistency rot | `generate-linkedin-post/index.ts:228-274`, `learn-linkedin-style/index.ts:94-123` | Medium | S | Both independently implement "call Gemini, check `res.ok`, parse candidate, handle malformed JSON," and both hardcode `GEMINI_MODEL = "gemini-2.5-flash"` separately (line 14 in each). | Factor into `_shared/geminiApi.ts`, following the existing `_shared/linkedinApi.ts`/`_shared/sendViaResend.ts` pattern. |
| F025 | Consistency rot | `linkedin-oauth-start/index.ts:22`, `linkedin-oauth-callback/index.ts:46` | Low | S | Both independently reconstruct the redirect URI string. | Move to a shared constant/helper in `_shared/linkedinApi.ts`. |
| F026 | Performance & resource hygiene | `flush-send-queue/index.ts:84-93`, `publish-linkedin-post/index.ts:52-62` | Medium | M | No `fetch` call in any edge function sets a timeout/`AbortController`; both batch senders process rows sequentially rather than via `Promise.allSettled`, so one hung upstream call stalls the whole batch. | Add a per-request `AbortController` timeout; consider `Promise.allSettled` for independent rows. |
| F027 | Security hygiene | `send-email`, `generate-linkedin-post`, `learn-linkedin-style`, `flush-send-queue`, `publish-linkedin-post` | Medium | M | No function checks anything beyond "is this a validly-signed Supabase JWT" — the public anon key shipped in the frontend bundle is itself sufficient, since none of these call `supabase.auth.getUser()`. | Add a one-line auth/session check in each function; low urgency at ≤10 users but these trigger paid Gemini/Resend/LinkedIn calls. |
| F028 | Documentation drift | `supabase/functions/generate-linkedin-post/index.ts:13` | Low | S | Comment references `generate-email`, which was deleted from the working tree with no remaining callers. | Update or remove the comment. |
| F029 | Config/dependency debt | `supabase/.env.example` (missing `ALLOWED_ORIGIN`) | Medium | S | `_shared/cors.ts:12`'s `ALLOWED_ORIGIN` isn't documented in the example env file — a fresh environment silently gets the dev-only `localhost:5173` CORS default in production. | Add `ALLOWED_ORIGIN=` to `supabase/.env.example` with a comment. |
| F030 | Config/dependency debt | `supabase/.env.example` (missing `RESEND_WEBHOOK_SECRET`) | Medium | S | Same gap for the variable that gates F008's signature check — easy to forget, directly enabling the fail-open path. | Add `RESEND_WEBHOOK_SECRET=` to `supabase/.env.example`. |
| F031 | Performance & resource hygiene | `src/services/tasksService.ts:113-133` | Low | S | `createTask` inserts, then does a second full `select` round-trip by id to get `task_assignees` joined data, instead of returning the already-available insert result plus locally-known assignees. | Build the returned object from the insert result + the `assignee_ids` input directly; skip the refetch. |
| F032 | Type & contract debt | `src/services/tasksService.ts:40,64,127` | Low | S | `ta: any` used 3 times when mapping `task_assignees` join rows. | Type the Supabase select's inferred join shape, or define an explicit `TaskAssigneeRow` interface. |
| F033 | Test debt | `src/services/*.ts` | High | L | 2 of 9 service files have tests (`leadsService`, `linkedinService`); `tasksService`, `prospectionService`, `settingsService`, `emailsService`, `contentService`, `templatesService`, `eventsService` have none — including the non-transactional merge flow in F005. | Prioritize tests for `leadsService.resolveMergeProposal` and `prospectionService`'s quota/follow-up logic first. |
| F034 | Test debt | `src/views/*.tsx` | High | L | 1 of 12 views (`AddLead`) has tests. `Pipeline.tsx` (money/stage-change logic) and `Prospection.tsx` (`handleApproveAndSend`, F038) are the highest-risk gaps. | Add integration tests for `Pipeline.tsx` stage transitions and `Prospection.tsx`'s send/rollback path before further refactors touch them. |
| F035 | Test debt | `supabase/functions/**` | Medium | L | 0 of 10 edge functions have tests; `vite.config.ts`'s vitest block only scopes `src/` (`jsdom` environment), so Deno functions aren't reachable by the existing test runner even if tests were written. | Add a Deno test task (`deno test`) as a separate CI step; start with `_shared/sendViaResend.ts` and `_shared/linkedinApi.ts` since they're reused the most. |
| F036 | Dependency & config debt | `package.json` / `npm audit` | — (clean) | — | 0 vulnerabilities across 219 resolved dependencies. Listed for completeness, not an action item. | None needed. |
| F037 | Error handling | `src/views/Prospection.tsx:432-443` | Medium | S | `handleApproveAndSend`'s failure-rollback (`updateGeneratedEmail(...).catch(() => {})`) silently swallows its own failure. If the rollback itself fails, the email is stuck in `'approved'` state, invisible to the validation queue (which only fetches `draft`/`failed`). | Log or surface the rollback failure via `showToast`/`console.error` instead of an empty catch. |
| F038 | Consistency rot | `Codir.tsx:35-42` vs `Pipeline.tsx:68-75` | Low | S | Identical SLA-limits-parsing `forEach` duplicated verbatim. | Extract `settingsService.getSlaLimits()`. |
| F039 | Consistency rot | `Codir.tsx:71-74` vs `Pipeline.tsx:306-309` | Low | S | Identical `getSlaStatus` helper duplicated. | Move to a shared `src/utils/sla.ts`. |
| F040 | Consistency rot | `Codir.tsx:93-104` vs `Stats.tsx:70-80` | Low | S | Identical `segmentStats` reduce block duplicated. | Move to a shared stats-utils module. |
| F041 | Type & contract debt | `Codir.tsx:17` | Low | S | `useState<any[]>([])` for pipeline stages instead of `PipelineStage[]` (already correctly typed in `Pipeline.tsx:19`/`Stats.tsx:12`). | Use `PipelineStage[]`. |
| F042 | Type & contract debt | `AddLead.tsx:239` | Low | S | `criterion as any` when building score payloads. | Type against `LeadScoreDetail['criterion']`. |
| F043 | Architectural decay | `Pipeline.tsx:249-254` | Low | S | Dead no-op: `setSelectedLead(prev => { if (!prev) return null; ...; return prev; })` returns `prev` unchanged and is immediately followed by a real refetch 3 lines later. | Delete the no-op callback. |
| F044 | Architectural decay | `SideBar.tsx:92` | Low | S | `if ((item as any).isAI) btnClass += ' nav-item-ai'` — no entry in `navItems` ever sets `isAI` (only `isCodir` is used). Permanently dead branch. | Delete the dead branch. |
| F045 | Documentation drift | `.planning/STATE.md`, `.planning/ROADMAP.md` (both dated 2026-07-03, unedited since) | Medium | M | Roadmap describes 9 unstarted phases (Sequences UI, SMTP/IMAP, dedup UI, SLA polish, tests, AI scoring); actual git history since that date shipped brand redesign, prospection rework (3 iterations), VM deployment, a dual-access portal, and a LinkedIn scheduler — none reflected in the roadmap. `PROJECT.md`'s "Hébergement" section also doesn't mention the VM deployment (`deploy.sh`, `nginx/`, `DEPLOY_VM.md`) that now exists. | Either update `.planning/` to reflect what actually shipped, or explicitly mark it abandoned/superseded so future readers (including AI assistants) don't plan against it. |
| F046 | Consistency rot | `Agenda.tsx:127-140` | Low | S | `handleCopyFeedUrl`'s `document.execCommand('copy')` fallback has no success check; the success toast fires unconditionally. | Check the boolean return of `execCommand` before toasting success. |
| F047 | Security hygiene | `Agenda.tsx:71` + `calendar` edge function (see F004) | Medium | S | The iCal feed URL handed out for calendar-app subscription is a long-lived, effectively unauthenticated bearer of calendar data once `verify_jwt` is fixed per F004 to allow the calls through at all. | Confirm the `calendar` function itself validates a feed-specific token/secret, not just "any request gets through." |
| F048 | Consistency rot | `leadsService.ts` (`createLead`/`updateLead`/`resolveMergeProposal` log to `history`) vs `deleteLead` (`leadsService.ts:213-219`, no history log) | Low | S | `deleteLead` is the only mutating lead operation that doesn't write a `history` entry, unlike every sibling method. | Decide if hard-delete should log to history (on the target, if merged) or document why it's intentionally silent. |
| F049 | Type & contract debt | `leadsService.ts:298` | Low | S | `return (data || []) as any[];` in `getMergeProposals` despite `MergeProposal[]` already being the declared return type. | Remove the redundant `as any[]` cast. |
| F050 | Documentation drift | `.oxlintrc.json` vs actual lint output | Low | S | 8 `react-hooks(exhaustive-deps)` warnings currently pass CI unaddressed (`Stats.tsx:24`, `Leads.tsx:50`, `Codir.tsx:52`, `Agenda.tsx:104`, `Settings.tsx:70`, `Pipeline.tsx:85,332-333`) since oxlint warnings don't fail the build. | Either fix the deps (wrap loaders in `useCallback`) or explicitly suppress with a comment explaining why, so real regressions aren't lost in noise. |

*(50 findings; the two subagent passes additionally surfaced supporting detail folded into the entries above rather than kept as separate rows to avoid padding.)*

---

## Top 5 — if you fix nothing else, fix these

### 1. Confirm and fix `verify_jwt` for the three unauthenticated-caller functions (F004)
This may already be causing silent production failures — check the deployed Supabase project's function settings (not just this repo's `config.toml`) first.
```toml
# supabase/config.toml
[functions.track-email]
verify_jwt = false

[functions.calendar]
verify_jwt = false

[functions.resend-webhook]
verify_jwt = false
```
Redeploy and confirm each of the three receives real traffic (pixel loads, calendar polls, Resend callbacks) without 401s.

### 2. Wrap the lead-merge into one transaction (F005)
Sketch — move the 4-step body from `leadsService.resolveMergeProposal` into a Postgres function:
```sql
CREATE OR REPLACE FUNCTION public.resolve_merge_proposal(p_proposal_id UUID, p_status TEXT, p_resolver_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_proposal RECORD;
BEGIN
  SELECT * INTO v_proposal FROM lead_merge_proposals WHERE id = p_proposal_id;
  UPDATE lead_merge_proposals SET status = p_status, resolved_by = p_resolver_id, resolved_at = now() WHERE id = p_proposal_id;
  IF p_status = 'approved' THEN
    UPDATE history SET lead_id = v_proposal.target_lead_id WHERE lead_id = v_proposal.source_lead_id;
    UPDATE tasks SET lead_id = v_proposal.target_lead_id WHERE lead_id = v_proposal.source_lead_id;
    UPDATE leads SET merged_into_id = v_proposal.target_lead_id, is_archived = true WHERE id = v_proposal.source_lead_id;
    INSERT INTO history (lead_id, action_type, content, metadata)
      VALUES (v_proposal.target_lead_id, 'merge', 'Lead fusionné...', jsonb_build_object('merged_lead_id', v_proposal.source_lead_id));
  END IF;
END; $$;
```
Then in `leadsService.ts`: `await supabase.rpc('resolve_merge_proposal', { p_proposal_id: proposalId, p_status: status, p_resolver_id: resolverId });` — all-or-nothing by construction.

### 3. Memoize `ToastContext` (F006)
```tsx
// src/context/ToastContext.tsx
const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
  const id = ++nextId.current;
  setToast({ id, message, type });
  setTimeout(() => setToast((current) => (current?.id === id ? null : current)), 3000);
}, []);

const value = useMemo(() => ({ showToast }), [showToast]);

return <ToastContext.Provider value={value}>...</ToastContext.Provider>;
```
This alone removes a class of "why did this refetch just now" bugs across every view that lists `showToast` in a dependency array.

### 4. Establish a real migration path before the next schema change (F001–F003)
Minimum viable fix, in order:
1. Add a one-line guard comment + a `\prompt`-style confirmation step to `schema_supabase.sql` documenting "fresh install only."
2. Run `supabase migration new baseline` and paste the *current, already-applied* combined schema in as migration 0001, so `supabase db push`/`diff` has a starting point.
3. All schema changes from this point forward go through `supabase migration new <name>`, not a new root-level `.sql` file.

### 5. Add the iteration cap to `schedule_send()` (F007)
```sql
LOOP
  SELECT count(*) INTO v_used_today FROM ...;
  EXIT WHEN v_used_today < v_quota;
  EXIT WHEN v_day - CURRENT_DATE > 365; -- hard backstop, independent of UI validation
  v_day := v_day + 1;
END LOOP;
```
Cheap insurance against a function that's invoked automatically on every lead insert in auto-mode.

---

## Quick wins

- [x] F004 — Add `verify_jwt = false` for `track-email`, `calendar`, `resend-webhook` in `supabase/config.toml` *(needs deploy)*
- [x] F008 — Make `resend-webhook` fail closed (403) when `RESEND_WEBHOOK_SECRET` is unset *(needs deploy)*
- [x] F007 — Add hard iteration cap to `schedule_send()`'s day-search loop *(needs SQL applied to prod)*
- [x] F006 — Memoize `showToast` and the `ToastContext` provider value
- [x] F029 / F030 — Add `ALLOWED_ORIGIN` and `RESEND_WEBHOOK_SECRET` to `supabase/.env.example`
- [x] F003 — Add `DROP TRIGGER/POLICY IF EXISTS` guards to the 3 non-idempotent addon SQL files *(needs SQL applied to prod)*
- [x] F037 — Log (don't swallow) the rollback failure in `Prospection.tsx`'s `handleApproveAndSend`
- [x] F043 / F044 — Delete the two confirmed-dead branches in `Pipeline.tsx:249-254` and `SideBar.tsx:92`
- [x] F028 — Fix the stale `generate-email` comment in `generate-linkedin-post/index.ts:13`
- [x] F049 — Drop the redundant `as any[]` cast in `leadsService.ts:298`

---

## Things that look bad but are actually fine

- **The blanket `USING (true)` RLS policy on every table (F019).** Looks like a security smell at first glance, but for a ≤10-person internal sales team where everyone is meant to see everything, row-level restriction would add complexity with no real access-control benefit today. Worth revisiting only if the team grows past "everyone trusts everyone," or for the one table that stores secrets (F020).
- **No SPA router.** `currentView` state + prop drilling in `App.tsx` looks primitive, but `.planning/STATE.md` already flags this as a deliberate choice to revisit past 10 views — there are 8 today, and nothing in the audit found actual pain from it (no prop-drilling depth beyond one level, no view that needs deep-linking).
- **`_shared/linkedinApi.ts` and `_shared/sendViaResend.ts`.** These are the two edge-function helpers that *are* properly factored — token exchange/refresh, image upload, and Resend sending are each centralized and correctly reused. They're the template the duplicated Gemini logic (F024) should follow, not more debt themselves.
- **Two competing styling systems (Tailwind in `Contenu`/`Prospection`, global CSS elsewhere) (F018).** Flagged as consistency rot above, but it's not urgent: `Tailwind v4 scoped to the Prospection page` was an explicit, documented decision (commit `23c89ed`) for a page that needed faster iteration, not an accident. Worth a written direction, not a rewrite.
- **`Select.tsx`, `ErrorBoundary.tsx`, `Login.tsx`.** All three were read in full and are clean: `Select` has full keyboard nav/ARIA and a test file, `ErrorBoundary` is a minimal correctly-scoped class component, `Login.tsx` sets `autoComplete` correctly for password managers. No findings.
- **`npm audit` being clean (F036).** Genuinely nothing to do here — worth stating explicitly so it isn't re-checked next audit cycle for no reason.

---

## Open questions for the maintainer

1. **Is `.planning/` still meant to be used going forward, or has GSD-style planning been abandoned in favor of ad-hoc design docs in `docs/superpowers/`?** The latter clearly became the real planning artifact (6 design+plan doc pairs since July 6), but nothing marks `.planning/` as deprecated.
2. **Which `schema_*.sql` files are actually applied to the production Supabase project, and in what order?** This audit could only infer intent from filenames/comments — worth confirming against the live DB before backfilling a migrations baseline (Top 5, item 4).
3. **Is the blanket RLS policy (F019) intentional long-term, or a placeholder from initial scaffolding?** `.planning/PROJECT.md:62` calls it "suffisant pour M1" (sufficient for milestone 1) — implying it was always meant to be revisited, not a permanent decision.
4. **Is the Tailwind-only `Prospection`/`Contenu` styling meant to eventually replace the global-CSS approach everywhere, or stay scoped to those two pages permanently?**
5. **Was `generate-email`'s deletion (uncommitted at audit time) a deliberate replacement by the newer `send-email` + `flush-send-queue` flow, or a WIP removal that still needs a follow-up commit message explaining why?** No live code references it, so it's safe to finish removing, but worth confirming intent before committing.
