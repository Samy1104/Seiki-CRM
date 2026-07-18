import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, builder, rpcMock } = vi.hoisted(() => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.single = vi.fn();
  const fromMock = vi.fn(() => builder);
  const rpcMock = vi.fn();
  return { fromMock, builder, rpcMock };
});

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
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

describe('leadsService.resolveMergeProposal', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('delegates to the resolve_merge_proposal RPC (single transaction, not 4 sequential writes)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await leadsService.resolveMergeProposal('proposal-1', 'approved', 'resolver-1');

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('resolve_merge_proposal', {
      p_proposal_id: 'proposal-1',
      p_status: 'approved',
      p_resolver_id: 'resolver-1',
    });
  });

  it('defaults resolverId to null when not provided', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await leadsService.resolveMergeProposal('proposal-2', 'rejected');

    expect(rpcMock).toHaveBeenCalledWith('resolve_merge_proposal', {
      p_proposal_id: 'proposal-2',
      p_status: 'rejected',
      p_resolver_id: null,
    });
  });

  it('throws when the RPC errors, instead of silently leaving the proposal half-resolved', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('db exploded') });

    await expect(leadsService.resolveMergeProposal('proposal-3', 'approved')).rejects.toThrow('db exploded');
  });
});
