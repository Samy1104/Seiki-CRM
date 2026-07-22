import { useState } from 'react';
import { leadsService, type Lead } from '../services/leadsService';
import { tasksService } from '../services/tasksService';
import { eventsService } from '../services/eventsService';
import { settingsService } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { useCachedResource } from './useCachedResource';
import { isSlaBreached, computeSegmentStats } from '../utils/leadMetrics';

export function useCodirData() {
  const { showToast } = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const onError = (err: unknown) => {
    console.error('Error loading CODIR data:', err);
    showToast('Erreur de chargement des rapports', 'error');
  };

  const leadsRes = useCachedResource('leads:false', () => leadsService.getLeads(), [], { onError });
  const tasksRes = useCachedResource('tasks', () => tasksService.getTasks(), [], { onError });
  const eventsRes = useCachedResource('agendaEvents', () => eventsService.getEvents(), [], { onError });
  const stagesRes = useCachedResource('pipelineStages', () => settingsService.getPipelineStages(), [], { onError });
  const slaLimitsRes = useCachedResource('slaLimits', () => settingsService.getSlaLimits(), { Media: 5, Retail: 7, Instit: 14 }, { onError });

  const leads = leadsRes.data;
  const tasks = tasksRes.data;
  const events = eventsRes.data;
  const stages = stagesRes.data;
  const slaLimits = slaLimitsRes.data;
  const loading = leadsRes.loading || tasksRes.loading || eventsRes.loading || stagesRes.loading || slaLimitsRes.loading;

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

  const activeLeads = leads.filter((l) => !l.is_archived && l.stage?.name !== 'Gagné');
  const wonLeads = leads.filter((l) => l.stage?.is_closed_won);
  const totalVal = leads.reduce((acc, l) => acc + l.deal_value, 0);
  const wonVal = wonLeads.reduce((acc, l) => acc + l.deal_value, 0);
  const hotDeals = leads.filter((l) => l.score >= 80 && l.stage?.name !== 'Gagné');
  const pendingTasks = tasks.filter((t) => t.status !== 'done');
  const overdueTasks = pendingTasks.filter(
    (t) => t.due_date && t.due_date < new Date().toISOString().slice(0, 10)
  );
  const slaBreaches = activeLeads.filter((l) => getSlaStatus(l));

  const topDeals = [...leads]
    .filter((l) => !l.is_archived && l.stage?.name !== 'Gagné')
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const segmentStats = computeSegmentStats(leads);
  const totalSegmentVal = Object.values(segmentStats).reduce((acc, curr) => acc + curr.val, 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter((e) => e.event_date >= todayStr).slice(0, 4);

  return {
    leads,
    tasks,
    events,
    stages,
    slaLimits,
    loading,
    isFullscreen,
    toggleFullscreen,
    handlePrint,
    activeLeads,
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
  };
}
