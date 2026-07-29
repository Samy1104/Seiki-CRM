// ============================================================
// _shared/sendGuard.ts
// Décide si un envoi (initial ou relance) doit être annulé parce
// que le lead a déjà répondu ou que sa séquence est terminée —
// pure, testable sans DB/réseau.
// ============================================================

export type SequenceStatus = "idle" | "active" | "paused" | "completed" | "replied";

export function shouldSkipSendForLeadStatus(sequenceStatus: SequenceStatus): boolean {
  return sequenceStatus === "replied" || sequenceStatus === "completed";
}
