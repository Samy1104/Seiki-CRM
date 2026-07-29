import { describe, it, expect } from 'vitest';
import {
  computeDelta,
  computeLeadsProgression,
  groupTasksByMember,
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
});
