import { randomUUID } from "node:crypto";

export type EmployeeMissionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface MissionReport {
  readonly summary: string;
  readonly content: string;
  readonly completedAt: string;
}

export interface EmployeeMission {
  readonly id: string;
  readonly employeeId: string | null;
  readonly prompt: string;
  readonly status: EmployeeMissionStatus;
  readonly report: MissionReport | null;
  readonly error: string | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

/**
 * Cree une mission (non assignee, en attente). Toutes les transitions
 * sont immuables : chaque etape retourne une nouvelle mission.
 */
export function createEmployeeMission(input: {
  id?: string;
  prompt: string;
  now?: Date;
}): EmployeeMission {
  const prompt = input.prompt.trim();

  if (!prompt) {
    throw new Error("Mission prompt cannot be empty");
  }

  return {
    id: input.id ?? `msn_${randomUUID()}`,
    employeeId: null,
    prompt,
    status: "pending",
    report: null,
    error: null,
    createdAt: (input.now ?? new Date()).toISOString(),
    startedAt: null,
    completedAt: null,
  };
}

/**
 * Assigne une mission en attente a un Employee.
 */
export function assignMission(
  mission: EmployeeMission,
  employeeId: string
): EmployeeMission {
  const assignee = employeeId.trim();

  if (!assignee) {
    throw new Error("Employee id cannot be empty");
  }
  if (mission.status !== "pending") {
    throw new Error(
      `Mission ${mission.id} cannot be assigned from status "${mission.status}"`
    );
  }
  if (mission.employeeId !== null) {
    throw new Error(`Mission ${mission.id} is already assigned`);
  }

  return { ...mission, employeeId: assignee };
}

/**
 * Demarre une mission assignee.
 */
export function startEmployeeMission(
  mission: EmployeeMission,
  now: Date = new Date()
): EmployeeMission {
  if (mission.status !== "pending") {
    throw new Error(
      `Mission ${mission.id} cannot start from status "${mission.status}"`
    );
  }
  if (mission.employeeId === null) {
    throw new Error(`Mission ${mission.id} is not assigned`);
  }

  return { ...mission, status: "running", startedAt: now.toISOString() };
}

/**
 * Termine une mission avec son rapport final.
 */
export function completeEmployeeMission(
  mission: EmployeeMission,
  report: { summary: string; content: string },
  now: Date = new Date()
): EmployeeMission {
  if (mission.status !== "running") {
    throw new Error(
      `Mission ${mission.id} cannot complete from status "${mission.status}"`
    );
  }

  const completedAt = now.toISOString();

  return {
    ...mission,
    status: "completed",
    report: { ...report, completedAt },
    completedAt,
  };
}

/**
 * Marque une mission en echec.
 */
export function failEmployeeMission(
  mission: EmployeeMission,
  error: string,
  now: Date = new Date()
): EmployeeMission {
  if (mission.status !== "running") {
    throw new Error(
      `Mission ${mission.id} cannot fail from status "${mission.status}"`
    );
  }

  return {
    ...mission,
    status: "failed",
    error,
    completedAt: now.toISOString(),
  };
}
