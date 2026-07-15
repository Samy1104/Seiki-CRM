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

// Réutilise la même clé/modèle que generate-email
const GEMINI_MODEL = "gemini-2.5-flash";

// ── Types ─────────────────────────────────────────────────────────────────────

type Voice = "seiki" | "jaafar";
type Language = "fr" | "en";

interface GenerateRequest {
  brief: string;
  voice: Voice;
  language: Language;
}

interface LinkedInPostResponse {
  hook: string;
  corps: string;
  hashtags: string[];
}

// ── Corpus de style (fourni par l'utilisateur) ──────────────────────────────────

const SEIKI_BIO = `Seiki invents The Mobility Intelligence.

We designed powerful technologies & algorithms to reveal the true potential of population flows data.

For Brand Touchpoints & Advertisers, we dive into audiences and clusters mobility data to improve the impact on your target. We created a recognized MOOH ( Mobile Out of Home ) Audience Measurement methodology to assess the impact of a campaign before ( prediction ), during ( monitoring ) and after ( reporting ) it happens.

For companies in Retail & Real Estate we understand consumers on the move to optimize networks expansion.

For Institutions, we forecast population mouvements to design smart cities, predict and report congestion rates, draw mobility profiles...

Seiki unleashes the power of mobility intelligence, providing mouvement data that make sense.`;

const SEIKI_VOICE_EXAMPLES = `--- Exemple 1 ---
🚶‍♂️🚴 Mesurer la mobilité pour mieux aménager la ville.

Nous sommes fiers d'accompagner la Ville de Neuilly-sur-Seine dans la mesure et l'analyse des flux piétons et cyclistes sur le Pont de Neuilly.

Grâce à notre technologie de Mobility Intelligence, Seiki fournit une vision objective et continue des usages de cet axe stratégique, avec des indicateurs tels que :

📊 Volume de fréquentation sur 24 heures, à la semaine, au mois et à l'année
📈 Analyse comparative avant / après travaux pour mesurer l'impact réel des aménagements
🧭 Étude des provenances et destinations des usagers afin de mieux comprendre les flux de mobilité

Ces analyses permettent aux collectivités de prendre des décisions fondées sur la donnée, d'évaluer l'efficacité des investissements publics et d'accompagner le développement de mobilités plus durables.

Un grand merci à la Ville de Neuilly-sur-Seine pour sa confiance.

#Seiki #MobilityIntelligence #SmartCity #Mobilité #MobilitéDouce #Urbanisme #Data #Cyclistes #Piétons #NeuillySurSeine #Innovation

--- Exemple 2 ---
🇲🇨 Depuis maintenant 2 ans, Seiki est fier d'accompagner le Gouvernement Princier de Monaco en tant que partenaire Data Mobility.

📊 Nous révélons les déplacements des populations entrant et sortant de la Principauté, touristes inclus, afin de mieux comprendre les dynamiques réelles du territoire.

Grâce à la Mobility Intelligence, nous sommes en mesure de :

Analyser les flux touristiques internationaux
📍 Comprendre l'attractivité des différents quartiers et points d'intérêt
🕒 Mesurer les pics de fréquentation sur les 24 heures, les 7 jours et les 52 semaines de l'année
🌍 Identifier les provenances géographiques et profils sociodémographiques des visiteurs
🚶 Mesurer les temps de présence et les comportements de mobilité
🏨 Caractériser les typologies de séjour et les parcours au sein de la Principauté

Notre ambition : transformer les données de mobilité en indicateurs stratégiques au service du tourisme, des événements, de l'aménagement du territoire et du développement économique.

📡 Révéler les flux.
📈 Comprendre l'attractivité.
🎯 Éclairer la décision.

#Monaco #MobilityIntelligence #Data #TourismAnalytics #SmartCity #MobilityData #Tourisme #Innovation #Seiki`;

const JAAFAR_VOICE_EXAMPLES = `--- Exemple 1 ---
📍 Le Wagon Paris 11 📅 2 juin – 18h30
Le 2 juin prochain, nous explorerons un sujet aussi passionnant qu'essentiel : quelles opportunités et quels défis l'IA soulève-t-elle en matière d'inclusivité ?

J'aurai le plaisir d'échanger aux côtés de :
• Angela Naser (WOMEN IN TECH ® Global - Women in Tech® France)
• Zena El Kurdi (AXA)

Une soirée qui s'annonce riche en discussions, retours d'expérience et rencontres autour d'un sujet qui nous concerne toutes et tous 🙌

🔗 Inscription : [lien]

Seiki - The Mobility Intelligence Company

--- Exemple 2 ---
🚀 Seiki au cœur de l'IA, des transformations business & du leadership

Ravi d'avoir participé au Forum « Leadership & Business Transformation » organisé par l'ESCP et L'Express — un concentré de visions stratégiques, d'expériences terrain et de réflexions sur le rôle du leader à l'ère de l'IA.

🎤 Des échanges de haut niveau avec plusieurs intervenants du secteur.

🙏 Merci à l'organisateur pour son invitation.

💡 Un constat clair : dans un monde où l'algorithme gagne en puissance, le leadership humain devient plus stratégique que jamais — vision, engagement et capacité à transformer restent les véritables leviers.

Chez Seiki, nous sommes convaincus que la donnée et la mobilité ne remplacent pas le leader — elles l'augmentent.

#Leadership #Transformation #AI #MobilityIntelligence #Seiki #ESCP #Innovation

--- Exemple 3 ---
Casablanca, see you on April 5th 🇲🇦

I'll be speaking at the Sohaara Event during the Founders Keynote 🎤 will be talking about Seiki's growth 🚀

Always a special energy when builders, founders, and ideas come together in one place ⚡ many thanks to the organizer for this amazing project! You are a true inspiration 🙏🇲🇦

Excited to share, learn, and connect 🌍

If you're around, come say hi 🤝

#Founders #Casablanca #AI #Networking`;

const STYLE_RULES = `Règles de style observées dans le corpus Seiki (à respecter) :
- Ligne d'accroche courte, portée par un ou deux emojis pertinents (pas décoratifs).
- Corps du texte : soit une liste à puces avec emojis pour les posts data/client (chiffres, indicateurs), soit un texte narratif fluide pour les posts événementiels/personnels.
- N'invente JAMAIS de noms de personnes, clients ou partenaires qui ne sont pas explicitement mentionnés dans le brief fourni par l'utilisateur.
- Ton Seiki : fier, factuel, orienté impact business et données concrètes. Ton Jaafar : personnel, enthousiaste, direct, à la première personne.
- Clôture optionnelle : 2-3 lignes courtes et percutantes façon tagline (uniquement si ça correspond au sujet).
- Bloc hashtags : 5 à 10 tags, mélange de marque (#Seiki #MobilityIntelligence) et de tags thématiques liés au brief. Jamais de mots spam (GRATUIT, URGENT).
- Pas de formules génériques creuses ("Nous sommes ravis de vous annoncer que...", "N'hésitez pas à nous contacter").`;

function learnedRulesKey(voice: Voice): string {
  return `linkedin_style_learned_${voice}`;
}

async function fetchLearnedRules(
  supabase: ReturnType<typeof createClient>,
  voice: Voice
): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", learnedRulesKey(voice))
    .maybeSingle();
  const rules = (data?.value as { rules?: string } | null)?.rules;
  return rules && rules.trim().length > 0 ? rules : null;
}

function buildSystemPrompt(voice: Voice, language: Language, learnedRules: string | null): string {
  const voiceExamples = voice === "seiki" ? SEIKI_VOICE_EXAMPLES : JAAFAR_VOICE_EXAMPLES;
  const voiceLabel = voice === "seiki"
    ? "la voix de l'entreprise Seiki (\"nous\", \"Seiki est fier de...\")"
    : "la voix personnelle de Jaafar, co-fondateur de Seiki (\"je\", première personne)";
  const languageInstruction = language === "fr"
    ? "Rédige le post en français."
    : "Write the post in English.";
  const learnedRulesBlock = learnedRules
    ? `\n\nRègles apprises des retours utilisateur (priment sur les règles génériques ci-dessus en cas de conflit) :\n${learnedRules}`
    : "";

  return `Tu es l'agent de rédaction LinkedIn de Seiki, une entreprise de Mobility Intelligence.

BIO DU COMPTE :
${SEIKI_BIO}

Tu dois écrire dans ${voiceLabel}.

EXEMPLES DE POSTS DANS CETTE VOIX :
${voiceExamples}

${STYLE_RULES}${learnedRulesBlock}

${languageInstruction}`;
}

function buildUserPrompt(brief: string): string {
  return `Génère un post LinkedIn à partir du brief suivant :

${brief}

Réponds UNIQUEMENT avec ce JSON valide (aucun texte avant ou après) :
{
  "hook": "Ligne d'accroche courte avec emoji(s).",
  "corps": "Corps complet du post, incluant clôture si pertinent et sauts de ligne (\\n).",
  "hashtags": ["hashtag1", "hashtag2"]
}`;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const learnedRules = await fetchLearnedRules(supabase, voice);

    const systemPrompt = buildSystemPrompt(voice, language, learnedRules);
    const userPrompt = buildUserPrompt(body.brief);

    const startMs = Date.now();
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

    const candidate = geminiData?.candidates?.[0];
    const finishReason = candidate?.finishReason;

    if (finishReason === "MAX_TOKENS") {
      throw new Error("Gemini a atteint la limite de tokens — réponse tronquée. Augmenter maxOutputTokens.");
    }

    const rawText = candidate?.content?.parts?.[0]?.text;
    if (!rawText) {
      const errDetail = JSON.stringify(geminiData?.candidates?.[0] ?? geminiData);
      throw new Error(`Gemini n'a pas retourné de contenu. Détail : ${errDetail.substring(0, 300)}`);
    }

    let post: LinkedInPostResponse;
    try {
      post = JSON.parse(rawText) as LinkedInPostResponse;
    } catch {
      throw new Error(`JSON invalide retourné par Gemini (finishReason=${finishReason}) : ${rawText.substring(0, 300)}`);
    }

    if (!post.hook || !post.corps || !Array.isArray(post.hashtags)) {
      throw new Error("Gemini a retourné un JSON incomplet (champs manquants)");
    }

    return new Response(
      JSON.stringify({
        success: true,
        post,
        meta: {
          model: GEMINI_MODEL,
          voice,
          language,
          generationMs,
          tokens: geminiData?.usageMetadata ?? null,
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
