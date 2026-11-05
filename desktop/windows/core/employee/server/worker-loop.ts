import { runClaimedJob, type JobWorkerDeps } from "../sdk/job-worker";

export interface WorkerLoopOptions {
  readonly workerId?: string;
  /** Pause entre deux tours sans job (defaut 250 ms). */
  readonly intervalMs?: number;
  /**
   * Silence worker au-dela duquel un job running est presume orphelin
   * (defaut du store). `null` = aucun sweep (ni demarrage, ni idle).
   */
  readonly staleAfterMs?: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Boucle worker : claim le plus ancien job queued (tous tenants) et
 * l'execute via runClaimedJob, en boucle jusqu'a `stop()`. L'arret est
 * gracieux : le job en cours se termine, aucun nouveau claim.
 */
export function startWorkerLoop(
  deps: JobWorkerDeps,
  options: WorkerLoopOptions = {}
): { stop(): Promise<void> } {
  const workerId = options.workerId ?? `worker_${process.pid}`;
  const intervalMs = options.intervalMs ?? 250;
  const sweepOptions =
    options.staleAfterMs === null
      ? null
      : options.staleAfterMs === undefined
        ? {}
        : { staleAfterMs: options.staleAfterMs };
  let stopped = false;

  async function sweep(): Promise<void> {
    if (!sweepOptions) {
      return;
    }
    try {
      await deps.jobs.recoverStaleJobs(sweepOptions);
    } catch {
      // Store indisponible : reessaie au prochain tour.
    }
  }

  const running: Promise<void> = (async () => {
    // Sweep au demarrage : les jobs laisses running par un crash
    // precedent sont re-files (ou soldes) avant tout nouveau claim.
    await sweep();

    while (!stopped) {
      try {
        // claimNext atomique : N workers peuvent tourner en parallele.
        const claimed = await deps.jobs.claimNext(workerId);
        if (claimed && !stopped) {
          await runClaimedJob(deps, claimed, workerId);
          continue;
        }
        if (claimed && stopped) {
          // Claime pendant l'arret : reste running sous notre verrou,
          // repris par le sweep du prochain demarrage (ou `recover`).
        } else if (!stopped) {
          // Tour idle : balaye aussi les orphelins laisses par un
          // pair crashe APRES notre demarrage (jamais revus sinon).
          await sweep();
        }
      } catch {
        // Store indisponible ou job corrompu : reessaie au prochain tour.
      }
      await sleep(intervalMs);
    }
  })();

  return {
    stop: async () => {
      stopped = true;
      await running;
    },
  };
}
