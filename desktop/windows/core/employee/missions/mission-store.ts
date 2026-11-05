import type { EmployeeMission } from "./employee-mission";

/**
 * Persistance des missions. Upsert simple : un seul worker possede le
 * job associe (verrou de claim), donc pas de course sur la mission.
 */
export interface MissionStore {
  /** Cree ou remplace une mission. */
  save(mission: EmployeeMission): Promise<void>;
  /** Charge une mission (worker interne), null si inconnue. */
  load(missionId: string): Promise<EmployeeMission | null>;
  /**
   * Lecture scopee (client) : null si inconnue OU si la mission
   * appartient a un autre tenant (pas de fuite d'existence).
   */
  loadScoped(
    employerId: string,
    missionId: string
  ): Promise<EmployeeMission | null>;
}
