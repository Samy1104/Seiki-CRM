// ============================================================
// Edge Function : learn-linkedin-style
// Runtime : Deno (Supabase)
// Rôle : Compare un post LinkedIn généré et sa version éditée par
//        l'utilisateur, demande à Gemini d'extraire une éventuelle
//        nouvelle règle de style généralisable, et l'ajoute au
//        journal de règles apprises pour la voix concernée dans
//        app_settings.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callGemini } from "../_shared/geminiApi.ts";
import { requireUser } from "../_shared/requireUser.ts";
import { appendLearnedRule, buildExtractionPrompt, type LearnedRuleEntry } from "../_shared/learnedRules.ts";

type Voice = "seiki" | "jaafar";

interface PostShape {
  hook: string;
  corps: string;
  hashtags: string[];
}

interface LearnRequest {
  voice: Voice;
  original: PostShape;
  edited: PostShape;
}

interface ExtractionResult {
  rule: string | null;
  reason: string | null;
}

function settingsKey(voice: Voice): string {
  return `linkedin_style_learned_${voice}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY non configurée dans les secrets Supabase");
    }

    const body = (await req.json()) as LearnRequest;
    if (!body.voice || !body.original || !body.edited) {
      return new Response(
        JSON.stringify({ error: "voice, original et edited sont requis" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const voice: Voice = body.voice === "jaafar" ? "jaafar" : "seiki";
    const voiceLabel = voice === "seiki" ? "Seiki (entreprise)" : "Jaafar (personnel)";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authError = await requireUser(req, supabase, corsHeaders(req));
    if (authError) return authError;

    const { data: existingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingsKey(voice))
      .maybeSingle();
    const existingEntries = Array.isArray((existingRow?.value as { entries?: LearnedRuleEntry[] } | null)?.entries)
      ? ((existingRow!.value as { entries: LearnedRuleEntry[] }).entries)
      : [];

    const prompt = buildExtractionPrompt(voiceLabel, existingEntries, body.original, body.edited);
    const { rawText } = await callGemini(geminiKey, { userPrompt: prompt, temperature: 0.3 });

    let parsed: ExtractionResult;
    try {
      parsed = JSON.parse(rawText) as ExtractionResult;
    } catch {
      throw new Error(`JSON invalide retourné par Gemini : ${rawText.substring(0, 300)}`);
    }

    if (!parsed.rule) {
      return new Response(
        JSON.stringify({ success: true, learned: false }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const newEntry: LearnedRuleEntry = {
      rule: parsed.rule,
      reason: parsed.reason ?? "",
      learned_at: new Date().toISOString(),
    };
    const updatedEntries = appendLearnedRule(existingEntries, newEntry);
    console.log(`[learn-linkedin-style] Nouvelle règle apprise (${voice}):`, JSON.stringify(newEntry));

    const { error: upsertErr } = await supabase.from("app_settings").upsert(
      {
        key: settingsKey(voice),
        value: { entries: updatedEntries },
        label: `Règles de style LinkedIn apprises — ${voice === "seiki" ? "Seiki" : "Jaafar"}`,
        category: "contenu",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ success: true, learned: true, entry: newEntry }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[learn-linkedin-style] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
