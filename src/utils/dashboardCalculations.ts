import type { Lead } from '../services/leadsService';
import type { PipelineStage } from '../services/settingsService';
import type { LeadStageHistoryEntry } from '../services/pipelineHistoryService';

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
    if (!lead.created_at) continue;
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

export type CohortGranularity = 'week' | 'fortnight' | 'month';
export type IntervalGranularity = 'day' | 'week' | 'month';

export interface FlexibleCohortCell {
  intervalIndex: number;
  intervalLabel: string;
  reachedCount: number;
  totalCount: number;
  reachPercentage: number;
  windowEndIso: string;
  leadsInCohort: Lead[];
  reachedLeads: Lead[];
}

export interface FlexibleCohortRow {
  cohortId: string;
  cohortLabel: string;
  cohortStart: Date;
  totalLeads: number;
  cells: FlexibleCohortCell[];
}

export interface FlexibleCohortMatrixOptions {
  cohortGranularity: CohortGranularity;
  intervalGranularity: IntervalGranularity;
  periodCount: number;
  targetStageId: string;
  allStages: PipelineStage[];
}

function getIsoWeekDetails(date: Date): { year: number; week: number; monday: Date } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const year = d.getUTCFullYear();

  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const currentDay = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - (currentDay - 1));
  monday.setUTCHours(0, 0, 0, 0);

  return { year, week: weekNo, monday };
}

function formatCohortStartLabel(date: Date): string {
  const day = date.getUTCDate();
  const dayStr = day === 1 ? '1er' : `${day}`;
  const monthStr = FRENCH_MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${dayStr} ${monthStr} ${year}`;
}

function getCohortBucket(
  createdAtStr: string,
  granularity: CohortGranularity
): { cohortId: string; cohortLabel: string; cohortStart: Date } | null {
  const date = new Date(createdAtStr);
  if (isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const monthPadded = String(month + 1).padStart(2, '0');

  if (granularity === 'month') {
    const cohortId = `${year}-${monthPadded}`;
    const cohortStart = new Date(Date.UTC(year, month, 1));
    const cohortLabel = formatCohortStartLabel(cohortStart);
    return { cohortId, cohortLabel, cohortStart };
  }

  if (granularity === 'fortnight') {
    const day = date.getUTCDate();
    if (day <= 15) {
      const cohortId = `${year}-${monthPadded}-F1`;
      const cohortStart = new Date(Date.UTC(year, month, 1));
      const cohortLabel = formatCohortStartLabel(cohortStart);
      return { cohortId, cohortLabel, cohortStart };
    } else {
      const cohortId = `${year}-${monthPadded}-F2`;
      const cohortStart = new Date(Date.UTC(year, month, 16));
      const cohortLabel = formatCohortStartLabel(cohortStart);
      return { cohortId, cohortLabel, cohortStart };
    }
  }

  if (granularity === 'week') {
    const { year: isoYear, week, monday } = getIsoWeekDetails(date);
    const weekPadded = String(week).padStart(2, '0');
    const cohortId = `${isoYear}-W${weekPadded}`;
    const cohortLabel = formatCohortStartLabel(monday);
    return { cohortId, cohortLabel, cohortStart: monday };
  }

  return null;
}

function getIntervalHeaderLabels(
  intervalGranularity: IntervalGranularity,
  periodCount: number
): string[] {
  const labels: string[] = [];
  for (let i = 0; i < periodCount; i++) {
    if (intervalGranularity === 'day') {
      labels.push(`Jour ${i + 1}`);
    } else if (intervalGranularity === 'week') {
      const startDay = i * 7 + 1;
      labels.push(`J${startDay} (S${i + 1})`);
    } else if (intervalGranularity === 'month') {
      labels.push(`Mois ${i + 1}`);
    }
  }
  return labels;
}

function getWindowEndIso(
  cohortStart: Date,
  intervalGranularity: IntervalGranularity,
  intervalIndex: number
): string {
  const count = intervalIndex + 1;
  let end: Date;

  if (intervalGranularity === 'day') {
    end = new Date(cohortStart.getTime() + count * 86400000);
  } else if (intervalGranularity === 'month') {
    end = new Date(
      Date.UTC(
        cohortStart.getUTCFullYear(),
        cohortStart.getUTCMonth() + count,
        cohortStart.getUTCDate()
      )
    );
  } else {
    end = new Date(cohortStart.getTime() + count * 7 * 86400000);
  }

  return end.toISOString();
}

function hasLeadReachedTargetStage(
  lead: Lead,
  history: LeadStageHistoryEntry[],
  targetStageId: string,
  windowEndIso: string,
  stagePositionMap: Map<string, number>
): boolean {
  const targetPos = stagePositionMap.get(targetStageId) ?? Infinity;

  const leadHistory = history.filter(
    (h) => h.lead_id === lead.id && h.changed_at <= windowEndIso
  );

  for (const entry of leadHistory) {
    if (entry.to_stage_id === targetStageId) return true;
    const entryPos = stagePositionMap.get(entry.to_stage_id);
    if (entryPos !== undefined && entryPos >= targetPos) return true;
  }

  if (lead.created_at && lead.created_at <= windowEndIso) {
    const futureHistory = history.filter(
      (h) => h.lead_id === lead.id && h.changed_at > windowEndIso
    );
    if (futureHistory.length > 0) {
      const earliestFuture = [...futureHistory].sort((a, b) =>
        a.changed_at.localeCompare(b.changed_at)
      )[0];
      const stageAtWindowEnd = earliestFuture.from_stage_id;
      if (stageAtWindowEnd) {
        if (stageAtWindowEnd === targetStageId) return true;
        const pos = stagePositionMap.get(stageAtWindowEnd);
        if (pos !== undefined && pos >= targetPos) return true;
      }
    } else {
      if (lead.stage_id === targetStageId) return true;
      const currentPos = stagePositionMap.get(lead.stage_id);
      if (currentPos !== undefined && currentPos >= targetPos) return true;
    }
  }

  return false;
}

export function computeFlexibleCohortMatrix(
  leads: Lead[],
  history: LeadStageHistoryEntry[],
  options: FlexibleCohortMatrixOptions
): { rows: FlexibleCohortRow[]; intervalHeaderLabels: string[] } {
  const {
    cohortGranularity,
    intervalGranularity,
    periodCount = 8,
    targetStageId,
    allStages = [],
  } = options;

  const intervalHeaderLabels = getIntervalHeaderLabels(
    intervalGranularity,
    periodCount
  );

  const stagePositionMap = new Map<string, number>();
  for (const stage of allStages) {
    stagePositionMap.set(stage.id, stage.position);
  }

  const qualifyingLeads = leads.filter(
    (l) => !l.is_disqualified && Boolean(l.created_at)
  );

  const cohortMap = new Map<
    string,
    { cohortId: string; cohortLabel: string; cohortStart: Date; leads: Lead[] }
  >();

  for (const lead of qualifyingLeads) {
    const bucket = getCohortBucket(lead.created_at, cohortGranularity);
    if (!bucket) continue;

    const existing = cohortMap.get(bucket.cohortId);
    if (existing) {
      existing.leads.push(lead);
    } else {
      cohortMap.set(bucket.cohortId, {
        cohortId: bucket.cohortId,
        cohortLabel: bucket.cohortLabel,
        cohortStart: bucket.cohortStart,
        leads: [lead],
      });
    }
  }

  const sortedCohorts = Array.from(cohortMap.values()).sort((a, b) =>
    b.cohortId.localeCompare(a.cohortId)
  );

  const rows: FlexibleCohortRow[] = sortedCohorts.map((cohort) => {
    const totalLeads = cohort.leads.length;

    const cells: FlexibleCohortCell[] = [];
    for (let i = 0; i < periodCount; i++) {
      const intervalLabel = intervalHeaderLabels[i];
      const windowEndIso = getWindowEndIso(
        cohort.cohortStart,
        intervalGranularity,
        i
      );

      const reachedLeads = cohort.leads.filter((lead) =>
        hasLeadReachedTargetStage(
          lead,
          history,
          targetStageId,
          windowEndIso,
          stagePositionMap
        )
      );

      const reachedCount = reachedLeads.length;
      const reachPercentage =
        totalLeads > 0 ? (reachedCount / totalLeads) * 100 : 0;

      cells.push({
        intervalIndex: i,
        intervalLabel,
        reachedCount,
        totalCount: totalLeads,
        reachPercentage,
        windowEndIso,
        leadsInCohort: cohort.leads,
        reachedLeads,
      });
    }

    return {
      cohortId: cohort.cohortId,
      cohortLabel: cohort.cohortLabel,
      cohortStart: cohort.cohortStart,
      totalLeads,
      cells,
    };
  });

  return { rows, intervalHeaderLabels };
}

