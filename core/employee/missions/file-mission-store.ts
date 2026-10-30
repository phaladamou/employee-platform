import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  EmployeeMission,
  EmployeeMissionStatus,
  MissionReport,
} from "./employee-mission";
import {
  validateAcceptance,
  type MissionAcceptance,
} from "./mission-acceptance";
import type { MissionStore } from "./mission-store";

const STATUSES: readonly string[] = [
  "pending",
  "running",
  "completed",
  "failed",
  "needs_review",
];

function sanitizeId(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safe) {
    throw new Error("Mission id cannot be empty");
  }
  return safe;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNullableString(value: unknown): string | null {
  return value === null || value === undefined
    ? null
    : typeof value === "string"
      ? value
      : null;
}

function parseReport(raw: unknown): MissionReport | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (!isRecord(raw)) {
    return null;
  }
  if (
    typeof raw.summary !== "string" ||
    typeof raw.content !== "string" ||
    typeof raw.completedAt !== "string"
  ) {
    return null;
  }
  return {
    summary: raw.summary,
    content: raw.content,
    completedAt: raw.completedAt,
  };
}

function parseMission(raw: unknown): EmployeeMission | null {
  if (!isRecord(raw)) {
    return null;
  }

  const { id, employeeId, employerId, prompt, status, error } = raw;
  if (
    typeof id !== "string" ||
    !id ||
    typeof prompt !== "string" ||
    !prompt ||
    typeof status !== "string" ||
    !STATUSES.includes(status)
  ) {
    return null;
  }

  const employee = asNullableString(employeeId);
  const employer = asNullableString(employerId);
  if (
    (employeeId !== null && employeeId !== undefined && employee === null) ||
    (employerId !== null && employerId !== undefined && employer === null)
  ) {
    return null;
  }

  const report = parseReport(raw.report);
  if (raw.report !== null && raw.report !== undefined && !report) {
    return null;
  }

  if (typeof raw.createdAt !== "string") {
    return null;
  }

  const startedAt = asNullableString(raw.startedAt);
  const completedAt = asNullableString(raw.completedAt);
  if (
    (raw.startedAt !== null &&
      raw.startedAt !== undefined &&
      startedAt === null) ||
    (raw.completedAt !== null &&
      raw.completedAt !== undefined &&
      completedAt === null)
  ) {
    return null;
  }

  // Archives pre-verification : criteres absents => aucun (confiance).
  // Criteres presents mais malformes => quarantaine (fail closed).
  let acceptance: MissionAcceptance;
  try {
    acceptance = validateAcceptance(raw.acceptance ?? undefined);
  } catch {
    return null;
  }

  return {
    id,
    employeeId: employee,
    employerId: employer,
    prompt,
    status: status as EmployeeMissionStatus,
    acceptance,
    report,
    error: asNullableString(error),
    createdAt: raw.createdAt,
    startedAt,
    completedAt,
  };
}

/** Missions persistantes, un JSON par mission (upsert simple). */
export class FileMissionStore implements MissionStore {
  private readonly directory: string;

  constructor(options: { directory: string }) {
    if (!options.directory.trim()) {
      throw new Error("Mission directory cannot be empty");
    }
    this.directory = options.directory;
  }

  private path(missionId: string): string {
    return join(this.directory, `mission_${sanitizeId(missionId)}.json`);
  }

  async save(mission: EmployeeMission): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.path(mission.id), JSON.stringify(mission, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  async load(missionId: string): Promise<EmployeeMission | null> {
    let raw: string;
    try {
      raw = await readFile(this.path(missionId), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      await this.quarantine(missionId);
      return null;
    }

    const mission = parseMission(parsed);
    if (!mission) {
      await this.quarantine(missionId);
    }
    return mission;
  }

  async loadScoped(
    employerId: string,
    missionId: string
  ): Promise<EmployeeMission | null> {
    const mission = await this.load(missionId);
    if (!mission || mission.employerId !== employerId) {
      return null;
    }
    return mission;
  }

  private async quarantine(missionId: string): Promise<void> {
    const from = this.path(missionId);
    await rename(from, `${from}.corrupt.${Date.now()}`).catch(() => undefined);
  }
}
