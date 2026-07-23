import type { VoiceProfile } from './voices/types.ts';

export interface PostShape {
  hook: string;
  corps: string;
  hashtags: string[];
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

export function validatePost(post: PostShape, profile: VoiceProfile): ValidationResult {
  const violations: string[] = [];

  const hookWordCount = post.hook.trim().split(/\s+/).filter(Boolean).length;
  if (hookWordCount < profile.hook.minWords || hookWordCount > profile.hook.maxWords) {
    violations.push(
      `Accroche de ${hookWordCount} mots, attendu entre ${profile.hook.minWords} et ${profile.hook.maxWords} mots.`
    );
  }

  const haystack = `${post.hook} ${post.corps}`.toLowerCase();
  for (const banned of profile.bannedPhrases) {
    if (haystack.includes(banned.toLowerCase())) {
      violations.push(`Formule interdite utilisée : "${banned}".`);
    }
  }

  const hashtagCount = post.hashtags.length;
  if (hashtagCount < profile.hashtags.min || hashtagCount > profile.hashtags.max) {
    violations.push(
      `${hashtagCount} hashtags, attendu entre ${profile.hashtags.min} et ${profile.hashtags.max}.`
    );
  }

  return { valid: violations.length === 0, violations };
}
