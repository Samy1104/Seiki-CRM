# Email Display Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the email thread display in `TrackingTab` to strip/collapse legacy quoted text and render modern email cards with a visual step timeline.

**Architecture:** Create a pure utility `emailParser.ts` for splitting raw email bodies into clean text and quoted context, then update `TrackingTab.tsx` with card UI components, interactive quoted-text accordions, and a visual activity step timeline.

**Tech Stack:** React, Lucide Icons, TypeScript, Vitest, Tailwind CSS.

## Global Constraints

- Must parse both French (`Le ... a écrit :`) and English (`On ... wrote:`) reply headers.
- Must preserve full quoted text in a collapsible view (`[+ Afficher le message cité]`).
- Must pass all Vitest tests.

---

### Task 1: Email Body Parser Utility (`emailParser.ts`)

**Files:**
- Create: `src/utils/emailParser.ts`
- Test: `src/utils/emailParser.test.ts`

**Interfaces:**
- Consumes: Raw email string (`body_preview`).
- Produces: `export interface ParsedEmailBody { cleanBody: string; quotedBody?: string; }` and `export function parseEmailBody(rawBody: string): ParsedEmailBody`.

- [ ] **Step 1: Write the failing unit test**

Create `src/utils/emailParser.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseEmailBody } from './emailParser';

describe('parseEmailBody', () => {
  it('handles clean messages without quotes', () => {
    const raw = 'Bonjour, merci pour votre message.';
    const res = parseEmailBody(raw);
    expect(res.cleanBody).toBe('Bonjour, merci pour votre message.');
    expect(res.quotedBody).toBeUndefined();
  });

  it('strips French email reply quotes', () => {
    const raw = `Merci, nous ne sommes pas intéressés.

Le mer. 29 juil. 2026 à 17:08, Seiki CRM <baiaks1104@gmail.com> a écrit :

> Bonjour Samy,
>
> Cordialement,
> Seiki`;

    const res = parseEmailBody(raw);
    expect(res.cleanBody).toBe('Merci, nous ne sommes pas intéressés.');
    expect(res.quotedBody).toContain('Le mer. 29 juil. 2026 à 17:08');
    expect(res.quotedBody).toContain('> Bonjour Samy');
  });

  it('strips English email reply quotes', () => {
    const raw = `Thank you for your email.

On Wed, Jul 29, 2026 at 5:08 PM Seiki CRM wrote:

> Hello Samy`;

    const res = parseEmailBody(raw);
    expect(res.cleanBody).toBe('Thank you for your email.');
    expect(res.quotedBody).toContain('On Wed, Jul 29');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/emailParser.test.ts`
Expected: FAIL with "Cannot find module ./emailParser"

- [ ] **Step 3: Write implementation of `emailParser.ts`**

Create `src/utils/emailParser.ts`:
```ts
export interface ParsedEmailBody {
  cleanBody: string;
  quotedBody?: string;
}

const QUOTE_HEADER_REGEX = /(^|\n)(Le\s+.*\s+a\s+écrit\s*:|On\s+.*\s+wrote\s*:|De\s*:|From\s*:|-----Original Message-----|--------------------------------)/i;

export function parseEmailBody(rawBody: string): ParsedEmailBody {
  if (!rawBody) return { cleanBody: '' };

  const match = rawBody.match(QUOTE_HEADER_REGEX);
  if (match && match.index !== undefined) {
    const cleanBody = rawBody.slice(0, match.index).trim();
    const quotedBody = rawBody.slice(match.index).trim();
    return {
      cleanBody: cleanBody || rawBody.trim(),
      quotedBody: quotedBody || undefined,
    };
  }

  // Fallback: check for lines starting with '>'
  const lines = rawBody.split('\n');
  const cleanLines: string[] = [];
  const quoteLines: string[] = [];
  let foundQuote = false;

  for (const line of lines) {
    if (line.trim().startsWith('>')) {
      foundQuote = true;
    }
    if (foundQuote) {
      quoteLines.push(line);
    } else {
      cleanLines.push(line);
    }
  }

  if (foundQuote && cleanLines.length > 0) {
    return {
      cleanBody: cleanLines.join('\n').trim(),
      quotedBody: quoteLines.join('\n').trim(),
    };
  }

  return { cleanBody: rawBody.trim() };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/emailParser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/emailParser.ts src/utils/emailParser.test.ts
git commit -m "feat: add emailParser utility for stripping quoted reply text"
```

---

### Task 2: Redesign `TrackingTab.tsx` with Cards, Collapsible History & Activity Timeline

**Files:**
- Modify: `src/views/prospection/TrackingTab.tsx`

**Interfaces:**
- Consumes: `parseEmailBody` from `src/utils/emailParser.ts`.
- Produces: Enhanced `TrackingTab` component.

- [ ] **Step 1: Update `TrackingTab.tsx` implementation**

Update `src/views/prospection/TrackingTab.tsx`:
1. Import `parseEmailBody` from `../../utils/emailParser`.
2. Replace the metadata grid with a sleek step progress timeline bar:
   - **Sent**: Send icon + `sent_at` timestamp.
   - **Opened**: Eye icon + `opened_at` timestamp or "Non ouvert".
   - **Replied / Inbound**: MessageSquare icon + `replied_at` timestamp or status.
3. Wrap email messages in styled cards (`bg-surface-elevated` / dark card styling) with sender avatars and clear typography.
4. Integrate collapsible `[+ Afficher le message cité]` component for `quotedBody` inside replies.

- [ ] **Step 2: Run Vitest to verify all tests pass**

Run: `npx vitest run src/components/Sidebar.test.tsx src/utils/emailParser.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/views/prospection/TrackingTab.tsx
git commit -m "feat: upgrade TrackingTab with modern email cards, quoted text toggle, and step timeline"
```
