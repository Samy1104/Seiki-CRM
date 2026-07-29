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
  const trackedId = url.searchParams.get("id");
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
  if (trackedId) {
    try {
      const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
      const isScanner =
        req.method === "HEAD" ||
        userAgent.includes("bot") ||
        userAgent.includes("spider") ||
        userAgent.includes("crawler") ||
        userAgent.includes("facebookexternalhit") ||
        userAgent.includes("preview") ||
        userAgent.includes("safe-links") ||
        userAgent.includes("scanner");

      if (!isScanner && eventType === "open") {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Fetch sent_at time to verify this is a genuine open (>10s after send) and not an instant delivery pre-fetch
        const { data: log } = await supabase
          .from("email_logs")
          .select("id, sent_at, created_at, status")
          .or(`generated_email_id.eq.${trackedId},id.eq.${trackedId}`)
          .eq("direction", "outbound")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (log) {
          const sendTimeStr = log.sent_at || log.created_at;
          const elapsedMs = sendTimeStr ? Date.now() - new Date(sendTimeStr).getTime() : 15000;

          // Ignore pre-fetch hits occurring within 10 seconds of sending
          if (elapsedMs >= 10000) {
            const now = new Date().toISOString();

            await supabase
              .from("email_logs")
              .update({ status: "opened", opened_at: now })
              .eq("id", log.id)
              .neq("status", "replied");
          } else {
            console.log(`[track-email] Ignored instant pre-fetch hit (${elapsedMs}ms after send) for log ${log.id}`);
          }
        }
      }
    } catch (err) {
      console.error("[track-email] Erreur (non bloquante) :", err);
    }
  }

  return responsePromise;
});
