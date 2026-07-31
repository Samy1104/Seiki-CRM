# Cohort Analysis View V2 — Design Specification

**Date**: 2026-07-31  
**Status**: Approved by User  
**Target Feature**: Dashboard — Interactive Cohort Analysis View (`src/views/dashboard/CohortHeatmap.tsx`)

---

## 1. Executive Summary & Intent

The Cohort Analysis View in the Seiki CRM Dashboard allows sales leaders and CODIR members to measure lead conversion velocity across custom cohorts. Leads are grouped by creation period on the Y-axis and tracked across equal, configurable time intervals on the X-axis to observe cumulative reach percentage for any selected pipeline stage (default: *Qualification*).

---

## 2. Requirements & Key Capabilities

### 2.1 Header Controls & Selectors
The Cohort view header features four independent, real-time controls:
1. **Y-Axis Cohort Granularity (`cohortGranularity`)**:
   - Options: `week` (Semaine), `fortnight` (Quinzaine / 15j), `month` (Mois).
   - Default: `month`.
2. **X-Axis Interval Granularity (`intervalGranularity`)**:
   - Options: `day` (Jours), `week` (Semaines), `month` (Mois).
   - Default: `week`.
3. **Number of Study Periods (`periodCount`)**:
   - Options: `4`, `6`, `8`, `12`, `16`, `24`.
   - Default: `8`.
4. **Target Pipeline Stage (`targetStageId`)**:
   - Dropdown listing all active pipeline stages dynamically fetched from `settingsService.getPipelineStages()`.
   - Default: First stage matching "Qualification" (or 2nd stage in pipeline if not matched).

---

## 3. Data & Calculation Architecture

### 3.1 Cohort Grouping (Y-Axis)
- Leads are assigned to a cohort based on their creation timestamp (`created_at`).
- Groupings:
  - `week`: ISO week (e.g. `S03 2026`).
  - `fortnight`: 1st-15th vs 16th-end of month (e.g. `2026-01 (1-15)`, `2026-01 (16-31)`).
  - `month`: Year-Month (e.g. `01/2026`).

### 3.2 Matrix Cell Calculation (X-Axis Cumulative Reach %)
For each cell `[Cohort Y, Interval X]` (where $X \in [0, \text{periodCount}-1]$):
1. Determine time window $W(Y, X) = [\text{CohortStart}_Y, \text{CohortStart}_Y + (X+1) \times \text{IntervalDuration}]$.
2. Filter cohort leads $L_Y = \{ l \in \text{Leads} \mid l.\text{created\_at} \in \text{Cohort}_Y \text{ and } l.\text{is\_disqualified} = \text{false} \}$.
3. Count qualified leads $Q(Y, X) = \{ l \in L_Y \mid l \text{ reached } \text{targetStageId} \text{ before or at end of } W(Y, X) \}$. Reconstructed using `lead_stage_history` transitions and current `stage_id`.
4. $\text{Percentage} = \frac{|Q(Y, X)|}{|L_Y|} \times 100$.

---

## 4. UI Design & Styling (Beige `#D4C4A8` Theme)

### 4.1 Direct Cell Percentage Display
- **Cell Text**:
  - Direct % value displayed in bold font inside each cell (e.g. `42.5%` or `0.0%`).
  - Secondary smaller subtext showing count ratio (e.g. `17 / 40`).
- **Beige Gradient Shading**:
  - Cell background fill calculated dynamically using the global beige token (`var(--color-beige, #D4C4A8)`):
    $$\text{opacity} = 0.08 + (\text{Percentage} / 100) \times 0.72$$
  - Higher percentages feature deeper, richer beige shading (`rgba(212, 196, 168, opacity)`).

### 4.2 Drill-Down Interaction
- **Click Event**: Clicking any matrix cell opens the right-anchored `Drawer` slide-over shell.
- **Drawer Content**: Displays the exact list of leads included in $Q(Y, X)$ or $L_Y$ with company name, contact, deal value, owner, and current stage.

---

## 5. Technical Modifications

1. `src/utils/dashboardCalculations.ts`: Add `computeFlexibleCohortMatrix` supporting arbitrary Y/X granularities and target stage IDs.
2. `src/views/dashboard/CohortHeatmap.tsx`: Rewrite to incorporate header controls, beige cell shading, direct % display, and `Drawer` integration.
3. `src/views/dashboard/CohortHeatmap.test.tsx`: Comprehensive unit tests covering calculations, granularity dropdowns, stage selector, and cell clicks.
