// ============================================================
// _shared/gmailMessageParser.ts
// Lecture pure des messages Gmail (format API `format=full`) —
// zéro import Deno, portable et testable avec Vitest.
// ============================================================

export interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  payload: {
    headers: { name: string; value: string }[];
    parts?: GmailMessagePart[];
    body?: { data?: string };
  };
}

export function getHeader(msg: GmailMessage, name: string): string | null {
  const found = msg.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found ? found.value : null;
}

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}

function findTextPlainPart(parts: GmailMessagePart[]): GmailMessagePart | null {
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) return part;
    if (part.parts) {
      const nested = findTextPlainPart(part.parts);
      if (nested) return nested;
    }
  }
  return null;
}

export function extractPlainTextBody(msg: GmailMessage): string {
  if (msg.payload.parts) {
    const part = findTextPlainPart(msg.payload.parts);
    return part?.body?.data ? decodeBase64Url(part.body.data) : '';
  }
  return msg.payload.body?.data ? decodeBase64Url(msg.payload.body.data) : '';
}
