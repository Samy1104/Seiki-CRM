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

const SEIKI_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHQAAAAYCAYAAAArrNkGAAAJW0lEQVR4AexZW3IbxxU9F04popSqkDuAVhBqBQF+UjHlD+AvTj4MbiCEVkBwBQRXQPgjsZKfgSoRlcoPmBWAWQGxA7EqsUjRMjvnNKaHg54GOHyoUmV7qg/6de/tx+nb3TNo4KfnBzUDntD+F/9p7bx4Pymjv/Xfnkb6p8xtfjN2kzJejV2mugB3hA4xSSBzbzBgecf9E5v4kT3OuXWi+SmGTbvetuKyfU8orLEOh1YZDp/9GtdPi8kCDuig/BjOABT1uE53YNhlPsNHTEmsIyae5Ldo4gf8cKI17ncc4inTwoONl/bkHFPZJt4x/xVjHxr+97vGiY8Xfq6khEtghsTzTeZEoK+xz3EMQECNp+VJdjh1b3FIPNhA47Y5UK3iPuMJoYEzKsKUqX3iwdunTc3doNQftdEPedaHPqlfAZ1QXyM+pIxsMvJhSJvrSjX0M/zH2gzm5GXK5rDNfsetb3dN5bO88DoyFKvCFxq2GVflWLg0OPTwiYjlAFsApsQ+obQfMNMhaNI1yfIeeVMo/1RxmQC1rT6VEfdvVT9i2SLvCZ1rNqpe+vFCDQMOX89lFn57f+X5GkropTN8wHPmJatFwGTN4CBiJ/RWDRD3fXIyJ7RTnkRml4YBdUTuUoHbVJiZ5lIIapqPYcg8QHwQ2Thgm2oDjVBh7upfIR1iDnJX6Qsg2ZnvDRm33mLSrIsz20KP2MDPSK6hDcM2F8QegDEA3yjST5NyItW3mRapXaotqbZbXp7F93Z2TM2uT1krFzM2trJFLsdSE18S35m1c388Ui/AhEVNV8lcyx3mR5m3UK+aqQ+BKGiZlUlQq221yQp/s91X1iQ9F7hEwAbUTlMlIFhwG0n+5iJ1URyZK3d+NCqv3kg2s0bX5g/r4j9nYw0l2dxZkMGzm97+vsH1fD9n40iV5sKpvmduUpX63At7nS+mr34+zWt26nC3m2lE68C6v50r7n3pLOEey22S2yXwz6REevS3aGd6Z2KiLIsTzse+V/i0xrs/PqV1G23/l0+T65pl/O/s24B9kPjZkbhT/j3Tny2RO206zJ9t/XoV3/r8e1wA32r5cQ9zK5pZ3T+j4bLg898lWj/6+Z5x7x7c6x276+77x+0n360t1x354q4d31wO2+kMh49GfZp+N8aFp9v3s0r+/V//e4b1k5k2hD2R9qf6b8D/034xV2l7H/R+Z5l7l/Y7R72a7j0P+c55/v3f9+t27/k18r8m7l/a+P/30x5pT5+Xq9gQAAAABJRU5ErkJggg==';

export function buildEmailHtml(corps: string, trackingPixelUrl: string, signatureHtml?: string, logoUrl?: string): string {
  const htmlBody = corps
    .split('\n')
    .map((line) => (line.trim() === '' ? '<br/>' : `<p style="margin:0 0 4px 0;line-height:1.4">${line}</p>`))
    .join('');

  const signatureContent = signatureHtml ?? `
    <p style="margin:0;font-weight:700;font-size:15px;color:#111827;letter-spacing:0.2px;">Jaafar ELALAMY</p>
    <p style="margin:3px 0 0 0;color:#4b5563;font-size:13px;font-weight:500;">Co-founder &amp; CEO of Seiki</p>
  `.trim();

  const logoSrc = logoUrl ?? 'https://raw.githubusercontent.com/Samy1104/Seiki-CRM/main/public/grand_logo.png';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;background:#f9fafb;padding:24px 12px;margin:0 auto;max-width:850px;">
  <!-- Main Email Card -->
  <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
    
    <!-- Centered Logo Banner (Graphite Dark) -->
    <div style="background:#0d0d0d;padding:24px 20px;text-align:center;">
      <img src="${logoSrc}" alt="SEIKI" style="height:36px;width:auto;max-width:240px;display:inline-block;vertical-align:middle;border:none;outline:none;" />
    </div>

    <!-- Top Dark Accent Line -->
    <div style="height:2px;background:#111827;width:100%;"></div>

    <!-- Content Padding -->
    <div style="padding:28px 24px;">
      <!-- Email Body -->
      <div style="font-size:15px;line-height:1.4;color:#1f2937;">
        ${htmlBody}
      </div>

      <!-- Bottom Dark Line Separator -->
      <hr style="border:none;border-top:1.5px solid #111827;margin:28px 0 20px 0;opacity:0.8;"/>

      <!-- Signature -->
      <div style="font-size:14px;color:#111827;line-height:1.5;">
        ${signatureContent}
      </div>
    </div>
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
