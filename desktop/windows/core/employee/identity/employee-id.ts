import { createHash, randomUUID } from "node:crypto";

export interface EmployeeIdentity {
  readonly id: string;
  readonly fingerprint: string;
  readonly createdAt: string;
}

/**
 * Delivre l'identite d'un id donne (SHA-256 de "id:createdAt").
 * Utilise par la creation avec id explicite (tests, restauration).
 */
export function issueEmployeeIdentity(
  id: string,
  now: Date = new Date()
): EmployeeIdentity {
  const trimmed = id.trim();
  if (!trimmed) {
    throw new Error("Employee id cannot be empty");
  }
  const createdAt = now.toISOString();
  const fingerprint = createHash("sha256")
    .update(`${trimmed}:${createdAt}`)
    .digest("hex");

  return { id: trimmed, fingerprint, createdAt };
}

/**
 * Genere l'identite unique d'un Employee : un identifiant aleatoire
 * prefixe, horodate, et son empreinte cryptographique (SHA-256 de
 * "id:createdAt"). L'horloge est injectable pour des tests deterministes.
 */
export function generateEmployeeIdentity(
  now: Date = new Date()
): EmployeeIdentity {
  return issueEmployeeIdentity(`emp_${randomUUID()}`, now);
}

/**
 * Verifie qu'une identite n'a pas ete alteree (format + empreinte).
 */
export function verifyEmployeeIdentity(
  identity: EmployeeIdentity
): boolean {
  if (typeof identity.id !== "string" || !identity.id.startsWith("emp_")) {
    return false;
  }
  if (
    typeof identity.fingerprint !== "string" ||
    !/^[0-9a-f]{64}$/.test(identity.fingerprint)
  ) {
    return false;
  }
  if (
    typeof identity.createdAt !== "string" ||
    Number.isNaN(Date.parse(identity.createdAt))
  ) {
    return false;
  }

  const expected = createHash("sha256")
    .update(`${identity.id}:${identity.createdAt}`)
    .digest("hex");

  return expected === identity.fingerprint;
}

/**
 * Garde de parsing : forme + empreinte valides.
 */
export function isEmployeeIdentity(value: unknown): value is EmployeeIdentity {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.fingerprint !== "string" ||
    typeof candidate.createdAt !== "string"
  ) {
    return false;
  }
  return verifyEmployeeIdentity(candidate as unknown as EmployeeIdentity);
}
