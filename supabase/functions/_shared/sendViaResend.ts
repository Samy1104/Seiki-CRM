// ============================================================
// _shared/sendViaResend.ts
// Logique d'envoi Resend partagée par send-email et flush-send-queue.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout } from "./fetchWithTimeout.ts";

interface GeneratedEmail {
  id: string;
  lead_id: string;
  sujet: string;
  corps_du_mail: string;
  statut_envoi: string;
}

interface LeadEmail {
  email: string;
  contact_name: string;
}

export type SendOutcome =
  | { success: true; resendMessageId: string; sentAt: string; to: string }
  | { success: false; error: string; alreadySent?: boolean };

function buildEmailHtml(corps: string, trackingPixelUrl: string): string {
  const htmlBody = corps
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br/>" : `<p style="margin:0 0 8px 0;line-height:1.6">${line}</p>`))
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;background:#fff;padding:24px;max-width:600px;margin:0 auto">
  <div style="border-left:3px solid #6B5FE6;padding-left:16px;margin-bottom:24px">
    ${htmlBody}
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="font-size:11px;color:#888;margin:0">
    Envoyé par Seiki — <a href="mailto:contact@seiki.fr" style="color:#6B5FE6">contact@seiki.fr</a>
  </p>
  <!-- Tracking pixel (ouverture) -->
  <img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt=""/>
</body>
</html>`;
}

export async function sendGeneratedEmailViaResend(
  supabase: SupabaseClient,
  generatedEmailId: string,
  options?: { fromEmail?: string; fromName?: string },
): Promise<SendOutcome> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return { success: false, error: "RESEND_API_KEY non configurée dans les secrets Supabase" };
  }

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "prospection@votredomaine.com";
  const fromName = Deno.env.get("RESEND_FROM_NAME") || "Seiki CRM";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

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
    .select("email, contact_name")
    .eq("id", ge.lead_id)
    .single();

  if (leadErr || !lead?.email) {
    return { success: false, error: `Lead sans email valide : ${leadErr?.message}` };
  }

  const leadData = lead as LeadEmail;

  await supabase.from("generated_emails").update({ statut_envoi: "sending" }).eq("id", generatedEmailId);

  const delay = Math.floor(Math.random() * 1500) + 500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email?id=${generatedEmailId}&t=open`;
  const emailHtml = buildEmailHtml(ge.corps_du_mail, trackingPixelUrl);
  const resolvedFromEmail = options?.fromEmail || fromEmail;

  const recordFailure = async (errorMessage: string) => {
    await supabase.from("generated_emails").update({ statut_envoi: "failed" }).eq("id", generatedEmailId);
    // On garde une trace de la raison de l'échec (invisible autrement : la ligne
    // generated_emails ne stocke pas d'erreur, et l'onglet Validation ne charge
    // que les statuts 'draft'/'failed' — sans ce log, l'échec disparaît sans laisser
    // de moyen de comprendre pourquoi ni de le rejouer en connaissance de cause).
    await supabase.from("email_logs").insert([{
      lead_id: ge.lead_id,
      generated_email_id: generatedEmailId,
      direction: "outbound",
      from_email: resolvedFromEmail,
      to_email: leadData.email,
      subject: ge.sujet,
      status: "failed",
      error_message: errorMessage,
    }]).then(() => {});
  };

  const resendPayload = {
    from: `${options?.fromName || fromName} <${resolvedFromEmail}>`,
    to: [leadData.email],
    subject: ge.sujet,
    html: emailHtml,
    text: ge.corps_du_mail,
    tags: [
      { name: "source", value: "seiki-crm" },
      { name: "generated_email_id", value: generatedEmailId },
    ],
  };

  let resendResponse: Response;
  try {
    resendResponse = await fetchWithTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(resendPayload),
    });
  } catch (err) {
    const message = `Erreur réseau vers Resend : ${err instanceof Error ? err.message : String(err)}`;
    await recordFailure(message);
    return { success: false, error: message };
  }

  const resendData = await resendResponse.json();

  if (!resendResponse.ok) {
    const message = `Resend API error ${resendResponse.status}: ${JSON.stringify(resendData)}`;
    await recordFailure(message);
    return { success: false, error: message };
  }

  const resendMessageId = resendData.id as string;
  const sentAt = new Date().toISOString();

  await supabase
    .from("generated_emails")
    .update({ statut_envoi: "sent", sent_at: sentAt, resend_message_id: resendMessageId })
    .eq("id", generatedEmailId);

  const { error: logErr } = await supabase.from("email_logs").insert([{
    lead_id: ge.lead_id,
    sequence_id: null,
    generated_email_id: generatedEmailId,
    direction: "outbound",
    from_email: options?.fromEmail || fromEmail,
    to_email: leadData.email,
    subject: ge.sujet,
    body_preview: ge.corps_du_mail.substring(0, 500),
    body_html: emailHtml,
    message_id: resendMessageId,
    status: "sent",
    sent_at: sentAt,
  }]);

  if (logErr) {
    console.warn("[sendViaResend] Erreur insertion log (non bloquante) :", logErr.message);
  }

  return { success: true, resendMessageId, sentAt, to: leadData.email };
}
