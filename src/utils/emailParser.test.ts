import { describe, it, expect } from 'vitest';
import { parseEmailBody } from './emailParser';

describe('parseEmailBody', () => {
  it('handles clean messages without quotes', () => {
    const raw = 'Bonjour, merci pour votre message.';
    const res = parseEmailBody(raw);
    expect(res.cleanBody).toBe('Bonjour, merci pour votre message.');
    expect(res.quotedBody).toBeUndefined();
  });

  it('strips French email reply quotes', () => {
    const raw = `Merci, nous ne sommes pas intéressés.

Le mer. 29 juil. 2026 à 17:08, Seiki CRM <baiaks1104@gmail.com> a écrit :

> Bonjour Samy,
>
> Cordialement,
> Seiki`;

    const res = parseEmailBody(raw);
    expect(res.cleanBody).toBe('Merci, nous ne sommes pas intéressés.');
    expect(res.quotedBody).toContain('Le mer. 29 juil. 2026 à 17:08');
    expect(res.quotedBody).toContain('> Bonjour Samy');
  });

  it('strips English email reply quotes', () => {
    const raw = `Thank you for your email.

On Wed, Jul 29, 2026 at 5:08 PM Seiki CRM wrote:

> Hello Samy`;

    const res = parseEmailBody(raw);
    expect(res.cleanBody).toBe('Thank you for your email.');
    expect(res.quotedBody).toContain('On Wed, Jul 29');
  });

  it('strips blockquote lines starting with >', () => {
    const raw = `Here is my reply.
> Quoted line 1
> Quoted line 2`;

    const res = parseEmailBody(raw);
    expect(res.cleanBody).toBe('Here is my reply.');
    expect(res.quotedBody).toBe('> Quoted line 1\n> Quoted line 2');
  });

  it('handles signature/separator lines', () => {
    const raw = `Message content here.

--------------------------------
From: test@example.com
Subject: Re: Hello`;

    const res = parseEmailBody(raw);
    expect(res.cleanBody).toBe('Message content here.');
    expect(res.quotedBody).toContain('--------------------------------');
  });
});
