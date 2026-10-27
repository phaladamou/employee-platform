// lib/connectors/core/crypto.ts
import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { loadDesktopSettings } from "@/lib/desktop/settings";

const IS_DESKTOP = process.env.DESKTOP === "1";

// Web (historique) : validation immediate au chargement du module.
if (!IS_DESKTOP) {
  if ((process.env.OAUTH_TOKEN_ENCRYPTION_KEY ?? "").length !== 64) {
    throw new Error(
      "OAUTH_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)."
    );
  }
  if ((process.env.OAUTH_STATE_SECRET ?? "").length < 32) {
    throw new Error("OAUTH_STATE_SECRET must be at least 32 chars.");
  }
}

// Bureau : secrets derives du authSecret local (settings.json, stable entre
// redemarrages), resolus a l'usage pour ne jamais casser le build.
function getDesktopDerivedSecret(kind: string): string {
  const authSecret = loadDesktopSettings().authSecret ?? "";
  if (!authSecret) {
    throw new Error(
      "Desktop auth secret missing (settings.json). Restart the app."
    );
  }
  return createHash("sha256")
    .update(`employee-desktop:${kind}:${authSecret}`)
    .digest("hex");
}

function getEncryptionKeyHex(): string {
  const fromEnv = process.env.OAUTH_TOKEN_ENCRYPTION_KEY ?? "";
  if (fromEnv) {
    if (fromEnv.length !== 64) {
      throw new Error(
        "OAUTH_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)."
      );
    }
    return fromEnv;
  }
  if (IS_DESKTOP) {
    return getDesktopDerivedSecret("oauth-enc");
  }
  throw new Error(
    "OAUTH_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)."
  );
}

function getStateSecret(): string {
  const fromEnv = process.env.OAUTH_STATE_SECRET ?? "";
  if (fromEnv) {
    if (fromEnv.length < 32) {
      throw new Error("OAUTH_STATE_SECRET must be at least 32 chars.");
    }
    return fromEnv;
  }
  if (IS_DESKTOP) {
    return getDesktopDerivedSecret("oauth-state");
  }
  throw new Error("OAUTH_STATE_SECRET must be at least 32 chars.");
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(getEncryptionKeyHex(), "hex"),
    iv
  );
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
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(getEncryptionKeyHex(), "hex"),
    iv
  );
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function signState(state: string): string {
  const hmac = createHmac("sha256", getStateSecret());
  hmac.update(state);
  return `${state}.${hmac.digest("hex")}`;
}

export function verifyState(signed: string): string | null {
  const [state, signature] = signed.split(".");
  if (!state || !signature) return null;
  const hmac = createHmac("sha256", getStateSecret());
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
