import type { EmployeeJob, JobStatus } from "./employee-job";

/**
 * Persistance des jobs. Contrat :
 * - `claim` est atomique : face a N workers concurrents, un seul
 *   obtient le job, les autres recoivent null ;
 * - toute lecture cote client est scopee par employerId (isolation
 *   stricte des tenants) ;
 * - livraison at-least-once : un worker qui meurt en running laisse
 *   le job verrouille (pas de TTL ni de heartbeat a ce stade, le
 *   re-claim manuel reste possible via une passe de maintenance).
 */
export interface JobStore {
  /** File un job queued. Leve si l'id existe deja. */
  enqueue(job: EmployeeJob): Promise<void>;

  /**
   * Claim atomique : queued -> running sous verrou workerId.
   * Retourne le job verrouille, ou null (deja pris, annule, inconnu).
   */
  claim(
    jobId: string,
    workerId: string,
    now?: Date
  ): Promise<EmployeeJob | null>;

  /** Prochain job queued du tenant (ordre de creation), sans le locker. */
  nextQueued(employerId: string): Promise<EmployeeJob | null>;

  /**
   * Claim du plus ancien job queued TOUS tenants (infra worker
   * uniquement, jamais expose tel quel aux clients). Balaye par ordre
   * de creation et claim le premier disponible (saute les jobs pris
   * entre-temps par un worker concurrent). Null si la file est vide.
   */
  claimNext(workerId: string, now?: Date): Promise<EmployeeJob | null>;

  /** Lecture brute (worker interne). */
  load(jobId: string): Promise<EmployeeJob | null>;

  /**
   * Lecture scopee (client) : null si inconnu OU si le job appartient
   * a un autre tenant (indistinguable, pas de fuite d'existence).
   */
  loadScoped(employerId: string, jobId: string): Promise<EmployeeJob | null>;

  /** Jobs du tenant, optionnellement filtres par statuts. */
  listByEmployer(
    employerId: string,
    statuses?: readonly JobStatus[]
  ): Promise<readonly EmployeeJob[]>;

  /** Demande d'annulation (semantique requestEmployeeJobCancellation). */
  requestCancellation(jobId: string, now?: Date): Promise<EmployeeJob | null>;

  /** Confirmation worker (cancelEmployeeJob). */
  markCancelled(
    jobId: string,
    workerId: string,
    now?: Date
  ): Promise<EmployeeJob>;

  /** Succes worker (succeedEmployeeJob). */
  markSucceeded(
    jobId: string,
    workerId: string,
    report: string,
    now?: Date
  ): Promise<EmployeeJob>;

  /** Echec worker (failEmployeeJob). */
  markFailed(
    jobId: string,
    workerId: string,
    error: string,
    now?: Date
  ): Promise<EmployeeJob>;
}
