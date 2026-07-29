// ============================================================
// Edge Function : poll-calendly-bookings
// Runtime : Deno (Supabase)
// Rôle : Calendly (plan gratuit) ne supporte pas les webhooks — on
//        interroge périodiquement /scheduled_events pour détecter
//        nouvelles réservations et annulations. Appelée par le cron
//        Supabase toutes les 5 min (et une fois après la connexion
//        OAuth pour le backfill initial).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireServiceRole } from "../_shared/requireUser.ts";
import {
  refreshAccessToken,
  listScheduledEvents,
  listEventInvitees,
  formatLocation,
  type CalendlyScheduledEvent,
} from "../_shared/calendlyApi.ts";

interface CalendlyAccountRow {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendly_user_uri: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  const authError = requireServiceRole(req, corsHeaders(req));
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: account, error: accErr } = await supabase
      .from("calendly_accounts")
      .select("id, access_token, refresh_token, expires_at, calendly_user_uri")
      .limit(1)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(JSON.stringify({ skipped: "no Calendly account connected" }), {
        status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const acc = account as CalendlyAccountRow;
    let accessToken = acc.access_token;
    const expiresInMs = new Date(acc.expires_at).getTime() - Date.now();
    if (expiresInMs < 5 * 60 * 1000) {
      const refreshed = await refreshAccessToken(acc.refresh_token);
      accessToken = refreshed.access_token;
      await supabase
        .from("calendly_accounts")
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", acc.id);
    }

    // Fenêtre glissante : 30 j en arrière (capte les dernières annulations de
    // RDV déjà passés) à 90 j en avant.
    const minStartTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const maxStartTime = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const events = await listScheduledEvents(accessToken, acc.calendly_user_uri, minStartTime, maxStartTime);

    let created = 0;
    let canceled = 0;
    let unchanged = 0;
    let errors = 0;

    // Chaque événement est traité isolément : un échec ponctuel (invitees
    // 404/429...) ne doit pas faire échouer tout le lot, même logique que
    // poll-gmail-inbox.
    for (const event of events) {
      try {
        const outcome = await syncOneEvent(supabase, accessToken, event);
        if (outcome === "created") created++;
        else if (outcome === "canceled") canceled++;
        else unchanged++;
      } catch (err) {
        errors++;
        console.error("[poll-calendly-bookings] Failed to process event", event.uri, ":", err instanceof Error ? err.message : err);
      }
    }

    return new Response(JSON.stringify({ processed: events.length, created, canceled, unchanged, errors }), {
      status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[poll-calendly-bookings] Erreur :", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

async function syncOneEvent(
  supabase: ReturnType<typeof createClient>,
  accessToken: string,
  event: CalendlyScheduledEvent,
): Promise<"created" | "canceled" | "unchanged"> {
  const invitees = await listEventInvitees(accessToken, event.uri);
  // Outil de prise de RDV 1:1 (pas d'événements de groupe) : un seul invité
  // actif par événement.
  const invitee = invitees[0];
  if (!invitee) return "unchanged";

  const status: "active" | "canceled" = event.status === "canceled" || invitee.status === "canceled" ? "canceled" : "active";

  const { data: existing, error: existingErr } = await supabase
    .from("calendly_bookings")
    .select("id, status, lead_id")
    .eq("calendly_event_uri", event.uri)
    .maybeSingle();

  // Un échec ici ne doit jamais être traité comme "jamais vu" : ça ferait
  // rejouer isNewBooking sur une réservation déjà connue et dupliquer sa
  // ligne d'historique. On laisse le catch de l'appelant compter l'erreur
  // et réessayer au prochain passage du cron.
  if (existingErr) throw new Error(existingErr.message);

  const isNewBooking = !existing;
  const isNewCancellation = !!existing && existing.status === "active" && status === "canceled";

  const { data: upserted, error: upsertErr } = await supabase
    .from("calendly_bookings")
    .upsert(
      {
        calendly_event_uri: event.uri,
        title: event.name,
        start_time: event.start_time,
        end_time: event.end_time,
        invitee_name: invitee.name,
        invitee_email: invitee.email,
        location: formatLocation(event.location),
        status,
        cancel_reason: invitee.cancel_reason,
      },
      { onConflict: "calendly_event_uri" },
    )
    .select("id, lead_id")
    .single();

  if (upsertErr || !upserted) {
    throw new Error(upsertErr?.message ?? "upsert returned no row");
  }

  if (!isNewBooking && !isNewCancellation) return "unchanged";

  await linkLeadAndLogHistory(supabase, upserted.id, existing?.lead_id ?? null, invitee.email, event, status);
  return isNewBooking ? "created" : "canceled";
}

async function linkLeadAndLogHistory(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  existingLeadId: string | null,
  inviteeEmail: string,
  event: CalendlyScheduledEvent,
  status: "active" | "canceled",
): Promise<void> {
  let leadId = existingLeadId;

  if (!leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .ilike("email", inviteeEmail)
      .eq("is_archived", false)
      .limit(1)
      .maybeSingle();
    leadId = lead?.id ?? null;
    if (leadId) {
      const { error: linkErr } = await supabase.from("calendly_bookings").update({ lead_id: leadId }).eq("id", bookingId);
      if (linkErr) console.error("[poll-calendly-bookings] Failed to link lead_id on booking:", linkErr.message);
    }
  }

  if (!leadId) return;

  const dateLabel = new Date(event.start_time).toLocaleString("fr-FR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  });

  const content = status === "canceled"
    ? `Rendez-vous Calendly annulé (initialement prévu le ${dateLabel})`
    : `Rendez-vous Calendly programmé le ${dateLabel}`;

  const { error: historyErr } = await supabase.from("history").insert([{
    lead_id: leadId,
    action_type: "calendly_booking",
    content,
    metadata: { calendly_event_uri: event.uri, start_time: event.start_time, end_time: event.end_time, status },
    is_auto: true,
  }]);
  if (historyErr) console.error("[poll-calendly-bookings] Failed to insert history entry:", historyErr.message);
}
