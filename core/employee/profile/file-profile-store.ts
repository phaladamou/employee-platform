import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { isEmployeeIdentity } from "../identity/employee-id";
import {
  isEmployeeSpecialization,
  type EmployeeSpecialization,
} from "../profiles/profile-spec";
import type {
  EmployeeProfile,
  EmployeeStatus,
} from "./employee-profile";
import type { ProfileStore } from "./profile-store";

const STATUSES: readonly string[] = ["idle", "working", "suspended"];

function sanitizeId(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safe) {
    throw new Error("Employee id cannot be empty");
  }
  return safe;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseProfile(raw: unknown): EmployeeProfile | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { id, identity, name, role, skills, status, createdBy, specialization } =
    raw;

  if (
    typeof id !== "string" ||
    !id ||
    !isEmployeeIdentity(identity) ||
    identity.id !== id ||
    typeof name !== "string" ||
    !name ||
    typeof role !== "string" ||
    !role ||
    !Array.isArray(skills) ||
    !skills.every((skill): skill is string => typeof skill === "string") ||
    typeof status !== "string" ||
    !STATUSES.includes(status) ||
    (createdBy !== undefined &&
      createdBy !== null &&
      (typeof createdBy !== "string" || !createdBy.trim()))
  ) {
    return null;
  }

  let spec: EmployeeSpecialization | null = null;
  if (specialization !== null && specialization !== undefined) {
    if (!isEmployeeSpecialization(specialization)) {
      return null;
    }
    spec = { ...specialization };
  }

  return {
    id,
    identity: { ...identity },
    name,
    role,
    skills: [...skills],
    status: status as EmployeeStatus,
    createdBy:
      typeof createdBy === "string" && createdBy.trim()
        ? createdBy.trim()
        : null,
    specialization: spec,
  };
}

/** Profils persistants, un JSON par employe (upsert simple). */
export class FileProfileStore implements ProfileStore {
  private readonly directory: string;

  constructor(options: { directory: string }) {
    if (!options.directory.trim()) {
      throw new Error("Profile directory cannot be empty");
    }
    this.directory = options.directory;
  }

  private path(employeeId: string): string {
    return join(this.directory, `employee_${sanitizeId(employeeId)}.json`);
  }

  async save(profile: EmployeeProfile): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.path(profile.id), JSON.stringify(profile, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  async load(employeeId: string): Promise<EmployeeProfile | null> {
    let raw: string;
    try {
      raw = await readFile(this.path(employeeId), "utf8");
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
      await this.quarantine(employeeId);
      return null;
    }

    const profile = parseProfile(parsed);
    if (!profile) {
      await this.quarantine(employeeId);
    }
    return profile;
  }

  async list(): Promise<readonly EmployeeProfile[]> {
    let names: string[];
    try {
      names = await readdir(this.directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const profiles: EmployeeProfile[] = [];
    for (const name of names) {
      if (!name.startsWith("employee_") || !name.endsWith(".json")) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(
          await readFile(join(this.directory, name), "utf8")
        ) as unknown;
      } catch {
        continue;
      }
      const profile = parseProfile(parsed);
      if (profile) {
        profiles.push(profile);
      }
    }

    profiles.sort((a, b) => a.name.localeCompare(b.name));
    return profiles;
  }

  private async quarantine(employeeId: string): Promise<void> {
    const from = this.path(employeeId);
    await rename(from, `${from}.corrupt.${Date.now()}`).catch(() => undefined);
  }
}
