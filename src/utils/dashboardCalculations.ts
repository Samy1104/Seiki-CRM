export interface DeltaResult {
  current: number;
  previous: number;
  absolute: number;
  percent: number;
}

export function computeDelta(current: number, previous: number): DeltaResult {
  const absolute = current - previous;
  if (previous === 0) {
    return {
      current,
      previous,
      absolute,
      percent: current > 0 ? 100 : 0,
    };
  }
  const percent = Math.round((absolute / previous) * 100);
  return {
    current,
    previous,
    absolute,
    percent,
  };
}

function parseDateBoundary(dateStr: string, isEnd: boolean): number {
  if (dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T${isEnd ? '23:59:59.999' : '00:00:00.000'}Z`).getTime();
  }
  return new Date(dateStr).getTime();
}

export function computeLeadsProgression(
  historyItems: Array<{ action_type: string; created_at: string; [key: string]: any }>,
  startDate: string,
  endDate: string
): number {
  const start = parseDateBoundary(startDate, false);
  const end = parseDateBoundary(endDate, true);

  return historyItems.filter((item) => {
    if (item.action_type !== 'stage_change') return false;
    const itemTime = new Date(item.created_at).getTime();
    return itemTime >= start && itemTime <= end;
  }).length;
}

export interface TaskItem {
  id: string;
  status: string;
  assigned_to?: string | null;
  completed_at?: string | null;
  [key: string]: any;
}

export interface TeamMemberItem {
  id: string;
  full_name?: string;
  initials?: string;
  color?: string;
  [key: string]: any;
}

export interface GroupedTaskResult {
  member: TeamMemberItem;
  completedInPeriod: TaskItem[];
  pending: TaskItem[];
}

export function groupTasksByMember(
  tasks: TaskItem[],
  teamMembers: TeamMemberItem[],
  startDate?: string,
  endDate?: string
): GroupedTaskResult[] {
  const start = startDate ? parseDateBoundary(startDate, false) : 0;
  const end = endDate ? parseDateBoundary(endDate, true) : Infinity;

  return teamMembers.map((member) => {
    const memberTasks = tasks.filter((t) => t.assigned_to === member.id);

    const completedInPeriod = memberTasks.filter((t) => {
      if (t.status !== 'done' || !t.completed_at) return false;
      const compTime = new Date(t.completed_at).getTime();
      return compTime >= start && compTime <= end;
    });

    const pending = memberTasks.filter((t) => t.status !== 'done');

    return {
      member,
      completedInPeriod,
      pending,
    };
  });
}

export type PeriodPreset = 'since_last_codir' | 'last_two_codirs' | 'month' | 'quarter' | 'year' | 'custom';

export interface PeriodWindow {
  start: string;
  end: string;
}

export interface ComparisonWindows {
  current: PeriodWindow;
  comparison: PeriodWindow;
}

export interface CodirMeetingLike {
  meeting_date: string;
}

const daysAgoIso = (now: Date, days: number) => new Date(now.getTime() - days * 86400000).toISOString();

export function computePeriodWindows(
  preset: PeriodPreset,
  codirMeetings: CodirMeetingLike[],
  now: Date,
  custom?: { start: string; end: string }
): ComparisonWindows {
  const nowIso = now.toISOString();
  const sorted = [...codirMeetings].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  const last = sorted[sorted.length - 1]?.meeting_date;
  const prev = sorted[sorted.length - 2]?.meeting_date;
  const prevPrev = sorted[sorted.length - 3]?.meeting_date;

  switch (preset) {
    case 'since_last_codir': {
      const currentStart = last || daysAgoIso(now, 30);
      const comparisonEnd = last || daysAgoIso(now, 30);
      const comparisonStart = prev || daysAgoIso(now, 60);
      return {
        current: { start: currentStart, end: nowIso },
        comparison: { start: comparisonStart, end: comparisonEnd },
      };
    }
    case 'last_two_codirs': {
      const currentEnd = last || nowIso;
      const currentStart = prev || daysAgoIso(now, 30);
      const comparisonEnd = prev || daysAgoIso(now, 30);
      const comparisonStart = prevPrev || daysAgoIso(now, 60);
      return {
        current: { start: currentStart, end: currentEnd },
        comparison: { start: comparisonStart, end: comparisonEnd },
      };
    }
    case 'month': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const prevMonthEnd = new Date(start.getTime() - 1);
      return {
        current: { start: start.toISOString(), end: nowIso },
        comparison: { start: prevMonthStart.toISOString(), end: prevMonthEnd.toISOString() },
      };
    }
    case 'quarter': {
      const q = Math.floor(now.getUTCMonth() / 3);
      const start = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
      const prevQStart = new Date(Date.UTC(now.getUTCFullYear(), (q - 1) * 3, 1));
      const prevQEnd = new Date(start.getTime() - 1);
      return {
        current: { start: start.toISOString(), end: nowIso },
        comparison: { start: prevQStart.toISOString(), end: prevQEnd.toISOString() },
      };
    }
    case 'year': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const prevYearStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
      const prevYearEnd = new Date(start.getTime() - 1);
      return {
        current: { start: start.toISOString(), end: nowIso },
        comparison: { start: prevYearStart.toISOString(), end: prevYearEnd.toISOString() },
      };
    }
    case 'custom':
    default: {
      const start = custom?.start || daysAgoIso(now, 30);
      const end = custom?.end || nowIso;
      const spanMs = new Date(end).getTime() - new Date(start).getTime();
      const comparisonEnd = new Date(new Date(start).getTime() - 1).toISOString();
      const comparisonStart = new Date(new Date(start).getTime() - spanMs).toISOString();
      return {
        current: { start, end },
        comparison: { start: comparisonStart, end: comparisonEnd },
      };
    }
  }
}

export function isWithinWindow(dateStr: string, window: PeriodWindow): boolean {
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return false;
  return time >= new Date(window.start).getTime() && time <= new Date(window.end).getTime();
}

export interface LeadStageHistoryEntryLike {
  lead_id: string;
  to_stage_id: string;
  changed_at: string;
}

export function reconstructStageSnapshot(
  history: LeadStageHistoryEntryLike[],
  atIso: string
): Record<string, string> {
  const latestByLead: Record<string, { stageId: string; changedAt: string }> = {};
  for (const entry of history) {
    if (entry.changed_at > atIso) continue;
    const existing = latestByLead[entry.lead_id];
    if (!existing || entry.changed_at > existing.changedAt) {
      latestByLead[entry.lead_id] = { stageId: entry.to_stage_id, changedAt: entry.changed_at };
    }
  }
  const snapshot: Record<string, string> = {};
  for (const [leadId, v] of Object.entries(latestByLead)) {
    snapshot[leadId] = v.stageId;
  }
  return snapshot;
}

export function countByStage(snapshot: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const stageId of Object.values(snapshot)) {
    counts[stageId] = (counts[stageId] || 0) + 1;
  }
  return counts;
}

export interface CohortLeadInput {
  id: string;
  created_at: string;
  is_disqualified?: boolean;
}

export interface CohortStageCell {
  stageId: string;
  reachedCount: number;
  percent: number;
  leadIds: string[];
}

export interface CohortRow {
  monthKey: string;
  monthLabel: string;
  totalLeads: number;
  cells: CohortStageCell[];
}

const FRENCH_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function computeCohortMatrix(
  leads: CohortLeadInput[],
  history: LeadStageHistoryEntryLike[],
  stages: { id: string; name: string; position: number }[]
): CohortRow[] {
  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const qualifyingLeads = leads.filter((l) => !l.is_disqualified);

  const reachedByLead: Record<string, Set<string>> = {};
  for (const entry of history) {
    if (!reachedByLead[entry.lead_id]) reachedByLead[entry.lead_id] = new Set();
    reachedByLead[entry.lead_id].add(entry.to_stage_id);
  }

  const monthGroups: Record<string, CohortLeadInput[]> = {};
  for (const lead of qualifyingLeads) {
    const monthKey = lead.created_at.slice(0, 7);
    if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
    monthGroups[monthKey].push(lead);
  }

  return Object.entries(monthGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, monthLeads]) => {
      const totalLeads = monthLeads.length;
      const [year, month] = monthKey.split('-');
      const monthLabel = `${FRENCH_MONTHS[Number(month) - 1]} ${year}`;

      const cells: CohortStageCell[] = sortedStages.map((stage) => {
        const leadIds = monthLeads
          .filter((l) => reachedByLead[l.id]?.has(stage.id))
          .map((l) => l.id);
        return {
          stageId: stage.id,
          reachedCount: leadIds.length,
          percent: totalLeads > 0 ? Math.round((leadIds.length / totalLeads) * 100) : 0,
          leadIds,
        };
      });

      return { monthKey, monthLabel, totalLeads, cells };
    });
}

export interface VelocityLeadInput {
  id: string;
  created_at: string;
  stage_id: string;
  stage_changed_at: string;
}

export function computeVelocityDays(
  leads: VelocityLeadInput[],
  history: LeadStageHistoryEntryLike[],
  wonStageId: string
): number {
  const wonDurations: number[] = [];

  for (const lead of leads) {
    const wonEntries = history
      .filter((h) => h.lead_id === lead.id && h.to_stage_id === wonStageId)
      .sort((a, b) => a.changed_at.localeCompare(b.changed_at));

    let wonAt = wonEntries[0]?.changed_at;
    if (!wonAt && lead.stage_id === wonStageId) {
      wonAt = lead.stage_changed_at;
    }
    if (!wonAt) continue;

    const days = (new Date(wonAt).getTime() - new Date(lead.created_at).getTime()) / 86400000;
    if (days >= 0) wonDurations.push(days);
  }

  if (wonDurations.length === 0) return 0;
  return Math.round(wonDurations.reduce((a, b) => a + b, 0) / wonDurations.length);
}

