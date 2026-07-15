import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, builder, storageFromMock } = vi.hoisted(() => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.single = vi.fn();
  const fromMock = vi.fn(() => builder);

  const storageBuilder: any = { upload: vi.fn() };
  const storageFromMock = vi.fn(() => storageBuilder);

  return { fromMock, builder, storageFromMock };
});

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock, storage: { from: storageFromMock } },
}));

import { linkedinService } from './linkedinService';

describe('linkedinService.listScheduledPosts', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.select.mockClear();
    builder.order.mockClear();
  });

  it('fetches posts ordered by scheduled_at ascending', async () => {
    builder.order.mockResolvedValue({ data: [{ id: 'p1', scheduled_at: '2026-08-01T10:00:00Z' }], error: null });

    const result = await linkedinService.listScheduledPosts();

    expect(fromMock).toHaveBeenCalledWith('scheduled_linkedin_posts');
    expect(builder.order).toHaveBeenCalledWith('scheduled_at', { ascending: true });
    expect(result).toHaveLength(1);
  });

  it('throws when the query errors', async () => {
    builder.order.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(linkedinService.listScheduledPosts()).rejects.toThrow('boom');
  });
});

describe('linkedinService.cancelScheduledPost', () => {
  beforeEach(() => {
    fromMock.mockClear();
    builder.delete.mockClear();
    builder.eq.mockClear();
  });

  it('deletes the row by id', async () => {
    builder.eq.mockResolvedValue({ error: null });
    await linkedinService.cancelScheduledPost('p1');
    expect(fromMock).toHaveBeenCalledWith('scheduled_linkedin_posts');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1');
  });
});

describe('linkedinService.oauthConnectUrl', () => {
  it('builds the edge function URL with target and label', () => {
    const url = linkedinService.oauthConnectUrl('personal', 'Jaafar');
    expect(url).toContain('/functions/v1/linkedin-oauth-start');
    expect(url).toContain('target=personal');
    expect(url).toContain('label=Jaafar');
  });
});
