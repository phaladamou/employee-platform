import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { EmployeeCredentialStore } from "./credential-store";

export type CredentialScope =
  | "missions:submit"
  | "missions:read"
  | "memory:read"
  | "admin";

const KNOWN_SCOPES: readonly CredentialScope[] = [
  "missions:submit",
  "missions:read",
  "memory:read",
  "admin",
];

// Prefixe volontairement distinct des IDs employe (`emp_...`) pour ne
// jamais confondre une cle secrete et un identifiant public.
export const CREDENTIAL_TOKEN_PREFIX = "emk_";
export const CREDENTIAL_ID_PREFIX = "cred_";

/**
 * Cle d'acces revocable d'un Employee. L'identite (`employeeId`) est
 * permanente ; la cle ne l'est pas : expiration et revocation la tuent
 * sans toucher a l'identite. Seul `tokenHash` est stocke, jamais le
 * token en clair (les tokens sont aleatoires a haute entropie, SHA-256
 * suffit — pas de mot de passe faible a hacher lentement).
 */
export interface EmployeeCredential {
  readonly id: string;
  readonly employeeId: string;
  readonly tokenHash: string;
  readonly label: string;
  readonly scopes: readonly CredentialScope[];
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
}

export function generateCredentialToken(): string {
  return `${CREDENTIAL_TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function hashCredentialToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isEmployeeCredential(value: unknown): value is EmployeeCredential {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.employeeId === "string" &&
    typeof record.tokenHash === "string" &&
    typeof record.label === "string" &&
    Array.isArray(record.scopes) &&
    record.scopes.every(
      (scope): scope is CredentialScope =>
        typeof scope === "string" &&
        (KNOWN_SCOPES as readonly string[]).includes(scope)
    ) &&
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
 * Emet une cle d'acces pour un Employee. Retourne le token EN CLAIR une
 * seule fois (a montrer a l'appelant puis a oublier) et le credential
 * stockable (hash uniquement). `expiresAt` explicite gagne sur `ttlMs`.
 */
export function issueCredential(input: {
  employeeId: string;
  label: string;
  scopes: readonly CredentialScope[];
  expiresAt?: Date | string | null;
  ttlMs?: number;
  id?: string;
  token?: string;
  now?: Date;
}): { credential: EmployeeCredential; token: string } {
  const employeeId = input.employeeId.trim();
  const label = input.label.trim();

  if (!employeeId) {
    throw new Error("Employee id cannot be empty");
  }
  if (!label) {
    throw new Error("Credential label cannot be empty");
  }
  if (input.scopes.length === 0) {
    throw new Error("Credential requires at least one scope");
  }
  for (const scope of input.scopes) {
    if (!(KNOWN_SCOPES as readonly string[]).includes(scope)) {
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

  const token = input.token ?? generateCredentialToken();

  if (!token) {
    throw new Error("Credential token cannot be empty");
  }

  return {
    credential: {
      id: input.id ?? `${CREDENTIAL_ID_PREFIX}${randomUUID()}`,
      employeeId,
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
 * Verifie un token : inconnu, expire, revoque ou hors scope -> `null`
 * (aucun detail, pas d'oracle). Une panne du stockage propage son
 * erreur (l'appelant tranche, cote API : echec ferme).
 */
export async function verifyCredential(
  store: EmployeeCredentialStore,
  token: string,
  options?: { scope?: CredentialScope; now?: Date }
): Promise<EmployeeCredential | null> {
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
