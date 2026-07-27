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

/** Espacement moyen minimal entre deux créneaux d'une même passe de planification. */
const MIN_GAP_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Répartit `count` créneaux entre start et end par échantillonnage stratifié :
 * la fenêtre est divisée en tranches égales, un point aléatoire est choisi
 * dans chacune — garantit un espacement minimal sans motif régulier.
 *
 * Le nombre de tranches est plafonné pour respecter MIN_GAP_MS : en fin de
 * journée (ou sur un clic manuel juste avant la fermeture de la fenêtre),
 * répartir tous les envois sur les quelques minutes restantes produirait des
 * intervalles très courts et très réguliers — un motif de bot en soi. Le
 * surplus reste 'approved' et sera replanifié à la passe suivante, d'où un
 * tableau potentiellement PLUS COURT que `count` : les appelants doivent
 * itérer sur la longueur du résultat, pas sur `count`.
 */
export function pickRandomSendTimes(count: number, start: Date, end: Date, rng: () => number = Math.random): Date[] {
  if (count <= 0) return [];
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return [];

  const maxSlotsForWindow = Math.max(1, Math.floor(totalMs / MIN_GAP_MS));
  const actualCount = Math.min(count, maxSlotsForWindow);

  const slotMs = totalMs / actualCount;
  const times: Date[] = [];
  for (let i = 0; i < actualCount; i++) {
    const slotStart = start.getTime() + i * slotMs;
    times.push(new Date(slotStart + rng() * slotMs));
  }
  return times;
}
