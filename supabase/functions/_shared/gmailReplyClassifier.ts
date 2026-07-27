// ============================================================
// _shared/gmailReplyClassifier.ts
// Gmail n'a pas de webhook de bounce — un échec de livraison
// revient comme un message dans la même boîte de réception (et
// le même thread) que l'envoi d'origine. Classification par
// heuristique sur l'expéditeur/le sujet. Zéro import Deno — pur,
// testable avec Vitest.
// ============================================================

export type InboundClassification = 'bounce' | 'reply';

const BOUNCE_SENDER_PATTERNS = ['mailer-daemon@', 'postmaster@', 'mail-daemon@'];

// Phrases specific enough to safely match anywhere in the subject.
const BOUNCE_SUBJECT_SUBSTRINGS = [
  'delivery status notification',
  'undelivered mail',
  'mail delivery failed',
  'returned mail',
  'message delivery failed',
  'delivery failure',
  'delivery has failed',
  'non-delivery report',
  'could not be delivered',
  'was not delivered',
];

// Short/ambiguous phrases that could appear mid-sentence in a genuine reply —
// only counted as a bounce signal when the subject STARTS with them, matching
// the conventional bounce-subject format (e.g. "Undeliverable: ...").
const BOUNCE_SUBJECT_PREFIXES = ['undeliverable', 'failure notice'];

export function classifyInboundMessage(fromEmail: string, subject: string): InboundClassification {
  const from = fromEmail.toLowerCase();
  const subj = subject.toLowerCase().trim();

  const isBounceSender = BOUNCE_SENDER_PATTERNS.some((p) => from.includes(p));
  const isBounceSubject =
    BOUNCE_SUBJECT_SUBSTRINGS.some((p) => subj.includes(p)) ||
    BOUNCE_SUBJECT_PREFIXES.some((p) => subj.startsWith(p));

  return isBounceSender || isBounceSubject ? 'bounce' : 'reply';
}
