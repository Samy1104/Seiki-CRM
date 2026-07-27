// ============================================================
// Edge Function : send-test-email
// Runtime : Deno (Supabase)
// Rôle : Envoi manuel ad-hoc pour tester la connexion Gmail —
//        ne passe PAS par generated_emails/leads (pas de lead
//        requis), juste du compte Gmail connecté vers l'adresse
//        donnée. Utilitaire de test, hors du pipeline de pacing.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/requireUser.ts";
import { buildEmailHtml, buildRawEmail } from "../_shared/gmailMime.ts";
import { sendRawMessage } from "../_shared/gmailApi.ts";
import { getValidAccessToken, type GmailAccount } from "../_shared/sendViaGmail.ts";

interface SendTestRequest {
  toEmail: string;
  subject: string;
  body: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authError = await requireUser(req, supabase, corsHeaders(req));
    if (authError) return authError;

    const { toEmail, subject, body } = (await req.json()) as SendTestRequest;
    if (!toEmail || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "toEmail, subject et body sont requis" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const { data: account, error: accErr } = await supabase
      .from("gmail_accounts")
      .select("id, email, access_token, refresh_token, expires_at")
      .limit(1)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(
        JSON.stringify({ error: "Aucun compte Gmail connecté" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getValidAccessToken(supabase, account as GmailAccount);

    // Pas de generated_emails/lead associé pour un envoi de test — le pixel
    // pointe vers un identifiant inerte (track-email ne trouvera aucune ligne
    // email_logs correspondante, no-op silencieux) plutôt que d'étendre
    // track-email (hors scope) pour suivre les tests.
    const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email?id=${crypto.randomUUID()}&t=open`;
    const htmlBody = buildEmailHtml(body, trackingPixelUrl);

    const rawMessage = buildRawEmail({
      fromEmail: account.email,
      fromName: "Seiki CRM",
      toEmail,
      subject,
      textBody: body,
      htmlBody,
    });

    const sendResult = await sendRawMessage(accessToken, rawMessage);
    const sentAt = new Date().toISOString();

    const { error: logErr } = await supabase.from("email_logs").insert([{
      lead_id: null,
      direction: "outbound",
      from_email: account.email,
      to_email: toEmail,
      subject,
      body_preview: body.substring(0, 500),
      body_html: htmlBody,
      message_id: sendResult.id,
      status: "sent",
      sent_at: sentAt,
    }]);

    if (logErr) {
      console.warn("[send-test-email] Erreur insertion log (non bloquante) :", logErr.message);
    }

    return new Response(
      JSON.stringify({ success: true, to: toEmail, sentAt }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[send-test-email] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
