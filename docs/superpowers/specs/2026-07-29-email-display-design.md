# Design Spec: Email Display Upgrade in TrackingTab

**Date:** 2026-07-29  
**Status:** Approved  
**Target File:** `src/views/prospection/TrackingTab.tsx`  
**New Utility:** `src/utils/emailParser.ts`  

---

## 1. Overview
The **TrackingTab** component displays outbound emails and inbound replies for sales prospection. Currently, incoming replies display raw quoted email text (such as `Le mer. ... a écrit :` and `> ...`) in the main body preview, causing visual clutter and duplication. Furthermore, the email body layout and timestamp metadata use plain unstyled boxes and text grids.

This specification details the overhaul of the email thread display into a modern card-based email client experience, including automated quoted-text stripping and an interactive activity timeline.

---

## 2. Architecture & Components

### 2.1 `src/utils/emailParser.ts`
A pure utility function `parseEmailBody(rawBody: string)` that splits raw message bodies into clean content and quoted context:
```ts
export interface ParsedEmailBody {
  cleanBody: string;
  quotedBody?: string;
}
```
**Parsing rules:**
1. Split content on common email reply header markers:
   - `Le \w+.*a écrit\s*:` (French reply header)
   - `On .* wrote\s*:` (English reply header)
   - `-----Original Message-----` / `De\s*:` / `From\s*:`
   - Signature separators like `--------------------------------` followed by email headers.
2. Filter lines starting with `>` or leading blockquotes into `quotedBody`.
3. Trim and normalize whitespace in `cleanBody`.

### 2.2 Modern Email Cards in `TrackingTab.tsx`
Replace the plain `<p>` body text wrappers with styled email message cards:
- **Header Badge**: Avatar initials or icon, sender display name, recipient tag, timestamp.
- **Sentiment Tag**: Styled pill (`Réponse positive (IA)`, `Réponse négative (IA)`, `Réponse neutre (IA)`).
- **Body Area**: Styled card with proper padding, line-height, and typography.
- **Quoted History Toggle**: If `quotedBody` exists, render a subtle button `[+ Afficher le message cité]` to expand/collapse `quotedBody`.

### 2.3 Visual Activity Timeline
Replace the 2x2 grid of dates with a horizontal step timeline:
- **Envoyé** (Send icon, timestamp)
- **Ouvert** (Eye icon, timestamp / pending state)
- **Répondu / Reçu** (MessageSquare icon, timestamp / pending state)

---

## 3. Testing Plan
- `src/utils/emailParser.test.ts`: Vitest test suite testing parsing of French and English email replies with quoted headers.
- Visual & interaction testing in `TrackingTab.tsx`.
