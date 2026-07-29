import { describe, it, expect } from 'vitest';
import { formatLocation } from './calendlyApi.ts';

describe('formatLocation', () => {
  it('returns null when location is null', () => {
    expect(formatLocation(null)).toBeNull();
  });

  it('prefers join_url when both join_url and location are present', () => {
    expect(formatLocation({ type: 'zoom_conference', join_url: 'https://zoom.us/j/123', location: 'Paris' })).toBe(
      'https://zoom.us/j/123',
    );
  });

  it('falls back to location when join_url is absent', () => {
    expect(formatLocation({ type: 'physical', location: '12 rue de Paris' })).toBe('12 rue de Paris');
  });

  it('returns null when neither join_url nor location is present', () => {
    expect(formatLocation({ type: 'ask_invitee' })).toBeNull();
  });
});
