// lib/db/otp.ts
//
// Authentification par code OTP (7 chiffres) envoye par email.
// - Code stocke hache (SHA-256), jamais en clair.
// - Expiration 5 minutes, usage unique (usedAt), verrouillage apres
//   N tentatives echouees.
// - Limitation des demandes : delai entre deux envois + quota horaire.
import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { ChatbotError } from "../errors";
import { getDb } from "./client";
import { otpCode, user } from "./schema";

export const OTP_CODE_LENGTH = 7;
export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_REQUEST_COOLDOWN_SECONDS = 60;
export const OTP_MAX_REQUESTS_PER_HOUR = 5;

export function normalizeOtpEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_CODE_LENGTH)).padStart(
    OTP_CODE_LENGTH,
    "0"
  );
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function hashesMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export type OtpRequestVerdict =
  | { allowed: true }
  | {
      allowed: false;
      reason: "cooldown" | "hourly_cap";
      retryAfterSeconds: number;
    };

export async function checkOtpRequestAllowed(
  email: string
): Promise<OtpRequestVerdict> {
  try {
    const db = await getDb();
    const now = new Date();

    const [latest] = await db
      .select({ createdAt: otpCode.createdAt })
      .from(otpCode)
      .where(eq(otpCode.email, email))
      .orderBy(desc(otpCode.createdAt))
      .limit(1);

    if (latest) {
      const elapsed =
        (now.getTime() - latest.createdAt.getTime()) / 1000;
      if (elapsed < OTP_REQUEST_COOLDOWN_SECONDS) {
        return {
          allowed: false,
          reason: "cooldown",
          retryAfterSeconds: Math.ceil(
            OTP_REQUEST_COOLDOWN_SECONDS - elapsed
          ),
        };
      }
    }

    const [row] = await db
      .select({ value: count() })
      .from(otpCode)
      .where(
        and(
          eq(otpCode.email, email),
          gt(otpCode.createdAt, new Date(now.getTime() - 3_600_000))
        )
      );
    if ((row?.value ?? 0) >= OTP_MAX_REQUESTS_PER_HOUR) {
      return {
        allowed: false,
        reason: "hourly_cap",
        retryAfterSeconds: OTP_REQUEST_COOLDOWN_SECONDS,
      };
    }

    return { allowed: true };
  } catch (_error) {
    console.error("checkOtpRequestAllowed DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to check OTP throttle"
    );
  }
}

export async function issueOtpCode(email: string): Promise<{
  code: string;
  expiresAt: Date;
}> {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
  try {
    const db = await getDb();
    const now = new Date();
    // Un seul code vivant a la fois : invalide les precedents.
    await db
      .update(otpCode)
      .set({ usedAt: now })
      .where(and(eq(otpCode.email, email), isNull(otpCode.usedAt)));
    // Menage : supprime les codes expires de cet email.
    await db
      .delete(otpCode)
      .where(and(eq(otpCode.email, email), lt(otpCode.expiresAt, now)));
    await db.insert(otpCode).values({
      email,
      codeHash: hashOtpCode(code),
      expiresAt,
    });
    return { code, expiresAt };
  } catch (_error) {
    console.error("issueOtpCode DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to issue OTP");
  }
}

export async function revokeLatestOtpCode(email: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .update(otpCode)
      .set({ usedAt: new Date() })
      .where(and(eq(otpCode.email, email), isNull(otpCode.usedAt)));
  } catch (_error) {
    console.error("revokeLatestOtpCode DB Error:", _error);
  }
}

export type OtpVerifyResult = "ok" | "invalid" | "expired" | "locked";

export async function verifyOtpCode(
  email: string,
  code: string
): Promise<OtpVerifyResult> {
  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(otpCode)
      .where(and(eq(otpCode.email, email), isNull(otpCode.usedAt)))
      .orderBy(desc(otpCode.createdAt))
      .limit(1);

    if (!row) {
      return "invalid";
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      return "expired";
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await db
        .update(otpCode)
        .set({ usedAt: new Date() })
        .where(eq(otpCode.id, row.id));
      return "locked";
    }
    if (!hashesMatch(hashOtpCode(code), row.codeHash)) {
      const attempts = row.attempts + 1;
      await db
        .update(otpCode)
        .set({
          attempts,
          ...(attempts >= OTP_MAX_ATTEMPTS ? { usedAt: new Date() } : {}),
        })
        .where(eq(otpCode.id, row.id));
      return attempts >= OTP_MAX_ATTEMPTS ? "locked" : "invalid";
    }

    await db
      .update(otpCode)
      .set({ usedAt: new Date() })
      .where(eq(otpCode.id, row.id));
    return "ok";
  } catch (_error) {
    console.error("verifyOtpCode DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to verify OTP");
  }
}

// Premiere connexion OTP reussie = email prouve : cree un compte verifie
// (sans mot de passe), comme le font deja les providers OAuth/invite.
export async function getOrCreateVerifiedUser(email: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  onboarded: boolean;
}> {
  try {
    const db = await getDb();
    const [existing] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        onboarded: user.onboarded,
      })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (existing) {
      // OTP prouve l'email : marquer verifie meme les comptes pre-OTP.
      await db
        .update(user)
        .set({ emailVerified: true })
        .where(eq(user.id, existing.id));
      return existing;
    }
    const [created] = await db
      .insert(user)
      .values({ email, emailVerified: true } as any)
      .returning({
        id: user.id,
        email: user.email,
        name: user.name,
        onboarded: user.onboarded,
      });
    return created;
  } catch (_error) {
    console.error("getOrCreateVerifiedUser DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to provision OTP user"
    );
  }
}
