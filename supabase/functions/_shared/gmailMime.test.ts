import { describe, it, expect } from 'vitest';
import { buildEmailHtml, buildRawEmail } from './gmailMime';

function decodeRaw(raw: string): string {
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}

describe('buildEmailHtml', () => {
  it('wraps each line in a paragraph and appends the tracking pixel', () => {
    const html = buildEmailHtml('Ligne 1\nLigne 2', 'https://x.test/track?id=1');
    expect(html).toContain('Ligne 1');
    expect(html).toContain('Ligne 2');
    expect(html).toContain('<img src="https://x.test/track?id=1"');
  });

  it('converts blank lines to line breaks', () => {
    const html = buildEmailHtml('Ligne 1\n\nLigne 2', 'https://x.test/track');
    expect(html).toContain('<br/>');
  });
});

describe('buildRawEmail', () => {
  const base = {
    fromEmail: 'me@gmail.com',
    fromName: 'Seiki CRM',
    toEmail: 'lead@example.com',
    subject: 'Bonjour à vous',
    textBody: 'Corps en texte brut',
    htmlBody: '<p>Corps en html</p>',
  };

  it('produces a valid base64url string (no +, /, or = padding)', () => {
    const raw = buildRawEmail(base);
    expect(raw).not.toMatch(/[+/=]/);
  });

  it('decodes to a multipart/alternative message with both text and html parts', () => {
    const decoded = decodeRaw(buildRawEmail(base));
    expect(decoded).toContain('Content-Type: multipart/alternative');
    expect(decoded).toContain('Corps en texte brut');
    expect(decoded).toContain('<p>Corps en html</p>');
  });

  it('includes From/To headers and an RFC 2047 encoded subject', () => {
    const decoded = decodeRaw(buildRawEmail(base));
    expect(decoded).toContain('From: Seiki CRM <me@gmail.com>');
    expect(decoded).toContain('To: lead@example.com');
    expect(decoded).toMatch(/Subject: =\?UTF-8\?B\?/);
  });

  it('adds In-Reply-To and References headers when provided (threading)', () => {
    const decoded = decodeRaw(buildRawEmail({ ...base, inReplyTo: '<msg1@mail.gmail.com>', references: '<msg1@mail.gmail.com>' }));
    expect(decoded).toContain('In-Reply-To: <msg1@mail.gmail.com>');
    expect(decoded).toContain('References: <msg1@mail.gmail.com>');
  });

  it('omits In-Reply-To/References when not provided', () => {
    const decoded = decodeRaw(buildRawEmail(base));
    expect(decoded).not.toContain('In-Reply-To');
    expect(decoded).not.toContain('References');
  });
});
