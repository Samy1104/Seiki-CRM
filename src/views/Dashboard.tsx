import React, { useState, useEffect, useMemo } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead, LeadHistoryItem } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { PipelineStage, DashboardTargets, TeamMember, SlaLimits, CodirMeeting } from '../services/settingsService';
import { tasksService } from '../services/tasksService';
import type { Task } from '../services/tasksService';
import { prospectionService } from '../services/prospectionService';
import type { EmailLog } from '../services/prospectionService';
import { pipelineHistoryService } from '../services/pipelineHistoryService';
import type { LeadStageHistoryEntry } from '../services/pipelineHistoryService';
import { computePeriodWindows, isWithinWindow } from '../utils/dashboardCalculations';
import type { PeriodPreset } from '../utils/dashboardCalculations';
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
  const [codirMeetings, setCodirMeetings] = useState<CodirMeeting[]>([]);
  const [stageHistory, setStageHistory] = useState<LeadStageHistoryEntry[]>([]);
  const [slaLimits, setSlaLimits] = useState<SlaLimits | undefined>(undefined);

  // Period preset & custom range states
  const [preset, setPreset] = useState<PeriodPreset>('since_last_codir');
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
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
        fetchedCodirMeetings,
        fetchedSla,
        historyRes,
        fetchedStageHistory,
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
        pipelineHistoryService.getStageHistory(),
      ]);

      setLeads(fetchedLeads);
      setStages(fetchedStages);
      setTasks(fetchedTasks);
      setEmailLogs(fetchedEmailLogs);
      setTeamMembers(fetchedMembers);
      setTargets(fetchedTargets);
      setCodirMeetings(fetchedCodirMeetings);
      setSlaLimits(fetchedSla);
      setHistory((historyRes.data || []) as LeadHistoryItem[]);
      setStageHistory(fetchedStageHistory);
    } catch (err) {
      console.error('Erreur de chargement des données du dashboard:', err);
      showToast('Erreur lors du chargement des données du Dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered dataset for Period A & Period B
  const { leadsA, leadsB, historyA, historyB, emailLogsA, emailLogsB, startDateA, endDateA, endDateB } = useMemo(() => {
    const { current, comparison } = computePeriodWindows(preset, codirMeetings, new Date(), customRange);

    return {
      leadsA: leads.filter((l) => isWithinWindow(l.created_at, current)),
      leadsB: leads.filter((l) => isWithinWindow(l.created_at, comparison)),
      historyA: history.filter((h) => isWithinWindow(h.created_at, current)),
      historyB: history.filter((h) => isWithinWindow(h.created_at, comparison)),
      emailLogsA: emailLogs.filter((e) => isWithinWindow(e.sent_at || e.created_at, current)),
      emailLogsB: emailLogs.filter((e) => isWithinWindow(e.sent_at || e.created_at, comparison)),
      startDateA: current.start,
      endDateA: current.end,
      endDateB: comparison.end,
    };
  }, [preset, codirMeetings, customRange, leads, history, emailLogs]);

  const handleValidateCodir = async () => {
    const updated = await settingsService.addCodirDate();
    setCodirMeetings(updated);
    showToast('CODIR du jour enregistré !', 'success');
  };

  const handleExportCsv = () => {
    const csvContent = generateStatsCsv(leadsA);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seiki_dashboard_${preset}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast('Export CSV du Dashboard téléchargé !', 'success');
  };

  if (loading) {
    return (
      <div className="w-full space-y-6">
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
    <div className="w-full space-y-6 font-ui text-[#f2ede4]">
      {/* Comparative Header */}
      <DashboardHeader
        preset={preset}
        setPreset={setPreset}
        customRange={customRange}
        setCustomRange={setCustomRange}
        codirMeetings={codirMeetings}
        onValidateCodir={handleValidateCodir}
        onExportCsv={handleExportCsv}
      />

      {/* Tab Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-line/60 pb-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group relative flex-1 min-w-[210px] flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-t-xl overflow-hidden transition-all duration-300 ease-out cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                isActive
                  ? 'bg-[#141414] text-[#D4C4A8] border-x border-t border-line/80 shadow-md'
                  : 'text-ink-soft hover:text-[#f2ede4] hover:bg-[#1a1a1a]/60 border-x border-t border-transparent'
              }`}
            >
              {/* Active top accent bar aligned with rounded corners */}
              <span
                className={`absolute top-0 left-3 right-3 h-[2.5px] bg-[#D4C4A8] rounded-full transition-all duration-300 ease-out ${
                  isActive
                    ? 'opacity-100 scale-x-100 shadow-[0_0_8px_rgba(212,196,168,0.5)]'
                    : 'opacity-0 scale-x-50 group-hover:opacity-40 group-hover:scale-x-75'
                }`}
              />

              <Icon
                className={`w-4 h-4 transition-all duration-300 ease-out group-hover:scale-110 ${
                  isActive ? 'text-[#D4C4A8] drop-shadow-[0_0_6px_rgba(212,196,168,0.4)]' : 'text-ink-soft group-hover:text-[#f2ede4]'
                }`}
              />
              <span
                className={`text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300 ${
                  isActive ? 'text-[#D4C4A8]' : 'text-ink-soft group-hover:text-[#f2ede4]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Component with Smooth Transition */}
      <div className="pt-2 transition-all duration-300">
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
