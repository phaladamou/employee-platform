import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { EmploymentStore } from "./employment-store";
import {
  createEmployment,
  isEmployment,
  type Employment,
} from "./employment";

const STORE_FILE = "employments.json";
const STORE_VERSION = 1;

/**
 * Persistance JSON locale des engagements (un seul fichier, echelle
 * CLI). Ecriture atomique, fichier corrompu mis en quarantaine
 * (aucun engagement actif : echec ferme). Pas de donnees secretes
 * ici (ni token ni hash), donc pas de chmod 600.
 */
export class FileEmploymentStore implements EmploymentStore {
  constructor(private readonly options: { readonly directory: string }) {
    if (!options.directory) {
      throw new Error("FileEmploymentStore requires a directory");
    }
  }

  private get path(): string {
    return join(this.options.directory, STORE_FILE);
  }

  private async loadAll(): Promise<Employment[]> {
    let raw: string;

    try {
      raw = await readFile(this.path, "utf8");
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
      await this.quarantine();
      return [];
    }

    if (
      typeof data !== "object" ||
      data === null ||
      !("employments" in data) ||
      !Array.isArray((data as { employments?: unknown }).employments)
    ) {
      await this.quarantine();
      return [];
    }

    return (data as { employments: unknown[] }).employments.filter(
      isEmployment
    );
  }

  private async saveAll(employments: readonly Employment[]): Promise<void> {
    await mkdir(this.options.directory, { recursive: true });

    const payload =
      JSON.stringify(
        {
          version: STORE_VERSION,
          updatedAt: new Date().toISOString(),
          employments: [...employments],
        },
        null,
        2
      ) + "\n";
    const tmp = `${this.path}.${process.pid}.tmp`;

    await writeFile(tmp, payload, "utf8");
    await rename(tmp, this.path);
  }

  private async quarantine(): Promise<void> {
    await rename(
      this.path,
      `${this.path}.corrupt.${Date.now()}.bak`
    ).catch(() => undefined);
  }

  async hire(input: {
    employeeId: string;
    employerId: string;
    id?: string;
    now?: Date;
  }): Promise<Employment> {
    const employments = await this.loadAll();
    const active = employments.find(
      (e) =>
        e.employeeId === input.employeeId.trim() &&
        e.employerId === input.employerId.trim() &&
        e.terminatedAt === null
    );

    if (active) {
      return active;
    }

    const created = createEmployment(input);
    employments.push(created);
    await this.saveAll(employments);

    return created;
  }

  async terminate(id: string, now: Date = new Date()): Promise<Employment> {
    const employments = await this.loadAll();
    const index = employments.findIndex((e) => e.id === id);

    if (index === -1) {
      throw new Error(`Unknown employment: ${id}`);
    }
    if (employments[index].terminatedAt !== null) {
      return employments[index];
    }

    const terminated = { ...employments[index], terminatedAt: now.toISOString() };
    employments[index] = terminated;
    await this.saveAll(employments);

    return terminated;
  }

  async get(id: string): Promise<Employment | null> {
    return (await this.loadAll()).find((e) => e.id === id) ?? null;
  }

  async findActive(
    employeeId: string,
    employerId: string
  ): Promise<Employment | null> {
    return (
      (await this.loadAll()).find(
        (e) =>
          e.employeeId === employeeId &&
          e.employerId === employerId &&
          e.terminatedAt === null
      ) ?? null
    );
  }

  async listByEmployer(employerId: string): Promise<readonly Employment[]> {
    return (await this.loadAll()).filter((e) => e.employerId === employerId);
  }
}
