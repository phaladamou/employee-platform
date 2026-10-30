import type { EmployeeMission } from "../missions/employee-mission";
import { LOCAL_EMPLOYER_ID } from "./memory-store";

export interface MissionRecord {
  readonly missionId: string;
  readonly employeeId: string;
  /** null = archive legacy (avant cloisonnement), lisible partout. */
  readonly employerId: string | null;
  readonly prompt: string;
  readonly status: "completed" | "failed";
  readonly summary: string | null;
  readonly completedAt: string;
}

export function isMissionRecord(value: unknown): value is MissionRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.missionId === "string" &&
    typeof record.employeeId === "string" &&
    (typeof record.employerId === "string" || record.employerId === null) &&
    typeof record.prompt === "string" &&
    (record.status === "completed" || record.status === "failed") &&
    (typeof record.summary === "string" || record.summary === null) &&
    typeof record.completedAt === "string"
  );
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
      employerId: mission.employerId ?? LOCAL_EMPLOYER_ID,
      prompt: mission.prompt,
      status: mission.status,
      summary: mission.report?.summary ?? null,
      completedAt: mission.completedAt,
    };
    this.records.push(record);

    return record;
  }

  /**
   * Remplace l'historique (rechargement depuis un backend de persistance).
   */
  restore(records: readonly MissionRecord[]): void {
    for (const record of records) {
      if (!isMissionRecord(record)) {
        throw new Error("invalid mission record");
      }
    }

    this.records.length = 0;
    this.records.push(...records.map((record) => ({ ...record })));
  }

  /**
   * Historique chronologique (copie defensive), filtrable par employe
   * et/ou employeur. Filtre employeur : les archives legacy (null)
   * passent partout, sinon egalite stricte (anti-fuite inter-tenant).
   */
  history(employeeId?: string, employerId?: string): MissionRecord[] {
    let filtered = this.records;

    if (employeeId !== undefined) {
      filtered = filtered.filter((record) => record.employeeId === employeeId);
    }
    if (employerId !== undefined) {
      filtered = filtered.filter(
        (record) =>
          record.employerId === null || record.employerId === employerId
      );
    }

    return [...filtered].sort((a, b) =>
      a.completedAt.localeCompare(b.completedAt)
    );
  }
}
