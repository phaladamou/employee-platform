// lib/otp-email-template.ts
//
// Gabarit pur (sans dependance serveur) de l'email de verification OTP.
// HTML compatible clients mail (tables + styles inline, logo inline via CID).
export const LOGO_CONTENT_ID = "employee-logo";

export function otpEmailSubject(code: string): string {
  return `Your sign-in code: ${code}`;
}

export function buildOtpEmailHtml(code: string, ttlMinutes: number): string {
  const year = new Date().getFullYear();

  return [
    `<!DOCTYPE html>`,
    `<html lang="en">`,
    `<head>`,
    `<meta charset="utf-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
    `<title>${otpEmailSubject(code)}</title>`,
    `</head>`,
    `<body style="margin:0;padding:0;background-color:#f4f5f7;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">`,
    `<tr><td align="center" style="padding:40px 16px;">`,
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e9ebf0;border-radius:16px;">`,
    `<tr><td style="padding:40px 40px 32px;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>`,
    `<td width="44"><img src="cid:${LOGO_CONTENT_ID}" width="44" height="44" alt="Employee" style="display:block;border:0;" /></td>`,
    `<td style="padding-left:12px;font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:#111827;vertical-align:middle;">Employee</td>`,
    `</tr></table>`,
    `<h1 style="margin:28px 0 0;font-family:Arial,sans-serif;font-size:24px;font-weight:700;color:#111827;">Your sign-in code</h1>`,
    `<p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:24px;color:#4b5563;">Use this one-time code to sign in. It expires in ${ttlMinutes} minutes.</p>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>`,
    `<td align="center" style="padding:28px 0 8px;">`,
    `<div style="display:inline-block;background-color:#f4f5f7;border:1px solid #e5e7eb;border-radius:12px;padding:20px 32px;font-family:'Courier New',monospace;font-size:38px;font-weight:700;letter-spacing:10px;text-indent:10px;color:#111827;">${code}</div>`,
    `</td>`,
    `</tr></table>`,
    `<p style="margin:8px 0 0;text-align:center;font-family:Arial,sans-serif;font-size:13px;color:#6b7280;">Valid ${ttlMinutes} minutes &middot; Single use</p>`,
    `<hr style="border:none;border-top:1px solid #eef0f3;margin:28px 0 20px;" />`,
    `<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#6b7280;">If you didn't request this code, ignore this email. Never share this code with anyone.</p>`,
    `</td></tr>`,
    `</table>`,
    `<p style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;">&copy; ${year} Employee &middot; Automated email, please do not reply.</p>`,
    `</td></tr>`,
    `</table>`,
    `</body>`,
    `</html>`,
  ].join("");
}

export function buildOtpEmailText(code: string, ttlMinutes: number): string {
  return [
    `Employee — your sign-in code: ${code}`,
    ``,
    `Use this one-time code to sign in.`,
    `It expires in ${ttlMinutes} minutes.`,
    ``,
    `If you didn't request this code, ignore this email.`,
  ].join("\n");
}
