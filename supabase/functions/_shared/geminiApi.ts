// ============================================================
// _shared/geminiApi.ts
// Appel Google Gemini partagé par generate-linkedin-post et
// learn-linkedin-style — construction du body, vérification du
// statut HTTP, et extraction du texte généré (avec gestion des
// cas MAX_TOKENS / contenu vide) au même endroit.
// ============================================================

import { fetchWithTimeout } from "./fetchWithTimeout.ts";

export const GEMINI_MODEL = "gemini-2.5-flash";

interface GeminiCallOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature: number;
}

export interface GeminiCallResult {
  rawText: string;
  generationMs: number;
  usageMetadata: unknown;
}

export async function callGemini(geminiKey: string, options: GeminiCallOptions): Promise<GeminiCallResult> {
  const startMs = Date.now();
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: options.userPrompt }] }],
    generationConfig: {
      temperature: options.temperature,
      responseMimeType: "application/json",
    },
  };
  if (options.systemPrompt) {
    body.systemInstruction = { parts: [{ text: options.systemPrompt }] };
  }

  const response = await fetchWithTimeout(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const generationMs = Date.now() - startMs;
  const candidate = data?.candidates?.[0];
  const finishReason = candidate?.finishReason;

  if (finishReason === "MAX_TOKENS") {
    throw new Error("Gemini a atteint la limite de tokens — réponse tronquée. Augmenter maxOutputTokens.");
  }

  const rawText = candidate?.content?.parts?.[0]?.text;
  if (!rawText) {
    const errDetail = JSON.stringify(candidate ?? data);
    throw new Error(`Gemini n'a pas retourné de contenu. Détail : ${errDetail.substring(0, 300)}`);
  }

  return { rawText, generationMs, usageMetadata: data?.usageMetadata ?? null };
}
