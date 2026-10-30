import type { MissionRecord } from "./employee-memory";

/** Tenant employeur par defaut : mode local mono-tenant. */
export const LOCAL_EMPLOYER_ID = "local";

/**
 * Partition memoire : un employe + UN employeur. Jamais de melange :
 * deux employeurs du meme employe ont des historiques separes, sur
 * disque comme en memoire.
 */
export interface EmployeeMemoryScope {
  readonly employeeId: string;
  readonly employerId: string;
}

/**
 * Backend de persistance de la memoire, scope par (employe, employeur).
 * `load` resout [] pour un scope inconnu ; les implementations robustes
 * ne rejettent que sur panne d'entree-sortie.
 */
export interface EmployeeMemoryStore {
  load(scope: EmployeeMemoryScope): Promise<readonly MissionRecord[]>;
  save(
    scope: EmployeeMemoryScope,
    records: readonly MissionRecord[]
  ): Promise<void>;
}
