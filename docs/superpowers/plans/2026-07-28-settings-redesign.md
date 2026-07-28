# Settings Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the frontend UI/UX of the Settings page and all four tab sub-components (`MembersTab`, `PipelineStagesTab`, `SlaTab`, `ProspectionSettingsTab`) using the Charcoal (`#0d0d0d`) and Beige (`#D4C4A8`) palette, Playfair Display 900 typography, horizontal pill tabs, and `AccentButton` components.

**Architecture:** Replace outdated legacy styles and HTML tables with responsive elevated cards (`#141414`), styled form controls, `AccentButton` elements, and a top navigation tab bar styled after `ProspectionHeader`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (@theme tokens), Lucide React icons, Vitest.

## Global Constraints
- Primary palette: Charcoal base `#0d0d0d`, Charcoal elevated `#141414`, Charcoal FG `#f2ede4`, Beige `#D4C4A8`.
- Page title typography: Playfair Display 900 (`font-family: 'Playfair Display', serif`).
- Buttons: Use `AccentButton` (`src/components/ui/AccentButton.tsx`) for primary actions and `Button` for secondary/danger actions.
- Preserve all existing state, handlers, and service integrations in `Settings.tsx` and all child tab components.

---

### Task 1: Redesign Main Settings Page Shell & Header Navigation (`src/views/Settings.tsx`)

**Files:**
- Modify: `src/views/Settings.tsx`
- Test: `src/views/Settings.test.tsx`

**Interfaces:**
- Consumes: `settingsService`, `useToast`, `useCachedResource`, Lucide icons (`Users`, `GitBranch`, `Sliders`, `Mail`)
- Produces: Redesigned Settings view header & tab navigation shell

- [ ] **Step 1: Create unit test for Settings page rendering**

Create `src/views/Settings.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Settings } from './Settings';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/settingsService', () => ({
  settingsService: {
    getTeamMembers: vi.fn().mockResolvedValue([]),
    getPipelineStages: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue([]),
  },
}));

describe('Settings View', () => {
  it('renders page header and navigation tabs', async () => {
    render(
      <ToastProvider>
        <Settings />
      </ToastProvider>
    );
    expect(await screen.findByText('Paramètres')).toBeDefined();
    expect(screen.getByText("Membres de l'équipe")).toBeDefined();
    expect(screen.getByText('Étapes du Pipeline')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify initial state**

Run: `npx vitest run src/views/Settings.test.tsx`

- [ ] **Step 3: Redesign `Settings.tsx` shell & tabs**

Update `src/views/Settings.tsx` top structure to include Playfair Display title and horizontal pill navigation styled with Charcoal/Beige:

```tsx
// Header title:
<h1
  style={{
    fontFamily: "'Playfair Display', serif",
    fontWeight: 900,
    fontSize: "2.25rem",
    color: "var(--color-charcoal-fg, #f2ede4)",
    letterSpacing: "-0.02em",
    lineHeight: 1,
  }}
>
  Paramètres
</h1>
<p className="mt-1 text-xs text-ink-soft">
  Gérez les membres de l'équipe, le pipeline commercial, les règles SLA et la prospection.
</p>

// Navigation tabs:
<div className="flex items-center gap-2 flex-wrap font-ui my-6">
  {TABS.map((tab) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-control transition-all cursor-pointer border ${
          isActive
            ? 'bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus shadow-sm'
            : 'bg-surface text-ink-soft border-line-strong hover:text-ink hover:border-line-focus'
        }`}
        onClick={() => setActiveTab(tab.id as any)}
      >
        <Icon size={14} strokeWidth={2} />
        {tab.label}
      </button>
    );
  })}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/Settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/views/Settings.tsx src/views/Settings.test.tsx
git commit -m "style(settings): redesign settings header and top pill navigation shell"
```

---

### Task 2: Redesign MembersTab Component (`src/views/settings/MembersTab.tsx`)

**Files:**
- Modify: `src/views/settings/MembersTab.tsx`

**Interfaces:**
- Consumes: `TeamMember`, `AccentButton`, `Button`, `Field`
- Produces: Charcoal & Beige styled team member management panel

- [ ] **Step 1: Redesign `MembersTab.tsx` layout and cards**

Update `src/views/settings/MembersTab.tsx`:
- Convert member table to a sleek elevated list with initial avatars and role badges.
- Use `AccentButton` for submit action ("Ajouter le membre" / "Enregistrer les modifications").
- Style active member list in `#141414` elevated card with `#D4C4A8` borders.

```tsx
import React from 'react';
import type { TeamMember } from '../../services/settingsService';
import { Trash2, Edit2, UserPlus, UserCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';

interface MembersTabProps {
  members: TeamMember[];
  editingMemberId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStartEdit: (member: TeamMember) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}

export const MembersTab: React.FC<MembersTabProps> = ({
  members,
  editingMemberId,
  firstName,
  lastName,
  email,
  onFirstNameChange,
  onLastNameChange,
  onEmailChange,
  onSubmit,
  onStartEdit,
  onCancelEdit,
  onDelete,
}) => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
    {/* Active Members Card */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Membres de l'équipe</h2>
          <p className="text-[11px] text-ink-soft">Collaborateurs ayant accès au CRM</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#D4C4A8]/15 text-[#D4C4A8] border border-line-focus">
          {members.length} membres
        </span>
      </div>

      <div className="overflow-hidden rounded-control border border-line bg-surface/50">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-surface text-[10.5px] font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-4 py-3">Membre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map(m => (
              <tr key={m.id} className="transition-colors hover:bg-hover/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                      style={{ background: m.color || '#6B5FE6' }}
                    >
                      {m.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-ink">{m.full_name}</div>
                      <div className="text-[11px] text-[#D4C4A8] font-medium">{m.role_label || 'Collaborateur'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">{m.email || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-hover hover:text-ink cursor-pointer"
                      onClick={() => onStartEdit(m)}
                      title="Modifier le membre"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                      onClick={() => onDelete(m.id)}
                      title="Retirer le membre"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Form Card */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="mb-4 pb-3 border-b border-line">
          <h2 className="font-display text-base font-bold text-ink">
            {editingMemberId ? 'Modifier le membre' : 'Ajouter un membre'}
          </h2>
          <p className="text-[11px] text-ink-soft">
            {editingMemberId ? 'Mettre à jour les informations du collaborateur' : 'Inviter un nouveau membre sur la plateforme'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Prénom *">
            <input
              type="text"
              placeholder="ex : Marie"
              value={firstName}
              onChange={e => onFirstNameChange(e.target.value)}
              required
              className={inputClass}
            />
          </Field>

          <Field label="NOM *">
            <input
              type="text"
              placeholder="ex : DURAND"
              value={lastName}
              onChange={e => onLastNameChange(e.target.value)}
              required
              className={inputClass}
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              placeholder="marie@entreprise.com"
              value={email}
              onChange={e => onEmailChange(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="mt-2 flex gap-2">
            <AccentButton type="submit" variant="primary" icon={editingMemberId ? <UserCheck size={14} /> : <UserPlus size={14} />} className="flex-1">
              {editingMemberId ? 'Enregistrer' : 'Ajouter le membre'}
            </AccentButton>
            {editingMemberId && (
              <Button type="button" variant="secondary" onClick={onCancelEdit}>Annuler</Button>
            )}
          </div>
        </form>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 2: Verify build & tests**

Run: `npm run build`
Expected: Build passes with no TypeScript errors.

- [ ] **Step 3: Commit changes**

```bash
git add src/views/settings/MembersTab.tsx
git commit -m "style(settings): redesign MembersTab with charcoal elevated card and AccentButton"
```

---

### Task 3: Redesign PipelineStagesTab Component (`src/views/settings/PipelineStagesTab.tsx`)

**Files:**
- Modify: `src/views/settings/PipelineStagesTab.tsx`

**Interfaces:**
- Consumes: `PipelineStage`, `AccentButton`, `Button`, `Badge`
- Produces: Sequence stage visualization panel and stage addition form

- [ ] **Step 1: Redesign `PipelineStagesTab.tsx`**

Update `src/views/settings/PipelineStagesTab.tsx`:
```tsx
import React from 'react';
import type { PipelineStage } from '../../services/settingsService';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { AccentButton } from '../../components/ui/AccentButton';
import { Badge } from '../../components/ui/Badge';
import { Field, inputClass } from '../../components/ui/Field';

interface PipelineStagesTabProps {
  stages: PipelineStage[];
  newStageName: string;
  newStageColor: string;
  newStageIsWon: boolean;
  onNameChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onIsWonChange: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: (id: string) => void;
}

export const PipelineStagesTab: React.FC<PipelineStagesTabProps> = ({
  stages,
  newStageName,
  newStageColor,
  newStageIsWon,
  onNameChange,
  onColorChange,
  onIsWonChange,
  onSubmit,
  onDelete,
}) => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
    {/* Stages sequence list */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Processus commercial</h2>
          <p className="text-[11px] text-ink-soft">Étapes configurées dans le pipeline kanban</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#D4C4A8]/15 text-[#D4C4A8] border border-line-focus">
          {stages.length} étapes
        </span>
      </div>

      <div className="space-y-3">
        {stages.map((st) => (
          <div
            key={st.id}
            className="flex items-center justify-between p-3.5 rounded-control border border-line bg-surface/60 transition-all hover:border-line-strong"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-hover text-xs font-bold text-[#D4C4A8] border border-line">
                #{st.position}
              </span>
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 rounded-full shadow-sm shrink-0" style={{ background: st.color }} />
                <span className="font-semibold text-ink text-sm">{st.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {st.is_closed_won ? (
                <Badge tone="success">
                  <CheckCircle2 size={12} className="mr-1 inline" /> Gagné
                </Badge>
              ) : (
                <Badge tone="neutral">Actif</Badge>
              )}
              <button
                type="button"
                className="p-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                onClick={() => onDelete(st.id)}
                disabled={st.is_closed_won}
                title="Supprimer l'étape"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Create Stage Card */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="mb-4 pb-3 border-b border-line">
        <h2 className="font-display text-base font-bold text-ink">Ajouter une étape</h2>
        <p className="text-[11px] text-ink-soft">Créer une nouvelle étape dans le tunnel de vente</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Nom de l'étape *">
          <input
            type="text"
            placeholder="ex : Négociation"
            value={newStageName}
            onChange={e => onNameChange(e.target.value)}
            required
            className={inputClass}
          />
        </Field>

        <Field label="Couleur d'identification">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={newStageColor}
              onChange={e => onColorChange(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-control border border-line-strong bg-base p-1 shrink-0"
            />
            <span className="text-xs font-mono text-ink-soft">{newStageColor}</span>
          </div>
        </Field>

        <label className="flex items-start gap-2.5 pt-1 text-xs text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={newStageIsWon}
            onChange={e => onIsWonChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-[#D4C4A8]"
          />
          <span>Marquer comme étape finale de succès (Lead gagné)</span>
        </label>

        <AccentButton type="submit" variant="primary" icon={<Plus size={14} />} className="mt-2 w-full">
          Créer l'étape
        </AccentButton>
      </form>
    </div>
  </div>
);
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit changes**

```bash
git add src/views/settings/PipelineStagesTab.tsx
git commit -m "style(settings): redesign PipelineStagesTab with visual sequence cards and AccentButton"
```

---

### Task 4: Redesign SlaTab & ProspectionSettingsTab Components

**Files:**
- Modify: `src/views/settings/SlaTab.tsx`
- Modify: `src/views/settings/ProspectionSettingsTab.tsx`

**Interfaces:**
- Consumes: `AccentButton`, `Field`, `inputClass`
- Produces: Redesigned SLA rules panel and Prospection settings card panel

- [ ] **Step 1: Redesign `SlaTab.tsx`**

Update `src/views/settings/SlaTab.tsx`:
```tsx
import React from 'react';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';
import { Save, Sparkles, Clock } from 'lucide-react';

interface SlaTabProps {
  slaMedia: number;
  slaRetail: number;
  slaInstit: number;
  aiScoring: boolean;
  onSlaMediaChange: (v: number) => void;
  onSlaRetailChange: (v: number) => void;
  onSlaInstitChange: (v: number) => void;
  onAiScoringChange: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const SlaTab: React.FC<SlaTabProps> = ({
  slaMedia,
  slaRetail,
  slaInstit,
  aiScoring,
  onSlaMediaChange,
  onSlaRetailChange,
  onSlaInstitChange,
  onAiScoringChange,
  onSubmit,
}) => (
  <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm max-w-4xl">
    <div className="flex items-center justify-between mb-5 pb-3 border-b border-line">
      <div>
        <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
          <Clock size={18} className="text-[#D4C4A8]" />
          Règles SLA et Automatisation
        </h2>
        <p className="text-[11px] text-ink-soft">Seuils de stagnation des leads et fonctionnalités IA</p>
      </div>
    </div>

    <form onSubmit={onSubmit}>
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field label="SLA Segment Media (jours max)">
          <input
            type="number"
            value={slaMedia}
            onChange={e => onSlaMediaChange(parseInt(e.target.value) || 1)}
            min={1}
            className={inputClass}
          />
          <span className="text-[10px] text-ink-soft mt-1 block">Alerte après {slaMedia} jours d'inactivité.</span>
        </Field>

        <Field label="SLA Segment Retail (jours max)">
          <input
            type="number"
            value={slaRetail}
            onChange={e => onSlaRetailChange(parseInt(e.target.value) || 1)}
            min={1}
            className={inputClass}
          />
          <span className="text-[10px] text-ink-soft mt-1 block">Alerte après {slaRetail} jours d'inactivité.</span>
        </Field>

        <Field label="SLA Segment Instit (jours max)">
          <input
            type="number"
            value={slaInstit}
            onChange={e => onSlaInstitChange(parseInt(e.target.value) || 1)}
            min={1}
            className={inputClass}
          />
          <span className="text-[10px] text-ink-soft mt-1 block">Alerte après {slaInstit} jours d'inactivité.</span>
        </Field>

        <div className="sm:col-span-3 mt-3 flex items-center justify-between border-t border-line pt-5 bg-surface/40 p-4 rounded-control">
          <div>
            <div className="text-[13px] font-semibold text-ink flex items-center gap-2">
              <Sparkles size={15} className="text-[#D4C4A8]" />
              Enrichissement & Scoring Automatique ICP
            </div>
            <div className="mt-0.5 text-[11px] text-ink-soft max-w-xl">
              Calculer automatiquement le score ICP et enrichir les informations lors de la création d'un prospect.
            </div>
          </div>

          <label className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={aiScoring}
              onChange={e => onAiScoringChange(e.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-hover transition-colors peer-checked:bg-[#D4C4A8]"></span>
            <span className="absolute left-0.5 h-5 w-5 rounded-full bg-[#0d0d0d] transition-transform peer-checked:translate-x-5"></span>
          </label>
        </div>
      </div>

      <AccentButton type="submit" variant="primary" icon={<Save size={14} />}>
        Enregistrer les paramètres
      </AccentButton>
    </form>
  </div>
);
```

- [ ] **Step 2: Redesign `ProspectionSettingsTab.tsx`**

Update `src/views/settings/ProspectionSettingsTab.tsx`:
```tsx
import React from 'react';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';
import { Save, ShieldCheck, MailCheck } from 'lucide-react';

interface ProspectionSettingsTabProps {
  followup1Days: number;
  followup2Days: number;
  archiveAfter: number;
  gmailDailyCap: number | null;
  gmailWarmupStartDate: string | null;
  gmailWindowStart: string;
  gmailWindowEnd: string;
  gmailFromName: string;
  onFollowup1DaysChange: (v: number) => void;
  onFollowup2DaysChange: (v: number) => void;
  onArchiveAfterChange: (v: number) => void;
  onGmailDailyCapChange: (v: number | null) => void;
  onGmailWarmupStartDateChange: (v: string | null) => void;
  onGmailWindowStartChange: (v: string) => void;
  onGmailWindowEndChange: (v: string) => void;
  onGmailFromNameChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ProspectionSettingsTab: React.FC<ProspectionSettingsTabProps> = ({
  followup1Days,
  followup2Days,
  archiveAfter,
  gmailDailyCap,
  gmailWarmupStartDate,
  gmailWindowStart,
  gmailWindowEnd,
  gmailFromName,
  onFollowup1DaysChange,
  onFollowup2DaysChange,
  onArchiveAfterChange,
  onGmailDailyCapChange,
  onGmailWarmupStartDateChange,
  onGmailWindowStartChange,
  onGmailWindowEndChange,
  onGmailFromNameChange,
  onSubmit,
}) => (
  <div className="space-y-6 max-w-4xl">
    {/* Anti-spam Gmail Section */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
        <div>
          <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#D4C4A8]" />
            Envoi Gmail & Warm-up Anti-Spam
          </h2>
          <p className="text-[11px] text-ink-soft mt-0.5">
            Pacing quotidien et plage horaire pour protéger la délivrabilité de votre compte.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Date de début du warm-up">
            <input
              type="date"
              value={gmailWarmupStartDate ?? ''}
              onChange={(e) => onGmailWarmupStartDateChange(e.target.value || null)}
              className={inputClass}
            />
          </Field>

          <Field label="Plafond quotidien cible">
            <input
              type="number"
              value={gmailDailyCap ?? ''}
              onChange={(e) => onGmailDailyCapChange(e.target.value ? parseInt(e.target.value) : null)}
              min={1}
              className={inputClass}
            />
            <span className="text-[10px] text-ink-soft mt-1 block">Volume max emails/jour.</span>
          </Field>

          <Field label="Fenêtre d'envoi (Début)">
            <input type="time" value={gmailWindowStart} onChange={(e) => onGmailWindowStartChange(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Fenêtre d'envoi (Fin)">
            <input type="time" value={gmailWindowEnd} onChange={(e) => onGmailWindowEndChange(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Nom d'expéditeur affiché" className="sm:col-span-2">
            <input
              value={gmailFromName}
              onChange={(e) => onGmailFromNameChange(e.target.value)}
              className={inputClass}
              placeholder="Seiki CRM"
            />
            <span className="text-[10px] text-ink-soft mt-1 block">Nom affiché avant l'adresse (ex: "{gmailFromName || 'Seiki CRM'}").</span>
          </Field>
        </div>
        <AccentButton type="submit" variant="primary" icon={<Save size={14} />}>
          Enregistrer la prospection
        </AccentButton>
      </form>
    </div>

    {/* Relances Section */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
        <div>
          <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
            <MailCheck size={18} className="text-[#D4C4A8]" />
            Séquence de Relance Automatique
          </h2>
          <p className="text-[11px] text-ink-soft mt-0.5">Intervalle de jours entre relances et règles d'archivage.</p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Délai 1ère relance (jours)">
            <input type="number" value={followup1Days} onChange={(e) => onFollowup1DaysChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>

          <Field label="Délai 2ème relance (jours)">
            <input type="number" value={followup2Days} onChange={(e) => onFollowup2DaysChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>

          <Field label="Relances avant archivage">
            <input type="number" value={archiveAfter} onChange={(e) => onArchiveAfterChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>
        </div>
        <AccentButton type="submit" variant="primary" icon={<Save size={14} />}>
          Enregistrer les relances
        </AccentButton>
      </form>
    </div>
  </div>
);
```

- [ ] **Step 3: Run full build and tests**

Run: `npm run build && npx vitest run`
Expected: Build passes with zero errors, tests pass.

- [ ] **Step 4: Commit changes**

```bash
git add src/views/settings/SlaTab.tsx src/views/settings/ProspectionSettingsTab.tsx
git commit -m "style(settings): redesign SlaTab and ProspectionSettingsTab with Charcoal and Beige AccentButtons"
```
