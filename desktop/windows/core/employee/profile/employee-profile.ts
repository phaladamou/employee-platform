import type { ProfileRegistry } from "../profiles/profile-registry";
import {
  isEmployeeIdentity,
  issueEmployeeIdentity,
  type EmployeeIdentity,
} from "../identity/employee-id";
import {
  isEmployeeSpecialization,
  type EmployeeSpecialization,
} from "../profiles/profile-spec";

export type EmployeeStatus = "idle" | "working" | "suspended";

export interface EmployeeProfile {
  readonly id: string;
  /**
   * Carte d'identite cryptographique delivree a la creation
   * (id + empreinte + createdAt). Immuable : aucun setter, les
   * transitions et migrations la preservent telle quelle.
   */
  readonly identity: EmployeeIdentity;
  readonly name: string;
  readonly role: string;
  readonly skills: readonly string[];
  readonly status: EmployeeStatus;
  /**
   * Marque de provenance posee a la publication (ex. "Cofoundator")
   * ou null (origine inconnue). Immuable comme l'identite : aucun
   * setter, les transitions et migrations la preservent telle quelle.
   */
  readonly createdBy: string | null;
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
 * chaque transition retourne un nouveau profil. L'identite est
 * delivree ici (jamais a la volee) : fournie et verifiee, ou emise
 * pour cet id.
 */
export function createEmployeeProfile(input: {
  id: string;
  name: string;
  role: string;
  skills?: string[];
  specialization?: EmployeeSpecialization | null;
  identity?: EmployeeIdentity;
  createdBy?: string | null;
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
    input.createdBy !== undefined &&
    input.createdBy !== null &&
    !input.createdBy.trim()
  ) {
    throw new Error("Employee createdBy cannot be empty");
  }
  if (
    input.specialization !== undefined &&
    input.specialization !== null &&
    !isEmployeeSpecialization(input.specialization)
  ) {
    throw new Error("Employee specialization is invalid");
  }

  let identity: EmployeeIdentity;
  if (input.identity) {
    if (!isEmployeeIdentity(input.identity)) {
      throw new Error("Employee identity is invalid");
    }
    if (input.identity.id !== id) {
      throw new Error("Employee identity does not match id");
    }
    identity = { ...input.identity };
  } else {
    identity = issueEmployeeIdentity(id);
  }

  return {
    id,
    identity,
    name,
    role,
    skills: [...(input.skills ?? [])],
    status: "idle",
    createdBy: input.createdBy?.trim() ?? null,
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
