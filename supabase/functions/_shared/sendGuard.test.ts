import { describe, it, expect } from 'vitest';
import { shouldSkipSendForLeadStatus } from './sendGuard';

describe('shouldSkipSendForLeadStatus', () => {
  it('skips sending when the lead has replied', () => {
    expect(shouldSkipSendForLeadStatus('replied')).toBe(true);
  });

  it('skips sending when the sequence is already completed', () => {
    expect(shouldSkipSendForLeadStatus('completed')).toBe(true);
  });

  it('allows sending for an idle lead', () => {
    expect(shouldSkipSendForLeadStatus('idle')).toBe(false);
  });

  it('allows sending for an active lead', () => {
    expect(shouldSkipSendForLeadStatus('active')).toBe(false);
  });

  it('allows sending for a paused lead', () => {
    expect(shouldSkipSendForLeadStatus('paused')).toBe(false);
  });
});
