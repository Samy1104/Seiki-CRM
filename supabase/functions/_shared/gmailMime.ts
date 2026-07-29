// ============================================================
// _shared/gmailMime.ts
// Construction du corps HTML (avec pixel de tracking) et du
// message RFC822 brut (base64url) attendu par Gmail API
// messages.send. Zéro import Deno — pur, testable avec Vitest.
// ============================================================

export interface RawEmailParams {
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  inReplyTo?: string;
  references?: string;
}

export function buildEmailHtml(corps: string, trackingPixelUrl: string, signatureHtml?: string): string {
  const htmlBody = corps
    .split('\n')
    .map((line) => (line.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px 0;line-height:1.6">${line}</p>`))
    .join('');

  const signatureContent = signatureHtml ?? `
    <p style="margin:0;font-weight:600;color:#111827">L'équipe Seiki</p>
    <p style="margin:2px 0 0 0;color:#6b7280;font-size:12px">contact@seiki.co</p>
  `.trim();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;background:#fff;padding:24px;max-width:600px;margin:0 auto">
  <div style="margin-bottom:24px">
    ${htmlBody}
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <div style="font-size:13px;color:#4b5563;line-height:1.5">
    ${signatureContent}
  </div>
  <!-- Tracking pixel (ouverture) -->
  <img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt=""/>
</body>
</html>`;
}

function base64UrlEncode(str: string): string {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

export function buildRawEmail(params: RawEmailParams): string {
  const boundary = `seiki_boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `From: ${sanitizeHeaderValue(params.fromName)} <${sanitizeHeaderValue(params.fromEmail)}>`,
    `To: ${sanitizeHeaderValue(params.toEmail)}`,
    `Subject: ${encodeSubject(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (params.inReplyTo) headers.push(`In-Reply-To: ${sanitizeHeaderValue(params.inReplyTo)}`);
  if (params.references) headers.push(`References: ${sanitizeHeaderValue(params.references)}`);

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.textBody,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.htmlBody,
    `--${boundary}--`,
  ].join('\r\n');

  const raw = `${headers.join('\r\n')}\r\n\r\n${body}`;
  return base64UrlEncode(raw);
}
