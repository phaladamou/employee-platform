import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { hashProfileContent } from "./profile-integrity";
import {
  isEmployeeProfileSpec,
  type EmployeeProfileSpec,
} from "./profile-spec";

export const PROFILE_LOCKFILE_NAME = "profiles.lock.json";
const PROFILE_LOCKFILE_VERSION = 1;

/**
 * Hashes SHA-256 publies par le Createur (`nom@version` -> empreinte
 * du contenu canonique). Le chargeur refuse tout profil absent du
 * lockfile ou au contenu different.
 */
export interface ProfileLockfile {
  readonly version: number;
  readonly profiles: Readonly<Record<string, string>>;
}

export interface ProfileRegistryTrust {
  /** Chemin du lockfile (defaut : a cote des profils). */
  readonly lockfilePath?: string;
  /**
   * Verifie les hashes (defaut true). `false` = confiance explicite de
   * l'hote, DEV UNIQUEMENT (aucune preuve d'integrite).
   */
  readonly verify?: boolean;
}

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

function isLockfile(value: unknown): value is ProfileLockfile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const lock = value as Record<string, unknown>;

  return (
    lock.version === PROFILE_LOCKFILE_VERSION &&
    typeof lock.profiles === "object" &&
    lock.profiles !== null &&
    Object.values(lock.profiles as Record<string, unknown>).every(
      (hash) => typeof hash === "string"
    )
  );
}

async function readLockfile(lockfilePath: string): Promise<ProfileLockfile> {
  let raw: string;

  try {
    raw = await readFile(lockfilePath, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      throw new Error(`Missing profile lockfile: ${lockfilePath}`);
    }

    throw error;
  }

  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid profile lockfile: ${lockfilePath}`);
  }

  if (!isLockfile(data)) {
    throw new Error(`Invalid profile lockfile: ${lockfilePath}`);
  }

  return data;
}

/**
 * Charge un registre depuis un dossier : chaque `*.json` est une spec
 * (le lockfile lui-meme est ignore). Fichier illisible ou JSON invalide
 * -> erreur nommant le fichier ; autres fichiers ignores. Dossier
 * absent -> registre vide. Sauf `trust.verify: false` explicite, chaque
 * spec est verifiee contre le lockfile (absent, non epingle ou contenu
 * different -> erreur franche).
 */
export async function loadProfileRegistry(
  directory: string,
  options?: { trust?: ProfileRegistryTrust }
): Promise<ProfileRegistry> {
  let files: string[];

  try {
    files = (await readdir(directory))
      .filter(
        (file) => file.endsWith(".json") && file !== PROFILE_LOCKFILE_NAME
      )
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

  const verify = options?.trust?.verify ?? true;
  const lockfilePath =
    options?.trust?.lockfilePath ?? join(directory, PROFILE_LOCKFILE_NAME);
  const lockfile = verify ? await readLockfile(lockfilePath) : null;

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

  let registry: ProfileRegistry;

  try {
    registry = createProfileRegistry(specs);
  } catch (error) {
    throw new Error(
      `Invalid profile registry in ${directory}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (lockfile) {
    for (const spec of registry.list()) {
      const key = `${spec.name}@${spec.version}`;
      const expected = lockfile.profiles[key];

      if (expected === undefined) {
        throw new Error(
          `Profile "${key}" is not pinned in lockfile ${lockfilePath}`
        );
      }
      if (hashProfileContent(spec) !== expected) {
        throw new Error(
          `Profile "${key}" failed integrity check (content differs from lockfile ${lockfilePath})`
        );
      }
    }
  }

  return registry;
}

/**
 * Publie (ou regenere) le lockfile d'un dossier : valide les specs,
 * hache leur contenu, ecrit le lockfile (cles triees, diffs stables).
 * OUTIL CREATEUR : le contenu actuel du dossier devient la reference
 * de confiance. Jamais expose a l'employeur.
 */
export async function createProfileLockfile(
  directory: string,
  options?: { lockfilePath?: string }
): Promise<Record<string, string>> {
  const registry = await loadProfileRegistry(directory, {
    trust: { verify: false },
  });
  const profiles: Record<string, string> = {};

  for (const spec of registry.list()) {
    profiles[`${spec.name}@${spec.version}`] = hashProfileContent(spec);
  }

  const sorted: Record<string, string> = {};

  for (const key of Object.keys(profiles).sort()) {
    sorted[key] = profiles[key];
  }

  const lockfilePath =
    options?.lockfilePath ?? join(directory, PROFILE_LOCKFILE_NAME);

  await mkdir(dirname(lockfilePath), { recursive: true });
  await writeFile(
    lockfilePath,
    JSON.stringify({ version: PROFILE_LOCKFILE_VERSION, profiles: sorted }, null, 2) +
      "\n",
    "utf8"
  );

  return sorted;
}
