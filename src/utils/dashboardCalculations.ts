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
  assigned_to?: string;
  completed_at?: string;
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
