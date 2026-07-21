import { useState } from 'react';
import { leadsService, type Lead } from '../services/leadsService';
import { tasksService, type Task } from '../services/tasksService';
import { eventsService, type EventItem } from '../services/eventsService';
import { settingsService, type PipelineStage, type SlaLimits } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { useLoadOnMount } from './useLoadOnMount';
import { withLoadingState } from '../utils/withLoadingState';
import { isSlaBreached, computeSegmentStats } from '../utils/leadMetrics';

export function useCodirData() {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [slaLimits, setSlaLimits] = useState<SlaLimits>({ Media: 5, Retail: 7, Instit: 14 });
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadCodirData = () =>
    withLoadingState(
      async () => {
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
      },
      {
        setLoading,
        onError: (err) => {
          console.error('Error loading CODIR data:', err);
          showToast('Erreur de chargement des rapports', 'error');
        },
      }
    );

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
