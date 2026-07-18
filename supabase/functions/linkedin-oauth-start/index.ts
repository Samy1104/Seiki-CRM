// ============================================================
// Edge Function : linkedin-oauth-start
// Runtime : Deno (Supabase)
// Rôle : Construit l'URL d'autorisation LinkedIn et redirige
//        l'utilisateur vers LinkedIn (flux OAuth 2.0).
//        Appelé directement en navigation (pas de CORS/fetch JS).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildRedirectUri } from "../_shared/linkedinApi.ts";

serve((req: Request) => {
  const url = new URL(req.url);
  const target = url.searchParams.get("target"); // 'personal' | 'company'
  const label = url.searchParams.get("label") ?? (target === "company" ? "Seiki" : "Jaafar");

  if (target !== "personal" && target !== "company") {
    return new Response("Paramètre 'target' invalide (personal|company)", { status: 400 });
  }

  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = buildRedirectUri(supabaseUrl);

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
