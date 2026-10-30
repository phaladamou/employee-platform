import { randomUUID } from "node:crypto";

export const EMPLOYMENT_ID_PREFIX = "hire_";

/**
 * Engagement : relation SEPAREE liant un employe (identite persistante)
 * a un employeur (tenant). L'employeur ne choisit ni ne modifie la
 * specialisation : il recrute un employe publie, point. Resilier ne
 * detruit ni l'employe ni son historique (facturation/audit).
 */
export interface Employment {
  readonly id: string;
  readonly employeeId: string;
  readonly employerId: string;
  readonly hiredAt: string;
  readonly terminatedAt: string | null;
}

export function isEmployment(value: unknown): value is Employment {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.employeeId === "string" &&
    typeof record.employerId === "string" &&
    typeof record.hiredAt === "string" &&
    (typeof record.terminatedAt === "string" || record.terminatedAt === null)
  );
}

export function createEmployment(input: {
  employeeId: string;
  employerId: string;
  id?: string;
  now?: Date;
}): Employment {
  const employeeId = input.employeeId.trim();
  const employerId = input.employerId.trim();

  if (!employeeId) {
    throw new Error("Employee id cannot be empty");
  }
  if (!employerId) {
    throw new Error("Employer id cannot be empty");
  }

  return {
    id: input.id ?? `${EMPLOYMENT_ID_PREFIX}${randomUUID()}`,
    employeeId,
    employerId,
    hiredAt: (input.now ?? new Date()).toISOString(),
    terminatedAt: null,
  };
}
