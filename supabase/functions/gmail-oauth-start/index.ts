// ============================================================
// Edge Function : gmail-oauth-start
// Runtime : Deno (Supabase)
// Rôle : Construit l'URL d'autorisation Google et redirige vers
//        l'écran de consentement Gmail (flux OAuth 2.0).
//        Appelé directement en navigation (pas de CORS/fetch JS).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildRedirectUri } from "../_shared/gmailApi.ts";

serve((req: Request) => {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = buildRedirectUri(supabaseUrl);

  // Scopes : gmail.send (envoi), gmail.readonly (lecture inbox pour
  // détecter réponses/bounces — gmail.metadata ne suffit pas, il faut
  // le corps du message).
  const scope = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly";

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("access_type", "offline");
  authorizeUrl.searchParams.set("prompt", "consent"); // force la délivrance d'un refresh_token à chaque connexion

  return new Response(null, { status: 302, headers: { Location: authorizeUrl.toString() } });
});
