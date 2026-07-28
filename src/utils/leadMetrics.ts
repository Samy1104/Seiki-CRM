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
