// ============================================================
// _shared/sendWindow.ts
// Fenêtre horaire d'envoi (jours ouvrés + heures de bureau) et
// répartition aléatoire (stratifiée) des créneaux d'envoi du jour
// — évite un motif détectable de bot qui enverrait tout d'un coup.
// Zéro import Deno — pur, testable avec Vitest.
// ============================================================

export interface SendWindow {
  days: number[]; // Date.getDay() convention: 0 = dimanche ... 6 = samedi
  start: string;  // "HH:MM"
  end: string;    // "HH:MM"
}

function parseTimeOnDate(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const result = new Date(date);
  result.setHours(h, m, 0, 0);
  return result;
}

/** Bornes de la fenêtre d'envoi restante pour aujourd'hui, ou null si hors fenêtre (mauvais jour, ou fenêtre déjà terminée). */
export function getTodaysWindowBounds(now: Date, window: SendWindow): { start: Date; end: Date } | null {
  if (!window.days.includes(now.getDay())) return null;

  const windowStart = parseTimeOnDate(now, window.start);
  const windowEnd = parseTimeOnDate(now, window.end);

  if (now >= windowEnd) return null;

  const effectiveStart = now > windowStart ? now : windowStart;
  if (effectiveStart >= windowEnd) return null;

  return { start: effectiveStart, end: windowEnd };
}

/**
 * Répartit `count` créneaux entre start et end par échantillonnage stratifié :
 * la fenêtre est divisée en `count` tranches égales, un point aléatoire est
 * choisi dans chacune — garantit un espacement minimal sans motif régulier.
 */
export function pickRandomSendTimes(count: number, start: Date, end: Date, rng: () => number = Math.random): Date[] {
  if (count <= 0) return [];
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return [];

  const slotMs = totalMs / count;
  const times: Date[] = [];
  for (let i = 0; i < count; i++) {
    const slotStart = start.getTime() + i * slotMs;
    times.push(new Date(slotStart + rng() * slotMs));
  }
  return times;
}
