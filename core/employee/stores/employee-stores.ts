import { join } from "node:path";

import type { EmployerCredentialStore } from "../auth/employer-credential-store";
import { FileEmployerCredentialStore } from "../auth/file-employer-credential-store";
import type { EmploymentStore } from "../employments/employment-store";
import { FileEmploymentStore } from "../employments/file-employment-store";
import type { JobStore } from "../jobs/job-store";
import { FileJobStore } from "../jobs/file-job-store";
import { FileMemoryStore } from "../memory/file-memory-store";
import type { EmployeeMemoryStore } from "../memory/memory-store";
import { FileMissionStore } from "../missions/file-mission-store";
import type { MissionStore } from "../missions/mission-store";
import { FileProfileStore } from "../profile/file-profile-store";
import type { ProfileStore } from "../profile/profile-store";
import type { EmployeeWorkspaces } from "../workspaces/employee-workspaces";

/**
 * Faisceau de persistance du noyau. Chaque domaine a deja son
 * interface (*Store) et son backend fichier ; ce faisceau est le SEUL
 * point que le serveur, le worker et la CLI consomment. Un backend
 * cloud (Postgres...) implemente la meme interface : le swap se fait
 * en un point (voir postgres-stores.ts, stub TODO).
 */
export interface EmployeeStores {
  readonly profiles: ProfileStore;
  readonly employments: EmploymentStore;
  readonly missions: MissionStore;
  readonly jobs: JobStore;
  readonly credentials: EmployerCredentialStore;
  readonly memory: EmployeeMemoryStore;
}

/**
 * Backend fichier : un sous-dossier par domaine sous dataDir.
 * `workspaces` (optionnel) active l'archivage auto sur terminate.
 */
export function openFileStores(
  dataDir: string,
  options: { workspaces?: EmployeeWorkspaces } = {}
): EmployeeStores {
  return {
    profiles: new FileProfileStore({ directory: join(dataDir, "profiles") }),
    employments: new FileEmploymentStore({
      directory: join(dataDir, "employments"),
      workspaces: options.workspaces,
    }),
    missions: new FileMissionStore({ directory: join(dataDir, "missions") }),
    jobs: new FileJobStore({ directory: join(dataDir, "jobs") }),
    credentials: new FileEmployerCredentialStore({
      directory: join(dataDir, "credentials"),
    }),
    memory: new FileMemoryStore({ directory: join(dataDir, "memory") }),
  };
}
