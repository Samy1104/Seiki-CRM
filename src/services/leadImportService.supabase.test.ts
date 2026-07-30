import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from './supabaseClient';
import { leadImportService } from './leadImportService';
import type { NewLeadRow, UpdateLeadRow } from './leadImportService';

function queryResult<T>(data: T, error: any = null) {
  const promise: any = Promise.resolve({ data, error });
  const chain = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'is', 'not', 'order', 'maybeSingle', 'single'];
  chain.forEach((method) => {
    promise[method] = vi.fn(() => promise);
  });
  return promise;
}

const mockedFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedFrom.mockReset();
});

describe('leadImportService.fetchExistingLeadsByEmail', () => {
  it('returns a map of existing leads keyed by lowercased email', async () => {
    const mockQueryChain = queryResult([
      {
        id: 'lead-1',
        email: 'Jean@Acme.com',
        contact_name: '—',
        phone: null,
        linkedin_url: null,
        website: null,
        deal_value: 0,
        note: null,
      },
    ]);
    mockedFrom.mockReturnValue(mockQueryChain);

    const map = await leadImportService.fetchExistingLeadsByEmail();

    expect(mockedFrom).toHaveBeenCalledWith('leads');
    expect(map.get('jean@acme.com')?.id).toBe('lead-1');
  });

  it('filters out archived leads, unmerged leads, and null emails via Supabase query chain', async () => {
    const mockQueryChain = queryResult([]);
    mockedFrom.mockReturnValue(mockQueryChain);

    await leadImportService.fetchExistingLeadsByEmail();

    expect(mockQueryChain.not).toHaveBeenCalledWith('email', 'is', null);
    expect(mockQueryChain.is).toHaveBeenCalledWith('merged_into_id', null);
    expect(mockQueryChain.eq).toHaveBeenCalledWith('is_archived', false);
  });
});

describe('leadImportService.getProspectStageId', () => {
  it('returns the id of the stage named Prospect', async () => {
    const mockQueryChain = queryResult({ id: 'stage-1' });
    mockedFrom.mockReturnValue(mockQueryChain);
    const id = await leadImportService.getProspectStageId();
    expect(id).toBe('stage-1');
  });

  it('filters stages by name "Prospect" via Supabase query', async () => {
    const mockQueryChain = queryResult({ id: 'stage-1' });
    mockedFrom.mockReturnValue(mockQueryChain);
    await leadImportService.getProspectStageId();
    expect(mockQueryChain.eq).toHaveBeenCalledWith('name', 'Prospect');
  });

  it('throws if no Prospect stage exists', async () => {
    mockedFrom.mockReturnValue(queryResult(null));
    await expect(leadImportService.getProspectStageId()).rejects.toThrow(/Prospect/);
  });
});

describe('leadImportService.commitImport', () => {
  it('inserts new leads, logs history for each, and updates matched leads with only their fill fields', async () => {
    const leadsQuery = queryResult([{ id: 'new-1' }]);
    const historyQuery = queryResult([]);

    mockedFrom.mockImplementation((table: string) => {
      if (table === 'leads') return leadsQuery;
      if (table === 'history') return historyQuery;
      throw new Error(`unexpected table ${table}`);
    });

    const toCreate: NewLeadRow[] = [
      {
        rowNumber: 2,
        payload: {
          company_name: 'Acme Corp',
          segment: 'Retail',
          contact_name: 'Jean Dupont',
          email: 'jean@acme.com',
          phone: null,
          linkedin_url: null,
          website: null,
          source: 'Autre',
          deal_value: 50,
          note: null,
          stage_id: 'stage-1',
          owner_id: null,
          score: 0,
          is_archived: false,
          email_verified: false,
          custom_fields: {},
        },
      },
    ];
    const toUpdate: UpdateLeadRow[] = [
      { rowNumber: 3, existingLeadId: 'lead-9', fieldsToFill: { phone: '0600000000' } },
      { rowNumber: 4, existingLeadId: 'lead-10', fieldsToFill: {} },
    ];

    const summary = await leadImportService.commitImport(toCreate, toUpdate);

    expect(summary).toEqual({ created: 1, updated: 1 });
    expect(leadsQuery.insert).toHaveBeenCalledWith([toCreate[0].payload]);
    expect(leadsQuery.update).toHaveBeenCalledWith(expect.objectContaining({ phone: '0600000000' }));
  });

  it('logs history for each created and updated lead with action_type "note"', async () => {
    const leadsQuery = queryResult([{ id: 'new-1' }]);
    const historyQuery = queryResult([]);

    mockedFrom.mockImplementation((table: string) => {
      if (table === 'leads') return leadsQuery;
      if (table === 'history') return historyQuery;
      throw new Error(`unexpected table ${table}`);
    });

    const toCreate: NewLeadRow[] = [
      {
        rowNumber: 2,
        payload: {
          company_name: 'Acme Corp',
          segment: 'Retail',
          contact_name: 'Jean Dupont',
          email: 'jean@acme.com',
          phone: null,
          linkedin_url: null,
          website: null,
          source: 'Autre',
          deal_value: 50,
          note: null,
          stage_id: 'stage-1',
          owner_id: null,
          score: 0,
          is_archived: false,
          email_verified: false,
          custom_fields: {},
        },
      },
    ];
    const toUpdate: UpdateLeadRow[] = [
      { rowNumber: 3, existingLeadId: 'lead-9', fieldsToFill: { phone: '0600000000' } },
    ];

    await leadImportService.commitImport(toCreate, toUpdate);

    const historyInsertCalls = (historyQuery.insert as any).mock.calls;
    expect(historyInsertCalls.length).toBeGreaterThan(0);

    // Check that at least one insert call contains action_type: 'note' for created leads
    const createdLeadHistory = historyInsertCalls[0]?.[0];
    expect(createdLeadHistory).toBeDefined();
    expect(createdLeadHistory[0]?.action_type).toBe('note');
    expect(createdLeadHistory[0]?.content).toBe('Lead créé (import en masse)');

    // Check that the second insert call (for updated leads) also contains action_type: 'note'
    const updatedLeadHistory = historyInsertCalls[1]?.[0];
    expect(updatedLeadHistory).toBeDefined();
    expect(updatedLeadHistory[0]?.action_type).toBe('note');
    expect(updatedLeadHistory[0]?.content).toBe('Lead mis à jour (import en masse)');
  });
});
