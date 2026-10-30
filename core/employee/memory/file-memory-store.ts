import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  isMissionRecord,
  type MissionRecord,
} from "./employee-memory";
import type { EmployeeMemoryStore } from "./memory-store";
import { resolveWithinRoot } from "../tools/tool";

export const DEFAULT_MEMORY_DIR = ".data/memory";
const STORE_VERSION = 1;

function fileName(employeeId: string): string {
  return `employee_${employeeId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
}

function isEnvelope(value: unknown): value is { records: unknown } {
  return (
    typeof value === "object" && value !== null && "records" in value
  );
}

/**
 * Persistance JSON sur disque : un fichier par employe
 * (`employee_<id>.json`). Ecriture atomique (fichier temporaire puis
 * renommage), fichiers corrompus mis en quarantaine (.bak) au lieu de
 * bloquer le demarrage.
 */
export class FileMemoryStore implements EmployeeMemoryStore {
  constructor(private readonly options: { readonly directory: string }) {
    if (!options.directory) {
      throw new Error("FileMemoryStore requires a directory");
    }
  }

  private path(employeeId: string): string {
    return join(this.options.directory, fileName(employeeId));
  }

  async load(employeeId: string): Promise<readonly MissionRecord[]> {
    let safe: string;

    try {
      safe = await resolveWithinRoot(
        this.options.directory,
        fileName(employeeId)
      );
    } catch {
      // Lien symbolique plante vers l'exterieur : quarantaine, pas de lecture.
      await this.quarantine(employeeId);
      return [];
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
        return [];
      }

      throw error;
    }

    let data: unknown;

    try {
      data = JSON.parse(raw);
    } catch {
      await this.quarantine(employeeId);
      return [];
    }

    if (!isEnvelope(data) || !Array.isArray(data.records)) {
      await this.quarantine(employeeId);
      return [];
    }

    return data.records.filter(isMissionRecord);
  }

  async save(
    employeeId: string,
    records: readonly MissionRecord[]
  ): Promise<void> {
    await mkdir(this.options.directory, { recursive: true });

    const payload =
      JSON.stringify(
        {
          version: STORE_VERSION,
          employeeId,
          updatedAt: new Date().toISOString(),
          records: [...records],
        },
        null,
        2
      ) + "\n";
    const target = this.path(employeeId);
    const tmp = `${target}.${process.pid}.tmp`;

    await writeFile(tmp, payload, "utf8");
    await rename(tmp, target);
  }

  private async quarantine(employeeId: string): Promise<void> {
    const target = this.path(employeeId);

    await rename(target, `${target}.corrupt.${Date.now()}.bak`).catch(
      () => undefined
    );
  }
}
