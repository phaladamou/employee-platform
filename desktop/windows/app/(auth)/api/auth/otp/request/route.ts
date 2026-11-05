// app/(auth)/api/auth/otp/request/route.ts
//
// POST { email } -> emet un code OTP (7 chiffres, 5 min) et l'envoie
// par email. Limite : 60 s entre deux envois, 5/heure par email.
import { z } from "zod";
import { ChatbotError } from "@/lib/errors";
import {
  OTP_REQUEST_COOLDOWN_SECONDS,
  checkOtpRequestAllowed,
  issueOtpCode,
  normalizeOtpEmail,
  revokeLatestOtpCode,
} from "@/lib/db/otp";
import { sendOtpEmail } from "@/lib/email";

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export async function POST(request: Request) {
  let email: string;
  try {
    email = requestSchema.parse(await request.json()).email;
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const verdict = await checkOtpRequestAllowed(email);
    if (verdict.allowed === false) {
      return Response.json(
        {
          code: "rate_limit:auth",
          retryAfterSeconds: verdict.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(verdict.retryAfterSeconds) },
        }
      );
    }

    const { code, expiresAt } = await issueOtpCode(email);
    try {
      await sendOtpEmail({ to: email, code });
    } catch (error) {
      // Pas d'email = pas de code valide qui traine.
      await revokeLatestOtpCode(email);
      console.error("sendOtpEmail failed:", error);
      return new ChatbotError("bad_request:api").toResponse();
    }

    return Response.json(
      {
        ok: true,
        expiresAt: expiresAt.toISOString(),
        cooldownSeconds: OTP_REQUEST_COOLDOWN_SECONDS,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    console.error("otp/request failed:", error);
    return new ChatbotError("bad_request:api").toResponse();
  }
}
