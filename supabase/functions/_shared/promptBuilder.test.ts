import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder';
import { seikiProfile } from './voices/seiki';

describe('buildSystemPrompt', () => {
  it('places hard constraints after the examples block (recency ordering)', () => {
    const prompt = buildSystemPrompt(seikiProfile, 'fr', null);
    const examplesIndex = prompt.indexOf('EXEMPLES DE POSTS');
    const constraintsIndex = prompt.indexOf('CONTRAINTES STRICTES');
    expect(examplesIndex).toBeGreaterThan(-1);
    expect(constraintsIndex).toBeGreaterThan(examplesIndex);
  });

  it('includes every banned phrase from the profile', () => {
    const prompt = buildSystemPrompt(seikiProfile, 'fr', null);
    for (const phrase of seikiProfile.bannedPhrases) {
      expect(prompt).toContain(phrase);
    }
  });

  it('omits the learned-rules block when null, includes it before the hard constraints when present', () => {
    const withoutLearned = buildSystemPrompt(seikiProfile, 'fr', null);
    expect(withoutLearned).not.toContain('Règles apprises');

    const withLearned = buildSystemPrompt(seikiProfile, 'fr', '- Éviter les emojis en début de phrase');
    const learnedIndex = withLearned.indexOf('Règles apprises');
    const constraintsIndex = withLearned.indexOf('CONTRAINTES STRICTES');
    expect(learnedIndex).toBeGreaterThan(-1);
    expect(constraintsIndex).toBeGreaterThan(learnedIndex);
    expect(withLearned).toContain('Éviter les emojis en début de phrase');
  });

  it('switches the language instruction for English', () => {
    expect(buildSystemPrompt(seikiProfile, 'en', null)).toContain('Write the post in English.');
    expect(buildSystemPrompt(seikiProfile, 'fr', null)).toContain('Rédige le post en français.');
  });
});

describe('buildUserPrompt', () => {
  it('has no retry block on first attempt', () => {
    const prompt = buildUserPrompt('Un brief de test');
    expect(prompt).not.toContain('violait');
  });

  it('appends the violations as a retry instruction', () => {
    const prompt = buildUserPrompt('Un brief de test', ['3 hashtags, attendu entre 5 et 10.']);
    expect(prompt).toContain('violait');
    expect(prompt).toContain('3 hashtags, attendu entre 5 et 10.');
  });
});
