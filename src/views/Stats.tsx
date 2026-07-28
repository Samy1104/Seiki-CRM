import React, { useState, useMemo } from 'react';
import { leadsService } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { useCachedResource } from '../hooks/useCachedResource';
import {
  filterLeadsByDateAndRep,
  computeKpiMetrics,
  generateStatsCsv,
} from '../utils/statsCalculations';
import type { DateFilterState } from '../utils/statsCalculations';
import { StatsDateFilter } from '../components/stats/StatsDateFilter';
import { StatsOverviewTab } from '../components/stats/StatsOverviewTab';
import { StatsPipelineTab } from '../components/stats/StatsPipelineTab';
import { StatsActivitiesTab } from '../components/stats/StatsActivitiesTab';
import type { Lead } from '../services/leadsService';

export const Stats: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'activities'>('overview');
  const [dateFilter, setDateFilter] = useState<DateFilterState>({ preset: 'month' });
  const [selectedRep, setSelectedRep] = useState('all');

  const onError = (err: unknown) => {
    console.error('Error loading stats data:', err);
    showToast('Erreur de chargement des statistiques', 'error');
  };

  const leadsRes = useCachedResource('leads:false', () => leadsService.getLeads(), [], { onError });
  const stagesRes = useCachedResource('pipelineStages', () => settingsService.getPipelineStages(), [], { onError });

  const leads: Lead[] = (leadsRes.data as Lead[]) || [];
  const stages = stagesRes.data || [];
  const loading = leadsRes.loading || stagesRes.loading;

  const filteredLeads = useMemo(
    () => filterLeadsByDateAndRep(leads, dateFilter, selectedRep),
    [leads, dateFilter, selectedRep]
  );

  const kpis = useMemo(() => computeKpiMetrics(filteredLeads, []), [filteredLeads]);

  const handleExportCsv = () => {
    const csvContent = generateStatsCsv(filteredLeads);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seiki_stats_${dateFilter.preset}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast('Rapport CSV téléchargé !', 'success');
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-10 w-48 bg-[#1e1e1e] animate-pulse rounded-lg" />
        <div className="h-16 w-full bg-[#1e1e1e] animate-pulse rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#1e1e1e] animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-ui">
      {/* Title Header */}
      <div className="space-y-1">
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 900,
            fontSize: '2.75rem',
            color: '#f2ede4',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
          }}
        >
          Statistiques & Performance
        </h1>
        <p className="text-xs text-ink-soft">
          Analyse globale de l'activité commerciale, des conversions et des prévisions de pipeline.
        </p>
      </div>

      {/* Global Filter Bar */}
      <StatsDateFilter
        filter={dateFilter}
        onFilterChange={setDateFilter}
        salesReps={[]}
        selectedRep={selectedRep}
        onRepChange={setSelectedRep}
        onExportCsv={handleExportCsv}
      />

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-line pb-1">
        {[
          { id: 'overview', label: "Vue d'ensemble" },
          { id: 'pipeline', label: 'Pipeline & Forecast' },
          { id: 'activities', label: 'Activité & Équipe' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all ${
              activeTab === tab.id
                ? 'bg-[#141414] text-[#D4C4A8] border-t-2 border-t-[#D4C4A8] border-x border-line'
                : 'text-ink-soft hover:text-[#f2ede4]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      {activeTab === 'overview' && (
        <StatsOverviewTab leads={filteredLeads} stages={stages} kpis={kpis} />
      )}
      {activeTab === 'pipeline' && (
        <StatsPipelineTab leads={filteredLeads} stages={stages} />
      )}
      {activeTab === 'activities' && (
        <StatsActivitiesTab leads={filteredLeads} />
      )}
    </div>
  );
};
