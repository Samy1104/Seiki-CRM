// ============================================================
// Edge Function : generate-linkedin-post
// Runtime : Deno (Supabase)
// Rôle : Appelle Google Gemini pour générer un post LinkedIn
//        dans le style Seiki, à partir d'un brief libre, d'une voix
//        (Seiki / Jaafar) et d'une langue (FR / EN).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { GEMINI_MODEL, callGemini } from "../_shared/geminiApi.ts";
import { requireUser } from "../_shared/requireUser.ts";
import type { VoiceProfile } from "../_shared/voices/types.ts";
import { seikiProfile } from "../_shared/voices/seiki.ts";
import { jaafarProfile } from "../_shared/voices/jaafar.ts";
import { buildSystemPrompt, buildUserPrompt, type Language } from "../_shared/promptBuilder.ts";
import { validatePost, type PostShape } from "../_shared/postValidator.ts";
import { formatLearnedRulesForPrompt, type LearnedRuleEntry } from "../_shared/learnedRules.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

type Voice = "seiki" | "jaafar";

interface GenerateRequest {
  brief: string;
  voice: Voice;
  language: Language;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function profileForVoice(voice: Voice): VoiceProfile {
  return voice === "jaafar" ? jaafarProfile : seikiProfile;
}

function learnedRulesKey(voice: Voice): string {
  return `linkedin_style_learned_${voice}`;
}

async function fetchLearnedRuleEntries(
  supabase: ReturnType<typeof createClient>,
  voice: Voice
): Promise<LearnedRuleEntry[]> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", learnedRulesKey(voice))
    .maybeSingle();
  const entries = (data?.value as { entries?: LearnedRuleEntry[] } | null)?.entries;
  return Array.isArray(entries) ? entries : [];
}

async function generateOnce(
  geminiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ post: PostShape; generationMs: number; usageMetadata: unknown }> {
  const { rawText, generationMs, usageMetadata } = await callGemini(geminiKey, {
    systemPrompt,
    userPrompt,
    temperature: 0.8,
  });

  let post: PostShape;
  try {
    post = JSON.parse(rawText) as PostShape;
  } catch {
    throw new Error(`JSON invalide retourné par Gemini : ${rawText.substring(0, 300)}`);
  }
  if (!post.hook || !post.corps || !Array.isArray(post.hashtags)) {
    throw new Error("Gemini a retourné un JSON incomplet (champs manquants)");
  }

  return { post, generationMs, usageMetadata };
}

// ── Handler principal ──────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY non configurée dans les secrets Supabase");
    }

    const body = (await req.json()) as GenerateRequest;
    if (!body.brief || !body.brief.trim()) {
      return new Response(
        JSON.stringify({ error: "brief est requis" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const voice: Voice = body.voice === "jaafar" ? "jaafar" : "seiki";
    const language: Language = body.language === "en" ? "en" : "fr";
    const profile = profileForVoice(voice);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authError = await requireUser(req, supabase, corsHeaders(req));
    if (authError) return authError;

    const learnedEntries = await fetchLearnedRuleEntries(supabase, voice);
    const systemPrompt = buildSystemPrompt(profile, language, formatLearnedRulesForPrompt(learnedEntries));

    let attempt = await generateOnce(geminiKey, systemPrompt, buildUserPrompt(body.brief));
    let validation = validatePost(attempt.post, profile);

    if (!validation.valid) {
      attempt = await generateOnce(geminiKey, systemPrompt, buildUserPrompt(body.brief, validation.violations));
      validation = validatePost(attempt.post, profile);
    }

    return new Response(
      JSON.stringify({
        success: true,
        post: attempt.post,
        validation_warnings: validation.valid ? [] : validation.violations,
        meta: {
          model: GEMINI_MODEL,
          voice,
          language,
          generationMs: attempt.generationMs,
          tokens: attempt.usageMetadata,
        },
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[generate-linkedin-post] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
