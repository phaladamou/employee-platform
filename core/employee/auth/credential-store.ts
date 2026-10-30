import type { EmployeeCredential } from "./employee-credential";

/**
 * Backend de persistance des cles d'acces. Ne stocke que des hashes
 * (voir `EmployeeCredential`) : le token en clair ne transite que dans
 * `issueCredential`, jamais ici. `revoke` sur un ID inconnu leve.
 */
export interface EmployeeCredentialStore {
  save(credential: EmployeeCredential): Promise<void>;
  findByHash(tokenHash: string): Promise<EmployeeCredential | null>;
  revoke(id: string, now?: Date): Promise<void>;
  list(employeeId: string): Promise<readonly EmployeeCredential[]>;
}
