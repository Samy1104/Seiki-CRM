import React, { useEffect, useState } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead } from '../services/leadsService';
import { tasksService } from '../services/tasksService';
import type { Task } from '../services/tasksService';
import { eventsService } from '../services/eventsService';
import type { EventItem } from '../services/eventsService';
import { settingsService } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { Maximize2, FileDown, Target, ShieldAlert, Award, Calendar, AlertTriangle } from 'lucide-react';

export const Codir: React.FC = () => {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [slaLimits, setSlaLimits] = useState<Record<string, number>>({ Media: 5, Retail: 7, Instit: 14 });
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadCodirData = async () => {
    try {
      const fetchedLeads = await leadsService.getLeads();
      const fetchedTasks = await tasksService.getTasks();
      const fetchedEvents = await eventsService.getEvents();
      const fetchedStages = await settingsService.getPipelineStages();
      const settings = await settingsService.getSettings();

      setLeads(fetchedLeads);
      setTasks(fetchedTasks);
      setEvents(fetchedEvents);
      setStages(fetchedStages);

      // Load SLA settings
      const limits: Record<string, number> = { Media: 5, Retail: 7, Instit: 14 };
      settings.forEach(s => {
        if (s.key === 'sla_media' && s.value.days) limits.Media = s.value.days;
        if (s.key === 'sla_retail' && s.value.days) limits.Retail = s.value.days;
        if (s.key === 'sla_instit' && s.value.days) limits.Instit = s.value.days;
      });
      setSlaLimits(limits);
    } catch (err) {
      console.error('Error loading CODIR data:', err);
      showToast('Erreur de chargement des rapports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCodirData();
  }, []);

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

  // Helper SLA status checker
  const getSlaStatus = (lead: Lead) => {
    const maxDays = slaLimits[lead.segment] || 7;
    return lead.days_in_stage > maxDays;
  };

  // Calculations
  const activeLeads = leads.filter(l => !l.is_archived && l.stage?.name !== 'Gagné');
  const wonLeads = leads.filter(l => l.stage?.is_closed_won);
  const totalVal = leads.reduce((acc, l) => acc + l.deal_value, 0);
  const wonVal = wonLeads.reduce((acc, l) => acc + l.deal_value, 0);
  const hotDeals = leads.filter(l => l.score >= 80 && l.stage?.name !== 'Gagné');
  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < new Date().toISOString().slice(0, 10));
  const slaBreaches = activeLeads.filter(l => getSlaStatus(l));

  // Top Deals
  const topDeals = [...leads]
    .filter(l => !l.is_archived && l.stage?.name !== 'Gagné')
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Segment Split
  const segmentStats = {
    Media: { count: 0, val: 0 },
    Retail: { count: 0, val: 0 },
    Instit: { count: 0, val: 0 }
  };
  leads.forEach(l => {
    if (segmentStats[l.segment]) {
      segmentStats[l.segment].count += 1;
      segmentStats[l.segment].val += l.deal_value;
    }
  });

  const totalSegmentVal = Object.values(segmentStats).reduce((acc, curr) => acc + curr.val, 0);

  // Events
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter(e => e.event_date >= todayStr).slice(0, 4);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Génération du Dashboard CODIR...</div>
      </div>
    );
  }

  return (
    <div className="view-section on print-section">
      {/* Page Header */}
      <div className="page-header no-print">
        <div>
          <div className="page-title">Dashboard CODIR</div>
          <div className="page-sub">Rapport stratégique de la direction</div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-sm" onClick={toggleFullscreen}>
            <Maximize2 size={12} style={{ marginRight: '6px' }} />
            {isFullscreen ? 'Quitter Plein écran' : 'Plein écran'}
          </button>
          <button className="btn btn-sm btn-grad" onClick={handlePrint}>
            <FileDown size={12} style={{ marginRight: '6px' }} />
            Export PDF
          </button>
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

      {/* KPI Row (5 columns) */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi" style={{ borderTop: '2px solid var(--purple)' }}>
          <div className="kpi-label">Pipeline total</div>
          <div className="kpi-val">{totalVal}k€</div>
          <div className="kpi-sub">{leads.length} opportunités</div>
        </div>

        <div className="kpi" style={{ borderTop: '2px solid var(--green)' }}>
          <div className="kpi-label">Closés Gagnés</div>
          <div className="kpi-val">{wonVal}k€</div>
          <div className="kpi-sub">{wonLeads.length} deals signés</div>
        </div>

        <div className="kpi" style={{ borderTop: '2px solid var(--gold)' }}>
          <div className="kpi-label">Deals Chauds</div>
          <div className="kpi-val">{hotDeals.length}</div>
          <div className="kpi-sub">ICP score ≥ 80</div>
        </div>

        <div className="kpi" style={{ borderTop: '2px solid var(--instit)' }}>
          <div className="kpi-label">Tâches en cours</div>
          <div className="kpi-val">{pendingTasks.length}</div>
          <div className="kpi-sub" style={{ color: overdueTasks.length > 0 ? 'var(--red)' : '' }}>
            {overdueTasks.length} en retard
          </div>
        </div>

        <div className="kpi" style={{ borderTop: `2px solid ${slaBreaches.length > 0 ? 'var(--red)' : 'var(--border)'}` }}>
          <div className="kpi-label">Alertes SLA</div>
          <div className="kpi-val" style={{ color: slaBreaches.length > 0 ? 'var(--red)' : '' }}>
            {slaBreaches.length}
          </div>
          <div className="kpi-sub">Retards critiques</div>
        </div>
      </div>

      {/* Layout Grid */}
      <div className="two-col" style={{ gap: '20px', marginBottom: '20px' }}>
        {/* Left Column: Pipeline stages & Segments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: '1.2' }}>
          {/* Pipeline stages */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="form-title">
              <Target size={14} style={{ marginRight: '6px' }} />
              Valeur du pipeline par étape
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
              {stages.map(st => {
                const stageLeads = leads.filter(l => l.stage_id === st.id);
                const stageVal = stageLeads.reduce((acc, l) => acc + l.deal_value, 0);
                const pct = totalVal ? Math.round((stageVal / totalVal) * 100) : 0;

                return (
                  <div key={st.id} className="bar-row">
                    <span className="bar-label" style={{ width: '110px' }}>{st.name}</span>
                    <div className="bar-track" style={{ flex: '1' }}>
                      <div className="bar-fill" style={{ width: `${pct}%`, background: st.color }}></div>
                    </div>
                    <span className="bar-val" style={{ width: '90px', textAlign: 'right' }}>
                      {stageLeads.length} deal{stageLeads.length !== 1 ? 's' : ''} · <strong>{stageVal}k€</strong>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Segment Split */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="form-title">
              <Award size={14} style={{ marginRight: '6px' }} />
              Répartition par segment
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
              {(['Media', 'Retail', 'Instit'] as const).map(seg => {
                const data = segmentStats[seg];
                const pct = totalSegmentVal ? Math.round((data.val / totalSegmentVal) * 100) : 0;
                
                let color = 'var(--purple)';
                if (seg === 'Retail') color = 'var(--gold)';
                else if (seg === 'Instit') color = 'var(--instit-tc)';

                return (
                  <div key={seg} className="bar-row">
                    <span className="bar-label" style={{ width: '80px' }}>{seg}</span>
                    <div className="bar-track" style={{ flex: '1' }}>
                      <div className="bar-fill" style={{ width: `${pct}%`, background: color }}></div>
                    </div>
                    <span className="bar-val" style={{ width: '100px', textAlign: 'right' }}>
                      {pct}% · <strong>{data.val}k€</strong>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Top Deals & SLA Warnings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: '1' }}>
          {/* Top Deals */}
          <div className="card" style={{ padding: '20px', flex: '1' }}>
            <div className="form-title">
              <Award size={14} style={{ marginRight: '6px' }} />
              Top Deals — Priorité Haute
            </div>

            <div className="top-deals-list" style={{ marginTop: '12px' }}>
              {topDeals.length > 0 ? (
                topDeals.map(l => {
                  const scoreColor = l.score >= 80 ? 'var(--green)' : l.score >= 60 ? 'var(--gold)' : 'var(--red)';
                  return (
                    <div key={l.id} className="top-deal-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-h)', fontSize: '13px' }}>{l.company_name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{l.contact_name}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className={`badge badge-${l.segment.toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>{l.segment}</span>
                        <span style={{ fontSize: '11px', fontWeight: '500' }}>{l.deal_value}k€</span>
                        <strong style={{ color: scoreColor, fontSize: '12px' }}>{l.score}/100</strong>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '12px 0' }}>Aucun deal actif</div>
              )}
            </div>
          </div>

          {/* SLA Alerts details */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="form-title" style={{ color: slaBreaches.length > 0 ? 'var(--red)' : '' }}>
              <ShieldAlert size={14} style={{ marginRight: '6px' }} />
              Risques & Actions prioritaires
            </div>

            <div className="codir-alerts-list" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {slaBreaches.length > 0 ? (
                slaBreaches.map(l => (
                  <div key={l.id} className="codir-alert-box">
                    <AlertTriangle size={12} style={{ color: 'var(--red)', marginRight: '6px' }} />
                    <span style={{ fontSize: '12px' }}>
                      <strong>{l.company_name}</strong> dépasse de {l.days_in_stage - (slaLimits[l.segment] || 7)}j le SLA {l.segment}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--green)', fontSize: '12px', padding: '8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✓</span> Aucun dépassement de SLA dans le pipeline.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Upcoming events */}
      <div className="card" style={{ padding: '20px' }}>
        <div className="form-title">
          <Calendar size={14} style={{ marginRight: '6px' }} />
          Prochains événements & Salons professionnels ciblés
        </div>
        
        <div className="codir-events-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '12px' }}>
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map(e => (
              <div key={e.id} className="codir-event-small-card" style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-h)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{e.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {new Date(e.event_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  {e.location ? ` · ${e.location}` : ''}
                </div>
                {e.segment && (
                  <span className={`badge badge-${e.segment.toLowerCase()}`} style={{ fontSize: '8px', padding: '1px 4px', marginTop: '6px', display: 'inline-block' }}>
                    {e.segment}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div style={{ gridColumn: 'span 4', color: 'var(--text-muted)', fontSize: '12px', padding: '12px 0', textAlign: 'center' }}>
              Aucun salon professionnel prévu à l'agenda
            </div>
          )}
        </div>
      </div>

      <div className="codir-footer" style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', marginTop: '24px' }}>
        Ce dashboard stratégique se met à jour en temps réel selon les modifications du pipeline de l'équipe commerciale.
      </div>
    </div>
  );
};
