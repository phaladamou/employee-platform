import type { Employment } from "./employment";

/**
 * Backend des engagements. `hire` est idempotent (engagement actif
 * existant -> retourne tel quel) ; `terminate` sur un ID inconnu leve,
 * sur un engagement deja resilie retourne tel quel.
 */
export interface EmploymentStore {
  hire(input: {
    employeeId: string;
    employerId: string;
    id?: string;
    now?: Date;
  }): Promise<Employment>;
  terminate(id: string, now?: Date): Promise<Employment>;
  get(id: string): Promise<Employment | null>;
  findActive(
    employeeId: string,
    employerId: string
  ): Promise<Employment | null>;
  listByEmployer(employerId: string): Promise<readonly Employment[]>;
}
