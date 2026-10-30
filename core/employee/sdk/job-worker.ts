import { createPollingJobSignal } from "../jobs/job-signal";
import type { EmployeeJob } from "../jobs/employee-job";
import type { JobStore } from "../jobs/job-store";
import type { EmployeeMemory } from "../memory/employee-memory";
import type { EmployeeMemoryStore } from "../memory/memory-store";
import type { MissionStore } from "../missions/mission-store";
import { setEmployeeStatus } from "../profile/employee-profile";
import type { ProfileStore } from "../profile/profile-store";
import type { ProfileRegistry } from "../profiles/profile-registry";
import { EmployeeRuntime } from "../runtime/employee-runtime";
import type { EmployeeLLMProvider } from "../runtime/llm-provider";
import type { EmployeeTool, ToolContext } from "../tools/tool";

export interface JobWorkerDeps {
  readonly jobs: JobStore;
  readonly missions: MissionStore;
  readonly profiles: ProfileStore;
  readonly provider: EmployeeLLMProvider;
  readonly tools?: readonly EmployeeTool[];
  readonly toolContext?: ToolContext;
  readonly maxSteps?: number;
  readonly profilesRegistry?: ProfileRegistry;
  readonly memory?: EmployeeMemory;
  readonly memoryStore?: EmployeeMemoryStore;
  /**
   * Battement du bail pendant le run (defaut 15 s, 0 = desactive).
   * Best-effort : un battement rate n'echoue jamais la mission.
   */
  readonly heartbeatIntervalMs?: number;
}

export const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Execute un job DEJA claimé par workerId : run du runtime avec
 * signal d'annulation scrutant le store, puis cloture (succes / echec
 * / annulation confirmee). Le job doit etre running et verrouille par
 * workerId, sinon leve.
 */
export async function runClaimedJob(
  deps: JobWorkerDeps,
  job: EmployeeJob,
  workerId: string
): Promise<EmployeeJob> {
  if (job.status !== "running" && job.status !== "cancellation_requested") {
    throw new Error(
      `Job ${job.id} is not running (status "${job.status}")`
    );
  }
  if (job.lockOwner !== workerId) {
    throw new Error(`Job ${job.id} is locked by another worker`);
  }

  const claimed = job;
  const mission = await deps.missions.load(claimed.missionId);
  if (!mission) {
    return deps.jobs.markFailed(
      claimed.id,
      workerId,
      `Mission ${claimed.missionId} not found`
    );
  }

  const profile = await deps.profiles.load(claimed.employeeId);
  if (!profile) {
    return deps.jobs.markFailed(
      claimed.id,
      workerId,
      `Employee ${claimed.employeeId} not found`
    );
  }

  if (mission.status !== "pending") {
    return deps.jobs.markFailed(
      claimed.id,
      workerId,
      `Mission ${mission.id} is not pending (status "${mission.status}")`
    );
  }

  if (profile.status === "suspended") {
    return deps.jobs.markFailed(
      claimed.id,
      workerId,
      `Employee ${profile.id} is suspended`
    );
  }

  await deps.profiles.save(setEmployeeStatus(profile, "working"));

  const runtime = new EmployeeRuntime(deps.provider, {
    tools: deps.tools,
    toolContext: deps.toolContext,
    maxSteps: deps.maxSteps,
    profiles: deps.profilesRegistry,
    memory: deps.memory,
    memoryStore: deps.memoryStore,
    signal: createPollingJobSignal(deps.jobs, claimed.id),
  });

  const heartbeatMs = deps.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const heartbeatTimer =
    heartbeatMs > 0
      ? setInterval(() => {
          void deps.jobs.heartbeat(claimed.id, workerId).catch(() => undefined);
        }, heartbeatMs)
      : null;
  // Ne retient jamais le processus (tests, arret brutal).
  heartbeatTimer?.unref?.();

  try {
    const result = await runtime.run(profile, mission);
    await deps.missions.save(result.mission);
    await deps.profiles.save(result.profile);

    if (result.cancelled) {
      return deps.jobs.markCancelled(claimed.id, workerId);
    }
    if (result.needsReview && result.report) {
      return deps.jobs.markNeedsReview(
        claimed.id,
        workerId,
        result.report.content,
        result.reviewReason ?? "flagged for review"
      );
    }
    if (result.error || !result.report) {
      return deps.jobs.markFailed(
        claimed.id,
        workerId,
        result.error ?? "run produced no report"
      );
    }
    return deps.jobs.markSucceeded(claimed.id, workerId, result.report.content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Restauration best-effort : ne touche que le statut pose ici.
    const current = await deps.profiles.load(profile.id);
    if (current?.status === "working") {
      await deps.profiles.save(setEmployeeStatus(current, "idle"));
    }
    return deps.jobs.markFailed(claimed.id, workerId, message);
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
  }
}

/**
 * Execute un job de bout en bout : claim atomique puis runClaimedJob.
 * Retourne null si le job n'est pas claimable (pris, annule, inconnu).
 * Partage par le worker in-process, le serveur REST et la CLI.
 */
export async function runJobOnce(
  deps: JobWorkerDeps,
  jobId: string,
  workerId: string
): Promise<EmployeeJob | null> {
  const claimed = await deps.jobs.claim(jobId, workerId);
  if (!claimed) {
    return null;
  }
  return runClaimedJob(deps, claimed, workerId);
}
