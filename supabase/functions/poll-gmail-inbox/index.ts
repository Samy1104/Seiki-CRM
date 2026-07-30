// ============================================================
// Edge Function : poll-gmail-inbox
// Runtime : Deno (Supabase)
// Rôle : Remplace resend-webhook. Gmail n'a pas de webhook —
//        on interroge périodiquement l'historique de la boîte de
//        réception pour détecter réponses (par expéditeur connu)
//        et bounces (par thread + heuristique expéditeur/sujet).
//        Appelée par le cron Supabase toutes les minutes.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireServiceRole } from "../_shared/requireUser.ts";
import { getMessage, listHistory, getCurrentHistoryId, refreshAccessToken } from "../_shared/gmailApi.ts";
import { getHeader, extractPlainTextBody, type GmailMessage } from "../_shared/gmailMessageParser.ts";
import { classifyInboundMessage } from "../_shared/gmailReplyClassifier.ts";
import { classifyReplySentiment, type SentimentResult } from "../_shared/replySentimentClassifier.ts";
import { resolveStageIdForSentiment } from "../_shared/replyStageResolver.ts";

interface GmailAccount {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_history_id: string | null;
}

interface ReplyClassificationSettings {
  enabled: boolean;
  positiveStageId: string | null;
  negativeStageId: string | null;
  geminiKey: string | null;
}

async function loadReplyClassificationSettings(
  supabase: ReturnType<typeof createClient>,
): Promise<ReplyClassificationSettings> {
  const { data: enabledSetting } = await supabase.from("app_settings").select("value").eq("key", "reply_ai_classification_enabled").maybeSingle();
  const { data: positiveSetting } = await supabase.from("app_settings").select("value").eq("key", "reply_positive_stage_id").maybeSingle();
  const { data: negativeSetting } = await supabase.from("app_settings").select("value").eq("key", "reply_negative_stage_id").maybeSingle();

  return {
    enabled: (enabledSetting?.value as { enabled?: boolean } | null)?.enabled ?? true,
    positiveStageId: (positiveSetting?.value as { stage_id?: string | null } | null)?.stage_id ?? null,
    negativeStageId: (negativeSetting?.value as { stage_id?: string | null } | null)?.stage_id ?? null,
    geminiKey: Deno.env.get("GEMINI_API_KEY") ?? null,
  };
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
      .select("id, email, access_token, refresh_token, expires_at, last_history_id")
      .limit(1)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(JSON.stringify({ skipped: "no Gmail account connected" }), {
        status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const acc = account as GmailAccount;
    const replySettings = await loadReplyClassificationSettings(supabase);

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
        const outcome = await processInboundMessage(supabase, msg, acc.email, replySettings);
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
  accountEmail: string,
  replySettings: ReplyClassificationSettings,
): Promise<"reply" | "bounce" | "ignored"> {
  const fromHeader = getHeader(msg, "From") ?? "";
  const subject = getHeader(msg, "Subject") ?? "(sans sujet)";
  const match = fromHeader.match(/<([^>]+)>/);
  const senderEmail = (match ? match[1] : fromHeader).trim().toLowerCase();

  // Envoyer un email de test À SA PROPRE adresse connectée (auto-test) fait
  // atterrir une copie du message dans sa propre boîte de réception — Gmail
  // livre normalement au(x) destinataire(s), et ici le destinataire EST le
  // compte connecté. Cette copie apparaît dans l'historique INBOX comme un
  // nouveau message "de" soi-même, et serait sinon classée à tort comme une
  // réponse du prospect alors qu'il ne s'agit que de l'écho du propre envoi.
  //
  // Mais si le lead de test partage justement cette même adresse (cas de
  // test courant), une VRAIE réponse tapée à la main vient elle aussi "de
  // soi-même" — un simple test d'égalité d'adresse ne peut donc plus
  // distinguer les deux cas et jetait à tort toute réponse de ce type.
  // Distinction fiable : l'écho automatique EST le même message RFC822
  // (SMTP ne réécrit pas Message-Id), alors qu'une réponse — même à
  // soi-même — est un nouveau message Gmail avec un nouveau Message-Id et
  // des en-têtes In-Reply-To/References. On compare donc contre le
  // Message-Id qu'on a nous-mêmes stocké lors de l'envoi (email_logs.message_id)
  // plutôt que de se fier à l'adresse seule.
  if (senderEmail === accountEmail.toLowerCase()) {
    const inboundMessageId = getHeader(msg, "Message-Id");
    if (!inboundMessageId) return "ignored"; // rien à comparer, on ne peut pas distinguer en sécurité

    const { data: echoOfOwnSend } = await supabase
      .from("email_logs")
      .select("id")
      .eq("message_id", inboundMessageId)
      .eq("direction", "outbound")
      .limit(1)
      .maybeSingle();

    if (echoOfOwnSend) return "ignored"; // confirmé : c'est notre propre envoi qui revient, pas une réponse
  }

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
  // On retrouve D'ABORD l'envoi sortant auquel cette réponse correspond par
  // fil Gmail (gmail_thread_id) — même logique que la détection de bounce
  // ci-dessus — plutôt que de partir de l'adresse email du lead. Un lead
  // peut partager son adresse avec un envoi totalement indépendant (ex. un
  // envoi de test ad-hoc sans lead_id) : matcher par adresse seule
  // rattachait alors la réponse au dernier envoi de CE lead au lieu du
  // message auquel on a réellement répondu.
  const { data: threadOutboundLog } = await supabase
    .from("email_logs")
    .select("id, generated_email_id, lead_id")
    .eq("gmail_thread_id", msg.threadId)
    .eq("direction", "outbound")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let lead: { id: string; contact_name: string; company_name: string } | null = null;
  let outboundLog: { id: string; generated_email_id: string | null } | null = threadOutboundLog;

  if (threadOutboundLog?.lead_id) {
    const { data: leadRow } = await supabase
      .from("leads")
      .select("id, contact_name, company_name")
      .eq("id", threadOutboundLog.lead_id)
      .eq("is_archived", false)
      .maybeSingle();
    lead = leadRow ?? null;
  }

  // Pas de fil correspondant (gmail_thread_id absent/désynchronisé — ancien
  // envoi pré-Gmail, thread cassé...) : dernier recours, l'ancienne
  // heuristique par adresse email du lead.
  if (!threadOutboundLog) {
    const { data: leadByEmail } = await supabase
      .from("leads")
      .select("id, contact_name, company_name")
      .eq("email", senderEmail)
      .eq("is_archived", false)
      .limit(1)
      .maybeSingle();

    if (!leadByEmail) return await processReplyWithoutLead(supabase, msg, senderEmail, subject, now);

    // On ne traite le message comme une réponse de prospection que si on a
    // effectivement envoyé quelque chose à ce lead auparavant. Ce poller lit
    // la boîte Gmail personnelle ENTIÈRE (pas une adresse dédiée comme du
    // temps de Resend) : sans cette garde, un simple mail personnel ou
    // professionnel venant de quelqu'un qui est aussi un lead du CRM
    // basculerait sa séquence en 'replied' et son contenu serait recopié dans
    // history/email_logs — bug de données autant que problème de vie privée.
    const { data: lastOutboundForLead } = await supabase
      .from("email_logs")
      .select("id, generated_email_id")
      .eq("lead_id", leadByEmail.id)
      .eq("direction", "outbound")
      // Les lignes d'échec d'envoi ont sent_at NULL et remontent en tête d'un
      // tri DESC : sans ce filtre, la garde passerait pour un lead qu'on n'a
      // jamais réussi à contacter, et on marquerait 'replied' une ligne
      // d'échec au lieu d'un envoi réel.
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastOutboundForLead) return "ignored";

    lead = leadByEmail;
    outboundLog = lastOutboundForLead;
  }

  // Fil retrouvé mais rattaché à aucun lead (envoi de test ad-hoc) : rien à
  // mettre à jour côté séquence — on journalise via le chemin sans lead en
  // lui passant directement l'envoi déjà résolu par fil, plutôt que de le
  // re-chercher par to_email (qui pourrait matcher un autre envoi que celui
  // auquel il a été répondu).
  if (!lead) return await processReplyWithoutLead(supabase, msg, senderEmail, subject, now, outboundLog ?? undefined);

  if (!outboundLog) return "ignored";

  const { error: leadUpdateErr } = await supabase.from("leads").update({ sequence_status: "replied", updated_at: now }).eq("id", lead.id);
  if (leadUpdateErr) console.error("[poll-gmail-inbox] Failed to update lead sequence_status:", leadUpdateErr.message);

  const textBody = extractPlainTextBody(msg);
  const textBodyPreview = textBody.length > 500 ? textBody.substring(0, 500) + "..." : textBody;

  // Classification IA du sentiment — best-effort : un échec Gemini (timeout,
  // JSON invalide, clé manquante) ne doit jamais empêcher le traitement de la
  // réponse elle-même (sequence_status, history, email_logs ci-dessous).
  let sentimentResult: SentimentResult | null = null;
  if (replySettings.enabled && replySettings.geminiKey) {
    try {
      sentimentResult = await classifyReplySentiment(replySettings.geminiKey, textBody, subject);
    } catch (err) {
      console.error("[poll-gmail-inbox] Reply sentiment classification failed (non-blocking):", err instanceof Error ? err.message : err);
    }
  }

  if (sentimentResult) {
    const targetStageId = resolveStageIdForSentiment(sentimentResult.sentiment, {
      positiveStageId: replySettings.positiveStageId,
      negativeStageId: replySettings.negativeStageId,
    });
    if (targetStageId) {
      // Vérifier si l'étape cible est une étape de perte (Closed Lost)
      const { data: targetStage } = await supabase
        .from("pipeline_stages")
        .select("name, is_closed_lost")
        .eq("id", targetStageId)
        .maybeSingle();

      const { data: lostSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "pipeline_lost_stage_ids")
        .maybeSingle();

      const lostStageIds = Array.isArray((lostSetting?.value as any)?.stage_ids) ? (lostSetting!.value as any).stage_ids : [];
      const stageName = (targetStage?.name || "").toLowerCase();
      const isLost = Boolean(
        targetStage?.is_closed_lost ||
        lostStageIds.includes(targetStageId) ||
        stageName.includes("perdu") ||
        stageName.includes("lost") ||
        stageName.includes("abandon")
      );

      const leadUpdates: Record<string, any> = { stage_id: targetStageId, updated_at: now };
      if (isLost) {
        leadUpdates.is_archived = true;
      }

      const { error: stageUpdateErr } = await supabase.from("leads").update(leadUpdates).eq("id", lead.id);
      if (stageUpdateErr) console.error("[poll-gmail-inbox] Failed to update lead stage from reply sentiment:", stageUpdateErr.message);
    }
  }

  const sentimentNote = sentimentResult
    ? `\n\n[IA] Sentiment détecté : ${sentimentResult.sentiment} — ${sentimentResult.reason}`
    : "";

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
      content: `Email reçu de ${lead.contact_name || senderEmail} : ${subject}\n\n${textBodyPreview}${sentimentNote}`,
      metadata: {
        subject,
        from: fromHeader,
        gmail_message_id: msg.id,
        ...(sentimentResult ? { sentiment: sentimentResult.sentiment, sentiment_reason: sentimentResult.reason } : {}),
      },
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
    gmail_thread_id: msg.threadId,
    in_reply_to: getHeader(msg, "In-Reply-To"),
    status: "replied",
    received_at: now,
    generated_email_id: outboundLog.generated_email_id,
    reply_sentiment: sentimentResult?.sentiment ?? null,
    reply_sentiment_reason: sentimentResult?.reason ?? null,
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
  resolvedOutboundLog?: { id: string },
): Promise<"reply" | "ignored"> {
  let outboundLog: { id: string } | null = resolvedOutboundLog ?? null;

  if (!outboundLog) {
    const { data } = await supabase
      .from("email_logs")
      .select("id")
      .eq("to_email", senderEmail)
      .eq("direction", "outbound")
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    outboundLog = data;
  }

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
    gmail_thread_id: msg.threadId,
    in_reply_to: getHeader(msg, "In-Reply-To"),
    status: "replied",
    received_at: now,
    generated_email_id: null,
  }]);
  if (inboundInsertErr) console.error("[poll-gmail-inbox] Failed to insert inbound email_logs entry (no-lead path):", inboundInsertErr.message);

  return "reply";
}
