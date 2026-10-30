import type { Employment } from "../employments/employment";
import { isTerminalJobStatus, type EmployeeJob, type JobStatus } from "../jobs/employee-job";
import type { EmployeeMission } from "../missions/employee-mission";
import type { EmployeeClient } from "./employee-client";
import {
  hirePath,
  jobCancelPath,
  jobEventsPath,
  jobPath,
  jobsPath,
  missionPath,
  parseServerSentEvents,
  type ApiErrorBody,
  type JobEvent,
} from "./rest-contract";

export class HttpEmployeeError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpEmployeeError";
    this.status = status;
    this.code = code;
  }
}

export interface HttpEmployeeClientOptions {
  readonly baseUrl: string;
  /** Cle employeur `emo_` (routes client). */
  readonly token: string;
  /** Injection reseau (tests). Defaut : fetch global. */
  readonly fetchImpl?: typeof fetch;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).error === "string" &&
    typeof (value as Record<string, unknown>).message === "string"
  );
}

/**
 * Client employeur HTTP : meme contrat que le client in-process, sur
 * le REST B5. Le tenant est derive du token cote serveur ; le client
 * ne transmet jamais d'employerId.
 */
export class HttpEmployeeClient implements EmployeeClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpEmployeeClientOptions) {
    if (!options.baseUrl.trim()) {
      throw new Error("HttpEmployeeClient requires a baseUrl");
    }
    if (!options.token.trim()) {
      throw new Error("HttpEmployeeClient requires a token");
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(
    path: string,
    init?: { method?: string; body?: unknown }
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(init?.body !== undefined
          ? { "content-type": "application/json" }
          : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

    if (response.status === 404) {
      return null as T;
    }

    let payload: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        throw new HttpEmployeeError(
          response.status,
          "bad_response",
          `Invalid JSON from ${path}`
        );
      }
    }

    if (!response.ok) {
      if (isApiErrorBody(payload)) {
        throw new HttpEmployeeError(
          response.status,
          payload.error,
          payload.message
        );
      }
      throw new HttpEmployeeError(
        response.status,
        "http_error",
        `Request to ${path} failed with status ${response.status}`
      );
    }

    return payload as T;
  }

  async hire(employeeId: string): Promise<Employment> {
    return this.request<Employment>(hirePath(), {
      method: "POST",
      body: { employeeId },
    });
  }

  async listHires(): Promise<readonly Employment[]> {
    return this.request<readonly Employment[]>(hirePath());
  }

  async submit(employeeId: string, prompt: string): Promise<EmployeeJob> {
    return this.request<EmployeeJob>(jobsPath(), {
      method: "POST",
      body: { employeeId, prompt },
    });
  }

  async status(jobId: string): Promise<EmployeeJob | null> {
    return this.request<EmployeeJob | null>(jobPath(jobId));
  }

  async listJobs(
    statuses?: readonly JobStatus[]
  ): Promise<readonly EmployeeJob[]> {
    const query =
      statuses && statuses.length > 0
        ? `?status=${statuses.map(encodeURIComponent).join(",")}`
        : "";
    return this.request<readonly EmployeeJob[]>(`${jobsPath()}${query}`);
  }

  async cancel(jobId: string): Promise<EmployeeJob | null> {
    return this.request<EmployeeJob | null>(jobCancelPath(jobId), {
      method: "POST",
    });
  }

  async mission(missionId: string): Promise<EmployeeMission | null> {
    return this.request<EmployeeMission | null>(missionPath(missionId));
  }

  async *events(jobId: string): AsyncIterable<JobEvent> {
    const response = await this.fetchImpl(
      `${this.baseUrl}${jobEventsPath(jobId)}`,
      {
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: "text/event-stream",
        },
      }
    );

    if (response.status === 404) {
      throw new HttpEmployeeError(
        404,
        "not_found",
        `Job ${jobId} not found`
      );
    }
    if (!response.ok || !response.body) {
      throw new HttpEmployeeError(
        response.status,
        "http_error",
        `Events stream for ${jobId} failed with status ${response.status}`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        // Ne parse que les lignes completes (un chunk peut couper
        // une ligne SSE en deux).
        const cut = buffer.lastIndexOf("\n");
        if (cut !== -1) {
          const complete = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 1);
          for (const event of parseServerSentEvents(complete)) {
            yield event;
            if (isTerminalJobStatus(event.job.status)) {
              return;
            }
          }
        }

        if (done) {
          for (const event of parseServerSentEvents(buffer)) {
            yield event;
            if (isTerminalJobStatus(event.job.status)) {
              return;
            }
          }
          return;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
