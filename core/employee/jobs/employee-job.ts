import { randomUUID } from "node:crypto";

/**
 * Statut d'un job (unite async servie par un worker) :
 * - queued : en attente de claim par un worker ;
 * - running : claimé, verrouille par lockOwner ;
 * - cancellation_requested : l'employeur a demande l'annulation, le
 *   worker doit s'interrompre au prochain point de controle puis
 *   appeler markCancelled (annulation cooperative, jamais brutale) ;
 * - cancelled : annulation effective (soit directe depuis queued,
 *   soit confirmee par le worker) ;
 * - succeeded / failed : etats terminaux du run.
 */
export type JobStatus =
  | "queued"
  | "running"
  | "cancellation_requested"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "needs_review";

export interface EmployeeJob {
  readonly id: string;
  readonly missionId: string;
  readonly employeeId: string;
  readonly employerId: string;
  readonly status: JobStatus;
  /** Worker detenteur du verrou (claim), null hors running. */
  readonly lockOwner: string | null;
  /**
   * Dernier battement du worker proprietaire (bail). Un job running
   * sans battement recent est presume orphelin (crash) et eligible
   * au recovery. Null = jamais battu (seuil sur startedAt).
   */
  readonly lastHeartbeatAt: string | null;
  readonly report: string | null;
  readonly error: string | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return (
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "needs_review"
  );
}

/**
 * Cree un job en file d'attente. employerId est obligatoire : un job
 * appartient toujours a un tenant, jamais d'orphelin multi-tenant.
 */
export function createEmployeeJob(input: {
  id?: string;
  missionId: string;
  employeeId: string;
  employerId: string;
  now?: Date;
}): EmployeeJob {
  const missionId = input.missionId.trim();
  const employeeId = input.employeeId.trim();
  const employerId = input.employerId.trim();

  if (!missionId) {
    throw new Error("Job mission id cannot be empty");
  }
  if (!employeeId) {
    throw new Error("Job employee id cannot be empty");
  }
  if (!employerId) {
    throw new Error("Job employer id cannot be empty");
  }

  return {
    id: input.id ?? `job_${randomUUID()}`,
    missionId,
    employeeId,
    employerId,
    status: "queued",
    lockOwner: null,
    lastHeartbeatAt: null,
    report: null,
    error: null,
    createdAt: (input.now ?? new Date()).toISOString(),
    startedAt: null,
    finishedAt: null,
  };
}

/**
 * Transition de claim (worker) : queued -> running, verrouille par
 * workerId. Toute autre transition leve (le store garantit
 * l'atomicite face aux workers concurrents).
 */
export function claimEmployeeJob(
  job: EmployeeJob,
  workerId: string,
  now: Date = new Date()
): EmployeeJob {
  const owner = workerId.trim();

  if (!owner) {
    throw new Error("Worker id cannot be empty");
  }
  if (job.status !== "queued") {
    throw new Error(
      `Job ${job.id} cannot be claimed (status "${job.status}")`
    );
  }

  const at = now.toISOString();

  return {
    ...job,
    status: "running",
    lockOwner: owner,
    startedAt: at,
    lastHeartbeatAt: at,
  };
}

/**
 * Demande d'annulation (employeur) :
 * - queued -> cancelled immediat (aucun worker ne tourne) ;
 * - running / cancellation_requested -> cancellation_requested
 *   (le worker confirme via markCancelled) ;
 * - terminal -> inchange (idempotent).
 */
export function requestEmployeeJobCancellation(
  job: EmployeeJob,
  now: Date = new Date()
): EmployeeJob {
  if (job.status === "queued") {
    return {
      ...job,
      status: "cancelled",
      finishedAt: now.toISOString(),
    };
  }

  if (job.status === "running" || job.status === "cancellation_requested") {
    return { ...job, status: "cancellation_requested" };
  }

  return job;
}

/**
 * Confirmation d'annulation (worker) : le worker a observe
 * cancellation_requested et s'est interrompu proprement.
 */
export function cancelEmployeeJob(
  job: EmployeeJob,
  workerId: string,
  now: Date = new Date()
): EmployeeJob {
  if (job.status !== "running" && job.status !== "cancellation_requested") {
    throw new Error(
      `Job ${job.id} cannot be cancelled (status "${job.status}")`
    );
  }
  if (job.lockOwner !== workerId) {
    throw new Error(`Job ${job.id} is locked by another worker`);
  }

  return {
    ...job,
    status: "cancelled",
    lockOwner: null,
    finishedAt: now.toISOString(),
  };
}

function finishJob(
  job: EmployeeJob,
  workerId: string,
  patch: Pick<EmployeeJob, "status" | "report" | "error">,
  now: Date
): EmployeeJob {
  if (job.status !== "running" && job.status !== "cancellation_requested") {
    throw new Error(
      `Job ${job.id} cannot finish (status "${job.status}")`
    );
  }
  if (job.lockOwner !== workerId) {
    throw new Error(`Job ${job.id} is locked by another worker`);
  }

  return {
    ...job,
    ...patch,
    lockOwner: null,
    finishedAt: now.toISOString(),
  };
}

export function succeedEmployeeJob(
  job: EmployeeJob,
  workerId: string,
  report: string,
  now: Date = new Date()
): EmployeeJob {
  if (!report.trim()) {
    throw new Error("Job report cannot be empty");
  }
  return finishJob(
    job,
    workerId,
    { status: "succeeded", report, error: null },
    now
  );
}

/**
 * Suspend le jugement : le Final est suspect (voir runtime), le rapport
 * est preserve dans `report` et le motif dans `error` pour le relecteur.
 * Etat terminal : la revue se fait hors systeme (pas de transition out).
 */
export function flagJobForReview(
  job: EmployeeJob,
  workerId: string,
  report: string,
  reason: string,
  now: Date = new Date()
): EmployeeJob {
  if (!report.trim()) {
    throw new Error("Job report cannot be empty");
  }
  if (!reason.trim()) {
    throw new Error("Review reason cannot be empty");
  }
  return finishJob(
    job,
    workerId,
    { status: "needs_review", report, error: reason },
    now
  );
}

export function failEmployeeJob(
  job: EmployeeJob,
  workerId: string,
  error: string,
  now: Date = new Date()
): EmployeeJob {
  if (!error.trim()) {
    throw new Error("Job error cannot be empty");
  }
  return finishJob(
    job,
    workerId,
    { status: "failed", report: null, error },
    now
  );
}

/**
 * Battement du worker proprietaire : renouvelle le bail. Seul le
 * detenteur du verrou peut battre (sinon leve) ; les jobs hors
 * running/cancellation_requested levent aussi.
 */
export function heartbeatEmployeeJob(
  job: EmployeeJob,
  workerId: string,
  now: Date = new Date()
): EmployeeJob {
  if (job.status !== "running" && job.status !== "cancellation_requested") {
    throw new Error(
      `Job ${job.id} cannot heartbeat (status "${job.status}")`
    );
  }
  if (job.lockOwner !== workerId) {
    throw new Error(`Job ${job.id} is locked by another worker`);
  }

  return { ...job, lastHeartbeatAt: now.toISOString() };
}

/**
 * Orphelin presume (crash worker) ? Vrai si le job est en cours et que
 * son dernier signe de vie (battement, sinon debut, sinon creation)
 * depasse staleAfterMs. Les jobs termines ou queued ne sont jamais
 * stales.
 */
export function isJobStale(
  job: EmployeeJob,
  staleAfterMs: number,
  now: Date = new Date()
): boolean {
  if (job.status !== "running" && job.status !== "cancellation_requested") {
    return false;
  }

  const reference =
    job.lastHeartbeatAt ?? job.startedAt ?? job.createdAt;
  const at = Date.parse(reference);

  if (Number.isNaN(at)) {
    return true;
  }
  return now.getTime() - at > staleAfterMs;
}

/**
 * Recovery d'un running orphelin : re-file pour une nouvelle tentative
 * (bail et verrou remis a zero). At-least-once : si l'ancien worker
 * vit encore (bail expire a tort), le job peut tourner deux fois.
 */
export function requeueStaleJob(job: EmployeeJob): EmployeeJob {
  if (job.status !== "running") {
    throw new Error(
      `Job ${job.id} cannot be requeued (status "${job.status}")`
    );
  }

  return {
    ...job,
    status: "queued",
    lockOwner: null,
    lastHeartbeatAt: null,
    startedAt: null,
    finishedAt: null,
    error: `recovered after worker silence (previously started ${job.startedAt ?? "unknown"})`,
    report: null,
  };
}

/**
 * Recovery d'une annulation orpheline : le worker est mort alors que
 * l'employeur avait demande l'annulation — rien ne tourne, on honore
 * la demande au lieu de re-filer le job.
 */
export function settleStaleCancellation(
  job: EmployeeJob,
  now: Date = new Date()
): EmployeeJob {
  if (job.status !== "cancellation_requested") {
    throw new Error(
      `Job ${job.id} has no pending cancellation (status "${job.status}")`
    );
  }

  return {
    ...job,
    status: "cancelled",
    lockOwner: null,
    finishedAt: now.toISOString(),
  };
}
