import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, builder } = vi.hoisted(() => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  const fromMock = vi.fn(() => builder);
  return { fromMock, builder };
});

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}));

import { pipelineHistoryService } from './pipelineHistoryService';

describe('pipelineHistoryService.getStageHistory', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.select.mockClear();
    builder.order.mockClear();
    builder.limit.mockClear();
  });

  it('queries lead_stage_history ordered by changed_at ascending with a limit', async () => {
    builder.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: '1', lead_id: 'l1', from_stage_id: null, to_stage_id: 's1', changed_at: '2026-07-01T00:00:00Z' }], error: null });

    const result = await pipelineHistoryService.getStageHistory();

    expect(fromMock).toHaveBeenCalledWith('lead_stage_history');
    expect(builder.order).toHaveBeenCalledWith('changed_at', { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(5000);
    expect(result).toHaveLength(1);
    expect(result[0].to_stage_id).toBe('s1');
  });

  it('accepts a custom limit', async () => {
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
    await pipelineHistoryService.getStageHistory(1000);
    expect(builder.limit).toHaveBeenCalledWith(1000);
  });

  it('returns an empty array when data is null', async () => {
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
    const result = await pipelineHistoryService.getStageHistory();
    expect(result).toEqual([]);
  });

  it('throws when the query errors', async () => {
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: new Error('boom') });
    await expect(pipelineHistoryService.getStageHistory()).rejects.toThrow('boom');
  });
});
