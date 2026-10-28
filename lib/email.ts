// lib/email.ts
//
// Envoi d'emails transactionnels via l'API REST Resend (fetch natif,
// aucune dependance). Requiert RESEND_API_KEY + EMAIL_FROM.
import "server-only";

import { OTP_TTL_MINUTES } from "./db/otp";

export async function sendOtpEmail(input: {
  to: string;
  code: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error(
      "OTP email not configured (RESEND_API_KEY/EMAIL_FROM missing)"
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Votre code de connexion : ${input.code}`,
      html: [
        `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">`,
        `<h2 style="margin:0 0 8px">Connexion à Employee</h2>`,
        `<p style="color:#555">Voici votre code à usage unique (valable ${OTP_TTL_MINUTES} minutes) :</p>`,
        `<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">${input.code}</p>`,
        `<p style="color:#888;font-size:13px">Si vous n'avez pas demandé ce code, ignorez cet email.</p>`,
        `<hr style="border:none;border-top:1px solid #eee;margin:16px 0" />`,
        `<p style="color:#888;font-size:13px">Your one-time sign-in code (valid ${OTP_TTL_MINUTES} minutes). If you did not request it, ignore this email.</p>`,
        `</div>`,
      ].join(""),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend error: HTTP ${response.status} ${detail}`.trim());
  }
}
