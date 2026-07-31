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
import { isTrustedRedirectOrigin } from "../_shared/cors.ts";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);

  const stateRaw = url.searchParams.get("state");
  let stateOrigin: string | null = null;
  try {
    if (stateRaw) stateOrigin = JSON.parse(atob(stateRaw)).origin ?? null;
  } catch {
    // state absent/invalide — retombe sur FRONTEND_URL ci-dessous
  }
  const frontendUrl = (stateOrigin && isTrustedRedirectOrigin(stateOrigin))
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
    // pour voir apparaître les réservations déjà existantes. Budget court
    // (8s) plutôt qu'un fetch non borné : poll-calendly-bookings peut
    // parcourir jusqu'à 120 jours d'événements, et sans limite de temps le
    // callback OAuth bloquerait la redirection de l'utilisateur en attendant
    // un poll complet. Un échec ou un dépassement ici n'empêche pas la
    // connexion (déjà enregistrée ci-dessus) — rattrapé par le prochain tick.
    try {
      const pollRes = await fetchWithTimeout(`${supabaseUrl}/functions/v1/poll-calendly-bookings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("CRON_SECRET")}`,
          "Content-Type": "application/json",
        },
      }, 8000);
      if (!pollRes.ok) {
        console.error("[calendly-oauth-callback] Backfill poll returned non-OK:", pollRes.status, await pollRes.text());
      }
    } catch (pollErr) {
      console.error("[calendly-oauth-callback] Backfill poll failed:", pollErr instanceof Error ? pollErr.message : pollErr);
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
