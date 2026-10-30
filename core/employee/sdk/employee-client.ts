import type { Employment } from "../employments/employment";
import type { EmployeeJob, JobStatus } from "../jobs/employee-job";
import type { EmployeeMission } from "../missions/employee-mission";
import type { JobEvent } from "./rest-contract";

/**
 * SDK cote employeur. Lie a UN tenant (employerId au constructeur en
 * in-process, derive du token en HTTP) : aucune methode ne prend
 * l'employeur en parametre, l'isolation est structurelle.
 */
export interface EmployeeClient {
  /** Recrute un employe publie (idempotent). */
  hire(employeeId: string): Promise<Employment>;

  /** Engagements actifs et passes du tenant. */
  listHires(): Promise<readonly Employment[]>;

  /**
   * Soumet une mission a un employe recrute (engagement actif requis)
   * et retourne le job queued correspondant. `acceptance` (optionnel)
   * declare les effets machine-verifiables : le Final qui ne les
   * satisfait pas termine failed, pas succeeded.
   */
  submit(
    employeeId: string,
    prompt: string,
    options?: { acceptance?: unknown }
  ): Promise<EmployeeJob>;

  /** Statut d'un job du tenant, null si inconnu ou etranger. */
  status(jobId: string): Promise<EmployeeJob | null>;

  /** Jobs du tenant, optionnellement filtres par statuts. */
  listJobs(statuses?: readonly JobStatus[]): Promise<readonly EmployeeJob[]>;

  /**
   * Demande d'annulation : queued -> cancelled immediat, running ->
   * cancellation_requested. Null si inconnu ou etranger.
   */
  cancel(jobId: string): Promise<EmployeeJob | null>;

  /** Rapport de mission terminee, null si inconnue ou etrangere. */
  mission(missionId: string): Promise<EmployeeMission | null>;

  /**
   * Flux des snapshots du job jusqu'a son etat terminal. Leve si le
   * job est inconnu ou etranger au tenant.
   */
  events(jobId: string): AsyncIterable<JobEvent>;
}
