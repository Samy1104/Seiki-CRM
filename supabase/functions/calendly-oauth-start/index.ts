// ============================================================
// Edge Function : calendly-oauth-start
// Runtime : Deno (Supabase)
// Rôle : Construit l'URL d'autorisation Calendly et redirige vers
//        l'écran de consentement (flux OAuth 2.0). Appelé directement
//        en navigation (pas de CORS/fetch JS).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildRedirectUri } from "../_shared/calendlyApi.ts";
import { isTrustedRedirectOrigin } from "../_shared/cors.ts";

serve((req: Request) => {
  const clientId = Deno.env.get("CALENDLY_CLIENT_ID")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = buildRedirectUri(supabaseUrl);

  // Même convention que gmail-oauth-start : l'origine appelante transite par
  // `state` pour que le callback sache où rediriger, quel que soit
  // l'environnement (localhost, staging, prod).
  const requestedOrigin = new URL(req.url).searchParams.get("origin") ?? "";
  const origin = isTrustedRedirectOrigin(requestedOrigin)
    ? requestedOrigin
    : Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
  const state = btoa(JSON.stringify({ origin }));

  // users:read pour GET /users/me (résolution du compte connecté),
  // scheduled_events:read pour GET /scheduled_events et .../invitees
  // (synchronisation des réservations par poll-calendly-bookings).
  const scope = "users:read scheduled_events:read";

  const authorizeUrl = new URL("https://auth.calendly.com/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, { status: 302, headers: { Location: authorizeUrl.toString() } });
});
