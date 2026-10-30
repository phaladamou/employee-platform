import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { open } from "node:fs/promises";
import { join } from "node:path";

import {
  cancelEmployeeJob,
  claimEmployeeJob,
  type EmployeeJob,
  failEmployeeJob,
  heartbeatEmployeeJob,
  isJobStale,
  type JobStatus,
  requestEmployeeJobCancellation,
  requeueStaleJob,
  settleStaleCancellation,
  succeedEmployeeJob,
} from "./employee-job";
import type { JobStore } from "./job-store";

const JOB_STATUSES: readonly JobStatus[] = [
  "queued",
  "running",
  "cancellation_requested",
  "succeeded",
  "failed",
  "cancelled",
];

/**
 * Duree au-dela de laquelle un fichier .lock est considere comme
 * abandonne (crash en pleine section critique, qui dure quelques
 * millisecondes) et peut etre vole. Ce n'est PAS un heartbeat de job :
 * un worker mort en running laisse le job verrouille (at-least-once).
 */
const STALE_LOCK_MS = 60_000;

/**
 * Silence worker au-dela duquel un job running est presume orphelin.
 * Doit rester tres superieur a l'intervalle de heartbeat (15 s).
 */
export const DEFAULT_STALE_AFTER_MS = 120_000;

function sanitizeId(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safe) {
    throw new Error("Job id cannot be empty");
  }
  return safe;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNullableString(value: unknown): string | null {
  return value === null || value === undefined
    ? null
    : typeof value === "string"
      ? value
      : null;
}

/** Reconstruit un job depuis JSON, null si invalide (jamais de throw). */
function parseJob(raw: unknown): EmployeeJob | null {
  if (!isRecord(raw)) {
    return null;
  }

  const status = asString(raw.status);
  if (status === null || !(JOB_STATUSES as readonly string[]).includes(status)) {
    return null;
  }

  const id = asString(raw.id);
  const missionId = asString(raw.missionId);
  const employeeId = asString(raw.employeeId);
  const employerId = asString(raw.employerId);
  const createdAt = asString(raw.createdAt);

  if (!id || !missionId || !employeeId || !employerId || !createdAt) {
    return null;
  }

  return {
    id,
    missionId,
    employeeId,
    employerId,
    status: status as JobStatus,
    lockOwner: asNullableString(raw.lockOwner),
    lastHeartbeatAt: asNullableString(raw.lastHeartbeatAt),
    report: asNullableString(raw.report),
    error: asNullableString(raw.error),
    createdAt,
    startedAt: asNullableString(raw.startedAt),
    finishedAt: asNullableString(raw.finishedAt),
  };
}

/**
 * Jobs persistants, un JSON par job. Le claim est atomique grace a un
 * fichier verrou cree en mode exclusif ("wx") : face a N workers (memes
 * processus separes), un seul obtient le verrou, les autres recoivent
 * null. Toute mutation passe par le meme verrou (lecture-modification
 * -ecriture protegee).
 */
export class FileJobStore implements JobStore {
  private readonly directory: string;

  constructor(options: { directory: string }) {
    if (!options.directory.trim()) {
      throw new Error("Job directory cannot be empty");
    }
    this.directory = options.directory;
  }

  private jobPath(jobId: string): string {
    return join(this.directory, `job_${sanitizeId(jobId)}.json`);
  }

  private lockPath(jobId: string): string {
    return join(this.directory, `job_${sanitizeId(jobId)}.lock`);
  }

  private async acquireLock(
    jobId: string,
    workerId: string
  ): Promise<{ release(): Promise<void> } | null> {
    await mkdir(this.directory, { recursive: true });
    const path = this.lockPath(jobId);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const handle = await open(path, "wx", 0o600);
        await handle.writeFile(
          JSON.stringify({ workerId, at: new Date().toISOString() })
        );
        await handle.close();
        return {
          release: async () => {
            await unlink(path).catch(() => undefined);
          },
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          throw error;
        }
      }

      // Verrou present : abandonne par un crash ?
      if (await this.isLockStale(path)) {
        await unlink(path).catch(() => undefined);
        continue;
      }
      return null;
    }

    return null;
  }

  private async isLockStale(path: string): Promise<boolean> {
    try {
      const raw = await readFile(path, "utf8");
      const data: unknown = JSON.parse(raw);
      if (!isRecord(data) || typeof data.at !== "string") {
        return true;
      }
      const at = Date.parse(data.at);
      return Number.isNaN(at) || Date.now() - at > STALE_LOCK_MS;
    } catch {
      // Verrou illisible ou disparu entre-temps : le re-acquerir est sur.
      return true;
    }
  }

  private async readJob(jobId: string): Promise<EmployeeJob | null> {
    let raw: string;
    try {
      raw = await readFile(this.jobPath(jobId), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      await this.quarantine(jobId);
      return null;
    }

    const job = parseJob(parsed);
    if (!job) {
      await this.quarantine(jobId);
    }
    return job;
  }

  private async quarantine(jobId: string): Promise<void> {
    const from = this.jobPath(jobId);
    const to = `${from}.corrupt.${Date.now()}`;
    await rename(from, to).catch(() => undefined);
  }

  private async writeJob(job: EmployeeJob): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.jobPath(job.id), JSON.stringify(job, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  /**
   * Execute fn sous verrou. Retourne null si le verrou est tenu par un
   * autre worker (l'appelant decide : null ou erreur retryable).
   */
  private async withLock<T>(
    jobId: string,
    workerId: string,
    fn: (current: EmployeeJob | null) => Promise<T>
  ): Promise<T | null> {
    const lock = await this.acquireLock(jobId, workerId);
    if (!lock) {
      return null;
    }
    try {
      return await fn(await this.readJob(jobId));
    } finally {
      await lock.release();
    }
  }

  async enqueue(job: EmployeeJob): Promise<void> {
    if (job.status !== "queued") {
      throw new Error(`Only queued jobs can be enqueued (${job.id})`);
    }
    await mkdir(this.directory, { recursive: true });
    try {
      const handle = await open(this.jobPath(job.id), "wx", 0o600);
      await handle.writeFile(JSON.stringify(job, null, 2));
      await handle.close();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`Job ${job.id} already exists`);
      }
      throw error;
    }
  }

  async claim(
    jobId: string,
    workerId: string,
    now: Date = new Date()
  ): Promise<EmployeeJob | null> {
    return this.withLock(jobId, workerId, async (current) => {
      if (!current || current.status !== "queued") {
        return null;
      }
      const claimed = claimEmployeeJob(current, workerId, now);
      await this.writeJob(claimed);
      return claimed;
    });
  }

  async nextQueued(employerId: string): Promise<EmployeeJob | null> {
    const queued = await this.listByEmployer(employerId, ["queued"]);
    return queued[0] ?? null;
  }

  async claimNext(
    workerId: string,
    now: Date = new Date()
  ): Promise<EmployeeJob | null> {
    for (const candidate of await this.listQueuedOldestFirst()) {
      const claimed = await this.claim(candidate.id, workerId, now);
      if (claimed) {
        return claimed;
      }
    }
    return null;
  }

  /** Tous les jobs valides du repertoire (corrompus ignores). */
  private async scanJobs(): Promise<EmployeeJob[]> {
    let names: string[];
    try {
      names = await readdir(this.directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const jobs: EmployeeJob[] = [];
    for (const name of names) {
      if (!name.startsWith("job_") || !name.endsWith(".json")) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(
          await readFile(join(this.directory, name), "utf8")
        ) as unknown;
      } catch {
        continue;
      }
      const job = parseJob(parsed);
      if (job) {
        jobs.push(job);
      }
    }

    return jobs;
  }

  private async listQueuedOldestFirst(): Promise<EmployeeJob[]> {
    const queued = (await this.scanJobs()).filter(
      (job) => job.status === "queued"
    );
    queued.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return queued;
  }

  async load(jobId: string): Promise<EmployeeJob | null> {
    return this.readJob(jobId);
  }

  async loadScoped(
    employerId: string,
    jobId: string
  ): Promise<EmployeeJob | null> {
    const job = await this.readJob(jobId);
    if (!job || job.employerId !== employerId) {
      return null;
    }
    return job;
  }

  async listByEmployer(
    employerId: string,
    statuses?: readonly JobStatus[]
  ): Promise<readonly EmployeeJob[]> {
    let names: string[];
    try {
      names = await readdir(this.directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const jobs: EmployeeJob[] = [];
    for (const name of names) {
      if (!name.startsWith("job_") || !name.endsWith(".json")) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(
          await readFile(join(this.directory, name), "utf8")
        ) as unknown;
      } catch {
        continue;
      }
      const job = parseJob(parsed);
      if (!job || job.employerId !== employerId) {
        continue;
      }
      if (statuses && !statuses.includes(job.status)) {
        continue;
      }
      jobs.push(job);
    }

    jobs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return jobs;
  }

  async requestCancellation(
    jobId: string,
    now: Date = new Date()
  ): Promise<EmployeeJob | null> {
    const updated = await this.withLock(jobId, "cancel", async (current) => {
      if (!current) {
        return null;
      }
      const next = requestEmployeeJobCancellation(current, now);
      if (next !== current) {
        await this.writeJob(next);
      }
      return next;
    });

    if (updated === null) {
      // Verrou tenu OU job inconnu : leve seulement si le job existe.
      const current = await this.readJob(jobId);
      if (current) {
        throw new Error(`Job ${jobId} is locked, retry cancellation`);
      }
      return null;
    }
    return updated;
  }

  private async finish(
    jobId: string,
    workerId: string,
    now: Date,
    transition: (current: EmployeeJob) => EmployeeJob
  ): Promise<EmployeeJob> {
    const updated = await this.withLock(jobId, workerId, async (current) => {
      if (!current) {
        throw new Error(`Job ${jobId} not found`);
      }
      const next = transition(current);
      await this.writeJob(next);
      return next;
    });

    if (!updated) {
      throw new Error(`Job ${jobId} is locked by another worker`);
    }
    return updated;
  }

  async markCancelled(
    jobId: string,
    workerId: string,
    now: Date = new Date()
  ): Promise<EmployeeJob> {
    return this.finish(jobId, workerId, now, (current) =>
      cancelEmployeeJob(current, workerId, now)
    );
  }

  async markSucceeded(
    jobId: string,
    workerId: string,
    report: string,
    now: Date = new Date()
  ): Promise<EmployeeJob> {
    return this.finish(jobId, workerId, now, (current) =>
      succeedEmployeeJob(current, workerId, report, now)
    );
  }

  async markFailed(
    jobId: string,
    workerId: string,
    error: string,
    now: Date = new Date()
  ): Promise<EmployeeJob> {
    return this.finish(jobId, workerId, now, (current) =>
      failEmployeeJob(current, workerId, error, now)
    );
  }

  async heartbeat(
    jobId: string,
    workerId: string,
    now: Date = new Date()
  ): Promise<EmployeeJob> {
    const touched = await this.withLock(jobId, workerId, async (current) => {
      if (!current) {
        throw new Error(`Job ${jobId} not found`);
      }
      const next = heartbeatEmployeeJob(current, workerId, now);
      await this.writeJob(next);
      return next;
    });

    if (!touched) {
      throw new Error(`Job ${jobId} is locked by another worker`);
    }
    return touched;
  }

  async recoverStaleJobs(options: {
    staleAfterMs?: number;
    now?: Date;
  } = {}): Promise<readonly EmployeeJob[]> {
    const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
    const now = options.now ?? new Date();
    const recovered: EmployeeJob[] = [];

    const candidates = (await this.scanJobs()).filter((job) =>
      isJobStale(job, staleAfterMs, now)
    );
    candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const candidate of candidates) {
      // Re-lecture sous verrou : le job a pu bouger depuis le scan.
      const settled = await this.withLock(
        candidate.id,
        "recovery",
        async (current) => {
          if (!current || !isJobStale(current, staleAfterMs, now)) {
            return null;
          }
          const next =
            current.status === "cancellation_requested"
              ? settleStaleCancellation(current, now)
              : requeueStaleJob(current);
          await this.writeJob(next);
          return next;
        }
      );

      // null = verrou tenu par un tiers (passe suivante) ou plus stale.
      if (settled) {
        recovered.push(settled);
      }
    }

    return recovered;
  }
}
