import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseLinkedInUrl, addAndPersistTag } from './linkedinTagService';
import { contentService } from './contentService';

vi.mock('./contentService', () => ({
  contentService: {
    getTagBook: vi.fn(),
    saveTagBook: vi.fn(),
  },
}));

describe('linkedinTagService.parseLinkedInUrl', () => {
  it('parses company URLs correctly', () => {
    const res = parseLinkedInUrl('https://www.linkedin.com/company/seiki-tech/');
    expect(res.type).toBe('organization');
    expect(res.alias).toBe('seiki-tech');
    expect(res.name).toBe('Seiki Tech');
    expect(res.urn).toMatch(/^urn:li:organization:/);
    expect(res.url).toBe('https://www.linkedin.com/company/seiki-tech/');
  });

  it('parses personal profile URLs correctly', () => {
    const res = parseLinkedInUrl('https://www.linkedin.com/in/jaafar-bounaim/');
    expect(res.type).toBe('person');
    expect(res.alias).toBe('jaafar-bounaim');
    expect(res.name).toBe('Jaafar Bounaim');
    expect(res.urn).toMatch(/^urn:li:person:/);
    expect(res.url).toBe('https://www.linkedin.com/in/jaafar-bounaim/');
  });

  it('parses raw handle with @ symbol', () => {
    const res = parseLinkedInUrl('@lyon-mobility');
    expect(res.type).toBe('organization');
    expect(res.alias).toBe('lyon-mobility');
    expect(res.name).toBe('Lyon Mobility');
    expect(res.urn).toMatch(/^urn:li:organization:/);
    expect(res.url).toBe('https://linkedin.com/company/lyon-mobility');
  });

  it('handles handles without @ or http', () => {
    const res = parseLinkedInUrl('seiki-tech');
    expect(res.alias).toBe('seiki-tech');
    expect(res.name).toBe('Seiki Tech');
  });
});

describe('linkedinTagService.addAndPersistTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts a new tag into empty tag book', async () => {
    vi.mocked(contentService.getTagBook).mockResolvedValue([]);
    vi.mocked(contentService.saveTagBook).mockResolvedValue();

    const tag = await addAndPersistTag('https://www.linkedin.com/company/seiki-tech/');
    expect(tag).toEqual({
      alias: 'seiki-tech',
      name: 'Seiki Tech',
      urn: expect.stringMatching(/^urn:li:organization:/),
      url: 'https://www.linkedin.com/company/seiki-tech/',
      type: 'organization',
    });

    expect(contentService.saveTagBook).toHaveBeenCalledWith([tag]);
  });

  it('upserts existing tag replacing old entry and respecting customName', async () => {
    const existingTag = {
      alias: 'seiki-tech',
      name: 'Old Name',
      urn: 'urn:li:organization:123',
    };
    vi.mocked(contentService.getTagBook).mockResolvedValue([existingTag]);
    vi.mocked(contentService.saveTagBook).mockResolvedValue();

    const tag = await addAndPersistTag('@seiki-tech', 'Seiki Custom Name');
    expect(tag.name).toBe('Seiki Custom Name');
    expect(contentService.saveTagBook).toHaveBeenCalledWith([
      expect.objectContaining({
        alias: 'seiki-tech',
        name: 'Seiki Custom Name',
      }),
    ]);
  });
});
