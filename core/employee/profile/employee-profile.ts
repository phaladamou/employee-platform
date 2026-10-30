import type { ProfileRegistry } from "../profiles/profile-registry";
import {
  isEmployeeSpecialization,
  type EmployeeSpecialization,
} from "../profiles/profile-spec";

export type EmployeeStatus = "idle" | "working" | "suspended";

export interface EmployeeProfile {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly skills: readonly string[];
  readonly status: EmployeeStatus;
  /**
   * ADN pose a l'embauche (specialisation + version exacte) ou null
   * (generaliste). Immuable : aucun setter, seule une migration
   * explicite cree un nouveau profil lie.
   */
  readonly specialization: EmployeeSpecialization | null;
}

const TRANSITIONS: Record<EmployeeStatus, readonly EmployeeStatus[]> = {
  idle: ["working", "suspended"],
  working: ["idle", "suspended"],
  suspended: ["idle"],
};

/**
 * Cree le profil d'un Employee. Les mises a jour sont immuables :
 * chaque transition retourne un nouveau profil.
 */
export function createEmployeeProfile(input: {
  id: string;
  name: string;
  role: string;
  skills?: string[];
  specialization?: EmployeeSpecialization | null;
}): EmployeeProfile {
  const id = input.id.trim();
  const name = input.name.trim();
  const role = input.role.trim();

  if (!id) {
    throw new Error("Employee id cannot be empty");
  }
  if (!name) {
    throw new Error("Employee name cannot be empty");
  }
  if (!role) {
    throw new Error("Employee role cannot be empty");
  }
  if (
    input.specialization !== undefined &&
    input.specialization !== null &&
    !isEmployeeSpecialization(input.specialization)
  ) {
    throw new Error("Employee specialization is invalid");
  }

  return {
    id,
    name,
    role,
    skills: [...(input.skills ?? [])],
    status: "idle",
    specialization: input.specialization
      ? { ...input.specialization }
      : null,
  };
}

/**
 * Fait transiter un profil vers un nouveau statut (transition legale
 * uniquement).
 */
export function setEmployeeStatus(
  profile: EmployeeProfile,
  status: EmployeeStatus
): EmployeeProfile {
  if (profile.status === status) {
    return profile;
  }

  if (!TRANSITIONS[profile.status].includes(status)) {
    throw new Error(
      `Employee ${profile.id} cannot go from "${profile.status}" to "${status}"`
    );
  }

  return { ...profile, status };
}

/**
 * Migration EXPLICITE de specialisation : retourne un nouveau profil lie
 * a la version cible (meme identite, donc memoire preservee), l'ancien
 * est inchange. Seule voie de changement, jamais automatique : employe
 * non lie -> erreur, version cible inconnue du registre -> erreur,
 * meme version -> profil inchange. Le nom ne change jamais (on migre
 * une version, on ne change pas de metier).
 */
export function migrateEmployeeProfile(
  profile: EmployeeProfile,
  version: string,
  registry: ProfileRegistry
): EmployeeProfile {
  const binding = profile.specialization;

  if (!binding) {
    throw new Error(
      `Employee ${profile.id} has no bound specialization to migrate`
    );
  }
  if (version === binding.version) {
    return profile;
  }

  const target = registry.get(binding.name, version);

  if (!target) {
    throw new Error(
      `Unknown profile "${binding.name}@${version}" for employee ${profile.id}`
    );
  }

  return {
    ...profile,
    specialization: { name: binding.name, version: target.version },
  };
}
