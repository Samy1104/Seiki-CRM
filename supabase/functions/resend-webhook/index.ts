// ============================================================
// Edge Function : resend-webhook
// Runtime : Deno (Supabase)
// Rôle : Reçoit les webhooks de Resend (ouvertures, clics, rebonds et réponses).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.8.0";
import { corsHeaders } from "../_shared/cors.ts";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";

function jsonError(req: Request, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  const webhookCors = { ...corsHeaders(req), "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature" };

  // Gestion de la requête de pré-vol CORS
  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: webhookCors });
  }

  if (req.method !== "POST") {
    return jsonError(req, "Method Not Allowed", 405);
  }

  const signatureSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  const rawBody = await req.text();

  // 1. Validation de la signature Svix — obligatoire : sans secret configuré,
  // n'importe qui connaissant l'URL pourrait injecter de faux événements
  // (statuts d'envoi, réponses de leads...). On refuse plutôt que d'ignorer
  // silencieusement la vérification (fail closed, pas fail open).
  if (!signatureSecret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET non configuré — requête refusée (fail closed).");
    return jsonError(req, "Webhook not configured", 503);
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("[resend-webhook] En-têtes svix manquants");
    return jsonError(req, "Missing signature headers", 400);
  }

  try {
    const wh = new Webhook(signatureSecret);
    wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    console.log("[resend-webhook] Signature Svix validée avec succès");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Inconnu";
    console.error("[resend-webhook] Échec de validation de la signature :", msg);
    return jsonError(req, "Invalid signature", 400);
  }

  // 2. Parsing du payload JSON
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("[resend-webhook] JSON invalide :", err);
    return jsonError(req, "Invalid JSON", 400);
  }

  const { type, data } = payload;
  if (!type || !data) {
    return jsonError(req, "Missing type or data", 400);
  }

  // Initialisation client Supabase avec la clé service_role pour bypass RLS
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`[resend-webhook] Traitement de l'événement : ${type}`);

  try {
    const now = new Date().toISOString();

    // ── TRAITEMENT DE L'OUVERTURE / CLIC D'EMAIL ────────────────────────────
    if (type === "email.opened" || type === "email.clicked") {
      const resendMessageId = data.email_id;
      if (!resendMessageId) {
        return jsonError(req, "Missing email_id in data", 400);
      }

      console.log(`[resend-webhook] E-mail ouvert détecté : ${resendMessageId}`);

      // Mise à jour du journal d'e-mails (seulement si le statut n'est pas déjà 'replied')
      const { data: updatedLogs, error: logErr } = await supabase
        .from("email_logs")
        .update({ status: "opened", opened_at: now })
        .eq("message_id", resendMessageId)
        .eq("direction", "outbound")
        .neq("status", "replied")
        .select();

      if (logErr) {
        console.error("[resend-webhook] Erreur de mise à jour de email_logs :", logErr.message);
        return jsonError(req, `DB Error: ${logErr.message}`, 500);
      }

      console.log(`[resend-webhook] Logs e-mails mis à jour : ${updatedLogs?.length || 0}`);
    } 

    // ── TRAITEMENT DE LA RÉCEPTION DE MAIL (RÉPONSE DU PROSPECT) ─────────────
    else if (type === "email.received") {
      const receivedEmailId = data.email_id;
      if (!receivedEmailId) {
        return jsonError(req, "Missing email_id in data", 400);
      }

      console.log(`[resend-webhook] Réception d'e-mail détectée : ${receivedEmailId}`);

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        console.error("[resend-webhook] RESEND_API_KEY n'est pas configuré");
        return jsonError(req, "RESEND_API_KEY is not configured", 500);
      }

      // Appel à l'API Resend pour récupérer le contenu complet (corps du mail)
      const resendRes = await fetchWithTimeout(`https://api.resend.com/emails/receiving/${receivedEmailId}`, {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!resendRes.ok) {
        const errorText = await resendRes.text();
        console.error(`[resend-webhook] Impossible de récupérer l'e-mail (status ${resendRes.status}) :`, errorText);
        return jsonError(req, `Resend API error: ${errorText}`, 500);
      }

      const fullEmail = await resendRes.json();
      const fromStr = fullEmail.from || "";
      
      // Extraction de l'adresse e-mail propre du format "Nom <email@domain.com>"
      const emailRegex = /<([^>]+)>/;
      const match = fromStr.match(emailRegex);
      const senderEmail = (match ? match[1] : fromStr).trim().toLowerCase();

      if (!senderEmail) {
        console.error("[resend-webhook] Impossible de parser l'adresse d'expéditeur :", fromStr);
        return jsonError(req, "Invalid sender email", 400);
      }

      console.log(`[resend-webhook] E-mail expéditeur résolu : ${senderEmail}`);

      // 1. Recherche du Lead actif associé
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .select("id, contact_name, company_name")
        .eq("email", senderEmail)
        .eq("is_archived", false)
        .limit(1)
        .maybeSingle();

      if (leadErr) {
        console.error("[resend-webhook] Erreur de recherche du lead :", leadErr.message);
        return jsonError(req, `DB Error: ${leadErr.message}`, 500);
      }

      if (!lead) {
        console.warn(`[resend-webhook] Aucun lead actif trouvé pour l'adresse e-mail : ${senderEmail}`);
        // Retourne 200 (et non une erreur) pour éviter que Resend ne relance ce webhook indéfiniment
        return new Response(JSON.stringify({ message: `No active lead found for: ${senderEmail}` }), {
          status: 200,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
      }

      console.log(`[resend-webhook] Lead identifié : ${lead.company_name} (ID: ${lead.id})`);

      // 2. Passage de l'état de la séquence à 'replied' pour stopper les relances
      const { error: updateLeadErr } = await supabase
        .from("leads")
        .update({ sequence_status: "replied", updated_at: now })
        .eq("id", lead.id);

      if (updateLeadErr) {
        console.error("[resend-webhook] Échec de mise à jour du statut séquence :", updateLeadErr.message);
      }

      // 3. Ajout d'une entrée dans la Timeline d'historique du lead
      const textBody = fullEmail.text || "";
      const textBodyPreview = textBody.length > 500 ? textBody.substring(0, 500) + "..." : textBody;
      const cleanSubject = fullEmail.subject || "(sans sujet)";

      const { error: historyErr } = await supabase
        .from("history")
        .insert([{
          lead_id: lead.id,
          action_type: "email_received",
          content: `Email reçu de ${lead.contact_name || senderEmail} : ${cleanSubject}\n\n${textBodyPreview}`,
          metadata: {
            subject: cleanSubject,
            from: fromStr,
            resend_email_id: receivedEmailId,
          },
          is_auto: true
        }]);

      if (historyErr) {
        console.error("[resend-webhook] Échec d'insertion dans l'historique :", historyErr.message);
      }

      // 4. Recherche de la dernière prospection sortante pour associer la réponse
      const { data: outboundLog, error: outboundErr } = await supabase
        .from("email_logs")
        .select("id, generated_email_id")
        .eq("lead_id", lead.id)
        .eq("direction", "outbound")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (outboundErr) {
        console.error("[resend-webhook] Erreur de récupération du log sortant :", outboundErr.message);
      }

      // 5. Mise à jour du log sortant en statut 'replied' (pour les métriques de campagnes)
      if (outboundLog) {
        const { error: updateLogErr } = await supabase
          .from("email_logs")
          .update({ status: "replied", replied_at: now })
          .eq("id", outboundLog.id);

        if (updateLogErr) {
          console.error("[resend-webhook] Échec de mise à jour du log sortant en 'replied' :", updateLogErr.message);
        }
      }

      // 6. Insertion du log e-mail entrant (boîte de réception unifiée)
      const toEmails = Array.isArray(fullEmail.to) ? fullEmail.to : [fullEmail.to || ""];
      const { error: insertLogErr } = await supabase
        .from("email_logs")
        .insert([{
          lead_id: lead.id,
          direction: "inbound",
          from_email: senderEmail,
          to_email: toEmails[0] || "",
          subject: cleanSubject,
          body_preview: textBodyPreview,
          body_html: fullEmail.html || textBody,
          message_id: receivedEmailId,
          status: "replied",
          received_at: fullEmail.created_at || now,
          generated_email_id: outboundLog?.generated_email_id || null
        }]);

      if (insertLogErr) {
        console.error("[resend-webhook] Échec d'insertion du log entrant :", insertLogErr.message);
      }

      console.log(`[resend-webhook] Traitement de la réponse terminé pour le lead : ${lead.id}`);
    }

    // ── TRAITEMENT DES ERREURS DE LIVRAISON (REBONDS/ÉCHECS) ─────────────────
    else {
      const statusMap: Record<string, string> = {
        "email.sent": "sent",
        "email.delivered": "delivered",
        "email.bounced": "bounced",
        "email.delivery_delayed": "failed",
        "email.complained": "failed",
      };

      const newStatus = statusMap[type];
      if (newStatus) {
        const resendMessageId = data.email_id;
        if (resendMessageId) {
          console.log(`[resend-webhook] Mise à jour du mail sortant ${resendMessageId} -> statut: ${newStatus}`);
          
          const updateFields: any = { status: newStatus };
          if (newStatus === "failed" || newStatus === "bounced") {
            updateFields.error_message = data.error?.message || `Échec d'envoi détecté par webhook Resend (${type})`;
          }

          const { error: bounceErr } = await supabase
            .from("email_logs")
            .update(updateFields)
            .eq("message_id", resendMessageId)
            .eq("direction", "outbound")
            .neq("status", "replied"); // Ne pas écraser une réponse déjà reçue

          if (bounceErr) {
            console.error("[resend-webhook] Échec de mise à jour du statut d'échec :", bounceErr.message);
          }
        }
      } else {
        console.log(`[resend-webhook] Événement ignoré/non configuré : ${type}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inattendue";
    console.error("[resend-webhook] Erreur interne :", msg);
    return jsonError(req, "Internal Server Error", 500);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
});
