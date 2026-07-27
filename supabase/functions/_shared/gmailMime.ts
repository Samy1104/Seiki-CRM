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

export function buildEmailHtml(corps: string, trackingPixelUrl: string): string {
  const htmlBody = corps
    .split('\n')
    .map((line) => (line.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px 0;line-height:1.6">${line}</p>`))
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;background:#fff;padding:24px;max-width:600px;margin:0 auto">
  <div style="border-left:3px solid #6B5FE6;padding-left:16px;margin-bottom:24px">
    ${htmlBody}
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="font-size:11px;color:#888;margin:0">
    Envoyé par Seiki — <a href="mailto:contact@seiki.fr" style="color:#6B5FE6">contact@seiki.fr</a>
  </p>
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

export function buildRawEmail(params: RawEmailParams): string {
  const boundary = `seiki_boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `From: ${params.fromName} <${params.fromEmail}>`,
    `To: ${params.toEmail}`,
    `Subject: ${encodeSubject(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) headers.push(`References: ${params.references}`);

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    params.textBody,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    params.htmlBody,
    `--${boundary}--`,
  ].join('\r\n');

  const raw = `${headers.join('\r\n')}\r\n\r\n${body}`;
  return base64UrlEncode(raw);
}
