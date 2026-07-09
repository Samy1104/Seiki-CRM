# Prospection Simplify — Remove Campaigns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "campaigns" concept entirely from Prospection (UI, service, DB) and collapse the generation flow to a single validation queue, leaving 3 tabs: Templates, Validation, Relances.

**Architecture:** Delete campaign-specific code top-down (service methods that reference `campaign_id`/`campaigns` first, then the React components that call them, then the CSS), verify nothing in `src/` references those DB objects anymore, THEN drop them from the database last — this ordering means there's never a moment where running code depends on an object that's already been dropped.

**Tech Stack:** Same as the rest of this codebase — React 19 + TypeScript, Supabase (Postgres + generated Edge Functions unaffected), no automated test framework.

## Global Constraints

- No automated test framework in this repo — verification is `npm run build` (TypeScript/Vite) plus direct SQL against the real linked Supabase project, same methodology as every prior Prospection task.
- No browser-based UI verification available this session (no test credentials for the app's real Supabase Auth login) — rely on build + code review + SQL checks.
- This is a real shared remote Supabase project. The final DB migration (Task 5) is genuinely destructive (`DROP TABLE`) — the user has explicitly confirmed no existing campaign data needs preserving and no backup is required.
- Schema/SQL files are flat `.sql` files at the repo root, matching the existing convention (`schema_supabase.sql`, `schema_prospection_addon.sql`, `schema_prospection_v2_*.sql`).
- French UI copy throughout, matching the rest of the app.

---

## File Structure

**New files:**
- `Projet/schema_prospection_v3_cleanup.sql` — drops the campaign-related trigger/function/view/column/table (Task 5)
- `Projet/src/services/emailsService.ts` — replaces `campaignsService.ts`, trimmed to non-campaign methods (Task 2)

**Deleted files:**
- `Projet/src/services/campaignsService.ts` (Task 2)

**Modified files:**
- `Projet/src/services/prospectionService.ts` — remove `campaign_id` references (Task 1)
- `Projet/src/views/Prospection.tsx` — remove campaigns UI, collapse Génération→Validation (Task 3)
- `Projet/src/index.css` — remove dead `.campaign-*` rules (Task 4)

---

### Task 1: Remove `campaign_id` references from `prospectionService.ts`

**Files:**
- Modify: `Projet/src/services/prospectionService.ts:86-99` (query select list), `:175-187` (insert payload)

**Interfaces:**
- No signature changes — `getFollowUpCandidates()` and `createFollowUpDraft(lead, step)` keep their exact current return types. This task only removes a field that will no longer exist once Task 5's migration runs.

- [ ] **Step 1: Remove `campaign_id` from the `getFollowUpCandidates` select query**

In `Projet/src/services/prospectionService.ts`, find this exact block (around line 86-99):

```typescript
    const { data: sentEmails, error } = await supabase
      .from('generated_emails')
      .select(`
        lead_id,
        sent_at,
        campaign_id,
        lead:leads!lead_id(
          id, contact_name, company_name, email, segment, sequence_status,
          is_archived, merged_into_id, poste, enrichi_contexte, custom_fields,
          score, stage_id, owner_id, created_at, updated_at,
          note, email_verified, phone, linkedin_url, website, domain,
          deal_value, source, days_in_stage, stage_changed_at
        )
      `)
```

Replace with (removes the `campaign_id,` line — it was fetched but never read anywhere in this function):

```typescript
    const { data: sentEmails, error } = await supabase
      .from('generated_emails')
      .select(`
        lead_id,
        sent_at,
        lead:leads!lead_id(
          id, contact_name, company_name, email, segment, sequence_status,
          is_archived, merged_into_id, poste, enrichi_contexte, custom_fields,
          score, stage_id, owner_id, created_at, updated_at,
          note, email_verified, phone, linkedin_url, website, domain,
          deal_value, source, days_in_stage, stage_changed_at
        )
      `)
```

- [ ] **Step 2: Remove `campaign_id: null` from the `createFollowUpDraft` insert**

Find this exact block (around line 175-187):

```typescript
    const { data, error } = await supabase
      .from('generated_emails')
      .insert([{
        lead_id: lead.id,
        campaign_id: null,
        step,
        sujet: rendered.subject,
        corps_du_mail: rendered.body,
        statut_envoi: 'draft',
        model_used: 'template',
      }])
      .select('id, sujet, corps_du_mail')
      .single();
```

Replace with:

```typescript
    const { data, error } = await supabase
      .from('generated_emails')
      .insert([{
        lead_id: lead.id,
        step,
        sujet: rendered.subject,
        corps_du_mail: rendered.body,
        statut_envoi: 'draft',
        model_used: 'template',
      }])
      .select('id, sujet, corps_du_mail')
      .single();
```

- [ ] **Step 3: Verify with `npm run build`**

Run: `cd Projet && npm run build`
Expected: clean build, no new errors (this file's callers — `Prospection.tsx`'s `FollowUpTab` — aren't affected by this change, signatures are unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/services/prospectionService.ts
git commit -m "refactor(prospection): remove campaign_id references from prospectionService"
```

---

### Task 2: Replace `campaignsService.ts` with trimmed `emailsService.ts`

**Files:**
- Create: `Projet/src/services/emailsService.ts`
- Delete: `Projet/src/services/campaignsService.ts`

**Interfaces:**
- Consumes: `supabase` client (`./supabaseClient`), Postgres RPC `schedule_send` (unchanged), Edge Functions `send-email`/`flush-send-queue` (unchanged).
- Produces (consumed by Task 3):
  ```typescript
  export interface GeneratedEmail {
    id: string;
    lead_id: string;
    sequence_step_id: string | null;
    sujet: string;
    corps_du_mail: string;
    icebreaker: string | null;
    statut_envoi: 'draft' | 'approved' | 'sending' | 'sent' | 'failed';
    model_used: string;
    prompt_used: string | null;
    generation_ms: number | null;
    approved_by: string | null;
    approved_at: string | null;
    sent_at: string | null;
    scheduled_at: string | null;
    resend_message_id: string | null;
    created_at: string;
    lead?: {
      contact_name: string;
      company_name: string;
      email: string | null;
      poste: string | null;
      segment: string;
    } | null;
  }
  export interface SendResult {
    success: boolean;
    resendMessageId: string;
    sentAt: string;
    to: string;
  }
  export const emailsService = {
    getGeneratedEmails(statut?: GeneratedEmail['statut_envoi']): Promise<GeneratedEmail[]>,
    getGeneratedEmailById(id: string): Promise<GeneratedEmail>,
    updateGeneratedEmail(id: string, updates: Partial<Pick<GeneratedEmail, 'sujet' | 'corps_du_mail' | 'icebreaker' | 'statut_envoi' | 'scheduled_at'>>): Promise<void>,
    approveAndSchedule(generatedEmailId: string): Promise<{ scheduledAt: string }>,
    sendEmail(generatedEmailId: string, options?: { fromEmail?: string; fromName?: string }): Promise<SendResult>,
    flushSendQueue(): Promise<{ processed: number; sent: number; failed: number; skipped?: string }>,
    deleteGeneratedEmail(id: string): Promise<void>,
  }
  ```

- [ ] **Step 1: Write `emailsService.ts`**

```typescript
// ============================================================
// emailsService.ts
// Gère les emails générés (drafts, approbation, envoi).
// Fait le pont entre le UI React et Supabase (DB + Edge Fns).
// ============================================================

import { supabase } from './supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GeneratedEmail {
  id: string;
  lead_id: string;
  sequence_step_id: string | null;
  sujet: string;
  corps_du_mail: string;
  icebreaker: string | null;
  statut_envoi: 'draft' | 'approved' | 'sending' | 'sent' | 'failed';
  model_used: string;
  prompt_used: string | null;
  generation_ms: number | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
  resend_message_id: string | null;
  created_at: string;
  // Données du lead joinées
  lead?: {
    contact_name: string;
    company_name: string;
    email: string | null;
    poste: string | null;
    segment: string;
  } | null;
}

export interface SendResult {
  success: boolean;
  resendMessageId: string;
  sentAt: string;
  to: string;
}

// ── Service ────────────────────────────────────────────────────────────────────

export const emailsService = {

  /** Récupère tous les emails générés, filtrés optionnellement par statut */
  async getGeneratedEmails(statut?: GeneratedEmail['statut_envoi']): Promise<GeneratedEmail[]> {
    let query = supabase
      .from('generated_emails')
      .select(`
        *,
        lead:leads!lead_id(contact_name, company_name, email, poste, segment)
      `)
      .order('created_at', { ascending: false });

    if (statut) {
      query = query.eq('statut_envoi', statut);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as GeneratedEmail[];
  },

  /** Récupère un email généré par ID */
  async getGeneratedEmailById(id: string): Promise<GeneratedEmail> {
    const { data, error } = await supabase
      .from('generated_emails')
      .select(`
        *,
        lead:leads!lead_id(contact_name, company_name, email, poste, segment)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as GeneratedEmail;
  },

  /** Met à jour le corps/sujet d'un email généré (édition manuelle) */
  async updateGeneratedEmail(
    id: string,
    updates: Partial<Pick<GeneratedEmail, 'sujet' | 'corps_du_mail' | 'icebreaker' | 'statut_envoi' | 'scheduled_at'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('generated_emails')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  /** Approuve un email ET le planifie sous quota */
  async approveAndSchedule(generatedEmailId: string): Promise<{ scheduledAt: string }> {
    const { data, error } = await supabase.rpc('schedule_send', { p_generated_email_id: generatedEmailId });
    if (error) throw error;
    return { scheduledAt: data as string };
  },

  /**
   * Envoie un email approuvé via l'Edge Function Resend.
   */
  async sendEmail(
    generatedEmailId: string,
    options?: { fromEmail?: string; fromName?: string }
  ): Promise<SendResult> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ generatedEmailId, ...options }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `Erreur envoi (${response.status})`);
    }

    return data as SendResult;
  },

  /** Déclenche la purge de la file d'envoi du jour (bouton manuel) */
  async flushSendQueue(): Promise<{ processed: number; sent: number; failed: number; skipped?: string }> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/flush-send-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ triggeredBy: 'manual-button' }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Erreur purge file (${response.status})`);
    }
    return data;
  },

  /** Supprime un email généré */
  async deleteGeneratedEmail(id: string): Promise<void> {
    const { error } = await supabase
      .from('generated_emails')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
```

- [ ] **Step 2: Delete the old file**

```bash
rm Projet/src/services/campaignsService.ts
```

- [ ] **Step 3: Verify `npm run build`**

Run: `cd Projet && npm run build`
Expected: it WILL fail right now — `Prospection.tsx` still imports from `../services/campaignsService`. That's expected; Task 3 fixes it. Confirm the error is specifically a missing-module error for `campaignsService` in `Prospection.tsx`, nothing else.

- [ ] **Step 4: Commit**

```bash
git add src/services/emailsService.ts src/services/campaignsService.ts
git commit -m "refactor(prospection): replace campaignsService with trimmed emailsService"
```

(The delete of `campaignsService.ts` is captured by `git add` on a removed path — `git status` will show it as staged for deletion.)

---

### Task 3: Rework `Prospection.tsx` — remove campaigns UI, collapse to Validation tab

**Files:**
- Modify: `Projet/src/views/Prospection.tsx` (extensive — imports, tab type, main component, delete 3 components, rewrite 1 component, trim 1 component)

**Interfaces:**
- Consumes: `emailsService` (Task 2) — `getGeneratedEmails`, `flushSendQueue`, `approveAndSchedule`, `sendEmail`, `updateGeneratedEmail`, `deleteGeneratedEmail`, and the `GeneratedEmail` type.
- Produces: `Tab = 'validation' | 'templates' | 'followup'` (no other file depends on this type — it's local to this file).

- [ ] **Step 1: Fix imports and the `Tab` type**

Find this exact block (lines 1-18):

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Plus, Play, Pause, BarChart3, Mail,
  RefreshCw, Check, X, Edit3, Send, ChevronDown, ChevronUp,
  AlertCircle, Loader, Eye, Trash2, Users, Zap, FileEdit
} from 'lucide-react';
import { campaignsService, type Campaign, type CampaignMetrics, type GeneratedEmail } from '../services/campaignsService';
import { prospectionService, type ProspectionLead } from '../services/prospectionService';
import { templatesService, type EmailTemplate } from '../services/templatesService';
import { leadsService, type Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabaseClient';
import { ProspectionModeToggle } from '../components/ProspectionModeToggle';
import './prospection.css';

// ── Onglets de la vue ──────────────────────────────────────────────────────────
type Tab = 'campaigns' | 'generation' | 'templates' | 'followup';
```

Replace with:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Mail, RefreshCw, Check, Edit3, Send, ChevronDown, ChevronUp,
  AlertCircle, Loader, Trash2, Zap, FileEdit
} from 'lucide-react';
import { emailsService, type GeneratedEmail } from '../services/emailsService';
import { prospectionService } from '../services/prospectionService';
import { templatesService, type EmailTemplate } from '../services/templatesService';
import { leadsService, type Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { ProspectionModeToggle } from '../components/ProspectionModeToggle';
import './prospection.css';

// ── Onglets de la vue ──────────────────────────────────────────────────────────
type Tab = 'validation' | 'templates' | 'followup';
```

(This drops the now-unused icons `Plus, Play, Pause, BarChart3, X, Eye, Users` — all were only used by the campaign UI being deleted in later steps — and drops the now-unused `supabase` direct import and `ProspectionLead` type import, both only used by the manual-generation code being deleted.)

- [ ] **Step 2: Replace every remaining `campaignsService.` call with `emailsService.`**

Search the rest of the file for the literal string `campaignsService.` and replace each occurrence with `emailsService.` — there are call sites in the main component's tab dispatch (removed in Step 3 below) and inside `EmailPreviewCard` (kept, Step 6 below). Doing this as one pass now means Steps 3-6 below can be applied without also having to fix identifiers.

- [ ] **Step 3: Delete `CampaignsTab` and replace `GenerationTab` with `ValidationTab`, update the main component**

Find this exact block — it spans from the start of the main `Prospection` component through the end of the old `GenerationTab` component (this is a large, single contiguous region in the file: main component + `CampaignsTab` + `GenerationTab`):

```typescript
export const Prospection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('campaigns');
  const { showToast } = useToast();
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setMode(s.prospection_mode));
  }, []);

  const handleModeChange = async (newMode: 'manual' | 'auto') => {
    const previousMode = mode;
    setMode(newMode);
    try {
      await settingsService.updateProspectionSettings({ prospection_mode: newMode });
      showToast(`Mode ${newMode === 'auto' ? 'automatique' : 'vérification humaine'} activé`, 'success');
    } catch {
      setMode(previousMode);
      showToast('Erreur changement de mode', 'error');
    }
  };

  return (
    <div className="prospection-view">
      {/* Header */}
      <div className="prospection-header">
        <div className="prospection-title">
          <Sparkles size={20} style={{ color: 'var(--purple)' }} />
          <h1>Prospection IA</h1>
          <span className="prospection-badge">Templates + fusion</span>
        </div>
        <ProspectionModeToggle mode={mode} onChange={handleModeChange} />
        <p className="prospection-subtitle">
          Générez et envoyez des emails ultra-personnalisés en quelques clics.
        </p>
      </div>

      {/* Tabs */}
      <div className="prospection-tabs">
        <button
          className={`pros-tab ${activeTab === 'campaigns' ? 'active' : ''}`}
          onClick={() => setActiveTab('campaigns')}
        >
          <BarChart3 size={14} /> Campagnes
        </button>
        <button
          className={`pros-tab ${activeTab === 'generation' ? 'active' : ''}`}
          onClick={() => setActiveTab('generation')}
        >
          <Sparkles size={14} /> Génération IA
        </button>
        <button
          className={`pros-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileEdit size={14} /> Templates
        </button>
        <button
          className={`pros-tab ${activeTab === 'followup' ? 'active' : ''}`}
          onClick={() => setActiveTab('followup')}
        >
          <RefreshCw size={14} /> Relances
        </button>
      </div>

      {/* Contenu selon l'onglet actif */}
      <div className="prospection-body">
        {activeTab === 'campaigns' && <CampaignsTab showToast={showToast} />}
        {activeTab === 'generation' && <GenerationTab showToast={showToast} />}
        {activeTab === 'templates' && <TemplatesTab showToast={showToast} />}
        {activeTab === 'followup' && <FollowUpTab showToast={showToast} />}
      </div>
    </div>
  );
};

// ── Tab Campagnes ──────────────────────────────────────────────────────────────

const CampaignsTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
  const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [quota, setQuota] = useState<number | null>(null);

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setQuota(s.daily_send_quota));
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const data = await emailsService.getCampaigns();
      setCampaigns(data);
    } catch (err) {
      showToast('Erreur chargement des campagnes', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const [unassignedCount, setUnassignedCount] = useState({ draft: 0, approved: 0, sent: 0 });

  const loadUnassigned = useCallback(async () => {
    const [draft, approved, sent] = await Promise.all([
      emailsService.getUnassignedGeneratedEmails('draft'),
      emailsService.getUnassignedGeneratedEmails('approved'),
      emailsService.getUnassignedGeneratedEmails('sent'),
    ]);
    setUnassignedCount({ draft: draft.length, approved: approved.length, sent: sent.length });
  }, []);

  useEffect(() => { loadUnassigned(); }, [loadUnassigned]);

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const result = await emailsService.flushSendQueue();
      if (result.skipped) {
        showToast(`Rien à envoyer : ${result.skipped}`, 'info');
      } else {
        showToast(`${result.sent}/${result.processed} emails envoyés`, result.failed > 0 ? 'info' : 'success');
      }
      loadCampaigns();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi du lot', 'error');
    } finally {
      setFlushing(false);
    }
  };

  const handleStatusToggle = async (campaign: CampaignMetrics) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    try {
      await emailsService.updateCampaign(campaign.id, { status: newStatus });
      showToast(`Campagne ${newStatus === 'active' ? 'activée' : 'mise en pause'}`, 'success');
      loadCampaigns();
    } catch {
      showToast('Erreur mise à jour statut', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette campagne ? Les emails générés seront également supprimés.')) return;
    try {
      await emailsService.deleteCampaign(id);
      showToast('Campagne supprimée', 'success');
      loadCampaigns();
    } catch {
      showToast('Erreur suppression', 'error');
    }
  };

  return (
    <div>
      <div className="pros-section-header">
        <h2>Campagnes actives</h2>
        <div className="flex gap-2">
          <button className="btn-secondary-sm" onClick={handleFlush} disabled={flushing}>
            {flushing ? <Loader size={13} className="spin" /> : <Send size={13} />}
            Envoyer le lot du jour {quota !== null ? `(quota: ${quota}/j)` : ''}
          </button>
          <button className="btn-primary-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={13} /> Nouvelle campagne
          </button>
        </div>
      </div>

      {loading ? (
        <div className="pros-loading"><Loader size={20} className="spin" /> Chargement...</div>
      ) : campaigns.length === 0 ? (
        <div className="pros-empty">
          <Sparkles size={32} style={{ color: 'var(--purple)', opacity: 0.5 }} />
          <p>Aucune campagne. Créez votre première campagne de prospection IA.</p>
          <button className="btn-primary-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={13} /> Créer une campagne
          </button>
        </div>
      ) : (
        <div className="campaigns-grid">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onToggle={() => handleStatusToggle(c)}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-4 p-4 rounded-xl bg-brand-bg-panel border border-brand-border">
        <div className="font-semibold text-brand-text mb-2">Flux automatique (sans campagne)</div>
        <div className="flex gap-6 text-brand-text-secondary text-sm">
          <span>{unassignedCount.draft} en attente</span>
          <span>{unassignedCount.approved} planifiés</span>
          <span>{unassignedCount.sent} envoyés</span>
        </div>
      </div>

      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadCampaigns(); showToast('Campagne créée !', 'success'); }}
        />
      )}
    </div>
  );
};

// ── Tab Génération IA ──────────────────────────────────────────────────────────

const GenerationTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<ProspectionLead[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'select' | 'review'>('select');
  const [subView, setSubView] = useState<'auto' | 'manual'>('auto');
  const [autoDrafts, setAutoDrafts] = useState<GeneratedEmail[]>([]);
  const [autoLoading, setAutoLoading] = useState(true);

  const loadAutoDrafts = useCallback(async () => {
    setAutoLoading(true);
    try {
      const drafts = await emailsService.getUnassignedGeneratedEmails('draft');
      setAutoDrafts(drafts);
    } catch {
      showToast('Erreur chargement de la file de validation', 'error');
    } finally {
      setAutoLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAutoDrafts(); }, [loadAutoDrafts]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [camps, prLeads] = await Promise.all([
          emailsService.getCampaigns(),
          prospectionService.getLeadsReadyForProspection(),
        ]);
        setCampaigns(camps);
        setLeads(prLeads);
      } catch (err) {
        showToast('Erreur chargement des données', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [showToast]);

  const toggleLead = (id: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedLeads(new Set(leads.map((l) => l.id)));
  };

  const clearAll = () => setSelectedLeads(new Set());

  const handleGenerate = async () => {
    if (!selectedCampaign) { showToast('Sélectionne une campagne', 'error'); return; }
    if (selectedLeads.size === 0) { showToast('Sélectionne au moins un lead', 'error'); return; }

    setIsGenerating(true);
    setProgress({ current: 0, total: selectedLeads.size });
    const leadIds = Array.from(selectedLeads);
    const templates = await templatesService.getTemplates();
    const generated: GeneratedEmail[] = [];
    const failedLeads: string[] = [];

    for (let i = 0; i < leadIds.length; i++) {
      const lead = leads.find((l) => l.id === leadIds[i]);
      setProgress({ current: i + 1, total: leadIds.length });
      if (!lead) { failedLeads.push(leadIds[i]); continue; }

      const template = templatesService.resolveTemplate(templates, lead.segment, 'initial');
      if (!template) { failedLeads.push(leadIds[i]); continue; }

      const rendered = templatesService.renderTemplate(template, lead);
      const { data, error } = await supabase
        .from('generated_emails')
        .insert([{
          lead_id: lead.id,
          campaign_id: selectedCampaign,
          step: 'initial',
          sujet: rendered.subject,
          corps_du_mail: rendered.body,
          statut_envoi: 'draft',
          model_used: 'template',
        }])
        .select(`*, lead:leads!lead_id(contact_name, company_name, email, poste, segment)`)
        .single();

      if (error || !data) failedLeads.push(leadIds[i]);
      else generated.push(data as GeneratedEmail);
    }

    setGeneratedEmails(generated);
    if (failedLeads.length > 0) {
      showToast(`${generated.length} emails générés, ${failedLeads.length} échecs (template manquant pour le segment)`, 'info');
    } else {
      showToast(`${generated.length} emails générés avec succès !`, 'success');
    }
    setViewMode('review');
    setIsGenerating(false);
  };

  const handleReload = async () => {
    if (!selectedCampaign) return;
    const emails = await emailsService.getGeneratedEmails(selectedCampaign, 'draft');
    setGeneratedEmails(emails);
    setViewMode('review');
  };

  if (loading) return <div className="pros-loading"><Loader size={20} className="spin" /> Chargement...</div>;

  return (
    <div>
      <div className="pros-section-header">
        <h2>{subView === 'auto' ? 'File de validation (auto-pipeline)' : viewMode === 'select' ? 'Génération manuelle' : `${generatedEmails.length} emails générés`}</h2>
        <div className="flex gap-2">
          <button className={`btn-ghost-sm ${subView === 'auto' ? 'active' : ''}`} onClick={() => setSubView('auto')}>Auto ({autoDrafts.length})</button>
          <button className={`btn-ghost-sm ${subView === 'manual' ? 'active' : ''}`} onClick={() => setSubView('manual')}>Manuelle</button>
        </div>
        {subView === 'manual' && viewMode === 'review' && (
          <button className="btn-secondary-sm" onClick={() => setViewMode('select')}>
            ← Retour à la sélection
          </button>
        )}
      </div>

      {subView === 'auto' && (
        autoLoading ? (
          <div className="pros-loading"><Loader size={20} className="spin" /> Chargement...</div>
        ) : autoDrafts.length === 0 ? (
          <div className="pros-empty">
            <Mail size={28} style={{ opacity: 0.4 }} />
            <p>Aucun draft en attente — tout lead ajouté avec un email génère automatiquement son 1er mail ici.</p>
          </div>
        ) : (
          <div className="gen-review-list">
            {autoDrafts.map((email) => (
              <EmailPreviewCard
                key={email.id}
                email={email}
                showToast={showToast}
                onUpdate={() => setAutoDrafts((prev) => prev.filter((e) => e.id !== email.id))}
                queueMode
              />
            ))}
          </div>
        )
      )}

      {subView === 'manual' && (
      <>
      {viewMode === 'select' && (
        <>
          {/* Sélection campagne */}
          <div className="gen-field-group">
            <label className="gen-label">Campagne *</label>
            <select
              className="gen-select"
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
            >
              <option value="">-- Choisir une campagne --</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.objective})</option>
              ))}
            </select>
          </div>

          {/* Liste des leads */}
          <div className="gen-leads-section">
            <div className="gen-leads-header">
              <span>{leads.length} leads éligibles</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-ghost-sm" onClick={selectAll}>Tout sélectionner</button>
                <button className="btn-ghost-sm" onClick={clearAll}>Désélectionner</button>
              </div>
            </div>

            <div className="gen-leads-list">
              {leads.length === 0 ? (
                <div className="pros-empty">
                  <Users size={28} style={{ opacity: 0.4 }} />
                  <p>Aucun lead éligible (email manquant ou déjà en séquence complétée).</p>
                </div>
              ) : (
                leads.map((lead) => (
                  <label key={lead.id} className={`gen-lead-row ${selectedLeads.has(lead.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedLeads.has(lead.id)}
                      onChange={() => toggleLead(lead.id)}
                    />
                    <div className="gen-lead-info">
                      <span className="gen-lead-name">{lead.contact_name}</span>
                      <span className="gen-lead-company">{lead.company_name}</span>
                      {lead.poste && <span className="gen-lead-poste">{lead.poste}</span>}
                    </div>
                    <div className="gen-lead-meta">
                      <span className={`tag-segment seg-${lead.segment.toLowerCase()}`}>{lead.segment}</span>
                      {lead.enrichi_contexte && (
                        <span title="Contexte enrichi disponible" style={{ color: 'var(--green)', fontSize: '10px' }}>✦ enrichi</span>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="gen-actions-bar">
            <span className="gen-count">{selectedLeads.size} sélectionné(s)</span>
            {isGenerating ? (
              <div className="gen-progress">
                <Loader size={14} className="spin" />
                <span>Génération {progress.current}/{progress.total}...</span>
                <div className="gen-progress-bar">
                  <div className="gen-progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-ghost-sm" onClick={handleReload}>
                  <Eye size={13} /> Voir les drafts existants
                </button>
                <button
                  className="btn-primary-sm"
                  onClick={handleGenerate}
                  disabled={selectedLeads.size === 0 || !selectedCampaign}
                >
                  <Sparkles size={13} />
                  Générer {selectedLeads.size > 0 ? `${selectedLeads.size} email(s)` : ''}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {viewMode === 'review' && (
        <div className="gen-review-list">
          {generatedEmails.length === 0 ? (
            <div className="pros-empty">
              <Mail size={28} style={{ opacity: 0.4 }} />
              <p>Aucun email en draft pour cette campagne.</p>
            </div>
          ) : (
            generatedEmails.map((email) => (
              <EmailPreviewCard
                key={email.id}
                email={email}
                showToast={showToast}
                onUpdate={() => {
                  setGeneratedEmails((prev) =>
                    prev.filter((e) => e.id !== email.id)
                  );
                }}
              />
            ))
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
};
```

This entire block above (main `Prospection` component + `CampaignsTab` + `GenerationTab`) is what Step 3 replaces. Replace ALL of it — from `export const Prospection: React.FC = () => {` through the closing `};` of `GenerationTab` shown above — with:

```typescript
export const Prospection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('validation');
  const { showToast } = useToast();
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setMode(s.prospection_mode));
  }, []);

  const handleModeChange = async (newMode: 'manual' | 'auto') => {
    const previousMode = mode;
    setMode(newMode);
    try {
      await settingsService.updateProspectionSettings({ prospection_mode: newMode });
      showToast(`Mode ${newMode === 'auto' ? 'automatique' : 'vérification humaine'} activé`, 'success');
    } catch {
      setMode(previousMode);
      showToast('Erreur changement de mode', 'error');
    }
  };

  return (
    <div className="prospection-view">
      {/* Header */}
      <div className="prospection-header">
        <div className="prospection-title">
          <Sparkles size={20} style={{ color: 'var(--purple)' }} />
          <h1>Prospection IA</h1>
          <span className="prospection-badge">Templates + fusion</span>
        </div>
        <ProspectionModeToggle mode={mode} onChange={handleModeChange} />
        <p className="prospection-subtitle">
          Générez et envoyez des emails ultra-personnalisés en quelques clics.
        </p>
      </div>

      {/* Tabs */}
      <div className="prospection-tabs">
        <button
          className={`pros-tab ${activeTab === 'validation' ? 'active' : ''}`}
          onClick={() => setActiveTab('validation')}
        >
          <Mail size={14} /> Validation
        </button>
        <button
          className={`pros-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileEdit size={14} /> Templates
        </button>
        <button
          className={`pros-tab ${activeTab === 'followup' ? 'active' : ''}`}
          onClick={() => setActiveTab('followup')}
        >
          <RefreshCw size={14} /> Relances
        </button>
      </div>

      {/* Contenu selon l'onglet actif */}
      <div className="prospection-body">
        {activeTab === 'validation' && <ValidationTab showToast={showToast} />}
        {activeTab === 'templates' && <TemplatesTab showToast={showToast} />}
        {activeTab === 'followup' && <FollowUpTab showToast={showToast} />}
      </div>
    </div>
  );
};

// ── Tab Validation ──────────────────────────────────────────────────────────────

const ValidationTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
  const [drafts, setDrafts] = useState<GeneratedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const [quota, setQuota] = useState<number | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await emailsService.getGeneratedEmails('draft');
      setDrafts(data);
    } catch {
      showToast('Erreur chargement de la file de validation', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setQuota(s.daily_send_quota));
  }, []);

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const result = await emailsService.flushSendQueue();
      if (result.skipped) {
        showToast(`Rien à envoyer : ${result.skipped}`, 'info');
      } else {
        showToast(`${result.sent}/${result.processed} emails envoyés`, result.failed > 0 ? 'info' : 'success');
      }
      loadDrafts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi du lot', 'error');
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div>
      <div className="pros-section-header">
        <h2>File de validation</h2>
        <button className="btn-secondary-sm" onClick={handleFlush} disabled={flushing}>
          {flushing ? <Loader size={13} className="spin" /> : <Send size={13} />}
          Envoyer le lot du jour {quota !== null ? `(quota: ${quota}/j)` : ''}
        </button>
      </div>

      {loading ? (
        <div className="pros-loading"><Loader size={20} className="spin" /> Chargement...</div>
      ) : drafts.length === 0 ? (
        <div className="pros-empty">
          <Mail size={28} style={{ opacity: 0.4 }} />
          <p>Aucun draft en attente — tout lead ajouté avec un email génère automatiquement son 1er mail ici.</p>
        </div>
      ) : (
        <div className="gen-review-list">
          {drafts.map((email) => (
            <EmailPreviewCard
              key={email.id}
              email={email}
              showToast={showToast}
              onUpdate={() => setDrafts((prev) => prev.filter((e) => e.id !== email.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Delete the `CampaignCard` component**

Find this exact block (it sits between `FollowUpTab` and `EmailPreviewCard`):

```typescript
// ── Composant CampaignCard ────────────────────────────────────────────────────

const CampaignCard: React.FC<{
  campaign: CampaignMetrics;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ campaign, onToggle, onDelete }) => {
  const statusConfig = {
    draft: { label: 'Brouillon', color: 'var(--text-muted)' },
    active: { label: 'Active', color: 'var(--green)' },
    paused: { label: 'En pause', color: 'var(--gold)' },
    completed: { label: 'Terminée', color: 'var(--purple)' },
  };

  const s = statusConfig[campaign.status];

  return (
    <div className="campaign-card">
      <div className="campaign-card-header">
        <div className="campaign-card-title">
          <span className="campaign-status-dot" style={{ background: s.color }} />
          <h3>{campaign.name}</h3>
        </div>
        <div className="campaign-card-actions">
          {campaign.status !== 'completed' && (
            <button
              className="btn-icon"
              onClick={onToggle}
              title={campaign.status === 'active' ? 'Mettre en pause' : 'Activer'}
            >
              {campaign.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
            </button>
          )}
          <button className="btn-icon danger" onClick={onDelete} title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="campaign-card-meta">
        <span className="campaign-objective">{campaign.objective}</span>
        {campaign.target_segment && (
          <span className={`tag-segment seg-${campaign.target_segment.toLowerCase()}`}>
            {campaign.target_segment}
          </span>
        )}
        <span className="campaign-tone">Ton : {campaign.tone}</span>
      </div>

      <div className="campaign-metrics">
        <div className="metric-item">
          <span className="metric-value">{campaign.total_sent || 0}</span>
          <span className="metric-label">Envoyés</span>
        </div>
        <div className="metric-item">
          <span className="metric-value" style={{ color: 'var(--gold)' }}>
            {campaign.open_rate != null ? `${campaign.open_rate}%` : '—'}
          </span>
          <span className="metric-label">Ouvertures</span>
        </div>
        <div className="metric-item">
          <span className="metric-value" style={{ color: 'var(--green)' }}>
            {campaign.reply_rate != null ? `${campaign.reply_rate}%` : '—'}
          </span>
          <span className="metric-label">Réponses</span>
        </div>
        <div className="metric-item">
          <span className="metric-value" style={{ color: 'var(--purple)' }}>
            {campaign.total_draft || 0}
          </span>
          <span className="metric-label">En draft</span>
        </div>
      </div>
    </div>
  );
};

// ── Composant EmailPreviewCard ────────────────────────────────────────────────
```

Replace with just:

```typescript
// ── Composant EmailPreviewCard ────────────────────────────────────────────────
```

- [ ] **Step 5: Simplify `EmailPreviewCard`'s props (remove `queueMode`)**

Find:

```typescript
const EmailPreviewCard: React.FC<{
  email: GeneratedEmail;
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
  onUpdate: () => void;
  queueMode?: boolean;
}> = ({ email, showToast, onUpdate, queueMode = false }) => {
```

Replace with:

```typescript
const EmailPreviewCard: React.FC<{
  email: GeneratedEmail;
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
  onUpdate: () => void;
}> = ({ email, showToast, onUpdate }) => {
```

- [ ] **Step 6: Remove `handleApproveAndQueue` and the `queueMode` button branch**

Find:

```typescript
  const handleApproveAndQueue = async () => {
    setIsSending(true);
    try {
      const { scheduledAt } = await emailsService.approveAndSchedule(email.id);
      const date = new Date(scheduledAt).toLocaleDateString('fr-FR');
      showToast(`Email approuvé, planifié pour le ${date}`, 'success');
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur planification', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveEdit = async () => {
```

Replace with:

```typescript
  const handleSaveEdit = async () => {
```

Then find:

```typescript
          {/* Actions */}
          {!isEditing && (
            <div className="epc-actions">
              {queueMode ? (
                <button className="btn-primary-sm" onClick={handleApproveAndQueue} disabled={isSending}>
                  {isSending ? <Loader size={12} className="spin" /> : <Check size={12} />}
                  {isSending ? 'Planification...' : 'Approuver'}
                </button>
              ) : (
                <button className="btn-primary-sm" onClick={handleApproveAndSend} disabled={isSending}>
                  {isSending ? <Loader size={12} className="spin" /> : <Send size={12} />}
                  {isSending ? 'Envoi...' : 'Approuver & Envoyer'}
                </button>
              )}
              <button className="btn-ghost-sm" onClick={() => setIsEditing(true)}>
                <Edit3 size={12} /> Modifier
              </button>
              <button className="btn-ghost-sm danger" onClick={handleDelete}>
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          )}
```

Replace with:

```typescript
          {/* Actions */}
          {!isEditing && (
            <div className="epc-actions">
              <button className="btn-primary-sm" onClick={handleApproveAndSend} disabled={isSending}>
                {isSending ? <Loader size={12} className="spin" /> : <Send size={12} />}
                {isSending ? 'Envoi...' : 'Approuver & Envoyer'}
              </button>
              <button className="btn-ghost-sm" onClick={() => setIsEditing(true)}>
                <Edit3 size={12} /> Modifier
              </button>
              <button className="btn-ghost-sm danger" onClick={handleDelete}>
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          )}
```

- [ ] **Step 7: Delete the `CreateCampaignModal` component**

Find this exact block (it sits between `EmailPreviewCard` and the final `export default Prospection;`):

```typescript
// ── Modal Création Campagne ───────────────────────────────────────────────────

const CreateCampaignModal: React.FC<{
  onClose: () => void;
  onCreated: () => void;
}> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    name: '',
    objective: 'Prise de RDV',
    target_segment: 'All' as Campaign['target_segment'],
    tone: 'professionnel' as Campaign['tone'],
    description: '',
    system_prompt: '',
    status: 'draft' as Campaign['status'],
  });
  const [saving, setSaving] = useState(false);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await emailsService.createCampaign({
        ...form,
        created_by: null,
        sequence_id: null,
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nouvelle campagne IA</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="gen-field-group">
            <label className="gen-label">Nom de la campagne *</label>
            <input
              className="gen-input"
              placeholder="ex: Prospection Directeurs Marketing — Q3 2026"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
            />
          </div>
          <div className="gen-field-group">
            <label className="gen-label">Objectif</label>
            <input
              className="gen-input"
              placeholder="ex: Prise de RDV démo, Présentation offre..."
              value={form.objective}
              onChange={(e) => update('objective', e.target.value)}
            />
          </div>
          <div className="gen-field-row">
            <div className="gen-field-group">
              <label className="gen-label">Segment cible</label>
              <select className="gen-select" value={form.target_segment || 'All'} onChange={(e) => update('target_segment', e.target.value)}>
                <option value="All">Tous</option>
                <option value="Media">Media</option>
                <option value="Retail">Retail</option>
                <option value="Instit">Instit</option>
              </select>
            </div>
            <div className="gen-field-group">
              <label className="gen-label">Ton</label>
              <select className="gen-select" value={form.tone} onChange={(e) => update('tone', e.target.value)}>
                <option value="professionnel">Professionnel</option>
                <option value="décontracté">Décontracté</option>
                <option value="direct">Direct</option>
                <option value="consultatif">Consultatif</option>
              </select>
            </div>
          </div>
          <div className="gen-field-group">
            <label className="gen-label">Prompt personnalisé (optionnel)</label>
            <textarea
              className="gen-textarea"
              rows={4}
              placeholder="Laisse vide pour utiliser le prompt Seiki par défaut. Sinon, décris ici comment le LLM doit rédiger les emails pour cette campagne..."
              value={form.system_prompt}
              onChange={(e) => update('system_prompt', e.target.value)}
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost-sm" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary-sm" disabled={saving || !form.name.trim()}>
              {saving ? <Loader size={13} className="spin" /> : <Plus size={13} />}
              Créer la campagne
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Prospection;
```

Replace with just:

```typescript
export default Prospection;
```

- [ ] **Step 8: Verify with `npm run build`**

Run: `cd Projet && npm run build`
Expected: clean build, zero errors. If you see any remaining reference to `campaignsService`, `Campaign`, `CampaignMetrics`, `CampaignCard`, `CreateCampaignModal`, `GenerationTab`, `CampaignsTab`, `queueMode`, or `handleApproveAndQueue`, you missed a spot — search for it and remove it.

- [ ] **Step 9: Commit**

```bash
git add src/views/Prospection.tsx
git commit -m "refactor(prospection): remove campaigns UI, collapse Génération to Validation tab"
```

---

### Task 4: Remove dead `.campaign-*` CSS rules

**Files:**
- Modify: `Projet/src/index.css:2752-2833`

**Interfaces:** None — pure CSS deletion, no code depends on this task.

- [ ] **Step 1: Delete the dead rule block**

Find this exact block (currently lines 2752-2833, right before `.metric-item` which stays — it's generic and may be reused elsewhere):

```css
/* ── Campaign Cards ─────────────────────────────────────────── */
.campaigns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.campaign-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 18px;
  backdrop-filter: blur(12px);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.campaign-card:hover {
  border-color: rgba(107, 95, 230, 0.3);
  box-shadow: 0 4px 24px rgba(107, 95, 230, 0.08);
}

.campaign-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.campaign-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.campaign-card-title h3 {
  font-family: var(--font-heading);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.campaign-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}

.campaign-card-actions {
  display: flex;
  gap: 4px;
}

.campaign-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.campaign-objective {
  font-size: 11px;
  color: var(--text-secondary);
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  padding: 2px 7px;
}

.campaign-tone {
  font-size: 11px;
  color: var(--text-muted);
}

.campaign-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

```

Delete it entirely (including the leading comment line). Leave `.metric-item` and everything after untouched.

- [ ] **Step 2: Verify with `npm run build`**

Run: `cd Projet && npm run build`
Expected: clean build (CSS deletions don't break TypeScript compilation; this just confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "chore(prospection): remove dead campaign-card CSS rules"
```

---

### Task 5: Drop campaigns from the database (destructive — final step)

**Files:**
- Create: `Projet/schema_prospection_v3_cleanup.sql`

**Interfaces:** None produced — this is the last task, nothing depends on it going forward. Consumes: confirms no code in `src/` still references `campaign_id`/`campaigns`/`Campaign` (Tasks 1-4 already removed all of it — this task's first step re-verifies that before running anything destructive).

- [ ] **Step 1: Verify zero remaining references before touching the database**

Run: `cd Projet && grep -rn "campaign_id\|campaignsService\|CampaignMetrics\|public\.campaigns" src/ supabase/ 2>&1 || true`
Expected: no output (or only comments/strings that are clearly not code references — if you see any real reference, STOP, do not proceed to Step 2, go fix it in the relevant task's file instead).

- [ ] **Step 2: Write the migration file**

```sql
-- ============================================================
-- SEIKI CRM — Suppression des campagnes (Prospection simplifiée)
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS avoir vérifié qu'aucun code ne référence plus campaign_id/campaigns
-- (voir Tasks 1-4 du plan docs/superpowers/plans/2026-07-08-prospection-simplify.md)
-- ============================================================

-- 1. Retirer le trigger + fonction qui maintenaient les compteurs de campagne
DROP TRIGGER IF EXISTS trg_sync_campaign_sent ON public.generated_emails;
DROP FUNCTION IF EXISTS public.sync_campaign_counters();

-- 2. Retirer la vue de métriques par campagne (dépend de campaigns + campaign_id)
DROP VIEW IF EXISTS public.campaign_metrics;

-- 3. Réécrire log_generated_email() : retire campaign_id du jsonb loggé,
--    et corrige un texte résiduel de l'ancienne ère "génération IA"
--    (obsolète depuis le passage aux templates)
CREATE OR REPLACE FUNCTION public.log_generated_email()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.history (lead_id, action_type, content, metadata, is_auto)
  VALUES (
    NEW.lead_id,
    'email_sent',
    CASE
      WHEN NEW.statut_envoi = 'sent'
        THEN 'Email de prospection envoyé : ' || COALESCE(NEW.sujet, '(sans sujet)')
      ELSE 'Email de prospection généré depuis template : ' || COALESCE(NEW.sujet, '(sans sujet)')
    END,
    jsonb_build_object(
      'generated_email_id', NEW.id,
      'model', NEW.model_used,
      'statut', NEW.statut_envoi
    ),
    true
  );
  RETURN NEW;
END;
$$;

-- 4. Réécrire auto_create_prospection_draft() (déclencheur Task 4 de la refonte
--    précédente) : retire campaign_id de l'INSERT, colonne sur le point d'être supprimée
CREATE OR REPLACE FUNCTION public.auto_create_prospection_draft()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_subject TEXT;
  v_body    TEXT;
  v_mode    TEXT;
  v_new_id  UUID;
BEGIN
  IF NEW.email IS NULL OR NEW.is_archived THEN
    RETURN NEW;
  END IF;

  SELECT subject, body INTO v_subject, v_body
  FROM public.email_templates
  WHERE segment = NEW.segment AND step = 'initial';

  IF NOT FOUND THEN
    SELECT subject, body INTO v_subject, v_body
    FROM public.email_templates
    WHERE segment = 'All' AND step = 'initial';
  END IF;

  IF NOT FOUND OR v_subject IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.generated_emails (lead_id, step, sujet, corps_du_mail, statut_envoi, model_used)
  VALUES (
    NEW.id, 'initial',
    public.render_template(v_subject, NEW.id),
    public.render_template(v_body, NEW.id),
    'draft', 'template'
  )
  RETURNING id INTO v_new_id;

  SELECT (value->>'mode') INTO v_mode FROM public.app_settings WHERE key = 'prospection_mode';

  IF v_mode = 'auto' THEN
    PERFORM public.schedule_send(v_new_id);
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Retirer la colonne campaign_id de generated_emails (l'index associé part avec)
ALTER TABLE public.generated_emails DROP COLUMN IF EXISTS campaign_id;

-- 6. Supprimer la table campaigns elle-même
DROP TABLE IF EXISTS public.campaigns CASCADE;
```

- [ ] **Step 3: Apply the migration**

Run: `cd Projet && supabase db query --linked --file schema_prospection_v3_cleanup.sql`
Expected: no errors.

- [ ] **Step 4: Verify the objects are gone**

Run: `supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('campaigns', 'campaign_metrics');"`
Expected: 0 rows.

Run: `supabase db query --linked "SELECT column_name FROM information_schema.columns WHERE table_name = 'generated_emails' AND column_name = 'campaign_id';"`
Expected: 0 rows.

- [ ] **Step 5: Verify the auto-pipeline trigger still works without `campaign_id`**

Run:
```sql
supabase db query --linked "
INSERT INTO public.leads (company_name, contact_name, email, segment, stage_id)
SELECT 'Cleanup Test SA', 'Test Cleanup', 'cleanup-test@example.com', 'Media', id
FROM public.pipeline_stages LIMIT 1
RETURNING id;
"
```
Then check a draft was created (no error about a missing column):
```sql
supabase db query --linked "SELECT statut_envoi, step FROM public.generated_emails ge JOIN public.leads l ON l.id = ge.lead_id WHERE l.email = 'cleanup-test@example.com';"
```
Expected: 1 row, `statut_envoi = 'draft'`, `step = 'initial'`.

Clean up: `supabase db query --linked "DELETE FROM public.leads WHERE email = 'cleanup-test@example.com';"`

- [ ] **Step 6: Commit**

```bash
git add schema_prospection_v3_cleanup.sql
git commit -m "feat(db): drop campaigns table, campaign_metrics view, and campaign_id column"
```

---

### Task 6: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Fresh-cache build**

Run: `cd Projet && rm -rf dist node_modules/.vite && npm run build`
Expected: clean build, 0 errors.

- [ ] **Step 2: Confirm the 3 remaining tabs and nothing campaign-related survived**

Run: `cd Projet && grep -rn "campaign\|Campaign" src/ --include="*.tsx" --include="*.ts" || true`
Expected: no output. If anything appears, investigate before calling this done.

- [ ] **Step 3: Clean up local build artifact**

```bash
rm -rf Projet/dist
```

This task produces no commit unless Step 2 surfaced something to fix.
