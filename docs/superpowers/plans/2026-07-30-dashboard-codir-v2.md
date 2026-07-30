# Dashboard CODIR v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Dashboard's stage-tracking foundation (structured stage history, real CODIR meetings table, disqualified-lead flag) and use it to ship Vue par Statut (snapshot + delta vs last CODIR), Vue Cohorte (monthly heatmap), and click-to-drill-down, while keeping the existing Outreach and Tasks tabs untouched.

**Architecture:** A DB-level trigger on `leads.stage_id` writes to a new `lead_stage_history` table, replacing the current unreliable app-level logging (drag-and-drop on the Kanban board never wrote history at all — see spec §1). `codir_meetings` replaces the `app_settings` JSON blob used for CODIR dates. All new point-in-time/cohort/velocity math lives in `dashboardCalculations.ts` as pure, unit-tested functions operating on plain arrays (no Supabase mocking needed for the math itself); `pipelineHistoryService.ts` and `settingsService.ts` stay thin I/O wrappers. `Dashboard.tsx` fetches the new tables once (same `Promise.all` pattern it already uses) and computes a single current/comparison period window via `computePeriodWindows`, replacing the old dual CODIR-or-custom A/B header. Crucially, the four tab components (`DashboardCodirTab`, `DashboardPipelineTab`, `DashboardOutreachTab`, `DashboardTasksTab`) keep their existing prop names (`leadsA`, `leadsB`, `historyA`, `historyB`, `emailLogsA`, `emailLogsB`, `startDateA`, `endDateA`) — only what `Dashboard.tsx` computes for them changes (period-window filtering instead of cumulative-to-date). This means Outreach and Tasks require zero code changes, and each tab task stays independently buildable.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Lucide React, `motion/react`, Vitest, `@testing-library/react`, Supabase Client (`@supabase/supabase-js`).

## Global Constraints
- French UI only — every label, button, and heading is in French.
- No regression on existing Pipeline Kanban drag-and-drop, Leads, Prospection, or Tasks features.
- Follow the existing "Graphite Amber" theme: `#0d0d0d`/`#141414`/`#1e1e1e` backgrounds, `#D4C4A8` accent, `#f2ede4` text, `text-ink-soft`/`text-ink-faint` for secondary text, `border-line` borders, `rounded-2xl` cards.
- Schema changes are hand-applied SQL files under `archive/schema_*_addon.sql` (no Supabase CLI migrations tracked in this repo) — do not create a `supabase/migrations` folder.
- Every service change must keep `npx tsc --noEmit` passing before moving to the next task.
- Commit with `rtk git add` / `rtk git commit` (repo convention, see prior plans).

---

### Task 1: Schema Addon — `lead_stage_history`, DB Trigger, `codir_meetings`, `is_disqualified`

**Files:**
- Create: `archive/schema_dashboard_v2_addon.sql`

**Interfaces:**
- Consumes: existing `public.leads`, `public.pipeline_stages`, `public.app_settings` tables.
- Produces: `public.lead_stage_history` table, `public.codir_meetings` table, `public.leads.is_disqualified` column — consumed by Task 2 (`pipelineHistoryService`) and Task 3 (`settingsService`).

- [ ] **Step 1: Write the SQL addon script**

```sql
-- ============================================================
-- SEIKI CRM — Add-on Dashboard CODIR v2
-- À appliquer dans : Supabase > SQL Editor
-- ============================================================

-- 1. Historique structuré des transitions d'étape
CREATE TABLE IF NOT EXISTS public.lead_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    from_stage_id UUID NULL REFERENCES public.pipeline_stages(id),
    to_stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead ON public.lead_stage_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_to_stage ON public.lead_stage_history(to_stage_id);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_changed_at ON public.lead_stage_history(changed_at);

COMMENT ON TABLE public.lead_stage_history IS 'Trace chaque transition de stage_id sur leads, écrite par trigger DB (voir trg_log_lead_stage_change) — remplace le logging applicatif incomplet (Kanban drag-and-drop ne loggait rien).';

-- 2. Trigger DB-level : capture TOUT changement de stage_id
CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id)
     OR (TG_OP = 'INSERT' AND NEW.stage_id IS NOT NULL) THEN
    INSERT INTO public.lead_stage_history (lead_id, from_stage_id, to_stage_id, changed_at)
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage_id ELSE NULL END,
      NEW.stage_id,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_lead_stage_change ON public.leads;
CREATE TRIGGER trg_log_lead_stage_change
  AFTER INSERT OR UPDATE OF stage_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_lead_stage_change();

-- 3. Table dédiée pour les réunions CODIR (remplace app_settings.codir_history)
CREATE TABLE IF NOT EXISTS public.codir_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    label VARCHAR(255) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Migration des dates existantes depuis app_settings.codir_history
INSERT INTO public.codir_meetings (meeting_date, label)
SELECT (d)::timestamptz, 'Migré depuis app_settings'
FROM public.app_settings, LATERAL jsonb_array_elements_text(value->'dates') AS d
WHERE key = 'codir_history'
ON CONFLICT DO NOTHING;

-- 4. Flag de disqualification, indépendant de l'étape pipeline
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_disqualified BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.is_disqualified IS 'Exclut le lead des calculs analytiques (cohortes, volumes, conversions) sans le confondre avec Perdu';
```

- [ ] **Step 2: Apply the script**

Run in Supabase SQL Editor (Dashboard → SQL Editor → paste → Run). Expected: no errors, "Success. No rows returned" (except the migration `INSERT`, which reports the row count migrated from `app_settings`, possibly 0 if no CODIR dates were saved yet).

- [ ] **Step 3: Manually verify the trigger fires**

Run in SQL Editor:

```sql
-- Pick any existing lead and stage, then:
UPDATE public.leads SET stage_id = (SELECT id FROM public.pipeline_stages LIMIT 1) WHERE id = (SELECT id FROM public.leads LIMIT 1);
SELECT * FROM public.lead_stage_history ORDER BY changed_at DESC LIMIT 1;
```

Expected: one row appears with the lead's `id` as `lead_id` and the chosen stage as `to_stage_id`.

- [ ] **Step 4: Commit**

```bash
rtk git add archive/schema_dashboard_v2_addon.sql
rtk git commit -m "feat: add lead_stage_history, codir_meetings, is_disqualified schema"
```

---

### Task 2: `pipelineHistoryService.ts` — Stage History Fetch

**Files:**
- Create: `src/services/pipelineHistoryService.ts`
- Test: `src/services/pipelineHistoryService.test.ts`

**Interfaces:**
- Consumes: `supabaseClient.ts` (`supabase.from`).
- Produces: `LeadStageHistoryEntry` type (`id`, `lead_id`, `from_stage_id`, `to_stage_id`, `changed_at`), `pipelineHistoryService.getStageHistory(limit?: number): Promise<LeadStageHistoryEntry[]>` — consumed by Task 8 (`Dashboard.tsx`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/pipelineHistoryService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, builder } = vi.hoisted(() => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  const fromMock = vi.fn(() => builder);
  return { fromMock, builder };
});

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}));

import { pipelineHistoryService } from './pipelineHistoryService';

describe('pipelineHistoryService.getStageHistory', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.select.mockClear();
    builder.order.mockClear();
    builder.limit.mockClear();
  });

  it('queries lead_stage_history ordered by changed_at ascending with a limit', async () => {
    builder.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: '1', lead_id: 'l1', from_stage_id: null, to_stage_id: 's1', changed_at: '2026-07-01T00:00:00Z' }], error: null });

    const result = await pipelineHistoryService.getStageHistory();

    expect(fromMock).toHaveBeenCalledWith('lead_stage_history');
    expect(builder.order).toHaveBeenCalledWith('changed_at', { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(5000);
    expect(result).toHaveLength(1);
    expect(result[0].to_stage_id).toBe('s1');
  });

  it('accepts a custom limit', async () => {
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
    await pipelineHistoryService.getStageHistory(1000);
    expect(builder.limit).toHaveBeenCalledWith(1000);
  });

  it('returns an empty array when data is null', async () => {
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
    const result = await pipelineHistoryService.getStageHistory();
    expect(result).toEqual([]);
  });

  it('throws when the query errors', async () => {
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: new Error('boom') });
    await expect(pipelineHistoryService.getStageHistory()).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/services/pipelineHistoryService.test.ts`
Expected: FAIL — `Cannot find module './pipelineHistoryService'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/services/pipelineHistoryService.ts
import { supabase } from './supabaseClient';

export interface LeadStageHistoryEntry {
  id: string;
  lead_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  changed_at: string;
}

export const pipelineHistoryService = {
  async getStageHistory(limit = 5000): Promise<LeadStageHistoryEntry[]> {
    const { data, error } = await supabase
      .from('lead_stage_history')
      .select('*')
      .order('changed_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/services/pipelineHistoryService.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/services/pipelineHistoryService.ts src/services/pipelineHistoryService.test.ts
rtk git commit -m "feat: add pipelineHistoryService.getStageHistory"
```

---

### Task 3: `settingsService.ts` — `codir_meetings` + `DashboardTargetsSettings.tsx` consumer

**Files:**
- Modify: `src/services/settingsService.ts:68-70` (interface), `:342-364` (`getCodirHistory`/`addCodirDate`)
- Modify: `src/views/settings/DashboardTargetsSettings.tsx:15,27,30,50-59,141-150`
- Test: `src/services/settingsService.test.ts` (new file)

**Interfaces:**
- Consumes: `supabaseClient.ts`.
- Produces: `CodirMeeting` type (`id`, `meeting_date`, `label`), `settingsService.getCodirHistory(): Promise<CodirMeeting[]>`, `settingsService.addCodirDate(dateIso?: string, label?: string): Promise<CodirMeeting[]>` — consumed by Task 7 (`DashboardHeader.tsx`) and Task 8 (`Dashboard.tsx`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/settingsService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, builder } = vi.hoisted(() => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn();
  builder.insert = vi.fn(() => builder);
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
  const fromMock = vi.fn(() => builder);
  return { fromMock, builder };
});

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}));

import { settingsService } from './settingsService';

describe('settingsService.getCodirHistory', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.select.mockClear();
    builder.order.mockClear();
    builder.maybeSingle.mockReset();
    builder.insert.mockClear();
  });

  it('queries codir_meetings ordered by meeting_date ascending', async () => {
    builder.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: 'm1', meeting_date: '2026-07-15T00:00:00Z', label: null }], error: null });

    const result = await settingsService.getCodirHistory();

    expect(fromMock).toHaveBeenCalledWith('codir_meetings');
    expect(builder.order).toHaveBeenCalledWith('meeting_date', { ascending: true });
    expect(result).toEqual([{ id: 'm1', meeting_date: '2026-07-15T00:00:00Z', label: null }]);
  });

  it('returns an empty array when data is null', async () => {
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
    const result = await settingsService.getCodirHistory();
    expect(result).toEqual([]);
  });
});

describe('settingsService.addCodirDate', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.insert.mockClear();
    builder.select.mockClear();
    builder.order.mockClear();
  });

  it('inserts a new codir_meetings row and returns the refreshed list', async () => {
    let call = 0;
    builder.then = (resolve: (v: unknown) => void) => {
      call += 1;
      if (call === 1) return resolve({ data: null, error: null }); // insert
      return resolve({
        data: [{ id: 'm1', meeting_date: '2026-07-30T00:00:00.000Z', label: null }],
        error: null,
      }); // getCodirHistory refetch
    };

    const result = await settingsService.addCodirDate('2026-07-30T00:00:00.000Z');

    expect(fromMock).toHaveBeenCalledWith('codir_meetings');
    expect(builder.insert).toHaveBeenCalledWith([{ meeting_date: '2026-07-30T00:00:00.000Z', label: null }]);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/services/settingsService.test.ts`
Expected: FAIL — `getCodirHistory` still returns `string[]` shape / `codir_meetings` never queried (queries `app_settings` instead).

- [ ] **Step 3: Update the interface and methods in `settingsService.ts`**

Replace the `CodirHistory` interface (`settingsService.ts:68-70`):

```typescript
export interface CodirMeeting {
  id: string;
  meeting_date: string;
  label: string | null;
}
```

Replace `getCodirHistory`/`addCodirDate` (`settingsService.ts:342-364`):

```typescript
  async getCodirHistory(): Promise<CodirMeeting[]> {
    const { data, error } = await supabase
      .from('codir_meetings')
      .select('id, meeting_date, label')
      .order('meeting_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async addCodirDate(dateIso?: string, label: string | null = null): Promise<CodirMeeting[]> {
    await supabase.from('codir_meetings').insert([
      { meeting_date: dateIso || new Date().toISOString(), label },
    ]);
    return this.getCodirHistory();
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/services/settingsService.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Update `DashboardTargetsSettings.tsx` for the new `CodirMeeting[]` shape**

`DashboardTargetsSettings.tsx:15` — change state type:

```typescript
  const [codirMeetings, setCodirMeetings] = useState<CodirMeeting[]>([]);
```

Add the import (`DashboardTargetsSettings.tsx:3`):

```typescript
import type { DashboardTargets, CodirMeeting } from '../../services/settingsService';
```

`DashboardTargetsSettings.tsx:23-36` — update `loadData`:

```typescript
  const loadData = async () => {
    try {
      const [t, d] = await Promise.all([
        settingsService.getDashboardTargets(),
        settingsService.getCodirHistory(),
      ]);
      setTargets(t);
      setCodirMeetings(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
```

`DashboardTargetsSettings.tsx:50-59` — update `handleAddTodayCodir`:

```typescript
  const handleAddTodayCodir = async () => {
    try {
      const updated = await settingsService.addCodirDate();
      setCodirMeetings(updated);
      showToast('Date de CODIR enregistrée !', 'success');
    } catch (err) {
      showToast("Erreur lors de l'enregistrement du CODIR", 'error');
    }
  };
```

`DashboardTargetsSettings.tsx:127-152` — update the render block (replace `codirDates.length`/`codirDates.map`):

```typescript
      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#f2ede4]">
            <Calendar className="w-4 h-4 text-[#D4C4A8]" />
            Historique des réunions CODIR ({codirMeetings.length})
          </div>
          <button
            onClick={handleAddTodayCodir}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e1e] border border-line text-xs font-medium text-[#D4C4A8] rounded-lg hover:bg-[#252525] transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Enregistrer le CODIR d'aujourd'hui
          </button>
        </div>
        {codirMeetings.length === 0 ? (
          <p className="text-xs text-ink-faint italic">Aucune date enregistrée. Cliquez ci-dessus pour marquer votre premier CODIR.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {codirMeetings.map((meeting) => (
              <span key={meeting.id} className="px-2.5 py-1 bg-[#1e1e1e] border border-line text-xs text-[#f2ede4] rounded-md font-mono">
                {meeting.meeting_date.slice(0, 10)}
              </span>
            ))}
          </div>
        )}
      </div>
```

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
rtk git add src/services/settingsService.ts src/services/settingsService.test.ts src/views/settings/DashboardTargetsSettings.tsx
rtk git commit -m "feat: move CODIR history from app_settings blob to codir_meetings table"
```

---

### Task 4: `leadsService.ts` — Exclude Disqualified Leads from Analytics

**Files:**
- Modify: `src/services/leadsService.ts:32-62` (`Lead` interface), `:77-91` (`getLeads`)
- Test: `src/services/leadsService.test.ts`

**Interfaces:**
- Consumes: `supabaseClient.ts`.
- Produces: `Lead.is_disqualified: boolean`, `leadsService.getLeads(archived?: boolean, includeDisqualified?: boolean): Promise<Lead[]>` — consumed by Task 8 (`Dashboard.tsx`).

- [ ] **Step 1: Write the failing test**

Append to `src/services/leadsService.test.ts`:

```typescript
describe('leadsService.getLeads', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.select.mockClear();
    builder.eq.mockClear();
    builder.order.mockClear();
  });

  it('excludes disqualified leads by default', async () => {
    builder.then = undefined;
    builder.order.mockReturnValue(Promise.resolve({ data: [], error: null }));

    await leadsService.getLeads();

    expect(builder.eq).toHaveBeenCalledWith('is_archived', false);
    expect(builder.eq).toHaveBeenCalledWith('is_disqualified', false);
  });

  it('includes disqualified leads when includeDisqualified is true', async () => {
    builder.order.mockReturnValue(Promise.resolve({ data: [], error: null }));

    await leadsService.getLeads(false, true);

    expect(builder.eq).not.toHaveBeenCalledWith('is_disqualified', false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/services/leadsService.test.ts`
Expected: FAIL — `getLeads` never calls `.eq('is_disqualified', ...)`.

- [ ] **Step 3: Add `is_disqualified` to the `Lead` interface**

`leadsService.ts:51` — insert after `is_archived: boolean;`:

```typescript
  is_disqualified: boolean;
```

- [ ] **Step 4: Update `getLeads` to filter on it**

Replace `leadsService.ts:77-91`:

```typescript
  async getLeads(archived = false, includeDisqualified = false): Promise<Lead[]> {
    let query = supabase
      .from('leads')
      .select(`
        *,
        owner:team_members!owner_id(*),
        stage:pipeline_stages!stage_id(*)
      `)
      .eq('is_archived', archived)
      .is('merged_into_id', null);

    if (!includeDisqualified) {
      query = query.eq('is_disqualified', false);
    }

    const { data, error } = await query.order('score', { ascending: false });

    if (error) throw error;
    return data || [];
  },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/services/leadsService.test.ts`
Expected: PASS (all `leadsService` tests, including the 2 new ones).

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add src/services/leadsService.ts src/services/leadsService.test.ts
rtk git commit -m "feat: exclude disqualified leads from getLeads by default"
```

---

### Task 5: `dashboardCalculations.ts` — Period Windows, Stage Snapshot, Cohorts, Velocity

**Files:**
- Modify: `src/utils/dashboardCalculations.ts` (append)
- Test: `src/utils/dashboardCalculations.test.ts` (append)

**Interfaces:**
- Consumes: nothing external (pure functions over plain data).
- Produces:
  - `PeriodPreset = 'since_last_codir' | 'last_two_codirs' | 'month' | 'quarter' | 'year' | 'custom'`
  - `PeriodWindow { start: string; end: string }`
  - `ComparisonWindows { current: PeriodWindow; comparison: PeriodWindow }`
  - `CodirMeetingLike { meeting_date: string }`
  - `computePeriodWindows(preset, codirMeetings, now, custom?): ComparisonWindows`
  - `isWithinWindow(dateStr: string, window: PeriodWindow): boolean`
  - `LeadStageHistoryEntryLike { lead_id: string; to_stage_id: string; changed_at: string }`
  - `reconstructStageSnapshot(history, atIso): Record<string, string>`
  - `countByStage(snapshot): Record<string, number>`
  - `CohortLeadInput { id: string; created_at: string; is_disqualified?: boolean }`
  - `CohortStageCell { stageId: string; reachedCount: number; percent: number; leadIds: string[] }`
  - `CohortRow { monthKey: string; monthLabel: string; totalLeads: number; cells: CohortStageCell[] }`
  - `computeCohortMatrix(leads, history, stages): CohortRow[]`
  - `VelocityLeadInput { id: string; created_at: string; stage_id: string; stage_changed_at: string }`
  - `computeVelocityDays(leads, history, wonStageId): number`

  All consumed by Task 8 (`Dashboard.tsx`), Task 9 (`DashboardCodirTab.tsx`), Task 10 (`DashboardPipelineTab.tsx`), Task 11 (`CohortHeatmap.tsx`).

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/dashboardCalculations.test.ts`:

```typescript
import {
  computePeriodWindows,
  isWithinWindow,
  reconstructStageSnapshot,
  countByStage,
  computeCohortMatrix,
  computeVelocityDays,
} from './dashboardCalculations';

describe('computePeriodWindows', () => {
  const now = new Date('2026-07-30T12:00:00.000Z');

  it('since_last_codir: current runs from last meeting to now, comparison is the prior CODIR-to-CODIR window', () => {
    const meetings = [{ meeting_date: '2026-06-01T00:00:00.000Z' }, { meeting_date: '2026-07-15T00:00:00.000Z' }];
    const { current, comparison } = computePeriodWindows('since_last_codir', meetings, now);
    expect(current).toEqual({ start: '2026-07-15T00:00:00.000Z', end: now.toISOString() });
    expect(comparison).toEqual({ start: '2026-06-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' });
  });

  it('since_last_codir: falls back to a 30/60-day window when no meetings exist', () => {
    const { current, comparison } = computePeriodWindows('since_last_codir', [], now);
    expect(current.end).toBe(now.toISOString());
    expect(new Date(current.start).getTime()).toBeLessThan(now.getTime());
    expect(new Date(comparison.start).getTime()).toBeLessThan(new Date(comparison.end).getTime());
  });

  it('last_two_codirs: current is N-1..N, comparison is N-2..N-1', () => {
    const meetings = [
      { meeting_date: '2026-05-01T00:00:00.000Z' },
      { meeting_date: '2026-06-01T00:00:00.000Z' },
      { meeting_date: '2026-07-15T00:00:00.000Z' },
    ];
    const { current, comparison } = computePeriodWindows('last_two_codirs', meetings, now);
    expect(current).toEqual({ start: '2026-06-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' });
    expect(comparison).toEqual({ start: '2026-05-01T00:00:00.000Z', end: '2026-06-01T00:00:00.000Z' });
  });

  it('month: current is month-to-date, comparison is the full previous month', () => {
    const { current, comparison } = computePeriodWindows('month', [], now);
    expect(current.start).toBe('2026-07-01T00:00:00.000Z');
    expect(current.end).toBe(now.toISOString());
    expect(comparison.start).toBe('2026-06-01T00:00:00.000Z');
    expect(new Date(comparison.end).getUTCMonth()).toBe(5); // June
  });

  it('quarter: current quarter start is the 1st of the quarter month', () => {
    const { current } = computePeriodWindows('quarter', [], now);
    expect(current.start).toBe('2026-07-01T00:00:00.000Z');
  });

  it('year: current year start is Jan 1st', () => {
    const { current, comparison } = computePeriodWindows('year', [], now);
    expect(current.start).toBe('2026-01-01T00:00:00.000Z');
    expect(comparison.start).toBe('2025-01-01T00:00:00.000Z');
  });

  it('custom: comparison window is an equal-length window immediately before start', () => {
    const { current, comparison } = computePeriodWindows('custom', [], now, {
      start: '2026-07-01T00:00:00.000Z',
      end: '2026-07-15T00:00:00.000Z',
    });
    expect(current).toEqual({ start: '2026-07-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' });
    expect(comparison.end).toBe('2026-06-30T23:59:59.999Z');
    // 14-day span before the start
    expect(comparison.start).toBe('2026-06-17T00:00:00.000Z');
  });
});

describe('isWithinWindow', () => {
  it('returns true for a date inside the window', () => {
    expect(isWithinWindow('2026-07-10T00:00:00.000Z', { start: '2026-07-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' })).toBe(true);
  });

  it('returns false for a date outside the window', () => {
    expect(isWithinWindow('2026-08-01T00:00:00.000Z', { start: '2026-07-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' })).toBe(false);
  });

  it('returns false for an invalid date string', () => {
    expect(isWithinWindow('not-a-date', { start: '2026-07-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' })).toBe(false);
  });
});

describe('reconstructStageSnapshot', () => {
  it('picks the latest transition at or before the target date per lead', () => {
    const history = [
      { lead_id: 'l1', to_stage_id: 'prospect', changed_at: '2026-07-01T00:00:00.000Z' },
      { lead_id: 'l1', to_stage_id: 'demo', changed_at: '2026-07-10T00:00:00.000Z' },
      { lead_id: 'l1', to_stage_id: 'won', changed_at: '2026-07-25T00:00:00.000Z' },
      { lead_id: 'l2', to_stage_id: 'prospect', changed_at: '2026-07-05T00:00:00.000Z' },
    ];
    const snapshot = reconstructStageSnapshot(history, '2026-07-15T00:00:00.000Z');
    expect(snapshot).toEqual({ l1: 'demo', l2: 'prospect' });
  });

  it('excludes leads with no transition at or before the target date', () => {
    const history = [{ lead_id: 'l1', to_stage_id: 'prospect', changed_at: '2026-08-01T00:00:00.000Z' }];
    const snapshot = reconstructStageSnapshot(history, '2026-07-15T00:00:00.000Z');
    expect(snapshot).toEqual({});
  });
});

describe('countByStage', () => {
  it('counts leads per stage from a snapshot', () => {
    const counts = countByStage({ l1: 'demo', l2: 'prospect', l3: 'demo' });
    expect(counts).toEqual({ demo: 2, prospect: 1 });
  });
});

describe('computeCohortMatrix', () => {
  const stages = [
    { id: 'prospect', name: 'Prospect', position: 1 },
    { id: 'demo', name: 'Démo', position: 2 },
    { id: 'won', name: 'Gagné', position: 3 },
  ];

  it('groups leads by creation month and computes reach percent per stage', () => {
    const leads = [
      { id: 'l1', created_at: '2026-05-03T00:00:00.000Z' },
      { id: 'l2', created_at: '2026-05-20T00:00:00.000Z' },
    ];
    const history = [
      { lead_id: 'l1', to_stage_id: 'prospect', changed_at: '2026-05-03T00:00:00.000Z' },
      { lead_id: 'l1', to_stage_id: 'demo', changed_at: '2026-05-10T00:00:00.000Z' },
      { lead_id: 'l2', to_stage_id: 'prospect', changed_at: '2026-05-20T00:00:00.000Z' },
    ];
    const rows = computeCohortMatrix(leads, history, stages);
    expect(rows).toHaveLength(1);
    expect(rows[0].monthKey).toBe('2026-05');
    expect(rows[0].totalLeads).toBe(2);
    const demoCell = rows[0].cells.find((c) => c.stageId === 'demo')!;
    expect(demoCell.reachedCount).toBe(1);
    expect(demoCell.percent).toBe(50);
    expect(demoCell.leadIds).toEqual(['l1']);
  });

  it('excludes disqualified leads from cohort membership and denominator', () => {
    const leads = [
      { id: 'l1', created_at: '2026-05-03T00:00:00.000Z', is_disqualified: false },
      { id: 'l2', created_at: '2026-05-20T00:00:00.000Z', is_disqualified: true },
    ];
    const rows = computeCohortMatrix(leads, [], stages);
    expect(rows[0].totalLeads).toBe(1);
  });
});

describe('computeVelocityDays', () => {
  const wonStageId = 'won';

  it('averages days from created_at to the won transition found in history', () => {
    const leads = [{ id: 'l1', created_at: '2026-07-01T00:00:00.000Z', stage_id: 'won', stage_changed_at: '2026-07-11T00:00:00.000Z' }];
    const history = [{ lead_id: 'l1', to_stage_id: 'won', changed_at: '2026-07-11T00:00:00.000Z' }];
    expect(computeVelocityDays(leads, history, wonStageId)).toBe(10);
  });

  it('falls back to stage_changed_at when no history entry exists but the lead is currently won', () => {
    const leads = [{ id: 'l1', created_at: '2026-07-01T00:00:00.000Z', stage_id: 'won', stage_changed_at: '2026-07-06T00:00:00.000Z' }];
    expect(computeVelocityDays(leads, [], wonStageId)).toBe(5);
  });

  it('ignores leads that never reached the won stage', () => {
    const leads = [{ id: 'l1', created_at: '2026-07-01T00:00:00.000Z', stage_id: 'demo', stage_changed_at: '2026-07-06T00:00:00.000Z' }];
    expect(computeVelocityDays(leads, [], wonStageId)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/dashboardCalculations.test.ts`
Expected: FAIL — none of the new exports exist yet.

- [ ] **Step 3: Write the implementation**

Append to `src/utils/dashboardCalculations.ts`:

```typescript
export type PeriodPreset = 'since_last_codir' | 'last_two_codirs' | 'month' | 'quarter' | 'year' | 'custom';

export interface PeriodWindow {
  start: string;
  end: string;
}

export interface ComparisonWindows {
  current: PeriodWindow;
  comparison: PeriodWindow;
}

export interface CodirMeetingLike {
  meeting_date: string;
}

const daysAgoIso = (now: Date, days: number) => new Date(now.getTime() - days * 86400000).toISOString();

export function computePeriodWindows(
  preset: PeriodPreset,
  codirMeetings: CodirMeetingLike[],
  now: Date,
  custom?: { start: string; end: string }
): ComparisonWindows {
  const nowIso = now.toISOString();
  const sorted = [...codirMeetings].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  const last = sorted[sorted.length - 1]?.meeting_date;
  const prev = sorted[sorted.length - 2]?.meeting_date;
  const prevPrev = sorted[sorted.length - 3]?.meeting_date;

  switch (preset) {
    case 'since_last_codir': {
      const currentStart = last || daysAgoIso(now, 30);
      const comparisonEnd = last || daysAgoIso(now, 30);
      const comparisonStart = prev || daysAgoIso(now, 60);
      return {
        current: { start: currentStart, end: nowIso },
        comparison: { start: comparisonStart, end: comparisonEnd },
      };
    }
    case 'last_two_codirs': {
      const currentEnd = last || nowIso;
      const currentStart = prev || daysAgoIso(now, 30);
      const comparisonEnd = prev || daysAgoIso(now, 30);
      const comparisonStart = prevPrev || daysAgoIso(now, 60);
      return {
        current: { start: currentStart, end: currentEnd },
        comparison: { start: comparisonStart, end: comparisonEnd },
      };
    }
    case 'month': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const prevMonthEnd = new Date(start.getTime() - 1);
      return {
        current: { start: start.toISOString(), end: nowIso },
        comparison: { start: prevMonthStart.toISOString(), end: prevMonthEnd.toISOString() },
      };
    }
    case 'quarter': {
      const q = Math.floor(now.getUTCMonth() / 3);
      const start = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
      const prevQStart = new Date(Date.UTC(now.getUTCFullYear(), (q - 1) * 3, 1));
      const prevQEnd = new Date(start.getTime() - 1);
      return {
        current: { start: start.toISOString(), end: nowIso },
        comparison: { start: prevQStart.toISOString(), end: prevQEnd.toISOString() },
      };
    }
    case 'year': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const prevYearStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
      const prevYearEnd = new Date(start.getTime() - 1);
      return {
        current: { start: start.toISOString(), end: nowIso },
        comparison: { start: prevYearStart.toISOString(), end: prevYearEnd.toISOString() },
      };
    }
    case 'custom':
    default: {
      const start = custom?.start || daysAgoIso(now, 30);
      const end = custom?.end || nowIso;
      const spanMs = new Date(end).getTime() - new Date(start).getTime();
      const comparisonEnd = new Date(new Date(start).getTime() - 1).toISOString();
      const comparisonStart = new Date(new Date(start).getTime() - spanMs).toISOString();
      return {
        current: { start, end },
        comparison: { start: comparisonStart, end: comparisonEnd },
      };
    }
  }
}

export function isWithinWindow(dateStr: string, window: PeriodWindow): boolean {
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return false;
  return time >= new Date(window.start).getTime() && time <= new Date(window.end).getTime();
}

export interface LeadStageHistoryEntryLike {
  lead_id: string;
  to_stage_id: string;
  changed_at: string;
}

export function reconstructStageSnapshot(
  history: LeadStageHistoryEntryLike[],
  atIso: string
): Record<string, string> {
  const latestByLead: Record<string, { stageId: string; changedAt: string }> = {};
  for (const entry of history) {
    if (entry.changed_at > atIso) continue;
    const existing = latestByLead[entry.lead_id];
    if (!existing || entry.changed_at > existing.changedAt) {
      latestByLead[entry.lead_id] = { stageId: entry.to_stage_id, changedAt: entry.changed_at };
    }
  }
  const snapshot: Record<string, string> = {};
  for (const [leadId, v] of Object.entries(latestByLead)) {
    snapshot[leadId] = v.stageId;
  }
  return snapshot;
}

export function countByStage(snapshot: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const stageId of Object.values(snapshot)) {
    counts[stageId] = (counts[stageId] || 0) + 1;
  }
  return counts;
}

export interface CohortLeadInput {
  id: string;
  created_at: string;
  is_disqualified?: boolean;
}

export interface CohortStageCell {
  stageId: string;
  reachedCount: number;
  percent: number;
  leadIds: string[];
}

export interface CohortRow {
  monthKey: string;
  monthLabel: string;
  totalLeads: number;
  cells: CohortStageCell[];
}

const FRENCH_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function computeCohortMatrix(
  leads: CohortLeadInput[],
  history: LeadStageHistoryEntryLike[],
  stages: { id: string; name: string; position: number }[]
): CohortRow[] {
  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const qualifyingLeads = leads.filter((l) => !l.is_disqualified);

  const reachedByLead: Record<string, Set<string>> = {};
  for (const entry of history) {
    if (!reachedByLead[entry.lead_id]) reachedByLead[entry.lead_id] = new Set();
    reachedByLead[entry.lead_id].add(entry.to_stage_id);
  }

  const monthGroups: Record<string, CohortLeadInput[]> = {};
  for (const lead of qualifyingLeads) {
    const monthKey = lead.created_at.slice(0, 7);
    if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
    monthGroups[monthKey].push(lead);
  }

  return Object.entries(monthGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, monthLeads]) => {
      const totalLeads = monthLeads.length;
      const [year, month] = monthKey.split('-');
      const monthLabel = `${FRENCH_MONTHS[Number(month) - 1]} ${year}`;

      const cells: CohortStageCell[] = sortedStages.map((stage) => {
        const leadIds = monthLeads
          .filter((l) => reachedByLead[l.id]?.has(stage.id))
          .map((l) => l.id);
        return {
          stageId: stage.id,
          reachedCount: leadIds.length,
          percent: totalLeads > 0 ? Math.round((leadIds.length / totalLeads) * 100) : 0,
          leadIds,
        };
      });

      return { monthKey, monthLabel, totalLeads, cells };
    });
}

export interface VelocityLeadInput {
  id: string;
  created_at: string;
  stage_id: string;
  stage_changed_at: string;
}

export function computeVelocityDays(
  leads: VelocityLeadInput[],
  history: LeadStageHistoryEntryLike[],
  wonStageId: string
): number {
  const wonDurations: number[] = [];

  for (const lead of leads) {
    const wonEntries = history
      .filter((h) => h.lead_id === lead.id && h.to_stage_id === wonStageId)
      .sort((a, b) => a.changed_at.localeCompare(b.changed_at));

    let wonAt = wonEntries[0]?.changed_at;
    if (!wonAt && lead.stage_id === wonStageId) {
      wonAt = lead.stage_changed_at;
    }
    if (!wonAt) continue;

    const days = (new Date(wonAt).getTime() - new Date(lead.created_at).getTime()) / 86400000;
    if (days >= 0) wonDurations.push(days);
  }

  if (wonDurations.length === 0) return 0;
  return Math.round(wonDurations.reduce((a, b) => a + b, 0) / wonDurations.length);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/dashboardCalculations.test.ts`
Expected: PASS (all existing + new tests).

- [ ] **Step 5: Verify the build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/utils/dashboardCalculations.ts src/utils/dashboardCalculations.test.ts
rtk git commit -m "feat: add period-window, stage-snapshot, cohort and velocity calculations"
```

---

### Task 6: `Drawer.tsx` — Shared Slide-Over Component

**Files:**
- Create: `src/components/ui/Drawer.tsx`
- Test: `src/components/ui/Drawer.test.tsx`

**Interfaces:**
- Consumes: `motion/react` (`motion`, `AnimatePresence`) — same dependency `Modal.tsx` already uses.
- Produces: `Drawer` component with props `{ open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode }` — consumed by Task 10 (`DashboardPipelineTab.tsx`) and Task 11 (`CohortHeatmap.tsx`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/ui/Drawer.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    render(<Drawer open={false} onClose={vi.fn()} title="Titre">Contenu</Drawer>);
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument();
  });

  it('renders title and children when open', () => {
    render(<Drawer open onClose={vi.fn()} title="Leads de la cohorte Mai 2026">Contenu</Drawer>);
    expect(screen.getByText('Leads de la cohorte Mai 2026')).toBeInTheDocument();
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="Titre">Contenu</Drawer>);
    fireEvent.click(screen.getByTestId('drawer-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when the panel itself is clicked', () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="Titre">Contenu</Drawer>);
    fireEvent.click(screen.getByText('Contenu'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="Titre">Contenu</Drawer>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ui/Drawer.test.tsx`
Expected: FAIL — `Cannot find module './Drawer'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/ui/Drawer.tsx
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Right-anchored slide-over, same overlay/AnimatePresence shell as Modal.tsx
 * but sliding horizontally instead of scaling from center — used for
 * click-to-drill-down panels (stage bars, cohort cells, KPI cards).
 */
export const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="drawer-overlay"
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="h-full w-full max-w-md overflow-y-auto border-l border-line-strong bg-surface font-ui shadow-modal sm:max-w-lg"
            onClick={(e) => e.stopPropagation()}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="font-display text-sm font-bold text-ink">{title}</div>
              <button
                className="rounded-control p-1 text-ink-faint transition-colors hover:bg-hover hover:text-ink cursor-pointer"
                onClick={onClose}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/ui/Drawer.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/ui/Drawer.tsx src/components/ui/Drawer.test.tsx
rtk git commit -m "feat: add Drawer slide-over shell for dashboard drill-down"
```

---

### Task 7: `DashboardHeader.tsx` — Single Period Selector + "Valider le CODIR" Button

**Files:**
- Modify: `src/views/dashboard/DashboardHeader.tsx` (full rewrite)
- Test: `src/views/dashboard/DashboardHeader.test.tsx` (new file)

**Interfaces:**
- Consumes: `PeriodPreset` (Task 5), `CodirMeeting` (Task 3), `Modal` (`src/components/ui/Modal.tsx`), `AccentButton`, `PageTitle`.
- Produces: `DashboardHeaderProps { preset: PeriodPreset; setPreset: (p: PeriodPreset) => void; customRange: { start: string; end: string }; setCustomRange: (r: { start: string; end: string }) => void; codirMeetings: CodirMeeting[]; onValidateCodir: () => Promise<void>; onExportCsv: () => void }` — consumed by Task 8 (`Dashboard.tsx`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/views/dashboard/DashboardHeader.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardHeader } from './DashboardHeader';

const baseProps = {
  preset: 'since_last_codir' as const,
  setPreset: vi.fn(),
  customRange: { start: '2026-07-01', end: '2026-07-30' },
  setCustomRange: vi.fn(),
  codirMeetings: [{ id: 'm1', meeting_date: '2026-07-15T00:00:00.000Z', label: null }],
  onValidateCodir: vi.fn().mockResolvedValue(undefined),
  onExportCsv: vi.fn(),
};

describe('DashboardHeader', () => {
  it('renders the preset selector with the current preset selected', () => {
    render(<DashboardHeader {...baseProps} />);
    expect(screen.getByDisplayValue('Depuis le dernier CODIR')).toBeInTheDocument();
  });

  it('calls setPreset when a different preset is chosen', () => {
    render(<DashboardHeader {...baseProps} />);
    fireEvent.change(screen.getByLabelText('Période'), { target: { value: 'month' } });
    expect(baseProps.setPreset).toHaveBeenCalledWith('month');
  });

  it('shows custom date inputs only when the custom preset is active', () => {
    const { rerender } = render(<DashboardHeader {...baseProps} />);
    expect(screen.queryByLabelText('Début')).not.toBeInTheDocument();
    rerender(<DashboardHeader {...baseProps} preset="custom" />);
    expect(screen.getByLabelText('Début')).toBeInTheDocument();
  });

  it('opens a confirmation modal and calls onValidateCodir when confirmed', async () => {
    render(<DashboardHeader {...baseProps} />);
    fireEvent.click(screen.getByText('Valider le CODIR du jour'));
    expect(screen.getByText(/Confirmer l'enregistrement/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirmer'));
    expect(baseProps.onValidateCodir).toHaveBeenCalled();
  });

  it('calls onExportCsv when the export button is clicked', () => {
    render(<DashboardHeader {...baseProps} />);
    fireEvent.click(screen.getByText('Exporter CSV'));
    expect(baseProps.onExportCsv).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/views/dashboard/DashboardHeader.test.tsx`
Expected: FAIL — old `DashboardHeader` still takes the A/B prop shape, none of the new labels/buttons exist.

- [ ] **Step 3: Write the implementation**

```typescript
// src/views/dashboard/DashboardHeader.tsx
import React, { useState } from 'react';
import { Download, Calendar, Check } from 'lucide-react';
import { PageTitle } from '../../components/ui/PageTitle';
import { AccentButton } from '../../components/ui/AccentButton';
import { Modal } from '../../components/ui/Modal';
import type { PeriodPreset } from '../../utils/dashboardCalculations';
import type { CodirMeeting } from '../../services/settingsService';

export interface DashboardHeaderProps {
  preset: PeriodPreset;
  setPreset: (p: PeriodPreset) => void;
  customRange: { start: string; end: string };
  setCustomRange: (r: { start: string; end: string }) => void;
  codirMeetings: CodirMeeting[];
  onValidateCodir: () => Promise<void>;
  onExportCsv: () => void;
}

const PRESET_LABELS: Record<PeriodPreset, string> = {
  since_last_codir: 'Depuis le dernier CODIR',
  last_two_codirs: 'Entre les 2 derniers CODIR',
  month: 'Mois en cours',
  quarter: 'Trimestre en cours',
  year: 'Année en cours',
  custom: 'Période personnalisée',
};

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  preset,
  setPreset,
  customRange,
  setCustomRange,
  codirMeetings,
  onValidateCodir,
  onExportCsv,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [validating, setValidating] = useState(false);

  const handleConfirmValidate = async () => {
    setValidating(true);
    try {
      await onValidateCodir();
    } finally {
      setValidating(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageTitle>Dashboard</PageTitle>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <AccentButton variant="secondary" icon={<Check size={14} />} onClick={() => setConfirmOpen(true)}>
            Valider le CODIR du jour
          </AccentButton>
          <AccentButton variant="primary" icon={<Download size={14} />} onClick={onExportCsv}>
            Exporter CSV
          </AccentButton>
        </div>
      </div>

      <div className="bg-[#141414] border border-line rounded-xl px-3.5 py-2.5">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4C4A8]" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">Période</span>
          </div>

          <select
            id="dashboard-period-preset"
            aria-label="Période"
            value={preset}
            onChange={(e) => setPreset(e.target.value as PeriodPreset)}
            className="bg-[#1e1e1e] border border-line rounded-lg px-2.5 py-1.5 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
          >
            {(Object.keys(PRESET_LABELS) as PeriodPreset[]).map((p) => (
              <option key={p} value={p}>
                {PRESET_LABELS[p]}
              </option>
            ))}
          </select>

          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <div>
                <label htmlFor="dashboard-custom-start" className="sr-only">Début</label>
                <input
                  id="dashboard-custom-start"
                  aria-label="Début"
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                  className="bg-[#1e1e1e] border border-line rounded-md px-2 py-1 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                />
              </div>
              <div>
                <label htmlFor="dashboard-custom-end" className="sr-only">Fin</label>
                <input
                  id="dashboard-custom-end"
                  aria-label="Fin"
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                  className="bg-[#1e1e1e] border border-line rounded-md px-2 py-1 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                />
              </div>
            </div>
          )}

          <span className="text-[11px] text-ink-soft ml-auto">
            {codirMeetings.length} réunion{codirMeetings.length > 1 ? 's' : ''} CODIR enregistrée{codirMeetings.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} header="Confirmer l'enregistrement du CODIR">
        <div className="p-6 space-y-4">
          <p className="text-sm text-ink-soft">
            Cette action enregistre la date et l'heure actuelles comme nouvelle réunion CODIR de référence pour les prochains calculs de delta.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-ink-soft hover:text-[#f2ede4] transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <AccentButton variant="primary" onClick={handleConfirmValidate} disabled={validating}>
              {validating ? 'Enregistrement...' : 'Confirmer'}
            </AccentButton>
          </div>
        </div>
      </Modal>
    </div>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/views/dashboard/DashboardHeader.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/views/dashboard/DashboardHeader.tsx src/views/dashboard/DashboardHeader.test.tsx
rtk git commit -m "feat: replace dual A/B period picker with single preset selector and Valider CODIR button"
```

---

### Task 8: `Dashboard.tsx` — Wire New Header, Fetch New Data, Period-Window Filtering

**Files:**
- Modify: `src/views/Dashboard.tsx` (full rewrite of state/data-loading/filtering sections)

**Interfaces:**
- Consumes: `pipelineHistoryService.getStageHistory` (Task 2), `settingsService.getCodirHistory`/`addCodirDate` (Task 3), `computePeriodWindows`/`isWithinWindow` (Task 5), `DashboardHeader` (Task 7).
- Produces: `leadsA`, `leadsB`, `historyA`, `historyB`, `emailLogsA`, `emailLogsB`, `startDateA`, `endDateA` — **same names and shapes the 4 tab components already consume**, so this task requires no changes to `DashboardCodirTab.tsx`, `DashboardPipelineTab.tsx`, `DashboardOutreachTab.tsx`, or `DashboardTasksTab.tsx`.

- [ ] **Step 1: Replace the comparison-state block**

In `Dashboard.tsx`, replace lines 62-77 (the `comparisonMode`/`selectedCodirA/B`/`customDateA/B` block) with:

```typescript
  const [preset, setPreset] = useState<PeriodPreset>('since_last_codir');
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });
  const [codirMeetings, setCodirMeetings] = useState<CodirMeeting[]>([]);
  const [stageHistory, setStageHistory] = useState<LeadStageHistoryEntry[]>([]);
```

Update the imports at the top of the file:

```typescript
import { pipelineHistoryService } from '../services/pipelineHistoryService';
import type { LeadStageHistoryEntry } from '../services/pipelineHistoryService';
import type { CodirMeeting } from '../services/settingsService';
import { computePeriodWindows, isWithinWindow } from '../utils/dashboardCalculations';
import type { PeriodPreset } from '../utils/dashboardCalculations';
```

Remove the now-unused `isDateInRange` local function (lines 24-38) — replaced by `isWithinWindow`.

- [ ] **Step 2: Fetch the new tables in `loadDashboardData`**

Add `pipelineHistoryService.getStageHistory()` and swap `settingsService.getCodirHistory()` into the existing `Promise.all` (lines 86-106):

```typescript
      const [
        fetchedLeads,
        fetchedStages,
        fetchedTasks,
        fetchedEmailLogs,
        fetchedMembers,
        fetchedTargets,
        fetchedCodirMeetings,
        fetchedSla,
        historyRes,
        fetchedStageHistory,
      ] = await Promise.all([
        leadsService.getLeads(false),
        settingsService.getPipelineStages(),
        tasksService.getTasks(),
        prospectionService.getRecentEmailLogs(1000),
        settingsService.getTeamMembers(),
        settingsService.getDashboardTargets(),
        settingsService.getCodirHistory(),
        settingsService.getSlaLimits().catch(() => undefined),
        supabase.from('history').select('*, user:team_members!user_id(full_name, initials, color)').order('created_at', { ascending: false }),
        pipelineHistoryService.getStageHistory(),
      ]);

      setLeads(fetchedLeads);
      setStages(fetchedStages);
      setTasks(fetchedTasks);
      setEmailLogs(fetchedEmailLogs);
      setTeamMembers(fetchedMembers);
      setTargets(fetchedTargets);
      setCodirMeetings(fetchedCodirMeetings);
      setSlaLimits(fetchedSla);
      setHistory((historyRes.data || []) as LeadHistoryItem[]);
      setStageHistory(fetchedStageHistory);
```

Remove the old `if (fetchedCodirHistory.length > 0) { ... }` block (lines 118-125) — the new header no longer needs a "selected" CODIR date, `computePeriodWindows` derives it from `codirMeetings` directly.

- [ ] **Step 3: Replace the filtered-dataset `useMemo`**

Replace the `{ leadsA, leadsB, historyA, historyB, emailLogsA, emailLogsB, startDateA, endDateA }` `useMemo` (lines 135-165) with:

```typescript
  const { leadsA, leadsB, historyA, historyB, emailLogsA, emailLogsB, startDateA, endDateA, endDateB } = useMemo(() => {
    const { current, comparison } = computePeriodWindows(preset, codirMeetings, new Date(), customRange);

    return {
      leadsA: leads.filter((l) => isWithinWindow(l.created_at, current)),
      leadsB: leads.filter((l) => isWithinWindow(l.created_at, comparison)),
      historyA: history.filter((h) => isWithinWindow(h.created_at, current)),
      historyB: history.filter((h) => isWithinWindow(h.created_at, comparison)),
      emailLogsA: emailLogs.filter((e) => isWithinWindow(e.sent_at || e.created_at, current)),
      emailLogsB: emailLogs.filter((e) => isWithinWindow(e.sent_at || e.created_at, comparison)),
      startDateA: current.start,
      endDateA: current.end,
      endDateB: comparison.end,
    };
  }, [preset, codirMeetings, customRange, leads, history, emailLogs]);
```

`endDateB` (the comparison window's end date) isn't consumed by any tab yet in this task — it's threaded through starting in Task 10, which needs it to reconstruct the comparison-period stage snapshot. Keeping it in this `useMemo` now means Task 10 only has to destructure and pass it, not modify this block.

- [ ] **Step 4: Wire the new `DashboardHeader` and add `handleValidateCodir`**

Add near `handleExportCsv`:

```typescript
  const handleValidateCodir = async () => {
    const updated = await settingsService.addCodirDate();
    setCodirMeetings(updated);
    showToast('CODIR du jour enregistré !', 'success');
  };
```

Replace the `<DashboardHeader ... />` call (lines 202-215):

```typescript
      <DashboardHeader
        preset={preset}
        setPreset={setPreset}
        customRange={customRange}
        setCustomRange={setCustomRange}
        codirMeetings={codirMeetings}
        onValidateCodir={handleValidateCodir}
        onExportCsv={handleExportCsv}
      />
```

- [ ] **Step 5: Verify the build**

Run: `npx tsc --noEmit`
Expected: PASS — `DashboardCodirTab`, `DashboardPipelineTab`, `DashboardOutreachTab`, `DashboardTasksTab` still receive `leadsA`/`leadsB`/`historyA`/`historyB`/`emailLogsA`/`emailLogsB`/`startDateA`/`endDateA` unchanged, so no other file needs to change.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — `Dashboard.test.tsx` may need its mocked `settingsService.getCodirHistory`/`pipelineHistoryService.getStageHistory` return values added; if it fails on missing mocks, add `codirMeetings: []` / `stageHistory: []` fixtures to the existing test setup so it resolves like the other mocked calls.

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`, open `/dashboard`. Expected: page loads without console errors, period preset dropdown shows "Depuis le dernier CODIR" selected, all 4 tabs still render their existing content, "Valider le CODIR du jour" button opens the confirmation modal.

- [ ] **Step 8: Commit**

```bash
rtk git add src/views/Dashboard.tsx
rtk git commit -m "feat: drive Dashboard from unified period-preset model instead of dual A/B pickers"
```

---

### Task 9: `DashboardCodirTab.tsx` — Add Vélocité KPI Card

**Files:**
- Modify: `src/views/Dashboard.tsx` (pass 2 new props to `DashboardCodirTab`)
- Modify: `src/views/dashboard/DashboardCodirTab.tsx`

**Interfaces:**
- Consumes: `computeVelocityDays` (Task 5).
- Produces: `DashboardCodirTabProps` gains `stageHistory: LeadStageHistoryEntry[]` and `wonStageId: string | undefined`.

- [ ] **Step 1: Pass the new props from `Dashboard.tsx`**

In `Dashboard.tsx`, update the `<DashboardCodirTab ... />` call:

```typescript
        {activeTab === 'codir' && (
          <DashboardCodirTab
            leadsA={leadsA}
            leadsB={leadsB}
            targets={targets}
            historyA={historyA}
            historyB={historyB}
            slaLimits={slaLimits}
            stageHistory={stageHistory}
            wonStageId={stages.find((s) => s.is_closed_won)?.id}
          />
        )}
```

- [ ] **Step 2: Extend `DashboardCodirTabProps` and add the Vélocité card**

In `DashboardCodirTab.tsx`, update the import and props interface:

```typescript
import { computeDelta, computeVelocityDays, type DeltaResult } from '../../utils/dashboardCalculations';
import type { LeadStageHistoryEntry } from '../../services/pipelineHistoryService';
import { Gauge } from 'lucide-react';
```

```typescript
export interface DashboardCodirTabProps {
  leadsA: Lead[];
  leadsB: Lead[];
  targets: DashboardTargets;
  historyA: LeadHistoryItem[];
  historyB: LeadHistoryItem[];
  slaLimits?: SlaLimits;
  stageHistory: LeadStageHistoryEntry[];
  wonStageId?: string;
}
```

Update the component signature:

```typescript
export const DashboardCodirTab: React.FC<DashboardCodirTabProps> = ({
  leadsA,
  leadsB,
  targets,
  historyA,
  historyB,
  slaLimits = { Media: 7, Retail: 14, Instit: 21 },
  stageHistory,
  wonStageId,
}) => {
```

Add the calculation after the existing "4. Positive Prospection Responses" block:

```typescript
  // 5. Vélocité (jours moyens création → Gagné) sur les leads gagnés de la période
  const velocityDays = wonStageId
    ? computeVelocityDays(leadsA, stageHistory, wonStageId)
    : 0;
```

Renumber the existing "5. Hot Deals" and "6. SLA Alert Breaches" comments to 6 and 7 (cosmetic only).

Change the KPI grid from `lg:grid-cols-4` to `lg:grid-cols-5` and add a 5th card immediately after the "Réponses Positives Prospection" card:

```typescript
        {/* Card 5: Vélocité */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">Vélocité (Création → Gagné)</span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {velocityDays} <span className="text-sm font-normal text-ink-soft">jours</span>
            </div>
            <p className="text-xs text-ink-soft mt-0.5">
              Temps moyen entre la création d'un lead et son passage en Gagné, sur la période active.
            </p>
          </div>
        </div>
```

Also add the `Gauge` icon usage is optional — since this card has no icon slot like the others, the import can be dropped if unused. Remove the `import { Gauge } from 'lucide-react';` line added above (not needed — the card matches the existing text-only card style, no icon).

- [ ] **Step 3: Update `DashboardCodirTab.test.tsx` (if it exists) or add one**

Check whether `src/views/dashboard/DashboardCodirTab.test.tsx` already exists (`find src/views/dashboard -iname "*.test.tsx"`). If it exists, add `stageHistory={[]}` and `wonStageId={undefined}` to every existing render call so they keep compiling, plus this new test:

```typescript
  it('shows a Vélocité card computed from stageHistory and wonStageId', () => {
    render(
      <DashboardCodirTab
        leadsA={[{ id: 'l1', created_at: '2026-07-01T00:00:00.000Z', stage_id: 'won', stage_changed_at: '2026-07-06T00:00:00.000Z', deal_value: 0 } as any]}
        leadsB={[]}
        targets={{ target_ca: 100, target_leads_count: 20, target_win_rate: 20, target_prospection_positive: 10 }}
        historyA={[]}
        historyB={[]}
        stageHistory={[]}
        wonStageId="won"
      />
    );
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('jours')).toBeInTheDocument();
  });
```

If no test file exists yet, create `src/views/dashboard/DashboardCodirTab.test.tsx` with just this one test plus the necessary imports (`describe`, `it`, `expect` from `vitest`, `render`, `screen` from `@testing-library/react`, `DashboardCodirTab` from `./DashboardCodirTab`).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/views/dashboard/DashboardCodirTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify the build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/views/Dashboard.tsx src/views/dashboard/DashboardCodirTab.tsx src/views/dashboard/DashboardCodirTab.test.tsx
rtk git commit -m "feat: add Vélocité KPI card to CODIR tab"
```

---

### Task 10: `DashboardPipelineTab.tsx` — Volume/Valeur Toggle, Per-Stage Deltas, Hide-Closed Checkbox, Drill-Down

**Files:**
- Modify: `src/views/Dashboard.tsx` (pass 3 new props to `DashboardPipelineTab`)
- Modify: `src/views/dashboard/DashboardPipelineTab.tsx`
- Test: `src/views/dashboard/DashboardPipelineTab.test.tsx` (new, or extend if it exists)

**Interfaces:**
- Consumes: `reconstructStageSnapshot`, `countByStage` (Task 5), `Drawer` (Task 6).
- Produces: `DashboardPipelineTabProps` gains `stageHistory: LeadStageHistoryEntry[]` and `comparisonEndDate: string`.

- [ ] **Step 1: Pass the new props from `Dashboard.tsx`**

`endDateB` is already returned by the `useMemo` in `Dashboard.tsx` (Task 8, Step 3) — it just wasn't consumed by any tab until now. Pass it as `comparisonEndDate`:

```typescript
        {activeTab === 'pipeline' && (
          <DashboardPipelineTab
            leadsA={leadsA}
            leadsB={leadsB}
            stages={stages}
            historyA={historyA}
            historyB={historyB}
            stageHistory={stageHistory}
            comparisonEndDate={endDateB}
          />
        )}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/views/dashboard/DashboardPipelineTab.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardPipelineTab } from './DashboardPipelineTab';

const stages = [
  { id: 's1', name: 'Prospect', position: 1, color: '#fff', is_closed_won: false, is_active: true },
  { id: 's2', name: 'Gagné', position: 2, color: '#0f0', is_closed_won: true, is_active: true },
] as any;

const leadsA = [
  { id: 'l1', stage_id: 's1', deal_value: 100, segment: 'Media', source: 'LinkedIn', days_in_stage: 2, is_archived: false } as any,
  { id: 'l2', stage_id: 's2', deal_value: 200, segment: 'Retail', source: 'Inbound', days_in_stage: 1, is_archived: false } as any,
];

describe('DashboardPipelineTab', () => {
  it('toggles between Volume and Valeur display for the funnel', () => {
    render(
      <DashboardPipelineTab leadsA={leadsA} leadsB={[]} stages={stages} historyA={[]} historyB={[]} stageHistory={[]} comparisonEndDate="2026-07-01T00:00:00.000Z" />
    );
    expect(screen.getByText('1 leads (50%)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Valeur'));
    expect(screen.getByText('100 €')).toBeInTheDocument();
  });

  it('hides closed stages when the checkbox is checked', () => {
    render(
      <DashboardPipelineTab leadsA={leadsA} leadsB={[]} stages={stages} historyA={[]} historyB={[]} stageHistory={[]} comparisonEndDate="2026-07-01T00:00:00.000Z" />
    );
    // Scoped to the funnel row button, not plain text — the cohort heatmap
    // (added in a later task) also renders every stage name as a <th>, so a
    // bare getByText('Gagné') would become ambiguous once that lands.
    expect(screen.getByRole('button', { name: /Gagné/ })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Masquer les deals fermés'));
    expect(screen.queryByRole('button', { name: /Gagné/ })).not.toBeInTheDocument();
  });

  it('opens the drill-down drawer when a stage bar is clicked', () => {
    render(
      <DashboardPipelineTab leadsA={leadsA} leadsB={[]} stages={stages} historyA={[]} historyB={[]} stageHistory={[]} comparisonEndDate="2026-07-01T00:00:00.000Z" />
    );
    fireEvent.click(screen.getByRole('button', { name: /Prospect/ }));
    expect(screen.getByText(/Leads en étape Prospect/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/views/dashboard/DashboardPipelineTab.test.tsx`
Expected: FAIL — none of the toggle/checkbox/drilldown UI exists yet.

- [ ] **Step 4: Implement the changes in `DashboardPipelineTab.tsx`**

Update imports:

```typescript
import React, { useState } from 'react';
import { GitCommit, Layers, PieChart, Share2, Clock, ArrowUpRight, ArrowDownRight, DollarSign, Hash, Euro } from 'lucide-react';
import type { Lead, LeadHistoryItem } from '../../services/leadsService';
import type { PipelineStage } from '../../services/settingsService';
import type { LeadStageHistoryEntry } from '../../services/pipelineHistoryService';
import { computeLeadsProgression, computeDelta, reconstructStageSnapshot, countByStage, type DeltaResult } from '../../utils/dashboardCalculations';
import { Drawer } from '../../components/ui/Drawer';
```

Update the props interface:

```typescript
export interface DashboardPipelineTabProps {
  leadsA: Lead[];
  leadsB: Lead[];
  stages: PipelineStage[];
  historyA: LeadHistoryItem[];
  historyB: LeadHistoryItem[];
  stageHistory: LeadStageHistoryEntry[];
  comparisonEndDate: string;
}
```

Update the component signature and add local state, right after the existing `const { leadsA, leadsB: _leadsB, stages, historyA, historyB } = ...` destructuring line:

```typescript
export const DashboardPipelineTab: React.FC<DashboardPipelineTabProps> = ({
  leadsA,
  leadsB: _leadsB,
  stages,
  historyA,
  historyB,
  stageHistory,
  comparisonEndDate,
}) => {
  const [displayMode, setDisplayMode] = useState<'volume' | 'valeur'>('volume');
  const [hideClosed, setHideClosed] = useState(false);
  const [drilldown, setDrilldown] = useState<{ title: string; leads: Lead[] } | null>(null);
```

Add the per-stage delta computation right after `const sortedStages = ...` (existing line):

```typescript
  const comparisonSnapshot = reconstructStageSnapshot(stageHistory, comparisonEndDate);
  const comparisonCounts = countByStage(comparisonSnapshot);
```

Update the `stageStats` block to include the delta and filter closed stages when `hideClosed` is on:

```typescript
  const totalLeadsCount = leadsA.length || 1;
  const visibleStages = hideClosed ? sortedStages.filter((s) => !s.is_closed_won && !s.is_closed_lost) : sortedStages;
  const stageStats = visibleStages.map((stage) => {
    const stageLeads = leadsA.filter((l) => l.stage_id === stage.id);
    const count = stageLeads.length;
    const totalVal = stageLeads.reduce((sum, l) => sum + (l.deal_value || 0), 0);
    const percent = Math.round((count / totalLeadsCount) * 100);
    const previousCount = comparisonCounts[stage.id] || 0;
    return {
      stage,
      count,
      totalVal,
      percent,
      leads: stageLeads,
      delta: count - previousCount,
    };
  });
```

Replace the Funnel Chart Card's header (add the toggle + checkbox) and body (add delta + click handler). Replace the whole `{/* Funnel Chart Card */}` block:

```typescript
      {/* Funnel Chart Card */}
      <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D4C4A8]" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">Vue par Statut (Entonnoir & Deltas)</h3>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-ink-soft cursor-pointer">
              <input
                type="checkbox"
                aria-label="Masquer les deals fermés"
                checked={hideClosed}
                onChange={(e) => setHideClosed(e.target.checked)}
              />
              Masquer les deals fermés
            </label>

            <div className="flex items-center gap-1 bg-[#1e1e1e] border border-line rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setDisplayMode('volume')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${displayMode === 'volume' ? 'bg-[#D4C4A8] text-[#0d0d0d]' : 'text-ink-soft'}`}
              >
                <Hash className="w-3 h-3" /> Volume
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('valeur')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${displayMode === 'valeur' ? 'bg-[#D4C4A8] text-[#0d0d0d]' : 'text-ink-soft'}`}
              >
                <Euro className="w-3 h-3" /> Valeur
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {stageStats.map(({ stage, count, totalVal, percent, leads, delta }) => {
            const barWidth = Math.max(5, percent);
            return (
              <button
                type="button"
                key={stage.id}
                onClick={() => setDrilldown({ title: `Leads en étape ${stage.name} (${count})`, leads })}
                className="w-full text-left space-y-1 cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color || '#D4C4A8' }} />
                    <span className="font-bold text-[#f2ede4] group-hover:text-[#D4C4A8] transition-colors">{stage.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-ink-soft">
                    {displayMode === 'volume' ? (
                      <span>{count} leads ({percent}%)</span>
                    ) : (
                      <span className="font-semibold text-[#D4C4A8]">{totalVal.toLocaleString('fr-FR')} €</span>
                    )}
                    <span className={delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-ink-faint'}>
                      ({delta > 0 ? '+' : ''}{delta})
                    </span>
                  </div>
                </div>

                <div className="w-full bg-[#1e1e1e] h-3 rounded-full overflow-hidden border border-line/40">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: stage.color || '#D4C4A8' }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Drawer open={drilldown !== null} onClose={() => setDrilldown(null)} title={drilldown?.title || ''}>
        <div className="p-6 space-y-2">
          {(drilldown?.leads || []).map((lead) => (
            <div key={lead.id} className="p-3 bg-[#1e1e1e] border border-line/60 rounded-xl text-xs space-y-1">
              <div className="font-bold text-[#f2ede4]">{lead.company_name}</div>
              <div className="text-ink-soft">{(lead.deal_value || 0).toLocaleString('fr-FR')} € · {lead.stage?.name || 'Inconnue'}</div>
            </div>
          ))}
          {(drilldown?.leads || []).length === 0 && (
            <p className="text-xs text-ink-faint italic">Aucun lead sur cette étape.</p>
          )}
        </div>
      </Drawer>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/views/dashboard/DashboardPipelineTab.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add src/views/Dashboard.tsx src/views/dashboard/DashboardPipelineTab.tsx src/views/dashboard/DashboardPipelineTab.test.tsx
rtk git commit -m "feat: add Volume/Valeur toggle, per-stage deltas, and drill-down to Vue par Statut"
```

---

### Task 11: `CohortHeatmap.tsx` — Monthly Cohort Matrix

**Files:**
- Modify: `src/views/Dashboard.tsx` (pass `leads`/`stageHistory`/`stages`/`codirMeetings` down)
- Modify: `src/views/dashboard/DashboardPipelineTab.tsx` (render `CohortHeatmap` below the funnel)
- Create: `src/views/dashboard/CohortHeatmap.tsx`
- Test: `src/views/dashboard/CohortHeatmap.test.tsx`

**Interfaces:**
- Consumes: `computeCohortMatrix` (Task 5), `Drawer` (Task 6).
- Produces: `CohortHeatmap` component with props `{ leads: Lead[]; stageHistory: LeadStageHistoryEntry[]; stages: PipelineStage[]; deployedAtIso: string }`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/views/dashboard/CohortHeatmap.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CohortHeatmap } from './CohortHeatmap';

const stages = [
  { id: 's1', name: 'Prospect', position: 1, color: '#fff', is_closed_won: false, is_active: true },
  { id: 's2', name: 'Démo', position: 2, color: '#0af', is_closed_won: false, is_active: true },
] as any;

const leads = [
  { id: 'l1', company_name: 'Acme', created_at: '2026-05-03T00:00:00.000Z', is_disqualified: false } as any,
  { id: 'l2', company_name: 'Beta', created_at: '2026-05-20T00:00:00.000Z', is_disqualified: false } as any,
];

const stageHistory = [
  { lead_id: 'l1', to_stage_id: 's1', changed_at: '2026-05-03T00:00:00.000Z' } as any,
  { lead_id: 'l1', to_stage_id: 's2', changed_at: '2026-05-10T00:00:00.000Z' } as any,
];

describe('CohortHeatmap', () => {
  it('renders one row per cohort month with the lead count', () => {
    render(<CohortHeatmap leads={leads} stageHistory={stageHistory} stages={stages} deployedAtIso="2026-01-01T00:00:00.000Z" />);
    expect(screen.getByText(/Mai 2026/)).toBeInTheDocument();
    expect(screen.getByText(/2 leads/)).toBeInTheDocument();
  });

  it('marks a cohort month before the deploy date as partial history', () => {
    render(<CohortHeatmap leads={leads} stageHistory={stageHistory} stages={stages} deployedAtIso="2026-06-01T00:00:00.000Z" />);
    expect(screen.getByText('Historique partiel')).toBeInTheDocument();
  });

  it('opens the drawer with the reaching leads when a cell is clicked', () => {
    render(<CohortHeatmap leads={leads} stageHistory={stageHistory} stages={stages} deployedAtIso="2026-01-01T00:00:00.000Z" />);
    fireEvent.click(screen.getByText('50%'));
    expect(screen.getByText(/ayant atteint l'étape Démo/)).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/views/dashboard/CohortHeatmap.test.tsx`
Expected: FAIL — `Cannot find module './CohortHeatmap'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/views/dashboard/CohortHeatmap.tsx
import React, { useState } from 'react';
import { Flame as HeatmapIcon } from 'lucide-react';
import type { Lead } from '../../services/leadsService';
import type { PipelineStage } from '../../services/settingsService';
import type { LeadStageHistoryEntry } from '../../services/pipelineHistoryService';
import { computeCohortMatrix } from '../../utils/dashboardCalculations';
import { Drawer } from '../../components/ui/Drawer';

export interface CohortHeatmapProps {
  leads: Lead[];
  stageHistory: LeadStageHistoryEntry[];
  stages: PipelineStage[];
  deployedAtIso: string;
}

const cellBackground = (percent: number): string => {
  // Ocre foncé (100%) -> beige clair/neutre (0%), cohérent avec l'accent #D4C4A8
  const alpha = Math.max(0.08, percent / 100);
  return `rgba(212, 196, 168, ${alpha})`;
};

export const CohortHeatmap: React.FC<CohortHeatmapProps> = ({ leads, stageHistory, stages, deployedAtIso }) => {
  const [drilldown, setDrilldown] = useState<{ title: string; leadIds: string[] } | null>(null);

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const rows = computeCohortMatrix(leads, stageHistory, sortedStages);
  const leadsById = new Map(leads.map((l) => [l.id, l]));
  const currentMonthKey = new Date().toISOString().slice(0, 7);

  const drilldownLeads = (drilldown?.leadIds || [])
    .map((id) => leadsById.get(id))
    .filter((l): l is Lead => Boolean(l));

  return (
    <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2.5 border-b border-line/60 pb-3">
        <div className="p-2 bg-[#D4C4A8]/10 text-[#D4C4A8] rounded-xl border border-[#D4C4A8]/20">
          <HeatmapIcon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">Vue Cohorte (Matrice de Performance Temporelle)</h3>
          <p className="text-[11px] text-ink-soft">Pourcentage de chaque cohorte mensuelle ayant atteint chaque étape</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-xs text-ink-faint italic">Aucune cohorte disponible.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#f2ede4]">
            <thead>
              <tr className="border-b border-line/80 text-ink-soft font-semibold text-[11px] uppercase tracking-wider">
                <th className="pb-3 pl-2">Cohorte</th>
                {sortedStages.map((stage) => (
                  <th key={stage.id} className="pb-3 text-center">{stage.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {rows.map((row) => {
                const isPartial = row.monthKey < deployedAtIso.slice(0, 7);
                const isCurrent = row.monthKey === currentMonthKey;
                return (
                  <tr key={row.monthKey}>
                    <td className="py-3 pl-2 font-bold text-[#f2ede4] whitespace-nowrap">
                      {row.monthLabel} · {row.totalLeads} leads
                      {isCurrent && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#D4C4A8]/10 text-[#D4C4A8]">En cours</span>}
                      {isPartial && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300">Historique partiel</span>}
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.stageId} className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setDrilldown({
                              title: `Leads de la cohorte ${row.monthLabel} ayant atteint l'étape ${sortedStages.find((s) => s.id === cell.stageId)?.name} (${cell.reachedCount} leads)`,
                              leadIds: cell.leadIds,
                            })
                          }
                          className="w-full py-2 rounded-md font-bold cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: cellBackground(cell.percent), color: '#0d0d0d' }}
                        >
                          {cell.percent}%
                        </button>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={drilldown !== null} onClose={() => setDrilldown(null)} title={drilldown?.title || ''}>
        <div className="p-6 space-y-2">
          {drilldownLeads.map((lead) => (
            <div key={lead.id} className="p-3 bg-[#1e1e1e] border border-line/60 rounded-xl text-xs space-y-1">
              <div className="font-bold text-[#f2ede4]">{lead.company_name}</div>
              <div className="text-ink-soft">{(lead.deal_value || 0).toLocaleString('fr-FR')} € · {lead.stage?.name || 'Inconnue'}</div>
            </div>
          ))}
          {drilldownLeads.length === 0 && <p className="text-xs text-ink-faint italic">Aucun lead.</p>}
        </div>
      </Drawer>
    </div>
  );
};
```

- [ ] **Step 4: Render `CohortHeatmap` inside `DashboardPipelineTab.tsx`**

Add the import at the top of `DashboardPipelineTab.tsx`:

```typescript
import { CohortHeatmap } from './CohortHeatmap';
```

Add `deployedAtIso` to `DashboardPipelineTabProps` (the date this SQL addon was applied — passed as a constant from `Dashboard.tsx` so it's a single source of truth):

```typescript
  deployedAtIso: string;
```

At the end of the component's returned JSX, right after the `<Drawer ...>` block added in Task 10, append:

```typescript
      <CohortHeatmap leads={leadsA} stageHistory={stageHistory} stages={stages} deployedAtIso={deployedAtIso} />
```

Update `Dashboard.tsx`'s `<DashboardPipelineTab ... />` call to add:

```typescript
            deployedAtIso="2026-07-30T00:00:00.000Z"
```

(Hardcoded to the date Task 1's SQL script is applied in production — update this literal if the script is actually applied on a different date.)

Since `deployedAtIso` is now a required prop on `DashboardPipelineTabProps`, the 3 render calls written in Task 10's `DashboardPipelineTab.test.tsx` no longer compile. Add `deployedAtIso="2026-01-01T00:00:00.000Z"` to each of the three `<DashboardPipelineTab ... />` calls in that file (all three tests, same value — it just needs to be before any cohort month used in that file's fixtures, and Task 10's tests don't touch cohorts at all).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/views/dashboard/CohortHeatmap.test.tsx src/views/dashboard/DashboardPipelineTab.test.tsx`
Expected: PASS.

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add src/views/Dashboard.tsx src/views/dashboard/DashboardPipelineTab.tsx src/views/dashboard/CohortHeatmap.tsx src/views/dashboard/CohortHeatmap.test.tsx
rtk git commit -m "feat: add cohort heatmap with drill-down to Pipeline tab"
```

---

### Task 12: Full Regression Pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated suite**

Run: `npm run build`
Expected: PASS, no TypeScript errors.

Run: `npx vitest run`
Expected: PASS, all suites green (existing + the ones added in Tasks 2-11).

- [ ] **Step 2: Manual QA — Kanban non-regression**

Run: `npm run dev`, open `/pipeline`. Drag a lead card from one column to another.
Expected: card moves visually, no console error. Then, in Supabase SQL Editor: `SELECT * FROM lead_stage_history WHERE lead_id = '<dragged-lead-id>' ORDER BY changed_at DESC LIMIT 1;` — expect the row to reflect the drag-and-drop move (this was the bug identified in the spec; confirms the DB trigger, not app code, now captures it).

- [ ] **Step 3: Manual QA — Dashboard walkthrough**

Open `/dashboard`.
- CODIR tab: 5 KPI cards render (CA, Leads, Win Rate, Prospection, Vélocité), Hot Deals and SLA Alerts cards unchanged.
- Pipeline tab: Volume/Valeur toggle switches the funnel display; per-stage delta shows next to each bar; "Masquer les deals fermés" hides Won/Lost stages; clicking a stage bar opens the Drawer with that stage's leads; Cohort heatmap renders below with month rows and clickable percentage cells; current month shows "En cours" badge.
- Outreach tab: renders unchanged (sentiment breakdown, sequence table).
- Tasks tab: renders unchanged (per-member completed/pending lists).
- Header: preset dropdown switches between all 6 options without errors; custom mode reveals two date inputs; "Valider le CODIR du jour" opens confirmation modal and, on confirm, increases the "réunions CODIR enregistrées" count.

- [ ] **Step 4: Manual QA — responsive & theme**

Resize to tablet width (768px) and mobile width (375px). Expected: funnel/cohort tables scroll horizontally inside their own container rather than breaking page layout; Drawer remains full-height and readable at mobile width; no light-mode artifacts (app is dark-theme only, confirm no white flashes).

- [ ] **Step 5: Final commit (if any fixups were needed)**

If Steps 1-4 required fixes, stage and commit them with a descriptive message, e.g.:

```bash
rtk git add -A
rtk git commit -m "fix: address regressions found during dashboard v2 QA pass"
```

If no fixes were needed, this task produces no commit — the plan is complete as of Task 11's commit.
