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

    // Garde-fou mode : si prospection_mode repasse en 'manual' alors que des
    // lignes sont déjà 'scheduled', on ne les envoie pas au tick de cron
    // suivant — "mode manuel" doit vraiment signifier "rien ne part sans
    // clic". Le bouton manuel de l'UI passe triggeredBy pour outrepasser.
    const { data: modeSetting } = await supabase.from("app_settings").select("value").eq("key", "prospection_mode").single();
    const mode = (modeSetting?.value as { mode?: string } | null)?.mode ?? "manual";

    let triggeredBy: string | undefined;
    let targetEmailId: string | undefined;
    try {
      const body = await req.json();
      triggeredBy = body?.triggeredBy;
      targetEmailId = body?.emailId;
    } catch {
      // pas de corps (appel cron) — reste undefined
    }
    const isManualTrigger = triggeredBy === "manual-button" || Boolean(targetEmailId);
    if (mode === "manual" && !isManualTrigger) {
      return new Response(
        JSON.stringify({ skipped: "prospection_mode is manual", processed: 0, sent: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    let rowsToSend: Array<{ id: string }> = [];

    if (targetEmailId) {
      rowsToSend = [{ id: targetEmailId }];
    } else {
      // Lignes dont le scheduled_at a plus d'1h de retard : leur créneau est
      // manqué (cron coupé, redémarrage...). On les repasse en 'approved' pour
      // que le prochain schedule-gmail-sends leur attribue un nouveau créneau
      // dans la fenêtre, au lieu de toutes les faire partir d'un coup — et
      // potentiellement hors des heures de bureau.
      const staleThreshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      await supabase
        .from("generated_emails")
        .update({ statut_envoi: "approved", scheduled_at: null })
        .eq("statut_envoi", "scheduled")
        .lt("scheduled_at", staleThreshold);

      const MAX_BATCH = 20;
      const { data: due, error: dueErr } = await supabase
        .from("generated_emails")
        .select("id")
        .eq("statut_envoi", "scheduled")
        .gte("scheduled_at", staleThreshold)
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(MAX_BATCH);

      if (dueErr) throw dueErr;
      rowsToSend = due ?? [];
    }

    let sent = 0;
    let failed = 0;

    for (const row of rowsToSend) {
      try {
        const outcome = await sendGeneratedEmailViaGmail(supabase, row.id as string);
        if (outcome.success) sent++;
        else failed++;
      } catch (err) {
        console.error("[dispatch-gmail-sends] Send failed for row", row.id, ":", err instanceof Error ? err.message : err);
        failed++;
      }
      // Petit délai aléatoire entre deux envois — évite de saturer l'API
      // Gmail en rafale au sein d'un même cycle. sendViaResend.ts (le
      // prédécesseur) avait ce pacing ; la réécriture Gmail l'avait perdu.
      const delay = Math.floor(Math.random() * 1500) + 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return new Response(
      JSON.stringify({ processed: rowsToSend.length, sent, failed }),
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
