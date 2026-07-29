import { describe, it, expect } from 'vitest';
import { resolveStageIdForSentiment } from './replyStageResolver';

describe('resolveStageIdForSentiment', () => {
  it('returns the configured positive stage id for a positive sentiment', () => {
    expect(resolveStageIdForSentiment('positive', { positiveStageId: 'stage-a', negativeStageId: 'stage-b' })).toBe('stage-a');
  });

  it('returns the configured negative stage id for a negative sentiment', () => {
    expect(resolveStageIdForSentiment('negative', { positiveStageId: 'stage-a', negativeStageId: 'stage-b' })).toBe('stage-b');
  });

  it('returns null for a neutral sentiment regardless of configuration', () => {
    expect(resolveStageIdForSentiment('neutral', { positiveStageId: 'stage-a', negativeStageId: 'stage-b' })).toBeNull();
  });

  it('returns null when the matching stage is not configured', () => {
    expect(resolveStageIdForSentiment('positive', { positiveStageId: null, negativeStageId: 'stage-b' })).toBeNull();
  });
});
