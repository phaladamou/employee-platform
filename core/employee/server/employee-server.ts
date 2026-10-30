import {
  verifyEmployerCredential,
  type EmployerCredential,
} from "../auth/employer-credential";
import type { EmployerCredentialStore } from "../auth/employer-credential-store";
import type { CredentialScope } from "../auth/employee-credential";
import type { EmploymentStore } from "../employments/employment-store";
import {
  isTerminalJobStatus,
  type JobStatus,
} from "../jobs/employee-job";
import type { JobStore } from "../jobs/job-store";
import type { MissionStore } from "../missions/mission-store";
import type { ProfileStore } from "../profile/profile-store";
import type { ProfileRegistry } from "../profiles/profile-registry";
import { InProcessEmployeeClient } from "../sdk/in-process-client";
import { InProcessEmployeeCreator } from "../sdk/in-process-creator";

export interface EmployeeServerDeps {
  readonly profiles: ProfileStore;
  readonly employments: EmploymentStore;
  readonly missions: MissionStore;
  readonly jobs: JobStore;
  readonly credentials: EmployerCredentialStore;
  readonly registry: ProfileRegistry;
  /** Delai entre deux lectures du store sur le flux SSE. */
  readonly eventsPollMs?: number;
  /** Battement SSE (commentaire) pour garder la connexion en vie. */
  readonly eventsHeartbeatMs?: number;
}

/** Requete agnostique du runtime HTTP (adaptee par node-adapter). */
export interface EmployeeHttpRequest {
  readonly method: string;
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly bodyText: string;
}

export type EmployeeHttpResponse =
  | { readonly status: number; readonly body: string }
  | {
      readonly status: number;
      readonly stream: AsyncIterable<string>;
    };

const JOB_STATUSES: readonly string[] = [
  "queued",
  "running",
  "cancellation_requested",
  "succeeded",
  "failed",
  "cancelled",
];

function json(status: number, payload: unknown): EmployeeHttpResponse {
  return { status, body: JSON.stringify(payload) };
}

function apiError(status: number, error: string, message: string) {
  return json(status, { error, message });
}

function bearerToken(
  headers: Readonly<Record<string, string | undefined>>
): string | null {
  const header = headers.authorization ?? headers.Authorization;
  if (!header) {
    return null;
  }
  const match = /^Bearer (.+)$/.exec(header.trim());
  return match ? match[1].trim() || null : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBody(bodyText: string): { ok: true; value: unknown } | { ok: false } {
  if (!bodyText.trim()) {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(bodyText) as unknown };
  } catch {
    return { ok: false };
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Traduit les erreurs metier du SDK en reponses HTTP. Convention
 * volontairement explicite et testee (le SDK leve des Error simples).
 */
function toHttpError(error: unknown): EmployeeHttpResponse {
  const message = error instanceof Error ? error.message : String(error);

  if (/not found$/.test(message)) {
    return apiError(404, "not_found", message);
  }
  if (/is not hired by this employer/.test(message)) {
    return apiError(403, "not_hired", message);
  }
  if (
    /cannot be empty|requires |Unknown profile|Invalid |must be |is invalid/.test(
      message
    )
  ) {
    return apiError(400, "bad_request", message);
  }
  if (/is locked/.test(message)) {
    return apiError(409, "conflict", message);
  }
  return apiError(500, "internal", "Internal server error");
}

/**
 * Handler HTTP pur (aucun import node:http) : routes REST + auth par
 * cles employeur `emo_` + scopes. Le tenant vient du token verifie,
 * jamais du body ni de l'URL.
 */
export function createEmployeeHandler(deps: EmployeeServerDeps) {
  const eventsPollMs = deps.eventsPollMs ?? 100;
  const eventsHeartbeatMs = deps.eventsHeartbeatMs ?? 15_000;

  async function authenticate(
    req: EmployeeHttpRequest,
    scope: CredentialScope
  ): Promise<EmployerCredential | null> {
    const token = bearerToken(req.headers);
    if (!token) {
      return null;
    }
    return verifyEmployerCredential(deps.credentials, token, { scope });
  }

  function clientFor(employerId: string): InProcessEmployeeClient {
    return new InProcessEmployeeClient({
      employerId,
      profiles: deps.profiles,
      employments: deps.employments,
      missions: deps.missions,
      jobs: deps.jobs,
    });
  }

  function creator(): InProcessEmployeeCreator {
    return new InProcessEmployeeCreator({
      profiles: deps.profiles,
      registry: deps.registry,
    });
  }

  async function* streamJobEvents(
    employerId: string,
    jobId: string
  ): AsyncIterable<string> {
    let lastStatus = "";
    let lastBeat = Date.now();

    for (;;) {
      const current = await deps.jobs.loadScoped(employerId, jobId);
      if (!current) {
        return;
      }
      if (current.status !== lastStatus) {
        lastStatus = current.status;
        yield `data: ${JSON.stringify({ job: current })}\n\n`;
      }
      if (isTerminalJobStatus(current.status)) {
        return;
      }
      if (Date.now() - lastBeat >= eventsHeartbeatMs) {
        lastBeat = Date.now();
        yield ": ping\n\n";
      }
      await sleep(eventsPollMs);
    }
  }

  return async function handle(
    req: EmployeeHttpRequest
  ): Promise<EmployeeHttpResponse> {
    const { method, pathname } = req;

    // --- Hires ---
    if (method === "POST" && pathname === "/v1/hires") {
      const auth = await authenticate(req, "employments:write");
      if (!auth) {
        return apiError(401, "unauthorized", "Authentication required");
      }
      const parsed = parseBody(req.bodyText);
      if (!parsed.ok) {
        return apiError(400, "bad_request", "Invalid JSON body");
      }
      const employeeId = asNonEmptyString(asRecord(parsed.value)?.employeeId);
      if (!employeeId) {
        return apiError(400, "bad_request", "employeeId is required");
      }
      try {
        return json(201, await clientFor(auth.employerId).hire(employeeId));
      } catch (error) {
        return toHttpError(error);
      }
    }

    if (method === "GET" && pathname === "/v1/hires") {
      const auth = await authenticate(req, "employments:read");
      if (!auth) {
        return apiError(401, "unauthorized", "Authentication required");
      }
      return json(200, await clientFor(auth.employerId).listHires());
    }

    // --- Jobs ---
    if (method === "POST" && pathname === "/v1/jobs") {
      const auth = await authenticate(req, "missions:submit");
      if (!auth) {
        return apiError(401, "unauthorized", "Authentication required");
      }
      const parsed = parseBody(req.bodyText);
      if (!parsed.ok) {
        return apiError(400, "bad_request", "Invalid JSON body");
      }
      const record = asRecord(parsed.value);
      const employeeId = asNonEmptyString(record?.employeeId);
      const prompt = asNonEmptyString(record?.prompt);
      if (!employeeId || !prompt) {
        return apiError(
          400,
          "bad_request",
          "employeeId and prompt are required"
        );
      }
      try {
        return json(
          202,
          await clientFor(auth.employerId).submit(employeeId, prompt)
        );
      } catch (error) {
        return toHttpError(error);
      }
    }

    if (method === "GET" && pathname === "/v1/jobs") {
      const auth = await authenticate(req, "missions:read");
      if (!auth) {
        return apiError(401, "unauthorized", "Authentication required");
      }
      const raw = req.searchParams.get("status");
      let statuses: JobStatus[] | undefined;
      if (raw !== null && raw !== "") {
        statuses = [];
        for (const part of raw.split(",")) {
          const status = part.trim();
          if (!JOB_STATUSES.includes(status)) {
            return apiError(400, "bad_request", `Unknown status: ${status}`);
          }
          statuses.push(status as JobStatus);
        }
      }
      return json(200, await clientFor(auth.employerId).listJobs(statuses));
    }

    const jobMatch = /^\/v1\/jobs\/([^/]+)$/.exec(pathname);
    if (method === "GET" && jobMatch) {
      const auth = await authenticate(req, "missions:read");
      if (!auth) {
        return apiError(401, "unauthorized", "Authentication required");
      }
      const job = await clientFor(auth.employerId).status(
        decodeURIComponent(jobMatch[1])
      );
      if (!job) {
        return apiError(404, "not_found", "Job not found");
      }
      return json(200, job);
    }

    const cancelMatch = /^\/v1\/jobs\/([^/]+)\/cancel$/.exec(pathname);
    if (method === "POST" && cancelMatch) {
      const auth = await authenticate(req, "missions:submit");
      if (!auth) {
        return apiError(401, "unauthorized", "Authentication required");
      }
      try {
        const job = await clientFor(auth.employerId).cancel(
          decodeURIComponent(cancelMatch[1])
        );
        if (!job) {
          return apiError(404, "not_found", "Job not found");
        }
        return json(200, job);
      } catch (error) {
        return toHttpError(error);
      }
    }

    const eventsMatch = /^\/v1\/jobs\/([^/]+)\/events$/.exec(pathname);
    if (method === "GET" && eventsMatch) {
      const auth = await authenticate(req, "missions:read");
      if (!auth) {
        return apiError(401, "unauthorized", "Authentication required");
      }
      const jobId = decodeURIComponent(eventsMatch[1]);
      const exists = await deps.jobs.loadScoped(auth.employerId, jobId);
      if (!exists) {
        return apiError(404, "not_found", "Job not found");
      }
      return {
        status: 200,
        stream: streamJobEvents(auth.employerId, jobId),
      };
    }

    // --- Missions ---
    const missionMatch = /^\/v1\/missions\/([^/]+)$/.exec(pathname);
    if (method === "GET" && missionMatch) {
      const auth = await authenticate(req, "missions:read");
      if (!auth) {
        return apiError(401, "unauthorized", "Authentication required");
      }
      const mission = await clientFor(auth.employerId).mission(
        decodeURIComponent(missionMatch[1])
      );
      if (!mission) {
        return apiError(404, "not_found", "Mission not found");
      }
      return json(200, mission);
    }

    // --- Employees (catalogue lisible par tout token, publication admin) ---
    if (method === "GET" && pathname === "/v1/employees") {
      const auth = await authenticate(req, "missions:read");
      if (!auth) {
        return apiError(401, "unauthorized", "Authentication required");
      }
      return json(200, await creator().listEmployees());
    }

    if (method === "POST" && pathname === "/v1/employees") {
      const auth = await authenticate(req, "admin");
      if (!auth) {
        return apiError(401, "unauthorized", "Authentication required");
      }
      const parsed = parseBody(req.bodyText);
      if (!parsed.ok) {
        return apiError(400, "bad_request", "Invalid JSON body");
      }
      const record = asRecord(parsed.value) ?? {};
      try {
        const created = await creator().publishEmployee({
          name: asNonEmptyString(record.name) ?? "",
          role: asNonEmptyString(record.role) ?? "",
          skills: Array.isArray(record.skills)
            ? record.skills.filter(
                (skill): skill is string => typeof skill === "string"
              )
            : undefined,
          specialization:
            record.specialization === null ||
            record.specialization === undefined
              ? null
              : (record.specialization as {
                  name: string;
                  version: string;
                }),
        });
        return json(201, created);
      } catch (error) {
        return toHttpError(error);
      }
    }

    return apiError(404, "not_found", "Unknown route");
  };
}
