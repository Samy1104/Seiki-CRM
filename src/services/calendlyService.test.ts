import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, builder } = vi.hoisted(() => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn();
  const fromMock = vi.fn(() => builder);
  return { fromMock, builder };
});

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}));

import { calendlyService } from './calendlyService';

describe('calendlyService.listBookings', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.select.mockClear();
    builder.order.mockClear();
  });

  it('fetches bookings ordered by start_time ascending', async () => {
    builder.order.mockResolvedValue({ data: [{ id: 'b1', start_time: '2026-08-01T10:00:00Z' }], error: null });

    const result = await calendlyService.listBookings();

    expect(fromMock).toHaveBeenCalledWith('calendly_bookings');
    expect(builder.order).toHaveBeenCalledWith('start_time', { ascending: true });
    expect(result).toHaveLength(1);
  });

  it('throws when the query errors', async () => {
    builder.order.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(calendlyService.listBookings()).rejects.toThrow('boom');
  });
});

describe('calendlyService.getAccount', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.maybeSingle.mockClear();
  });

  it('returns null when no account is connected', async () => {
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await calendlyService.getAccount();
    expect(result).toBeNull();
  });
});

describe('calendlyService.oauthConnectUrl', () => {
  it('builds the edge function URL with the current origin', () => {
    const url = calendlyService.oauthConnectUrl();
    expect(url).toContain('/functions/v1/calendly-oauth-start');
    expect(url).toContain('origin=');
  });
});
