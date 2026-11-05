import type { JobStore } from "./job-store";

/**
 * Signal d'annulation lu par le runtime a chaque pas de la boucle :
 * tant que `isCancelled` est faux le run continue, des qu'il est vrai
 * le runtime s'interrompt proprement (mission failed "cancelled") et
 * le worker confirme via `markCancelled`.
 */
export interface JobRunSignal {
  isCancelled(): boolean | Promise<boolean>;
}

export function createStaticJobSignal(cancelled: boolean): JobRunSignal {
  return { isCancelled: () => cancelled };
}

/** Signal en memoire, bascule manuelle (tests, worker in-process). */
export class InMemoryJobSignal implements JobRunSignal {
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }
}

/**
 * Signal scrutant le store : observe `cancellation_requested` sur le
 * job. Le worker en processus dedie l'instancie une fois par run.
 */
export function createPollingJobSignal(
  store: JobStore,
  jobId: string
): JobRunSignal {
  return {
    isCancelled: async () => {
      const job = await store.load(jobId);
      return job?.status === "cancellation_requested";
    },
  };
}

/** Verifie si un worker doit s'interrompre avant de poursuivre. */
export async function isJobCancellationRequested(
  store: JobStore,
  jobId: string
): Promise<boolean> {
  const signal = createPollingJobSignal(store, jobId);
  return (await signal.isCancelled()) === true;
}
