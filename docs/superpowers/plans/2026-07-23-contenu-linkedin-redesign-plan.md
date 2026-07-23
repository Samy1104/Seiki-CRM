# Contenu LinkedIn Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign LinkedIn content studio (`src/views/Contenu.tsx` and subcomponents under `src/views/contenu/`) using global design tokens (`src/theme.css`) and shared UI components (`src/components/ui/`).

**Architecture:** Replace legacy variables (`var(--bg-panel)`, `var(--gold)`, `#c8b89a`) and custom HTML elements across 5 subcomponents with global `@theme` tokens (`bg-surface`, `bg-base`, `border-line-strong`, `text-ink`, `text-amber`, `font-display`, `font-ui`) and shared UI components (`Field`, `inputClass`, `Button`, `Badge`).

**Tech Stack:** React, Tailwind CSS v4 (`@theme`), Lucide React icons, Vitest, TypeScript.

## Global Constraints

- Preserve all existing functionality, hooks (`useLinkedInContent`, `useLinkedInAccounts`, `useTagBook`), and event handlers.
- Maintain existing stacked layout in `src/views/Contenu.tsx`.
- Use exact Tailwind utility classes backed by `src/theme.css` design tokens.

---

### Task 1: Redesign `ContenuHeader.tsx`

**Files:**
- Modify: `src/views/contenu/ContenuHeader.tsx`

**Interfaces:**
- Consumes: `LinkedinAccount` from `src/services/linkedinService`
- Produces: Redesigned header component adhering to global typography and theme tokens

- [ ] **Step 1: Inspect and update `ContenuHeader.tsx` tokens**

Update `ContenuHeader.tsx` to use `text-ink`, `text-ink-soft`, `text-ink-faint`, `font-display`, `font-ui`, and refactor account connection pill links.

```tsx
import React from 'react';
import { Link2, CheckCircle2 } from 'lucide-react';
import { linkedinService, type LinkedinAccount } from '../../services/linkedinService';

interface ContenuHeaderProps {
  accounts: LinkedinAccount[];
}

export const ContenuHeader: React.FC<ContenuHeaderProps> = ({ accounts }) => {
  const isJaafarConnected = accounts.some((a) => a.target_type === 'personal');
  const isSeikiConnected = accounts.some((a) => a.target_type === 'company');

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-line-strong pb-6">
      <div>
        <span className="text-[11px] font-ui font-medium tracking-[0.2em] uppercase block mb-1 text-ink-soft">
          Studio de création &amp; distribution
        </span>
        <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-ink">
          Générateur de posts LinkedIn
        </h1>
        <p className="text-sm font-ui text-ink-soft mt-1.5">
          Rédigez, adaptez au style de votre marque et planifiez vos publications
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap font-ui">
        <a
          href={linkedinService.oauthConnectUrl('personal', 'Jaafar')}
          className="text-xs flex items-center gap-2 px-3.5 py-2 rounded-control border border-line-strong bg-surface text-ink-soft hover:text-ink hover:border-line-focus transition-all duration-200 cursor-pointer"
        >
          {isJaafarConnected ? (
            <CheckCircle2 size={14} className="text-success" />
          ) : (
            <Link2 size={14} className="text-amber" />
          )}
          <span>{isJaafarConnected ? 'Jaafar (Connecté)' : 'Connecter Jaafar'}</span>
        </a>

        <a
          href={linkedinService.oauthConnectUrl('company', 'Seiki')}
          className="text-xs flex items-center gap-2 px-3.5 py-2 rounded-control border border-line-strong bg-surface text-ink-soft hover:text-ink hover:border-line-focus transition-all duration-200 cursor-pointer"
        >
          {isSeikiConnected ? (
            <CheckCircle2 size={14} className="text-success" />
          ) : (
            <Link2 size={14} className="text-amber" />
          )}
          <span>{isSeikiConnected ? 'Seiki (Connecté)' : 'Connecter Seiki'}</span>
        </a>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
rtk git add src/views/contenu/ContenuHeader.tsx
rtk git commit -m "refactor(contenu): upgrade ContenuHeader to global theme tokens"
```

---

### Task 2: Redesign `PostGeneratorForm.tsx`

**Files:**
- Modify: `src/views/contenu/PostGeneratorForm.tsx`

**Interfaces:**
- Consumes: `Field`, `inputClass`, `Button` from `src/components/ui`
- Produces: Form component for post generation styled with global UI components

- [ ] **Step 1: Update `PostGeneratorForm.tsx`**

Refactor `PostGeneratorForm.tsx` using `Field`, `inputClass`, `Button`, and global tokens.

```tsx
import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { ContentVoice, ContentLanguage } from '../../services/contentService';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

interface PostGeneratorFormProps {
  brief: string;
  setBrief: (b: string) => void;
  voice: ContentVoice;
  setVoice: (v: ContentVoice) => void;
  language: ContentLanguage;
  setLanguage: (l: ContentLanguage) => void;
  loading: boolean;
  onGenerate: () => void;
}

export const PostGeneratorForm: React.FC<PostGeneratorFormProps> = ({
  brief,
  setBrief,
  voice,
  setVoice,
  language,
  setLanguage,
  loading,
  onGenerate,
}) => {
  return (
    <div className="space-y-5 p-6 rounded-surface border border-line-strong bg-surface shadow-hover">
      <div className="flex items-center gap-2 pb-3 border-b border-line-strong">
        <Sparkles size={15} className="text-amber" />
        <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
          Nouveau brief de publication
        </h2>
      </div>

      <Field label="Sujet / Brief">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Ex : Nous venons de signer un partenariat avec la ville de Lyon..."
          rows={4}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div className="flex gap-4 flex-wrap items-center">
          <Field label="Voix">
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value as ContentVoice)}
              className={`${inputClass} py-2 px-3 text-xs w-auto cursor-pointer`}
            >
              <option value="seiki" className="bg-surface text-ink">Seiki (entreprise)</option>
              <option value="jaafar" className="bg-surface text-ink">Jaafar (personnel)</option>
            </select>
          </Field>

          <Field label="Langue">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as ContentLanguage)}
              className={`${inputClass} py-2 px-3 text-xs w-auto cursor-pointer`}
            >
              <option value="fr" className="bg-surface text-ink">Français</option>
              <option value="en" className="bg-surface text-ink">English</option>
            </select>
          </Field>
        </div>

        <Button
          variant="primary"
          onClick={onGenerate}
          disabled={loading}
          className="uppercase tracking-wider text-xs"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Génération...</span>
            </>
          ) : (
            <>
              <Sparkles size={15} />
              <span>Générer</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
rtk git add src/views/contenu/PostGeneratorForm.tsx
rtk git commit -m "refactor(contenu): upgrade PostGeneratorForm to shared UI components and theme tokens"
```

---

### Task 3: Redesign `TagBookPanel.tsx`

**Files:**
- Modify: `src/views/contenu/TagBookPanel.tsx`

**Interfaces:**
- Consumes: `Field`, `inputClass`, `Button` from `src/components/ui`
- Produces: TagBook management panel styled with global UI components

- [ ] **Step 1: Update `TagBookPanel.tsx`**

Refactor `TagBookPanel.tsx` using `Field`, `inputClass`, `Button`, and global tokens.

```tsx
import React from 'react';
import { AtSign, Trash2, Loader2 } from 'lucide-react';
import type { TagEntry } from '../../services/contentService';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

interface TagBookPanelProps {
  tagBook: TagEntry[];
  newTagAlias: string;
  setNewTagAlias: (v: string) => void;
  newTagName: string;
  setNewTagName: (v: string) => void;
  newTagUrn: string;
  setNewTagUrn: (v: string) => void;
  savingTag: boolean;
  onAddTag: () => void;
  onDeleteTag: (alias: string) => void;
}

export const TagBookPanel: React.FC<TagBookPanelProps> = ({
  tagBook,
  newTagAlias,
  setNewTagAlias,
  newTagName,
  setNewTagName,
  newTagUrn,
  setNewTagUrn,
  savingTag,
  onAddTag,
  onDeleteTag,
}) => {
  return (
    <div className="space-y-4 p-6 rounded-surface border border-line-strong bg-surface shadow-hover">
      <div className="flex items-center gap-2 pb-3 border-b border-line-strong">
        <AtSign size={15} className="text-amber" />
        <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
          Comptes tagués (TagBook)
        </h2>
      </div>

      <p className="text-xs font-ui text-ink-soft leading-relaxed">
        Ajoutez un alias une fois (nom + URN LinkedIn), puis tapez <code className="text-amber font-semibold">@alias</code> dans le post pour l'insérer.
        Pour trouver l'URN : si vous administrez la page, le numéro est dans l'URL d'admin
        (<code>linkedin.com/company/ID/admin/</code>) → <code className="text-ink">urn:li:organization:ID</code>.
      </p>

      {tagBook.length > 0 && (
        <div className="space-y-2 pt-1">
          {tagBook.map((t) => (
            <div
              key={t.alias}
              className="flex items-center justify-between gap-2 p-3 rounded-control border border-line-strong bg-base hover:border-line-focus transition-all"
            >
              <div className="min-w-0 flex items-center gap-2 text-xs font-ui">
                <span className="font-semibold text-amber bg-amber-soft px-2 py-0.5 rounded-control">
                  @{t.alias}
                </span>
                <span className="text-ink truncate font-medium">{t.name}</span>
                <span className="text-xs truncate text-ink-faint">({t.urn})</span>
              </div>
              <button
                onClick={() => onDeleteTag(t.alias)}
                className="shrink-0 text-ink-faint hover:text-danger transition-colors cursor-pointer p-1"
                title="Supprimer l'alias"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-end pt-2 border-t border-line-strong mt-2">
        <Field label="Alias">
          <input
            value={newTagAlias}
            onChange={(e) => setNewTagAlias(e.target.value)}
            placeholder="Lyon"
            className={`${inputClass} py-2 px-3 text-xs w-[110px]`}
          />
        </Field>
        <Field label="Nom affiché">
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Ville de Lyon"
            className={`${inputClass} py-2 px-3 text-xs w-[180px]`}
          />
        </Field>
        <Field label="URN LinkedIn" className="flex-1 min-w-[200px]">
          <input
            value={newTagUrn}
            onChange={(e) => setNewTagUrn(e.target.value)}
            placeholder="urn:li:organization:12345"
            className={`${inputClass} py-2 px-3 text-xs`}
          />
        </Field>
        <Button
          variant="primary"
          onClick={onAddTag}
          disabled={savingTag}
          className="uppercase tracking-wider text-xs px-4 py-2"
        >
          {savingTag ? <Loader2 size={14} className="animate-spin" /> : 'Ajouter'}
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
rtk git add src/views/contenu/TagBookPanel.tsx
rtk git commit -m "refactor(contenu): upgrade TagBookPanel to shared UI components and theme tokens"
```

---

### Task 4: Redesign `PostEditorPreview.tsx`

**Files:**
- Modify: `src/views/contenu/PostEditorPreview.tsx`

**Interfaces:**
- Consumes: `Field`, `inputClass`, `Button` from `src/components/ui`
- Produces: Live Editor & Preview component styled with global UI components

- [ ] **Step 1: Update `PostEditorPreview.tsx`**

Refactor `PostEditorPreview.tsx` using `Field`, `inputClass`, `Button`, and global tokens.

```tsx
import React from 'react';
import { Copy, Check, GraduationCap, Loader2, AtSign, PenSquare } from 'lucide-react';
import type { LinkedInPost, TagEntry } from '../../services/contentService';
import type { MentionField } from '../../hooks/useTagBook';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

interface PostEditorPreviewProps {
  post: LinkedInPost;
  setPost: (p: LinkedInPost) => void;
  originalPost: LinkedInPost | null;
  copied: boolean;
  learning: boolean;
  mention: { field: MentionField; query: string } | null;
  setMention: React.Dispatch<React.SetStateAction<{ field: MentionField; query: string } | null>>;
  mentionMatches: TagEntry[];
  hookRef: React.RefObject<HTMLTextAreaElement | null>;
  corpsRef: React.RefObject<HTMLTextAreaElement | null>;
  detectMention: (field: MentionField, value: string, cursor: number) => void;
  insertMention: (tag: TagEntry) => void;
  handleCopy: () => void;
  handleLearn: () => void;
}

export const PostEditorPreview: React.FC<PostEditorPreviewProps> = ({
  post,
  setPost,
  copied,
  learning,
  mention,
  setMention,
  mentionMatches,
  hookRef,
  corpsRef,
  detectMention,
  insertMention,
  handleCopy,
  handleLearn,
}) => {
  const handleFieldChange = (field: MentionField, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPost({ ...post, [field]: value });
    detectMention(field, value, e.target.selectionStart ?? value.length);
  };

  return (
    <div className="p-6 rounded-surface border border-line-strong bg-surface space-y-5 shadow-hover">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-line-strong">
        <div className="flex items-center gap-2">
          <PenSquare size={15} className="text-amber" />
          <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
            Aperçu &amp; Éditeur en direct
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap font-ui">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLearn}
            disabled={learning}
            title="Enregistre vos corrections pour améliorer les prochaines générations"
          >
            {learning ? <Loader2 size={13} className="animate-spin text-amber" /> : <GraduationCap size={13} className="text-amber" />}
            <span>Valider &amp; apprendre</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
          >
            {copied ? <Check size={13} className="text-success" /> : <Copy size={13} className="text-amber" />}
            <span>{copied ? 'Copié !' : 'Copier'}</span>
          </Button>
        </div>
      </div>

      {/* Hook Textarea */}
      <div className="relative">
        <Field label="Accroche (Hook)">
          <textarea
            ref={hookRef}
            value={post.hook}
            onChange={(e) => handleFieldChange('hook', e)}
            onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'hook' ? null : m)), 150)}
            rows={2}
            className={`${inputClass} resize-y`}
          />
        </Field>
        {mention?.field === 'hook' && mentionMatches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-overlay border border-line-focus bg-elevated overflow-hidden shadow-modal">
            {mentionMatches.map((t) => (
              <button
                key={t.alias}
                onClick={() => insertMention(t)}
                className="w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2 hover:bg-hover text-ink transition-colors border-b border-line-strong last:border-none cursor-pointer"
              >
                <AtSign size={13} className="text-amber" />
                <span className="font-semibold text-amber">@{t.alias}</span>
                <span className="text-xs text-ink-soft">({t.name})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Corps Textarea */}
      <div className="relative">
        <Field label="Corps du post">
          <textarea
            ref={corpsRef}
            value={post.corps}
            onChange={(e) => handleFieldChange('corps', e)}
            onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'corps' ? null : m)), 150)}
            rows={8}
            className={`${inputClass} resize-y`}
          />
        </Field>
        {mention?.field === 'corps' && mentionMatches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-overlay border border-line-focus bg-elevated overflow-hidden shadow-modal">
            {mentionMatches.map((t) => (
              <button
                key={t.alias}
                onClick={() => insertMention(t)}
                className="w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2 hover:bg-hover text-ink transition-colors border-b border-line-strong last:border-none cursor-pointer"
              >
                <AtSign size={13} className="text-amber" />
                <span className="font-semibold text-amber">@{t.alias}</span>
                <span className="text-xs text-ink-soft">({t.name})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hashtags Input */}
      <Field label="Hashtags">
        <input
          value={post.hashtags.map((h) => `#${h}`).join(' ')}
          onChange={(e) =>
            setPost({
              ...post,
              hashtags: e.target.value
                .split(/\s+/)
                .filter(Boolean)
                .map((h) => h.replace(/^#/, '')),
            })
          }
          className={inputClass}
          placeholder="#hashtag1 #hashtag2"
        />
      </Field>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
rtk git add src/views/contenu/PostEditorPreview.tsx
rtk git commit -m "refactor(contenu): upgrade PostEditorPreview to shared UI components and theme tokens"
```

---

### Task 5: Redesign `PostSchedulerPanel.tsx`

**Files:**
- Modify: `src/views/contenu/PostSchedulerPanel.tsx`

**Interfaces:**
- Consumes: `Field`, `inputClass`, `Button`, `Badge` from `src/components/ui`
- Produces: Scheduler and queue listing panel styled with global UI components

- [ ] **Step 1: Update `PostSchedulerPanel.tsx`**

Refactor `PostSchedulerPanel.tsx` using `Field`, `inputClass`, `Button`, `Badge`, and global tokens.

```tsx
import React from 'react';
import { Image as ImageIcon, Loader2, RotateCcw, X, Calendar, Clock } from 'lucide-react';
import type { LinkedinAccount, ScheduledPost } from '../../services/linkedinService';
import type { LinkedInPost } from '../../services/contentService';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Field, inputClass } from '../../components/ui/Field';

interface PostSchedulerPanelProps {
  post: LinkedInPost | null;
  accounts: LinkedinAccount[];
  queue: ScheduledPost[];
  targetAccountId: string;
  setTargetAccountId: (id: string) => void;
  scheduledDate: string;
  setScheduledDate: (d: string) => void;
  scheduledTime: string;
  setScheduledTime: (t: string) => void;
  setImageFile: (f: File | null) => void;
  scheduling: boolean;
  onSchedule: () => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export const PostSchedulerPanel: React.FC<PostSchedulerPanelProps> = ({
  post,
  accounts,
  queue,
  targetAccountId,
  setTargetAccountId,
  scheduledDate,
  setScheduledDate,
  scheduledTime,
  setScheduledTime,
  setImageFile,
  scheduling,
  onSchedule,
  onCancel,
  onRetry,
}) => {
  const accountLabel = (id: string) => accounts.find((a) => a.id === id)?.label ?? 'Compte inconnu';

  return (
    <div className="space-y-6">
      {/* Schedule Form */}
      {post && (
        <div className="p-6 rounded-surface border border-line-strong bg-surface space-y-4 shadow-hover">
          <div className="flex items-center gap-2 pb-3 border-b border-line-strong">
            <Calendar size={15} className="text-amber" />
            <h3 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
              Planifier la publication
            </h3>
          </div>

          <div className="flex gap-4 flex-wrap items-end pt-1">
            <Field label="Compte cible">
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className={`${inputClass} py-2 px-3 text-xs w-auto cursor-pointer`}
              >
                <option value="" className="bg-surface text-ink">— Choisir —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-surface text-ink">
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Date">
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={`${inputClass} py-2 px-3 text-xs w-auto`}
              />
            </Field>

            <Field label="Heure">
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className={`${inputClass} py-2 px-3 text-xs w-auto`}
              />
            </Field>

            <Field label="Image (optionnel)">
              <div className="flex items-center gap-1.5">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-ink-soft file:mr-2 file:py-1.5 file:px-3 file:rounded-control file:border-0 file:text-xs file:bg-base file:text-ink hover:file:bg-hover cursor-pointer"
                />
              </div>
            </Field>

            <Button
              variant="primary"
              onClick={onSchedule}
              disabled={scheduling}
              className="uppercase tracking-wider text-xs px-4 py-2"
            >
              {scheduling ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Programmation...</span>
                </>
              ) : (
                <span>Programmer</span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Queue Listing */}
      <div className="p-6 rounded-surface border border-line-strong bg-surface space-y-4 shadow-hover">
        <div className="flex items-center gap-2 pb-3 border-b border-line-strong">
          <Clock size={15} className="text-amber" />
          <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
            Posts programmés en file d'attente
          </h2>
        </div>

        {queue.length === 0 && (
          <p className="text-xs font-ui text-ink-faint py-4 text-center">
            Aucun post programmé en attente.
          </p>
        )}
        {queue.map((p) => (
          <div
            key={p.id}
            className="p-3.5 rounded-control border border-line-strong flex items-center justify-between gap-3 bg-base hover:border-line-focus transition-all"
          >
            <div className="min-w-0">
              <div className="text-sm font-ui font-medium text-ink truncate">
                {p.hook}
              </div>
              <div className="text-xs font-ui text-ink-soft mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-amber font-medium">{accountLabel(p.target_account_id)}</span>
                <span>•</span>
                <span>{new Date(p.scheduled_at).toLocaleString('fr-FR')}</span>
                <span>•</span>
                <Badge
                  tone={
                    p.status === 'failed'
                      ? 'danger'
                      : p.status === 'posted'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {p.status === 'scheduled' ? 'Programmé' : p.status === 'posted' ? 'Publié' : 'Échec'}
                </Badge>
                {p.status === 'failed' && p.error_message && ` — ${p.error_message}`}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {p.status === 'failed' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onRetry(p.id)}
                >
                  <RotateCcw size={13} className="text-amber" /> Relancer
                </Button>
              )}
              {p.status === 'scheduled' && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onCancel(p.id)}
                >
                  <X size={13} /> Annuler
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
rtk git add src/views/contenu/PostSchedulerPanel.tsx
rtk git commit -m "refactor(contenu): upgrade PostSchedulerPanel to shared UI components and theme tokens"
```

---

### Task 6: Build Check & Verification

**Files:**
- Test/Verification across whole project

- [ ] **Step 1: Run TypeScript check and Vite build**

Run: `npx tsc --noEmit; npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 2: Run Unit Tests**

Run: `npm run test`
Expected: PASS all tests.

- [ ] **Step 3: Commit final design completion**

```bash
rtk git add .
rtk git commit -m "chore(contenu): complete LinkedIn page design system integration"
```
