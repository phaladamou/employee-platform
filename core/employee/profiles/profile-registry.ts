import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  isEmployeeProfileSpec,
  type EmployeeProfileSpec,
} from "./profile-spec";

/**
 * Registre de specialisations versionnees : chargement, validation et
 * resolution. Le registre ne connait que la FORME des specs (garde) ;
 * l'autorisation reelle (outil connu ? permission suffisante ?) reste
 * du ressort du runtime, au moment de la resolution des outils.
 */
export interface ProfileRegistry {
  /** Spec exacte, ou la plus haute version si `version` est omise. */
  get(name: string, version?: string): EmployeeProfileSpec | null;
  list(): readonly EmployeeProfileSpec[];
}

function compareVersions(left: string, right: string): number {
  // Versions deja validees `x.y.z` : comparaison numerique par morceau.
  const l = left.split(".").map(Number);
  const r = right.split(".").map(Number);

  for (let i = 0; i < 3; i += 1) {
    if (l[i] !== r[i]) {
      return l[i] - r[i];
    }
  }

  return 0;
}

/**
 * Construit un registre depuis des specs brutes (JSON parse ou objets
 * en memoire). Toute spec invalide ou tout doublon `nom@version`
 * leve immediatement (fail fast, pas de registre a moitie charge).
 */
export function createProfileRegistry(
  specs: readonly unknown[]
): ProfileRegistry {
  const valid: EmployeeProfileSpec[] = [];
  const seen = new Set<string>();

  specs.forEach((spec, index) => {
    if (!isEmployeeProfileSpec(spec)) {
      throw new Error(`Invalid profile spec at index ${index}`);
    }
    const key = `${spec.name}@${spec.version}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate profile spec: ${key}`);
    }
    seen.add(key);
    valid.push({ ...spec });
  });

  return {
    get(name: string, version?: string): EmployeeProfileSpec | null {
      const candidates = valid.filter((spec) => spec.name === name);

      if (version !== undefined) {
        return candidates.find((spec) => spec.version === version) ?? null;
      }

      let latest: EmployeeProfileSpec | null = null;

      for (const candidate of candidates) {
        if (
          latest === null ||
          compareVersions(candidate.version, latest.version) > 0
        ) {
          latest = candidate;
        }
      }

      return latest;
    },
    list(): readonly EmployeeProfileSpec[] {
      return [...valid];
    },
  };
}

/**
 * Charge un registre depuis un dossier : chaque `*.json` est une spec.
 * Fichier illisible ou JSON invalide -> erreur nommant le fichier ;
 * autres fichiers ignores. Dossier absent -> registre vide.
 */
export async function loadProfileRegistry(
  directory: string
): Promise<ProfileRegistry> {
  let files: string[];

  try {
    files = (await readdir(directory))
      .filter((file) => file.endsWith(".json"))
      .sort();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return createProfileRegistry([]);
    }

    throw error;
  }

  const specs: unknown[] = [];

  for (const file of files) {
    const path = join(directory, file);
    let raw: string;

    try {
      raw = await readFile(path, "utf8");
    } catch (error) {
      throw new Error(
        `Cannot read profile ${file}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      specs.push(JSON.parse(raw));
    } catch {
      throw new Error(`Invalid JSON in profile ${file}`);
    }
  }

  try {
    return createProfileRegistry(specs);
  } catch (error) {
    throw new Error(
      `Invalid profile registry in ${directory}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
