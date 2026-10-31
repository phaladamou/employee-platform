import { randomUUID } from "node:crypto";

import {
  validateAcceptance,
  type MissionAcceptance,
} from "./mission-acceptance";
import { assertAcceptanceForIntent } from "./mission-intent";

export type EmployeeMissionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "needs_review";

export interface MissionReport {
  readonly summary: string;
  readonly content: string;
  readonly completedAt: string;
}

export interface EmployeeMission {
  readonly id: string;
  readonly employeeId: string | null;
  /** Employeur donneur d'ordre (null = local non scope). */
  readonly employerId: string | null;
  readonly prompt: string;
  readonly status: EmployeeMissionStatus;
  /** Effets machine-verifiables exiges (vide = non verifiable). */
  readonly acceptance: MissionAcceptance;
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
  employerId?: string | null;
  acceptance?: unknown;
}): EmployeeMission {
  const prompt = input.prompt.trim();

  if (!prompt) {
    throw new Error("Mission prompt cannot be empty");
  }

  const employerId = input.employerId?.trim() || null;

  if (input.employerId !== undefined && employerId === null) {
    throw new Error("Employer id cannot be empty");
  }

  const acceptance = validateAcceptance(input.acceptance);
  assertAcceptanceForIntent(prompt, acceptance);

  return {
    id: input.id ?? `msn_${randomUUID()}`,
    employeeId: null,
    employerId,
    prompt,
    status: "pending",
    acceptance,
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

/**
 * Suspend le jugement : le LLM a emis FINAL mais des signaux
 * suspects ont ete observes (ex. outils hors profil tentes sans
 * aucun appel reussi). Le rapport est preserve pour le relecteur
 * humain ; error reste null (aucune erreur averee, juste un doute).
 */
export function flagMissionForReview(
  mission: EmployeeMission,
  report: { summary: string; content: string },
  now: Date = new Date()
): EmployeeMission {
  if (mission.status !== "running") {
    throw new Error(
      `Mission ${mission.id} cannot flag from status "${mission.status}"`
    );
  }

  const completedAt = now.toISOString();

  return {
    ...mission,
    status: "needs_review",
    report: { ...report, completedAt },
    completedAt,
  };
}
