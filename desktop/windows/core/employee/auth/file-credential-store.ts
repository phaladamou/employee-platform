import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { EmployeeCredentialStore } from "./credential-store";
import {
  isEmployeeCredential,
  type EmployeeCredential,
} from "./employee-credential";

const STORE_FILE = "credentials.json";
const STORE_VERSION = 1;

/**
 * Persistance JSON locale des cles d'acces (un seul fichier, echelle
 * CLI). Ecriture atomique (fichier temporaire puis renommage), fichier
 * corrompu mis en quarantaine (echec ferme : rien ne verifie plus).
 * Ne voit jamais de token en clair (hash uniquement, cf. le port).
 */
export class FileCredentialStore implements EmployeeCredentialStore {
  constructor(private readonly options: { readonly directory: string }) {
    if (!options.directory) {
      throw new Error("FileCredentialStore requires a directory");
    }
  }

  private get path(): string {
    return join(this.options.directory, STORE_FILE);
  }

  private async loadAll(): Promise<EmployeeCredential[]> {
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
      !Array.isArray(
        (data as { credentials?: unknown }).credentials
      )
    ) {
      await this.quarantine();
      return [];
    }

    return (data as { credentials: unknown[] }).credentials.filter(
      isEmployeeCredential
    );
  }

  private async saveAll(credentials: readonly EmployeeCredential[]): Promise<void> {
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

    // Fichier restreint des la creation (les hashes restent sensibles),
    // renforce apres renommage (umask etrange, fichier pre-existant...).
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

  async save(credential: EmployeeCredential): Promise<void> {
    if (!isEmployeeCredential(credential)) {
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

  async findByHash(tokenHash: string): Promise<EmployeeCredential | null> {
    return (await this.loadAll()).find((c) => c.tokenHash === tokenHash) ?? null;
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

  async list(employeeId: string): Promise<readonly EmployeeCredential[]> {
    return (await this.loadAll()).filter((c) => c.employeeId === employeeId);
  }
}
