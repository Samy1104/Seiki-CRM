# Cohort Analysis View V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a customizable, interactive Cohort Analysis View in the Seiki CRM Dashboard with configurable Y-axis cohort steps, X-axis interval steps, target stage selection, direct cell percentage display, and beige gradient cell shading.

**Architecture:** Extend `dashboardCalculations.ts` with a pure function `computeFlexibleCohortMatrix` to group leads by creation period and compute cumulative target stage reach across custom intervals. Update `CohortHeatmap.tsx` to render header controls, direct percentage text, beige dynamic shading (`rgba(212, 196, 168, opacity)`), and drill-down into `Drawer.tsx`.

**Tech Stack:** React, TypeScript, Vitest, Tailwind CSS, Lucide Icons, Lucide React, Supabase.

## Global Constraints

- Use `rtk git add` and `rtk git commit` for all git operations.
- Preserve all existing tests and component props.
- Cell shading must use the global beige color token `rgba(212, 196, 168, opacity)`.

---

### Task 1: Flexible Cohort Calculation Engine

**Files:**
- Modify: `src/utils/dashboardCalculations.ts`
- Modify: `src/utils/dashboardCalculations.test.ts`

**Interfaces:**
- Consumes: `Lead` interface from `src/services/leadsService.ts`, `LeadStageHistoryEntry` from `src/services/pipelineHistoryService.ts`.
- Produces: `computeFlexibleCohortMatrix(leads, history, options)` returning structured `CohortMatrixData`.

- [ ] **Step 1: Write failing unit test for `computeFlexibleCohortMatrix`**

In `src/utils/dashboardCalculations.test.ts`:
```ts
describe('computeFlexibleCohortMatrix', () => {
  it('groups leads by month cohort and calculates cumulative reach % for target stage', () => {
    const leads = [
      { id: 'l1', created_at: '2026-01-05T10:00:00Z', stage_id: 'stage-qual', is_disqualified: false },
      { id: 'l2', created_at: '2026-01-10T10:00:00Z', stage_id: 'stage-prospect', is_disqualified: false }
    ] as any;
    const history = [
      { id: 'h1', lead_id: 'l1', from_stage_id: 'stage-prospect', to_stage_id: 'stage-qual', changed_at: '2026-01-12T10:00:00Z' }
    ] as any;

    const result = computeFlexibleCohortMatrix(leads, history, {
      cohortGranularity: 'month',
      intervalGranularity: 'week',
      periodCount: 4,
      targetStageId: 'stage-qual',
      allStages: [{ id: 'stage-prospect', name: 'Prospect' }, { id: 'stage-qual', name: 'Qualification' }] as any
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].cohortLabel).toContain('01/2026');
    expect(result.rows[0].totalLeads).toBe(2);
    expect(result.rows[0].cells[1].reachedCount).toBe(1);
    expect(result.rows[0].cells[1].reachPercentage).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/dashboardCalculations.test.ts`  
Expected: FAIL with `computeFlexibleCohortMatrix is not defined`

- [ ] **Step 3: Implement `computeFlexibleCohortMatrix`**

In `src/utils/dashboardCalculations.ts`:
```ts
export type CohortGranularity = 'week' | 'fortnight' | 'month';
export type IntervalGranularity = 'day' | 'week' | 'month';

export interface FlexibleCohortCell {
  intervalIndex: number;
  intervalLabel: string;
  reachedCount: number;
  totalCount: number;
  reachPercentage: number;
  windowEndIso: string;
  leadsInCohort: Lead[];
  reachedLeads: Lead[];
}

export interface FlexibleCohortRow {
  cohortId: string;
  cohortLabel: string;
  totalLeads: number;
  cells: FlexibleCohortCell[];
}

export interface FlexibleCohortMatrixOptions {
  cohortGranularity: CohortGranularity;
  intervalGranularity: IntervalGranularity;
  periodCount: number;
  targetStageId: string;
  allStages: PipelineStage[];
}

export function computeFlexibleCohortMatrix(
  leads: Lead[],
  history: LeadStageHistoryEntry[],
  options: FlexibleCohortMatrixOptions
): { rows: FlexibleCohortRow[]; intervalHeaderLabels: string[] } {
  // Implementation grouping leads into cohort buckets, evaluating stage history reach before interval boundaries, and computing reach percentages
  // ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/dashboardCalculations.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```bash
rtk git add src/utils/dashboardCalculations.ts src/utils/dashboardCalculations.test.ts
rtk git commit -m "feat: add computeFlexibleCohortMatrix calculation engine for customizable cohort analysis"
```

---

### Task 2: Interactive Cohort View Component (`CohortHeatmap.tsx`)

**Files:**
- Modify: `src/views/dashboard/CohortHeatmap.tsx`
- Modify: `src/views/dashboard/CohortHeatmap.test.tsx`

**Interfaces:**
- Consumes: `computeFlexibleCohortMatrix` from `src/utils/dashboardCalculations.ts`, `Drawer` shell from `src/components/ui/Drawer.tsx`.
- Produces: Updated `CohortHeatmap` component featuring Y/X controls, target stage dropdown, direct cell percentage text, beige gradient cell shading, and drill-down drawer.

- [ ] **Step 1: Write failing unit test for `CohortHeatmap`**

In `src/views/dashboard/CohortHeatmap.test.tsx`:
```ts
describe('CohortHeatmap', () => {
  it('renders header controls, displays percentage text directly in cells, and opens drawer on click', async () => {
    // Render CohortHeatmap with mock leads, stages, and history
    // Verify Y-cohort dropdown, X-interval dropdown, stage selector are present
    // Verify direct % text (e.g. 50.0%) is rendered inside matrix cells
    // Click cell and verify Drawer opens with lead details
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/dashboard/CohortHeatmap.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Update `CohortHeatmap.tsx`**

In `src/views/dashboard/CohortHeatmap.tsx`:
- Add 4 header selectors:
  - Cohortes (Ordonnée Y): `week`, `fortnight`, `month`
  - Intervalles (Abscisse X): `day`, `week`, `month`
  - Nombre de périodes: `4`, `6`, `8`, `12`, `16`, `24`
  - Statut Cible: Select dropdown of active pipeline stages
- Render matrix table:
  - Direct percentage text `XX.X%` in bold in every cell
  - Subtext ratio `N / Total`
  - Beige gradient background: `style={{ backgroundColor: \`rgba(212, 196, 168, \${0.08 + (cell.reachPercentage / 100) * 0.72})\` }}`
- Attach `onClick` handler on cells to open `Drawer` with target leads.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/dashboard/CohortHeatmap.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit Task 2**

```bash
rtk git add src/views/dashboard/CohortHeatmap.tsx src/views/dashboard/CohortHeatmap.test.tsx
rtk git commit -m "feat: add customizable header controls, beige gradient shading, and direct percentage display to CohortHeatmap"
```

---

### Task 3: Regression Test & Production Build Verification

**Files:**
- Modify/Verify: `src/views/dashboard/DashboardPipelineTab.tsx`
- Run build & test suite

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`  
Expected: All 57+ test files pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`  
Expected: `tsc -b` and `vite build` complete with 0 errors.

- [ ] **Step 3: Commit Task 3**

```bash
rtk git add -A
rtk git commit -m "chore: verify cohort view build and full test suite"
```
