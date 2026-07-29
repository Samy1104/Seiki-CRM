// ============================================================
// _shared/sendViaGmail.ts
// Logique d'envoi Gmail — remplace _shared/sendViaResend.ts.
// Rafraîchit le token si besoin, construit le MIME (avec
// In-Reply-To si c'est une relance), envoie via Gmail API,
// journalise dans generated_emails + email_logs.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEmailHtml, buildRawEmail } from "./gmailMime.ts";
import { getMessage, refreshAccessToken, sendRawMessage } from "./gmailApi.ts";
import { getHeader } from "./gmailMessageParser.ts";
import { shouldSkipSendForLeadStatus, type SequenceStatus } from "./sendGuard.ts";

interface GeneratedEmail {
  id: string;
  lead_id: string;
  sujet: string;
  corps_du_mail: string;
  statut_envoi: string;
  step: string;
}

interface LeadEmail {
  email: string;
  contact_name: string;
  sequence_status: string;
}

export interface GmailAccount {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export type SendOutcome =
  | { success: true; gmailMessageId: string; gmailThreadId: string; sentAt: string; to: string }
  | { success: false; error: string; alreadySent?: boolean; skippedReplied?: boolean };

export async function getFromName(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "gmail_from_name")
    .maybeSingle();
  return (data?.value as { name?: string } | null)?.name || "Seiki CRM";
}

export async function getValidAccessToken(supabase: SupabaseClient, account: GmailAccount): Promise<string> {
  const expiresInMs = new Date(account.expires_at).getTime() - Date.now();
  if (expiresInMs > 5 * 60 * 1000) return account.access_token;

  const refreshed = await refreshAccessToken(account.refresh_token);
  await supabase
    .from("gmail_accounts")
    .update({
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq("id", account.id);

  return refreshed.access_token;
}

export async function sendGeneratedEmailViaGmail(supabase: SupabaseClient, generatedEmailId: string): Promise<SendOutcome> {
  const { data: account, error: accErr } = await supabase
    .from("gmail_accounts")
    .select("id, email, access_token, refresh_token, expires_at")
    .limit(1)
    .maybeSingle();

  if (accErr || !account) {
    return { success: false, error: "Aucun compte Gmail connecté" };
  }

  const { data: genEmail, error: genErr } = await supabase
    .from("generated_emails")
    .select("*")
    .eq("id", generatedEmailId)
    .single();

  if (genErr || !genEmail) {
    return { success: false, error: `Email généré introuvable : ${genErr?.message}` };
  }

  const ge = genEmail as GeneratedEmail;

  if (ge.statut_envoi === "sent") {
    return { success: false, error: "Cet email a déjà été envoyé", alreadySent: true };
  }

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("email, contact_name, sequence_status")
    .eq("id", ge.lead_id)
    .single();

  if (leadErr || !lead?.email) {
    return { success: false, error: `Lead sans email valide : ${leadErr?.message}` };
  }

  if (shouldSkipSendForLeadStatus(lead.sequence_status as SequenceStatus)) {
    await supabase.from("generated_emails").update({ statut_envoi: "skipped_replied" }).eq("id", generatedEmailId);
    return {
      success: false,
      error: "Envoi annulé : le lead a déjà répondu ou la séquence est terminée",
      skippedReplied: true,
    };
  }

  const leadData = lead as LeadEmail;

  await supabase.from("generated_emails").update({ statut_envoi: "sending" }).eq("id", generatedEmailId);

  // Relance : on thread avec le dernier email sortant du lead pour que Gmail
  // affiche la conversation groupée, des deux côtés.
  // 1) email_logs.message_id porte le Message-Id RFC 5322 du dernier envoi —
  //    c'est lui qui alimente les en-têtes In-Reply-To / References, seuls
  //    reconnus par les clients mail du destinataire.
  const { data: lastOutbound } = await supabase
    .from("email_logs")
    .select("message_id")
    .eq("lead_id", ge.lead_id)
    .eq("direction", "outbound")
    // recordFailure() insère des lignes d'échec avec sent_at NULL. En DESC,
    // Postgres remonte les NULL en premier : sans ce filtre, une tentative
    // ratée éclipserait le dernier envoi réellement abouti et fournirait un
    // In-Reply-To vide. Seuls les envois réussis ont un sent_at.
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2) generated_emails.gmail_thread_id porte l'identifiant de fil INTERNE
  //    Gmail — à passer à l'API d'envoi pour que le message atterrisse dans
  //    le même fil dans notre propre boîte.
  const { data: lastThreaded } = await supabase
    .from("generated_emails")
    .select("gmail_thread_id")
    .eq("lead_id", ge.lead_id)
    .not("gmail_thread_id", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email?id=${generatedEmailId}&t=open`;
  const htmlBody = buildEmailHtml(ge.corps_du_mail, trackingPixelUrl);

  // Les relances ont besoin d'un préfixe "Re: " pour que les heuristiques de
  // regroupement propres à Gmail les rattachent effectivement à l'email
  // initial chez le destinataire (Gmail se base sur la correspondance du
  // sujet + References, pas seulement sur notre threadId). N'affecte que le
  // sujet du MIME sortant — ge.sujet (donc ce qui est loggué/affiché) reste
  // le sujet issu du template.
  const outgoingSubject = ge.step !== "initial" && !ge.sujet.toLowerCase().startsWith("re:")
    ? `Re: ${ge.sujet}`
    : ge.sujet;

  const fromName = await getFromName(supabase);
  const rawMessage = buildRawEmail({
    fromEmail: account.email,
    fromName,
    toEmail: leadData.email,
    subject: outgoingSubject,
    textBody: ge.corps_du_mail,
    htmlBody,
    inReplyTo: lastOutbound?.message_id ?? undefined,
    references: lastOutbound?.message_id ?? undefined,
  });

  const recordFailure = async (errorMessage: string) => {
    await supabase.from("generated_emails").update({ statut_envoi: "failed" }).eq("id", generatedEmailId);
    await supabase.from("email_logs").insert([{
      lead_id: ge.lead_id,
      generated_email_id: generatedEmailId,
      direction: "outbound",
      from_email: account.email,
      to_email: leadData.email,
      subject: ge.sujet,
      status: "failed",
      error_message: errorMessage,
    }]);
  };

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(supabase, account as GmailAccount);
  } catch (err) {
    const message = `Rafraîchissement du token Gmail échoué : ${err instanceof Error ? err.message : String(err)}`;
    await recordFailure(message);
    return { success: false, error: message };
  }

  let sendResult: { id: string; threadId: string };
  try {
    sendResult = await sendRawMessage(accessToken, rawMessage, lastThreaded?.gmail_thread_id ?? undefined);
  } catch (err) {
    if (lastThreaded?.gmail_thread_id) {
      // Gmail a refusé l'envoi threadé (sujet/fil incohérent, fil obsolète...)
      // — on retente une fois sans threadId plutôt que de faire échouer tout
      // l'envoi pour un confort de threading. Le destinataire reçoit bien le
      // mail ; il ne sera simplement pas regroupé dans notre propre boîte.
      console.warn("[sendViaGmail] Threaded send failed, retrying without threadId:", err instanceof Error ? err.message : err);
      try {
        sendResult = await sendRawMessage(accessToken, rawMessage);
      } catch (retryErr) {
        const message = `Erreur envoi Gmail : ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`;
        await recordFailure(message);
        return { success: false, error: message };
      }
    } else {
      const message = `Erreur envoi Gmail : ${err instanceof Error ? err.message : String(err)}`;
      await recordFailure(message);
      return { success: false, error: message };
    }
  }

  // sendResult.id est l'identifiant de ressource INTERNE Gmail (hex, sans
  // chevrons ni domaine) — inutilisable comme In-Reply-To/References. On
  // relit le message envoyé pour récupérer son vrai en-tête Message-Id
  // RFC 5322, seul format que les clients mail acceptent pour le threading.
  let rfcMessageId = sendResult.id;
  try {
    const sentMsg = await getMessage(accessToken, sendResult.id);
    rfcMessageId = getHeader(sentMsg, "Message-Id") ?? sendResult.id;
  } catch (err) {
    console.warn("[sendViaGmail] Relecture du Message-Id échouée (non bloquante) :", err instanceof Error ? err.message : err);
  }

  const sentAt = new Date().toISOString();

  await supabase
    .from("generated_emails")
    .update({ statut_envoi: "sent", sent_at: sentAt, gmail_message_id: sendResult.id, gmail_thread_id: sendResult.threadId })
    .eq("id", generatedEmailId);

  const { error: logErr } = await supabase.from("email_logs").insert([{
    lead_id: ge.lead_id,
    generated_email_id: generatedEmailId,
    direction: "outbound",
    from_email: account.email,
    to_email: leadData.email,
    subject: ge.sujet,
    body_preview: ge.corps_du_mail.substring(0, 500),
    body_html: htmlBody,
    message_id: rfcMessageId,
    gmail_thread_id: sendResult.threadId,
    status: "sent",
    sent_at: sentAt,
  }]);

  if (logErr) {
    console.warn("[sendViaGmail] Erreur insertion log (non bloquante) :", logErr.message);
  }

  return { success: true, gmailMessageId: sendResult.id, gmailThreadId: sendResult.threadId, sentAt, to: leadData.email };
}
