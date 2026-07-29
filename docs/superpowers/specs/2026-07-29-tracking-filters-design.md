# Design Spec: Quick Filters & Search for Email TrackingTab

**Date:** 2026-07-29  
**Status:** Approved  
**Target File:** `src/views/prospection/TrackingTab.tsx`  

---

## 1. Overview
Add live search and category filter pills to the **TrackingTab** component so users can rapidly search and filter email threads by lead, company, email, subject, or AI sentiment/status.

---

## 2. Controls & Filtering Logic

### 2.1 State
- `searchQuery: string` (default `""`)
- `statusFilter: 'all' | 'positive' | 'negative' | 'opened' | 'bounced'` (default `'all'`)

### 2.2 Filter Categories & Counters
- **Tous**: All threads.
- **Positif (IA)**: Threads where any log/reply has `reply_sentiment === 'positive'`.
- **Négatif (IA)**: Threads where any log/reply has `reply_sentiment === 'negative'`.
- **Ouverts non répondus**: Threads where `opened_at !== null` and no replies exist yet.
- **Rebonds / Échecs**: Threads with `status === 'bounced'` or `status === 'failed'`.

### 2.3 Search Logic
Matches `searchQuery` against (case-insensitive):
- `lead.contact_name`
- `lead.company_name`
- `to_email` / `from_email`
- `subject`
- `body_preview` (outbound or reply)

---

## 3. UI Component Structure
1. **Search Bar**: Input with Lucide `Search` icon and clear button.
2. **Filter Pills**: Clickable buttons displaying label and calculated count.
3. **Filtered List & Empty State**: If search/filter produces 0 results, show "Aucun email ne correspond à votre recherche" with a button to reset filters.
