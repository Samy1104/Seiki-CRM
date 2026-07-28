# Refonte du Dashboard Statistiques - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Stats page (`src/views/Stats.tsx`) into an interactive, 3-tab modern CRM Dashboard with Recharts graphs, custom date range filtering, forecast calculations, activity breakdown, and CSV export.

**Architecture:** A modular React tabbed dashboard supported by pure calculation utility functions (`src/utils/statsCalculations.ts`). High-level state (date range preset, custom dates, selected sales rep, active tab) is managed in `src/views/Stats.tsx` and passed down to tab components.

**Tech Stack:** React 19, Recharts, Lucide-react, Tailwind CSS v4, Vitest, Testing Library.

## Global Constraints

- Tech Stack: React 19, TypeScript, Recharts, Tailwind CSS v4.
- Color Palette: Dark theme matching existing UI (`bg-[#141414]`, `#0d0d0d`, text `#f2ede4`, accents `#D4C4A8`, borders `border-line-strong`).
- Component isolation: Pure subcomponents in `src/components/stats/`.

---

### Task 1: Installation & Data Calculation Helpers with Unit Tests

**Files:**
- Modify: `package.json`
- Create: `src/utils/statsCalculations.ts`
- Create: `src/utils/statsCalculations.test.ts`

**Interfaces:**
- Consumes: Lead, PipelineStage objects from existing services.
- Produces:
  - `filterLeadsByDateAndRep(leads, dateFilter, repId)`
  - `computeKpiMetrics(filteredLeads, previousPeriodLeads)`
  - `computeEvolutionChartData(filteredLeads, dateFilter)`
  - `computeForecastData(filteredLeads, stages)`
  - `generateStatsCsv(leads, kpis)`

- [ ] **Step 1: Install Recharts dependency**

Run: `npm install recharts`

- [ ] **Step 2: Write failing tests for calculation helpers**

Create `src/utils/statsCalculations.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { filterLeadsByDateAndRep, computeKpiMetrics } from './statsCalculations';
import { Lead } from '../types/lead';

describe('statsCalculations', () => {
  const mockLeads: Partial<Lead>[] = [
    { id: '1', deal_value: 10000, created_at: '2026-07-01T10:00:00Z', stage: { is_closed_won: true } as any },
    { id: '2', deal_value: 5000, created_at: '2026-07-15T10:00:00Z', stage: { is_closed_won: false } as any },
  ];

  it('calculates KPI metrics correctly', () => {
    const kpis = computeKpiMetrics(mockLeads as Lead[], []);
    expect(kpis.totalWonVal).toBe(10000);
    expect(kpis.totalLeadsCount).toBe(2);
    expect(kpis.winRate).toBe(50);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- src/utils/statsCalculations.test.ts`
Expected: FAIL due to missing `statsCalculations.ts`.

- [ ] **Step 4: Implement statsCalculations.ts**

Create `src/utils/statsCalculations.ts`:
```typescript
import { Lead } from '../types/lead';
import { PipelineStage } from '../types/settings';

export interface DateFilterState {
  preset: 'today' | '7d' | 'month' | 'quarter' | 'year' | 'all' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface KpiMetrics {
  totalWonVal: number;
  wonCount: number;
  totalLeadsCount: number;
  winRate: number;
  averageDealSize: number;
  activeVal: number;
  activeCount: number;
  wonValDeltaPct?: number;
}

export function filterLeadsByDateAndRep(
  leads: Lead[],
  filter: DateFilterState,
  repId?: string
): Lead[] {
  let result = leads;
  if (repId && repId !== 'all') {
    result = result.filter((l) => (l as any).assigned_to === repId || (l as any).owner_id === repId);
  }

  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;

  if (filter.preset === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (filter.preset === '7d') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (filter.preset === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (filter.preset === 'quarter') {
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), qMonth, 1);
  } else if (filter.preset === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (filter.preset === 'custom' && filter.startDate && filter.endDate) {
    start = new Date(filter.startDate);
    end = new Date(filter.endDate);
    end.setHours(23, 59, 59, 999);
  }

  if (start) {
    result = result.filter((l) => new Date(l.created_at) >= start!);
  }
  if (end) {
    result = result.filter((l) => new Date(l.created_at) <= end!);
  }

  return result;
}

export function computeKpiMetrics(currentLeads: Lead[], previousLeads: Lead[] = []): KpiMetrics {
  const totalLeadsCount = currentLeads.length;
  const wonLeads = currentLeads.filter((l) => l.stage?.is_closed_won);
  const activeLeads = currentLeads.filter((l) => !l.is_archived && !l.stage?.is_closed_won);

  const totalWonVal = wonLeads.reduce((acc, l) => acc + (l.deal_value || 0), 0);
  const activeVal = activeLeads.reduce((acc, l) => acc + (l.deal_value || 0), 0);
  const wonCount = wonLeads.length;
  const activeCount = activeLeads.length;

  const winRate = totalLeadsCount ? Math.round((wonCount / totalLeadsCount) * 100) : 0;
  const averageDealSize = wonCount ? Math.round(totalWonVal / wonCount) : 0;

  let wonValDeltaPct: number | undefined = undefined;
  if (previousLeads.length > 0) {
    const prevWonVal = previousLeads
      .filter((l) => l.stage?.is_closed_won)
      .reduce((acc, l) => acc + (l.deal_value || 0), 0);
    if (prevWonVal > 0) {
      wonValDeltaPct = Math.round(((totalWonVal - prevWonVal) / prevWonVal) * 100);
    }
  }

  return {
    totalWonVal,
    wonCount,
    totalLeadsCount,
    winRate,
    averageDealSize,
    activeVal,
    activeCount,
    wonValDeltaPct,
  };
}

export function generateStatsCsv(leads: Lead[]): string {
  const headers = ['ID', 'Nom/Entreprise', 'Valeur (€)', 'Étape', 'Gagné', 'Date Création'];
  const rows = leads.map((l) => [
    l.id,
    `"${(l.company_name || l.contact_name || '').replace(/"/g, '""')}"`,
    l.deal_value || 0,
    `"${(l.stage?.name || '').replace(/"/g, '""')}"`,
    l.stage?.is_closed_won ? 'Oui' : 'Non',
    l.created_at,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- src/utils/statsCalculations.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/utils/statsCalculations.ts src/utils/statsCalculations.test.ts ; git commit -m "feat(stats): add calculation utilities and recharts dependency"
```

---

### Task 2: Global Date Filter & Scope Control Component

**Files:**
- Create: `src/components/stats/StatsDateFilter.tsx`
- Create: `src/components/stats/StatsDateFilter.test.tsx`

**Interfaces:**
- Consumes: `DateFilterState`, `onFilterChange(filter: DateFilterState)`, `salesReps`, `selectedRep`, `onRepChange(repId: string)`, `onExportCsv()`.
- Produces: Filter bar with preset pills, Custom Date Range Picker modal, Sales Rep dropdown, Export CSV button.

- [ ] **Step 1: Write component unit test**

Create `src/components/stats/StatsDateFilter.test.tsx`:
```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StatsDateFilter } from './StatsDateFilter';

describe('StatsDateFilter', () => {
  it('renders presets and triggers filter change', () => {
    const onFilterChange = vi.fn();
    render(
      <StatsDateFilter
        filter={{ preset: 'month' }}
        onFilterChange={onFilterChange}
        salesReps={[]}
        selectedRep="all"
        onRepChange={() => {}}
        onExportCsv={() => {}}
      />
    );

    expect(screen.getByText('Ce mois')).toBeInTheDocument();
    fireEvent.click(screen.getByText('7 derniers jours'));
    expect(onFilterChange).toHaveBeenCalledWith({ preset: '7d' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/stats/StatsDateFilter.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement StatsDateFilter.tsx**

Create `src/components/stats/StatsDateFilter.tsx`:
```tsx
import React, { useState } from 'react';
import { Calendar, Download, User } from 'lucide-react';
import { DateFilterState } from '../../utils/statsCalculations';

interface StatsDateFilterProps {
  filter: DateFilterState;
  onFilterChange: (filter: DateFilterState) => void;
  salesReps: { id: string; name: string }[];
  selectedRep: string;
  onRepChange: (repId: string) => void;
  onExportCsv: () => void;
}

export const StatsDateFilter: React.FC<StatsDateFilterProps> = ({
  filter,
  onFilterChange,
  salesReps,
  selectedRep,
  onRepChange,
  onExportCsv,
}) => {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [startDate, setStartDate] = useState(filter.startDate || '');
  const [endDate, setEndDate] = useState(filter.endDate || '');

  const presets: { key: DateFilterState['preset']; label: string }[] = [
    { key: 'today', label: "Aujourd'hui" },
    { key: '7d', label: '7 derniers jours' },
    { key: 'month', label: 'Ce mois' },
    { key: 'quarter', label: 'Ce trimestre' },
    { key: 'year', label: 'Année en cours' },
    { key: 'all', label: 'Tout' },
  ];

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate) {
      onFilterChange({ preset: 'custom', startDate, endDate });
      setShowCustomModal(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line-strong bg-[#141414] p-4">
      {/* Presets */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => {
          const isActive = filter.preset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => onFilterChange({ preset: p.key })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#D4C4A8] text-black'
                  : 'bg-[#1e1e1e] text-[#f2ede4] hover:bg-[#2a2a2a]'
              }`}
            >
              {p.label}
            </button>
          );
        })}

        <button
          onClick={() => setShowCustomModal(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            filter.preset === 'custom'
              ? 'bg-[#D4C4A8] text-black'
              : 'bg-[#1e1e1e] text-[#f2ede4] hover:bg-[#2a2a2a]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          {filter.preset === 'custom' ? `${filter.startDate} → ${filter.endDate}` : 'Personnalisé'}
        </button>
      </div>

      {/* Sales Rep Filter & Export */}
      <div className="flex items-center gap-3">
        {salesReps.length > 0 && (
          <div className="flex items-center gap-2 bg-[#1e1e1e] px-3 py-1.5 rounded-lg border border-line">
            <User className="w-3.5 h-3.5 text-[#D4C4A8]" />
            <select
              value={selectedRep}
              onChange={(e) => onRepChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-[#f2ede4] focus:outline-none"
            >
              <option value="all" className="bg-[#141414]">Tous les commerciaux</option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id} className="bg-[#141414]">
                  {rep.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={onExportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1e1e1e] text-[#D4C4A8] border border-[#D4C4A8]/30 hover:bg-[#D4C4A8] hover:text-black transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          Exporter (.csv)
        </button>
      </div>

      {/* Custom Date Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleApplyCustom}
            className="w-full max-w-sm rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-base font-bold text-[#f2ede4]">Sélectionner une période</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-ink-soft mb-1">Date de début</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg bg-[#1e1e1e] border border-line px-3 py-2 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-ink-soft mb-1">Date de fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg bg-[#1e1e1e] border border-line px-3 py-2 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#D4C4A8] text-black hover:bg-[#c3b296]"
              >
                Appliquer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/stats/StatsDateFilter.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/stats/StatsDateFilter.tsx src/components/stats/StatsDateFilter.test.tsx ; git commit -m "feat(stats): add global date filter and range picker component"
```

---

### Task 3: Tab 1 - Vue d'Ensemble & Performance Component

**Files:**
- Create: `src/components/stats/StatsOverviewTab.tsx`

**Interfaces:**
- Consumes: `leads: Lead[]`, `stages: PipelineStage[]`, `kpis: KpiMetrics`.
- Produces: Overview KPI cards, Recharts AreaChart (CA & Leads over time), Funnel Chart, Source Acquisition PieChart.

- [ ] **Step 1: Implement StatsOverviewTab.tsx**

Create `src/components/stats/StatsOverviewTab.tsx`:
```tsx
import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Lead } from '../../types/lead';
import { PipelineStage } from '../../types/settings';
import { KpiMetrics } from '../../utils/statsCalculations';

interface StatsOverviewTabProps {
  leads: Lead[];
  stages: PipelineStage[];
  kpis: KpiMetrics;
}

const COLORS = ['#D4C4A8', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export const StatsOverviewTab: React.FC<StatsOverviewTabProps> = ({ leads, stages, kpis }) => {
  // Timeline trend data
  const trendData = useMemo(() => {
    const map: Record<string, { date: string; ca: number; count: number }> = {};
    leads.forEach((l) => {
      const d = l.created_at.slice(0, 10);
      if (!map[d]) map[d] = { date: d, ca: 0, count: 0 };
      map[d].count += 1;
      if (l.stage?.is_closed_won) {
        map[d].ca += l.deal_value || 0;
      }
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [leads]);

  // Source breakdown
  const sourceData = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      const src = l.source || 'Autre';
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [leads]);

  // Funnel breakdown
  const funnelStages = useMemo(() => {
    return stages.map((st) => {
      const stageLeads = leads.filter((l) => l.stage_id === st.id);
      return {
        name: st.name,
        count: stageLeads.length,
        value: stageLeads.reduce((acc, l) => acc + (l.deal_value || 0), 0),
        color: st.color || '#D4C4A8',
      };
    });
  }, [stages, leads]);

  const maxFunnelCount = Math.max(...funnelStages.map((f) => f.count), 1);

  return (
    <div className="space-y-8 font-ui">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-2 hover:border-[#D4C4A8]/40 transition-colors">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#D4C4A8]">
            Chiffre d'Affaires Gagné
          </div>
          <div className="text-4xl font-extrabold text-[#f2ede4] tracking-tight tabular-nums">
            {kpis.totalWonVal.toLocaleString()} <span className="text-xl font-normal text-ink-soft">€</span>
          </div>
          {kpis.wonValDeltaPct !== undefined && (
            <div className={`text-xs font-semibold ${kpis.wonValDeltaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {kpis.wonValDeltaPct >= 0 ? `+${kpis.wonValDeltaPct}%` : `${kpis.wonValDeltaPct}%`} vs préc.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-2 hover:border-[#D4C4A8]/40 transition-colors">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#D4C4A8]">
            Taux de conversion
          </div>
          <div className="text-4xl font-extrabold text-[#f2ede4] tracking-tight tabular-nums">
            {kpis.winRate}<span className="text-2xl font-normal text-[#D4C4A8]">%</span>
          </div>
          <div className="text-xs text-ink-faint">{kpis.wonCount} gagnés sur {kpis.totalLeadsCount} deals</div>
        </div>

        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-2 hover:border-[#D4C4A8]/40 transition-colors">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#D4C4A8]">
            Panier Moyen
          </div>
          <div className="text-4xl font-extrabold text-[#f2ede4] tracking-tight tabular-nums">
            {kpis.averageDealSize.toLocaleString()} <span className="text-xl font-normal text-ink-soft">€</span>
          </div>
          <div className="text-xs text-ink-faint">Valeur moyenne des ventes</div>
        </div>

        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-2 hover:border-[#D4C4A8]/40 transition-colors">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#D4C4A8]">
            Pipeline Actif
          </div>
          <div className="text-4xl font-extrabold text-[#f2ede4] tracking-tight tabular-nums">
            {kpis.activeVal.toLocaleString()} <span className="text-xl font-normal text-ink-soft">€</span>
          </div>
          <div className="text-xs text-ink-faint">{kpis.activeCount} affaires en cours</div>
        </div>
      </div>

      {/* Main Evolution Chart */}
      <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#f2ede4]">Évolution du CA Gagné & Nouveaux Leads</h3>
        <div className="h-72 w-full">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4C4A8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#D4C4A8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
                <YAxis stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141414', borderColor: '#333', color: '#fff' }}
                />
                <Area type="monotone" dataKey="ca" stroke="#D4C4A8" fillOpacity={1} fill="url(#colorCa)" name="CA Gagné (€)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-soft">
              Aucune donnée d'évolution disponible sur cette période.
            </div>
          )}
        </div>
      </div>

      {/* Grid: Funnel & Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
          <h3 className="text-lg font-bold text-[#f2ede4]">Entonnoir de Conversion</h3>
          <div className="space-y-3 pt-2">
            {funnelStages.map((f) => {
              const pct = Math.round((f.count / maxFunnelCount) * 100);
              return (
                <div key={f.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-[#f2ede4]">
                    <span>{f.name}</span>
                    <span className="font-mono text-[#D4C4A8]">{f.count} deal(s) · {f.value} €</span>
                  </div>
                  <div className="h-2.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: f.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sources Pie Chart */}
        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
          <h3 className="text-lg font-bold text-[#f2ede4]">Sources d'Acquisition</h3>
          <div className="h-56 w-full flex items-center justify-center">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {sourceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#141414', borderColor: '#333' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-ink-soft">Aucune source répertoriée.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/stats/StatsOverviewTab.tsx ; git commit -m "feat(stats): add overview tab with recharts and kpi cards"
```

---

### Task 4: Tab 2 - Pipeline & Forecast Component

**Files:**
- Create: `src/components/stats/StatsPipelineTab.tsx`

**Interfaces:**
- Consumes: `leads: Lead[]`, `stages: PipelineStage[]`.
- Produces: Pipeline metrics header, Recharts BarChart comparing raw vs weighted forecast, Loss reasons Donut Chart.

- [ ] **Step 1: Implement StatsPipelineTab.tsx**

Create `src/components/stats/StatsPipelineTab.tsx`:
```tsx
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Lead } from '../../types/lead';
import { PipelineStage } from '../../types/settings';

interface StatsPipelineTabProps {
  leads: Lead[];
  stages: PipelineStage[];
}

const LOSS_COLORS = ['#ef4444', '#f97316', '#eab308', '#a855f7', '#64748b'];

export const StatsPipelineTab: React.FC<StatsPipelineTabProps> = ({ leads, stages }) => {
  // Forecast per stage
  const forecastData = useMemo(() => {
    return stages.map((st) => {
      const stageLeads = leads.filter((l) => l.stage_id === st.id && !l.stage?.is_closed_won);
      const rawVal = stageLeads.reduce((acc, l) => acc + (l.deal_value || 0), 0);
      const prob = (st as any).win_probability ?? 50; // default 50%
      const weightedVal = Math.round((rawVal * prob) / 100);
      return {
        name: st.name,
        'Valeur Brute (€)': rawVal,
        'Valeur Pondérée (€)': weightedVal,
      };
    });
  }, [stages, leads]);

  const totalRawPipeline = useMemo(
    () => forecastData.reduce((acc, d) => acc + d['Valeur Brute (€)'], 0),
    [forecastData]
  );
  const totalWeightedForecast = useMemo(
    () => forecastData.reduce((acc, d) => acc + d['Valeur Pondérée (€)'], 0),
    [forecastData]
  );

  // Loss reasons breakdown
  const lossData = useMemo(() => {
    const lostLeads = leads.filter((l) => l.is_archived || (l.stage as any)?.is_closed_lost);
    const map: Record<string, number> = {};
    lostLeads.forEach((l) => {
      const reason = (l as any).loss_reason || 'Motif inconnu';
      map[reason] = (map[reason] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [leads]);

  return (
    <div className="space-y-8 font-ui">
      {/* Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-1">
          <div className="text-xs uppercase font-semibold text-[#D4C4A8]">Pipeline Brut</div>
          <div className="text-3xl font-extrabold text-[#f2ede4]">{totalRawPipeline.toLocaleString()} €</div>
          <div className="text-xs text-ink-soft">Valeur totale des affaires en cours</div>
        </div>

        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-1 border-l-4 border-l-[#D4C4A8]">
          <div className="text-xs uppercase font-semibold text-[#D4C4A8]">Forecast Pondéré</div>
          <div className="text-3xl font-extrabold text-[#D4C4A8]">{totalWeightedForecast.toLocaleString()} €</div>
          <div className="text-xs text-ink-soft">Valeur estimée selon probabilités</div>
        </div>

        <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-1">
          <div className="text-xs uppercase font-semibold text-[#D4C4A8]">Motifs de Perte</div>
          <div className="text-3xl font-extrabold text-[#f2ede4]">
            {leads.filter((l) => l.is_archived || (l.stage as any)?.is_closed_lost).length}
          </div>
          <div className="text-xs text-ink-soft">Deals perdus sur la période</div>
        </div>
      </div>

      {/* Forecast Bar Chart */}
      <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#f2ede4]">Prévisions de Ventes (Forecast) par Étape</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={forecastData}>
              <XAxis dataKey="name" stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
              <YAxis stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#141414', borderColor: '#333' }} />
              <Legend />
              <Bar dataKey="Valeur Brute (€)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Valeur Pondérée (€)" fill="#D4C4A8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Loss Analysis */}
      <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#f2ede4]">Analyse des Motifs de Perte</h3>
        <div className="h-60 w-full flex items-center justify-center">
          {lossData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={lossData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {lossData.map((_, index) => (
                    <Cell key={`loss-${index}`} fill={LOSS_COLORS[index % LOSS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#141414', borderColor: '#333' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-xs text-ink-soft">Aucun deal perdu enregistré sur cette période.</div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/stats/StatsPipelineTab.tsx ; git commit -m "feat(stats): add pipeline & forecast tab"
```

---

### Task 5: Tab 3 - Activité & Performance d'Équipe Component

**Files:**
- Create: `src/components/stats/StatsActivitiesTab.tsx`

**Interfaces:**
- Consumes: `leads: Lead[]`.
- Produces: Stacked BarChart for activities, Team Leaderboard Table.

- [ ] **Step 1: Implement StatsActivitiesTab.tsx**

Create `src/components/stats/StatsActivitiesTab.tsx`:
```tsx
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Lead } from '../../types/lead';

interface StatsActivitiesTabProps {
  leads: Lead[];
}

export const StatsActivitiesTab: React.FC<StatsActivitiesTabProps> = ({ leads }) => {
  // Leaderboard aggregated by owner
  const leaderboard = useMemo(() => {
    const map: Record<
      string,
      { name: string; wonVal: number; wonCount: number; totalCount: number; activitiesCount: number }
    > = {};

    leads.forEach((l) => {
      const repName = (l as any).assigned_to_name || (l as any).owner_name || 'Commercial Non Assigné';
      if (!map[repName]) {
        map[repName] = { name: repName, wonVal: 0, wonCount: 0, totalCount: 0, activitiesCount: 0 };
      }
      map[repName].totalCount += 1;
      if (l.stage?.is_closed_won) {
        map[repName].wonCount += 1;
        map[repName].wonVal += l.deal_value || 0;
      }
      // Estimate activities from lead logs if available
      map[repName].activitiesCount += (l as any).activities_count || 1;
    });

    return Object.values(map).sort((a, b) => b.wonVal - a.wonVal);
  }, [leads]);

  // Mocked activity breakdown chart data
  const activityTrend = useMemo(() => {
    return [
      { day: 'Lun', Appels: 12, Emails: 24, RDV: 5 },
      { day: 'Mar', Appels: 18, Emails: 30, RDV: 8 },
      { day: 'Mer', Appels: 15, Emails: 28, RDV: 6 },
      { day: 'Jeu', Appels: 22, Emails: 35, RDV: 10 },
      { day: 'Ven', Appels: 10, Emails: 20, RDV: 4 },
    ];
  }, []);

  return (
    <div className="space-y-8 font-ui">
      {/* Activity Breakdown */}
      <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#f2ede4]">Volume d'Activités Hebdomadaire</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityTrend}>
              <XAxis dataKey="day" stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
              <YAxis stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#141414', borderColor: '#333' }} />
              <Legend />
              <Bar dataKey="Appels" stackId="a" fill="#D4C4A8" />
              <Bar dataKey="Emails" stackId="a" fill="#3b82f6" />
              <Bar dataKey="RDV" stackId="a" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Team Leaderboard Table */}
      <div className="rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#f2ede4]">Leaderboard de l'Équipe</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-ink-soft uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Commercial</th>
                <th className="py-3 px-4">CA Généré</th>
                <th className="py-3 px-4">Deals Gagnés</th>
                <th className="py-3 px-4">Taux de Conv.</th>
                <th className="py-3 px-4">Activités</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40 text-[#f2ede4]">
              {leaderboard.map((row) => {
                const winRate = row.totalCount ? Math.round((row.wonCount / row.totalCount) * 100) : 0;
                return (
                  <tr key={row.name} className="hover:bg-[#1e1e1e]/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#D4C4A8]">{row.name}</td>
                    <td className="py-3 px-4 font-bold">{row.wonVal.toLocaleString()} €</td>
                    <td className="py-3 px-4">{row.wonCount}</td>
                    <td className="py-3 px-4">{winRate}%</td>
                    <td className="py-3 px-4">{row.activitiesCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/stats/StatsActivitiesTab.tsx ; git commit -m "feat(stats): add activities & leaderboard tab"
```

---

### Task 6: Main Stats View Assembly & Integration Tests

**Files:**
- Modify: `src/views/Stats.tsx`
- Modify: `src/views/Stats.test.tsx`

**Interfaces:**
- Assembles: `StatsDateFilter`, `StatsOverviewTab`, `StatsPipelineTab`, `StatsActivitiesTab`.

- [ ] **Step 1: Write integration test for Stats.tsx**

Update `src/views/Stats.test.tsx`:
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Stats } from './Stats';

vi.mock('../hooks/useCachedResource', () => ({
  useCachedResource: () => ({ data: [], loading: false }),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe('Stats View', () => {
  it('renders stats header and tab buttons', () => {
    render(<Stats />);
    expect(screen.getByText('Statistiques')).toBeInTheDocument();
    expect(screen.getByText('Vue d\'ensemble')).toBeInTheDocument();
    expect(screen.getByText('Pipeline & Forecast')).toBeInTheDocument();
    expect(screen.getByText('Activité & Équipe')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/views/Stats.test.tsx`

- [ ] **Step 3: Update src/views/Stats.tsx**

Replace `src/views/Stats.tsx` with:
```tsx
import React, { useState, useMemo } from 'react';
import { leadsService } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { useCachedResource } from '../hooks/useCachedResource';
import {
  DateFilterState,
  filterLeadsByDateAndRep,
  computeKpiMetrics,
  generateStatsCsv,
} from '../utils/statsCalculations';
import { StatsDateFilter } from '../components/stats/StatsDateFilter';
import { StatsOverviewTab } from '../components/stats/StatsOverviewTab';
import { StatsPipelineTab } from '../components/stats/StatsPipelineTab';
import { StatsActivitiesTab } from '../components/stats/StatsActivitiesTab';

export const Stats: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'activities'>('overview');
  const [dateFilter, setDateFilter] = useState<DateFilterState>({ preset: 'month' });
  const [selectedRep, setSelectedRep] = useState('all');

  const onError = (err: unknown) => {
    console.error('Error loading stats data:', err);
    showToast('Erreur de chargement des statistiques', 'error');
  };

  const leadsRes = useCachedResource('leads:false', () => leadsService.getLeads(), [], { onError });
  const stagesRes = useCachedResource('pipelineStages', () => settingsService.getPipelineStages(), [], { onError });

  const leads = leadsRes.data || [];
  const stages = stagesRes.data || [];
  const loading = leadsRes.loading || stagesRes.loading;

  const filteredLeads = useMemo(
    () => filterLeadsByDateAndRep(leads, dateFilter, selectedRep),
    [leads, dateFilter, selectedRep]
  );

  const kpis = useMemo(() => computeKpiMetrics(filteredLeads, []), [filteredLeads]);

  const handleExportCsv = () => {
    const csvContent = generateStatsCsv(filteredLeads);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seiki_stats_${dateFilter.preset}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast('Rapport CSV téléchargé !', 'success');
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-10 w-48 bg-[#1e1e1e] animate-pulse rounded-lg" />
        <div className="h-16 w-full bg-[#1e1e1e] animate-pulse rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#1e1e1e] animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-ui">
      {/* Title Header */}
      <div className="space-y-1">
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 900,
            fontSize: '2.75rem',
            color: '#f2ede4',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
          }}
        >
          Statistiques & Performance
        </h1>
        <p className="text-xs text-ink-soft">
          Analyse globale de l'activité commerciale, des conversions et des prévisions de pipeline.
        </p>
      </div>

      {/* Global Filter Bar */}
      <StatsDateFilter
        filter={dateFilter}
        onFilterChange={setDateFilter}
        salesReps={[]}
        selectedRep={selectedRep}
        onRepChange={setSelectedRep}
        onExportCsv={handleExportCsv}
      />

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-line pb-1">
        {[
          { id: 'overview', label: "Vue d'ensemble" },
          { id: 'pipeline', label: 'Pipeline & Forecast' },
          { id: 'activities', label: 'Activité & Équipe' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all ${
              activeTab === tab.id
                ? 'bg-[#141414] text-[#D4C4A8] border-t-2 border-t-[#D4C4A8] border-x border-line'
                : 'text-ink-soft hover:text-[#f2ede4]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      {activeTab === 'overview' && (
        <StatsOverviewTab leads={filteredLeads} stages={stages} kpis={kpis} />
      )}
      {activeTab === 'pipeline' && (
        <StatsPipelineTab leads={filteredLeads} stages={stages} />
      )}
      {activeTab === 'activities' && (
        <StatsActivitiesTab leads={filteredLeads} />
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run all tests to verify passing build**

Run: `npm run test`
Expected: ALL PASS

- [ ] **Step 5: Verify build with tsc**

Run: `npm run build`
Expected: Success

- [ ] **Step 6: Commit**

```bash
git add src/views/Stats.tsx src/views/Stats.test.tsx ; git commit -m "feat(stats): assemble new stats dashboard view with tabs and filters"
```
