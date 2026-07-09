import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, builder } = vi.hoisted(() => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.single = vi.fn();
  const fromMock = vi.fn(() => builder);
  return { fromMock, builder };
});

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}));

import { leadsService } from './leadsService';

describe('leadsService.getLeadById', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.select.mockClear();
    builder.eq.mockClear();
    builder.order.mockClear();
    builder.single.mockReset();
  });

  it('fetches lead + owner/stage/scores/history in a single round trip', async () => {
    builder.single.mockResolvedValue({
      data: { id: 'lead-1', company_name: 'Acme', scores: null, history: null },
      error: null,
    });

    const result = await leadsService.getLeadById('lead-1');

    expect(fromMock).toHaveBeenCalledWith('leads');
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith('id', 'lead-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', {
      foreignTable: 'history',
      ascending: false,
    });
    expect(result.company_name).toBe('Acme');
    expect(result.scores).toEqual([]);
    expect(result.history).toEqual([]);
  });

  it('preserves scores/history arrays when the query returns them', async () => {
    builder.single.mockResolvedValue({
      data: {
        id: 'lead-1',
        company_name: 'Acme',
        scores: [{ criterion: 'taille', value: 5 }],
        history: [{ action_type: 'note', content: 'hi' }],
      },
      error: null,
    });

    const result = await leadsService.getLeadById('lead-1');

    expect(result.scores).toHaveLength(1);
    expect(result.history).toHaveLength(1);
  });

  it('throws when the query errors', async () => {
    builder.single.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(leadsService.getLeadById('lead-1')).rejects.toThrow('boom');
  });
});
