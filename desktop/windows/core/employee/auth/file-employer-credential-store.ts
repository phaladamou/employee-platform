import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { EmployerCredentialStore } from "./employer-credential-store";
import {
  isEmployerCredential,
  type EmployerCredential,
} from "./employer-credential";

const STORE_FILE = "employer-credentials.json";
const STORE_VERSION = 1;

/**
 * Persistance JSON locale des cles employeurs (un seul fichier).
 * Ecriture atomique, chmod 600 (hashes sensibles), fichier corrompu
 * mis en quarantaine (echec ferme : rien ne verifie plus).
 */
export class FileEmployerCredentialStore implements EmployerCredentialStore {
  constructor(private readonly options: { readonly directory: string }) {
    if (!options.directory) {
      throw new Error("FileEmployerCredentialStore requires a directory");
    }
  }

  private get path(): string {
    return join(this.options.directory, STORE_FILE);
  }

  private async loadAll(): Promise<EmployerCredential[]> {
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
      !("credentials" in data) ||
      !Array.isArray((data as { credentials?: unknown }).credentials)
    ) {
      await this.quarantine();
      return [];
    }

    return (data as { credentials: unknown[] }).credentials.filter(
      isEmployerCredential
    );
  }

  private async saveAll(
    credentials: readonly EmployerCredential[]
  ): Promise<void> {
    await mkdir(this.options.directory, { recursive: true });

    const payload =
      JSON.stringify(
        {
          version: STORE_VERSION,
          updatedAt: new Date().toISOString(),
          credentials: [...credentials],
        },
        null,
        2
      ) + "\n";
    const tmp = `${this.path}.${process.pid}.tmp`;

    await writeFile(tmp, payload, { encoding: "utf8", mode: 0o600 });
    await rename(tmp, this.path);
    await chmod(this.path, 0o600);
  }

  private async quarantine(): Promise<void> {
    await rename(
      this.path,
      `${this.path}.corrupt.${Date.now()}.bak`
    ).catch(() => undefined);
  }

  async save(credential: EmployerCredential): Promise<void> {
    if (!isEmployerCredential(credential)) {
      throw new Error("invalid credential");
    }

    const credentials = await this.loadAll();
    const index = credentials.findIndex((c) => c.id === credential.id);

    if (index === -1) {
      credentials.push({ ...credential });
    } else {
      credentials[index] = { ...credential };
    }

    await this.saveAll(credentials);
  }

  async findByHash(tokenHash: string): Promise<EmployerCredential | null> {
    return (
      (await this.loadAll()).find((c) => c.tokenHash === tokenHash) ?? null
    );
  }

  async revoke(id: string, now: Date = new Date()): Promise<void> {
    const credentials = await this.loadAll();
    const index = credentials.findIndex((c) => c.id === id);

    if (index === -1) {
      throw new Error(`Unknown credential: ${id}`);
    }

    credentials[index] = { ...credentials[index], revokedAt: now.toISOString() };
    await this.saveAll(credentials);
  }

  async listByEmployer(
    employerId: string
  ): Promise<readonly EmployerCredential[]> {
    return (await this.loadAll()).filter((c) => c.employerId === employerId);
  }
}
