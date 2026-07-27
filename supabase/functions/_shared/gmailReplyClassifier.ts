// ============================================================
// _shared/gmailReplyClassifier.ts
// Gmail n'a pas de webhook de bounce — un échec de livraison
// revient comme un message dans la même boîte de réception (et
// le même thread) que l'envoi d'origine. Classification par
// heuristique sur l'expéditeur/le sujet. Zéro import Deno — pur,
// testable avec Vitest.
// ============================================================

export type InboundClassification = 'bounce' | 'reply';

const BOUNCE_SENDER_PATTERNS = ['mailer-daemon@', 'postmaster@'];
const BOUNCE_SUBJECT_PATTERNS = [
  'delivery status notification',
  'undeliverable',
  'undelivered mail',
  'mail delivery failed',
  'failure notice',
];

export function classifyInboundMessage(fromEmail: string, subject: string): InboundClassification {
  const from = fromEmail.toLowerCase();
  const subj = subject.toLowerCase();

  const isBounceSender = BOUNCE_SENDER_PATTERNS.some((p) => from.includes(p));
  const isBounceSubject = BOUNCE_SUBJECT_PATTERNS.some((p) => subj.includes(p));

  return isBounceSender || isBounceSubject ? 'bounce' : 'reply';
}
