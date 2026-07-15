// ============================================================
// Edge Function : publish-linkedin-post
// Runtime : Deno (Supabase)
// Rôle : Publie sur LinkedIn les posts programmés dont la date
//        est due. Appelée par le cron Supabase toutes les 5 min.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { refreshAccessToken, uploadImage, publishPost } from "../_shared/linkedinApi.ts";

interface ScheduledPost {
  id: string;
  hook: string;
  corps: string;
  hashtags: string[];
  image_path: string | null;
  target_account_id: string;
}

interface LinkedinAccount {
  id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  linkedin_urn: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: due, error: dueErr } = await supabase
      .from("scheduled_linkedin_posts")
      .select("id, hook, corps, hashtags, image_path, target_account_id")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (dueErr) throw dueErr;

    let posted = 0;
    let failed = 0;

    for (const row of (due ?? []) as ScheduledPost[]) {
      try {
        await publishOne(supabase, row);
        posted++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        console.error("[publish-linkedin-post] Échec pour", row.id, ":", message);
        await supabase.from("scheduled_linkedin_posts").update({ status: "failed", error_message: message }).eq("id", row.id);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed: (due ?? []).length, posted, failed }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[publish-linkedin-post] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});

async function publishOne(supabase: ReturnType<typeof createClient>, row: ScheduledPost): Promise<void> {
  const { data: account, error: accErr } = await supabase
    .from("linkedin_accounts")
    .select("id, access_token, refresh_token, expires_at, linkedin_urn")
    .eq("id", row.target_account_id)
    .single();

  if (accErr || !account) {
    throw new Error("Compte LinkedIn déconnecté");
  }

  const acc = account as unknown as LinkedinAccount;
  let accessToken = acc.access_token;

  const expiresInMs = new Date(acc.expires_at).getTime() - Date.now();
  if (expiresInMs < 5 * 60 * 1000) {
    if (!acc.refresh_token) {
      throw new Error("Compte LinkedIn déconnecté (token expiré, pas de refresh token)");
    }
    const refreshed = await refreshAccessToken(acc.refresh_token);
    accessToken = refreshed.access_token;
    await supabase
      .from("linkedin_accounts")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? acc.refresh_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq("id", acc.id);
  }

  let imageUrn: string | undefined;
  if (row.image_path) {
    const { data: imageBlob, error: dlErr } = await supabase.storage.from("linkedin-media").download(row.image_path);
    if (dlErr || !imageBlob) throw new Error(`Téléchargement image échoué : ${dlErr?.message}`);
    const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
    imageUrn = await uploadImage(accessToken, acc.linkedin_urn, imageBytes);
  }

  const text = `${row.hook}\n\n${row.corps}\n\n${row.hashtags.map((h) => `#${h}`).join(" ")}`;
  const postUrn = await publishPost(accessToken, acc.linkedin_urn, text, imageUrn);

  await supabase
    .from("scheduled_linkedin_posts")
    .update({ status: "posted", linkedin_post_urn: postUrn, error_message: null })
    .eq("id", row.id);
}
