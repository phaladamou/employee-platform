import { readFile } from "node:fs/promises";

import { resolveWithinRoot } from "../tools/tool";

/**
 * Attente fichier : le chemin (relatif au sandbox) doit exister, et
 * contenir `contains` quand precise (sous-chaine, encodage utf8).
 */
export interface FileExpectation {
  readonly path: string;
  readonly contains?: string | null;
}

/**
 * Criteres d'acceptation d'une mission : effets machine-verifiables
 * declares par le donneur d'ordre. Vide = mission non verifiable
 * automatiquement (confiance + signaux, voir needs_review).
 */
export interface MissionAcceptance {
  readonly files: readonly FileExpectation[];
}

export const EMPTY_ACCEPTANCE: MissionAcceptance = { files: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Valide des criteres bruts (submit API/SDK/CLI) : chemins relatifs
 * non vides, sans echappement, `contains` non vide si present.
 * Leve sur tout defaut (fail fast, jamais de critere douteux).
 */
export function validateAcceptance(value: unknown): MissionAcceptance {
  if (value === undefined || value === null) {
    return { files: [] };
  }
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new Error("Acceptance requires a files array");
  }

  const files: FileExpectation[] = value.files.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.path !== "string") {
      throw new Error(`Acceptance files[${index}] requires a path string`);
    }
    const path = entry.path.trim();
    if (!path) {
      throw new Error(`Acceptance files[${index}] path cannot be empty`);
    }
    if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) {
      throw new Error(
        `Acceptance files[${index}] path must be relative: ${entry.path}`
      );
    }
    const segments = path.split(/[\\/]+/);
    if (segments.includes("..")) {
      throw new Error(
        `Acceptance files[${index}] path escapes the workspace: ${entry.path}`
      );
    }

    const rawContains = entry.contains;
    let contains: string | null = null;
    if (rawContains !== undefined && rawContains !== null) {
      if (typeof rawContains !== "string") {
        throw new Error(
          `Acceptance files[${index}] contains must be a string`
        );
      }
      if (rawContains.length === 0) {
        throw new Error(
          `Acceptance files[${index}] contains cannot be empty`
        );
      }
      contains = rawContains;
    }

    return { path, contains };
  });

  return { files };
}

export interface AcceptanceResult {
  readonly passed: boolean;
  readonly failures: readonly string[];
}

/**
 * Verifie les criteres contre le sandbox REEL (contournement confine
 * via resolveWithinRoot, symlinks inclus). Fail closed : tout doute
 * (fichier absent, illisible, echappement) est un echec de verification,
 * jamais une exception.
 */
export async function verifyAcceptance(
  sandboxRoot: string,
  acceptance: MissionAcceptance
): Promise<AcceptanceResult> {
  const failures: string[] = [];

  for (const expected of acceptance.files) {
    let resolved: string;
    try {
      resolved = await resolveWithinRoot(sandboxRoot, expected.path);
    } catch {
      failures.push(`expected file escapes the workspace: ${expected.path}`);
      continue;
    }

    let content: string;
    try {
      content = await readFile(resolved, "utf8");
    } catch {
      failures.push(`expected file missing or unreadable: ${expected.path}`);
      continue;
    }

    if (expected.contains !== null && expected.contains !== undefined) {
      if (!content.includes(expected.contains)) {
        failures.push(
          `expected file does not contain required text: ${expected.path}`
        );
      }
    }
  }

  return { passed: failures.length === 0, failures };
}
