import { describe, it, expect } from 'vitest';
import { classifyInboundMessage } from './gmailReplyClassifier';

describe('classifyInboundMessage', () => {
  it('classifies mailer-daemon sender as a bounce', () => {
    expect(classifyInboundMessage('mailer-daemon@googlemail.com', 'Delivery Status Notification (Failure)')).toBe('bounce');
  });

  it('classifies postmaster sender as a bounce', () => {
    expect(classifyInboundMessage('postmaster@example.com', 'Undeliverable')).toBe('bounce');
  });

  it('classifies a Delivery Status Notification subject as a bounce even from an unusual sender', () => {
    expect(classifyInboundMessage('bounce-relay@example.com', 'Delivery Status Notification (Failure)')).toBe('bounce');
  });

  it('classifies "Mail delivery failed" subject as a bounce', () => {
    expect(classifyInboundMessage('MAILER-DAEMON@example.com', 'Mail delivery failed: returning message to sender')).toBe('bounce');
  });

  it('classifies a normal lead reply as a reply', () => {
    expect(classifyInboundMessage('lead@company.com', 'Re: Une idée pour votre entreprise')).toBe('reply');
  });

  it('is case-insensitive on both sender and subject', () => {
    expect(classifyInboundMessage('MAILER-DAEMON@Example.com', 'DELIVERY STATUS NOTIFICATION')).toBe('bounce');
  });

  it('classifies "mail-daemon@" sender as a bounce (hyphenated MTA variant)', () => {
    expect(classifyInboundMessage('mail-daemon@example.com', 'Something')).toBe('bounce');
  });

  it('classifies "Returned mail" subject as a bounce', () => {
    expect(classifyInboundMessage('system@example.com', 'Returned mail: see transcript for details')).toBe('bounce');
  });

  it('classifies "Message delivery failed" subject as a bounce', () => {
    expect(classifyInboundMessage('system@example.com', 'Message delivery failed')).toBe('bounce');
  });

  it('does not classify "undeliverable" as a bounce when it appears mid-subject, not at the start', () => {
    expect(classifyInboundMessage('lead@company.com', 'Re: your question about our undeliverable-package policy')).toBe('reply');
  });

  it('still classifies "Undeliverable: ..." as a bounce when it starts the subject', () => {
    expect(classifyInboundMessage('mailer-daemon@example.com', 'Undeliverable: Your message')).toBe('bounce');
  });
});
