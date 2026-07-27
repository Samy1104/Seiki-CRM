import { describe, it, expect } from 'vitest';
import { formatPostForLinkedIn } from './linkedinMentionFormatter';
import type { TagEntry } from '../services/contentService';

describe('formatPostForLinkedIn', () => {
  const mockTagBook: TagEntry[] = [
    { alias: 'seiki', name: 'Seiki Mobility', urn: 'urn:li:organization:12345', type: 'organization' },
    { alias: 'jaafar', name: 'Jaafar Bounaim', urn: 'urn:li:person:67890', type: 'person' },
    { alias: 'seiki-tech', name: 'Seiki Tech', urn: 'urn:li:organization:99999', type: 'organization' },
  ];

  it('replaces @alias tokens with full LinkedIn URN mention format', () => {
    const raw = 'Merci à @seiki et @jaafar pour ce projet !';
    const formatted = formatPostForLinkedIn(raw, mockTagBook);
    expect(formatted).toBe(
      'Merci à @[Seiki Mobility](urn:li:organization:12345) et @[Jaafar Bounaim](urn:li:person:67890) pour ce projet !'
    );
  });

  it('replaces @Name tokens with LinkedIn URN mention format', () => {
    const raw = 'Projet co-réalisé avec @Jaafar Bounaim et @Seiki Mobility';
    const formatted = formatPostForLinkedIn(raw, mockTagBook);
    expect(formatted).toBe(
      'Projet co-réalisé avec @[Jaafar Bounaim](urn:li:person:67890) et @[Seiki Mobility](urn:li:organization:12345)'
    );
  });

  it('handles multiple tags in complex text', () => {
    const raw = 'Top post par @seiki-tech, reposté par @seiki et mentionnant @jaafar.';
    const formatted = formatPostForLinkedIn(raw, mockTagBook);
    expect(formatted).toBe(
      'Top post par @[Seiki Tech](urn:li:organization:99999), reposté par @[Seiki Mobility](urn:li:organization:12345) et mentionnant @[Jaafar Bounaim](urn:li:person:67890).'
    );
  });

  it('returns plain text unchanged if no tags match or tagBook is empty', () => {
    const raw = 'Voici un post sans aucune mention @inconnu.';
    expect(formatPostForLinkedIn(raw, mockTagBook)).toBe(raw);
    expect(formatPostForLinkedIn(raw, [])).toBe(raw);
  });

  it('handles empty string gracefully', () => {
    expect(formatPostForLinkedIn('', mockTagBook)).toBe('');
  });
});
