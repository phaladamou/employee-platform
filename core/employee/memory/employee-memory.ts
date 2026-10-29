import type { EmployeeMission } from "../missions/employee-mission";

export interface MissionRecord {
  readonly missionId: string;
  readonly employeeId: string;
  readonly prompt: string;
  readonly status: "completed" | "failed";
  readonly summary: string | null;
  readonly completedAt: string;
}

/**
 * Memoire professionnelle d'un Employee : l'historique de ses missions
 * terminees (reussies ou echouees). Stockage en memoire vive, volontairement
 * sans dependance de persistance (l'hote choisit le backend).
 */
export class EmployeeMemory {
  private readonly records: MissionRecord[] = [];

  /**
   * Enregistre une mission terminee. Seules les missions assignees et
   * terminees (completed/failed) sont acceptables.
   */
  record(mission: EmployeeMission): MissionRecord {
    if (mission.status !== "completed" && mission.status !== "failed") {
      throw new Error(
        `Mission ${mission.id} is not finished (status "${mission.status}")`
      );
    }
    if (mission.employeeId === null) {
      throw new Error(`Mission ${mission.id} is not assigned`);
    }
    if (mission.completedAt === null) {
      throw new Error(`Mission ${mission.id} has no completion date`);
    }

    const record: MissionRecord = {
      missionId: mission.id,
      employeeId: mission.employeeId,
      prompt: mission.prompt,
      status: mission.status,
      summary: mission.report?.summary ?? null,
      completedAt: mission.completedAt,
    };
    this.records.push(record);

    return record;
  }

  /**
   * Historique chronologique (copie defensive), optionally filtre par Employee.
   */
  history(employeeId?: string): MissionRecord[] {
    const filtered =
      employeeId === undefined
        ? this.records
        : this.records.filter((record) => record.employeeId === employeeId);

    return [...filtered].sort((a, b) =>
      a.completedAt.localeCompare(b.completedAt)
    );
  }
}
