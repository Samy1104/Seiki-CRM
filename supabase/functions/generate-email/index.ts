// ============================================================
// Edge Function : generate-email
// Runtime : Deno (Supabase)
// Rôle : Appelle Google Gemini 2.0 Flash pour générer un email
//        de prospection ultra-personnalisé à partir des données
//        d'un lead et d'une campagne.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Modèle Gemini utilisé
// gemini-2.5-flash    = meilleur rapport qualité/vitesse (recommandé)
// gemini-2.5-pro      = qualité maximale, plus lent
const GEMINI_MODEL = "gemini-2.5-flash";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GenerateRequest {
  leadId: string;
  campaignId: string;
  sequenceStepId?: string;
}

interface LeadData {
  contact_name: string;
  company_name: string;
  email: string;
  poste: string | null;
  segment: string;
  enrichi_contexte: string | null;
  note: string | null;
}

interface CampaignData {
  name: string;
  objective: string;
  tone: string;
  system_prompt: string | null;
}

interface GeminiEmailResponse {
  icebreaker: string;
  sujet: string;
  corps: string;
}

// ── Prompt Builder ─────────────────────────────────────────────────────────────

function buildSystemPrompt(campaign: CampaignData): string {
  if (campaign.system_prompt && campaign.system_prompt.trim().length > 50) {
    return campaign.system_prompt;
  }

  return `Tu es un expert en Business Development B2B spécialisé dans la vente de solutions de mobilité intelligente.
Tu rédiges des emails de prospection commerciale ultra-personnalisés, courts (5-8 lignes max), percutants et humains.

Règles absolues :
- JAMAIS de formule générique ("J'espère que ce message vous trouve bien", "Je me permets de vous contacter", etc.)
- Chaque email doit être unique et montrer une recherche réelle sur le prospect
- Le sujet doit être court (max 8 mots), intrigant, SANS emojis ni mots spam (GRATUIT, URGENT, etc.)
- L'icebreaker (1ère phrase) doit être si précis que le prospect pense "comment il sait ça ?"
- Le corps doit se terminer par UNE seule question ouverte qui invite à la réponse
- Ton : ${campaign.tone}

La proposition de valeur de Seiki :
Seiki est un éditeur de logiciels de gestion de flotte et mobilité intelligente. Nos solutions aident les entreprises à optimiser leurs déplacements professionnels, réduire leur empreinte carbone et gagner en productivité.`;
}

function buildUserPrompt(lead: LeadData, campaign: CampaignData): string {
  const contexte = lead.enrichi_contexte
    ? `\nContexte enrichi (actualités, infos récentes) :\n${lead.enrichi_contexte}`
    : "";
  const note = lead.note ? `\nNote interne : ${lead.note}` : "";
  const poste = lead.poste ? lead.poste : "poste non renseigné";

  return `Génère un email de prospection B2B pour ce prospect.

DONNÉES DU PROSPECT :
- Prénom/Nom : ${lead.contact_name}
- Poste : ${poste}
- Entreprise : ${lead.company_name}
- Segment : ${lead.segment}${contexte}${note}

OBJECTIF DE LA CAMPAGNE : ${campaign.objective}

Réponds UNIQUEMENT avec ce JSON valide (aucun texte avant ou après) :
{
  "icebreaker": "Une seule phrase d'accroche ultra-personnalisée basée sur le contexte du prospect.",
  "sujet": "Sujet d'email court et percutant (max 8 mots)",
  "corps": "Corps complet de l'email en 5-8 lignes. Commence par le prénom du contact uniquement. Inclus l'icebreaker en ouverture. Termine par une question ouverte."
}`;
}

// ── Handler principal ──────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // 1. Vérification de la clé Gemini
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY non configurée dans les secrets Supabase");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 2. Parsing de la requête
    const body = (await req.json()) as GenerateRequest;
    if (!body.leadId || !body.campaignId) {
      return new Response(
        JSON.stringify({ error: "leadId et campaignId sont requis" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // 3. Récupération des données Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [leadResult, campaignResult] = await Promise.all([
      supabase
        .from("leads")
        .select("contact_name, company_name, email, poste, segment, enrichi_contexte, note")
        .eq("id", body.leadId)
        .single(),
      supabase
        .from("campaigns")
        .select("name, objective, tone, system_prompt")
        .eq("id", body.campaignId)
        .single(),
    ]);

    if (leadResult.error) throw new Error(`Lead introuvable : ${leadResult.error.message}`);
    if (campaignResult.error) throw new Error(`Campagne introuvable : ${campaignResult.error.message}`);

    const lead = leadResult.data as LeadData;
    const campaign = campaignResult.data as CampaignData;

    // 4. Construction des prompts
    const systemPrompt = buildSystemPrompt(campaign);
    const userPrompt = buildUserPrompt(lead, campaign);

    // 5. Appel API Google Gemini
    const startMs = Date.now();
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Instruction système séparée (meilleure prise en compte par Gemini)
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      throw new Error(`Gemini API error ${geminiResponse.status}: ${errBody}`);
    }

    const geminiData = await geminiResponse.json();
    const generationMs = Date.now() - startMs;

    // 6. Extraction de la réponse Gemini
    const candidate = geminiData?.candidates?.[0];
    const finishReason = candidate?.finishReason;

    // Vérifier si la génération a été interrompue
    if (finishReason === "MAX_TOKENS") {
      throw new Error("Gemini a atteint la limite de tokens — réponse tronquée. Augmenter maxOutputTokens.");
    }

    const rawText = candidate?.content?.parts?.[0]?.text;
    if (!rawText) {
      const errDetail = JSON.stringify(geminiData?.candidates?.[0] ?? geminiData);
      throw new Error(`Gemini n'a pas retourné de contenu. Détail : ${errDetail.substring(0, 300)}`);
    }

    let emailContent: GeminiEmailResponse;
    try {
      emailContent = JSON.parse(rawText) as GeminiEmailResponse;
    } catch {
      throw new Error(`JSON invalide retourné par Gemini (finishReason=${finishReason}) : ${rawText.substring(0, 300)}`);
    }

    if (!emailContent.sujet || !emailContent.corps || !emailContent.icebreaker) {
      throw new Error("Gemini a retourné un JSON incomplet (champs manquants)");
    }

    // 7. Insertion dans generated_emails
    const { data: inserted, error: insertError } = await supabase
      .from("generated_emails")
      .insert([{
        lead_id: body.leadId,
        campaign_id: body.campaignId,
        sequence_step_id: body.sequenceStepId || null,
        sujet: emailContent.sujet,
        corps_du_mail: emailContent.corps,
        icebreaker: emailContent.icebreaker,
        statut_envoi: "draft",
        model_used: GEMINI_MODEL,
        prompt_used: userPrompt,
        generation_ms: generationMs,
      }])
      .select()
      .single();

    if (insertError) throw new Error(`Erreur insertion BDD : ${insertError.message}`);

    // 8. Réponse succès
    return new Response(
      JSON.stringify({
        success: true,
        generatedEmail: inserted,
        meta: {
          model: GEMINI_MODEL,
          generationMs,
          // Gemini expose les tokens ici (peut être null selon la version)
          tokens: geminiData?.usageMetadata ?? null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[generate-email] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
