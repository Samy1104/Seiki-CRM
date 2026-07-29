# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal Seiki team — everyone has the same full access to every module. No roles, no permission tiers. The team is small; the tool is built for people who know each other and know the business, not for onboarding strangers.

Primary jobs:
- Sales / business development: managing leads, moving deals through the pipeline, logging tasks, booking meetings
- Management: reviewing CODIR dashboard, reading stats, overseeing prospection campaigns
- Content / outreach: writing and scheduling LinkedIn posts, running B2B email prospection sequences

## Product Purpose

Seiki CRM is the internal operating system for a French B2B consulting firm. It unifies two otherwise separate disciplines — sales (CRM module: pipeline, leads, tasks, agenda, stats, CODIR) and outreach (Contenu module: prospection, LinkedIn posts) — into a single tool everyone uses without a learning curve.

Success means the team spends less time switching between tools and more time with clients and prospects.

## Positioning

Seiki's own brand lives inside the tool — it is not a generic SaaS skin. The dark editorial aesthetic, the "Powered by Seiki" footer, and the split-screen portal entry are deliberate signals that this is a premium consulting firm's internal instrument, not an off-the-shelf CRM reskinned.

## Operating Context

- Used daily by a small, cohesive team — everyone sees everything, trusts everyone
- French-speaking context; all UI copy is in French
- Sessions start at the Portal (split-screen CRM / Contenu chooser) and branch into either the CRM sidebar or the Contenu sidebar
- Supabase handles auth and data; deployed on Netlify
- LinkedIn posting scheduled via cron for a personal profile (Jaafar) and a Seiki company page (pending LinkedIn approval as of 2026-07)

## Capabilities and Constraints

Confirmed capabilities:
- Pipeline: kanban-style deal tracking
- Leads: contact management with add/edit
- Tasks: personal task list
- Agenda: calendar view for meetings and events
- Stats: activity and performance metrics (Recharts)
- CODIR Dashboard: executive summary view
- Prospection: B2B email outreach sequences (Resend; RESEND_FROM_EMAIL env var required)
- LinkedIn Posts: content management and scheduled publishing

Constraints:
- French-only UI — no English copy in production screens
- Supabase + current tech stack (React 19, TypeScript, Vite, Tailwind v4, Supabase) — no infrastructure replacement
- Dark Graphite Amber palette is a brand commitment, not a style preference — mandatory
- Seiki name and logo are fixed — no rebranding

## Brand Commitments

- **Name:** Seiki / Seiki Consulting
- **Logo:** grand_logo.png (light cream on dark) — fixed asset, do not redesign
- **Voice:** Minimal, French, elevated. Sparse copy, wide tracking, no filler. The tone is a premium consulting firm, not a SaaS product.
- **Visual identity:** Graphite Amber — near-black (#0d0d0d) base, warm cream (#f2ede4 / #D4C4A8) foregrounds, amber (#F59E0B) as the single accent. Playfair Display for the portal entry moment; Sora + General Sans for the operating interface. Dark theme is mandatory and permanent.
- **"Powered by Seiki"** tag in the sidebar footer — keep.

## Evidence on Hand

- Logo: `public/grand_logo.png`, `Logo Seiki large.png`, `seikiconsulting_logo.jpg`
- Self-hosted font files in `src/assets/fonts/`: Sora (600/700/800), General Sans (400/500/600), Inter Variable, Playfair Display Variable
- No external testimonials, case studies, or press assets — do not fabricate

## Product Principles

1. **One tool, no context-switching.** CRM and content live in one authenticated session with one sidebar — the team should never need to open a second app.
2. **Brand first, SaaS second.** The interface is an expression of Seiki's identity. Design decisions favor editorial precision and warmth over generic utility patterns.
3. **Small team, full trust.** No permission walls, no onboarding flows, no safety rails. The UX assumes the user is a competent colleague who already knows what they're doing.
4. **French, always.** Language is not configurable. Every label, error, and empty state is in French.
5. **Dark by commitment.** The Graphite Amber palette is the brand. Light-mode alternatives are not offered.

## Accessibility & Inclusion

No specific accessibility standard mandated by the user. Internal tool for a small team; baseline WCAG AA contrast on interactive elements is good practice.
