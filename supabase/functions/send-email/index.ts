// ============================================================
// Edge Function : send-email
// Runtime : Deno (Supabase)
// Rôle : Envoie un email généré via l'API Resend,
//        met à jour les statuts en BDD et insère le log.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SendRequest {
  generatedEmailId: string;
  fromEmail?: string;   // Override de l'adresse expéditrice
  fromName?: string;    // Override du nom d'affichage
}

interface GeneratedEmail {
  id: string;
  lead_id: string;
  campaign_id: string | null;
  sujet: string;
  corps_du_mail: string;
  statut_envoi: string;
}

interface LeadEmail {
  email: string;
  contact_name: string;
}

// ── Génère le HTML de l'email avec pixel de tracking ──────────────────────────

function buildEmailHtml(corps: string, trackingPixelUrl: string): string {
  // Transforme le corps texte en HTML propre avec pixel de tracking
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

// ── Handler principal ──────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // 1. Variables d'environnement
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      throw new Error("RESEND_API_KEY non configurée dans les secrets Supabase");
    }

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "prospection@votredomaine.com";
    const fromName = Deno.env.get("RESEND_FROM_NAME") || "Seiki CRM";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 2. Parsing
    const body = (await req.json()) as SendRequest;
    if (!body.generatedEmailId) {
      return new Response(
        JSON.stringify({ error: "generatedEmailId est requis" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Récupération de l'email généré
    const { data: genEmail, error: genErr } = await supabase
      .from("generated_emails")
      .select("*")
      .eq("id", body.generatedEmailId)
      .single();

    if (genErr || !genEmail) {
      throw new Error(`Email généré introuvable : ${genErr?.message}`);
    }

    const ge = genEmail as GeneratedEmail;

    // Vérification : ne pas envoyer 2 fois
    if (ge.statut_envoi === "sent") {
      return new Response(
        JSON.stringify({ error: "Cet email a déjà été envoyé", alreadySent: true }),
        { status: 409, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // 4. Récupération du lead (email destinataire)
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("email, contact_name")
      .eq("id", ge.lead_id)
      .single();

    if (leadErr || !lead?.email) {
      throw new Error(`Lead sans email valide : ${leadErr?.message}`);
    }

    const leadData = lead as LeadEmail;

    // 5. Passage au statut 'sending'
    await supabase
      .from("generated_emails")
      .update({ statut_envoi: "sending" })
      .eq("id", body.generatedEmailId);

    // 6. Délai anti-spam humanisé (500ms - 2s aléatoire)
    // En production, ce délai serait géré par un scheduler externe
    const delay = Math.floor(Math.random() * 1500) + 500;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // 7. Construction de l'URL du pixel de tracking
    // Le tracking se fait via les webhooks Resend (opens, clicks, bounces)
    const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email?id=${body.generatedEmailId}&t=open`;

    // 8. Envoi via Resend API
    const emailHtml = buildEmailHtml(ge.corps_du_mail, trackingPixelUrl);

    const resendPayload = {
      from: `${body.fromName || fromName} <${body.fromEmail || fromEmail}>`,
      to: [leadData.email],
      subject: ge.sujet,
      html: emailHtml,
      text: ge.corps_du_mail, // Fallback texte brut
      tags: [
        { name: "source", value: "seiki-crm" },
        { name: "generated_email_id", value: body.generatedEmailId },
        ...(ge.campaign_id ? [{ name: "campaign_id", value: ge.campaign_id }] : []),
      ],
    };

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      // Échec Resend → repasser en 'failed'
      await supabase
        .from("generated_emails")
        .update({ statut_envoi: "failed" })
        .eq("id", body.generatedEmailId);

      throw new Error(`Resend API error ${resendResponse.status}: ${JSON.stringify(resendData)}`);
    }

    const resendMessageId = resendData.id as string;

    // 9. Mise à jour statut → 'sent' + stockage du Resend message ID
    const sentAt = new Date().toISOString();

    await supabase
      .from("generated_emails")
      .update({
        statut_envoi: "sent",
        sent_at: sentAt,
        resend_message_id: resendMessageId,
      })
      .eq("id", body.generatedEmailId);

    // 10. Insertion dans email_logs
    const { error: logErr } = await supabase
      .from("email_logs")
      .insert([{
        lead_id: ge.lead_id,
        sequence_id: null,
        generated_email_id: body.generatedEmailId,
        direction: "outbound",
        from_email: body.fromEmail || fromEmail,
        to_email: leadData.email,
        subject: ge.sujet,
        body_preview: ge.corps_du_mail.substring(0, 500),
        body_html: emailHtml,
        message_id: resendMessageId,
        status: "sent",
        sent_at: sentAt,
      }]);

    if (logErr) {
      console.warn("[send-email] Erreur insertion log (non bloquante) :", logErr.message);
    }

    // 11. Réponse succès
    return new Response(
      JSON.stringify({
        success: true,
        resendMessageId,
        sentAt,
        to: leadData.email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[send-email] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
