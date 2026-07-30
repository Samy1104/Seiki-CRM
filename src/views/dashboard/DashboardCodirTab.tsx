import React from 'react';
import { Flame, ArrowUpRight, ArrowDownRight, CheckCircle, ShieldAlert } from 'lucide-react';
import type { Lead, LeadHistoryItem } from '../../services/leadsService';
import type { DashboardTargets, SlaLimits } from '../../services/settingsService';
import { computeDelta, type DeltaResult } from '../../utils/dashboardCalculations';

export interface DashboardCodirTabProps {
  leadsA: Lead[];
  leadsB: Lead[];
  targets: DashboardTargets;
  historyA: LeadHistoryItem[];
  historyB: LeadHistoryItem[];
  slaLimits?: SlaLimits;
}

// Inverse logic for SLA/negative metrics if needed, but standard DeltaBadge works great for growth
const MetricDeltaBadge: React.FC<{ delta: DeltaResult; higherIsBetter?: boolean }> = ({ delta, higherIsBetter = true }) => {
  const isPositive = delta.percent > 0;
  const isNegative = delta.percent < 0;

  if (isPositive) {
    const colorClass = higherIsBetter 
      ? 'bg-[#D4C4A8]/10 text-[#D4C4A8] border-[#D4C4A8]/30' 
      : 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    return (
      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${colorClass}`}>
        <ArrowUpRight className="w-3 h-3" />
        +{delta.percent}%
      </span>
    );
  }

  if (isNegative) {
    const colorClass = higherIsBetter 
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    return (
      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${colorClass}`}>
        <ArrowDownRight className="w-3 h-3" />
        {delta.percent}%
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#1e1e1e] text-ink-soft border border-line">
      0%
    </span>
  );
};

export const DashboardCodirTab: React.FC<DashboardCodirTabProps> = ({
  leadsA,
  leadsB,
  targets,
  historyA,
  historyB,
  slaLimits = { Media: 7, Retail: 14, Instit: 21 },
}) => {
  const isWon = (l: Lead) =>
    l.stage?.is_closed_won || l.stage_id === 'won' || l.stage_id === 'closed_won';

  const isLost = (l: Lead) =>
    l.stage?.is_closed_lost || l.stage_id === 'lost' || l.stage_id === 'closed_lost';

  // 1. CA Calculations
  const caA = leadsA.filter(isWon).reduce((sum, l) => sum + (l.deal_value || 0), 0);
  const caB = leadsB.filter(isWon).reduce((sum, l) => sum + (l.deal_value || 0), 0);
  const caDelta = computeDelta(caA, caB);
  const caProgress = Math.min(100, Math.round((caA / (targets.target_ca || 1)) * 100));

  // 2. Leads Count Calculations
  const leadsCountA = leadsA.length;
  const leadsCountB = leadsB.length;
  const leadsDelta = computeDelta(leadsCountA, leadsCountB);
  const leadsProgress = Math.min(100, Math.round((leadsCountA / (targets.target_leads_count || 1)) * 100));

  // 3. Win Rate Calculations
  const winRateA = leadsCountA > 0 ? Math.round((leadsA.filter(isWon).length / leadsCountA) * 100) : 0;
  const winRateB = leadsCountB > 0 ? Math.round((leadsB.filter(isWon).length / leadsCountB) * 100) : 0;
  const winRateDelta = computeDelta(winRateA, winRateB);
  const winRateProgress = Math.min(100, Math.round((winRateA / (targets.target_win_rate || 1)) * 100));

  // 4. Positive Prospection Responses Calculations
  const posA = historyA.filter(
    (h) => h.action_type === 'positive_reply' || h.metadata?.sentiment === 'positive' || h.action_type === 'prospection_positive'
  ).length;
  const posB = historyB.filter(
    (h) => h.action_type === 'positive_reply' || h.metadata?.sentiment === 'positive' || h.action_type === 'prospection_positive'
  ).length;
  const posDelta = computeDelta(posA, posB);
  const posProgress = Math.min(100, Math.round((posA / (targets.target_prospection_positive || 1)) * 100));

  // 5. Hot Deals List (Top 5 active leads by deal_value)
  const hotDeals = [...leadsA]
    .filter((l) => !l.is_archived && !isLost(l))
    .sort((a, b) => (b.deal_value || 0) - (a.deal_value || 0))
    .slice(0, 5);

  // 6. SLA Alert Breaches
  const slaBreaches = leadsA.filter((l) => {
    if (l.is_archived || isWon(l) || isLost(l)) return false;
    const limit = (slaLimits as unknown as Record<string, number>)?.[l.segment] || 14;
    return (l.days_in_stage || 0) > limit;
  });

  return (
    <div className="space-y-6">
      {/* Target vs Actual Progress Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: CA Signé */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">Chiffre d'Affaires Signé</span>
            <MetricDeltaBadge delta={caDelta} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {caA.toLocaleString('fr-FR')} €
            </div>
            <div className="text-xs text-ink-soft mt-0.5">
              Cible: <span className="text-[#D4C4A8] font-semibold">{targets.target_ca.toLocaleString('fr-FR')} €</span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] text-ink-soft">
              <span>Progression</span>
              <span className="font-bold text-[#D4C4A8]">{caProgress}%</span>
            </div>
            <div className="w-full bg-[#1e1e1e] h-2 rounded-full overflow-hidden border border-line/40">
              <div
                className="bg-gradient-to-r from-[#c8b89a] to-[#D4C4A8] h-full rounded-full transition-all duration-500"
                style={{ width: `${caProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Leads Qualifiés */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">Volume Leads Qualifiés</span>
            <MetricDeltaBadge delta={leadsDelta} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {leadsCountA} <span className="text-sm font-normal text-ink-soft">leads</span>
            </div>
            <div className="text-xs text-ink-soft mt-0.5">
              Cible: <span className="text-[#D4C4A8] font-semibold">{targets.target_leads_count} leads</span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] text-ink-soft">
              <span>Objectif atteint</span>
              <span className="font-bold text-[#D4C4A8]">{leadsProgress}%</span>
            </div>
            <div className="w-full bg-[#1e1e1e] h-2 rounded-full overflow-hidden border border-line/40">
              <div
                className="bg-gradient-to-r from-[#c8b89a] to-[#D4C4A8] h-full rounded-full transition-all duration-500"
                style={{ width: `${leadsProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Win Rate */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">Taux de Conversion (Win Rate)</span>
            <MetricDeltaBadge delta={winRateDelta} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {winRateA}%
            </div>
            <div className="text-xs text-ink-soft mt-0.5">
              Cible: <span className="text-[#D4C4A8] font-semibold">{targets.target_win_rate}%</span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] text-ink-soft">
              <span>Ratio de succès</span>
              <span className="font-bold text-[#D4C4A8]">{winRateProgress}%</span>
            </div>
            <div className="w-full bg-[#1e1e1e] h-2 rounded-full overflow-hidden border border-line/40">
              <div
                className="bg-gradient-to-r from-[#c8b89a] to-[#D4C4A8] h-full rounded-full transition-all duration-500"
                style={{ width: `${winRateProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Réponses Positives Prospection */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">Réponses Positives Prospection</span>
            <MetricDeltaBadge delta={posDelta} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {posA} <span className="text-sm font-normal text-ink-soft">réponses</span>
            </div>
            <div className="text-xs text-ink-soft mt-0.5">
              Cible: <span className="text-[#D4C4A8] font-semibold">{targets.target_prospection_positive} rps</span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] text-ink-soft">
              <span>Prospection</span>
              <span className="font-bold text-[#D4C4A8]">{posProgress}%</span>
            </div>
            <div className="w-full bg-[#1e1e1e] h-2 rounded-full overflow-hidden border border-line/40">
              <div
                className="bg-gradient-to-r from-[#c8b89a] to-[#D4C4A8] h-full rounded-full transition-all duration-500"
                style={{ width: `${posProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Hot Deals & SLA Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hot Deals Card */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#D4C4A8]/10 text-[#D4C4A8] rounded-xl border border-[#D4C4A8]/20">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">Hot Deals (Top 5 Opportunités)</h3>
                <p className="text-[11px] text-ink-soft">Leads actifs avec la plus haute valeur financière</p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 bg-[#1e1e1e] border border-line rounded-md text-[#D4C4A8]">
              {hotDeals.length} opportunités
            </span>
          </div>

          {hotDeals.length === 0 ? (
            <div className="text-center py-8 text-xs text-ink-faint italic bg-[#1e1e1e]/40 rounded-xl border border-line/40">
              Aucun Hot Deal identifié sur la période active.
            </div>
          ) : (
            <div className="space-y-2.5">
              {hotDeals.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 bg-[#1e1e1e] border border-line/80 rounded-xl hover:border-[#D4C4A8]/50 transition-all group"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#f2ede4] group-hover:text-[#D4C4A8] transition-colors">
                        {lead.company_name}
                      </span>
                      <span className="text-[10px] px-2 py-0.2 rounded bg-[#141414] border border-line text-ink-soft">
                        {lead.segment}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-soft flex items-center gap-2">
                      <span>{lead.contact_name}</span>
                      <span>•</span>
                      <span className="text-[#D4C4A8] font-medium">
                        Étape: {lead.stage?.name || 'Inconnue'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-extrabold text-[#D4C4A8]">
                      {(lead.deal_value || 0).toLocaleString('fr-FR')} €
                    </div>
                    <div className="text-[10px] text-ink-soft">
                      Score: <span className="font-bold text-[#f2ede4]">{lead.score || 0}/100</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SLA Alert Breaches Card */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">Alertes Dépassement SLA</h3>
                <p className="text-[11px] text-ink-soft">Leads stagnants dans une étape au-delà de la limite tolérée</p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-md text-rose-400 font-bold">
              {slaBreaches.length} alertes
            </span>
          </div>

          {slaBreaches.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-emerald-400 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
              <CheckCircle className="w-4 h-4" />
              <span>Aucun dépassement de SLA détecté sur cette période !</span>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {slaBreaches.map((lead) => {
                const limit = (slaLimits as unknown as Record<string, number>)?.[lead.segment] || 14;
                const breachDays = (lead.days_in_stage || 0) - limit;

                return (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 bg-[#1e1e1e] border border-rose-500/30 rounded-xl hover:border-rose-500/60 transition-all"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#f2ede4]">{lead.company_name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-medium">
                          {lead.segment}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-soft flex items-center gap-2">
                        <span>Étape: {lead.stage?.name || 'Inconnue'}</span>
                        {lead.owner && (
                          <>
                            <span>•</span>
                            <span className="text-zinc-300">Resp: {lead.owner.full_name || lead.owner.initials}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-rose-400">
                        {lead.days_in_stage} jours en étape
                      </div>
                      <div className="text-[10px] text-rose-300/80 font-mono">
                        (+{breachDays}j vs limite {limit}j)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
