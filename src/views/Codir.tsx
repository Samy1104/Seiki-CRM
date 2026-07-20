import React, { useState } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead } from '../services/leadsService';
import { tasksService } from '../services/tasksService';
import type { Task } from '../services/tasksService';
import { eventsService } from '../services/eventsService';
import type { EventItem } from '../services/eventsService';
import { settingsService } from '../services/settingsService';
import type { PipelineStage, SlaLimits } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { Maximize2, FileDown, Target, ShieldAlert, Award, Calendar, AlertTriangle } from 'lucide-react';
import { isSlaBreached, computeSegmentStats } from '../utils/leadMetrics';
import { useLoadOnMount } from '../hooks/useLoadOnMount';
import { withLoadingState } from '../utils/withLoadingState';
import { KpiTile } from '../components/ui/KpiTile';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

const scoreClass = (score: number) => (score >= 80 ? 'text-success' : score >= 60 ? 'text-amber' : 'text-danger');

export const Codir: React.FC = () => {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [slaLimits, setSlaLimits] = useState<SlaLimits>({ Media: 5, Retail: 7, Instit: 14 });
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadCodirData = () => withLoadingState(async () => {
    const fetchedLeads = await leadsService.getLeads();
    const fetchedTasks = await tasksService.getTasks();
    const fetchedEvents = await eventsService.getEvents();
    const fetchedStages = await settingsService.getPipelineStages();
    const limits = await settingsService.getSlaLimits();

    setLeads(fetchedLeads);
    setTasks(fetchedTasks);
    setEvents(fetchedEvents);
    setStages(fetchedStages);
    setSlaLimits(limits);
  }, {
    setLoading,
    onError: (err) => {
      console.error('Error loading CODIR data:', err);
      showToast('Erreur de chargement des rapports', 'error');
    }
  });

  useLoadOnMount(loadCodirData);

  const toggleFullscreen = () => {
    const element = document.documentElement;
    if (!isFullscreen) {
      if (element.requestFullscreen) element.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getSlaStatus = (lead: Lead) => isSlaBreached(lead, slaLimits);

  const activeLeads = leads.filter(l => !l.is_archived && l.stage?.name !== 'Gagné');
  const wonLeads = leads.filter(l => l.stage?.is_closed_won);
  const totalVal = leads.reduce((acc, l) => acc + l.deal_value, 0);
  const wonVal = wonLeads.reduce((acc, l) => acc + l.deal_value, 0);
  const hotDeals = leads.filter(l => l.score >= 80 && l.stage?.name !== 'Gagné');
  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < new Date().toISOString().slice(0, 10));
  const slaBreaches = activeLeads.filter(l => getSlaStatus(l));

  const topDeals = [...leads]
    .filter(l => !l.is_archived && l.stage?.name !== 'Gagné')
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const segmentStats = computeSegmentStats(leads);
  const totalSegmentVal = Object.values(segmentStats).reduce((acc, curr) => acc + curr.val, 0);
  const segmentOpacity: Record<'Media' | 'Retail' | 'Instit', string> = {
    Media: 'bg-amber',
    Retail: 'bg-amber/70',
    Instit: 'bg-amber/40',
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter(e => e.event_date >= todayStr).slice(0, 4);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="mt-3 text-ink-soft">Génération du Dashboard CODIR...</div>
      </div>
    );
  }

  return (
    <div className="print-section p-6">
      <div className="no-print mb-6 flex items-center justify-between">
        <div>
          <div className="font-display text-3xl font-bold text-ink">Dashboard CODIR</div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={toggleFullscreen}>
            <Maximize2 size={12} />
            {isFullscreen ? 'Quitter Plein écran' : 'Plein écran'}
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrint}>
            <FileDown size={12} />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="print-only-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#fff', fontFamily: 'Outfit' }}>SEIKI CRM — Dashboard CODIR</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>Rapport confidentiel d'activité commerciale</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>Généré le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            <div style={{ fontSize: '10px', color: '#6b7280' }}>CONFIDENTIEL</div>
          </div>
        </div>
      </div>

      <div className="codir-kpi-grid mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiTile className="codir-kpi" label="Pipeline total" value={totalVal} formatValue={(v) => `${Math.round(v)}k€`} sub={`${leads.length} opportunités`} accent="neutral" />
        <KpiTile className="codir-kpi" label="Closés Gagnés" value={wonVal} formatValue={(v) => `${Math.round(v)}k€`} sub={`${wonLeads.length} deals signés`} accent="success" />
        <KpiTile className="codir-kpi" label="Deals Chauds" value={hotDeals.length} sub="ICP score ≥ 80" accent="amber" />
        <KpiTile className="codir-kpi" label="Tâches en cours" value={pendingTasks.length} sub={`${overdueTasks.length} en retard`} accent={overdueTasks.length > 0 ? 'danger' : 'neutral'} />
        <KpiTile className="codir-kpi" label="Alertes SLA" value={slaBreaches.length} sub="Retards critiques" accent={slaBreaches.length > 0 ? 'danger' : 'neutral'} />
      </div>

      <div className="codir-two-col mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-5">
          <div className="codir-card rounded-surface border border-line bg-elevated p-5">
            <div className="codir-section-title flex items-center gap-2 text-sm font-bold text-ink">
              <Target size={14} className="text-amber" />
              Valeur du pipeline par étape
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              {stages.map(st => {
                const stageLeads = leads.filter(l => l.stage_id === st.id);
                const stageVal = stageLeads.reduce((acc, l) => acc + l.deal_value, 0);
                const pct = totalVal ? Math.round((stageVal / totalVal) * 100) : 0;

                return (
                  <div key={st.id} className="flex items-center gap-3">
                    <span className="codir-bar-label w-28 flex-shrink-0 text-xs text-ink-soft">{st.name}</span>
                    <div className="codir-bar-track h-2 flex-1 overflow-hidden rounded-full bg-hover">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: st.color }}></div>
                    </div>
                    <span className="codir-bar-val w-32 flex-shrink-0 text-right text-xs text-ink-soft">
                      {stageLeads.length} deal{stageLeads.length !== 1 ? 's' : ''} · <strong className="text-ink">{stageVal}k€</strong>
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
              {(['Media', 'Retail', 'Instit'] as const).map(seg => {
                const data = segmentStats[seg];
                const pct = totalSegmentVal ? Math.round((data.val / totalSegmentVal) * 100) : 0;

                return (
                  <div key={seg} className="flex items-center gap-3">
                    <span className="codir-bar-label w-20 flex-shrink-0 text-xs text-ink-soft">{seg}</span>
                    <div className="codir-bar-track h-2 flex-1 overflow-hidden rounded-full bg-hover">
                      <div className={`h-full rounded-full transition-all duration-700 ${segmentOpacity[seg]}`} style={{ width: `${pct}%` }}></div>
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

        <div className="flex flex-col gap-5">
          <div className="codir-card flex-1 rounded-surface border border-line bg-elevated p-5">
            <div className="codir-section-title flex items-center gap-2 text-sm font-bold text-ink">
              <Award size={14} className="text-amber" />
              Top Deals — Priorité Haute
            </div>

            <div className="mt-3 flex flex-col">
              {topDeals.length > 0 ? (
                topDeals.map(l => (
                  <div key={l.id} className="codir-top-deal flex items-center justify-between border-b border-line py-2 last:border-b-0">
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
            <div className={`codir-section-title flex items-center gap-2 text-sm font-bold ${slaBreaches.length > 0 ? 'text-danger' : 'text-ink'}`}>
              <ShieldAlert size={14} />
              Risques & Actions prioritaires
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {slaBreaches.length > 0 ? (
                slaBreaches.map(l => (
                  <div key={l.id} className="flex items-start gap-2 rounded-control border border-danger/20 bg-danger/10 px-3 py-2">
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-danger" />
                    <span className="text-xs text-ink-soft">
                      <strong className="text-ink">{l.company_name}</strong> dépasse de {l.days_in_stage - (slaLimits[l.segment] || 7)}j le SLA {l.segment}
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

      <div className="codir-card rounded-surface border border-line bg-elevated p-5">
        <div className="codir-section-title flex items-center gap-2 text-sm font-bold text-ink">
          <Calendar size={14} className="text-amber" />
          Prochains événements & Salons professionnels ciblés
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map(e => (
              <div key={e.id} className="codir-event-small-card rounded-control border border-line bg-surface p-3">
                <div className="truncate text-xs font-semibold text-ink">{e.name}</div>
                <div className="mt-1 text-[10px] text-ink-faint">
                  {new Date(e.event_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  {e.location ? ` · ${e.location}` : ''}
                </div>
                {e.segment && (
                  <Badge tone="neutral" className="mt-1.5">{e.segment}</Badge>
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

      <div className="mt-6 text-center text-[10px] text-ink-faint">
        Ce dashboard stratégique se met à jour en temps réel selon les modifications du pipeline de l'équipe commerciale.
      </div>
    </div>
  );
};
