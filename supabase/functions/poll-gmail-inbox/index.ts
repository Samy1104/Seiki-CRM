// ============================================================
// Edge Function : poll-gmail-inbox
// Runtime : Deno (Supabase)
// Rôle : Remplace resend-webhook. Gmail n'a pas de webhook —
//        on interroge périodiquement l'historique de la boîte de
//        réception pour détecter réponses (par expéditeur connu)
//        et bounces (par thread + heuristique expéditeur/sujet).
//        Appelée par le cron Supabase toutes les 5 min.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireServiceRole } from "../_shared/requireUser.ts";
import { getMessage, listHistory, getCurrentHistoryId, refreshAccessToken } from "../_shared/gmailApi.ts";
import { getHeader, extractPlainTextBody, type GmailMessage } from "../_shared/gmailMessageParser.ts";
import { classifyInboundMessage } from "../_shared/gmailReplyClassifier.ts";

interface GmailAccount {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_history_id: string | null;
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
      .from("gmail_accounts")
      .select("id, access_token, refresh_token, expires_at, last_history_id")
      .limit(1)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(JSON.stringify({ skipped: "no Gmail account connected" }), {
        status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const acc = account as GmailAccount;

    let accessToken = acc.access_token;
    const expiresInMs = new Date(acc.expires_at).getTime() - Date.now();
    if (expiresInMs < 5 * 60 * 1000) {
      const refreshed = await refreshAccessToken(acc.refresh_token);
      accessToken = refreshed.access_token;
      await supabase
        .from("gmail_accounts")
        .update({ access_token: refreshed.access_token, expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString() })
        .eq("id", acc.id);
    }

    if (!acc.last_history_id) {
      const historyId = await getCurrentHistoryId(accessToken);
      await supabase.from("gmail_accounts").update({ last_history_id: historyId }).eq("id", acc.id);
      return new Response(JSON.stringify({ skipped: "history cursor initialized, nothing to process yet" }), {
        status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let historyResult;
    try {
      historyResult = await listHistory(accessToken, acc.last_history_id);
    } catch (err) {
      // startHistoryId trop ancien (Gmail purge son historique après un
      // certain temps) — on resynchronise sur l'état courant plutôt que
      // de planter, au prix de manquer les messages de l'intervalle.
      console.warn("[poll-gmail-inbox] History resync needed:", err instanceof Error ? err.message : err);
      const historyId = await getCurrentHistoryId(accessToken);
      await supabase.from("gmail_accounts").update({ last_history_id: historyId }).eq("id", acc.id);
      return new Response(JSON.stringify({ skipped: "history cursor resynced after gap" }), {
        status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let replies = 0;
    let bounces = 0;
    let ignored = 0;

    for (const messageId of historyResult.addedMessageIds) {
      const msg = await getMessage(accessToken, messageId);
      const outcome = await processInboundMessage(supabase, msg);
      if (outcome === "reply") replies++;
      else if (outcome === "bounce") bounces++;
      else ignored++;
    }

    await supabase.from("gmail_accounts").update({ last_history_id: historyResult.historyId }).eq("id", acc.id);

    return new Response(
      JSON.stringify({ processed: historyResult.addedMessageIds.length, replies, bounces, ignored }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[poll-gmail-inbox] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});

async function processInboundMessage(
  supabase: ReturnType<typeof createClient>,
  msg: GmailMessage,
): Promise<"reply" | "bounce" | "ignored"> {
  const fromHeader = getHeader(msg, "From") ?? "";
  const subject = getHeader(msg, "Subject") ?? "(sans sujet)";
  const match = fromHeader.match(/<([^>]+)>/);
  const senderEmail = (match ? match[1] : fromHeader).trim().toLowerCase();

  const classification = classifyInboundMessage(senderEmail, subject);
  const now = new Date().toISOString();

  if (classification === "bounce") {
    const { data: relatedEmail } = await supabase
      .from("generated_emails")
      .select("id, lead_id")
      .eq("gmail_thread_id", msg.threadId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!relatedEmail) return "ignored";

    const bodyPreview = extractPlainTextBody(msg).slice(0, 500);
    await supabase
      .from("email_logs")
      .update({ status: "bounced", error_message: bodyPreview || `Bounce détecté (${subject})` })
      .eq("generated_email_id", relatedEmail.id)
      .eq("direction", "outbound")
      .neq("status", "replied");

    return "bounce";
  }

  // classification === 'reply'
  const { data: lead } = await supabase
    .from("leads")
    .select("id, contact_name, company_name")
    .eq("email", senderEmail)
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();

  if (!lead) return "ignored";

  await supabase.from("leads").update({ sequence_status: "replied", updated_at: now }).eq("id", lead.id);

  const textBody = extractPlainTextBody(msg);
  const textBodyPreview = textBody.length > 500 ? textBody.substring(0, 500) + "..." : textBody;

  await supabase.from("history").insert([{
    lead_id: lead.id,
    action_type: "email_received",
    content: `Email reçu de ${lead.contact_name || senderEmail} : ${subject}\n\n${textBodyPreview}`,
    metadata: { subject, from: fromHeader, gmail_message_id: msg.id },
    is_auto: true,
  }]);

  const { data: outboundLog } = await supabase
    .from("email_logs")
    .select("id, generated_email_id")
    .eq("lead_id", lead.id)
    .eq("direction", "outbound")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (outboundLog) {
    await supabase
      .from("email_logs")
      .update({ status: "replied", replied_at: now })
      .eq("id", outboundLog.id);
  }

  await supabase.from("email_logs").insert([{
    lead_id: lead.id,
    direction: "inbound",
    from_email: senderEmail,
    to_email: getHeader(msg, "To") ?? "",
    subject,
    body_preview: textBodyPreview,
    body_html: textBody,
    message_id: msg.id,
    in_reply_to: getHeader(msg, "In-Reply-To"),
    status: "replied",
    received_at: now,
    generated_email_id: outboundLog?.generated_email_id ?? null,
  }]);

  return "reply";
}
