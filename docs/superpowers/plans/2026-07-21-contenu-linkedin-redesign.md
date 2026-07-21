# Contenu LinkedIn Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the LinkedIn Content creation studio page (`src/views/Contenu.tsx` and subcomponents in `src/views/contenu/`) to match the global Graphite & Gold design tokens (`src/theme.css` and `src/index.css`), aligning visually with Login, Portal, and Agenda views.

**Architecture:** Update `ContenuHeader`, `PostGeneratorForm`, `TagBookPanel`, `PostEditorPreview`, and `PostSchedulerPanel` to use `var(--font-heading)` (`Sora`), `var(--font-body)` (`General Sans`/`Inter`), `var(--bg-panel)`, `var(--border-subtle)`, `#c8b89a` / `var(--gold)` focus highlights, and uppercase tracking-widest section labels.

**Tech Stack:** React, Tailwind CSS, TypeScript.

## Global Constraints
- Primary Headings: `font-bold tracking-tight text-[var(--text-primary)]`, `fontFamily: 'var(--font-heading)'`.
- Subtitles & Labels: `text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)]`.
- Panels & Cards: `bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)]`.
- Inputs: Translucent dark `bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[#c8b89a]` with smooth transitions.
- Action Buttons: `bg-[var(--gold)] text-black font-semibold uppercase tracking-wider hover:bg-[var(--gold)]/90`.

---

### Task 1: Redesign Header (`src/views/contenu/ContenuHeader.tsx`)

**Files:**
- Modify: `src/views/contenu/ContenuHeader.tsx`

**Interfaces:**
- Consumes: `LinkedinAccount` from `../../services/linkedinService`

- [ ] **Step 1: Update ContenuHeader styling**
Update `src/views/contenu/ContenuHeader.tsx` to format the title with `var(--font-heading)`, uppercase tracking label for category/app, and redesigned Jaafar/Seiki connection pills with status indicators and hover borders (`hover:border-[#c8b89a]`).

- [ ] **Step 2: Commit**
`git commit -m "style(contenu): update ContenuHeader with global design tokens and Sora heading"`

---

### Task 2: Redesign Generator Form (`src/views/contenu/PostGeneratorForm.tsx`)

**Files:**
- Modify: `src/views/contenu/PostGeneratorForm.tsx`

**Interfaces:**
- Consumes: `ContentVoice`, `ContentLanguage` from `../../services/contentService`

- [ ] **Step 1: Update PostGeneratorForm styling**
Update `src/views/contenu/PostGeneratorForm.tsx` to use uppercase tracking labels, dark translucent input backgrounds (`bg-black/40 border border-[var(--border-subtle)] focus:border-[#c8b89a]`), styled selects, and gold primary action CTA button for generation.

- [ ] **Step 2: Commit**
`git commit -m "style(contenu): apply design tokens to PostGeneratorForm"`

---

### Task 3: Redesign TagBook Panel (`src/views/contenu/TagBookPanel.tsx`)

**Files:**
- Modify: `src/views/contenu/TagBookPanel.tsx`

**Interfaces:**
- Consumes: `TagEntry` from `../../services/contentService`

- [ ] **Step 1: Update TagBookPanel styling**
Update `src/views/contenu/TagBookPanel.tsx` with uppercase tracking labels, `@alias` gold pills, dark input styling for alias creation, and dark panel styling.

- [ ] **Step 2: Commit**
`git commit -m "style(contenu): update TagBookPanel with global theme tokens"`

---

### Task 4: Redesign Post Editor & Preview (`src/views/contenu/PostEditorPreview.tsx`)

**Files:**
- Modify: `src/views/contenu/PostEditorPreview.tsx`

**Interfaces:**
- Consumes: `LinkedInPost`, `TagEntry`, `MentionField`

- [ ] **Step 1: Update PostEditorPreview styling**
Update `src/views/contenu/PostEditorPreview.tsx` with focus highlights (`focus:border-[#c8b89a]`), uppercase tracking field labels, dark modal styling for the `@mention` autocomplete popup (`bg-[var(--bg-panel)] border border-[var(--border-subtle)] shadow-modal`), and sleek action buttons.

- [ ] **Step 2: Commit**
`git commit -m "style(contenu): update PostEditorPreview styling and mention dropdown"`

---

### Task 5: Redesign Post Scheduler Panel (`src/views/contenu/PostSchedulerPanel.tsx`)

**Files:**
- Modify: `src/views/contenu/PostSchedulerPanel.tsx`

**Interfaces:**
- Consumes: `LinkedinAccount`, `ScheduledPost`, `LinkedInPost`

- [ ] **Step 1: Update PostSchedulerPanel styling**
Update `src/views/contenu/PostSchedulerPanel.tsx` with uppercase tracking labels, dark input/select styling, gold primary button for scheduling, and queue items with semantic status badges (`scheduled`, `posted`, `failed`).

- [ ] **Step 2: Commit**
`git commit -m "style(contenu): update PostSchedulerPanel styling and queue badges"`

---

### Task 6: Build & TypeScript Verification

**Files:**
- Verification: Run `npx tsc --noEmit` and build test.

- [ ] **Step 1: Run type checking**
Run `npx tsc --noEmit` to verify zero TypeScript errors.

- [ ] **Step 2: Run build check**
Run `npm run build` to verify clean production build.
