import { describe, it, expect } from 'vitest';
import { getHeader, extractPlainTextBody, type GmailMessage } from './gmailMessageParser';

function b64url(text: string): string {
  const b64 = btoa(unescape(encodeURIComponent(text)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('getHeader', () => {
  const msg: GmailMessage = {
    id: '1', threadId: 't1',
    payload: { headers: [{ name: 'From', value: 'a@b.com' }, { name: 'Subject', value: 'Hi' }] },
  };

  it('finds a header case-insensitively', () => {
    expect(getHeader(msg, 'from')).toBe('a@b.com');
    expect(getHeader(msg, 'SUBJECT')).toBe('Hi');
  });

  it('returns null for a missing header', () => {
    expect(getHeader(msg, 'X-Missing')).toBeNull();
  });
});

describe('extractPlainTextBody', () => {
  it('extracts body from a single-part message', () => {
    const msg: GmailMessage = {
      id: '1', threadId: 't1',
      payload: { headers: [], body: { data: b64url('Bonjour, ça va ?') } },
    };
    expect(extractPlainTextBody(msg)).toBe('Bonjour, ça va ?');
  });

  it('extracts text/plain part from a multipart/alternative message', () => {
    const msg: GmailMessage = {
      id: '1', threadId: 't1',
      payload: {
        headers: [],
        parts: [
          { mimeType: 'text/plain', body: { data: b64url('Plain reply') } },
          { mimeType: 'text/html', body: { data: b64url('<p>Html reply</p>') } },
        ],
      },
    };
    expect(extractPlainTextBody(msg)).toBe('Plain reply');
  });

  it('finds text/plain nested inside multipart/mixed > multipart/alternative', () => {
    const msg: GmailMessage = {
      id: '1', threadId: 't1',
      payload: {
        headers: [],
        parts: [
          {
            mimeType: 'multipart/alternative',
            parts: [
              { mimeType: 'text/plain', body: { data: b64url('Nested plain') } },
            ],
          },
        ],
      },
    };
    expect(extractPlainTextBody(msg)).toBe('Nested plain');
  });

  it('returns empty string when no text/plain part exists', () => {
    const msg: GmailMessage = {
      id: '1', threadId: 't1',
      payload: { headers: [], parts: [{ mimeType: 'text/html', body: { data: b64url('<p>only html</p>') } }] },
    };
    expect(extractPlainTextBody(msg)).toBe('');
  });
});
