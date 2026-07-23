import { describe, it, expect, vi, beforeEach } from 'vitest';

const { callEdgeFunctionMock } = vi.hoisted(() => ({ callEdgeFunctionMock: vi.fn() }));

vi.mock('./edgeFunctions', () => ({ callEdgeFunction: callEdgeFunctionMock }));
vi.mock('./supabaseClient', () => ({ supabase: { from: vi.fn() } }));

import { contentService } from './contentService';

describe('contentService.generateLinkedInPost', () => {
  beforeEach(() => {
    callEdgeFunctionMock.mockReset();
  });

  it('returns the post with empty warnings when validation passed', async () => {
    callEdgeFunctionMock.mockResolvedValue({
      success: true,
      post: { hook: 'H', corps: 'C', hashtags: ['A'] },
      validation_warnings: [],
      meta: { model: 'gemini-2.5-flash', voice: 'seiki', language: 'fr', generationMs: 100 },
    });

    const result = await contentService.generateLinkedInPost('brief', 'seiki', 'fr');

    expect(result.post).toEqual({ hook: 'H', corps: 'C', hashtags: ['A'] });
    expect(result.validationWarnings).toEqual([]);
  });

  it('passes through non-empty validation warnings', async () => {
    callEdgeFunctionMock.mockResolvedValue({
      success: true,
      post: { hook: 'H', corps: 'C', hashtags: ['A'] },
      validation_warnings: ['3 hashtags, attendu entre 5 et 10.'],
      meta: { model: 'gemini-2.5-flash', voice: 'seiki', language: 'fr', generationMs: 100 },
    });

    const result = await contentService.generateLinkedInPost('brief', 'seiki', 'fr');

    expect(result.validationWarnings).toEqual(['3 hashtags, attendu entre 5 et 10.']);
  });

  it('falls back to a client-side post with empty warnings when the edge function fails', async () => {
    callEdgeFunctionMock.mockRejectedValue(new Error('network down'));

    const result = await contentService.generateLinkedInPost('Un brief de secours', 'jaafar', 'fr');

    expect(result.post.hook).toContain('Un brief de secours');
    expect(result.validationWarnings).toEqual([]);
  });
});
