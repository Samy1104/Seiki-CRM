# Plan d'Implémentation : Dashboard Unifié SEIKI CRM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusionner l'ancienne vue CODIR et la vue Stats en un **Dashboard Unifié** avec gestion des objectifs (Réel vs Cible), comparateur de périodes (CODIR N vs N-1, dates personnalisées), suivi de progression des leads et répartition des tâches par membre.

**Architecture:** 
Le système s'appuie sur `app_settings` pour persister les objectifs et l'historique des dates CODIR. Les utilitaires de calcul (`dashboardCalculations.ts`) sont purement fonctionnels et couverts par des tests unitaires (Vitest). La vue `Dashboard.tsx` orchestre 4 onglets modulaires (`DashboardCodirTab`, `DashboardPipelineTab`, `DashboardOutreachTab`, `DashboardTasksTab`) avec un en-tête comparatif unifié (`DashboardHeader`).

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Lucide React, Vitest, Supabase Client.

## Global Constraints
- French UI only — tous les libellés et textes d'interface doivent être rédigés en français.
- Ne pas introduire de régression sur les fonctionnalités existantes de prospection ou de leads.
- Suivre la charte "Graphite Amber" (#0d0d0d base, #D4C4A8 texte/accents, #F59E0B accent secondaire).

---

### Task 1: Extension de `settingsService` pour les Objectifs et l'Historique CODIR

**Files:**
- Modify: `src/services/settingsService.ts`
- Modify: `src/services/settingsService.test.ts` (ou test unitaire associé)

**Interfaces:**
- Consumes: `supabaseClient.ts`
- Produces: `DashboardTargets` (`target_ca`, `target_leads_count`, `target_win_rate`, `target_prospection_positive`), `CodirHistory` (`dates: string[]`), `getDashboardTargets()`, `updateDashboardTargets()`, `getCodirHistory()`, `addCodirDate()`.

- [ ] **Step 1: Écrire les interfaces et les méthodes dans `settingsService.ts`**

```typescript
export interface DashboardTargets {
  target_ca: number;
  target_leads_count: number;
  target_win_rate: number;
  target_prospection_positive: number;
}

export interface CodirHistory {
  dates: string[];
}
```

- [ ] **Step 2: Ajouter l'implémentation des méthodes dans `settingsService.ts`**

```typescript
async getDashboardTargets(): Promise<DashboardTargets> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'dashboard_targets')
    .maybeSingle();

  return data?.value || {
    target_ca: 100,
    target_leads_count: 20,
    target_win_rate: 20,
    target_prospection_positive: 10,
  };
},

async updateDashboardTargets(targets: DashboardTargets): Promise<void> {
  await supabase.from('app_settings').upsert({
    key: 'dashboard_targets',
    value: targets,
    label: 'Objectifs du Dashboard Commercial',
    category: 'general',
  });
},

async getCodirHistory(): Promise<string[]> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'codir_history')
    .maybeSingle();

  return data?.value?.dates || [];
},

async addCodirDate(dateIso: string): Promise<string[]> {
  const current = await this.getCodirHistory();
  if (current.includes(dateIso)) return current;
  const updated = [...current, dateIso].sort();
  await supabase.from('app_settings').upsert({
    key: 'codir_history',
    value: { dates: updated },
    label: 'Historique des réunions CODIR',
    category: 'general',
  });
  return updated;
}
```

- [ ] **Step 3: Vérifier le build**

Run: `npx tsc --noEmit`
Expected: PASS sans erreur de types.

- [ ] **Step 4: Commit**

```bash
rtk git add src/services/settingsService.ts
rtk git commit -m "feat: add dashboard targets and codir history settings methods"
```

---

### Task 2: Utilitaires de Calcul & Comparaisons (`dashboardCalculations.ts`)

**Files:**
- Create: `src/utils/dashboardCalculations.ts`
- Create: `src/utils/dashboardCalculations.test.ts`

**Interfaces:**
- Consumes: Types `Lead`, `Task`, `EmailLog`, `HistoryItem`, `TeamMember`.
- Produces: `computePeriodMetrics()`, `computeDelta()`, `filterLeadsByDateRange()`, `computeLeadsProgression()`, `groupTasksByTeamMember()`.

- [ ] **Step 1: Écrire le test unitaire pour les calculs comparatifs**

Dans `src/utils/dashboardCalculations.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { computeDelta, computeLeadsProgression } from './dashboardCalculations';

describe('dashboardCalculations', () => {
  it('calculates percentage delta correctly', () => {
    const delta = computeDelta(120, 100);
    expect(delta.percent).toBe(20);
    expect(delta.absolute).toBe(20);
  });

  it('handles division by zero in delta', () => {
    const delta = computeDelta(50, 0);
    expect(delta.percent).toBe(100);
    expect(delta.absolute).toBe(50);
  });

  it('counts stage changes correctly from history', () => {
    const history = [
      { id: '1', lead_id: 'l1', action_type: 'stage_change', created_at: '2026-07-20T10:00:00Z' },
      { id: '2', lead_id: 'l1', action_type: 'note', created_at: '2026-07-20T11:00:00Z' },
    ];
    const count = computeLeadsProgression(history as any, '2026-07-01', '2026-07-31');
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Vérifier l'échec initial du test**

Run: `npx vitest run src/utils/dashboardCalculations.test.ts`
Expected: FAIL (module non trouvé ou fonctions manquantes).

- [ ] **Step 3: Implémenter `dashboardCalculations.ts`**

```typescript
export interface DeltaResult {
  current: number;
  previous: number;
  absolute: number;
  percent: number;
}

export function computeDelta(current: number, previous: number): DeltaResult {
  const absolute = current - previous;
  if (previous === 0) {
    return { current, previous, absolute, percent: current > 0 ? 100 : 0 };
  }
  const percent = Math.round((absolute / previous) * 100);
  return { current, previous, absolute, percent };
}

export function computeLeadsProgression(
  historyItems: Array<{ action_type: string; created_at: string }>,
  startDate: string,
  endDate: string
): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  return historyItems.filter((item) => {
    if (item.action_type !== 'stage_change') return false;
    const t = new Date(item.created_at).getTime();
    return t >= start && t <= end;
  }).length;
}

export function groupTasksByMember(
  tasks: Array<{ id: string; status: string; assigned_to?: string; description: string; priority: string; due_date?: string; completed_at?: string }>,
  teamMembers: Array<{ id: string; full_name: string; initials: string; color: string }>,
  startDate?: string,
  endDate?: string
) {
  const start = startDate ? new Date(startDate).getTime() : 0;
  const end = endDate ? new Date(endDate).getTime() : Infinity;

  return teamMembers.map((member) => {
    const memberTasks = tasks.filter((t) => t.assigned_to === member.id);
    const completedInPeriod = memberTasks.filter((t) => {
      if (t.status !== 'done' || !t.completed_at) return false;
      const compTime = new Date(t.completed_at).getTime();
      return compTime >= start && compTime <= end;
    });

    const pending = memberTasks.filter((t) => t.status !== 'done');

    return {
      member,
      completedInPeriod,
      pending,
    };
  });
}
```

- [ ] **Step 4: Lancer les tests et vérifier le succès**

Run: `npx vitest run src/utils/dashboardCalculations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/utils/dashboardCalculations.ts src/utils/dashboardCalculations.test.ts
rtk git commit -m "feat: add dashboard calculations and vitest unit tests"
```

---

### Task 3: Section "Objectifs & CODIR" dans la vue Paramètres (`Settings.tsx`)

**Files:**
- Create: `src/views/settings/DashboardTargetsSettings.tsx`
- Modify: `src/views/Settings.tsx`

**Interfaces:**
- Consumes: `settingsService.getDashboardTargets()`, `settingsService.updateDashboardTargets()`, `settingsService.getCodirHistory()`, `settingsService.addCodirDate()`.
- Produces: Composant d'édition des objectifs (CA, Leads, Win Rate, Prospection) et d'enregistrement des dates CODIR.

- [ ] **Step 1: Créer `DashboardTargetsSettings.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { settingsService, DashboardTargets } from '../../services/settingsService';
import { useToast } from '../../context/ToastContext';
import { Target, Calendar, Plus, Save } from 'lucide-react';

export const DashboardTargetsSettings: React.FC = () => {
  const { showToast } = useToast();
  const [targets, setTargets] = useState<DashboardTargets>({
    target_ca: 100,
    target_leads_count: 20,
    target_win_rate: 20,
    target_prospection_positive: 10,
  });
  const [codirDates, setCodirDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [t, d] = await Promise.all([
        settingsService.getDashboardTargets(),
        settingsService.getCodirHistory(),
      ]);
      setTargets(t);
      setCodirDates(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTargets = async () => {
    setSaving(true);
    try {
      await settingsService.updateDashboardTargets(targets);
      showToast('Objectifs sauvegardés avec succès !', 'success');
    } catch (err) {
      showToast("Erreur lors de la sauvegarde des objectifs", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTodayCodir = async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const updated = await settingsService.addCodirDate(today);
      setCodirDates(updated);
      showToast(`Date de CODIR (${today}) enregistrée !`, 'success');
    } catch (err) {
      showToast("Erreur lors de l'enregistrement du CODIR", 'error');
    }
  };

  if (loading) return <div className="text-sm text-ink-soft">Chargement des paramètres Dashboard...</div>;

  return (
    <div className="space-y-6 bg-[#141414] border border-line rounded-2xl p-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#F59E0B]/10 text-[#F59E0B] rounded-lg">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#f2ede4]">Objectifs Commercial & Dates CODIR</h3>
            <p className="text-xs text-ink-soft">Définissez vos objectifs cibles et enregistrez les dates de vos réunions CODIR</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Objectif Chiffre d'Affaires (€)</label>
          <input
            type="number"
            value={targets.target_ca}
            onChange={(e) => setTargets({ ...targets, target_ca: Number(e.target.value) })}
            className="w-full bg-[#1e1e1e] border border-line rounded-lg px-3 py-2 text-sm text-[#f2ede4]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Objectif Nouveaux Leads Qualifiés</label>
          <input
            type="number"
            value={targets.target_leads_count}
            onChange={(e) => setTargets({ ...targets, target_leads_count: Number(e.target.value) })}
            className="w-full bg-[#1e1e1e] border border-line rounded-lg px-3 py-2 text-sm text-[#f2ede4]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Objectif Taux de Conversion Win Rate (%)</label>
          <input
            type="number"
            value={targets.target_win_rate}
            onChange={(e) => setTargets({ ...targets, target_win_rate: Number(e.target.value) })}
            className="w-full bg-[#1e1e1e] border border-line rounded-lg px-3 py-2 text-sm text-[#f2ede4]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Objectif Réponses Positives Prospection</label>
          <input
            type="number"
            value={targets.target_prospection_positive}
            onChange={(e) => setTargets({ ...targets, target_prospection_positive: Number(e.target.value) })}
            className="w-full bg-[#1e1e1e] border border-line rounded-lg px-3 py-2 text-sm text-[#f2ede4]"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveTargets}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#D4C4A8] text-[#0d0d0d] font-bold text-xs rounded-lg hover:bg-[#e2d5bd] transition-all"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : 'Enregistrer les Objectifs'}
        </button>
      </div>

      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#f2ede4]">
            <Calendar className="w-4 h-4 text-[#D4C4A8]" />
            Historique des réunions CODIR ({codirDates.length})
          </div>
          <button
            onClick={handleAddTodayCodir}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e1e] border border-line text-xs font-medium text-[#D4C4A8] rounded-lg hover:bg-[#252525] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Enregistrer le CODIR d'aujourd'hui
          </button>
        </div>
        {codirDates.length === 0 ? (
          <p className="text-xs text-ink-faint italic">Aucune date enregistrée. Cliquez ci-dessus pour marquer votre premier CODIR.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {codirDates.map((date) => (
              <span key={date} className="px-2.5 py-1 bg-[#1e1e1e] border border-line text-xs text-[#f2ede4] rounded-md font-mono">
                {date}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Lier le composant dans `src/views/Settings.tsx`**

Integrate `<DashboardTargetsSettings />` inside `Settings.tsx`.

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add src/views/settings/DashboardTargetsSettings.tsx src/views/Settings.tsx
rtk git commit -m "feat: add dashboard targets and codir history settings UI"
```

---

### Task 4: Composants de l'En-tête Comparatif (`DashboardHeader.tsx`)

**Files:**
- Create: `src/views/dashboard/DashboardHeader.tsx`

**Interfaces:**
- Consumes: `codirDates: string[]`, `onComparisonChange()`, `onExportCsv()`.
- Produces: Header avec sélecteur de comparaison (CODIR N vs N-1 vs Personnalisé).

- [ ] **Step 1: Implémenter `DashboardHeader.tsx`**

Affiche le titre "Dashboard", la bascule entre "Comparaison CODIR" et "Périodes Personnalisées", la liste des dates CODIR disponibles, et le bouton d'export CSV.

- [ ] **Step 2: Commit**

```bash
rtk git add src/views/dashboard/DashboardHeader.tsx
rtk git commit -m "feat: add dashboard header with comparative period controls"
```

---

### Task 5: Onglets du Dashboard (`DashboardCodirTab`, `DashboardPipelineTab`, `DashboardOutreachTab`, `DashboardTasksTab`)

**Files:**
- Create: `src/views/dashboard/DashboardCodirTab.tsx`
- Create: `src/views/dashboard/DashboardPipelineTab.tsx`
- Create: `src/views/dashboard/DashboardOutreachTab.tsx`
- Create: `src/views/dashboard/DashboardTasksTab.tsx`

**Interfaces:**
- Consumes: Utilitaires de calcul, données Supabase (leads, tasks, email_logs, history, team_members).
- Produces: Les 4 onglets modulaires du Dashboard.

- [ ] **Step 1: Implémenter `DashboardCodirTab.tsx` (Jauges Objectifs vs Réel, Deltas, Hot Deals, SLA)**
- [ ] **Step 2: Implémenter `DashboardPipelineTab.tsx` (Progression des leads, Funnel, Segments, Sources)**
- [ ] **Step 3: Implémenter `DashboardOutreachTab.tsx` (Envois email, Open/Reply rates, Sentiment IA Gemini)**
- [ ] **Step 4: Implémenter `DashboardTasksTab.tsx` (Résumé des tâches par membre : accomplies vs restant à faire)**
- [ ] **Step 5: Commit des 4 onglets**

```bash
rtk git add src/views/dashboard/
rtk git commit -m "feat: implement 4 dashboard tabs (CODIR, Pipeline, Outreach, Tasks)"
```

---

### Task 6: Vue Principale `Dashboard.tsx` & Nettoyage de l'Ancienne Vue Codir

**Files:**
- Create: `src/views/Dashboard.tsx`
- Modify: `src/App.tsx`
- Modify: `src/layouts/Portal.tsx`
- Remove: `src/views/Codir.tsx`, `src/views/codir/`
- Replace/Deprecate: `src/views/Stats.tsx`

- [ ] **Step 1: Implémenter `src/views/Dashboard.tsx` qui assemble le Header et les 4 Onglets avec la gestion du state comparatif.**
- [ ] **Step 2: Supprimer `src/views/Codir.tsx` et son sous-dossier `src/views/codir/`.**
- [ ] **Step 3: Remplacer le contenu de `src/views/Stats.tsx` par un composant d'export/redirection vers `Dashboard.tsx`.**
- [ ] **Step 4: Mettre à jour `src/App.tsx` et `src/layouts/Portal.tsx` pour rediriger la route `/stats` et `/codir` vers `/dashboard`, et mettre à jour le lien de navigation dans la sidebar ("Dashboard").**
- [ ] **Step 5: Vérifier que l'application compile sans aucune erreur**

Run: `npm run build`
Expected: Build réussi sans erreurs de types ni d'imports cassés.

- [ ] **Step 6: Commit final**

```bash
rtk git add src/
rtk git commit -m "refactor: unify stats and codir into Dashboard view and update navigation"
```

---

## Prochaine Étape & Option d'Exécution

Plan rédigé et enregistré dans `docs/superpowers/plans/2026-07-30-unified-dashboard.md`.

Deux options pour lancer l'exécution du plan :

1. **Subagent-Driven (recommandé)** : Lancement d'un subagent autonome par tâche avec révision intermédiaire.
2. **Exécution Inline** : Exécution directe des tâches dans cette session avec points de contrôle.

**Quelle approche souhaitez-vous utiliser ?**
