import React, { useState, useEffect, useMemo } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead, LeadHistoryItem } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { PipelineStage, DashboardTargets, TeamMember, SlaLimits } from '../services/settingsService';
import { tasksService } from '../services/tasksService';
import type { Task } from '../services/tasksService';
import { prospectionService } from '../services/prospectionService';
import type { EmailLog } from '../services/prospectionService';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { generateStatsCsv } from '../utils/statsCalculations';

import { DashboardHeader } from './dashboard/DashboardHeader';
import { DashboardCodirTab } from './dashboard/DashboardCodirTab';
import { DashboardPipelineTab } from './dashboard/DashboardPipelineTab';
import { DashboardOutreachTab } from './dashboard/DashboardOutreachTab';
import { DashboardTasksTab } from './dashboard/DashboardTasksTab';

import { LayoutDashboard, GitCommit, Mail, CheckSquare } from 'lucide-react';

export type DashboardTab = 'codir' | 'pipeline' | 'outreach' | 'tasks';

const isDateInRange = (dateStr: string, startDate?: string, endDate?: string) => {
  if (!dateStr) return false;
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return false;

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
    if (time < start) return false;
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999Z`).getTime();
    if (time > end) return false;
  }
  return true;
};

export const Dashboard: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<DashboardTab>('codir');
  const [loading, setLoading] = useState(true);

  // Data states
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [history, setHistory] = useState<LeadHistoryItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [targets, setTargets] = useState<DashboardTargets>({
    target_ca: 100,
    target_leads_count: 20,
    target_win_rate: 20,
    target_prospection_positive: 10,
  });
  const [codirDates, setCodirDates] = useState<string[]>([]);
  const [slaLimits, setSlaLimits] = useState<SlaLimits | undefined>(undefined);

  // Comparison states
  const todayIso = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const sixtyDaysAgoIso = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);

  const [comparisonMode, setComparisonMode] = useState<'codir' | 'custom'>('codir');
  const [selectedCodirA, setSelectedCodirA] = useState<string>(todayIso);
  const [selectedCodirB, setSelectedCodirB] = useState<string>(thirtyDaysAgoIso);
  const [customDateA, setCustomDateA] = useState<{ start: string; end: string }>({
    start: thirtyDaysAgoIso,
    end: todayIso,
  });
  const [customDateB, setCustomDateB] = useState<{ start: string; end: string }>({
    start: sixtyDaysAgoIso,
    end: thirtyDaysAgoIso,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [
        fetchedLeads,
        fetchedStages,
        fetchedTasks,
        fetchedEmailLogs,
        fetchedMembers,
        fetchedTargets,
        fetchedCodirHistory,
        fetchedSla,
        historyRes,
      ] = await Promise.all([
        leadsService.getLeads(false),
        settingsService.getPipelineStages(),
        tasksService.getTasks(),
        prospectionService.getRecentEmailLogs(1000),
        settingsService.getTeamMembers(),
        settingsService.getDashboardTargets(),
        settingsService.getCodirHistory(),
        settingsService.getSlaLimits().catch(() => undefined),
        supabase.from('history').select('*, user:team_members!user_id(full_name, initials, color)').order('created_at', { ascending: false }),
      ]);

      setLeads(fetchedLeads);
      setStages(fetchedStages);
      setTasks(fetchedTasks);
      setEmailLogs(fetchedEmailLogs);
      setTeamMembers(fetchedMembers);
      setTargets(fetchedTargets);
      setCodirDates(fetchedCodirHistory);
      setSlaLimits(fetchedSla);
      setHistory((historyRes.data || []) as LeadHistoryItem[]);

      if (fetchedCodirHistory.length > 0) {
        setSelectedCodirA(fetchedCodirHistory[fetchedCodirHistory.length - 1]);
        if (fetchedCodirHistory.length > 1) {
          setSelectedCodirB(fetchedCodirHistory[fetchedCodirHistory.length - 2]);
        } else {
          setSelectedCodirB(fetchedCodirHistory[0]);
        }
      }
    } catch (err) {
      console.error('Erreur de chargement des données du dashboard:', err);
      showToast('Erreur lors du chargement des données du Dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered dataset for Period A & Period B
  const { leadsA, leadsB, historyA, historyB, emailLogsA, emailLogsB, startDateA, endDateA } = useMemo(() => {
    if (comparisonMode === 'codir') {
      const endA = selectedCodirA || todayIso;
      const endB = selectedCodirB || thirtyDaysAgoIso;

      return {
        leadsA: leads.filter((l) => isDateInRange(l.created_at, undefined, endA)),
        leadsB: leads.filter((l) => isDateInRange(l.created_at, undefined, endB)),
        historyA: history.filter((h) => isDateInRange(h.created_at, undefined, endA)),
        historyB: history.filter((h) => isDateInRange(h.created_at, undefined, endB)),
        emailLogsA: emailLogs.filter((e) => isDateInRange(e.sent_at || e.created_at, undefined, endA)),
        emailLogsB: emailLogs.filter((e) => isDateInRange(e.sent_at || e.created_at, undefined, endB)),
        startDateA: undefined,
        endDateA: endA,
      };
    } else {
      const { start: startA, end: endA } = customDateA;
      const { start: startB, end: endB } = customDateB;

      return {
        leadsA: leads.filter((l) => isDateInRange(l.created_at, startA, endA)),
        leadsB: leads.filter((l) => isDateInRange(l.created_at, startB, endB)),
        historyA: history.filter((h) => isDateInRange(h.created_at, startA, endA)),
        historyB: history.filter((h) => isDateInRange(h.created_at, startB, endB)),
        emailLogsA: emailLogs.filter((e) => isDateInRange(e.sent_at || e.created_at, startA, endA)),
        emailLogsB: emailLogs.filter((e) => isDateInRange(e.sent_at || e.created_at, startB, endB)),
        startDateA: startA,
        endDateA: endA,
      };
    }
  }, [comparisonMode, selectedCodirA, selectedCodirB, customDateA, customDateB, leads, history, emailLogs, todayIso, thirtyDaysAgoIso]);

  const handleExportCsv = () => {
    const csvContent = generateStatsCsv(leadsA);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seiki_dashboard_${comparisonMode}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast('Export CSV du Dashboard téléchargé !', 'success');
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-10 w-48 bg-[#1e1e1e] animate-pulse rounded-lg" />
        <div className="h-28 w-full bg-[#1e1e1e] animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-[#1e1e1e] animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: DashboardTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'codir', label: 'Objectifs & CODIR', icon: LayoutDashboard },
    { id: 'pipeline', label: 'Pipeline & Conversions', icon: GitCommit },
    { id: 'outreach', label: 'Prospection & Emails', icon: Mail },
    { id: 'tasks', label: 'Tâches par Membre', icon: CheckSquare },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-ui text-[#f2ede4]">
      {/* Comparative Header */}
      <DashboardHeader
        codirDates={codirDates}
        comparisonMode={comparisonMode}
        setComparisonMode={setComparisonMode}
        selectedCodirA={selectedCodirA}
        setSelectedCodirA={setSelectedCodirA}
        selectedCodirB={selectedCodirB}
        setSelectedCodirB={setSelectedCodirB}
        customDateA={customDateA}
        setCustomDateA={setCustomDateA}
        customDateB={customDateB}
        setCustomDateB={setCustomDateB}
        onExportCsv={handleExportCsv}
      />

      {/* Tab Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-line pb-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#141414] text-[#D4C4A8] border-t-2 border-t-[#D4C4A8] border-x border-line shadow-xs'
                  : 'text-ink-soft hover:text-[#f2ede4] hover:bg-[#1a1a1a]/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#D4C4A8]' : 'text-ink-soft'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Component */}
      <div className="pt-2">
        {activeTab === 'codir' && (
          <DashboardCodirTab
            leadsA={leadsA}
            leadsB={leadsB}
            targets={targets}
            historyA={historyA}
            historyB={historyB}
            slaLimits={slaLimits}
          />
        )}

        {activeTab === 'pipeline' && (
          <DashboardPipelineTab
            leadsA={leadsA}
            leadsB={leadsB}
            stages={stages}
            historyA={historyA}
            historyB={historyB}
          />
        )}

        {activeTab === 'outreach' && (
          <DashboardOutreachTab
            emailLogsA={emailLogsA}
            emailLogsB={emailLogsB}
          />
        )}

        {activeTab === 'tasks' && (
          <DashboardTasksTab
            tasks={tasks}
            teamMembers={teamMembers}
            startDateA={startDateA}
            endDateA={endDateA}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
