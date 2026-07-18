import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, tables } = vi.hoisted(() => {
  function makeBuilder() {
    const builder: any = {};
    builder.insert = vi.fn(() => builder);
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.single = vi.fn();
    // insert(...).select(...).single() and insert(...) alone (no chain) both
    // need to resolve — insert() itself resolves for calls that don't chain further.
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
    return builder;
  }
  const tables: Record<string, any> = {
    tasks: makeBuilder(),
    task_assignees: makeBuilder(),
    team_members: makeBuilder(),
    history: makeBuilder(),
  };
  const fromMock = vi.fn((table: string) => tables[table]);
  return { fromMock, tables };
});

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}));

import { tasksService } from './tasksService';

describe('tasksService.createTask', () => {
  beforeEach(() => {
    fromMock.mockClear();
    for (const table of Object.values(tables)) {
      table.insert.mockClear();
      table.select.mockClear();
      table.eq.mockClear();
      table.in.mockClear();
      table.single.mockReset();
    }
  });

  it('builds the result from the insert response, without a second full task+joins refetch', async () => {
    tables.tasks.single.mockResolvedValue({
      data: { id: 'task-1', description: 'Call client', lead_id: null, lead: null },
      error: null,
    });

    await tasksService.createTask({
      description: 'Call client',
      lead_id: null,
      assigned_to: null,
      created_by: null,
      priority: 'medium',
      status: 'todo',
      due_date: null,
    });

    // Exactly one query against 'tasks' (the insert) — no follow-up
    // `.from('tasks').select(...).eq('id', ...)` refetch.
    const tasksCalls = fromMock.mock.calls.filter(([table]) => table === 'tasks');
    expect(tasksCalls).toHaveLength(1);
  });

  it('fetches assignee team_members in one lookup instead of refetching the whole task', async () => {
    tables.tasks.single.mockResolvedValue({
      data: { id: 'task-2', description: 'Follow up', lead_id: null, lead: null },
      error: null,
    });
    tables.team_members.select.mockReturnValue(tables.team_members);
    tables.team_members.in.mockResolvedValue({
      data: [{ id: 'm1', full_name: 'Marie', initials: 'MD', color: '#fff' }],
      error: null,
    });

    const result = await tasksService.createTask({
      description: 'Follow up',
      lead_id: null,
      assigned_to: null,
      created_by: null,
      priority: 'medium',
      status: 'todo',
      due_date: null,
      assignee_ids: ['m1'],
    });

    expect(tables.team_members.in).toHaveBeenCalledWith('id', ['m1']);
    expect(result.assignees).toEqual([{ id: 'm1', full_name: 'Marie', initials: 'MD', color: '#fff' }]);
    expect(result.assignee).toEqual({ id: 'm1', full_name: 'Marie', initials: 'MD', color: '#fff' });
  });

  it('throws when the task insert fails', async () => {
    tables.tasks.single.mockResolvedValue({ data: null, error: new Error('insert failed') });

    await expect(
      tasksService.createTask({
        description: 'X',
        lead_id: null,
        assigned_to: null,
        created_by: null,
        priority: 'low',
        status: 'todo',
        due_date: null,
      })
    ).rejects.toThrow('insert failed');
  });
});
