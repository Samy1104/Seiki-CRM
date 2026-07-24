# Design Spec: LinkedIn Auto-Tagging & On-the-Fly Resolver System

Date: 2026-07-23
Status: Approved

## Overview
This feature introduces an automatic and interactive LinkedIn account tagging system for post generation and editing in Seiki CRM. Users can select accounts to tag before generating a post (guiding the AI generator) or tag people on the fly directly inside the post editor via an interactive `@` auto-complete menu and automatic LinkedIn URL resolver.

---

## 1. System Architecture & Data Model

### Data Model (`TagEntry`)
Location: `src/services/contentService.ts`

```typescript
export interface TagEntry {
  alias: string;        // Short unique alias (e.g. "seiki", "jaafar")
  name: string;         // Display name (e.g. "Seiki Mobility", "Jaafar Bounaim")
  urn: string;          // LinkedIn URN (e.g. "urn:li:organization:12345" or "urn:li:person:abcde")
  url?: string;         // Optional LinkedIn URL
  type?: 'organization' | 'person';
}
```

### Tag Resolver Service (`src/services/linkedinTagService.ts`)
A dedicated service responsible for:
- Parsing LinkedIn URLs and handles (`linkedin.com/company/...`, `linkedin.com/in/...`, `@handle`).
- Inferring clean `@alias`, display name, and standard `urn:li:organization:...` or `urn:li:person:...` identifier structures.
- Persisting newly registered tags into Supabase `app_settings` (`linkedin_tag_book` key).

---

## 2. Pre-Generation Tagging (`PostGeneratorForm.tsx`)

- **Tag Selector UI**: A multi-select tag picker displaying saved TagBook entries as toggleable chips (`+ @seiki`, `+ @lyon`, etc.).
- **Inline Quick Add**: Includes a `+ Add Tag` button opening a swift LinkedIn URL/handle input.
- **AI Context Integration**: Passes selected tags into `contentService.generateLinkedInPost(brief, voice, language, selectedTags)`, instructing the AI to naturally integrate mentions into the generated post body or hook.

---

## 3. Post-Generation Tagging (`PostEditorPreview.tsx`)

- **Interactive `@` Auto-Complete Combobox**:
  - Triggers floating dropdown when `@` is typed in the post editor textarea.
  - Filters existing TagBook entries dynamically based on typed query.
- **On-The-Fly New Account Modal / Popover**:
  - Displays top action item `+ Add "@[query]" from LinkedIn URL` when no exact match is found.
  - Opens a quick inline popup accepting a LinkedIn profile/company URL.
  - Resolves URN & alias automatically, saves tag to Supabase, and inserts formatted tag into the editor text.

---

## 4. Formatting & LinkedIn Publishing Output

- **Internal Mention Format**: Stores mention tokens in text (e.g., `@{alias}` or `@[Name](urn)`).
- **LinkedIn Export / Copy Utility**: Formats post payload to standard LinkedIn mention syntax `@[Display Name](urn:li:organization:12345)` when publishing or copying to clipboard for posting.

---

## 5. Verification & Testing Plan

1. **Unit & Component Testing**: Verify URL parser service outputs correct URN & alias for organization and person URLs.
2. **Pre-Gen Integration**: Verify selected tags are injected into AI generation prompt.
3. **Editor `@` Combobox**: Test `@` key trigger, tag insertion at cursor position, and on-the-fly URL addition.
4. **Supabase Persistence**: Confirm new tags are saved to `app_settings` and immediately available in TagBook.
