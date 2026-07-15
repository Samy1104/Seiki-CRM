# LinkedIn Post Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user schedule a LinkedIn post (text + optional image) for a future date/time and have it auto-publish to a connected LinkedIn personal profile or company Page.

**Architecture:** Two new Supabase tables (`linkedin_accounts`, `scheduled_linkedin_posts`) + three Deno edge functions (`linkedin-oauth-start`, `linkedin-oauth-callback`, `publish-linkedin-post`) + a shared LinkedIn API helper, wired to a `pg_cron` job polling every 5 minutes — the exact pattern already used by `flush-send-queue` for email. `Contenu.tsx` gets an editable post form with schedule controls and a queue list.

**Tech Stack:** React 19 + TypeScript (Vite), Supabase (Postgres + Storage + Edge Functions/Deno), `pg_cron`/`pg_net`, LinkedIn REST API (`/rest/posts`, `/rest/images`, OAuth 2.0), Vitest for client unit tests.

## Global Constraints

- Follow existing repo convention: schema changes ship as standalone `schema_*.sql` files applied manually via Supabase SQL Editor (no migrations directory in this repo).
- RLS policy style: single `authenticated_full_access` policy (`FOR ALL TO authenticated USING (true) WITH CHECK (true))`, matching every existing table.
- Edge functions: Deno `serve()` + `corsHeaders(req)` from `_shared/cors.ts`, service-role Supabase client, try/catch returning `{ error }` JSON on failure — matches `generate-linkedin-post`/`flush-send-queue`.
- OAuth tokens are stored as plain `TEXT` columns protected by the same RLS posture as the rest of the schema (no Supabase Vault/pgsodium encryption) — this is a simplification vs. the spec's aspirational "encrypted at rest" note; flag to the user as a possible follow-up, not a blocker.
- Company-Page publishing (`target_type = 'company'`) requires LinkedIn Community Management API access approval from LinkedIn — external dependency, unknown timeline. Code ships ready for it; it cannot be tested end-to-end until LinkedIn grants access. Personal-profile publishing has no such blocker.
- Required external prerequisite (user action, not automatable): create a LinkedIn Developer App with "Sign In with LinkedIn using OpenID Connect" + "Share on LinkedIn" products enabled, get `Client ID`/`Client Secret`, and register redirect URI `https://<PROJECT_REF>.supabase.co/functions/v1/linkedin-oauth-callback`.

---

### Task 1: Database schema

**Files:**
- Create: `schema_linkedin_scheduler_addon.sql`
- Create: `schema_linkedin_scheduler_cron.sql`

**Interfaces:**
- Produces: tables `public.linkedin_accounts` (id, target_type, label, access_token, refresh_token, expires_at, linkedin_urn, connected_by, connected_at, updated_at) and `public.scheduled_linkedin_posts` (id, hook, corps, hashtags text[], image_path, target_account_id, scheduled_at, status, error_message, linkedin_post_urn, created_at, updated_at); storage bucket `linkedin-media`.

- [ ] **Step 1: Write `schema_linkedin_scheduler_addon.sql`**

```sql
-- ============================================================
-- SEIKI CRM — Add-on Scheduler LinkedIn
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS le schéma principal (schema_supabase.sql)
-- ============================================================

-- ============================================================
-- 1. TABLE LINKEDIN_ACCOUNTS — Comptes LinkedIn connectés
-- ============================================================
CREATE TABLE IF NOT EXISTS public.linkedin_accounts (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type    TEXT    NOT NULL CHECK (target_type IN ('personal', 'company')),
  label          TEXT    NOT NULL,
  access_token   TEXT    NOT NULL,
  refresh_token  TEXT,
  expires_at     TIMESTAMPTZ NOT NULL,
  linkedin_urn   TEXT    NOT NULL,
  connected_by   UUID    REFERENCES public.team_members(id) ON DELETE SET NULL,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_type, label)
);

COMMENT ON TABLE public.linkedin_accounts IS 'Comptes LinkedIn (personnel/entreprise) connectés pour la publication automatique';
COMMENT ON COLUMN public.linkedin_accounts.access_token IS 'Token OAuth LinkedIn — non chiffré en base, protégé uniquement par RLS';

ALTER TABLE public.linkedin_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.linkedin_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_linkedin_accounts_updated
  BEFORE UPDATE ON public.linkedin_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. TABLE SCHEDULED_LINKEDIN_POSTS — File de publication
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scheduled_linkedin_posts (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  hook               TEXT    NOT NULL,
  corps              TEXT    NOT NULL,
  hashtags           TEXT[]  NOT NULL DEFAULT '{}',
  image_path         TEXT,
  target_account_id  UUID    NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  scheduled_at       TIMESTAMPTZ NOT NULL,
  status             TEXT    NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled', 'posted', 'failed')),
  error_message      TEXT,
  linkedin_post_urn  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.scheduled_linkedin_posts IS 'File de posts LinkedIn programmés, publiés automatiquement par le cron publish-linkedin-post';

ALTER TABLE public.scheduled_linkedin_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.scheduled_linkedin_posts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_scheduled_linkedin_posts_updated
  BEFORE UPDATE ON public.scheduled_linkedin_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_scheduled_linkedin_posts_status_due
  ON public.scheduled_linkedin_posts(status, scheduled_at);

-- ============================================================
-- 3. STORAGE — Bucket images de posts
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('linkedin-media', 'linkedin-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "linkedin_media_authenticated_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'linkedin-media');

CREATE POLICY "linkedin_media_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'linkedin-media');

CREATE POLICY "linkedin_media_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'linkedin-media');
```

- [ ] **Step 2: Write `schema_linkedin_scheduler_cron.sql`**

```sql
-- ============================================================
-- SEIKI CRM — Cron pour la publication automatique LinkedIn
-- À exécuter UNE FOIS dans Supabase > SQL Editor, après avoir
-- remplacé <PROJECT_REF> et <SERVICE_ROLE_KEY> par les vraies
-- valeurs (Dashboard > Settings > API).
--
-- Vérification après exécution :
--   SELECT * FROM cron.job WHERE jobname = 'publish-linkedin-post-5min';
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'publish-linkedin-post-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/publish-linkedin-post',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'apikey', '<SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 3: Note manual-apply instructions**

These two SQL files are not auto-applied (repo has no migrations runner — confirmed by checking `supabase/` which only has `functions/`). After this plan is implemented, the user must run both files in the Supabase SQL Editor themselves, same as every prior `schema_*_addon.sql`/`schema_*_cron.sql` in this repo.

- [ ] **Step 4: Commit**

```bash
git add schema_linkedin_scheduler_addon.sql schema_linkedin_scheduler_cron.sql
git commit -m "feat: add LinkedIn scheduler DB schema"
```

---

### Task 2: Shared LinkedIn API helper (Deno)

**Files:**
- Create: `supabase/functions/_shared/linkedinApi.ts`

**Interfaces:**
- Consumes: `Deno.env.get("LINKEDIN_CLIENT_ID")`, `Deno.env.get("LINKEDIN_CLIENT_SECRET")`, `Deno.env.get("LINKEDIN_API_VERSION")` (optional, defaults `"202401"`).
- Produces: `exchangeCodeForToken(code, redirectUri)`, `refreshAccessToken(refreshToken)`, `fetchMemberUrn(accessToken)`, `fetchAdminOrgUrn(accessToken)`, `uploadImage(accessToken, authorUrn, imageBytes)`, `publishPost(accessToken, authorUrn, text, imageUrn?)` — used by Tasks 3 and 4.

- [ ] **Step 1: Write `supabase/functions/_shared/linkedinApi.ts`**

```typescript
// ============================================================
// _shared/linkedinApi.ts
// Helpers LinkedIn REST API (OAuth token exchange/refresh, upload
// image, publication de post) partagés par linkedin-oauth-callback
// et publish-linkedin-post.
// ============================================================

const LINKEDIN_API_VERSION = Deno.env.get("LINKEDIN_API_VERSION") || "202401";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")!;
  const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;
  const body = new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret });

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`LinkedIn OAuth error: ${JSON.stringify(data)}`);
  return data as TokenResponse;
}

export function exchangeCodeForToken(code: string, redirectUri: string): Promise<TokenResponse> {
  return requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function fetchMemberUrn(accessToken: string): Promise<string> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`LinkedIn userinfo error: ${JSON.stringify(data)}`);
  return `urn:li:person:${data.sub}`;
}

// Renvoie l'URN de la première organisation où le compte est admin.
// Nécessite le scope w_organization_social + accès Community Management API.
export async function fetchAdminOrgUrn(accessToken: string): Promise<string> {
  const res = await fetch(
    "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": LINKEDIN_API_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`LinkedIn organizationAcls error: ${JSON.stringify(data)}`);
  const first = data.elements?.[0];
  if (!first) throw new Error("Aucune organisation LinkedIn administrée trouvée pour ce compte");
  return first.organization as string;
}

export async function uploadImage(accessToken: string, authorUrn: string, imageBytes: Uint8Array): Promise<string> {
  const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  const initData = await initRes.json();
  if (!initRes.ok) throw new Error(`LinkedIn image init error: ${JSON.stringify(initData)}`);

  const uploadUrl = initData.value.uploadUrl as string;
  const imageUrn = initData.value.image as string;

  const putRes = await fetch(uploadUrl, { method: "PUT", body: imageBytes });
  if (!putRes.ok) throw new Error(`LinkedIn image upload failed: HTTP ${putRes.status}`);

  return imageUrn;
}

export async function publishPost(
  accessToken: string,
  authorUrn: string,
  text: string,
  imageUrn?: string,
): Promise<string> {
  const payload: Record<string, unknown> = {
    author: authorUrn,
    commentary: text,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (imageUrn) {
    payload.content = { media: { id: imageUrn } };
  }

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`LinkedIn publish failed HTTP ${res.status}: ${errBody}`);
  }

  return res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id") ?? "unknown";
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/linkedinApi.ts
git commit -m "feat: add shared LinkedIn REST API helper for edge functions"
```

---

### Task 3: OAuth edge functions

**Files:**
- Create: `supabase/functions/linkedin-oauth-start/index.ts`
- Create: `supabase/functions/linkedin-oauth-callback/index.ts`

**Interfaces:**
- Consumes: `exchangeCodeForToken`, `fetchMemberUrn`, `fetchAdminOrgUrn` from `_shared/linkedinApi.ts` (Task 2).
- Produces: `linkedin_accounts` rows (Task 1 schema). Callback 302-redirects to `${FRONTEND_URL}/?activeApp=contenu&linkedin=connected` or `...&linkedin=error&message=...`.

- [ ] **Step 1: Write `supabase/functions/linkedin-oauth-start/index.ts`**

```typescript
// ============================================================
// Edge Function : linkedin-oauth-start
// Runtime : Deno (Supabase)
// Rôle : Construit l'URL d'autorisation LinkedIn et redirige
//        l'utilisateur vers LinkedIn (flux OAuth 2.0).
//        Appelé directement en navigation (pas de CORS/fetch JS).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve((req: Request) => {
  const url = new URL(req.url);
  const target = url.searchParams.get("target"); // 'personal' | 'company'
  const label = url.searchParams.get("label") ?? (target === "company" ? "Seiki" : "Jaafar");

  if (target !== "personal" && target !== "company") {
    return new Response("Paramètre 'target' invalide (personal|company)", { status: 400 });
  }

  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = `${supabaseUrl}/functions/v1/linkedin-oauth-callback`;

  const scope = target === "company"
    ? "openid profile w_member_social w_organization_social"
    : "openid profile w_member_social";

  // State encode la cible + le label pour que le callback sache quoi faire
  // sans dépendre d'un store côté serveur (outil interne mono-utilisateur —
  // pas de vérification anti-CSRF au-delà du format attendu).
  const state = btoa(JSON.stringify({ target, label }));

  const authorizeUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, { status: 302, headers: { Location: authorizeUrl.toString() } });
});
```

- [ ] **Step 2: Write `supabase/functions/linkedin-oauth-callback/index.ts`**

```typescript
// ============================================================
// Edge Function : linkedin-oauth-callback
// Runtime : Deno (Supabase)
// Rôle : Reçoit le code d'autorisation LinkedIn, échange contre
//        un token, résout l'URN auteur (personnel ou org), et
//        stocke la connexion dans linkedin_accounts. Redirige
//        ensuite vers le front.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { exchangeCodeForToken, fetchMemberUrn, fetchAdminOrgUrn } from "../_shared/linkedinApi.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const redirectWithError = (message: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${frontendUrl}/?activeApp=contenu&linkedin=error&message=${encodeURIComponent(message)}` },
    });

  if (errorParam) return redirectWithError(`LinkedIn a refusé la connexion (${errorParam})`);
  if (!code || !stateRaw) return redirectWithError("Réponse LinkedIn incomplète (code/state manquant)");

  let target: "personal" | "company";
  let label: string;
  try {
    const state = JSON.parse(atob(stateRaw));
    target = state.target;
    label = state.label;
  } catch {
    return redirectWithError("State OAuth invalide");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const redirectUri = `${supabaseUrl}/functions/v1/linkedin-oauth-callback`;
    const token = await exchangeCodeForToken(code, redirectUri);

    const authorUrn = target === "company"
      ? await fetchAdminOrgUrn(token.access_token)
      : await fetchMemberUrn(token.access_token);

    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    const { error: upsertErr } = await supabase.from("linkedin_accounts").upsert(
      {
        target_type: target,
        label,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        expires_at: expiresAt,
        linkedin_urn: authorUrn,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "target_type,label" },
    );

    if (upsertErr) throw upsertErr;

    return new Response(null, {
      status: 302,
      headers: { Location: `${frontendUrl}/?activeApp=contenu&linkedin=connected&label=${encodeURIComponent(label)}` },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[linkedin-oauth-callback] Erreur :", message);
    return redirectWithError(message);
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/linkedin-oauth-start supabase/functions/linkedin-oauth-callback
git commit -m "feat: add LinkedIn OAuth connect edge functions"
```

---

### Task 4: Publish edge function

**Files:**
- Create: `supabase/functions/publish-linkedin-post/index.ts`

**Interfaces:**
- Consumes: `refreshAccessToken`, `uploadImage`, `publishPost` from `_shared/linkedinApi.ts` (Task 2); `scheduled_linkedin_posts`/`linkedin_accounts` tables (Task 1).
- Produces: updates each due row's `status`/`error_message`/`linkedin_post_urn`. Response body `{ processed, posted, failed }` — same shape family as `flush-send-queue`.

- [ ] **Step 1: Write `supabase/functions/publish-linkedin-post/index.ts`**

```typescript
// ============================================================
// Edge Function : publish-linkedin-post
// Runtime : Deno (Supabase)
// Rôle : Publie sur LinkedIn les posts programmés dont la date
//        est due. Appelée par le cron Supabase toutes les 5 min.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { refreshAccessToken, uploadImage, publishPost } from "../_shared/linkedinApi.ts";

interface ScheduledPost {
  id: string;
  hook: string;
  corps: string;
  hashtags: string[];
  image_path: string | null;
  target_account_id: string;
}

interface LinkedinAccount {
  id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  linkedin_urn: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: due, error: dueErr } = await supabase
      .from("scheduled_linkedin_posts")
      .select("id, hook, corps, hashtags, image_path, target_account_id")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (dueErr) throw dueErr;

    let posted = 0;
    let failed = 0;

    for (const row of (due ?? []) as ScheduledPost[]) {
      try {
        await publishOne(supabase, row);
        posted++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        console.error("[publish-linkedin-post] Échec pour", row.id, ":", message);
        await supabase.from("scheduled_linkedin_posts").update({ status: "failed", error_message: message }).eq("id", row.id);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed: (due ?? []).length, posted, failed }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[publish-linkedin-post] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});

async function publishOne(supabase: ReturnType<typeof createClient>, row: ScheduledPost): Promise<void> {
  const { data: account, error: accErr } = await supabase
    .from("linkedin_accounts")
    .select("id, access_token, refresh_token, expires_at, linkedin_urn")
    .eq("id", row.target_account_id)
    .single();

  if (accErr || !account) {
    throw new Error("Compte LinkedIn déconnecté");
  }

  const acc = account as unknown as LinkedinAccount;
  let accessToken = acc.access_token;

  const expiresInMs = new Date(acc.expires_at).getTime() - Date.now();
  if (expiresInMs < 5 * 60 * 1000) {
    if (!acc.refresh_token) {
      throw new Error("Compte LinkedIn déconnecté (token expiré, pas de refresh token)");
    }
    const refreshed = await refreshAccessToken(acc.refresh_token);
    accessToken = refreshed.access_token;
    await supabase
      .from("linkedin_accounts")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? acc.refresh_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq("id", acc.id);
  }

  let imageUrn: string | undefined;
  if (row.image_path) {
    const { data: imageBlob, error: dlErr } = await supabase.storage.from("linkedin-media").download(row.image_path);
    if (dlErr || !imageBlob) throw new Error(`Téléchargement image échoué : ${dlErr?.message}`);
    const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
    imageUrn = await uploadImage(accessToken, acc.linkedin_urn, imageBytes);
  }

  const text = `${row.hook}\n\n${row.corps}\n\n${row.hashtags.map((h) => `#${h}`).join(" ")}`;
  const postUrn = await publishPost(accessToken, acc.linkedin_urn, text, imageUrn);

  await supabase
    .from("scheduled_linkedin_posts")
    .update({ status: "posted", linkedin_post_urn: postUrn, error_message: null })
    .eq("id", row.id);
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/publish-linkedin-post
git commit -m "feat: add LinkedIn scheduled-post publish edge function"
```

---

### Task 5: Client service `linkedinService.ts` (+ unit tests)

**Files:**
- Create: `src/services/linkedinService.ts`
- Test: `src/services/linkedinService.test.ts`

**Interfaces:**
- Consumes: `supabase` from `./supabaseClient` (existing).
- Produces: types `LinkedinAccount`, `ScheduledPost`; functions `linkedinService.listAccounts()`, `linkedinService.listScheduledPosts()`, `linkedinService.schedulePost(input)`, `linkedinService.updateScheduledPost(id, input)`, `linkedinService.cancelScheduledPost(id)`, `linkedinService.retryScheduledPost(id)`, `linkedinService.uploadImage(file)`, `linkedinService.oauthConnectUrl(target, label)` — consumed by Task 6 UI.

- [ ] **Step 1: Write the failing test `src/services/linkedinService.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, builder, storageFromMock } = vi.hoisted(() => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.single = vi.fn();
  const fromMock = vi.fn(() => builder);

  const storageBuilder: any = { upload: vi.fn() };
  const storageFromMock = vi.fn(() => storageBuilder);

  return { fromMock, builder, storageFromMock };
});

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock, storage: { from: storageFromMock } },
}));

import { linkedinService } from './linkedinService';

describe('linkedinService.listScheduledPosts', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.select.mockClear();
    builder.order.mockClear();
  });

  it('fetches posts ordered by scheduled_at ascending', async () => {
    builder.order.mockResolvedValue({ data: [{ id: 'p1', scheduled_at: '2026-08-01T10:00:00Z' }], error: null });

    const result = await linkedinService.listScheduledPosts();

    expect(fromMock).toHaveBeenCalledWith('scheduled_linkedin_posts');
    expect(builder.order).toHaveBeenCalledWith('scheduled_at', { ascending: true });
    expect(result).toHaveLength(1);
  });

  it('throws when the query errors', async () => {
    builder.order.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(linkedinService.listScheduledPosts()).rejects.toThrow('boom');
  });
});

describe('linkedinService.cancelScheduledPost', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.update.mockClear();
    builder.eq.mockClear();
  });

  it('deletes the row via update-free delete call shape', async () => {
    builder.eq.mockResolvedValue({ error: null });
    await linkedinService.cancelScheduledPost('p1');
    expect(fromMock).toHaveBeenCalledWith('scheduled_linkedin_posts');
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1');
  });
});

describe('linkedinService.oauthConnectUrl', () => {
  it('builds the edge function URL with target and label', () => {
    const url = linkedinService.oauthConnectUrl('personal', 'Jaafar');
    expect(url).toContain('/functions/v1/linkedin-oauth-start');
    expect(url).toContain('target=personal');
    expect(url).toContain('label=Jaafar');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- linkedinService`
Expected: FAIL — `Cannot find module './linkedinService'`

- [ ] **Step 3: Write `src/services/linkedinService.ts`**

```typescript
// ============================================================
// linkedinService.ts
// Accès CRUD à la file de posts LinkedIn programmés et aux
// comptes LinkedIn connectés.
// ============================================================

import { supabase } from './supabaseClient';

export type LinkedinTargetType = 'personal' | 'company';
export type ScheduledPostStatus = 'scheduled' | 'posted' | 'failed';

export interface LinkedinAccount {
  id: string;
  target_type: LinkedinTargetType;
  label: string;
  expires_at: string;
  connected_at: string;
}

export interface ScheduledPost {
  id: string;
  hook: string;
  corps: string;
  hashtags: string[];
  image_path: string | null;
  target_account_id: string;
  scheduled_at: string;
  status: ScheduledPostStatus;
  error_message: string | null;
  linkedin_post_urn: string | null;
  created_at: string;
}

export interface SchedulePostInput {
  hook: string;
  corps: string;
  hashtags: string[];
  imagePath?: string | null;
  targetAccountId: string;
  scheduledAt: string;
}

export const linkedinService = {
  async listAccounts(): Promise<LinkedinAccount[]> {
    const { data, error } = await supabase
      .from('linkedin_accounts')
      .select('id, target_type, label, expires_at, connected_at')
      .order('label', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async listScheduledPosts(): Promise<ScheduledPost[]> {
    const { data, error } = await supabase
      .from('scheduled_linkedin_posts')
      .select('*')
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async schedulePost(input: SchedulePostInput): Promise<ScheduledPost> {
    const { data, error } = await supabase
      .from('scheduled_linkedin_posts')
      .insert([{
        hook: input.hook,
        corps: input.corps,
        hashtags: input.hashtags,
        image_path: input.imagePath ?? null,
        target_account_id: input.targetAccountId,
        scheduled_at: input.scheduledAt,
        status: 'scheduled',
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateScheduledPost(id: string, input: Partial<SchedulePostInput>): Promise<void> {
    const { error } = await supabase
      .from('scheduled_linkedin_posts')
      .update({
        ...(input.hook !== undefined && { hook: input.hook }),
        ...(input.corps !== undefined && { corps: input.corps }),
        ...(input.hashtags !== undefined && { hashtags: input.hashtags }),
        ...(input.imagePath !== undefined && { image_path: input.imagePath }),
        ...(input.targetAccountId !== undefined && { target_account_id: input.targetAccountId }),
        ...(input.scheduledAt !== undefined && { scheduled_at: input.scheduledAt }),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async cancelScheduledPost(id: string): Promise<void> {
    const { error } = await supabase.from('scheduled_linkedin_posts').delete().eq('id', id);
    if (error) throw error;
  },

  async retryScheduledPost(id: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_linkedin_posts')
      .update({ status: 'scheduled', error_message: null, scheduled_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async uploadImage(file: File): Promise<string> {
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('linkedin-media').upload(path, file);
    if (error) throw error;
    return path;
  },

  oauthConnectUrl(target: LinkedinTargetType, label: string): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const params = new URLSearchParams({ target, label });
    return `${supabaseUrl}/functions/v1/linkedin-oauth-start?${params.toString()}`;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- linkedinService`
Expected: PASS (4 tests)

- [ ] **Step 5: Fix `cancelScheduledPost` test builder shape if delete isn't chained through `builder`**

The mock's `fromMock` returns `builder`, and `builder.eq` must resolve for the `.delete().eq(...)` chain. Add `builder.delete = vi.fn(() => builder);` to the `vi.hoisted` block in the test file (Step 1) alongside `select`/`insert`/`update`, then re-run Step 4.

- [ ] **Step 6: Commit**

```bash
git add src/services/linkedinService.ts src/services/linkedinService.test.ts
git commit -m "feat: add linkedinService for scheduled LinkedIn posts"
```

---

### Task 6: UI — `Contenu.tsx`

**Files:**
- Modify: `src/views/Contenu.tsx` (full rewrite of the post-preview section + new queue section)

**Interfaces:**
- Consumes: `linkedinService` (Task 5) — `listAccounts`, `listScheduledPosts`, `schedulePost`, `updateScheduledPost`, `cancelScheduledPost`, `retryScheduledPost`, `uploadImage`, `oauthConnectUrl`; `contentService.generateLinkedInPost` (existing, unchanged).

- [ ] **Step 1: Replace `src/views/Contenu.tsx`**

```typescript
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LayoutGrid, LogOut, Copy, Check, Sparkles, Loader2, Link2, Image as ImageIcon, X, RotateCcw } from 'lucide-react';
import { contentService, type ContentVoice, type ContentLanguage, type LinkedInPost } from '../services/contentService';
import { linkedinService, type LinkedinAccount, type ScheduledPost } from '../services/linkedinService';

interface ContenuProps {
  setActiveApp: (app: 'portal' | 'crm' | 'contenu') => void;
}

const panelStyle: React.CSSProperties = { background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' };
const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
};

export const Contenu: React.FC<ContenuProps> = ({ setActiveApp }) => {
  const { logout } = useAuth();
  const { showToast } = useToast();

  const [brief, setBrief] = useState('');
  const [voice, setVoice] = useState<ContentVoice>('seiki');
  const [language, setLanguage] = useState<ContentLanguage>('fr');
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState<LinkedInPost | null>(null);
  const [copied, setCopied] = useState(false);

  const [accounts, setAccounts] = useState<LinkedinAccount[]>([]);
  const [queue, setQueue] = useState<ScheduledPost[]>([]);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const loadAccounts = () => linkedinService.listAccounts().then(setAccounts).catch(() => {});
  const loadQueue = () => linkedinService.listScheduledPosts().then(setQueue).catch(() => {});

  useEffect(() => {
    loadAccounts();
    loadQueue();

    const params = new URLSearchParams(window.location.search);
    const linkedinStatus = params.get('linkedin');
    if (linkedinStatus === 'connected') {
      showToast(`Compte LinkedIn "${params.get('label')}" connecté.`, 'success');
      loadAccounts();
    } else if (linkedinStatus === 'error') {
      showToast(params.get('message') || 'Connexion LinkedIn échouée.', 'error');
    }
    if (linkedinStatus) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    if (!brief.trim()) {
      showToast('Décris le sujet du post avant de générer.', 'error');
      return;
    }
    setLoading(true);
    setCopied(false);
    try {
      const result = await contentService.generateLinkedInPost(brief, voice, language);
      setPost(result);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la génération', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fullText = post
    ? `${post.hook}\n\n${post.corps}\n\n${post.hashtags.map((h) => `#${h}`).join(' ')}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSchedule = async () => {
    if (!post) return;
    if (!targetAccountId) {
      showToast('Choisis un compte LinkedIn connecté.', 'error');
      return;
    }
    if (!scheduledAt) {
      showToast('Choisis une date et une heure.', 'error');
      return;
    }
    setScheduling(true);
    try {
      let imagePath: string | null = null;
      if (imageFile) {
        imagePath = await linkedinService.uploadImage(imageFile);
      }
      await linkedinService.schedulePost({
        hook: post.hook,
        corps: post.corps,
        hashtags: post.hashtags,
        imagePath,
        targetAccountId,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      showToast('Post programmé.', 'success');
      setPost(null);
      setBrief('');
      setImageFile(null);
      setScheduledAt('');
      loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la programmation', 'error');
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await linkedinService.cancelScheduledPost(id);
      loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de l\'annulation', 'error');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await linkedinService.retryScheduledPost(id);
      loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la relance', 'error');
    }
  };

  const accountLabel = (id: string) => accounts.find((a) => a.id === id)?.label ?? 'Compte supprimé';

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark-wrap">
            <img src="/grand_logo.png" alt="Seiki" className="logo-mark" />
          </div>
          <div className="logo-sub">CONTENU — IA PREDICtive</div>
        </div>

        <nav className="nav">
          <button className="nav-item on">
            <LayoutGrid size={16} />
            <span>Générateur LinkedIn</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="btn-logout" style={{ marginBottom: '8px' }} onClick={() => setActiveApp('portal')}>
            <LayoutGrid size={14} style={{ marginRight: '6px' }} />
            Retour Portail
          </button>

          <button className="btn-logout" onClick={logout}>
            <LogOut size={14} style={{ marginRight: '6px' }} />
            Déconnexion
          </button>

          <div className="powered-by-seiki-footer">
            <span className="powered-text">Powered by</span>
            <img src="/seiki_logo_large.png" className="seiki-footer-logo" alt="Seiki Logo" />
            <span className="seiki-footer-name">Seiki</span>
          </div>
        </div>
      </aside>

      <main className="main-content p-8" style={{ overflowY: 'auto' }}>
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-heading)' }}>
              Générateur de posts LinkedIn
            </h1>
            <p className="text-[var(--text-secondary)] mt-1">
              Décris le sujet, choisis la voix et la langue — l'agent écrit dans le style Seiki.
            </p>
          </div>

          <div className="space-y-4 p-6 rounded-2xl border" style={panelStyle}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="block text-sm text-[var(--text-secondary)]">Comptes LinkedIn connectés</label>
              <div className="flex gap-2">
                <a href={linkedinService.oauthConnectUrl('personal', 'Jaafar')} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  <Link2 size={14} />
                  {accounts.some((a) => a.target_type === 'personal') ? 'Reconnecter Jaafar' : 'Connecter Jaafar'}
                </a>
                <a href={linkedinService.oauthConnectUrl('company', 'Seiki')} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  <Link2 size={14} />
                  {accounts.some((a) => a.target_type === 'company') ? 'Reconnecter Seiki' : 'Connecter Seiki'}
                </a>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-[var(--text-secondary)]">Brief</label>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Ex : Nous venons de signer un partenariat avec la ville de Lyon pour mesurer les flux piétons du centre-ville..."
                rows={5}
                className="w-full rounded-lg p-3 text-sm"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-sm mb-2 text-[var(--text-secondary)]">Voix</label>
                <select value={voice} onChange={(e) => setVoice(e.target.value as ContentVoice)} className="rounded-lg p-2 text-sm" style={inputStyle}>
                  <option value="seiki">Seiki (entreprise)</option>
                  <option value="jaafar">Jaafar (personnel)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-2 text-[var(--text-secondary)]">Langue</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value as ContentLanguage)} className="rounded-lg p-2 text-sm" style={inputStyle}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="nav-item on"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto',
                padding: '10px 24px', borderRadius: 'var(--radius-btn)', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? <Loader2 size={14} style={{ marginRight: '8px' }} className="animate-spin" /> : <Sparkles size={14} style={{ marginRight: '8px' }} />}
              {loading ? 'Génération...' : 'Générer le post'}
            </button>
          </div>

          {post && (
            <div className="p-6 rounded-2xl border space-y-4" style={panelStyle}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Aperçu (éditable)</h2>
                <button onClick={handleCopy} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  {copied ? <Check size={14} color="var(--green)" /> : <Copy size={14} />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>

              <textarea
                value={post.hook}
                onChange={(e) => setPost({ ...post, hook: e.target.value })}
                rows={2}
                className="w-full rounded-lg p-3 text-sm"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <textarea
                value={post.corps}
                onChange={(e) => setPost({ ...post, corps: e.target.value })}
                rows={8}
                className="w-full rounded-lg p-3 text-sm"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <input
                value={post.hashtags.join(' ')}
                onChange={(e) => setPost({ ...post, hashtags: e.target.value.split(/\s+/).filter(Boolean).map((h) => h.replace(/^#/, '')) })}
                className="w-full rounded-lg p-3 text-sm"
                style={inputStyle}
                placeholder="#hashtag1 #hashtag2"
              />

              <div className="flex gap-4 flex-wrap items-end">
                <div>
                  <label className="block text-sm mb-2 text-[var(--text-secondary)]">Compte cible</label>
                  <select value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)} className="rounded-lg p-2 text-sm" style={inputStyle}>
                    <option value="">— Choisir —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-2 text-[var(--text-secondary)]">Date et heure</label>
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="rounded-lg p-2 text-sm" style={inputStyle} />
                </div>

                <div>
                  <label className="block text-sm mb-2 text-[var(--text-secondary)] flex items-center gap-1">
                    <ImageIcon size={14} /> Image (optionnel)
                  </label>
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="text-sm" style={{ color: 'var(--text-secondary)' }} />
                </div>

                <button
                  onClick={handleSchedule}
                  disabled={scheduling}
                  className="nav-item on"
                  style={{ display: 'inline-flex', alignItems: 'center', width: 'auto', padding: '10px 20px', borderRadius: 'var(--radius-btn)', cursor: scheduling ? 'default' : 'pointer', opacity: scheduling ? 0.7 : 1 }}
                >
                  {scheduling ? <Loader2 size={14} style={{ marginRight: '8px' }} className="animate-spin" /> : null}
                  Programmer
                </button>
              </div>
            </div>
          )}

          <div className="p-6 rounded-2xl border space-y-3" style={panelStyle}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Posts programmés</h2>
            {queue.length === 0 && <p className="text-sm text-[var(--text-secondary)]">Aucun post programmé.</p>}
            {queue.map((p) => (
              <div key={p.id} className="p-3 rounded-lg flex items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="min-w-0">
                  <div className="text-sm text-[var(--text-primary)] truncate">{p.hook}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {accountLabel(p.target_account_id)} · {new Date(p.scheduled_at).toLocaleString('fr-FR')} ·{' '}
                    <span style={{ color: p.status === 'failed' ? 'var(--red, #e55)' : p.status === 'posted' ? 'var(--green)' : 'var(--text-secondary)' }}>
                      {p.status}
                    </span>
                    {p.status === 'failed' && p.error_message && ` — ${p.error_message}`}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {p.status === 'failed' && (
                    <button onClick={() => handleRetry(p.id)} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <RotateCcw size={14} /> Relancer
                    </button>
                  )}
                  {p.status === 'scheduled' && (
                    <button onClick={() => handleCancel(p.id)} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <X size={14} /> Annuler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
```

- [ ] **Step 2: Manual verification (dev server)**

Run: `npm run dev`, open the app, log in, go to Contenu. Verify:
- Page loads without console errors (accounts/queue empty-state renders).
- Generate a post, edit hook/corps/hashtags inline, they update.
- With no account connected, "Programmer" without a target shows the toast error (LinkedIn API calls themselves can't be exercised until a real LinkedIn Developer App + OAuth connect is set up — out of scope for this automated check).

- [ ] **Step 3: Commit**

```bash
git add src/views/Contenu.tsx
git commit -m "feat: add LinkedIn post scheduling UI to Contenu"
```

---

### Task 7: Secrets documentation

**Files:**
- Modify: `supabase/.env.example`

- [ ] **Step 1: Append LinkedIn secrets block**

```
# LinkedIn API — connexion OAuth + publication (OBLIGATOIRE pour le scheduler LinkedIn)
# Créer une app sur https://www.linkedin.com/developers/apps avec les produits
# "Sign In with LinkedIn using OpenID Connect" et "Share on LinkedIn".
# Redirect URI à enregistrer : https://<PROJECT_REF>.supabase.co/functions/v1/linkedin-oauth-callback
LINKEDIN_CLIENT_ID=votre_client_id
LINKEDIN_CLIENT_SECRET=votre_client_secret
LINKEDIN_API_VERSION=202401

# URL du front déployé, utilisée pour rediriger après connexion LinkedIn
FRONTEND_URL=https://crm.seiki.fr
```

- [ ] **Step 2: Commit**

```bash
git add supabase/.env.example
git commit -m "docs: document LinkedIn OAuth secrets"
```
