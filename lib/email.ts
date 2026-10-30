// lib/email.ts
//
// Envoi d'emails transactionnels via l'API REST Resend (fetch natif,
// aucune dependance). Requiert RESEND_API_KEY + EMAIL_FROM.
import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { OTP_TTL_MINUTES } from "./db/otp";
import {
  buildOtpEmailHtml,
  buildOtpEmailText,
  LOGO_CONTENT_ID,
  otpEmailSubject,
} from "./otp-email-template";

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

  const logo = await readFile(
    join(process.cwd(), "public", "images", "employee-logo.png")
  );

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: otpEmailSubject(input.code),
      html: buildOtpEmailHtml(input.code, OTP_TTL_MINUTES),
      text: buildOtpEmailText(input.code, OTP_TTL_MINUTES),
      attachments: [
        {
          filename: "employee-logo.png",
          content: logo.toString("base64"),
          content_id: LOGO_CONTENT_ID,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend error: HTTP ${response.status} ${detail}`.trim());
  }
}
