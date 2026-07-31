import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, builder } = vi.hoisted(() => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn();
  builder.insert = vi.fn(() => builder);
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
  const fromMock = vi.fn(() => builder);
  return { fromMock, builder };
});

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}));

import { settingsService } from './settingsService';

describe('settingsService.getCodirHistory', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.select.mockClear();
    builder.order.mockClear();
    builder.maybeSingle.mockReset();
    builder.insert.mockClear();
  });

  it('queries codir_meetings ordered by meeting_date ascending', async () => {
    builder.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: 'm1', meeting_date: '2026-07-15T00:00:00Z', label: null }], error: null });

    const result = await settingsService.getCodirHistory();

    expect(fromMock).toHaveBeenCalledWith('codir_meetings');
    expect(builder.order).toHaveBeenCalledWith('meeting_date', { ascending: true });
    expect(result).toEqual([{ id: 'm1', meeting_date: '2026-07-15T00:00:00Z', label: null }]);
  });

  it('returns an empty array when data is null', async () => {
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
    const result = await settingsService.getCodirHistory();
    expect(result).toEqual([]);
  });
});

describe('settingsService.addCodirDate', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.insert.mockClear();
    builder.select.mockClear();
    builder.order.mockClear();
  });

  it('inserts a new codir_meetings row and returns the refreshed list', async () => {
    let call = 0;
    builder.then = (resolve: (v: unknown) => void) => {
      call += 1;
      if (call === 1) return resolve({ data: null, error: null }); // insert
      return resolve({
        data: [{ id: 'm1', meeting_date: '2026-07-30T00:00:00.000Z', label: null }],
        error: null,
      }); // getCodirHistory refetch
    };

    const result = await settingsService.addCodirDate('2026-07-30T00:00:00.000Z');

    expect(fromMock).toHaveBeenCalledWith('codir_meetings');
    expect(builder.insert).toHaveBeenCalledWith([{ meeting_date: '2026-07-30T00:00:00.000Z', label: null }]);
    expect(result).toHaveLength(1);
  });
});

describe('settingsService.deleteCodirMeeting', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.select.mockClear();
    builder.eq.mockClear();
    builder.order.mockClear();
  });

  it('deletes a codir_meetings row by id and returns updated history', async () => {
    builder.delete = vi.fn(() => builder);
    let call = 0;
    builder.then = (resolve: (v: unknown) => void) => {
      call += 1;
      if (call === 1) return resolve({ data: null, error: null }); // delete operation
      return resolve({ data: [], error: null }); // getCodirHistory refetch
    };

    const result = await settingsService.deleteCodirMeeting('m1');

    expect(fromMock).toHaveBeenCalledWith('codir_meetings');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'm1');
    expect(result).toEqual([]);
  });
});
