// ============================================================
// Edge Function : send-email
// Runtime : Deno (Supabase)
// Rôle : Envoie UN email généré via Resend (appel direct depuis l'UI).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendGeneratedEmailViaResend } from "../_shared/sendViaResend.ts";

interface SendRequest {
  generatedEmailId: string;
  fromEmail?: string;
  fromName?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const body = (await req.json()) as SendRequest;
    if (!body.generatedEmailId) {
      return new Response(
        JSON.stringify({ error: "generatedEmailId est requis" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const outcome = await sendGeneratedEmailViaResend(supabase, body.generatedEmailId, {
      fromEmail: body.fromEmail,
      fromName: body.fromName,
    });

    if (!outcome.success) {
      return new Response(
        JSON.stringify({ error: outcome.error, alreadySent: outcome.alreadySent }),
        { status: outcome.alreadySent ? 409 : 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, resendMessageId: outcome.resendMessageId, sentAt: outcome.sentAt, to: outcome.to }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[send-email] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
