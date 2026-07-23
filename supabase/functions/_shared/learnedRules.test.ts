import { describe, it, expect } from 'vitest';
import { appendLearnedRule, formatLearnedRulesForPrompt, buildExtractionPrompt, type LearnedRuleEntry } from './learnedRules';

describe('appendLearnedRule', () => {
  it('returns a new array with the entry appended, without mutating the input', () => {
    const existing: LearnedRuleEntry[] = [{ rule: 'A', reason: 'r1', learned_at: '2026-01-01T00:00:00Z' }];
    const entry: LearnedRuleEntry = { rule: 'B', reason: 'r2', learned_at: '2026-01-02T00:00:00Z' };

    const result = appendLearnedRule(existing, entry);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(entry);
    expect(existing).toHaveLength(1);
  });
});

describe('formatLearnedRulesForPrompt', () => {
  it('returns null for an empty list', () => {
    expect(formatLearnedRulesForPrompt([])).toBeNull();
  });

  it('formats entries as a bullet list of rule text', () => {
    const entries: LearnedRuleEntry[] = [
      { rule: 'Éviter les emojis en début de phrase', reason: 'diff observé', learned_at: '2026-01-01T00:00:00Z' },
      { rule: 'Toujours signer Seiki', reason: 'diff observé', learned_at: '2026-01-02T00:00:00Z' },
    ];
    expect(formatLearnedRulesForPrompt(entries)).toBe(
      '- Éviter les emojis en début de phrase\n- Toujours signer Seiki'
    );
  });
});

describe('buildExtractionPrompt', () => {
  it('includes existing rules, and both post versions', () => {
    const prompt = buildExtractionPrompt(
      'Seiki (entreprise)',
      [{ rule: 'Règle existante', reason: 'x', learned_at: '2026-01-01T00:00:00Z' }],
      { hook: 'Hook original', corps: 'Corps original', hashtags: ['A'] },
      { hook: 'Hook édité', corps: 'Corps édité', hashtags: ['A', 'B'] }
    );
    expect(prompt).toContain('Règle existante');
    expect(prompt).toContain('Hook original');
    expect(prompt).toContain('Hook édité');
  });

  it('shows a placeholder when there are no existing rules', () => {
    const prompt = buildExtractionPrompt(
      'Seiki (entreprise)',
      [],
      { hook: 'H', corps: 'C', hashtags: [] },
      { hook: 'H', corps: 'C2', hashtags: [] }
    );
    expect(prompt).toContain('(aucune règle apprise pour le moment)');
  });
});
