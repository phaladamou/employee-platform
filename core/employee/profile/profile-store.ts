import type { EmployeeProfile } from "./employee-profile";

/**
 * Persistance des profils publies par le Createur. Les profils sont
 * globaux (catalogue), pas scopes par tenant : c'est l'engagement
 * (Employment) qui lie un employe a un employeur.
 */
export interface ProfileStore {
  /** Cree ou remplace un profil. */
  save(profile: EmployeeProfile): Promise<void>;
  /** Charge un profil, null si inconnu ou corrompu. */
  load(employeeId: string): Promise<EmployeeProfile | null>;
  /** Catalogue complet, trie par nom. */
  list(): Promise<readonly EmployeeProfile[]>;
}
