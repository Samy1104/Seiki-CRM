// ============================================================
// CORS partagé entre toutes les Edge Functions.
// Restreint les origines autorisées au lieu du wildcard "*".
// Configurer le secret ALLOWED_ORIGIN avec l'URL du front déployé,
// ex: supabase secrets set ALLOWED_ORIGIN=https://crm.seiki.fr
// Plusieurs origines : séparées par une virgule.
// ============================================================

const DEFAULT_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function getAllowedOrigins(): string[] {
  const configured = Deno.env.get("ALLOWED_ORIGIN");
  if (configured && configured.trim().length > 0) {
    return configured.split(",").map((o) => o.trim());
  }
  return DEFAULT_DEV_ORIGINS;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = getAllowedOrigins();
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Post-OAuth redirect target (linkedin/gmail/calendly-oauth-start & -callback):
// structural check only (well-formed http(s) origin, no path/query/userinfo),
// NOT the ALLOWED_ORIGIN allowlist above. Unlike corsHeaders(), which guards
// authenticated fetch() calls and must stay locked down, this only decides
// which origin the browser gets bounced back to after a direct navigation —
// the redirect carries no token/secret, just non-sensitive status flags. Using
// the allowlist here meant every new hosting domain silently fell back to a
// stale FRONTEND_URL instead of the page the user actually came from.
export function isTrustedRedirectOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.origin === origin;
  } catch {
    return false;
  }
}
