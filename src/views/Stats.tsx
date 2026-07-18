import React, { useState } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { PipelineStage } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { TrendingUp, Compass, Award } from 'lucide-react';
import { computeSegmentStats } from '../utils/leadMetrics';
import { useLoadOnMount } from '../hooks/useLoadOnMount';
import { withLoadingState } from '../utils/withLoadingState';

export const Stats: React.FC = () => {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  useLoadOnMount(() => withLoadingState(async () => {
    const fetchedLeads = await leadsService.getLeads();
    const fetchedStages = await settingsService.getPipelineStages();
    setLeads(fetchedLeads);
    setStages(fetchedStages);
  }, {
    setLoading,
    onError: (err) => {
      console.error('Error loading stats data:', err);
      showToast('Erreur de chargement des statistiques', 'error');
    }
  }));

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Calcul des statistiques...</div>
      </div>
    );
  }

  // Calculations
  const totalLeads = leads.length;
  const wonLeads = leads.filter(l => l.stage?.is_closed_won);
  const activeLeads = leads.filter(l => !l.is_archived && l.stage?.name !== 'Gagné');

  const totalVal = leads.reduce((acc, l) => acc + l.deal_value, 0);
  const wonVal = wonLeads.reduce((acc, l) => acc + l.deal_value, 0);
  const averageDealValue = totalLeads ? Math.round(totalVal / totalLeads) : 0;
  
  // Conversion Rate
  const conversionRate = totalLeads ? Math.round((wonLeads.length / totalLeads) * 100) : 0;

  // Funnel calculations
  // Counts how many leads reached each stage or beyond
  // For simplicity, we show the current snapshot of leads in each stage
  const funnelStages = stages.map(st => {
    const count = leads.filter(l => l.stage_id === st.id).length;
    const value = leads.filter(l => l.stage_id === st.id).reduce((acc, l) => acc + l.deal_value, 0);
    return {
      name: st.name,
      count,
      value,
      color: st.color
    };
  });

  const maxStageCount = Math.max(...funnelStages.map(f => f.count), 1);

  // Segment Split
  const segmentStats = computeSegmentStats(leads);

  const totalSegmentCount = Object.values(segmentStats).reduce((acc, curr) => acc + curr.count, 0);

  // Sources split
  const sourceStats: Record<string, number> = {};
  leads.forEach(l => {
    sourceStats[l.source] = (sourceStats[l.source] || 0) + 1;
  });

  return (
    <div className="view-section on">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Statistiques</div>
          <div className="page-sub">Indicateurs de performance commerciale</div>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi" style={{ borderTop: '2px solid var(--purple)' }}>
          <div className="kpi-label">Panier Moyen</div>
          <div className="kpi-val">{averageDealValue}k€</div>
          <div className="kpi-sub">Valeur moyenne de deal</div>
        </div>

        <div className="kpi" style={{ borderTop: '2px solid var(--green)' }}>
          <div className="kpi-label">Taux de conversion</div>
          <div className="kpi-val">{conversionRate}%</div>
          <div className="kpi-sub">Deals gagnés / Total</div>
        </div>

        <div className="kpi" style={{ borderTop: '2px solid var(--gold)' }}>
          <div className="kpi-label">Deals actifs</div>
          <div className="kpi-val">{activeLeads.length}</div>
          <div className="kpi-sub">Opportunités en cours</div>
        </div>

        <div className="kpi" style={{ borderTop: '2px solid var(--instit)' }}>
          <div className="kpi-label">Total Gagné</div>
          <div className="kpi-val">{wonVal}k€</div>
          <div className="kpi-sub">{wonLeads.length} contrats signés</div>
        </div>
      </div>

      <div className="two-col" style={{ gap: '20px', marginBottom: '20px' }}>
        {/* Conversion Funnel Card */}
        <div className="card" style={{ padding: '20px', flex: '1.2' }}>
          <div className="form-title">
            <TrendingUp size={14} style={{ marginRight: '6px' }} />
            Entonnoir de conversion (Funnel)
          </div>
          <div className="funnel-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {funnelStages.map(f => {
              const pct = Math.round((f.count / maxStageCount) * 100);
              return (
                <div key={f.name} className="funnel-row" style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '110px', fontSize: '12px', fontWeight: '600', color: 'var(--text-h)' }}>{f.name}</span>
                  <div style={{ flex: '1', height: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: f.color || 'var(--purple)', opacity: 0.65, transition: 'width 0.8s ease' }}></div>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', fontWeight: '700', color: '#fff' }}>
                      {f.count} deal{f.count !== 1 ? 's' : ''} ({f.value}k€)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Source acquisition split */}
        <div className="card" style={{ padding: '20px', flex: '1' }}>
          <div className="form-title">
            <Compass size={14} style={{ marginRight: '6px' }} />
            Sources d'acquisition
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            {Object.entries(sourceStats).map(([src, count]) => {
              const pct = totalLeads ? Math.round((count / totalLeads) * 100) : 0;
              return (
                <div key={src} className="bar-row">
                  <span className="bar-label" style={{ width: '110px' }}>{src}</span>
                  <div className="bar-track" style={{ flex: '1' }}>
                    <div className="bar-fill" style={{ width: `${pct}%`, background: 'var(--purple)' }}></div>
                  </div>
                  <span className="bar-val" style={{ width: '40px', textAlign: 'right' }}>{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Segment split count card */}
      <div className="card" style={{ padding: '20px' }}>
        <div className="form-title">
          <Award size={14} style={{ marginRight: '6px' }} />
          Répartition des leads par segment d'activité
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', gap: '20px', marginTop: '16px' }}>
          {(['Media', 'Retail', 'Instit'] as const).map(seg => {
            const data = segmentStats[seg];
            const pct = totalSegmentCount ? Math.round((data.count / totalSegmentCount) * 100) : 0;
            let color = 'var(--purple)';
            if (seg === 'Retail') color = 'var(--gold)';
            else if (seg === 'Instit') color = 'var(--instit-tc)';

            return (
              <div key={seg} style={{ textAlign: 'center', flex: '1', padding: '16px', background: 'rgba(255,255,255,0.01)', border: '0.5px solid var(--border)', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: color, marginBottom: '6px' }}>{seg}</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-h)' }}>{data.count}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {pct}% des leads · Valeur {data.val}k€
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
