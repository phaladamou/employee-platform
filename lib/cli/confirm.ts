// lib/cli/confirm.ts
// Jetons de confirmation HMAC pour les commandes d'ecriture (serveur
// uniquement : node:crypto). Apatride : le jeton porte l'action, son
// payload, le compte et l'expiration, scelles par le secret serveur.

import { createHmac, timingSafeEqual } from "node:crypto";

export type WriteAction = "hire" | "submit" | "cancel";

export interface ConfirmPayload {
  action: WriteAction;
  params: Record<string, string | boolean>;
}

interface TokenBody extends ConfirmPayload {
  accountId: string;
  expiresAt: number;
}

const CONFIRM_TTL_MS = 120_000;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function createConfirmToken(
  secret: string,
  accountId: string,
  payload: ConfirmPayload,
  nowMs: number = Date.now(),
  ttlMs: number = CONFIRM_TTL_MS
): string {
  if (!secret) {
    throw new Error("Missing confirm secret");
  }
  const body: TokenBody = {
    ...payload,
    accountId,
    expiresAt: nowMs + ttlMs,
  };
  const encoded = base64UrlEncode(JSON.stringify(body));
  const signature = createHmac("sha256", secret).update(encoded).digest("hex");
  return `${encoded}.${signature}`;
}

function isWriteAction(value: unknown): value is WriteAction {
  return value === "hire" || value === "submit" || value === "cancel";
}

export function verifyConfirmToken(
  secret: string,
  token: string,
  accountId: string,
  nowMs: number = Date.now()
): ConfirmPayload | null {
  if (!secret || !token || !accountId) {
    return null;
  }
  const dot = token.indexOf(".");
  if (dot <= 0) {
    return null;
  }
  const encoded = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(encoded).digest("hex");
  if (provided.length !== expected.length) {
    return null;
  }
  try {
    const match = timingSafeEqual(
      Buffer.from(provided, "utf8"),
      Buffer.from(expected, "utf8")
    );
    if (match === false) {
      return null;
    }
  } catch {
    return null;
  }
  const decoded = base64UrlDecode(encoded);
  if (decoded === null) {
    return null;
  }
  let body: Partial<TokenBody>;
  try {
    body = JSON.parse(decoded) as Partial<TokenBody>;
  } catch {
    return null;
  }
  if (body.accountId !== accountId) {
    return null;
  }
  if (typeof body.expiresAt !== "number" || body.expiresAt <= nowMs) {
    return null;
  }
  if (!isWriteAction(body.action)) {
    return null;
  }
  if (typeof body.params !== "object" || body.params === null) {
    return null;
  }
  return { action: body.action, params: body.params };
}
