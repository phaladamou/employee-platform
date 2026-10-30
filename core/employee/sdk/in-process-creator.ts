import { randomUUID } from "node:crypto";

import {
  createEmployeeProfile,
  setEmployeeStatus,
  type EmployeeProfile,
} from "../profile/employee-profile";
import type { ProfileStore } from "../profile/profile-store";
import type { EmployeeSpecialization } from "../profiles/profile-spec";
import type { ProfileRegistry } from "../profiles/profile-registry";
import type { EmployeeCreator } from "./employee-creator";

export interface InProcessCreatorDeps {
  readonly profiles: ProfileStore;
  readonly registry: ProfileRegistry;
}

/**
 * Createur in-process : publie les employes et pose leur ADN. La
 * specialisation doit designer une spec EXACTE du registre (fail
 * fast) ; un employeur ne passe jamais par ici.
 */
export class InProcessEmployeeCreator implements EmployeeCreator {
  private readonly profiles: ProfileStore;
  private readonly registry: ProfileRegistry;

  constructor(deps: InProcessCreatorDeps) {
    this.profiles = deps.profiles;
    this.registry = deps.registry;
  }

  async publishEmployee(input: {
    id?: string;
    name: string;
    role: string;
    skills?: string[];
    specialization?: EmployeeSpecialization | null;
  }): Promise<EmployeeProfile> {
    const specialization = input.specialization ?? null;

    if (specialization) {
      const spec = this.registry.get(
        specialization.name,
        specialization.version
      );
      if (!spec) {
        throw new Error(
          `Unknown profile "${specialization.name}@${specialization.version}"`
        );
      }
    }

    const profile = createEmployeeProfile({
      id: input.id ?? `emp_${randomUUID()}`,
      name: input.name,
      role: input.role,
      skills: input.skills,
      specialization,
    });
    await this.profiles.save(profile);
    return profile;
  }

  async listEmployees(): Promise<readonly EmployeeProfile[]> {
    return this.profiles.list();
  }

  async suspendEmployee(employeeId: string): Promise<EmployeeProfile> {
    const profile = await this.profiles.load(employeeId);
    if (!profile) {
      throw new Error(`Employee ${employeeId} not found`);
    }
    const suspended = setEmployeeStatus(profile, "suspended");
    await this.profiles.save(suspended);
    return suspended;
  }

  async reactivateEmployee(employeeId: string): Promise<EmployeeProfile> {
    const profile = await this.profiles.load(employeeId);
    if (!profile) {
      throw new Error(`Employee ${employeeId} not found`);
    }
    const active = setEmployeeStatus(profile, "idle");
    await this.profiles.save(active);
    return active;
  }
}
