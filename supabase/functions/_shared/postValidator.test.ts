import { describe, it, expect } from 'vitest';
import { validatePost } from './postValidator';
import type { VoiceProfile } from './voices/types';

const profile: VoiceProfile = {
  id: 'seiki',
  bio: 'Bio.',
  examples: [],
  tone: ['fier'],
  hook: { minWords: 1, maxWords: 5, mustBe: 'courte' },
  bannedPhrases: ['Nous sommes ravis de vous annoncer que', 'URGENT'],
  hashtags: { min: 2, max: 4 },
  bodyStyle: 'either',
};

describe('validatePost', () => {
  it('passes a post that respects all constraints', () => {
    const result = validatePost(
      { hook: 'Une accroche courte', corps: 'Un corps de post normal.', hashtags: ['Seiki', 'Data'] },
      profile
    );
    expect(result).toEqual({ valid: true, violations: [] });
  });

  it('flags a hook that is too long', () => {
    const result = validatePost(
      { hook: 'Une accroche beaucoup beaucoup trop longue pour respecter la contrainte', corps: 'Corps.', hashtags: ['Seiki', 'Data'] },
      profile
    );
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('Accroche'))).toBe(true);
  });

  it('flags a banned phrase regardless of case', () => {
    const result = validatePost(
      { hook: 'Accroche', corps: 'nous sommes ravis de vous annoncer que ça marche', hashtags: ['Seiki', 'Data'] },
      profile
    );
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('Nous sommes ravis'))).toBe(true);
  });

  it('flags a hashtag count outside bounds', () => {
    const result = validatePost(
      { hook: 'Accroche', corps: 'Corps.', hashtags: ['Seiki'] },
      profile
    );
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('hashtag'))).toBe(true);
  });

  it('accumulates multiple violations at once', () => {
    const result = validatePost(
      { hook: '', corps: 'urgent', hashtags: [] },
      profile
    );
    expect(result.violations.length).toBeGreaterThan(1);
  });
});
