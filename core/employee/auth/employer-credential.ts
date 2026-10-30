import { randomBytes, randomUUID } from "node:crypto";

import {
  CREDENTIAL_TOKEN_BYTES,
  hashCredentialToken,
  isCredentialScope,
  type CredentialScope,
} from "./employee-credential";
import type { EmployerCredentialStore } from "./employer-credential-store";

export const EMPLOYER_TOKEN_PREFIX = "emo_";
export const EMPLOYER_CREDENTIAL_ID_PREFIX = "emcred_";

/**
 * Cle d'acces d'un EMPLOYEUR (tenant API). Meme modele que les cles
 * employe, sujet different : seul le hash est stocke. L'employerId
 * liee au token est la racine de l'isolation multi-tenant (toujours
 * derivee cote serveur, jamais fournie par l'appelant).
 */
export interface EmployerCredential {
  readonly id: string;
  readonly employerId: string;
  readonly tokenHash: string;
  readonly label: string;
  readonly scopes: readonly CredentialScope[];
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
}

export function generateEmployerToken(): string {
  return (
    `${EMPLOYER_TOKEN_PREFIX}` +
    `${randomBytes(CREDENTIAL_TOKEN_BYTES).toString("base64url")}`
  );
}

export function isEmployerCredential(
  value: unknown
): value is EmployerCredential {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.employerId === "string" &&
    typeof record.tokenHash === "string" &&
    typeof record.label === "string" &&
    Array.isArray(record.scopes) &&
    record.scopes.every((scope) => typeof scope === "string") &&
    typeof record.createdAt === "string" &&
    (typeof record.expiresAt === "string" || record.expiresAt === null) &&
    (typeof record.revokedAt === "string" || record.revokedAt === null)
  );
}

function toIsoDate(value: Date | string, field: string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Credential ${field} is not a valid date`);
  }

  return date.toISOString();
}

/**
 * Emet une cle employeur. Retourne le token EN CLAIR une seule fois ;
 * le credential stockable ne contient que le hash.
 */
export function issueEmployerCredential(input: {
  employerId: string;
  label: string;
  scopes: readonly CredentialScope[];
  expiresAt?: Date | string | null;
  ttlMs?: number;
  id?: string;
  token?: string;
  now?: Date;
}): { credential: EmployerCredential; token: string } {
  const employerId = input.employerId.trim();
  const label = input.label.trim();

  if (!employerId) {
    throw new Error("Employer id cannot be empty");
  }
  if (!label) {
    throw new Error("Credential label cannot be empty");
  }
  if (input.scopes.length === 0) {
    throw new Error("Credential requires at least one scope");
  }
  for (const scope of input.scopes) {
    if (!isCredentialScope(scope)) {
      throw new Error(`Unknown credential scope: ${String(scope)}`);
    }
  }

  const now = input.now ?? new Date();
  let expiresAt: string | null = null;

  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    expiresAt = toIsoDate(input.expiresAt, "expiresAt");
  } else if (input.ttlMs !== undefined) {
    if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) {
      throw new Error("Credential ttlMs must be a positive number");
    }
    expiresAt = new Date(now.getTime() + input.ttlMs).toISOString();
  }

  const token = input.token ?? generateEmployerToken();

  if (!token) {
    throw new Error("Credential token cannot be empty");
  }

  return {
    credential: {
      id: input.id ?? `${EMPLOYER_CREDENTIAL_ID_PREFIX}${randomUUID()}`,
      employerId,
      tokenHash: hashCredentialToken(token),
      label,
      scopes: [...input.scopes],
      createdAt: now.toISOString(),
      expiresAt,
      revokedAt: null,
    },
    token,
  };
}

/**
 * Verifie un token employeur : inconnu, expire, revoque ou hors scope
 * -> `null` (aucun detail, pas d'oracle).
 */
export async function verifyEmployerCredential(
  store: EmployerCredentialStore,
  token: string,
  options?: { scope?: CredentialScope; now?: Date }
): Promise<EmployerCredential | null> {
  if (!token) {
    return null;
  }

  const credential = await store.findByHash(hashCredentialToken(token));

  if (!credential || credential.revokedAt !== null) {
    return null;
  }
  if (
    credential.expiresAt !== null &&
    credential.expiresAt <= (options?.now ?? new Date()).toISOString()
  ) {
    return null;
  }
  if (options?.scope && !credential.scopes.includes(options.scope)) {
    return null;
  }

  return credential;
}
