// ============================================================
// Edge Function : gmail-oauth-callback
// Runtime : Deno (Supabase)
// Rôle : Reçoit le code d'autorisation Google, échange contre un
//        token, récupère l'adresse Gmail connectée + le curseur
//        d'historique de départ, stocke dans gmail_accounts (une
//        seule ligne — upsert par email), redirige vers le front.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildRedirectUri, exchangeCodeForToken, fetchGmailAddress, getCurrentHistoryId } from "../_shared/gmailApi.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  const redirectWithError = (message: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${frontendUrl}/?activeApp=prospection&gmail=error&message=${encodeURIComponent(message)}` },
    });

  if (errorParam) return redirectWithError(`Google a refusé la connexion (${errorParam})`);
  if (!code) return redirectWithError("Réponse Google incomplète (code manquant)");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const redirectUri = buildRedirectUri(supabaseUrl);
    const token = await exchangeCodeForToken(code, redirectUri);

    if (!token.refresh_token) {
      return redirectWithError("Google n'a pas renvoyé de refresh_token — révoque l'accès existant sur myaccount.google.com/permissions puis reconnecte-toi");
    }

    const email = await fetchGmailAddress(token.access_token);
    const lastHistoryId = await getCurrentHistoryId(token.access_token);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    // Single-account tool: connecting a different address should replace
    // the previous connection entirely, not create a second ambiguous row
    // that every consumer's un-ordered .limit(1) would pick from arbitrarily.
    await supabase.from("gmail_accounts").delete().neq("email", email);

    const { error: upsertErr } = await supabase.from("gmail_accounts").upsert(
      {
        email,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: expiresAt,
        last_history_id: lastHistoryId,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

    if (upsertErr) throw upsertErr;

    return new Response(null, {
      status: 302,
      headers: { Location: `${frontendUrl}/?activeApp=prospection&gmail=connected&email=${encodeURIComponent(email)}` },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[gmail-oauth-callback] Erreur :", message);
    return redirectWithError(message);
  }
});
