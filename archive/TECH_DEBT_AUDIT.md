# Tech Debt Audit — Seiki CRM

Generated: 2026-07-17 · Remediation pass: 2026-07-17 · **Repeat-run update: 2026-07-21**
Scope: full repo (`src/`, `supabase/functions/`, root-level `schema_*.sql`, CI/config, Docker). ~15,500 LOC of application TypeScript/TSX + ~1,100 LOC of edge functions + ~1,100 LOC of ad-hoc SQL.

---

## What changed since the last pass (2026-07-17 → 2026-07-21)

Two things happened between audits, neither of which was cosmetic:

1. **The 47 fixes from the remediation pass were deployed to production and live-debugged.** Not just "code changed" — `verify_jwt`, the transactional merge RPC, the LinkedIn-token column grants, and the cron auth flow were applied against the real Supabase project in a follow-up session, hit a real bug (the cron auth check was designed around `SUPABASE_SERVICE_ROLE_KEY`, which turned out not to reliably match what Supabase injects into deployed functions on this project), and were corrected to use a dedicated `CRON_SECRET` instead — confirmed working via direct `curl` tests and an actual LinkedIn post publishing successfully. This repo now reflects the corrected version. **Re-verified: zero regressions** — all 9 spot-checked fixes (ToastContext memoization, merge RPC, tasksService optimization, config.toml verify_jwt, requireUser.ts's CRON_SECRET check, the two new schema addon files, the Settings.tsx split, edgeFunctions.ts, useLoadOnMount/withLoadingState) are still intact.
2. **A full visual rebuild landed** — "Graphite Amber," a Tailwind-token-based design system (`Button`, `Badge`, `KpiTile`, rewritten `Modal`/`Sidebar`/`Select`) replacing the old global-CSS-classname approach across nearly every view, plus a `react-kanban-kit` (pre-1.0 beta) integration replacing the hand-rolled drag-and-drop kanban logic in both `Pipeline.tsx` and `Tasks.tsx`.

The second item is where this update's new findings concentrate: the migration is ~90% complete and the remaining 10% is now the most concrete, fixable debt in the repo (see F052/F053 below) — much more actionable than the old F018 ("two systems, no documented direction") ever was, because now there's a clear finish line instead of an open-ended question.

---

## Remediation status (F001–F050, prior pass)

**Confirmed still fixed and now deployed/verified live** (not just "compiles," as the last pass had to hedge): F001, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F017, F022, F023, F024, F025, F028, F029, F030, F031, F032, F033 (partial — see F058/F062 below for new test-debt items), F037, F038, F039, F040, F041, F042, F043, F044, F046, F048, F049, F050.

**Still deferred, unchanged:**
- **F002** (no migration system) — still no `supabase/migrations/`. Still needs your confirmation of what's actually applied to prod before backfilling a baseline.
- **F020** (LinkedIn tokens unencrypted) — the column-grant restriction (verified live via `pg_class.relacl`/`pg_attribute.attacl` in the debugging session) is applied and confirmed working. Full encryption-at-rest is still not done.

**F016 correction:** the *consuming-view* `as any` casts (Tasks.tsx, Pipeline.tsx, Agenda.tsx, AddLead.tsx) are fixed and stayed fixed. But this pass found `Select.tsx` itself — previously listed as "clean" in the old "looks fine" section — has 4 of its own internal `as any` casts (children-traversal logic). Not a regression, just a claim that didn't hold up under closer inspection this time. See F059.

**F018 evolved, not resolved.** The prior "two styling systems, no documented direction" finding is now "one styling system, ~90% migrated, with a documented direction (the rebuild itself) but incomplete execution." See F052/F053/F055/F056.

---

## Executive summary (current state)

- **The design-system migration has one real holdout left: `LeadDetailModal.tsx`.** It's the only file in the app still using the entire pre-rebuild CSS-class vocabulary (tabs, detail rows, buttons, badges) — everything around it (`Pipeline.tsx`, `Leads.tsx`, `DealCard`) is fully migrated. (F052)
- **`Sidebar.tsx` — the most-rendered component in the app — is 100% hardcoded hex colors in inline `style={{}}` objects**, zero Tailwind/design tokens, despite tripling in size during the rebuild. (F053)
- **`react-kanban-kit` (a `0.0.2-beta.7` pre-1.0 package) required 3 dedicated fix commits and hardcoded hex overrides to fight its default styling** — real integration friction with a library that has no semver stability guarantee, and the one behavior most at risk (does the board rebuild correctly when data changes?) is untested. (F057, F058)
- **`npm audit` now shows 10 vulnerabilities (4 high, 6 moderate)** — 100% transitive through `react-kanban-kit`'s Vue-tooling dev dependencies (`vue-tsc`/`vue-template-compiler`/`lodash`/`minimatch`), not reachable from the shipped bundle. Supply-chain/CI exposure, not production XSS — but new since the last pass, where `npm audit` was clean. (F061)
- **The live production nginx config (`nginx/seiki-crm.conf`, VM deploy) has a materially weaker security-header posture than the new, unused-in-prod Docker config** (`docker/nginx.conf`) — no CSP, no `Referrer-Policy`/`Permissions-Policy`, `X-Frame-Options: SAMEORIGIN` instead of `DENY`, deprecated `X-XSS-Protection` instead of nothing. Two configs, and the one actually serving users is the weaker one. (F060)
- **Dead code from the kanban migration**: `src/views/tasks/KanbanColumn.tsx` is fully superseded by `SeikiKanbanBoard` and imported nowhere — a clean, complete leftover, not a half-migration. (F051)
- **Docker is genuinely well-built**: non-root `nginx-unprivileged` base, `read_only`/`cap_drop: ALL`/`no-new-privileges` in compose, build ARGs correctly scoped to public `VITE_*` vars only, `.dockerignore` correctly excludes secrets — but the README doesn't mention Docker exists at all. (F063)
- **Test count is up from 28 to 57** (new: `linkedinService`, `tasksService`, `AddLead`, `Login`, `SeikiKanbanBoard`, `Sidebar`) — real progress, though the two newest UI pieces (`CalendarModal.tsx`, and `SeikiKanbanBoard`'s actual data-rebuild behavior) still have coverage gaps. (F058, F062)
- **The 8 findings that were "deploy this and it'll be fixed" in the last pass are now confirmed deployed and working**, including one genuine production bug caught and fixed live (the `CRON_SECRET` vs `SUPABASE_SERVICE_ROLE_KEY` mismatch) that no amount of code review alone would have caught — only live testing surfaced it.

---

## Architectural mental model (updated)

Unchanged from the last pass at the data/backend layer: single-page React 19 + TypeScript + Vite, no client-side router, Supabase Postgres+RLS as the only backend, ~9 flat service modules, Deno edge functions for anything needing a secret.

What's new: the frontend now has a real, named design system (`src/components/ui/{Button,Badge,KpiTile,Modal,Select,SeikiKanbanBoard}.tsx`, Tailwind `--color-*` tokens) that the large majority of views consume consistently — this is a genuine architectural improvement over the prior "every view invents its own styling" state, not just a coat of paint. The kanban board (both `Pipeline.tsx` and `Tasks.tsx`) now delegates rendering and drag-and-drop entirely to a third-party library (`react-kanban-kit`) via one wrapper component, trading "we own every line of DnD logic" for "we depend on a pre-1.0 package's stability" — a reasonable trade for velocity, but the first genuinely load-bearing external UI dependency in the app, worth watching.

Deployment now has two paths (VM via `deploy.sh`/`nginx/seiki-crm.conf`, and a new, more hardened Docker path) that have already diverged in their security headers after one iteration — worth deciding which is canonical before a third path gets added.

---

## Findings — F001-F050 (prior pass, see remediation status above for current state)

*(Table preserved for reference; see "Remediation status" section above for what's fixed/deployed/deferred. Full original descriptions unchanged from the 2026-07-17 pass.)*

| ID | Category | File:Line | Severity | Effort | Status |
|----|----------|-----------|----------|--------|--------|
| F001 | Architectural decay | `schema_supabase.sql:14-27` | Critical | S | ✅ RESOLVED |
| F002 | Architectural decay | repo root (SQL files) | Critical | L | ⏸ DEFERRED (needs your input) |
| F003 | Architectural decay | 3 addon files | High | S | ✅ RESOLVED |
| F004 | Security hygiene | `supabase/config.toml` | Critical | S | ✅ RESOLVED + deployed, verified live |
| F005 | Error handling | `leadsService.ts` | Critical | M | ✅ RESOLVED + deployed, verified live |
| F006 | Error handling | `ToastContext.tsx` | High | S | ✅ RESOLVED |
| F007 | Architectural decay | `schema_prospection_v2_functions.sql` | High | S | ✅ RESOLVED + deployed |
| F008 | Security hygiene | `resend-webhook/index.ts` | High | S | ✅ RESOLVED + deployed |
| F009 | Architectural decay | `Tasks.tsx` | High | L | ✅ RESOLVED (further simplified by react-kanban-kit migration) |
| F010 | Architectural decay | `Pipeline.tsx` | High | M | ✅ RESOLVED (now 200 lines) |
| F011 | Architectural decay | `Settings.tsx` | Medium | M | ✅ RESOLVED (confirmed survived the Graphite Amber rewrite) |
| F012 | Consistency rot | `emailsService.ts`/`contentService.ts` | Medium | M | ✅ RESOLVED |
| F013 | Consistency rot | 6 views | Medium | M | ✅ RESOLVED |
| F014 | Consistency rot | `Pipeline.tsx`/`Leads.tsx` | Medium | M | ✅ RESOLVED (Modal.tsx now has tests too) |
| F015 | Consistency rot | 8 sites | Low | S | ✅ RESOLVED |
| F016 | Type & contract debt | 7+ sites | Low | S | ✅ RESOLVED (consuming views); see F059 for Select.tsx's own casts |
| F017 | Architectural decay | `SideBar.tsx` (now `Sidebar.tsx`) | Low | S | ⏸ UNCHANGED — see F053 for the bigger issue in this file now |
| F018 | Consistency rot | styling systems | Medium | M | 🔄 EVOLVED — see F052/F053/F055/F056 |
| F019 | Security hygiene | RLS policies | Medium | L | ⏸ Intentionally not fixed (documented trade-off) |
| F020 | Security hygiene | `linkedin_accounts` tokens | High | M | 🟡 PARTIAL — column grants deployed+verified; full encryption still deferred |
| F021 | Security hygiene | cron files | Medium | M | ✅ RESOLVED (further corrected to CRON_SECRET, deployed+verified) |
| F022 | Security hygiene | `resend-webhook` CORS | Low | S | ✅ RESOLVED |
| F023 | Consistency rot | error response shapes | Low | S | ✅ RESOLVED |
| F024 | Consistency rot | Gemini call duplication | Medium | S | ✅ RESOLVED |
| F025 | Consistency rot | redirect URI duplication | Low | S | ✅ RESOLVED |
| F026 | Performance & resource hygiene | fetch timeouts | Medium | M | ✅ RESOLVED |
| F027 | Security hygiene | 5 edge functions | Medium | M | ✅ RESOLVED + deployed, verified live (with the CRON_SECRET correction) |
| F028 | Documentation drift | stale comment | Low | S | ✅ RESOLVED |
| F029/F030 | Config/dependency debt | `.env.example` | Medium | S | ✅ RESOLVED |
| F031 | Performance & resource hygiene | `tasksService.createTask` | Low | S | ✅ RESOLVED |
| F032 | Type & contract debt | `ta: any` | Low | S | ✅ RESOLVED |
| F033-F035 | Test debt | services/views/functions | High/High/Medium | L | 🟡 IMPROVED (28→57 tests) but still real gaps — see F058/F062 |
| F036 | Dependency & config debt | `npm audit` | — | — | 🔄 CHANGED — was clean, now 10 vulns via react-kanban-kit; see F061 |
| F037 | Error handling | `Prospection.tsx` rollback | Medium | S | ✅ RESOLVED |
| F038-F040 | Consistency rot | duplicated SLA/segment logic | Low | S | ✅ RESOLVED |
| F041/F042 | Type & contract debt | `any` casts | Low | S | ✅ RESOLVED |
| F043/F044 | Architectural decay | dead branches | Low | S | ✅ RESOLVED |
| F045 | Documentation drift | `.planning/` staleness | Medium | M | ✅ RESOLVED (flagged in-place) |
| F046 | Consistency rot | `execCommand` check | Low | S | ✅ RESOLVED |
| F047 | Security hygiene | iCal feed auth | Medium | S | ✅ RESOLVED (verify_jwt fixed on `calendar`) |
| F048 | Consistency rot | `deleteLead` history log | Low | S | ⏸ Unchanged (documented, not acted on) |
| F049 | Type & contract debt | redundant cast | Low | S | ✅ RESOLVED |
| F050 | Documentation drift | exhaustive-deps warnings | Low | S | ✅ RESOLVED (side effect of F013's hook extraction) |

---

## NEW findings (this pass)

| ID | Category | File:Line | Severity | Effort | Description | Recommendation |
|----|----------|-----------|----------|--------|-------------|-----------------|
| F051 | Architectural decay | `src/views/tasks/KanbanColumn.tsx` (89 lines, whole file) | Low | S | Dead code — fully superseded by `SeikiKanbanBoard`'s `renderCard` prop; confirmed not imported anywhere. A clean, complete migration leftover, not a half-migration. | Delete the file. |
| F052 | Consistency rot | `src/views/pipeline/LeadDetailModal.tsx` (238-596, throughout) | Medium | M | The one file still using the entire pre-rebuild CSS vocabulary: `modal-title`/`modal-sub`/`modal-badges-row`, `tab-row`/`mtab`/`mtab-panel`, `detail-row`/`detail-key`/`detail-val`, `bar-row`/`bar-track`/`bar-fill`, `form-grid`/`form-field`, `hist-item`/`hist-btn`, `task-item`/`task-check`, `btn btn-grad` buttons, and an ad-hoc `badge badge-${segment}` instead of the shared `Badge` — plus old CSS vars (`var(--red)`, `var(--text-muted)`) mixed with new `var(--color-amber)` tokens. Sits directly next to the fully-migrated `Pipeline.tsx`. | Migrate to Tailwind + shared `Button`/`Badge`; likely shrinks the file by 100-150 lines (verbose inline `style={{}}` objects collapse to short Tailwind classes) without touching any logic. |
| F053 | Consistency rot | `src/components/Sidebar.tsx` (194-402, throughout) | Medium | M | 438-line file (grew 3x in the rebuild, the most-rendered component in the app) is 100% inline `style={{}}` objects with hardcoded hex colors (`#0d0d0d`, `#c8b89a`, `#b0afa8`...) — zero Tailwind/design-token classes, despite `Button`/`Badge` and the `--color-*`/`bg-elevated` tokens existing and being used everywhere else in the rebuild. | Migrate to Tailwind design tokens and the shared `Button` component. |
| F054 | Architectural decay | `src/components/Sidebar.tsx:69` | Low | S | `section === "crm" ? "#c8b89a" : "#c8b89a  "` — both ternary branches resolve to the same color (one has trailing whitespace); dead branching left over from an edit. | Replace with the literal color, drop the ternary. |
| F055 | Consistency rot | `Pipeline.tsx:96-101` + 6 other views (`Codir.tsx`, `Leads.tsx`, `Settings.tsx`, `Stats.tsx`, `Tasks.tsx`, `App.tsx`) | Low | S | Loading-state blocks in all 7 files still use the old `loading-container`/`loading-spinner` global CSS classes, while the rest of each file is fully Tailwind — same half-migration pattern repeated 7 times independently. | Extract one shared `<LoadingState>` Tailwind component; swap all 7 call sites at once. |
| F056 | Architectural decay | `src/index.css` (3,381 lines) | Medium | M | Carries two parallel color-token systems (legacy `--purple`/`--gold`/`--instit` `:root` block alongside the new `--color-*` Graphite Amber tokens). Confirmed-dead selectors with zero remaining `.tsx` usages: `.logo`, `.btn-logout`, `.powered-by-seiki-footer`, `.page-header`, `.page-title`. The `.mtab`/`.detail-row`/`.hist-*`/`.task-*`/`.btn-grad` family is still genuinely consumed, solely by `LeadDetailModal.tsx` (F052). | Don't sweep yet — finish F052 first, then delete the now-fully-orphaned selector families in one pass. |
| F057 | Dependency & config debt | `package.json:20` (`"react-kanban-kit": "^0.0.2-beta.7"`) | Medium | S | Pre-1.0 beta dependency required 3 dedicated CSS-override fix commits (`46b02e8`, `6f11262`, plus inline overrides) to fight its default styling — hardcoded hex baked into `SeikiKanbanBoard.tsx`'s drag-preview/indicator/column-wrapper callbacks rather than theme-driven. Most likely breakage point if the library changes its internal DOM structure in a future pre-1.0 release (no semver guarantee), and the behavior most at risk is untested (F058). | Pin the exact version (`0.0.2-beta.7` without `^`) given the beta status and the override investment already made; document why beta.7 specifically. |
| F058 | Test debt | `src/test/SeikiKanbanBoard.test.tsx` | Low | S | Only 2 tests (renders headers/cards, one CSS-override assertion) — doesn't test `onCardMove`, `onCardClick`, column footer rendering, or whether the board actually rebuilds when `columns`/`cards` props change (the one behavior a future react-kanban-kit version bump is most likely to break). | Add a prop-change re-render test and a card-move behavior test. |
| F059 | Type & contract debt | `src/components/ui/Select.tsx:64,66,70,389` | Low | S | 4 `as any` casts in the `SelectItem` children-traversal/prop-spreading logic. Pre-existing (not a new regression), but corrects the prior audit's "Select.tsx is clean" claim in its "looks fine" section — it wasn't, on closer inspection. | Type the children-traversal helper properly; low priority given it's contained and the component has real tests. |
| F060 | Security hygiene | `nginx/seiki-crm.conf` (VM, currently live) vs `docker/nginx.conf` (new) | Medium | S | The two nginx configs have diverged: Docker's has CSP, gzip, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `server_tokens off`, a dotfile-deny block; the live VM config has none of that and still sends the deprecated `X-XSS-Protection` header instead. **The currently-deployed production instance has the weaker of the two configs.** | Port the Docker config's header block back into `nginx/seiki-crm.conf`, or retire the VM path in favor of Docker-only deployment. |
| F061 | Dependency & config debt | `package.json` (react-kanban-kit transitive deps) | Low | S | `npm audit` now reports 10 vulnerabilities (4 high, 6 moderate), 100% transitive through `react-kanban-kit@0.0.2-beta.7 → vite-plugin-dts → vue-tsc → vue-template-compiler/@microsoft/api-extractor → lodash/minimatch/ajv` — Vue build tooling pulled in by a React library with no runtime purpose. Not reachable from the shipped browser bundle (confirmed: dev/CI-time only), so risk is supply-chain/CI exposure, not production XSS. This was 0 vulnerabilities in the prior audit. | Track upstream (react-kanban-kit) for a dependency cleanup; not urgent given contained blast radius, but re-check on every future `npm audit` since this dependency now carries the entire vuln count. |
| F062 | Test debt | `src/components/CalendarModal.tsx` (216 lines) | Low | S | Zero test coverage on non-trivial pure date logic (`isDisabled`, `isSelected`, month-grid cell construction, min-date gating) — cheap to unit test without DOM/portal rendering, easy to get wrong (leap years, month-boundary offsets). | Add unit tests for the pure date-grid functions. |
| F063 | Documentation drift | `README.md` | Low | S | Zero mention of the new Docker deployment path, despite `Dockerfile`, `docker-compose.yml`, `DOCKER.md`, and `docker/nginx.conf` all existing and being genuinely well-built (non-root base, `read_only`/`cap_drop: ALL` hardening, correctly-scoped build ARGs). | Add a one-line pointer to `DOCKER.md` from the README. |
| F064 | Config/dependency debt | `.github/workflows/ci.yml:15` vs `Dockerfile:8` | Low | S | CI runs on Node 20; the Docker build is pinned to Node 24.18.0. No `engines` field ties them together, so CI never validates against the Node version that actually ships to production via Docker. | Add an `engines` field to `package.json` and align both, or bump CI's `node-version` to match the Dockerfile. |

---

## Top 5 — if you fix nothing else, fix these

### 1. Finish the styling migration on `LeadDetailModal.tsx` (F052)
This is now the single biggest source of "which system do I use" ambiguity for anyone touching the codebase — it sits right next to a fully-migrated `Pipeline.tsx` and uses none of the same patterns. Migrating it also unlocks F056 (deleting the now-orphaned legacy CSS).

### 2. Migrate `Sidebar.tsx` to design tokens (F053)
It's rendered on every single page and is currently the largest concentration of un-migrated, hardcoded-hex styling in the app — worse than a single modal, since it's always on screen.

### 3. Harden the `react-kanban-kit` dependency (F057 + F058)
A pre-1.0 beta library is now load-bearing for two core features (Pipeline board, Tasks board). Pin the exact version, and add the one missing test (does the board actually re-render when data changes?) before the next version bump surprises you.

### 4. Reconcile the two nginx configs (F060)
The config actually serving production traffic right now is the weaker one. This is a five-minute copy-paste of the header block from `docker/nginx.conf` into `nginx/seiki-crm.conf`, whichever deployment path you keep using.

### 5. Still: establish a migration baseline (F002, unchanged from last pass)
This has been open across two audit cycles now. Minimum viable version, unchanged from before:
1. Confirm against the live DB which `schema_*.sql` files are actually applied (you now have direct SQL Editor access patterns established from the recent debugging session — a quick `select * from information_schema.tables` / spot-checking a few known columns would confirm state).
2. `supabase migration new baseline`, paste the current combined schema in as migration 0001.
3. All schema changes from here forward go through `supabase migration new <name>`, not a new root-level `.sql` file — you now have 11 of those files (was 8 last pass), and it's only getting harder to reconstruct the true order from filenames alone.

---

## Quick wins

- [ ] F051 — Delete dead `src/views/tasks/KanbanColumn.tsx`
- [ ] F054 — Fix the dead ternary in `Sidebar.tsx:69`
- [ ] F057 — Pin `react-kanban-kit` to an exact version (drop the `^`)
- [ ] F060 — Copy the security-header block from `docker/nginx.conf` into `nginx/seiki-crm.conf`
- [ ] F063 — Add a Docker pointer to the README
- [ ] F064 — Add an `engines` field to `package.json`, align CI's Node version
- [ ] F059 — Remove the 4 `as any` casts in `Select.tsx`'s children-traversal logic

---

## Things that look bad but are actually fine

- **`react-kanban-kit`'s integration surface is minimal and well-isolated** — imported in exactly one file (`SeikiKanbanBoard.tsx`); no other file touches it directly. A future swap-out or major bump is a one-file change, which meaningfully de-risks F057's underlying concern even though the dependency itself is still worth pinning down.
- **`CalendarModal.tsx` duplicating `Agenda.tsx`'s iCal logic** — considered flagging this (both touch dates/calendars), but on inspection `CalendarModal.tsx` is a date-*picker* widget (month grid, day selection) with zero overlap with `Agenda.tsx`'s iCal-*export* helpers (`escapeIcal`/`foldLine`/`buildIcalContent`). No duplication; false lead.
- **The uncommitted working-tree diffs at audit time** (`App.tsx`, `Contenu.tsx`, `Sidebar.test.tsx`, the large `Agenda.tsx` rewrite) — checked for leftover debug code, broken imports, dead branches. All clean; this is genuine mid-flight WIP, not abandoned half-work. `tsc`/tests pass against it.
- **Docker's security hardening** (`read_only: true`, `cap_drop: ALL`, `no-new-privileges`, non-root `nginx-unprivileged` base, resource limits, build ARGs correctly scoped to public vars only) — genuinely solid, no notes.
- **`schema_user_names_addon.sql`'s new columns are correctly consumed** by `AuthContext.tsx`, with a sane fallback chain to `auth.user_metadata` when the `public.users` row lookup fails — no SQL/frontend drift, unlike some of the historical schema files.
- **`Button`/`Badge`/`KpiTile` adoption elsewhere is strong** — `Button` alone is used in 10 view files with real tests behind it. `LeadDetailModal.tsx` (F052) is the one holdout, not a sign the design system itself is half-baked.

---

## Open questions for the maintainer

1. **Is the Docker deployment path meant to replace the VM path, or run alongside it?** This determines whether F060 should be "sync both configs" or "delete the VM one." Given Docker's config is more complete and more recently written, it reads like the intended future — worth confirming and updating `DEPLOY_VM.md`'s status accordingly if so.
2. **Was `react-kanban-kit` evaluated against alternatives, or chosen for a specific feature (column drag-and-drop, per commit `24aeb40`) that a more mature library didn't offer?** Not second-guessing the choice — just want to know whether "beta and worth the risk" was a deliberate trade-off (in which case F057's exact-pin recommendation is the main ask) or an oversight (in which case worth a fuller alternatives check before it's even more deeply embedded).
3. **`.planning/` vs `docs/superpowers/`** — still open from the last pass. The rebuild's design docs (`docs/superpowers/plans/2026-07-*`) confirm `docs/superpowers/` is where real planning now happens; `.planning/` remains flagged-stale but not removed. Worth a final decision either way.
4. Same as last pass: **which `schema_*.sql` files are actually applied to production, in what order?** Now 11 files instead of 8 — this only gets harder to answer from memory alone as more accumulate.
