// ============================================================
// Edge Function : flush-send-queue
// Runtime : Deno (Supabase)
// Rôle : Purge la file d'envoi (generated_emails approved, dus
//        aujourd'hui) dans la limite du quota quotidien restant.
//        Appelée à la demande (bouton UI) ou par le cron Supabase
//        en mode automatique.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendGeneratedEmailViaResend } from "../_shared/sendViaResend.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: modeSetting } = await supabase
      .from("app_settings").select("value").eq("key", "prospection_mode").single();
    const { data: quotaSetting } = await supabase
      .from("app_settings").select("value").eq("key", "daily_send_quota").single();

    const mode = (modeSetting?.value as { mode?: string } | null)?.mode ?? "manual";
    const quota = (quotaSetting?.value as { count?: number } | null)?.count ?? 100;

    // En mode manuel, la purge automatique (cron) ne doit rien faire —
    // seul le bouton explicite de l'UI doit envoyer. On distingue les deux
    // via un flag dans le corps JSON (pas un header custom : un header
    // non listé dans Access-Control-Allow-Headers de _shared/cors.ts
    // ferait échouer le preflight CORS pour tout appel navigateur).
    let triggeredBy: string | undefined;
    try {
      const body = await req.json();
      triggeredBy = body?.triggeredBy;
    } catch {
      // Pas de corps (ex: appel cron sans body) — reste undefined, traité comme non-manuel.
    }
    const isManualTrigger = triggeredBy === "manual-button";
    if (mode === "manual" && !isManualTrigger) {
      return new Response(
        JSON.stringify({ skipped: "prospection_mode is manual", processed: 0, sent: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const { count: sentTodayCount } = await supabase
      .from("generated_emails")
      .select("id", { count: "exact", head: true })
      .eq("statut_envoi", "sent")
      .gte("sent_at", `${today}T00:00:00.000Z`)
      .lt("sent_at", `${today}T23:59:59.999Z`);

    const remainingQuota = Math.max(0, quota - (sentTodayCount ?? 0));

    if (remainingQuota === 0) {
      return new Response(
        JSON.stringify({ skipped: "daily quota already reached", processed: 0, sent: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const { data: due, error: dueErr } = await supabase
      .from("generated_emails")
      .select("id")
      .eq("statut_envoi", "approved")
      .lte("scheduled_at", `${today}T23:59:59.999Z`)
      .order("scheduled_at", { ascending: true })
      .limit(remainingQuota);

    if (dueErr) throw dueErr;

    let sent = 0;
    let failed = 0;

    for (const row of due ?? []) {
      try {
        const outcome = await sendGeneratedEmailViaResend(supabase, row.id as string);
        if (outcome.success) sent++;
        else failed++;
      } catch (err) {
        console.error("[flush-send-queue] Send failed for row", row.id, ":", err instanceof Error ? err.message : err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed: (due ?? []).length, sent, failed }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[flush-send-queue] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
