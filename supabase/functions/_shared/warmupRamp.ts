// ============================================================
// _shared/warmupRamp.ts
// Calcule le plafond d'envoi du jour selon une courbe de warm-up
// (protège un compte Gmail personnel neuf en prospection à froid
// d'une montée en volume trop brutale). Zéro import Deno — pur,
// testable avec Vitest.
// ============================================================

export interface RampStep {
  afterDays: number;
  cap: number;
}

// Semaine 1 : 5/jour, semaine 2 : 10/jour, semaine 3 : 20/jour,
// semaine 4+ : 35/jour (plafonné ensuite par la cible configurée).
export const DEFAULT_RAMP: RampStep[] = [
  { afterDays: 0, cap: 5 },
  { afterDays: 7, cap: 10 },
  { afterDays: 14, cap: 20 },
  { afterDays: 21, cap: 35 },
];

export function computeDailyCap(
  warmupStartDate: string,
  now: Date,
  targetCap: number,
  ramp: RampStep[] = DEFAULT_RAMP,
): number {
  const start = new Date(`${warmupStartDate}T00:00:00Z`);
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / 86_400_000);

  if (daysSinceStart < 0) return 0;

  let cap = ramp[0].cap;
  for (const step of ramp) {
    if (daysSinceStart >= step.afterDays) cap = step.cap;
  }

  return Math.min(cap, targetCap);
}
