// ============================================================
// Edge Function : dispatch-gmail-sends
// Runtime : Deno (Supabase)
// Rôle : Envoie via Gmail tous les generated_emails dont le
//        créneau planifié (scheduled_at) est échu. Le calcul du
//        créneau lui-même est fait par schedule-gmail-sends — cette
//        fonction ne fait qu'exécuter les envois déjà décidés.
//        Appelée par le cron Supabase toutes les 2 min, ou par le
//        bouton manuel de test dans l'UI.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendGeneratedEmailViaGmail } from "../_shared/sendViaGmail.ts";
import { requireUserOrServiceRole } from "../_shared/requireUser.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authError = await requireUserOrServiceRole(req, supabase, corsHeaders(req));
    if (authError) return authError;

    const { data: due, error: dueErr } = await supabase
      .from("generated_emails")
      .select("id")
      .eq("statut_envoi", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (dueErr) throw dueErr;

    let sent = 0;
    let failed = 0;

    for (const row of due ?? []) {
      try {
        const outcome = await sendGeneratedEmailViaGmail(supabase, row.id as string);
        if (outcome.success) sent++;
        else failed++;
      } catch (err) {
        console.error("[dispatch-gmail-sends] Send failed for row", row.id, ":", err instanceof Error ? err.message : err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed: (due ?? []).length, sent, failed }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[dispatch-gmail-sends] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
