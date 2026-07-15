// ============================================================
// Edge Function : learn-linkedin-style
// Runtime : Deno (Supabase)
// Rôle : Compare un post LinkedIn généré et sa version éditée par
//        l'utilisateur, demande à Gemini de mettre à jour le jeu
//        de règles de style appris pour la voix concernée, et
//        persiste le résultat dans app_settings.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_MODEL = "gemini-2.5-flash";

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

function settingsKey(voice: Voice): string {
  return `linkedin_style_learned_${voice}`;
}

function formatPost(post: PostShape): string {
  return `Hook: ${post.hook}\nCorps: ${post.corps}\nHashtags: ${post.hashtags.map((h) => `#${h}`).join(" ")}`;
}

function buildPrompt(voice: Voice, currentRules: string | null, original: PostShape, edited: PostShape): string {
  const voiceLabel = voice === "seiki" ? "Seiki (entreprise)" : "Jaafar (personnel)";
  return `Tu maintiens un jeu de règles de style pour la voix "${voiceLabel}" d'un générateur de posts LinkedIn.

RÈGLES ACTUELLES :
${currentRules && currentRules.trim().length > 0 ? currentRules : "(aucune règle apprise pour le moment)"}

Un utilisateur a édité un post généré par l'IA. Compare la version originale et la version éditée pour comprendre ce que l'utilisateur a corrigé (longueur, ton, structure, emojis, formulations à éviter, etc.).

VERSION ORIGINALE (générée par l'IA) :
${formatPost(original)}

VERSION ÉDITÉE (par l'utilisateur) :
${formatPost(edited)}

Mets à jour le jeu de règles : intègre les nouvelles observations pertinentes, fusionne ou remplace les règles existantes en cas de doublon ou de contradiction, et supprime celles qui ne sont plus utiles. Le résultat doit rester un jeu de règles concis et cohérent (pas un journal d'événements). Si la modification ne révèle aucune préférence de style généralisable (ex: simple correction de faute de frappe, changement de fait spécifique au brief), renvoie les règles actuelles inchangées.

Réponds UNIQUEMENT avec ce JSON valide (aucun texte avant ou après) :
{
  "rules": "Le jeu de règles complet et mis à jour, sous forme de liste à puces texte."
}`;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existing } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingsKey(voice))
      .maybeSingle();
    const currentRules = (existing?.value as { rules?: string } | null)?.rules ?? null;

    const prompt = buildPrompt(voice, currentRules, body.original, body.edited);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      throw new Error(`Gemini API error ${geminiResponse.status}: ${errBody}`);
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Gemini n'a pas retourné de contenu.");
    }

    let parsed: { rules: string };
    try {
      parsed = JSON.parse(rawText) as { rules: string };
    } catch {
      throw new Error(`JSON invalide retourné par Gemini : ${rawText.substring(0, 300)}`);
    }
    if (!parsed.rules) {
      throw new Error("Gemini a retourné un JSON incomplet (champ rules manquant)");
    }

    const { error: upsertErr } = await supabase.from("app_settings").upsert(
      {
        key: settingsKey(voice),
        value: { rules: parsed.rules },
        label: `Règles de style LinkedIn apprises — ${voice === "seiki" ? "Seiki" : "Jaafar"}`,
        category: "contenu",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ success: true, rules: parsed.rules }),
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
