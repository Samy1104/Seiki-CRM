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

  it('renders custom signature HTML when provided and omits purple left border', () => {
    const customSig = '<p>Jean Dupont — CEO</p><p>jean@company.com</p>';
    const html = buildEmailHtml('Bonjour', 'https://x.test/track', customSig);
    expect(html).toContain('Jean Dupont — CEO');
    expect(html).not.toContain('border-left:3px solid');
  });

  it('renders default signature for Jaafar EL ALAMY with logo header and top/bottom dark lines', () => {
    const html = buildEmailHtml('Bonjour', 'https://x.test/track');
    expect(html).toContain('Jaafar EL ALAMY');
    expect(html).toContain('Co-founder &amp; CEO of Seiki');
    expect(html).toContain('alt="SEIKI"');
    expect(html).toContain('border-top:1.5px solid #111827');
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

  it('strips CR/LF from header-value fields to prevent header injection', () => {
    const decoded = decodeRaw(buildRawEmail({
      ...base,
      fromName: 'Evil\r\nBcc: attacker@evil.com',
      toEmail: 'lead@example.com\r\nBcc: attacker2@evil.com',
    }));
    // Check that no new Bcc header line was injected (lines starting with "Bcc:")
    const lines = decoded.split(/\r?\n/);
    const bccHeaderLines = lines.filter((line) => line.match(/^Bcc:/i));
    expect(bccHeaderLines).toHaveLength(0);
  });

  it('declares 8bit Content-Transfer-Encoding on both MIME parts', () => {
    const decoded = decodeRaw(buildRawEmail(base));
    const matches = decoded.match(/Content-Transfer-Encoding: 8bit/g);
    expect(matches).toHaveLength(2);
  });
});
