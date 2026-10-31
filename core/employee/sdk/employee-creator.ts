import type { EmployeeSpecialization } from "../profiles/profile-spec";
import type { EmployeeProfile } from "../profile/employee-profile";

/**
 * SDK cote createur (admin). Seul le createur publie des employes et
 * pose leur ADN ; l'employeur recrute, il ne definit pas.
 */
export interface EmployeeCreator {
  /**
   * Publie un employe. Le couple (name, version) doit designer une
   * spec exacte du registre ; null = generaliste sans ADN.
   */
  publishEmployee(input: {
    id?: string;
    name: string;
    role: string;
    skills?: string[];
    specialization?: EmployeeSpecialization | null;
    createdBy?: string | null;
  }): Promise<EmployeeProfile>;

  /** Catalogue complet des employes publies. */
  listEmployees(): Promise<readonly EmployeeProfile[]>;

  /** Suspend un employe (ses runs futurs levent). */
  suspendEmployee(employeeId: string): Promise<EmployeeProfile>;

  /** Re-active un employe suspendu. */
  reactivateEmployee(employeeId: string): Promise<EmployeeProfile>;
}
