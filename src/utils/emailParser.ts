export interface ParsedEmailBody {
  cleanBody: string;
  quotedBody?: string;
}

const QUOTE_HEADER_REGEX = /(^|\n)(Le\s+.*\s+a\s+écrit\s*:|On\s+.*\s+wrote\s*:|De\s*:|From\s*:|-----Original Message-----|--------------------------------)/i;

export function parseEmailBody(rawBody: string): ParsedEmailBody {
  if (!rawBody) return { cleanBody: '' };

  const match = rawBody.match(QUOTE_HEADER_REGEX);
  if (match && match.index !== undefined) {
    const offset = match[1] === '\n' ? 1 : 0;
    const splitIndex = match.index + offset;
    const cleanBody = rawBody.slice(0, splitIndex).trim();
    const quotedBody = rawBody.slice(splitIndex).trim();
    return {
      cleanBody: cleanBody || rawBody.trim(),
      quotedBody: quotedBody || undefined,
    };
  }

  // Fallback: check for lines starting with '>'
  const lines = rawBody.split('\n');
  const cleanLines: string[] = [];
  const quoteLines: string[] = [];
  let foundQuote = false;

  for (const line of lines) {
    if (line.trim().startsWith('>')) {
      foundQuote = true;
    }
    if (foundQuote) {
      quoteLines.push(line);
    } else {
      cleanLines.push(line);
    }
  }

  if (foundQuote && cleanLines.length > 0) {
    return {
      cleanBody: cleanLines.join('\n').trim(),
      quotedBody: quoteLines.join('\n').trim(),
    };
  }

  return { cleanBody: rawBody.trim() };
}
