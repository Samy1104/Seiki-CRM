import React from 'react';
import { Target, Award, ShieldAlert, AlertTriangle, Calendar } from 'lucide-react';
import type { Lead } from '../../services/leadsService';
import type { EventItem } from '../../services/eventsService';
import type { PipelineStage, SlaLimits } from '../../services/settingsService';
import { Badge } from '../../components/ui/Badge';

interface CodirDealsAndEventsProps {
  stages: PipelineStage[];
  leads: Lead[];
  totalVal: number;
  segmentStats: Record<'Media' | 'Retail' | 'Instit', { count: number; val: number }>;
  totalSegmentVal: number;
  topDeals: Lead[];
  slaBreaches: Lead[];
  slaLimits: SlaLimits;
  upcomingEvents: EventItem[];
}

const scoreClass = (score: number) =>
  score >= 80 ? 'text-success' : score >= 60 ? 'text-amber' : 'text-danger';

const segmentOpacity: Record<'Media' | 'Retail' | 'Instit', string> = {
  Media: 'bg-amber',
  Retail: 'bg-amber/70',
  Instit: 'bg-amber/40',
};

export const CodirDealsAndEvents: React.FC<CodirDealsAndEventsProps> = ({
  stages,
  leads,
  totalVal,
  segmentStats,
  totalSegmentVal,
  topDeals,
  slaBreaches,
  slaLimits,
  upcomingEvents,
}) => {
  return (
    <>
      <div className="codir-two-col mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Left Column: Stages & Segments */}
        <div className="flex flex-col gap-5">
          <div className="codir-card rounded-surface border border-line bg-elevated p-5">
            <div className="codir-section-title flex items-center gap-2 text-sm font-bold text-ink">
              <Target size={14} className="text-amber" />
              Valeur du pipeline par étape
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              {stages.map((st) => {
                const stageLeads = leads.filter((l) => l.stage_id === st.id);
                const stageVal = stageLeads.reduce((acc, l) => acc + l.deal_value, 0);
                const pct = totalVal ? Math.round((stageVal / totalVal) * 100) : 0;

                return (
                  <div key={st.id} className="flex items-center gap-3">
                    <span className="codir-bar-label w-28 flex-shrink-0 text-xs text-ink-soft">
                      {st.name}
                    </span>
                    <div className="codir-bar-track h-2 flex-1 overflow-hidden rounded-full bg-hover">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: st.color }}
                      ></div>
                    </div>
                    <span className="codir-bar-val w-32 flex-shrink-0 text-right text-xs text-ink-soft">
                      {stageLeads.length} deal{stageLeads.length !== 1 ? 's' : ''} ·{' '}
                      <strong className="text-ink">{stageVal}k€</strong>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="codir-card rounded-surface border border-line bg-elevated p-5">
            <div className="codir-section-title flex items-center gap-2 text-sm font-bold text-ink">
              <Award size={14} className="text-amber" />
              Répartition par segment
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {(['Media', 'Retail', 'Instit'] as const).map((seg) => {
                const data = segmentStats[seg];
                const pct = totalSegmentVal ? Math.round((data.val / totalSegmentVal) * 100) : 0;

                return (
                  <div key={seg} className="flex items-center gap-3">
                    <span className="codir-bar-label w-20 flex-shrink-0 text-xs text-ink-soft">
                      {seg}
                    </span>
                    <div className="codir-bar-track h-2 flex-1 overflow-hidden rounded-full bg-hover">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${segmentOpacity[seg]}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <span className="codir-bar-val w-28 flex-shrink-0 text-right text-xs text-ink-soft">
                      {pct}% · <strong className="text-ink">{data.val}k€</strong>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Top Deals & SLA Risks */}
        <div className="flex flex-col gap-5">
          <div className="codir-card flex-1 rounded-surface border border-line bg-elevated p-5">
            <div className="codir-section-title flex items-center gap-2 text-sm font-bold text-ink">
              <Award size={14} className="text-amber" />
              Top Deals — Priorité Haute
            </div>

            <div className="mt-3 flex flex-col">
              {topDeals.length > 0 ? (
                topDeals.map((l) => (
                  <div
                    key={l.id}
                    className="codir-top-deal flex items-center justify-between border-b border-line py-2 last:border-b-0"
                  >
                    <div>
                      <div className="text-[13px] font-semibold text-ink">{l.company_name}</div>
                      <div className="text-[10px] text-ink-faint">{l.contact_name}</div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Badge tone="neutral">{l.segment}</Badge>
                      <span className="text-[11px] font-medium text-ink-soft">{l.deal_value}k€</span>
                      <strong className={`text-xs ${scoreClass(l.score)}`}>{l.score}/100</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-3 text-xs text-ink-faint">Aucun deal actif</div>
              )}
            </div>
          </div>

          <div className="codir-card rounded-surface border border-line bg-elevated p-5">
            <div
              className={`codir-section-title flex items-center gap-2 text-sm font-bold ${slaBreaches.length > 0 ? 'text-danger' : 'text-ink'}`}
            >
              <ShieldAlert size={14} />
              Risques &amp; Actions prioritaires
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {slaBreaches.length > 0 ? (
                slaBreaches.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-start gap-2 rounded-control border border-danger/20 bg-danger/10 px-3 py-2"
                  >
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-danger" />
                    <span className="text-xs text-ink-soft">
                      <strong className="text-ink">{l.company_name}</strong> dépasse de{' '}
                      {l.days_in_stage - (slaLimits[l.segment] || 7)}j le SLA {l.segment}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-1.5 py-1 text-xs text-success">
                  <span>✓</span> Aucun dépassement de SLA dans le pipeline.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Events Agenda Card */}
      <div className="codir-card rounded-surface border border-line bg-elevated p-5">
        <div className="codir-section-title flex items-center gap-2 text-sm font-bold text-ink">
          <Calendar size={14} className="text-amber" />
          Prochains événements &amp; Salons professionnels ciblés
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((e) => (
              <div
                key={e.id}
                className="codir-event-small-card rounded-control border border-line bg-surface p-3"
              >
                <div className="truncate text-xs font-semibold text-ink">{e.name}</div>
                <div className="mt-1 text-[10px] text-ink-faint">
                  {new Date(e.event_date).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                  {e.location ? ` · ${e.location}` : ''}
                </div>
                {e.segment && (
                  <Badge tone="neutral" className="mt-1.5">
                    {e.segment}
                  </Badge>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-2 py-3 text-center text-xs text-ink-faint lg:col-span-4">
              Aucun salon professionnel prévu à l'agenda
            </div>
          )}
        </div>
      </div>
    </>
  );
};
