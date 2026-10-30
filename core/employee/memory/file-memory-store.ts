import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  isMissionRecord,
  type MissionRecord,
} from "./employee-memory";
import type {
  EmployeeMemoryScope,
  EmployeeMemoryStore,
} from "./memory-store";
import { resolveWithinRoot } from "../tools/tool";

export const DEFAULT_MEMORY_DIR = ".data/memory";
const STORE_VERSION = 1;

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function isEnvelope(value: unknown): value is { records: unknown } {
  return (
    typeof value === "object" && value !== null && "records" in value
  );
}

/** Archives pre-cloisonnement : champ absent => null (lisible partout). */
function normalizeRecord(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const record = value as Record<string, unknown>;

  if (!("employerId" in record)) {
    return { ...record, employerId: null };
  }

  return value;
}

/**
 * Persistance JSON sur disque, scopee par (employe, employeur) :
 * `employee_<id>/employer_<id>.json`. Ecriture atomique (fichier
 * temporaire puis renommage), fichiers corrompus mis en quarantaine
 * (.bak) au lieu de bloquer le demarrage. Les anciens fichiers plats
 * `employee_<id>.json` restent lisibles (migration douce, jamais
 * effaces : ils peuvent couvrir plusieurs employeurs).
 */
export class FileMemoryStore implements EmployeeMemoryStore {
  constructor(private readonly options: { readonly directory: string }) {
    if (!options.directory) {
      throw new Error("FileMemoryStore requires a directory");
    }
  }

  private scopedPath(scope: EmployeeMemoryScope): string {
    return join(
      this.options.directory,
      `employee_${sanitize(scope.employeeId)}`,
      `employer_${sanitize(scope.employerId)}.json`
    );
  }

  private async readRecords(relativePath: string): Promise<{
    found: boolean;
    records: MissionRecord[];
    corrupt: boolean;
  }> {
    let safe: string;

    try {
      safe = await resolveWithinRoot(this.options.directory, relativePath);
    } catch {
      return { found: true, records: [], corrupt: true };
    }

    let raw: string;

    try {
      raw = await readFile(safe, "utf8");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "ENOENT"
      ) {
        return { found: false, records: [], corrupt: false };
      }

      throw error;
    }

    let data: unknown;

    try {
      data = JSON.parse(raw);
    } catch {
      return { found: true, records: [], corrupt: true };
    }

    if (!isEnvelope(data) || !Array.isArray(data.records)) {
      return { found: true, records: [], corrupt: true };
    }

    return {
      found: true,
      records: data.records.map(normalizeRecord).filter(isMissionRecord),
      corrupt: false,
    };
  }

  async load(scope: EmployeeMemoryScope): Promise<readonly MissionRecord[]> {
    const dir = `employee_${sanitize(scope.employeeId)}`;
    const scopedRelative = `${dir}/employer_${sanitize(scope.employerId)}.json`;
    const scoped = await this.readRecords(scopedRelative);

    if (scoped.corrupt) {
      await this.quarantine(join(this.options.directory, scopedRelative));
      return [];
    }
    if (scoped.found) {
      return scoped.records;
    }

    const legacyRelative = `employee_${sanitize(scope.employeeId)}.json`;
    const legacy = await this.readRecords(legacyRelative);

    if (legacy.corrupt) {
      await this.quarantine(join(this.options.directory, legacyRelative));
    }

    return legacy.records;
  }

  async save(
    scope: EmployeeMemoryScope,
    records: readonly MissionRecord[]
  ): Promise<void> {
    const target = this.scopedPath(scope);

    await mkdir(join(this.options.directory, `employee_${sanitize(scope.employeeId)}`), {
      recursive: true,
    });

    const payload =
      JSON.stringify(
        {
          version: STORE_VERSION,
          employeeId: scope.employeeId,
          employerId: scope.employerId,
          updatedAt: new Date().toISOString(),
          records: [...records],
        },
        null,
        2
      ) + "\n";
    const tmp = `${target}.${process.pid}.tmp`;

    await writeFile(tmp, payload, "utf8");
    await rename(tmp, target);
  }

  private async quarantine(path: string): Promise<void> {
    await rename(path, `${path}.corrupt.${Date.now()}.bak`).catch(
      () => undefined
    );
  }
}
