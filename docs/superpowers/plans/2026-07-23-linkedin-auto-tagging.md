# LinkedIn Auto-Tagging & On-the-Fly Resolver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive LinkedIn account tagging system featuring pre-generation tag selection, a keyboard-triggered `@` auto-complete combobox inside the post editor, an on-the-fly LinkedIn URL/handle resolver, and LinkedIn mention output formatting.

**Architecture:** A standalone `linkedinTagService.ts` utility handles URL/handle parsing, alias inference, and URN generation, persisting data to Supabase `app_settings`. `PostGeneratorForm.tsx` enables tag selection for AI prompt generation, while `PostEditorPreview.tsx` embeds a cursor-aware `@` combobox and quick-add modal.

**Tech Stack:** React (TypeScript), Tailwind / CSS variables, Lucide React, Supabase Client, Vitest / React Testing Library.

## Global Constraints

- Preserve all existing `TagEntry` schema properties (`alias`, `name`, `urn`).
- Keep all UI styling consistent with the existing theme (`bg-surface`, `border-line-strong`, `text-ink`, accent buttons).
- All new tag registrations must automatically persist to Supabase `app_settings` (`linkedin_tag_book`).

---

### Task 1: LinkedIn Tag Resolver Service (`linkedinTagService.ts`)

**Files:**
- Create: `src/services/linkedinTagService.ts`
- Create: `src/services/linkedinTagService.test.ts`
- Modify: `src/services/contentService.ts:13-17`

**Interfaces:**
- Consumes: Supabase client from `src/services/supabaseClient.ts`
- Produces: `parseLinkedInUrl(urlOrHandle: string): { alias: string; name: string; urn: string; type: 'organization' | 'person' }`
- Produces: `addAndPersistTag(urlOrHandle: string, customName?: string): Promise<TagEntry>`

- [ ] **Step 1: Write unit tests for `linkedinTagService`**

Create `src/services/linkedinTagService.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseLinkedInUrl } from './linkedinTagService';

describe('linkedinTagService.parseLinkedInUrl', () => {
  it('parses company URLs correctly', () => {
    const res = parseLinkedInUrl('https://www.linkedin.com/company/seiki-tech/');
    expect(res.type).toBe('organization');
    expect(res.alias).toBe('seiki-tech');
    expect(res.name).toBe('Seiki Tech');
    expect(res.urn).toMatch(/^urn:li:organization:/);
  });

  it('parses personal profile URLs correctly', () => {
    const res = parseLinkedInUrl('https://www.linkedin.com/in/jaafar-bounaim/');
    expect(res.type).toBe('person');
    expect(res.alias).toBe('jaafar-bounaim');
    expect(res.name).toBe('Jaafar Bounaim');
    expect(res.urn).toMatch(/^urn:li:person:/);
  });

  it('parses raw handle with @ symbol', () => {
    const res = parseLinkedInUrl('@lyon-mobility');
    expect(res.alias).toBe('lyon-mobility');
    expect(res.name).toBe('Lyon Mobility');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/linkedinTagService.test.ts`
Expected: FAIL with "Cannot find module ./linkedinTagService"

- [ ] **Step 3: Implement `linkedinTagService.ts`**

Create `src/services/linkedinTagService.ts`:
```typescript
import { contentService, type TagEntry } from './contentService';

export function parseLinkedInUrl(input: string): {
  alias: string;
  name: string;
  urn: string;
  type: 'organization' | 'person';
  url: string;
} {
  const cleanInput = input.trim();
  const isCompany = cleanInput.includes('/company/') || cleanInput.includes('organization');
  const isPerson = cleanInput.includes('/in/') || cleanInput.includes('person');
  
  const type: 'organization' | 'person' = isPerson ? 'person' : 'organization';

  // Extract path slug or clean handle
  let rawSlug = cleanInput;
  try {
    if (cleanInput.startsWith('http')) {
      const urlObj = new URL(cleanInput);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      rawSlug = parts[parts.length - 1] || parts[parts.length - 2] || 'account';
    } else {
      rawSlug = cleanInput.replace(/^@/, '');
    }
  } catch {
    rawSlug = cleanInput.replace(/^@/, '');
  }

  const alias = rawSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  
  // Format readable display name from slug (e.g., "seiki-tech" -> "Seiki Tech")
  const name = rawSlug
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Generate deterministic URN hash for offline/local simulation
  let hash = 0;
  for (let i = 0; i < cleanInput.length; i++) {
    hash = (hash << 5) - hash + cleanInput.charCodeAt(i);
    hash |= 0;
  }
  const idNum = Math.abs(hash);
  const urn = `urn:li:${type}:${idNum}`;

  return {
    alias,
    name,
    urn,
    type,
    url: cleanInput.startsWith('http') ? cleanInput : `https://linkedin.com/company/${alias}`,
  };
}

export async function addAndPersistTag(
  urlOrHandle: string,
  customName?: string
): Promise<TagEntry> {
  const parsed = parseLinkedInUrl(urlOrHandle);
  const newTag: TagEntry = {
    alias: parsed.alias,
    name: customName?.trim() || parsed.name,
    urn: parsed.urn,
    url: parsed.url,
    type: parsed.type,
  };

  const currentTags = await contentService.getTagBook();
  const existingIdx = currentTags.findIndex(t => t.alias === newTag.alias);

  let updated: TagEntry[];
  if (existingIdx >= 0) {
    updated = [...currentTags];
    updated[existingIdx] = newTag;
  } else {
    updated = [...currentTags, newTag];
  }

  await contentService.saveTagBook(updated);
  return newTag;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/linkedinTagService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/linkedinTagService.ts src/services/linkedinTagService.test.ts
git commit -m "feat: add linkedinTagService for URL parsing and tag persistence"
```

---

### Task 2: Integrate Pre-Generation Tag Selector (`PostGeneratorForm.tsx`)

**Files:**
- Modify: `src/views/contenu/PostGeneratorForm.tsx`
- Modify: `src/services/contentService.ts:39-80`

**Interfaces:**
- Consumes: `TagBook` array from `contentService.getTagBook()`
- Produces: `selectedTagAliases` prop in `PostGeneratorForm` passed to `generateLinkedInPost`

- [ ] **Step 1: Update `contentService.generateLinkedInPost` to accept selected tags**

In `src/services/contentService.ts`, update `generateLinkedInPost`:
```typescript
  async generateLinkedInPost(
    brief: string,
    voice: ContentVoice,
    language: ContentLanguage,
    selectedTags?: TagEntry[]
  ): Promise<GeneratedPost> {
    try {
      const data = await callEdgeFunction<GeneratePostResult & { error?: string }>(
        'generate-linkedin-post',
        { brief, voice, language, tags: selectedTags }
      );

      if (data && data.success && data.post) {
        return { post: data.post, validationWarnings: data.validation_warnings ?? [] };
      }
      throw new Error(data?.error || 'Erreur génération');
    } catch (err) {
      console.warn('Edge function fallback:', err);
      // Include tag mentions naturally in fallback generation
      const tagMentions = selectedTags && selectedTags.length > 0 
        ? `\n\nMentions : ${selectedTags.map(t => `@${t.alias} (${t.name})`).join(' ')}` 
        : '';
        
      const isJaafar = voice === 'jaafar';
      const isEn = language === 'en';

      const hook = `🚀 ${brief.slice(0, 80)}${brief.length > 80 ? '...' : ''}`;
      const corps = `${brief}${tagMentions}\n\nKey impact metrics:\n• High precision analytics\n• Real-time insights`;
      const hashtags = ['Seiki', 'Innovation', 'LinkedIn'];

      return { post: { hook, corps, hashtags }, validationWarnings: [] };
    }
  }
```

- [ ] **Step 2: Add Tag Picker UI to `PostGeneratorForm.tsx`**

In `src/views/contenu/PostGeneratorForm.tsx`, add a tag chip selector:
```tsx
import React, { useState } from 'react';
import { AtSign, Plus } from 'lucide-react';
import type { TagEntry } from '../../services/contentService';

interface PostGeneratorFormProps {
  // existing props...
  tagBook: TagEntry[];
  selectedTags: TagEntry[];
  setSelectedTags: React.Dispatch<React.SetStateAction<TagEntry[]>>;
  onQuickAddTag?: (url: string) => Promise<void>;
}
```

Add UI snippet inside `PostGeneratorForm.tsx` above the Generate button:
```tsx
<div className="space-y-2 pt-2 border-t border-line-strong">
  <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
    <AtSign size={13} className="text-[#D4C4A8]" />
    Comptes à taguer dans le post :
  </label>
  <div className="flex flex-wrap gap-1.5">
    {tagBook.map(tag => {
      const isSelected = selectedTags.some(t => t.alias === tag.alias);
      return (
        <button
          key={tag.alias}
          type="button"
          onClick={() => {
            if (isSelected) {
              setSelectedTags(selectedTags.filter(t => t.alias !== tag.alias));
            } else {
              setSelectedTags([...selectedTags, tag]);
            }
          }}
          className={`text-xs px-2.5 py-1 rounded-control border transition-all cursor-pointer ${
            isSelected
              ? 'bg-[#D4C4A8]/20 border-[#D4C4A8] text-ink font-medium'
              : 'bg-base border-line-strong text-ink-soft hover:border-line-focus'
          }`}
        >
          @{tag.alias} ({tag.name})
        </button>
      );
    })}
  </div>
</div>
```

- [ ] **Step 3: Run build check to verify types**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit**

```bash
git add src/views/contenu/PostGeneratorForm.tsx src/services/contentService.ts
git commit -m "feat: integrate pre-generation tag selector into generator form"
```

---

### Task 3: Build `@` Auto-Complete Trigger & On-the-Fly Resolver (`PostEditorPreview.tsx`)

**Files:**
- Create: `src/components/ui/TagAutoCompleteCombobox.tsx`
- Create: `src/components/ui/QuickAddTagModal.tsx`
- Modify: `src/views/contenu/PostEditorPreview.tsx`

**Interfaces:**
- Consumes: `TagEntry[]` tagBook, `onInsertTag(tag: TagEntry)`
- Produces: Floating `@` menu overlay & inline LinkedIn URL resolver popover.

- [ ] **Step 1: Create `QuickAddTagModal.tsx`**

Create `src/components/ui/QuickAddTagModal.tsx`:
```tsx
import React, { useState } from 'react';
import { Modal } from './Modal';
import { Field, inputClass } from './Field';
import { AccentButton } from './AccentButton';
import { Loader2, Plus } from 'lucide-react';
import { addAndPersistTag } from '../../services/linkedinTagService';
import type { TagEntry } from '../../services/contentService';

interface QuickAddTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  onTagCreated: (tag: TagEntry) => void;
}

export const QuickAddTagModal: React.FC<QuickAddTagModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  onTagCreated,
}) => {
  const [urlOrHandle, setUrlOrHandle] = useState(initialQuery);
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlOrHandle.trim()) return;
    setLoading(true);
    setError('');
    try {
      const tag = await addAndPersistTag(urlOrHandle, customName);
      onTagCreated(tag);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du tag');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un compte LinkedIn à taguer">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Lien LinkedIn ou Handle (@nom)">
          <input
            value={urlOrHandle}
            onChange={(e) => setUrlOrHandle(e.target.value)}
            placeholder="https://linkedin.com/company/seiki ou @seiki"
            className={inputClass}
            required
            autoFocus
          />
        </Field>
        <Field label="Nom affiché (optionnel)">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Ex: Seiki Intelligence"
            className={inputClass}
          />
        </Field>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-ink-soft hover:text-ink">
            Annuler
          </button>
          <AccentButton variant="primary" disabled={loading} icon={loading ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}>
            Ajouter & Taguer
          </AccentButton>
        </div>
      </form>
    </Modal>
  );
};
```

- [ ] **Step 2: Create `TagAutoCompleteCombobox.tsx`**

Create `src/components/ui/TagAutoCompleteCombobox.tsx`:
```tsx
import React from 'react';
import { AtSign, Plus } from 'lucide-react';
import type { TagEntry } from '../../services/contentService';

interface TagAutoCompleteComboboxProps {
  filterQuery: string;
  tagBook: TagEntry[];
  onSelectTag: (tag: TagEntry) => void;
  onOpenQuickAdd: (query: string) => void;
  position: { top: number; left: number };
}

export const TagAutoCompleteCombobox: React.FC<TagAutoCompleteComboboxProps> = ({
  filterQuery,
  tagBook,
  onSelectTag,
  onOpenQuickAdd,
  position,
}) => {
  const filtered = tagBook.filter(
    (t) =>
      t.alias.toLowerCase().includes(filterQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div
      style={{ top: position.top, left: position.left }}
      className="absolute z-50 min-w-[220px] max-h-[200px] overflow-y-auto bg-surface border border-line-strong rounded-control shadow-popup p-1 text-xs font-ui"
    >
      <div className="px-2 py-1 text-ink-faint font-semibold uppercase tracking-wider text-[10px]">
        Taguer un compte
      </div>
      {filtered.map((tag) => (
        <button
          key={tag.alias}
          type="button"
          onClick={() => onSelectTag(tag)}
          className="w-full text-left px-2.5 py-1.5 rounded-control hover:bg-base flex items-center justify-between gap-2 transition-colors cursor-pointer"
        >
          <span className="font-medium text-ink flex items-center gap-1">
            <AtSign size={12} className="text-[#D4C4A8]" /> {tag.name}
          </span>
          <span className="text-[10px] text-ink-faint">@{tag.alias}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => onOpenQuickAdd(filterQuery)}
        className="w-full text-left px-2.5 py-1.5 rounded-control hover:bg-[#D4C4A8]/10 text-[#D4C4A8] font-semibold flex items-center gap-1.5 border-t border-line-strong mt-1 cursor-pointer"
      >
        <Plus size={13} />
        Nouveau compte "{filterQuery || 'URL'}"
      </button>
    </div>
  );
};
```

- [ ] **Step 3: Wire `@` detection in `PostEditorPreview.tsx`**

In `PostEditorPreview.tsx`, listen to textarea keyup/change for `@` symbol. When `@` is typed, track cursor coordinates and render `TagAutoCompleteCombobox`. When a tag is selected, replace `@query` with `@{alias}` or `@[Name](urn)` in the editor state.

- [ ] **Step 4: Run build check to verify compilation**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/TagAutoCompleteCombobox.tsx src/components/ui/QuickAddTagModal.tsx src/views/contenu/PostEditorPreview.tsx
git commit -m "feat: add interactive @ auto-complete combobox and on-the-fly tag resolver modal"
```

---

### Task 4: Mention Formatter & LinkedIn Copy Payload Helper

**Files:**
- Create: `src/utils/linkedinMentionFormatter.ts`
- Create: `src/utils/linkedinMentionFormatter.test.ts`
- Modify: `src/views/contenu/PostEditorPreview.tsx:120-150`

**Interfaces:**
- Consumes: raw post body string with `@{alias}` or `@Name` tokens and `tagBook: TagEntry[]`
- Produces: `formatPostForLinkedIn(body: string, tagBook: TagEntry[]): string`

- [ ] **Step 1: Write test for mention formatter**

Create `src/utils/linkedinMentionFormatter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { formatPostForLinkedIn } from './linkedinMentionFormatter';

describe('formatPostForLinkedIn', () => {
  const mockTagBook = [
    { alias: 'seiki', name: 'Seiki Mobility', urn: 'urn:li:organization:12345' },
    { alias: 'jaafar', name: 'Jaafar Bounaim', urn: 'urn:li:person:67890' },
  ];

  it('replaces @alias tokens with full LinkedIn URN mention format', () => {
    const raw = 'Merci à @seiki et @jaafar pour ce projet !';
    const formatted = formatPostForLinkedIn(raw, mockTagBook);
    expect(formatted).toBe('Merci à @[Seiki Mobility](urn:li:organization:12345) et @[Jaafar Bounaim](urn:li:person:67890) pour ce projet !');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/linkedinMentionFormatter.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `linkedinMentionFormatter.ts`**

Create `src/utils/linkedinMentionFormatter.ts`:
```typescript
import type { TagEntry } from '../services/contentService';

export function formatPostForLinkedIn(text: string, tagBook: TagEntry[]): string {
  let result = text;
  tagBook.forEach((tag) => {
    const aliasRegex = new RegExp(`@${tag.alias}\\b`, 'gi');
    result = result.replace(aliasRegex, `@[${tag.name}](${tag.urn})`);
  });
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/linkedinMentionFormatter.test.ts`
Expected: PASS

- [ ] **Step 5: Add "Copier format LinkedIn" button in `PostEditorPreview.tsx`**

In `PostEditorPreview.tsx`, add a copy button that runs `formatPostForLinkedIn(post.corps, tagBook)` before copying to clipboard, notifying the user via Toast.

- [ ] **Step 6: Commit**

```bash
git add src/utils/linkedinMentionFormatter.ts src/utils/linkedinMentionFormatter.test.ts src/views/contenu/PostEditorPreview.tsx
git commit -m "feat: add linkedinMentionFormatter for exporting LinkedIn URN mentions"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-23-linkedin-auto-tagging.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach would you like to take?
