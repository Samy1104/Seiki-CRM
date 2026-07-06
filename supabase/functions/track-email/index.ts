// ============================================================
// Edge Function : track-email
// Runtime : Deno (Supabase)
// Rôle : Pixel de tracking — enregistre les ouvertures.
//        Appelé par le navigateur du destinataire quand il
//        ouvre l'email (via l'image 1x1 pixel injectée).
//        Resend gère aussi les événements via webhooks.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Pixel transparent 1x1 GIF en base64
const TRANSPARENT_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

serve(async (req: Request) => {
  const url = new URL(req.url);
  const generatedEmailId = url.searchParams.get("id");
  const eventType = url.searchParams.get("t") || "open"; // 'open' ou 'click'

  // Toujours retourner le pixel immédiatement (non bloquant)
  const responsePromise = new Response(TRANSPARENT_PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  });

  // Traitement asynchrone (fire-and-forget)
  if (generatedEmailId) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const now = new Date().toISOString();

      if (eventType === "open") {
        // Mise à jour du log email → status opened
        await supabase
          .from("email_logs")
          .update({ status: "opened", opened_at: now })
          .eq("generated_email_id", generatedEmailId)
          .eq("direction", "outbound")
          .neq("status", "replied"); // Ne pas écraser un statut 'replied'

        // Insérer un event dans email_logs (tracking fin-grained)
        await supabase.from("email_logs").insert([{
          lead_id: null, // Sera résolu via generated_email_id
          direction: "outbound",
          from_email: "system",
          to_email: "system",
          generated_email_id: generatedEmailId,
          status: "opened",
          opened_at: now,
        }]).then(() => {}); // silencieux
      }
    } catch (err) {
      console.error("[track-email] Erreur (non bloquante) :", err);
    }
  }

  return responsePromise;
});
