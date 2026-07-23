import { describe, it, expect } from 'vitest';
import { seikiProfile } from './seiki';
import { jaafarProfile } from './jaafar';

describe.each([
  ['seiki', seikiProfile],
  ['jaafar', jaafarProfile],
])('%s voice profile', (id, profile) => {
  it(`has id "${id}" and non-empty bio/examples`, () => {
    expect(profile.id).toBe(id);
    expect(profile.bio.length).toBeGreaterThan(0);
    expect(profile.examples.length).toBeGreaterThan(0);
    for (const example of profile.examples) {
      expect(example.text.length).toBeGreaterThan(0);
    }
  });

  it('has sane hook and hashtag bounds', () => {
    expect(profile.hook.minWords).toBeGreaterThan(0);
    expect(profile.hook.maxWords).toBeGreaterThanOrEqual(profile.hook.minWords);
    expect(profile.hashtags.min).toBeGreaterThan(0);
    expect(profile.hashtags.max).toBeGreaterThanOrEqual(profile.hashtags.min);
  });

  it('carries the shared banned-phrase list', () => {
    expect(profile.bannedPhrases).toContain('Nous sommes ravis de vous annoncer que');
    expect(profile.bannedPhrases).toContain('N\'hésitez pas à nous contacter');
  });
});

it('seiki examples include the Neuilly and Monaco case studies', () => {
  expect(seikiProfile.examples.some((e) => e.text.includes('Neuilly-sur-Seine'))).toBe(true);
  expect(seikiProfile.examples.some((e) => e.text.includes('Monaco'))).toBe(true);
});

it('jaafar examples are written in first person', () => {
  expect(jaafarProfile.examples.length).toBe(3);
});
