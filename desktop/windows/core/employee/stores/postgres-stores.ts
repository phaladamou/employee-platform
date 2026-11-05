import type { EmployerCredential } from "../auth/employer-credential";
import type { EmployerCredentialStore } from "../auth/employer-credential-store";
import type { Employment } from "../employments/employment";
import type { EmploymentStore } from "../employments/employment-store";
import type { EmployeeJob, JobStatus } from "../jobs/employee-job";
import type { JobStore } from "../jobs/job-store";
import type { MissionRecord } from "../memory/employee-memory";
import type {
  EmployeeMemoryScope,
  EmployeeMemoryStore,
} from "../memory/memory-store";
import type { EmployeeMission } from "../missions/employee-mission";
import type { MissionStore } from "../missions/mission-store";
import type { EmployeeProfile } from "../profile/employee-profile";
import type { ProfileStore } from "../profile/profile-store";
import type { EmployeeStores } from "./employee-stores";

/**
 * Backend Postgres (STUB : structure vide, rien n'est implemente).
 *
 * TODO (jour cloud) :
 * 1. Ajouter un client (`pg`), schema SQL par domaine (tables
 *    jobs/missions/credentials/employments/profiles/memory, index sur
 *    employerId + status), migrations versionnees.
 * 2. Implementer chaque methode ci-dessous avec la MEME semantique que
 *    le backend fichier : claim atomique (`SELECT ... FOR UPDATE SKIP
 *    LOCKED`), lectures scopees par tenant (jamais de fuite 404),
 *    at-least-once + heartbeat + `recoverStaleJobs`.
 * 3. Brancher le choix du backend sur l'env (ex. EMPLOYEE_DATABASE_URL
 *    presente -> Postgres, sinon fichiers) dans UNE factory.
 * 4. Faire passer TOUTE la suite existante sur Postgres (les tests de
 *    stores doivent etre backend-agnostiques) + tests de concurrence
 *    reelle (N workers, claims simultanes).
 *
 * Chaque methode leve tant que ce n'est pas fait : impossible de
 * brancher Postgres par erreur et de croire que ca persiste.
 */
export interface PostgresStoresOptions {
  /** Chaine de connexion (gardee pour le futur client, inutilisee). */
  readonly connectionString: string;
}

function notImplemented(store: string, method: string): Error {
  return new Error(
    `not implemented: Postgres${store}.${method} ` +
      `(cloud stub — File${store} is the current backend)`
  );
}

class PostgresProfileStore implements ProfileStore {
  constructor(private readonly options: PostgresStoresOptions) {}
  async save(_profile: EmployeeProfile): Promise<void> {
    throw notImplemented("ProfileStore", "save");
  }
  async load(_employeeId: string): Promise<EmployeeProfile | null> {
    throw notImplemented("ProfileStore", "load");
  }
  async list(): Promise<readonly EmployeeProfile[]> {
    throw notImplemented("ProfileStore", "list");
  }
}

class PostgresEmploymentStore implements EmploymentStore {
  constructor(private readonly options: PostgresStoresOptions) {}
  async hire(_input: {
    employeeId: string;
    employerId: string;
    id?: string;
    now?: Date;
  }): Promise<Employment> {
    throw notImplemented("EmploymentStore", "hire");
  }
  async terminate(_id: string, _now?: Date): Promise<Employment> {
    throw notImplemented("EmploymentStore", "terminate");
  }
  async get(_id: string): Promise<Employment | null> {
    throw notImplemented("EmploymentStore", "get");
  }
  async findActive(
    _employeeId: string,
    _employerId: string
  ): Promise<Employment | null> {
    throw notImplemented("EmploymentStore", "findActive");
  }
  async listByEmployer(_employerId: string): Promise<readonly Employment[]> {
    throw notImplemented("EmploymentStore", "listByEmployer");
  }
}

class PostgresMissionStore implements MissionStore {
  constructor(private readonly options: PostgresStoresOptions) {}
  async save(_mission: EmployeeMission): Promise<void> {
    throw notImplemented("MissionStore", "save");
  }
  async load(_missionId: string): Promise<EmployeeMission | null> {
    throw notImplemented("MissionStore", "load");
  }
  async loadScoped(
    _employerId: string,
    _missionId: string
  ): Promise<EmployeeMission | null> {
    throw notImplemented("MissionStore", "loadScoped");
  }
}

class PostgresJobStore implements JobStore {
  constructor(private readonly options: PostgresStoresOptions) {}
  async enqueue(_job: EmployeeJob): Promise<void> {
    throw notImplemented("JobStore", "enqueue");
  }
  async claim(
    _jobId: string,
    _workerId: string,
    _now?: Date
  ): Promise<EmployeeJob | null> {
    throw notImplemented("JobStore", "claim");
  }
  async nextQueued(_employerId: string): Promise<EmployeeJob | null> {
    throw notImplemented("JobStore", "nextQueued");
  }
  async claimNext(_workerId: string, _now?: Date): Promise<EmployeeJob | null> {
    throw notImplemented("JobStore", "claimNext");
  }
  async load(_jobId: string): Promise<EmployeeJob | null> {
    throw notImplemented("JobStore", "load");
  }
  async loadScoped(
    _employerId: string,
    _jobId: string
  ): Promise<EmployeeJob | null> {
    throw notImplemented("JobStore", "loadScoped");
  }
  async listByEmployer(
    _employerId: string,
    _statuses?: readonly JobStatus[]
  ): Promise<readonly EmployeeJob[]> {
    throw notImplemented("JobStore", "listByEmployer");
  }
  async requestCancellation(
    _jobId: string,
    _now?: Date
  ): Promise<EmployeeJob | null> {
    throw notImplemented("JobStore", "requestCancellation");
  }
  async markCancelled(
    _jobId: string,
    _workerId: string,
    _now?: Date
  ): Promise<EmployeeJob> {
    throw notImplemented("JobStore", "markCancelled");
  }
  async markSucceeded(
    _jobId: string,
    _workerId: string,
    _report: string,
    _now?: Date
  ): Promise<EmployeeJob> {
    throw notImplemented("JobStore", "markSucceeded");
  }
  async markFailed(
    _jobId: string,
    _workerId: string,
    _error: string,
    _now?: Date
  ): Promise<EmployeeJob> {
    throw notImplemented("JobStore", "markFailed");
  }
  async markNeedsReview(
    _jobId: string,
    _workerId: string,
    _report: string,
    _reason: string,
    _now?: Date
  ): Promise<EmployeeJob> {
    throw notImplemented("JobStore", "markNeedsReview");
  }
  async heartbeat(
    _jobId: string,
    _workerId: string,
    _now?: Date
  ): Promise<EmployeeJob> {
    throw notImplemented("JobStore", "heartbeat");
  }
  async recoverStaleJobs(_options?: {
    staleAfterMs?: number;
    now?: Date;
  }): Promise<readonly EmployeeJob[]> {
    throw notImplemented("JobStore", "recoverStaleJobs");
  }
}

class PostgresEmployerCredentialStore implements EmployerCredentialStore {
  constructor(private readonly options: PostgresStoresOptions) {}
  async save(_credential: EmployerCredential): Promise<void> {
    throw notImplemented("EmployerCredentialStore", "save");
  }
  async findByHash(_tokenHash: string): Promise<EmployerCredential | null> {
    throw notImplemented("EmployerCredentialStore", "findByHash");
  }
  async revoke(_id: string, _now?: Date): Promise<void> {
    throw notImplemented("EmployerCredentialStore", "revoke");
  }
  async listByEmployer(
    _employerId: string
  ): Promise<readonly EmployerCredential[]> {
    throw notImplemented("EmployerCredentialStore", "listByEmployer");
  }
}

class PostgresMemoryStore implements EmployeeMemoryStore {
  constructor(private readonly options: PostgresStoresOptions) {}
  async load(_scope: EmployeeMemoryScope): Promise<readonly MissionRecord[]> {
    throw notImplemented("MemoryStore", "load");
  }
  async save(
    _scope: EmployeeMemoryScope,
    _records: readonly MissionRecord[]
  ): Promise<void> {
    throw notImplemented("MemoryStore", "save");
  }
}

/**
 * Ouvre le faisceau Postgres. Retourne des stubs qui levent : le jour
 * cloud, cette factory branchera le pool `pg` et les 6 classes
 * ci-dessus deviendront de vraies implementations (meme interface).
 */
export function openPostgresStores(options: PostgresStoresOptions): EmployeeStores {
  return {
    profiles: new PostgresProfileStore(options),
    employments: new PostgresEmploymentStore(options),
    missions: new PostgresMissionStore(options),
    jobs: new PostgresJobStore(options),
    credentials: new PostgresEmployerCredentialStore(options),
    memory: new PostgresMemoryStore(options),
  };
}
