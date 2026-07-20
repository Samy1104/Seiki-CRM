// ============================================================
// _shared/requireUser.ts
// Vérifie que l'appelant d'une Edge Function est soit un utilisateur
// authentifié Supabase, soit le job pg_cron interne — pas juste
// quelqu'un présentant la clé anon publique extraite du bundle
// frontend, qui jusqu'ici suffisait pour déclencher ces fonctions
// (et les appels payants Gemini/Resend/LinkedIn derrière).
//
// Le cron est reconnu via un secret dédié (CRON_SECRET), pas via
// SUPABASE_SERVICE_ROLE_KEY : cette variable auto-injectée par Supabase
// s'est révélée ne pas correspondre de façon fiable à la clé service_role
// affichée dans le Dashboard sur ce projet (401 systématique même avec
// la bonne clé, cause exacte non élucidée — probablement liée à la
// migration Supabase vers le nouveau système de clés API). Un secret
// qu'on choisit et qu'on pose des deux côtés soi-même (Vault + Edge
// Function secret) élimine cette dépendance à un comportement Supabase
// qu'on ne contrôle pas.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/** True if the caller presented the shared CRON_SECRET (i.e. this is the trusted pg_cron job, not a browser). */
export function isServiceRoleCall(req: Request): boolean {
  const token = extractBearerToken(req);
  const cronSecret = Deno.env.get("CRON_SECRET");
  return !!token && !!cronSecret && token === cronSecret;
}

/** Resolves the calling user from their session JWT, or null if there isn't a valid one. */
export async function getRequestUser(req: Request, supabase: SupabaseClient) {
  const token = extractBearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function unauthorized(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** For functions only ever called from the logged-in frontend (send-email, generate-linkedin-post, learn-linkedin-style). */
export async function requireUser(
  req: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const user = await getRequestUser(req, supabase);
  return user ? null : unauthorized(corsHeaders);
}

/** For functions called both by the frontend (logged-in user) and by pg_cron (service_role) — e.g. flush-send-queue. */
export async function requireUserOrServiceRole(
  req: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (isServiceRoleCall(req)) return null;
  return requireUser(req, supabase, corsHeaders);
}

/** For functions only ever called by pg_cron, never the frontend (e.g. publish-linkedin-post). */
export function requireServiceRole(req: Request, corsHeaders: Record<string, string>): Response | null {
  return isServiceRoleCall(req) ? null : unauthorized(corsHeaders);
}
