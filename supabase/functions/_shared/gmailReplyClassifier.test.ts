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
});
