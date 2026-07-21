import React from 'react';
import { useCodirData } from '../hooks/useCodirData';
import { CodirHeader } from './codir/CodirHeader';
import { CodirKpiGrid } from './codir/CodirKpiGrid';
import { CodirDealsAndEvents } from './codir/CodirDealsAndEvents';

export const Codir: React.FC = () => {
  const {
    leads,
    stages,
    slaLimits,
    loading,
    isFullscreen,
    toggleFullscreen,
    handlePrint,
    wonLeads,
    totalVal,
    wonVal,
    hotDeals,
    pendingTasks,
    overdueTasks,
    slaBreaches,
    topDeals,
    segmentStats,
    totalSegmentVal,
    upcomingEvents,
  } = useCodirData();

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
      {/* Header Controls */}
      <CodirHeader
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onPrint={handlePrint}
      />

      {/* Print-only Confidential Header */}
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

      {/* Executive KPI Grid */}
      <CodirKpiGrid
        totalVal={totalVal}
        wonVal={wonVal}
        leads={leads}
        wonLeads={wonLeads}
        hotDeals={hotDeals}
        pendingTasks={pendingTasks}
        overdueTasks={overdueTasks}
        slaBreaches={slaBreaches}
      />

      {/* Pipeline Stage Bar, Segments, Top Deals, Risks, & Agenda */}
      <CodirDealsAndEvents
        stages={stages}
        leads={leads}
        totalVal={totalVal}
        segmentStats={segmentStats}
        totalSegmentVal={totalSegmentVal}
        topDeals={topDeals}
        slaBreaches={slaBreaches}
        slaLimits={slaLimits}
        upcomingEvents={upcomingEvents}
      />

      <div className="mt-6 text-center text-[10px] text-ink-faint">
        Ce dashboard stratégique se met à jour en temps réel selon les modifications du pipeline de l'équipe commerciale.
      </div>
    </div>
  );
};

export default Codir;
