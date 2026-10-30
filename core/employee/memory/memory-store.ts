import type { MissionRecord } from "./employee-memory";

/**
 * Backend de persistance de la memoire d'un Employee. `load` resout []
 * pour un employe inconnu ; les implementations robustes ne rejettent
 * que sur panne d'entree-sortie (jamais sur fichier absent ou corrompu,
 * normalises en historique vide).
 */
export interface EmployeeMemoryStore {
  load(employeeId: string): Promise<readonly MissionRecord[]>;
  save(
    employeeId: string,
    records: readonly MissionRecord[]
  ): Promise<void>;
}
