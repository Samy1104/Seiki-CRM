import { contentService, type TagEntry } from './contentService';

export function parseLinkedInUrl(input: string): {
  alias: string;
  name: string;
  urn: string;
  type: 'organization' | 'person';
  url: string;
} {
  const cleanInput = input.trim();
  const isPerson = cleanInput.includes('/in/') || cleanInput.includes('person');

  const type: 'organization' | 'person' = isPerson ? 'person' : 'organization';

  // Extract path slug or clean handle
  let rawSlug = cleanInput;
  try {
    if (cleanInput.startsWith('http')) {
      const urlObj = new URL(cleanInput);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      rawSlug = parts[parts.length - 1] || parts[parts.length - 2] || 'account';
    } else {
      rawSlug = cleanInput.replace(/^@/, '');
    }
  } catch {
    rawSlug = cleanInput.replace(/^@/, '');
  }

  const alias = rawSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '');

  // Format readable display name from slug (e.g., "seiki-tech" -> "Seiki Tech")
  const name = rawSlug
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Check if input is already a valid URN string
  let urn = '';
  if (cleanInput.startsWith('urn:li:')) {
    urn = cleanInput;
  } else {
    // Check if input contains numerical ID (e.g. linkedin.com/company/1234567)
    const numMatch = cleanInput.match(/\b\d{5,12}\b/);
    if (numMatch) {
      urn = `urn:li:${type}:${numMatch[0]}`;
    } else {
      let hash = 0;
      for (let i = 0; i < cleanInput.length; i++) {
        hash = (hash << 5) - hash + cleanInput.charCodeAt(i);
        hash |= 0;
      }
      const idNum = Math.abs(hash);
      urn = `urn:li:${type}:${idNum}`;
    }
  }

  return {
    alias,
    name,
    urn,
    type,
    url: cleanInput.startsWith('http') ? cleanInput : `https://linkedin.com/company/${alias}`,
  };
}

export async function addAndPersistTag(
  urlOrHandle: string,
  customName?: string
): Promise<TagEntry> {
  const parsed = parseLinkedInUrl(urlOrHandle);
  const newTag: TagEntry = {
    alias: parsed.alias,
    name: customName?.trim() || parsed.name,
    urn: parsed.urn,
    url: parsed.url,
    type: parsed.type,
  };

  const currentTags = await contentService.getTagBook();
  const existingIdx = currentTags.findIndex(t => t.alias === newTag.alias);

  let updated: TagEntry[];
  if (existingIdx >= 0) {
    updated = [...currentTags];
    updated[existingIdx] = newTag;
  } else {
    updated = [...currentTags, newTag];
  }

  await contentService.saveTagBook(updated);
  return newTag;
}
