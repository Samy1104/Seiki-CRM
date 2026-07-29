// ============================================================
// _shared/replyStageResolver.ts
// Décide vers quelle étape de pipeline déplacer un lead suite à
// la classification IA d'une réponse — pure, testable sans DB.
// ============================================================

import type { ReplySentiment } from "./replySentimentClassifier.ts";

export interface ReplyStageSettings {
  positiveStageId: string | null;
  negativeStageId: string | null;
}

export function resolveStageIdForSentiment(
  sentiment: ReplySentiment,
  settings: ReplyStageSettings,
): string | null {
  if (sentiment === "positive") return settings.positiveStageId;
  if (sentiment === "negative") return settings.negativeStageId;
  return null;
}
