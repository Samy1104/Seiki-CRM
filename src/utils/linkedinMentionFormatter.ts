import type { TagEntry } from '../services/contentService';

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface TagReplacement {
  pattern: string;
  regex: RegExp;
  replacement: string;
}

/**
 * Replaces `@alias` or `@Name` tokens in post text with official LinkedIn mention markup:
 * `@[Display Name](urn:li:organization:12345)` for organizations, or clean `@Name` text for persons.
 */
export function formatPostForLinkedIn(text: string, tagBook: TagEntry[]): string {
  if (!text) return '';
  
  let result = text;
  
  // Clean up legacy "Mentions : @alias (Name)" or "Mentions :" lines
  result = result.replace(/^Mentions\s*:\s*/gim, '');

  if (!tagBook || tagBook.length === 0) return result;

  const rules: TagReplacement[] = [];

  tagBook.forEach((tag) => {
    if (!tag.urn) return;
    const isPerson = tag.type === 'person' || tag.urn.startsWith('urn:li:person:');
    const replacement = isPerson ? `@${tag.name}` : `@[${tag.name}](${tag.urn})`;

    if (tag.alias && tag.name) {
      rules.push({
        pattern: `@${tag.alias} (${tag.name})`,
        regex: new RegExp(`@${escapeRegExp(tag.alias)}\\s*\\(${escapeRegExp(tag.name)}\\)`, 'gi'),
        replacement,
      });
    }

    if (tag.name) {
      rules.push({
        pattern: `@${tag.name}`,
        regex: new RegExp(`@${escapeRegExp(tag.name)}\\b`, 'gi'),
        replacement,
      });
      rules.push({
        pattern: `@{${tag.name}}`,
        regex: new RegExp(`@\\{${escapeRegExp(tag.name)}\\}`, 'gi'),
        replacement,
      });
    }

    if (tag.alias) {
      rules.push({
        pattern: `@${tag.alias}`,
        regex: new RegExp(`@${escapeRegExp(tag.alias)}\\b`, 'gi'),
        replacement,
      });
      rules.push({
        pattern: `@{${tag.alias}}`,
        regex: new RegExp(`@\\{${escapeRegExp(tag.alias)}\\}`, 'gi'),
        replacement,
      });
    }
  });

  // Deduplicate rules by pattern string (case-insensitive key)
  const uniqueRulesMap = new Map<string, TagReplacement>();
  rules.forEach((rule) => {
    const key = rule.pattern.toLowerCase();
    if (!uniqueRulesMap.has(key)) {
      uniqueRulesMap.set(key, rule);
    }
  });

  // Sort rules by pattern length descending so longer matches take precedence
  const sortedRules = Array.from(uniqueRulesMap.values()).sort(
    (a, b) => b.pattern.length - a.pattern.length
  );

  // Use placeholder tokens to prevent double-matching shorter substrings
  const placeholders: string[] = [];
  sortedRules.forEach((rule, idx) => {
    const placeholder = `___LK_TAG_PLACEHOLDER_${idx}___`;
    if (rule.regex.test(result)) {
      placeholders[idx] = rule.replacement;
      result = result.replace(rule.regex, placeholder);
    }
  });

  // Swap placeholders back to final replacement content
  placeholders.forEach((finalContent, idx) => {
    if (finalContent !== undefined) {
      const placeholder = `___LK_TAG_PLACEHOLDER_${idx}___`;
      result = result.replaceAll(placeholder, finalContent);
    }
  });

  return result;
}

export function formatPostForCleanDisplay(text: string, tagBook: TagEntry[]): string {
  if (!text) return '';
  let result = text.replace(/^Mentions\s*:\s*/gim, '');
  if (!tagBook || tagBook.length === 0) return result;

  tagBook.forEach((tag) => {
    if (tag.alias && tag.name) {
      const aliasPatt = new RegExp(`@${escapeRegExp(tag.alias)}\\b`, 'gi');
      result = result.replace(aliasPatt, `@${tag.name}`);
    }
  });
  return result;
}
