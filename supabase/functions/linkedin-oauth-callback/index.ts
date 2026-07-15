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
