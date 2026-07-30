// ============================================================
// Edge Function : gmail-oauth-start
// Runtime : Deno (Supabase)
// Rôle : Construit l'URL d'autorisation Google et redirige vers
//        l'écran de consentement Gmail (flux OAuth 2.0).
//        Appelé directement en navigation (pas de CORS/fetch JS).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildRedirectUri } from "../_shared/gmailApi.ts";
import { getAllowedOrigins } from "../_shared/cors.ts";

serve((req: Request) => {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = buildRedirectUri(supabaseUrl);

  // Scopes : gmail.send (envoi), gmail.readonly (lecture inbox pour
  // détecter réponses/bounces — gmail.metadata ne suffit pas, il faut
  // le corps du message).
  const scope = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly";

  // L'origine appelante (window.location.origin côté front, voir
  // gmailService.oauthConnectUrl) est transportée dans `state` pour que
  // gmail-oauth-callback sache où rediriger l'utilisateur une fois la
  // connexion terminée — au lieu d'un FRONTEND_URL fixe qui ne collait
  // qu'à un seul environnement d'hébergement. Validée contre
  // ALLOWED_ORIGIN (même liste que le CORS) pour ne jamais rediriger
  // vers une origine non approuvée.
  const requestedOrigin = new URL(req.url).searchParams.get("origin") ?? "";
  const allowedOrigins = getAllowedOrigins();
  const origin = allowedOrigins.includes(requestedOrigin) ? requestedOrigin : allowedOrigins[0];
  const state = btoa(JSON.stringify({ origin }));

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("access_type", "offline");
  // select_account force l'écran de choix de compte même si une session Google
  // est déjà active dans le navigateur (sinon Google réutilise silencieusement
  // le compte courant — piège rencontré avec Calendly lors du transfert vers
  // le compte entreprise). consent force la délivrance d'un refresh_token.
  authorizeUrl.searchParams.set("prompt", "select_account consent");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, { status: 302, headers: { Location: authorizeUrl.toString() } });
});
