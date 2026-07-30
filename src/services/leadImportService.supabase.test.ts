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
    mockedFrom.mockReturnValue(
      queryResult([
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
      ])
    );

    const map = await leadImportService.fetchExistingLeadsByEmail();

    expect(mockedFrom).toHaveBeenCalledWith('leads');
    expect(map.get('jean@acme.com')?.id).toBe('lead-1');
  });
});

describe('leadImportService.getProspectStageId', () => {
  it('returns the id of the stage named Prospect', async () => {
    mockedFrom.mockReturnValue(queryResult({ id: 'stage-1' }));
    const id = await leadImportService.getProspectStageId();
    expect(id).toBe('stage-1');
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
});
