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
      const message = err instanceof Error ? err.message : String(err);
      const isHistoryTooOld = message.includes("Gmail history error 404");

      if (isHistoryTooOld) {
        // startHistoryId trop ancien (Gmail purge son historique après un
        // certain temps) — on resynchronise sur l'état courant plutôt que
        // de planter, au prix de manquer les messages de l'intervalle.
        console.warn("[poll-gmail-inbox] History resync needed (cursor too old):", message);
        const historyId = await getCurrentHistoryId(accessToken);
        await supabase.from("gmail_accounts").update({ last_history_id: historyId }).eq("id", acc.id);
        return new Response(JSON.stringify({ skipped: "history cursor resynced after gap" }), {
          status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Erreur transitoire (429, 5xx, token expiré...) — on NE touche PAS
      // au curseur, pour que le prochain passage du cron (5 min) puisse
      // rejouer cet intervalle une fois le problème résolu, au lieu de
      // perdre silencieusement les messages arrivés entre-temps.
      console.error("[poll-gmail-inbox] listHistory failed (transient, cursor not advanced):", message);
      return new Response(JSON.stringify({ error: message }), {
        status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let replies = 0;
    let bounces = 0;
    let ignored = 0;
    let errors = 0;

    // Chaque message est traité isolément : un échec ponctuel (getMessage en
    // 404/429, payload inattendu...) ne doit pas faire échouer tout le lot.
    // Conséquence assumée : le curseur avance quand même, sinon un seul
    // message problématique bloquerait le poller indéfiniment et ferait
    // rejouer en boucle les messages déjà traités. Les échecs sont comptés
    // et loggués plutôt que retentés.
    for (const messageId of historyResult.addedMessageIds) {
      try {
        const msg = await getMessage(accessToken, messageId);
        const outcome = await processInboundMessage(supabase, msg);
        if (outcome === "reply") replies++;
        else if (outcome === "bounce") bounces++;
        else ignored++;
      } catch (err) {
        console.error("[poll-gmail-inbox] Failed to process message", messageId, ":", err instanceof Error ? err.message : err);
        errors++;
      }
    }

    await supabase.from("gmail_accounts").update({ last_history_id: historyResult.historyId }).eq("id", acc.id);

    return new Response(
      JSON.stringify({ processed: historyResult.addedMessageIds.length, replies, bounces, ignored, errors }),
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
    // Recherche directement dans email_logs (pas generated_emails) : couvre
    // aussi bien le pipeline normal (lié à un lead) que les envois de test
    // ad-hoc (send-test-email, sans generated_emails/lead), les deux
    // renseignent désormais gmail_thread_id sur leur propre ligne.
    const { data: relatedLog } = await supabase
      .from("email_logs")
      .select("id, lead_id")
      .eq("gmail_thread_id", msg.threadId)
      .eq("direction", "outbound")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!relatedLog) return "ignored";

    const bodyPreview = extractPlainTextBody(msg).slice(0, 500);
    const { error: bounceUpdateErr } = await supabase
      .from("email_logs")
      .update({ status: "bounced", error_message: bodyPreview || `Bounce détecté (${subject})` })
      .eq("id", relatedLog.id)
      .neq("status", "replied");
    if (bounceUpdateErr) console.error("[poll-gmail-inbox] Failed to update email_logs status to bounced:", bounceUpdateErr.message);

    // L'adresse ne fonctionne pas : on arrête la séquence pour ce lead, s'il
    // y en a un (un envoi de test n'en a pas). Sans ça, getFollowUpCandidates()
    // (qui n'exclut que 'replied' et 'completed') continuerait à proposer des
    // relances vers une adresse morte — le signal le plus toxique pour la
    // réputation du compte Gmail personnel que tout ce pacing cherche
    // justement à protéger. 'completed' = valeur existante du CHECK sur
    // leads.sequence_status, sémantiquement "plus aucune action automatique".
    if (relatedLog.lead_id) {
      const { error: bouncedLeadErr } = await supabase
        .from("leads")
        .update({ sequence_status: "completed", updated_at: now })
        .eq("id", relatedLog.lead_id)
        .in("sequence_status", ["idle", "active"]); // ne pas écraser un lead déjà 'replied'
      if (bouncedLeadErr) console.error("[poll-gmail-inbox] Failed to stop sequence for bounced lead:", bouncedLeadErr.message);
    }

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

  if (!lead) return await processReplyWithoutLead(supabase, msg, senderEmail, subject, now);

  // On ne traite le message comme une réponse de prospection que si on a
  // effectivement envoyé quelque chose à ce lead auparavant. Ce poller lit
  // la boîte Gmail personnelle ENTIÈRE (pas une adresse dédiée comme du
  // temps de Resend) : sans cette garde, un simple mail personnel ou
  // professionnel venant de quelqu'un qui est aussi un lead du CRM
  // basculerait sa séquence en 'replied' et son contenu serait recopié dans
  // history/email_logs — bug de données autant que problème de vie privée.
  const { data: outboundLog } = await supabase
    .from("email_logs")
    .select("id, generated_email_id")
    .eq("lead_id", lead.id)
    .eq("direction", "outbound")
    // Les lignes d'échec d'envoi ont sent_at NULL et remontent en tête d'un
    // tri DESC : sans ce filtre, la garde passerait pour un lead qu'on n'a
    // jamais réussi à contacter, et on marquerait 'replied' une ligne
    // d'échec au lieu d'un envoi réel.
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!outboundLog) return "ignored";

  const { error: leadUpdateErr } = await supabase.from("leads").update({ sequence_status: "replied", updated_at: now }).eq("id", lead.id);
  if (leadUpdateErr) console.error("[poll-gmail-inbox] Failed to update lead sequence_status:", leadUpdateErr.message);

  const textBody = extractPlainTextBody(msg);
  const textBodyPreview = textBody.length > 500 ? textBody.substring(0, 500) + "..." : textBody;

  // history n'a pas de contrainte d'unicité sur le message Gmail : si le lot
  // de polling est rejoué (échec partiel, retry), le même message créerait
  // une seconde entrée de timeline. On vérifie donc la présence avant
  // insertion. (email_logs.message_id est UNIQUE, donc protégé côté base.)
  const { data: existingHistory } = await supabase
    .from("history")
    .select("id")
    .eq("lead_id", lead.id)
    .eq("action_type", "email_received")
    .contains("metadata", { gmail_message_id: msg.id })
    .limit(1)
    .maybeSingle();

  if (!existingHistory) {
    const { error: historyInsertErr } = await supabase.from("history").insert([{
      lead_id: lead.id,
      action_type: "email_received",
      content: `Email reçu de ${lead.contact_name || senderEmail} : ${subject}\n\n${textBodyPreview}`,
      metadata: { subject, from: fromHeader, gmail_message_id: msg.id },
      is_auto: true,
    }]);
    if (historyInsertErr) console.error("[poll-gmail-inbox] Failed to insert history entry:", historyInsertErr.message);
  }

  const { error: outboundUpdateErr } = await supabase
    .from("email_logs")
    .update({ status: "replied", replied_at: now })
    .eq("id", outboundLog.id);
  if (outboundUpdateErr) console.error("[poll-gmail-inbox] Failed to update outbound email_logs status to replied:", outboundUpdateErr.message);

  const { error: inboundInsertErr } = await supabase.from("email_logs").insert([{
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
    generated_email_id: outboundLog.generated_email_id,
  }]);
  if (inboundInsertErr) console.error("[poll-gmail-inbox] Failed to insert inbound email_logs entry:", inboundInsertErr.message);

  return "reply";
}

// Réponse d'un expéditeur qui ne correspond à aucun lead actif — le cas
// normal pour un envoi de test ad-hoc (send-test-email, pas de lead requis).
// Retrouve le dernier email sortant envoyé à cette adresse via email_logs
// directement, sans passer par `leads`/`history` (rien à mettre à jour côté
// séquence puisqu'il n'y a pas de lead).
async function processReplyWithoutLead(
  supabase: ReturnType<typeof createClient>,
  msg: GmailMessage,
  senderEmail: string,
  subject: string,
  now: string,
): Promise<"reply" | "ignored"> {
  const { data: outboundLog } = await supabase
    .from("email_logs")
    .select("id")
    .eq("to_email", senderEmail)
    .eq("direction", "outbound")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!outboundLog) return "ignored";

  const { error: outboundUpdateErr } = await supabase
    .from("email_logs")
    .update({ status: "replied", replied_at: now })
    .eq("id", outboundLog.id)
    .neq("status", "replied");
  if (outboundUpdateErr) console.error("[poll-gmail-inbox] Failed to update outbound email_logs status to replied (no-lead path):", outboundUpdateErr.message);

  const textBody = extractPlainTextBody(msg);
  const textBodyPreview = textBody.length > 500 ? textBody.substring(0, 500) + "..." : textBody;

  const { error: inboundInsertErr } = await supabase.from("email_logs").insert([{
    lead_id: null,
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
    generated_email_id: null,
  }]);
  if (inboundInsertErr) console.error("[poll-gmail-inbox] Failed to insert inbound email_logs entry (no-lead path):", inboundInsertErr.message);

  return "reply";
}
