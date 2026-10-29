import { createHash, randomUUID } from "node:crypto";

export interface EmployeeIdentity {
  readonly id: string;
  readonly fingerprint: string;
  readonly createdAt: string;
}

/**
 * Genere l'identite unique d'un Employee : un identifiant aleatoire
 * prefixe, horodate, et son empreinte cryptographique (SHA-256 de
 * "id:createdAt"). L'horloge est injectable pour des tests deterministes.
 */
export function generateEmployeeIdentity(
  now: Date = new Date()
): EmployeeIdentity {
  const id = `emp_${randomUUID()}`;
  const createdAt = now.toISOString();
  const fingerprint = createHash("sha256")
    .update(`${id}:${createdAt}`)
    .digest("hex");

  return { id, fingerprint, createdAt };
}

/**
 * Verifie qu'une identite n'a pas ete alteree (format + empreinte).
 */
export function verifyEmployeeIdentity(
  identity: EmployeeIdentity
): boolean {
  if (!identity.id.startsWith("emp_")) {
    return false;
  }

  const expected = createHash("sha256")
    .update(`${identity.id}:${identity.createdAt}`)
    .digest("hex");

  return expected === identity.fingerprint;
}
