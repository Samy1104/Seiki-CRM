# Calendly Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync Calendly bookings (and cancellations) into the CRM's Agenda automatically, linked to matching Leads, via a "Connecter Calendly" OAuth button.

**Architecture:** OAuth connect flow mirrors the existing `linkedin_accounts`/`gmail_accounts` pattern exactly (single-row account table, edge-function start/callback pair). Because the connected Calendly account is on the **free plan** (no webhook support), sync is a `pg_cron`-driven poll every 5 minutes — same pattern as `poll-gmail-inbox` — re-fetching a snapshot of scheduled events rather than following an incremental history cursor.

**Tech Stack:** Supabase (Postgres + Deno Edge Functions + `pg_cron`/`pg_net`), React 19 + TypeScript (Vite), Vitest.

## Global Constraints

- Mono-user tool: exactly one connected Calendly account, same convention as `gmail_accounts`/`linkedin_accounts` (delete-then-upsert on reconnect).
- SQL schema changes are applied manually via Supabase SQL Editor (no migration CLI in this repo) — new files go in `archive/schema_calendly_*.sql`, following the naming of `archive/schema_gmail_addon.sql` / `archive/schema_gmail_cron.sql`.
- Edge functions follow existing conventions: `corsHeaders(req)` from `_shared/cors.ts`, `requireServiceRole`/`requireUser` from `_shared/requireUser.ts`, `fetchWithTimeout` from `_shared/fetchWithTimeout.ts` for every outbound call.
- Cron-triggered functions authenticate via the `CRON_SECRET` env var (must equal the Supabase Vault secret `seiki_cron_secret`, already created for the Gmail/LinkedIn crons).
- Frontend routes are React Router paths (`/crm/agenda`), **not** the legacy `?activeApp=` query param used by the older `gmail-oauth-callback`/`linkedin-oauth-callback` (verified dead: `App.tsx` has no `activeApp` handling, only `<Route path="agenda" element={<Agenda />} />` under `/crm`).
- New history entries must satisfy `public.history`'s `action_type` CHECK constraint — extend it, don't bypass it.

---

### Task 1: Database schema — `calendly_accounts`, `calendly_bookings`, history constraint

**Files:**
- Create: `archive/schema_calendly_addon.sql`

**Interfaces:**
- Produces: table `public.calendly_accounts(id, calendly_user_uri, access_token, refresh_token, expires_at, connected_at, updated_at)`.
- Produces: table `public.calendly_bookings(id, calendly_event_uri, title, start_time, end_time, invitee_name, invitee_email, location, status, cancel_reason, lead_id, created_at, updated_at)`.
- Produces: `public.history.action_type` CHECK now also allows `'calendly_booking'`.

- [ ] **Step 1: Write the schema file**

```sql
-- ============================================================
-- SEIKI CRM — Add-on Calendly Integration
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS le schéma principal (schema_supabase.sql)
-- ============================================================

-- ============================================================
-- 1. TABLE CALENDLY_ACCOUNTS — Compte Calendly connecté
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calendly_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendly_user_uri   TEXT NOT NULL UNIQUE,
  access_token        TEXT NOT NULL,
  refresh_token       TEXT NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  connected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.calendly_accounts IS 'Compte Calendly connecté (outil mono-utilisateur, une seule ligne) pour la synchronisation des rendez-vous';
COMMENT ON COLUMN public.calendly_accounts.access_token IS 'Token OAuth Calendly — non chiffré en base, protégé uniquement par RLS';

ALTER TABLE public.calendly_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.calendly_accounts;
CREATE POLICY "authenticated_full_access" ON public.calendly_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_calendly_accounts_updated ON public.calendly_accounts;
CREATE TRIGGER trg_calendly_accounts_updated
  BEFORE UPDATE ON public.calendly_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. TABLE CALENDLY_BOOKINGS — Rendez-vous synchronisés
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calendly_bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendly_event_uri  TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,
  invitee_name        TEXT NOT NULL,
  invitee_email       TEXT NOT NULL,
  location            TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  cancel_reason       TEXT,
  lead_id             UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.calendly_bookings IS 'Rendez-vous Calendly synchronisés par polling (poll-calendly-bookings), affichés dans l''Agenda';

ALTER TABLE public.calendly_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.calendly_bookings;
CREATE POLICY "authenticated_full_access" ON public.calendly_bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_calendly_bookings_updated ON public.calendly_bookings;
CREATE TRIGGER trg_calendly_bookings_updated
  BEFORE UPDATE ON public.calendly_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_calendly_bookings_start_time
  ON public.calendly_bookings(start_time);

CREATE INDEX IF NOT EXISTS idx_calendly_bookings_lead_id
  ON public.calendly_bookings(lead_id);

-- ============================================================
-- 3. HISTORY — Ajout de 'calendly_booking' aux action_type autorisés
-- ============================================================
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_action_type_check;
ALTER TABLE public.history ADD CONSTRAINT history_action_type_check CHECK (action_type IN (
  'note', 'stage_change', 'email_sent', 'email_received',
  'call', 'linkedin_add', 'task_created', 'score_update',
  'merge', 'sequence_start', 'sequence_step', 'calendly_booking'
));
```

- [ ] **Step 2: Apply it and verify**

Run this in Supabase SQL Editor, then verify with:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('calendly_accounts', 'calendly_bookings');
```

Expected: 2 rows returned.

```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'history_action_type_check';
```

Expected: definition includes `'calendly_booking'`.

- [ ] **Step 3: Commit**

```bash
git add archive/schema_calendly_addon.sql
git commit -m "feat: add Calendly accounts/bookings schema"
```

---

### Task 2: Shared Calendly API helper

**Files:**
- Create: `supabase/functions/_shared/calendlyApi.ts`
- Test: `supabase/functions/_shared/calendlyApi.test.ts`
- Modify: `supabase/.env.example`

**Interfaces:**
- Consumes: `fetchWithTimeout` from `./fetchWithTimeout.ts` (signature: `fetchWithTimeout(input: string | URL, init?: RequestInit, timeoutMs?: number): Promise<Response>`).
- Produces: `buildRedirectUri(supabaseUrl: string): string`, `exchangeCodeForToken(code: string, redirectUri: string): Promise<CalendlyTokenResponse>`, `refreshAccessToken(refreshToken: string): Promise<CalendlyTokenResponse>`, `fetchCurrentUserUri(accessToken: string): Promise<string>`, `listScheduledEvents(accessToken: string, userUri: string, minStartTime: string, maxStartTime: string): Promise<CalendlyScheduledEvent[]>`, `listEventInvitees(accessToken: string, eventUri: string): Promise<CalendlyInvitee[]>`, `formatLocation(location: CalendlyLocation | null): string | null`, types `CalendlyTokenResponse`, `CalendlyScheduledEvent`, `CalendlyLocation`, `CalendlyInvitee`.

- [ ] **Step 1: Write `calendlyApi.ts`**

```ts
// ============================================================
// _shared/calendlyApi.ts
// Helpers API REST Calendly (échange/refresh OAuth, liste des
// événements planifiés, invités) partagés par calendly-oauth-callback
// et poll-calendly-bookings.
// ============================================================

import { fetchWithTimeout } from "./fetchWithTimeout.ts";

export function buildRedirectUri(supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/calendly-oauth-callback`;
}

export interface CalendlyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function requestToken(params: Record<string, string>): Promise<CalendlyTokenResponse> {
  const clientId = Deno.env.get("CALENDLY_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CALENDLY_CLIENT_SECRET")!;
  const body = new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret });

  const res = await fetchWithTimeout("https://auth.calendly.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Calendly OAuth error: ${JSON.stringify(data)}`);
  return data as CalendlyTokenResponse;
}

export function exchangeCodeForToken(code: string, redirectUri: string): Promise<CalendlyTokenResponse> {
  return requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshAccessToken(refreshToken: string): Promise<CalendlyTokenResponse> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function fetchCurrentUserUri(accessToken: string): Promise<string> {
  const res = await fetchWithTimeout("https://api.calendly.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Calendly users/me error: ${JSON.stringify(data)}`);
  return data.resource.uri as string;
}

export interface CalendlyLocation {
  type: string;
  location?: string;
  join_url?: string;
}

export interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  location: CalendlyLocation | null;
}

export async function listScheduledEvents(
  accessToken: string,
  userUri: string,
  minStartTime: string,
  maxStartTime: string,
): Promise<CalendlyScheduledEvent[]> {
  const events: CalendlyScheduledEvent[] = [];
  let url: string | null =
    `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(userUri)}` +
    `&min_start_time=${encodeURIComponent(minStartTime)}&max_start_time=${encodeURIComponent(maxStartTime)}` +
    `&sort=start_time:asc&count=100`;

  while (url) {
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(`Calendly scheduled_events error: ${JSON.stringify(data)}`);
    events.push(...(data.collection as CalendlyScheduledEvent[]));
    url = data.pagination?.next_page ?? null;
  }

  return events;
}

export interface CalendlyInvitee {
  name: string;
  email: string;
  status: "active" | "canceled";
  cancel_reason: string | null;
}

export async function listEventInvitees(accessToken: string, eventUri: string): Promise<CalendlyInvitee[]> {
  const res = await fetchWithTimeout(`${eventUri}/invitees`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Calendly invitees error: ${JSON.stringify(data)}`);
  return (data.collection as Array<{ name: string; email: string; status: "active" | "canceled"; cancellation?: { reason: string | null } }>).map(
    (inv) => ({
      name: inv.name,
      email: inv.email,
      status: inv.status,
      cancel_reason: inv.cancellation?.reason ?? null,
    }),
  );
}

// Un événement en présentiel n'a qu'un `location`, un événement en visio n'a
// qu'un `join_url` — jamais les deux. On priorise join_url (le cas le plus
// courant pour ce compte) puis retombe sur location.
export function formatLocation(location: CalendlyLocation | null): string | null {
  if (!location) return null;
  if (location.join_url) return location.join_url;
  if (location.location) return location.location;
  return null;
}
```

- [ ] **Step 2: Write the test for the one pure function**

```ts
import { describe, it, expect } from 'vitest';
import { formatLocation } from './calendlyApi.ts';

describe('formatLocation', () => {
  it('returns null when location is null', () => {
    expect(formatLocation(null)).toBeNull();
  });

  it('prefers join_url when both join_url and location are present', () => {
    expect(formatLocation({ type: 'zoom_conference', join_url: 'https://zoom.us/j/123', location: 'Paris' })).toBe(
      'https://zoom.us/j/123',
    );
  });

  it('falls back to location when join_url is absent', () => {
    expect(formatLocation({ type: 'physical', location: '12 rue de Paris' })).toBe('12 rue de Paris');
  });

  it('returns null when neither join_url nor location is present', () => {
    expect(formatLocation({ type: 'ask_invitee' })).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npm run test -- calendlyApi.test.ts`
Expected: 4 passed.

- [ ] **Step 4: Document the required secrets**

Append to `supabase/.env.example`:

```
# Calendly API — connexion OAuth + synchronisation des rendez-vous (OBLIGATOIRE
# pour l'intégration Agenda Calendly)
# Créer une app sur https://developer.calendly.com > My Apps
# Redirect URI à enregistrer : https://<PROJECT_REF>.supabase.co/functions/v1/calendly-oauth-callback
CALENDLY_CLIENT_ID=votre_client_id
CALENDLY_CLIENT_SECRET=votre_client_secret
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/calendlyApi.ts supabase/functions/_shared/calendlyApi.test.ts supabase/.env.example
git commit -m "feat: add shared Calendly API helper"
```

---

### Task 3: `calendly-oauth-start` edge function

**Files:**
- Create: `supabase/functions/calendly-oauth-start/index.ts`

**Interfaces:**
- Consumes: `buildRedirectUri` from `../_shared/calendlyApi.ts`; `getAllowedOrigins` from `../_shared/cors.ts`.
- Produces: HTTP endpoint `GET /functions/v1/calendly-oauth-start?origin=<url>` → 302 redirect to Calendly's authorize screen.

- [ ] **Step 1: Write the function**

```ts
// ============================================================
// Edge Function : calendly-oauth-start
// Runtime : Deno (Supabase)
// Rôle : Construit l'URL d'autorisation Calendly et redirige vers
//        l'écran de consentement (flux OAuth 2.0). Appelé directement
//        en navigation (pas de CORS/fetch JS).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildRedirectUri } from "../_shared/calendlyApi.ts";
import { getAllowedOrigins } from "../_shared/cors.ts";

serve((req: Request) => {
  const clientId = Deno.env.get("CALENDLY_CLIENT_ID")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = buildRedirectUri(supabaseUrl);

  // Même convention que gmail-oauth-start : l'origine appelante transite par
  // `state` pour que le callback sache où rediriger, quel que soit
  // l'environnement (localhost, staging, prod).
  const requestedOrigin = new URL(req.url).searchParams.get("origin") ?? "";
  const allowedOrigins = getAllowedOrigins();
  const origin = allowedOrigins.includes(requestedOrigin) ? requestedOrigin : allowedOrigins[0];
  const state = btoa(JSON.stringify({ origin }));

  const authorizeUrl = new URL("https://auth.calendly.com/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, { status: 302, headers: { Location: authorizeUrl.toString() } });
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/calendly-oauth-start/index.ts
git commit -m "feat: add calendly-oauth-start edge function"
```

---

### Task 4: `calendly-oauth-callback` edge function

**Files:**
- Create: `supabase/functions/calendly-oauth-callback/index.ts`

**Interfaces:**
- Consumes: `buildRedirectUri`, `exchangeCodeForToken`, `fetchCurrentUserUri` from `../_shared/calendlyApi.ts`; `getAllowedOrigins` from `../_shared/cors.ts`.
- Produces: HTTP endpoint `GET /functions/v1/calendly-oauth-callback?code=...&state=...` → upserts `calendly_accounts`, triggers one immediate backfill poll, 302-redirects to `/crm/agenda?calendly=connected` or `/crm/agenda?calendly=error&message=...`.

- [ ] **Step 1: Write the function**

```ts
// ============================================================
// Edge Function : calendly-oauth-callback
// Runtime : Deno (Supabase)
// Rôle : Reçoit le code d'autorisation Calendly, échange contre un
//        token, résout l'URI utilisateur, stocke dans calendly_accounts
//        (une seule ligne — upsert), déclenche un backfill immédiat,
//        puis redirige vers l'Agenda.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildRedirectUri, exchangeCodeForToken, fetchCurrentUserUri } from "../_shared/calendlyApi.ts";
import { getAllowedOrigins } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);

  const stateRaw = url.searchParams.get("state");
  const allowedOrigins = getAllowedOrigins();
  let stateOrigin: string | null = null;
  try {
    if (stateRaw) stateOrigin = JSON.parse(atob(stateRaw)).origin ?? null;
  } catch {
    // state absent/invalide — retombe sur FRONTEND_URL ci-dessous
  }
  const frontendUrl = (stateOrigin && allowedOrigins.includes(stateOrigin))
    ? stateOrigin
    : Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  const redirectWithError = (message: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${frontendUrl}/crm/agenda?calendly=error&message=${encodeURIComponent(message)}` },
    });

  if (errorParam) return redirectWithError(`Calendly a refusé la connexion (${errorParam})`);
  if (!code) return redirectWithError("Réponse Calendly incomplète (code manquant)");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const redirectUri = buildRedirectUri(supabaseUrl);
    const token = await exchangeCodeForToken(code, redirectUri);
    const userUri = await fetchCurrentUserUri(token.access_token);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    // Outil mono-compte : connecter un compte Calendly différent remplace la
    // connexion précédente, même convention que gmail_accounts.
    await supabase.from("calendly_accounts").delete().neq("calendly_user_uri", userUri);

    const { error: upsertErr } = await supabase.from("calendly_accounts").upsert(
      {
        calendly_user_uri: userUri,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "calendly_user_uri" },
    );

    if (upsertErr) throw upsertErr;

    // Backfill immédiat : ne pas attendre jusqu'à 5 min le prochain tick cron
    // pour voir apparaître les réservations déjà existantes. Non bloquant —
    // un échec ici est rattrapé par le prochain tick.
    try {
      await fetch(`${supabaseUrl}/functions/v1/poll-calendly-bookings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("CRON_SECRET")}`,
          "Content-Type": "application/json",
        },
      });
    } catch (pollErr) {
      console.error("[calendly-oauth-callback] Backfill poll failed:", pollErr);
    }

    return new Response(null, {
      status: 302,
      headers: { Location: `${frontendUrl}/crm/agenda?calendly=connected` },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[calendly-oauth-callback] Erreur :", message);
    return redirectWithError(message);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/calendly-oauth-callback/index.ts
git commit -m "feat: add calendly-oauth-callback edge function"
```

---

### Task 5: `poll-calendly-bookings` edge function

**Files:**
- Create: `supabase/functions/poll-calendly-bookings/index.ts`

**Interfaces:**
- Consumes: `corsHeaders` from `../_shared/cors.ts`; `requireServiceRole` from `../_shared/requireUser.ts`; `refreshAccessToken`, `listScheduledEvents`, `listEventInvitees`, `formatLocation`, `CalendlyScheduledEvent` from `../_shared/calendlyApi.ts`.
- Produces: HTTP endpoint `POST /functions/v1/poll-calendly-bookings` (service-role only) → upserts `calendly_bookings`, links matching `leads`, inserts `history` rows on new bookings/cancellations. Returns `{ processed, created, canceled, unchanged, errors }` or `{ skipped: "no Calendly account connected" }`.

- [ ] **Step 1: Write the function**

```ts
// ============================================================
// Edge Function : poll-calendly-bookings
// Runtime : Deno (Supabase)
// Rôle : Calendly (plan gratuit) ne supporte pas les webhooks — on
//        interroge périodiquement /scheduled_events pour détecter
//        nouvelles réservations et annulations. Appelée par le cron
//        Supabase toutes les 5 min (et une fois après la connexion
//        OAuth pour le backfill initial).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireServiceRole } from "../_shared/requireUser.ts";
import {
  refreshAccessToken,
  listScheduledEvents,
  listEventInvitees,
  formatLocation,
  type CalendlyScheduledEvent,
} from "../_shared/calendlyApi.ts";

interface CalendlyAccountRow {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendly_user_uri: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  const authError = requireServiceRole(req, corsHeaders(req));
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: account, error: accErr } = await supabase
      .from("calendly_accounts")
      .select("id, access_token, refresh_token, expires_at, calendly_user_uri")
      .limit(1)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(JSON.stringify({ skipped: "no Calendly account connected" }), {
        status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const acc = account as CalendlyAccountRow;
    let accessToken = acc.access_token;
    const expiresInMs = new Date(acc.expires_at).getTime() - Date.now();
    if (expiresInMs < 5 * 60 * 1000) {
      const refreshed = await refreshAccessToken(acc.refresh_token);
      accessToken = refreshed.access_token;
      await supabase
        .from("calendly_accounts")
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", acc.id);
    }

    // Fenêtre glissante : 30 j en arrière (capte les dernières annulations de
    // RDV déjà passés) à 90 j en avant.
    const minStartTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const maxStartTime = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const events = await listScheduledEvents(accessToken, acc.calendly_user_uri, minStartTime, maxStartTime);

    let created = 0;
    let canceled = 0;
    let unchanged = 0;
    let errors = 0;

    // Chaque événement est traité isolément : un échec ponctuel (invitees
    // 404/429...) ne doit pas faire échouer tout le lot, même logique que
    // poll-gmail-inbox.
    for (const event of events) {
      try {
        const outcome = await syncOneEvent(supabase, accessToken, event);
        if (outcome === "created") created++;
        else if (outcome === "canceled") canceled++;
        else unchanged++;
      } catch (err) {
        errors++;
        console.error("[poll-calendly-bookings] Failed to process event", event.uri, ":", err instanceof Error ? err.message : err);
      }
    }

    return new Response(JSON.stringify({ processed: events.length, created, canceled, unchanged, errors }), {
      status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[poll-calendly-bookings] Erreur :", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

async function syncOneEvent(
  supabase: ReturnType<typeof createClient>,
  accessToken: string,
  event: CalendlyScheduledEvent,
): Promise<"created" | "canceled" | "unchanged"> {
  const invitees = await listEventInvitees(accessToken, event.uri);
  // Outil de prise de RDV 1:1 (pas d'événements de groupe) : un seul invité
  // actif par événement.
  const invitee = invitees[0];
  if (!invitee) return "unchanged";

  const status: "active" | "canceled" = event.status === "canceled" || invitee.status === "canceled" ? "canceled" : "active";

  const { data: existing } = await supabase
    .from("calendly_bookings")
    .select("id, status, lead_id")
    .eq("calendly_event_uri", event.uri)
    .maybeSingle();

  const isNewBooking = !existing;
  const isNewCancellation = !!existing && existing.status === "active" && status === "canceled";

  const { data: upserted, error: upsertErr } = await supabase
    .from("calendly_bookings")
    .upsert(
      {
        calendly_event_uri: event.uri,
        title: event.name,
        start_time: event.start_time,
        end_time: event.end_time,
        invitee_name: invitee.name,
        invitee_email: invitee.email,
        location: formatLocation(event.location),
        status,
        cancel_reason: invitee.cancel_reason,
      },
      { onConflict: "calendly_event_uri" },
    )
    .select("id, lead_id")
    .single();

  if (upsertErr || !upserted) {
    throw new Error(upsertErr?.message ?? "upsert returned no row");
  }

  if (!isNewBooking && !isNewCancellation) return "unchanged";

  await linkLeadAndLogHistory(supabase, upserted.id, existing?.lead_id ?? null, invitee.email, event, status);
  return isNewBooking ? "created" : "canceled";
}

async function linkLeadAndLogHistory(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  existingLeadId: string | null,
  inviteeEmail: string,
  event: CalendlyScheduledEvent,
  status: "active" | "canceled",
): Promise<void> {
  let leadId = existingLeadId;

  if (!leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .ilike("email", inviteeEmail)
      .eq("is_archived", false)
      .limit(1)
      .maybeSingle();
    leadId = lead?.id ?? null;
    if (leadId) {
      await supabase.from("calendly_bookings").update({ lead_id: leadId }).eq("id", bookingId);
    }
  }

  if (!leadId) return;

  const dateLabel = new Date(event.start_time).toLocaleString("fr-FR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  });

  const content = status === "canceled"
    ? `Rendez-vous Calendly annulé (initialement prévu le ${dateLabel})`
    : `Rendez-vous Calendly programmé le ${dateLabel}`;

  const { error: historyErr } = await supabase.from("history").insert([{
    lead_id: leadId,
    action_type: "calendly_booking",
    content,
    metadata: { calendly_event_uri: event.uri, start_time: event.start_time, end_time: event.end_time, status },
    is_auto: true,
  }]);
  if (historyErr) console.error("[poll-calendly-bookings] Failed to insert history entry:", historyErr.message);
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/poll-calendly-bookings/index.ts
git commit -m "feat: add poll-calendly-bookings edge function"
```

---

### Task 6: `pg_cron` schedule

**Files:**
- Create: `archive/schema_calendly_cron.sql`

**Interfaces:**
- Consumes: `seiki_cron_secret` (Supabase Vault secret, already created for the Gmail/LinkedIn crons).
- Produces: `cron.job` row `poll-calendly-bookings`, firing every 5 minutes.

- [ ] **Step 1: Write the cron file**

```sql
-- ============================================================
-- SEIKI CRM — Cron Calendly Polling
-- À appliquer dans : Supabase > SQL Editor, APRÈS avoir déployé
-- poll-calendly-bookings ET schema_calendly_addon.sql
-- Réutilise le secret 'seiki_cron_secret' déjà créé (voir
-- schema_prospection_v2_cron.sql) — pas besoin de le recréer.
--
-- Remplacer <PROJECT_REF> et <ANON_KEY> par les vraies valeurs du projet.
--
-- Vérification après exécution :
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'poll-calendly-bookings';
-- Doit renvoyer 1 ligne, active = true.
-- ============================================================

SELECT cron.schedule(
  'poll-calendly-bookings',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/poll-calendly-bookings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seiki_cron_secret'
      ),
      'apikey', '<ANON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 2: Apply it and verify**

Run in Supabase SQL Editor, then:

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'poll-calendly-bookings';
```

Expected: 1 row, `active = true`.

- [ ] **Step 3: Commit**

```bash
git add archive/schema_calendly_cron.sql
git commit -m "feat: schedule poll-calendly-bookings cron job"
```

---

### Task 7: `calendlyService.ts` (frontend)

**Files:**
- Create: `src/services/calendlyService.ts`
- Test: `src/services/calendlyService.test.ts`

**Interfaces:**
- Consumes: `supabase` from `./supabaseClient`.
- Produces: `CalendlyAccount { id, calendly_user_uri, connected_at }`, `CalendlyBooking { id, title, start_time, end_time, invitee_name, invitee_email, location, status, cancel_reason, lead_id }`, `calendlyService.getAccount(): Promise<CalendlyAccount | null>`, `calendlyService.listBookings(): Promise<CalendlyBooking[]>`, `calendlyService.oauthConnectUrl(): string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, builder } = vi.hoisted(() => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn();
  const fromMock = vi.fn(() => builder);
  return { fromMock, builder };
});

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}));

import { calendlyService } from './calendlyService';

describe('calendlyService.listBookings', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.select.mockClear();
    builder.order.mockClear();
  });

  it('fetches bookings ordered by start_time ascending', async () => {
    builder.order.mockResolvedValue({ data: [{ id: 'b1', start_time: '2026-08-01T10:00:00Z' }], error: null });

    const result = await calendlyService.listBookings();

    expect(fromMock).toHaveBeenCalledWith('calendly_bookings');
    expect(builder.order).toHaveBeenCalledWith('start_time', { ascending: true });
    expect(result).toHaveLength(1);
  });

  it('throws when the query errors', async () => {
    builder.order.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(calendlyService.listBookings()).rejects.toThrow('boom');
  });
});

describe('calendlyService.getAccount', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.maybeSingle.mockClear();
  });

  it('returns null when no account is connected', async () => {
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await calendlyService.getAccount();
    expect(result).toBeNull();
  });
});

describe('calendlyService.oauthConnectUrl', () => {
  it('builds the edge function URL with the current origin', () => {
    const url = calendlyService.oauthConnectUrl();
    expect(url).toContain('/functions/v1/calendly-oauth-start');
    expect(url).toContain('origin=');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- calendlyService.test.ts`
Expected: FAIL — `Cannot find module './calendlyService'`.

- [ ] **Step 3: Write `calendlyService.ts`**

```ts
// ============================================================
// calendlyService.ts
// Accès au compte Calendly connecté et aux rendez-vous synchronisés.
// ============================================================

import { supabase } from './supabaseClient';

export interface CalendlyAccount {
  id: string;
  calendly_user_uri: string;
  connected_at: string;
}

export interface CalendlyBooking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  invitee_name: string;
  invitee_email: string;
  location: string | null;
  status: 'active' | 'canceled';
  cancel_reason: string | null;
  lead_id: string | null;
}

export const calendlyService = {
  async getAccount(): Promise<CalendlyAccount | null> {
    const { data, error } = await supabase
      .from('calendly_accounts')
      .select('id, calendly_user_uri, connected_at')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async listBookings(): Promise<CalendlyBooking[]> {
    const { data, error } = await supabase
      .from('calendly_bookings')
      .select('id, title, start_time, end_time, invitee_name, invitee_email, location, status, cancel_reason, lead_id')
      .order('start_time', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  oauthConnectUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const params = new URLSearchParams({ origin: window.location.origin });
    return `${supabaseUrl}/functions/v1/calendly-oauth-start?${params.toString()}`;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- calendlyService.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/calendlyService.ts src/services/calendlyService.test.ts
git commit -m "feat: add calendlyService"
```

---

### Task 8: `useCalendlyBookings` hook

**Files:**
- Create: `src/hooks/useCalendlyBookings.ts`

**Interfaces:**
- Consumes: `calendlyService.listBookings()` and `CalendlyBooking` from `../services/calendlyService`; `useToast` from `../context/ToastContext`; `useCachedResource<T>(key, fetcher, initialValue, options)` from `./useCachedResource` (returns `{ data, loading, reload, setData }`).
- Produces: `useCalendlyBookings(): { bookings: CalendlyBooking[]; loadingBookings: boolean; reloadBookings: () => Promise<void> }`.

- [ ] **Step 1: Write the hook**

```ts
import { calendlyService, type CalendlyBooking } from '../services/calendlyService';
import { useToast } from '../context/ToastContext';
import { useCachedResource } from './useCachedResource';

export function useCalendlyBookings() {
  const { showToast } = useToast();
  const onError = (err: unknown) => {
    console.error('Error loading Calendly bookings:', err);
    showToast('Erreur lors du chargement des rendez-vous Calendly', 'error');
  };

  const bookingsRes = useCachedResource<CalendlyBooking[]>(
    'calendlyBookings',
    () => calendlyService.listBookings(),
    [],
    { onError },
  );

  return {
    bookings: bookingsRes.data,
    loadingBookings: bookingsRes.loading,
    reloadBookings: bookingsRes.reload,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: no new TypeScript errors from this file (the hook has no consumers yet, so `tsc` should pass on it in isolation — Task 10 wires it in and re-verifies the full build).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCalendlyBookings.ts
git commit -m "feat: add useCalendlyBookings hook"
```

---

### Task 9: `BookingCard.tsx` component

**Files:**
- Create: `src/views/agenda/BookingCard.tsx`

**Interfaces:**
- Consumes: `CalendlyBooking` from `../../services/calendlyService`.
- Produces: `<BookingCard booking: CalendlyBooking, formatDateFr: (d: string) => string />` — sibling of `EventCard`, same visual language (`text-[14px]`/`text-[12px]` rows, `rgba(242,237,228,...)` border tokens), rendered read-only (no edit/delete — Calendly bookings aren't editable from the CRM).

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { Clock, Mail, Video, Link as LinkIcon } from 'lucide-react';
import type { CalendlyBooking } from '../../services/calendlyService';

interface BookingCardProps {
  booking: CalendlyBooking;
  formatDateFr: (d: string) => string;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, formatDateFr }) => {
  const canceled = booking.status === 'canceled';
  const timeLabel = new Date(booking.start_time).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
  const isLink = booking.location?.startsWith('http') ?? false;

  return (
    <div
      className="py-4 flex flex-col gap-2 relative"
      style={{ borderTop: '1px solid rgba(242,237,228,0.07)', opacity: canceled ? 0.5 : 1 }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="text-[14px] leading-snug"
            style={{
              color: canceled ? '#888880' : 'var(--color-charcoal-fg, #f2ede4)',
              fontWeight: 500,
              textDecoration: canceled ? 'line-through' : 'none',
            }}
          >
            {booking.invitee_name || booking.invitee_email}
          </span>
          <span
            className="text-[10px] tracking-[0.18em] uppercase px-2 py-0.5"
            style={{ color: '#888880', border: '1px solid rgba(242,237,228,0.1)' }}
          >
            via Calendly
          </span>
          {canceled && (
            <span
              className="text-[10px] tracking-[0.18em] uppercase px-2 py-0.5"
              style={{ color: '#e05252', border: '1px solid rgba(224,82,82,0.3)' }}
            >
              Annulé
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Clock size={11} strokeWidth={1.5} style={{ color: '#555' }} />
          <span className="text-[12px]" style={{ color: '#666' }}>
            {formatDateFr(booking.start_time.slice(0, 10))} à {timeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mail size={11} strokeWidth={1.5} style={{ color: '#555' }} />
          <span className="text-[12px]" style={{ color: '#666' }}>{booking.invitee_email}</span>
        </div>
        {booking.location && (
          <a
            href={isLink ? booking.location : undefined}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5"
          >
            {isLink ? (
              <Video size={11} strokeWidth={1.5} style={{ color: '#555' }} />
            ) : (
              <LinkIcon size={11} strokeWidth={1.5} style={{ color: '#555' }} />
            )}
            <span className="text-[12px]" style={{ color: '#666' }}>{booking.location}</span>
          </a>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: no new TypeScript errors (component has no consumers yet, wired in Task 10).

- [ ] **Step 3: Commit**

```bash
git add src/views/agenda/BookingCard.tsx
git commit -m "feat: add BookingCard component"
```

---

### Task 10: Wire it into the Agenda — `AgendaHeader.tsx` + `Agenda.tsx`

**Files:**
- Modify: `src/views/agenda/AgendaHeader.tsx`
- Modify: `src/views/Agenda.tsx`

**Interfaces:**
- Consumes: `calendlyService`, `type CalendlyAccount` from `../services/calendlyService`; `useCalendlyBookings` from `../hooks/useCalendlyBookings`; `BookingCard` from `./agenda/BookingCard`.
- Produces: working "Connecter Calendly" button in the Agenda header; merged, sorted upcoming/past lists showing both manual `EventItem`s and Calendly `CalendlyBooking`s.

- [ ] **Step 1: Update `AgendaHeader.tsx`**

Replace the full file with:

```tsx
import React from 'react';
import { Download, Link, Link2, CheckCircle2 } from 'lucide-react';
import { PageTitle } from '../../components/ui/PageTitle';
import type { CalendlyAccount } from '../../services/calendlyService';

interface AgendaHeaderProps {
  onExportIcal: () => void;
  onCopyFeedUrl: () => void;
  calendlyAccount: CalendlyAccount | null;
  calendlyConnectUrl: string;
}

export const AgendaHeader: React.FC<AgendaHeaderProps> = ({
  onExportIcal,
  onCopyFeedUrl,
  calendlyAccount,
  calendlyConnectUrl,
}) => {
  return (
    <div className="flex items-end justify-between mb-10">
      <PageTitle>Agenda</PageTitle>
      <div className="flex items-center gap-5">
        <a
          href={calendlyConnectUrl}
          className="flex items-center gap-1.5 transition-colors duration-150 text-[11px] tracking-[0.15em] uppercase cursor-pointer"
          style={{ color: calendlyAccount ? 'var(--color-success, #4caf7d)' : '#555' }}
        >
          {calendlyAccount ? (
            <CheckCircle2 size={12} strokeWidth={2} />
          ) : (
            <Link2 size={12} strokeWidth={2} />
          )}
          {calendlyAccount ? 'Calendly connecté' : 'Connecter Calendly'}
        </a>
        <button
          type="button"
          className="flex items-center gap-1.5 transition-colors duration-150 text-[11px] tracking-[0.15em] uppercase cursor-pointer"
          style={{ color: "#555" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-charcoal-fg-soft, #b0afa8)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#555")}
          onClick={onExportIcal}
        >
          <Download size={12} strokeWidth={1.5} />
          Exporter .ics
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 transition-colors duration-150 text-[11px] tracking-[0.15em] uppercase cursor-pointer"
          style={{ color: "#555" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-charcoal-fg-soft, #b0afa8)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#555")}
          onClick={onCopyFeedUrl}
        >
          <Link size={12} strokeWidth={1.5} />
          URL d'abonnement
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Update `Agenda.tsx`**

Replace the full file with:

```tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useAgendaEvents } from '../hooks/useAgendaEvents';
import { useCalendlyBookings } from '../hooks/useCalendlyBookings';
import { calendlyService, type CalendlyAccount, type CalendlyBooking } from '../services/calendlyService';
import { downloadIcalFile, ICAL_FEED_URL } from '../utils/icalHelpers';
import { useToast } from '../context/ToastContext';
import { AgendaHeader } from './agenda/AgendaHeader';
import { AgendaForm } from './agenda/AgendaForm';
import { AgendaTabs } from './agenda/AgendaTabs';
import { EventCard } from './agenda/EventCard';
import { BookingCard } from './agenda/BookingCard';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import type { EventItem } from '../services/eventsService';

type AgendaItem =
  | { kind: 'event'; sortKey: string; event: EventItem }
  | { kind: 'booking'; sortKey: string; booking: CalendlyBooking };

export const Agenda: React.FC = () => {
  const {
    events,
    loading,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useAgendaEvents();
  const { bookings, reloadBookings } = useCalendlyBookings();
  const { showToast } = useToast();

  const [formOpen, setFormOpen] = useState(true);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [calendlyAccount, setCalendlyAccount] = useState<CalendlyAccount | null>(null);

  useEffect(() => {
    calendlyService.getAccount().then(setCalendlyAccount).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const calendlyStatus = params.get('calendly');
    if (calendlyStatus === 'connected') {
      showToast('Compte Calendly connecté.', 'success');
      calendlyService.getAccount().then(setCalendlyAccount).catch(() => {});
      reloadBookings();
    } else if (calendlyStatus === 'error') {
      showToast(params.get('message') || 'Connexion Calendly échouée.', 'error');
    }
    if (calendlyStatus) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(ICAL_FEED_URL);
      showToast("URL d'abonnement copiée dans le presse-papier");
    } catch {
      showToast("Erreur lors de la copie de l'URL", "error");
    }
  };

  // Fusionne événements manuels et rendez-vous Calendly en une seule
  // timeline triée. Les event_date (jour seul) sont comparés à minuit pour
  // rester cohérents avec les start_time (horodatage précis) des bookings.
  const allItems = useMemo<AgendaItem[]>(() => {
    const eventItems: AgendaItem[] = events.map((event) => ({
      kind: 'event',
      sortKey: `${event.event_date}T00:00:00`,
      event,
    }));
    const bookingItems: AgendaItem[] = bookings.map((booking) => ({
      kind: 'booking',
      sortKey: booking.start_time,
      booking,
    }));
    return [...eventItems, ...bookingItems].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [events, bookings]);

  const nowIso = new Date().toISOString();
  const todayStr = nowIso.slice(0, 10);
  const isUpcoming = (item: AgendaItem) =>
    item.kind === 'booking' ? item.sortKey >= nowIso : item.sortKey >= `${todayStr}T00:00:00`;

  const upcomingItems = useMemo(() => allItems.filter(isUpcoming), [allItems, nowIso, todayStr]);
  const pastItems = useMemo(() => allItems.filter((item) => !isUpcoming(item)), [allItems, nowIso, todayStr]);

  const formatDateFr = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getDaysAgo = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const evDate = new Date(dateStr + 'T12:00:00');
    evDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - evDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  };

  const handleStartEdit = (event: EventItem) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingEvent(null);
  };

  const confirmDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      handleDeleteEvent(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  const handleSaveEvent = async (eventData: {
    name: string;
    event_date: string;
    end_date: string | null;
    location: string | null;
    segment: string | null;
    objective: string | null;
  }) => {
    if (editingEvent) {
      await handleUpdateEvent(editingEvent.id, eventData);
      setEditingEvent(null);
    } else {
      await handleCreateEvent({ ...eventData, created_by: null });
    }
  };

  if (loading) {
    return (
      <div
        className="size-full flex flex-col items-center justify-center py-20"
        style={{ background: 'var(--color-charcoal, #0d0d0d)', color: 'var(--color-charcoal-fg-soft, #b0afa8)' }}
      >
        <div className="loading-spinner mb-3" />
        <span className="text-xs tracking-widest uppercase">Chargement de l'agenda...</span>
      </div>
    );
  }

  return (
    <div
      className="size-full overflow-y-auto"
      style={{
        background: 'var(--color-charcoal, #0d0d0d)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Header */}
        <AgendaHeader
          onExportIcal={() => downloadIcalFile(events)}
          onCopyFeedUrl={handleCopyFeedUrl}
          calendlyAccount={calendlyAccount}
          calendlyConnectUrl={calendlyService.oauthConnectUrl()}
        />

        {/* Collapsible Form (Add / Edit) */}
        <AgendaForm
          formOpen={formOpen}
          setFormOpen={setFormOpen}
          editingEvent={editingEvent}
          onSaveEvent={handleSaveEvent}
          onCancelEdit={handleCancelEdit}
        />

        {/* Tabs Switcher */}
        <AgendaTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          upcomingCount={upcomingItems.length}
          pastCount={pastItems.length}
        />

        {/* Tab Content / Events List */}
        <div key={activeTab} className="mt-6 animate-tab-fade">
          {activeTab === 'upcoming' &&
            (upcomingItems.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[13px]" style={{ color: '#444' }}>
                  Aucun événement à venir
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {upcomingItems.map((item) =>
                  item.kind === 'event' ? (
                    <EventCard
                      key={`event-${item.event.id}`}
                      event={item.event}
                      formatDateFr={formatDateFr}
                      onEdit={() => handleStartEdit(item.event)}
                      onDelete={() => confirmDelete(item.event.id)}
                    />
                  ) : (
                    <BookingCard key={`booking-${item.booking.id}`} booking={item.booking} formatDateFr={formatDateFr} />
                  ),
                )}
              </div>
            ))}

          {activeTab === 'past' &&
            (pastItems.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[13px]" style={{ color: '#444' }}>
                  Aucun événement dans l'historique
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {pastItems.map((item) =>
                  item.kind === 'event' ? (
                    <EventCard
                      key={`event-${item.event.id}`}
                      event={item.event}
                      past
                      daysAgo={getDaysAgo(item.event.event_date)}
                      formatDateFr={formatDateFr}
                      onEdit={() => handleStartEdit(item.event)}
                      onDelete={() => confirmDelete(item.event.id)}
                    />
                  ) : (
                    <BookingCard key={`booking-${item.booking.id}`} booking={item.booking} formatDateFr={formatDateFr} />
                  ),
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};

export default Agenda;
```

- [ ] **Step 3: Run the full test suite and build**

Run: `npm run test`
Expected: all existing tests + the new `calendlyService.test.ts` and `calendlyApi.test.ts` pass, no regressions.

Run: `npm run build`
Expected: `tsc -b && vite build` completes with zero TypeScript errors.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`, open `/crm/agenda`.
Expected:
- "Connecter Calendly" link visible in the header (grey, unconnected state).
- Existing manual events still render correctly in "À venir"/"Historique", unaffected.
- No console errors.

(Full OAuth round-trip and real bookings require a live Calendly app — verify manually against the real Calendly account per the spec's Testing section, same precedent as the LinkedIn scheduler.)

- [ ] **Step 5: Commit**

```bash
git add src/views/agenda/AgendaHeader.tsx src/views/Agenda.tsx
git commit -m "feat: wire Calendly connect button and bookings into Agenda"
```

---

## Self-Review Notes

- **Spec coverage:** `calendly_accounts`/`calendly_bookings` tables → Task 1. OAuth start/callback → Tasks 3–4. Polling sync + lead matching + history → Task 5. Cron → Task 6. `calendlyService`/hook → Tasks 7–8. UI (button + merged, sorted list, muted "Annulé" bookings) → Tasks 9–10. Error handling (OAuth denied, no account connected, transient failures) is covered inline in Tasks 4–5, matching the spec's Error Handling section.
- **Type consistency checked:** `CalendlyAccount`/`CalendlyBooking` (Task 7) match the props consumed in `AgendaHeader`/`Agenda`/`BookingCard` (Tasks 9–10) and the columns produced by `calendlyService.listBookings()`/`getAccount()`. `CalendlyScheduledEvent`/`CalendlyInvitee`/`CalendlyLocation` (Task 2) match exactly what `poll-calendly-bookings` (Task 5) consumes.
- **Known deviation from precedent, called out explicitly:** the plan uses real router paths (`/crm/agenda?calendly=...`) for the OAuth callback redirect, not the `?activeApp=` pattern in the older `gmail-oauth-callback`/`linkedin-oauth-callback` — that param is dead code post-router-migration (confirmed against `App.tsx`), so it wasn't copied forward.
