import type { EmployerCredential } from "./employer-credential";

/**
 * Backend de persistance des cles employeurs. Hashes uniquement, jamais
 * de token en clair. `revoke` sur un ID inconnu leve.
 */
export interface EmployerCredentialStore {
  save(credential: EmployerCredential): Promise<void>;
  findByHash(tokenHash: string): Promise<EmployerCredential | null>;
  revoke(id: string, now?: Date): Promise<void>;
  listByEmployer(employerId: string): Promise<readonly EmployerCredential[]>;
}
