export type EmployeeStatus = "idle" | "working" | "suspended";

export interface EmployeeProfile {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly skills: readonly string[];
  readonly status: EmployeeStatus;
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

  return {
    id,
    name,
    role,
    skills: [...(input.skills ?? [])],
    status: "idle",
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
