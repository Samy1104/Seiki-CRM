// ============================================================
// _shared/replySentimentClassifier.ts
// Classification IA (Gemini) du sentiment d'une réponse de
// prospect : positive / negative / neutral. Prompt et parsing
// sont purs et testables séparément de l'appel réseau Gemini.
// ============================================================

import { callGemini } from "./geminiApi.ts";

export type ReplySentiment = "positive" | "negative" | "neutral";

export interface SentimentResult {
  sentiment: ReplySentiment;
  reason: string;
}

const VALID_SENTIMENTS: ReplySentiment[] = ["positive", "negative", "neutral"];
const MAX_REPLY_CHARS = 4000;

export function buildSentimentPrompt(replyText: string, originalSubject: string): { system: string; user: string } {
  const truncated = replyText.length > MAX_REPLY_CHARS ? replyText.slice(0, MAX_REPLY_CHARS) : replyText;

  const system = `Tu analyses les réponses reçues par un commercial suite à un email de prospection B2B.
Classe la réponse du prospect en UNE seule catégorie :
- "positive" : le prospect est intéressé, veut continuer l'échange, pose des questions sur l'offre, propose un rendez-vous.
- "negative" : le prospect n'est pas intéressé, demande d'arrêter d'être contacté, se désabonne, ou répond de façon hostile.
- "neutral" : réponse ambiguë, réponse automatique (absence du bureau, hors-sujet), ou tout cas nécessitant un jugement humain.
En cas de doute, choisis TOUJOURS "neutral" plutôt que de deviner.

Réponds UNIQUEMENT avec ce JSON valide (aucun texte avant ou après) :
{"sentiment": "positive" | "negative" | "neutral", "reason": "une phrase courte justifiant le choix"}`;

  const user = `Sujet original de l'email envoyé : ${originalSubject}

Réponse reçue du prospect :
"""
${truncated}
"""`;

  return { system, user };
}

export function parseSentimentResponse(rawText: string): SentimentResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`JSON invalide retourné par Gemini pour la classification de sentiment : ${rawText.substring(0, 300)}`);
  }

  const candidate = parsed as Partial<SentimentResult>;
  if (!candidate.sentiment || !VALID_SENTIMENTS.includes(candidate.sentiment as ReplySentiment)) {
    throw new Error(`Sentiment invalide retourné par Gemini : ${JSON.stringify(parsed).substring(0, 300)}`);
  }
  if (typeof candidate.reason !== "string" || !candidate.reason) {
    throw new Error(`Raison manquante dans la réponse Gemini : ${JSON.stringify(parsed).substring(0, 300)}`);
  }

  return { sentiment: candidate.sentiment as ReplySentiment, reason: candidate.reason };
}

export async function classifyReplySentiment(
  geminiKey: string,
  replyText: string,
  originalSubject: string,
): Promise<SentimentResult> {
  const { system, user } = buildSentimentPrompt(replyText, originalSubject);
  const { rawText } = await callGemini(geminiKey, { systemPrompt: system, userPrompt: user, temperature: 0.2 });
  return parseSentimentResponse(rawText);
}
