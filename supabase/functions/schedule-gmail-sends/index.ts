// ============================================================
// Edge Function : schedule-gmail-sends
// Runtime : Deno (Supabase)
// Rôle : Moteur de pacing — calcule le volume autorisé aujourd'hui
//        (courbe de warm-up), prend les brouillons 'approved' les
//        plus anciens dans cette limite, et leur assigne un créneau
//        aléatoire dans la fenêtre horaire du jour. Ne fait AUCUN
//        envoi — dispatch-gmail-sends s'en charge séparément.
//        Appelée par le cron Supabase toutes les heures, ou par le
//        bouton manuel de test dans l'UI.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireUserOrServiceRole } from "../_shared/requireUser.ts";
import { computeDailyCap } from "../_shared/warmupRamp.ts";
import { getTodaysWindowBounds, pickRandomSendTimes, type SendWindow } from "../_shared/sendWindow.ts";

function skip(req: Request, reason: string) {
  return new Response(
    JSON.stringify({ skipped: reason, scheduled: 0 }),
    { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
  );
}

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

    const { data: modeSetting } = await supabase.from("app_settings").select("value").eq("key", "prospection_mode").single();
    const { data: capSetting } = await supabase.from("app_settings").select("value").eq("key", "gmail_daily_cap").single();
    const { data: warmupSetting } = await supabase.from("app_settings").select("value").eq("key", "gmail_warmup_start_date").single();
    const { data: windowSetting } = await supabase.from("app_settings").select("value").eq("key", "gmail_send_window").single();

    const mode = (modeSetting?.value as { mode?: string } | null)?.mode ?? "manual";

    let triggeredBy: string | undefined;
    try {
      const body = await req.json();
      triggeredBy = body?.triggeredBy;
    } catch {
      // pas de corps (appel cron) — reste undefined
    }
    const isManualTrigger = triggeredBy === "manual-button";
    if (mode === "manual" && !isManualTrigger) {
      return skip(req, "prospection_mode is manual");
    }

    const targetCap = (capSetting?.value as { count?: number } | null)?.count;
    const warmupStartDate = (warmupSetting?.value as { date?: string } | null)?.date;
    const sendWindow = windowSetting?.value as SendWindow | undefined;

    if (!targetCap || !warmupStartDate || !sendWindow) {
      return skip(req, "Gmail pacing not configured (gmail_daily_cap / gmail_warmup_start_date / gmail_send_window)");
    }

    const now = new Date();
    const allowedToday = computeDailyCap(warmupStartDate, now, targetCap);

    // scheduled_at is always set the moment a row leaves 'approved' (right
    // below), and dispatch-gmail-sends sends it within ~2 min of that slot —
    // so for every row in these three statuses, scheduled_at's date IS the
    // day it was/will be sent. Filtering on scheduled_at alone (instead of
    // an OR against sent_at too) avoids a fragile two-column OR condition.
    const today = now.toISOString().slice(0, 10);
    const { count: alreadyCounted } = await supabase
      .from("generated_emails")
      .select("id", { count: "exact", head: true })
      .in("statut_envoi", ["scheduled", "sending", "sent"])
      .gte("scheduled_at", `${today}T00:00:00.000Z`)
      .lt("scheduled_at", `${today}T23:59:59.999Z`);

    const remaining = Math.max(0, allowedToday - (alreadyCounted ?? 0));
    if (remaining === 0) {
      return skip(req, "daily warm-up cap already reached for today");
    }

    const bounds = getTodaysWindowBounds(now, sendWindow);
    if (!bounds) {
      return skip(req, "outside configured send window");
    }

    const { data: approved, error: approvedErr } = await supabase
      .from("generated_emails")
      .select("id")
      .eq("statut_envoi", "approved")
      .order("created_at", { ascending: true })
      .limit(remaining);

    if (approvedErr) throw approvedErr;
    if (!approved || approved.length === 0) {
      return skip(req, "no approved drafts waiting");
    }

    // pickRandomSendTimes peut renvoyer MOINS de créneaux que demandé quand
    // la fenêtre restante est trop courte pour respecter l'espacement minimal
    // — on ne planifie donc que les lignes qui ont réellement un créneau ; le
    // reste demeure 'approved' et sera repris à la prochaine passe.
    const sendTimes = pickRandomSendTimes(approved.length, bounds.start, bounds.end);

    for (let i = 0; i < sendTimes.length; i++) {
      await supabase
        .from("generated_emails")
        .update({ statut_envoi: "scheduled", scheduled_at: sendTimes[i].toISOString() })
        .eq("id", approved[i].id);
    }

    return new Response(
      JSON.stringify({ scheduled: sendTimes.length }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[schedule-gmail-sends] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
