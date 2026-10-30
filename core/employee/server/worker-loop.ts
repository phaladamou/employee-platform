import { runClaimedJob, type JobWorkerDeps } from "../sdk/job-worker";

export interface WorkerLoopOptions {
  readonly workerId?: string;
  /** Pause entre deux tours sans job (defaut 250 ms). */
  readonly intervalMs?: number;
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
  let stopped = false;

  const running: Promise<void> = (async () => {
    while (!stopped) {
      try {
        // claimNext atomique : N workers peuvent tourner en parallele.
        const claimed = await deps.jobs.claimNext(workerId);
        if (claimed && !stopped) {
          await runClaimedJob(deps, claimed, workerId);
          continue;
        }
        if (claimed && stopped) {
          // Claimé pendant l'arret : le job reste running sous notre
          // verrou (at-least-once, reprise manuelle documentee).
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
