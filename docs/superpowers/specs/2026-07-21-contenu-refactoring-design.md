# Design Specification: Contenu.tsx Modular Refactoring

**Date**: 2026-07-21  
**Status**: Approved by User  
**Author**: Full-Stack Developer  

---

## 1. Overview & Objective

Decompose the monolithic `Contenu.tsx` (543 lines / 25.7 KB) into clean custom hooks and focused sub-components.

### Goals
- Extract post generation & learning logic to `src/hooks/useLinkedInContent.ts`.
- Extract account management & post scheduling logic to `src/hooks/useLinkedInAccounts.ts`.
- Extract mention TagBook management to `src/hooks/useTagBook.ts`.
- Extract UI sections: `ContenuHeader.tsx`, `PostGeneratorForm.tsx`, `PostEditorPreview.tsx`, `PostSchedulerPanel.tsx`, `TagBookPanel.tsx`.
- Reduce `Contenu.tsx` from 543 lines to ~50 lines of clean orchestrator code.

---

## 2. Target Component & Hook Architecture

```
src/
├── hooks/
│   ├── useLinkedInContent.ts       # AI post generation & learning feedback
│   ├── useLinkedInAccounts.ts      # Account list, scheduling queue, & post publisher
│   └── useTagBook.ts              # Mention aliases & URN tagbook management
│
└── views/contenu/
    ├── ContenuHeader.tsx          # Page header & LinkedIn OAuth connection button
    ├── PostGeneratorForm.tsx      # Subject brief, voice, and language selection
    ├── PostEditorPreview.tsx       # Live editor with hook, corps, hashtags, & mention autocomplete
    ├── PostSchedulerPanel.tsx     # Date/time scheduler, media uploader, & scheduled queue
    ├── TagBookPanel.tsx           # Mention TagBook manager
    └── Contenu.tsx                # Clean ~50-line orchestrator component
```

---

## 3. Verification Plan

1. **Unit Tests**: Run `npm run test` (`vitest run`) to verify all 61 tests pass.
2. **Build Check**: Run `npm run build` (`tsc -b && vite build`) to confirm zero TypeScript build errors.
3. **Functional Check**: Verify AI post generation, editing, mentions, scheduling, and TagBook management work cleanly.
