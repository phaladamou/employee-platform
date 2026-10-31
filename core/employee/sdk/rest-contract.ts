import type { EmployeeJob, JobStatus } from "../jobs/employee-job";
import type { EmployeeMission } from "../missions/employee-mission";
import type { Employment } from "../employments/employment";
import type { EmployeeProfile } from "../profile/employee-profile";

/**
 * Contrat REST partage par le serveur (B5), le client HTTP (B4) et la
 * CLI (B6). Auth : `Authorization: Bearer <cle>` (cle employeur `emo_`
 * pour les routes client, cle admin pour les routes createur).
 *
 * Routes client (tenant derive du token, jamais du body) :
 * - POST /v1/hires {employeeId} -> Employment (201, idempotent)
 * - GET /v1/hires -> Employment[]
 * - POST /v1/jobs {employeeId, prompt} -> EmployeeJob (202)
 * - GET /v1/jobs -> EmployeeJob[]
 * - GET /v1/jobs/:id -> EmployeeJob
 * - POST /v1/jobs/:id/cancel -> EmployeeJob
 * - GET /v1/jobs/:id/events -> SSE JobEvent*
 * - GET /v1/missions/:id -> EmployeeMission
 *
 * Routes createur (token admin) :
 * - POST /v1/employees {name, role, skills?, specialization?, createdBy?}
 * - GET /v1/employees -> EmployeeProfile[]
 */

export const EMPLOYEE_API_PREFIX = "/v1";

export interface HireRequest {
  readonly employeeId: string;
}

export interface SubmitJobRequest {
  readonly employeeId: string;
  readonly prompt: string;
}

export interface CreateEmployeeRequest {
  readonly name: string;
  readonly role: string;
  readonly skills?: readonly string[];
  readonly specialization?: {
    readonly name: string;
    readonly version: string;
  } | null;
  readonly createdBy?: string | null;
}

export interface JobListQuery {
  readonly statuses?: readonly JobStatus[];
}

export interface ApiErrorBody {
  readonly error: string;
  readonly message: string;
}

/** Evenement SSE : snapshot du job a chaque changement observe. */
export interface JobEvent {
  readonly job: EmployeeJob;
}

export function hirePath(): string {
  return `${EMPLOYEE_API_PREFIX}/hires`;
}

export function jobsPath(): string {
  return `${EMPLOYEE_API_PREFIX}/jobs`;
}

export function jobPath(jobId: string): string {
  return `${EMPLOYEE_API_PREFIX}/jobs/${encodeURIComponent(jobId)}`;
}

export function jobCancelPath(jobId: string): string {
  return `${jobPath(jobId)}/cancel`;
}

export function jobEventsPath(jobId: string): string {
  return `${jobPath(jobId)}/events`;
}

export function missionPath(missionId: string): string {
  return `${EMPLOYEE_API_PREFIX}/missions/${encodeURIComponent(missionId)}`;
}

export function employeesPath(): string {
  return `${EMPLOYEE_API_PREFIX}/employees`;
}

/**
 * Parse un flux SSE (lignes `data: <json>`) en evenements JobEvent.
 * Ignore les commentaires (:...), les lignes vides et les champs
 * autres que data. Pure et testable sans reseau.
 */
export function parseServerSentEvents(chunk: string): JobEvent[] {
  const events: JobEvent[] = [];

  for (const line of chunk.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }
    const payload = trimmed.slice("data:".length).trim();
    if (!payload) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(payload);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "job" in parsed &&
        typeof (parsed as { job: unknown }).job === "object"
      ) {
        events.push(parsed as JobEvent);
      }
    } catch {
      // Troncature reseau : ignore, le prochain chunk complete.
    }
  }

  return events;
}

export type {
  EmployeeJob,
  EmployeeMission,
  EmployeeProfile,
  Employment,
};
