// ============================================================
// CORS partagé entre toutes les Edge Functions.
// Restreint les origines autorisées au lieu du wildcard "*".
// Configurer le secret ALLOWED_ORIGIN avec l'URL du front déployé,
// ex: supabase secrets set ALLOWED_ORIGIN=https://crm.seiki.fr
// Plusieurs origines : séparées par une virgule.
// ============================================================

const DEFAULT_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function getAllowedOrigins(): string[] {
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
