import type { Lead } from '../services/leadsService';
import type { SlaLimits } from '../services/settingsService';

/** Un lead dépasse son SLA si son temps dans l'étape courante excède le seuil de son segment. */
export function isSlaBreached(lead: Lead, slaLimits: SlaLimits): boolean {
  const maxDays = slaLimits[lead.segment] ?? 7;
  return lead.days_in_stage > maxDays;
}

export interface SegmentStat {
  count: number;
  val: number;
}

export type SegmentStats = Record<'Media' | 'Retail' | 'Instit', SegmentStat>;

/** Répartition des leads par segment (nombre + valeur totale des deals). */
export function computeSegmentStats(leads: Lead[]): SegmentStats {
  const stats: SegmentStats = {
    Media: { count: 0, val: 0 },
    Retail: { count: 0, val: 0 },
    Instit: { count: 0, val: 0 },
  };
  leads.forEach((l) => {
    if (stats[l.segment]) {
      stats[l.segment].count += 1;
      stats[l.segment].val += l.deal_value;
    }
  });
  return stats;
}

/** Format d'affichage épuré de la valeur monétaire (ex: 500 -> "500 €", 45000 -> "45 k€", 1500000 -> "1.5 M€") */
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '0 €';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${formatted} M€`;
  }
  if (abs >= 1_000) {
    const formatted = (value / 1_000).toFixed(1).replace(/\.0$/, '');
    return `${formatted} k€`;
  }
  return `${value.toLocaleString()} €`;
}
