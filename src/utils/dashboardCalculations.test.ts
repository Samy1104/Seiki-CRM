import { describe, it, expect } from 'vitest';
import {
  computeDelta,
  computeLeadsProgression,
  groupTasksByMember,
  computePeriodWindows,
  isWithinWindow,
  reconstructStageSnapshot,
  countByStage,
  computeCohortMatrix,
  computeVelocityDays,
  computeFlexibleCohortMatrix,
} from './dashboardCalculations';

describe('dashboardCalculations', () => {
  describe('computeDelta', () => {
    it('calculates positive delta and percentage correctly', () => {
      const result = computeDelta(120, 100);
      expect(result).toEqual({
        current: 120,
        previous: 100,
        absolute: 20,
        percent: 20,
      });
    });

    it('calculates negative delta and percentage correctly', () => {
      const result = computeDelta(80, 100);
      expect(result).toEqual({
        current: 80,
        previous: 100,
        absolute: -20,
        percent: -20,
      });
    });

    it('handles division by zero when previous is 0 and current > 0', () => {
      const result = computeDelta(50, 0);
      expect(result).toEqual({
        current: 50,
        previous: 0,
        absolute: 50,
        percent: 100,
      });
    });

    it('handles previous === 0 and current === 0', () => {
      const result = computeDelta(0, 0);
      expect(result).toEqual({
        current: 0,
        previous: 0,
        absolute: 0,
        percent: 0,
      });
    });

    it('handles previous === 0 and current < 0', () => {
      const result = computeDelta(-10, 0);
      expect(result).toEqual({
        current: -10,
        previous: 0,
        absolute: -10,
        percent: 0,
      });
    });
  });

  describe('computeLeadsProgression', () => {
    it('counts history items with action_type === stage_change within date range inclusive', () => {
      const history = [
        { id: '1', lead_id: 'l1', action_type: 'stage_change', created_at: '2026-07-05T10:00:00Z' },
        { id: '2', lead_id: 'l1', action_type: 'stage_change', created_at: '2026-07-20T11:00:00Z' },
        { id: '3', lead_id: 'l2', action_type: 'note', created_at: '2026-07-15T09:00:00Z' },
        { id: '4', lead_id: 'l2', action_type: 'stage_change', created_at: '2026-08-01T08:00:00Z' }, // Out of range
      ];

      const count = computeLeadsProgression(history, '2026-07-01', '2026-07-31');
      expect(count).toBe(2);
    });

    it('includes boundary timestamps on start and end dates', () => {
      const history = [
        { action_type: 'stage_change', created_at: '2026-07-01T00:00:00.000Z' },
        { action_type: 'stage_change', created_at: '2026-07-31T23:59:59.999Z' },
      ];
      const count = computeLeadsProgression(history, '2026-07-01', '2026-07-31');
      expect(count).toBe(2);
    });

    it('returns 0 when no stage_change items match', () => {
      const history = [
        { action_type: 'note', created_at: '2026-07-15T10:00:00Z' },
      ];
      const count = computeLeadsProgression(history, '2026-07-01', '2026-07-31');
      expect(count).toBe(0);
    });
  });

  describe('groupTasksByMember', () => {
    const teamMembers = [
      { id: 'user-1', full_name: 'Alice', initials: 'A', color: '#ff0000' },
      { id: 'user-2', full_name: 'Bob', initials: 'B', color: '#00ff00' },
    ];

    const tasks = [
      { id: 't1', title: 'Task 1', status: 'done', assigned_to: 'user-1', completed_at: '2026-07-10T10:00:00Z' },
      { id: 't2', title: 'Task 2', status: 'todo', assigned_to: 'user-1' },
      { id: 't3', title: 'Task 3', status: 'done', assigned_to: 'user-1', completed_at: '2026-06-15T10:00:00Z' }, // Outside period
      { id: 't4', title: 'Task 4', status: 'in_progress', assigned_to: 'user-2' },
      { id: 't5', title: 'Task 5', status: 'done', assigned_to: 'user-2', completed_at: '2026-07-20T10:00:00Z' },
    ];

    it('groups tasks correctly by member with date range filtering', () => {
      const grouped = groupTasksByMember(tasks, teamMembers, '2026-07-01', '2026-07-31');

      expect(grouped).toHaveLength(2);

      // Alice
      expect(grouped[0].member).toEqual(teamMembers[0]);
      expect(grouped[0].completedInPeriod).toHaveLength(1);
      expect(grouped[0].completedInPeriod[0].id).toBe('t1');
      expect(grouped[0].pending).toHaveLength(1);
      expect(grouped[0].pending[0].id).toBe('t2');

      // Bob
      expect(grouped[1].member).toEqual(teamMembers[1]);
      expect(grouped[1].completedInPeriod).toHaveLength(1);
      expect(grouped[1].completedInPeriod[0].id).toBe('t5');
      expect(grouped[1].pending).toHaveLength(1);
      expect(grouped[1].pending[0].id).toBe('t4');
    });

    it('groups tasks without date range filtering if omitted', () => {
      const grouped = groupTasksByMember(tasks, teamMembers);

      // Alice should have 2 completed (t1 and t3)
      expect(grouped[0].completedInPeriod).toHaveLength(2);
      expect(grouped[0].pending).toHaveLength(1);
    });
  });

  describe('computePeriodWindows', () => {
    const now = new Date('2026-07-30T12:00:00.000Z');

    it('since_last_codir: current runs from last meeting to now, comparison is the prior CODIR-to-CODIR window', () => {
      const meetings = [{ meeting_date: '2026-06-01T00:00:00.000Z' }, { meeting_date: '2026-07-15T00:00:00.000Z' }];
      const { current, comparison } = computePeriodWindows('since_last_codir', meetings, now);
      expect(current).toEqual({ start: '2026-07-15T00:00:00.000Z', end: now.toISOString() });
      expect(comparison).toEqual({ start: '2026-06-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' });
    });

    it('since_last_codir: falls back to a 30/60-day window when no meetings exist', () => {
      const { current, comparison } = computePeriodWindows('since_last_codir', [], now);
      expect(current.end).toBe(now.toISOString());
      expect(new Date(current.start).getTime()).toBeLessThan(now.getTime());
      expect(new Date(comparison.start).getTime()).toBeLessThan(new Date(comparison.end).getTime());
    });

    it('last_two_codirs: current is N-1..N, comparison is N-2..N-1', () => {
      const meetings = [
        { meeting_date: '2026-05-01T00:00:00.000Z' },
        { meeting_date: '2026-06-01T00:00:00.000Z' },
        { meeting_date: '2026-07-15T00:00:00.000Z' },
      ];
      const { current, comparison } = computePeriodWindows('last_two_codirs', meetings, now);
      expect(current).toEqual({ start: '2026-06-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' });
      expect(comparison).toEqual({ start: '2026-05-01T00:00:00.000Z', end: '2026-06-01T00:00:00.000Z' });
    });

    it('month: current is month-to-date, comparison is the full previous month', () => {
      const { current, comparison } = computePeriodWindows('month', [], now);
      expect(current.start).toBe('2026-07-01T00:00:00.000Z');
      expect(current.end).toBe(now.toISOString());
      expect(comparison.start).toBe('2026-06-01T00:00:00.000Z');
      expect(new Date(comparison.end).getUTCMonth()).toBe(5); // June
    });

    it('quarter: current quarter start is the 1st of the quarter month', () => {
      const { current } = computePeriodWindows('quarter', [], now);
      expect(current.start).toBe('2026-07-01T00:00:00.000Z');
    });

    it('year: current year start is Jan 1st', () => {
      const { current, comparison } = computePeriodWindows('year', [], now);
      expect(current.start).toBe('2026-01-01T00:00:00.000Z');
      expect(comparison.start).toBe('2025-01-01T00:00:00.000Z');
    });

    it('custom: comparison window is an equal-length window immediately before start', () => {
      const { current, comparison } = computePeriodWindows('custom', [], now, {
        start: '2026-07-01T00:00:00.000Z',
        end: '2026-07-15T00:00:00.000Z',
      });
      expect(current).toEqual({ start: '2026-07-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' });
      expect(comparison.end).toBe('2026-06-30T23:59:59.999Z');
      // 14-day span before the start
      expect(comparison.start).toBe('2026-06-17T00:00:00.000Z');
    });
  });

  describe('isWithinWindow', () => {
    it('returns true for a date inside the window', () => {
      expect(isWithinWindow('2026-07-10T00:00:00.000Z', { start: '2026-07-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' })).toBe(true);
    });

    it('returns false for a date outside the window', () => {
      expect(isWithinWindow('2026-08-01T00:00:00.000Z', { start: '2026-07-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' })).toBe(false);
    });

    it('returns false for an invalid date string', () => {
      expect(isWithinWindow('not-a-date', { start: '2026-07-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' })).toBe(false);
    });
  });

  describe('reconstructStageSnapshot', () => {
    it('picks the latest transition at or before the target date per lead', () => {
      const history = [
        { lead_id: 'l1', to_stage_id: 'prospect', changed_at: '2026-07-01T00:00:00.000Z' },
        { lead_id: 'l1', to_stage_id: 'demo', changed_at: '2026-07-10T00:00:00.000Z' },
        { lead_id: 'l1', to_stage_id: 'won', changed_at: '2026-07-25T00:00:00.000Z' },
        { lead_id: 'l2', to_stage_id: 'prospect', changed_at: '2026-07-05T00:00:00.000Z' },
      ];
      const snapshot = reconstructStageSnapshot(history, '2026-07-15T00:00:00.000Z');
      expect(snapshot).toEqual({ l1: 'demo', l2: 'prospect' });
    });

    it('excludes leads with no transition at or before the target date', () => {
      const history = [{ lead_id: 'l1', to_stage_id: 'prospect', changed_at: '2026-08-01T00:00:00.000Z' }];
      const snapshot = reconstructStageSnapshot(history, '2026-07-15T00:00:00.000Z');
      expect(snapshot).toEqual({});
    });
  });

  describe('countByStage', () => {
    it('counts leads per stage from a snapshot', () => {
      const counts = countByStage({ l1: 'demo', l2: 'prospect', l3: 'demo' });
      expect(counts).toEqual({ demo: 2, prospect: 1 });
    });
  });

  describe('computeCohortMatrix', () => {
    const stages = [
      { id: 'prospect', name: 'Prospect', position: 1 },
      { id: 'demo', name: 'Démo', position: 2 },
      { id: 'won', name: 'Gagné', position: 3 },
    ];

    it('groups leads by creation month and computes reach percent per stage', () => {
      const leads = [
        { id: 'l1', created_at: '2026-05-03T00:00:00.000Z' },
        { id: 'l2', created_at: '2026-05-20T00:00:00.000Z' },
      ];
      const history = [
        { lead_id: 'l1', to_stage_id: 'prospect', changed_at: '2026-05-03T00:00:00.000Z' },
        { lead_id: 'l1', to_stage_id: 'demo', changed_at: '2026-05-10T00:00:00.000Z' },
        { lead_id: 'l2', to_stage_id: 'prospect', changed_at: '2026-05-20T00:00:00.000Z' },
      ];
      const rows = computeCohortMatrix(leads, history, stages);
      expect(rows).toHaveLength(1);
      expect(rows[0].monthKey).toBe('2026-05');
      expect(rows[0].totalLeads).toBe(2);
      const demoCell = rows[0].cells.find((c) => c.stageId === 'demo')!;
      expect(demoCell.reachedCount).toBe(1);
      expect(demoCell.percent).toBe(50);
      expect(demoCell.leadIds).toEqual(['l1']);
    });

    it('excludes disqualified leads from cohort membership and denominator', () => {
      const leads = [
        { id: 'l1', created_at: '2026-05-03T00:00:00.000Z', is_disqualified: false },
        { id: 'l2', created_at: '2026-05-20T00:00:00.000Z', is_disqualified: true },
      ];
      const rows = computeCohortMatrix(leads, [], stages);
      expect(rows[0].totalLeads).toBe(1);
    });
  });

  describe('computeVelocityDays', () => {
    const wonStageId = 'won';

    it('averages days from created_at to the won transition found in history', () => {
      const leads = [{ id: 'l1', created_at: '2026-07-01T00:00:00.000Z', stage_id: 'won', stage_changed_at: '2026-07-11T00:00:00.000Z' }];
      const history = [{ lead_id: 'l1', to_stage_id: 'won', changed_at: '2026-07-11T00:00:00.000Z' }];
      expect(computeVelocityDays(leads, history, wonStageId)).toBe(10);
    });

    it('falls back to stage_changed_at when no history entry exists but the lead is currently won', () => {
      const leads = [{ id: 'l1', created_at: '2026-07-01T00:00:00.000Z', stage_id: 'won', stage_changed_at: '2026-07-06T00:00:00.000Z' }];
      expect(computeVelocityDays(leads, [], wonStageId)).toBe(5);
    });

    it('ignores leads that never reached the won stage', () => {
      const leads = [{ id: 'l1', created_at: '2026-07-01T00:00:00.000Z', stage_id: 'demo', stage_changed_at: '2026-07-06T00:00:00.000Z' }];
      expect(computeVelocityDays(leads, [], wonStageId)).toBe(0);
    });
  });

  describe('computeFlexibleCohortMatrix', () => {
    const allStages = [
      { id: 'stage-prospect', name: 'Prospect', position: 1, color: '#fff', is_closed_won: false, is_active: true },
      { id: 'stage-qual', name: 'Qualification', position: 2, color: '#fff', is_closed_won: false, is_active: true },
      { id: 'stage-won', name: 'Gagné', position: 3, color: '#fff', is_closed_won: true, is_active: true },
    ] as any;

    it('groups leads by month cohort and calculates cumulative reach % for target stage', () => {
      const leads = [
        { id: 'l1', created_at: '2026-01-05T10:00:00Z', stage_id: 'stage-qual', is_disqualified: false },
        { id: 'l2', created_at: '2026-01-10T10:00:00Z', stage_id: 'stage-prospect', is_disqualified: false },
      ] as any;
      const history = [
        { id: 'h1', lead_id: 'l1', from_stage_id: 'stage-prospect', to_stage_id: 'stage-qual', changed_at: '2026-01-12T10:00:00Z' },
      ] as any;

      const result = computeFlexibleCohortMatrix(leads, history, {
        cohortGranularity: 'month',
        intervalGranularity: 'week',
        periodCount: 4,
        targetStageId: 'stage-qual',
        allStages,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].cohortLabel).toBe('1er Janvier 2026');
      expect(result.rows[0].totalLeads).toBe(2);
      expect(result.rows[0].cells[1].reachedCount).toBe(1);
      expect(result.rows[0].cells[1].reachPercentage).toBe(50);
      expect(result.intervalHeaderLabels).toEqual(['S+1', 'S+2', 'S+3', 'S+4']);
    });

    it('supports week and fortnight cohort granularities', () => {
      const leads = [
        { id: 'l1', created_at: '2026-01-05T10:00:00Z', stage_id: 'stage-qual', is_disqualified: false },
        { id: 'l2', created_at: '2026-01-20T10:00:00Z', stage_id: 'stage-qual', is_disqualified: false },
      ] as any;
      const history = [] as any;

      const fortnightResult = computeFlexibleCohortMatrix(leads, history, {
        cohortGranularity: 'fortnight',
        intervalGranularity: 'week',
        periodCount: 2,
        targetStageId: 'stage-qual',
        allStages,
      });
      expect(fortnightResult.rows.length).toBe(2);
      expect(fortnightResult.rows[0].cohortLabel).toBe('16 Janvier 2026');
      expect(fortnightResult.rows[1].cohortLabel).toBe('1er Janvier 2026');
    });

    it('handles day and month interval granularities', () => {
      const leads = [
        { id: 'l1', created_at: '2026-01-05T10:00:00Z', stage_id: 'stage-qual', is_disqualified: false },
      ] as any;

      const dayResult = computeFlexibleCohortMatrix(leads, [], {
        cohortGranularity: 'month',
        intervalGranularity: 'day',
        periodCount: 3,
        targetStageId: 'stage-qual',
        allStages,
      });
      expect(dayResult.intervalHeaderLabels).toEqual(['J+1', 'J+2', 'J+3']);

      const monthResult = computeFlexibleCohortMatrix(leads, [], {
        cohortGranularity: 'month',
        intervalGranularity: 'month',
        periodCount: 2,
        targetStageId: 'stage-qual',
        allStages,
      });
      expect(monthResult.intervalHeaderLabels).toEqual(['M+1', 'M+2']);
    });

    it('excludes disqualified leads from cohorts', () => {
      const leads = [
        { id: 'l1', created_at: '2026-01-05T10:00:00Z', stage_id: 'stage-qual', is_disqualified: false },
        { id: 'l2', created_at: '2026-01-10T10:00:00Z', stage_id: 'stage-qual', is_disqualified: true },
      ] as any;

      const result = computeFlexibleCohortMatrix(leads, [], {
        cohortGranularity: 'month',
        intervalGranularity: 'week',
        periodCount: 2,
        targetStageId: 'stage-qual',
        allStages,
      });

      expect(result.rows[0].totalLeads).toBe(1);
      expect(result.rows[0].cells[0].leadsInCohort).toHaveLength(1);
      expect(result.rows[0].cells[0].leadsInCohort[0].id).toBe('l1');
    });
  });
});
