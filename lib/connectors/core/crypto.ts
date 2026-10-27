// lib/connectors/core/crypto.ts
import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ENCRYPTION_KEY_HEX = process.env.OAUTH_TOKEN_ENCRYPTION_KEY ?? "";
const STATE_SECRET = process.env.OAUTH_STATE_SECRET ?? "";

if (ENCRYPTION_KEY_HEX.length !== 64) {
  throw new Error(
    "OAUTH_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)."
  );
}

if (STATE_SECRET.length < 32) {
  throw new Error("OAUTH_STATE_SECRET must be at least 32 chars.");
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex");

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptToken(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function signState(state: string): string {
  const hmac = createHmac("sha256", STATE_SECRET);
  hmac.update(state);
  return `${state}.${hmac.digest("hex")}`;
}

export function verifyState(signed: string): string | null {
  const [state, signature] = signed.split(".");
  if (!state || !signature) return null;
  const hmac = createHmac("sha256", STATE_SECRET);
  hmac.update(state);
  const expected = hmac.digest("hex");
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return state;
}

export function generateState(): string {
  return randomBytes(24).toString("hex");
}
