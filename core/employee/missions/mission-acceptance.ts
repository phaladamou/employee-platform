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
 * Attente test : la commande (executee dans le workspace via le
 * shell confine, avec le timeout shell max) doit reussir (exit 0).
 * Une seule commande par entree ; enchaine avec && pour une suite.
 */
export interface TestExpectation {
  readonly command: string;
}

/**
 * Criteres d'acceptation d'une mission : effets machine-verifiables
 * declares par le donneur d'ordre. Vide = mission non verifiable
 * automatiquement (confiance + signaux, voir needs_review).
 */
export interface MissionAcceptance {
  readonly files: readonly FileExpectation[];
  readonly tests?: readonly TestExpectation[];
}

export const EMPTY_ACCEPTANCE: MissionAcceptance = { files: [] };
export const MAX_ACCEPTANCE_TESTS = 8;
export const MAX_TEST_COMMAND_CHARS = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Valide des criteres bruts (submit API/SDK/CLI) : chemins relatifs
 * non vides, sans echappement, `contains` non vide si present,
 * commandes de test non vides et bornees. Leve sur tout defaut
 * (fail fast, jamais de critere douteux).
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

  const rawTests = value.tests;
  if (rawTests === undefined || rawTests === null) {
    return { files };
  }
  if (!Array.isArray(rawTests)) {
    throw new Error("Acceptance tests must be an array");
  }
  if (rawTests.length > MAX_ACCEPTANCE_TESTS) {
    throw new Error(
      `Acceptance allows at most ${MAX_ACCEPTANCE_TESTS} tests`
    );
  }
  const tests: TestExpectation[] = rawTests.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.command !== "string") {
      throw new Error(`Acceptance tests[${index}] requires a command string`);
    }
    const command = entry.command.trim();
    if (!command) {
      throw new Error(`Acceptance tests[${index}] command cannot be empty`);
    }
    if (command.length > MAX_TEST_COMMAND_CHARS) {
      throw new Error(`Acceptance tests[${index}] command is too long`);
    }
    return { command };
  });

  return { files, tests };
}

export interface AcceptanceResult {
  readonly passed: boolean;
  readonly failures: readonly string[];
}

/**
 * Verifie les criteres contre la racine effective REELLE (workspace
 * dedie si pose, sinon sandbox partage — l'appelant resout via
 * toolRoot). Contournement confine via resolveWithinRoot, symlinks
 * inclus. Fail closed : tout doute (fichier absent, illisible,
 * echappement) est un echec de verification, jamais une exception.
 */
export async function verifyAcceptance(
  root: string,
  acceptance: MissionAcceptance
): Promise<AcceptanceResult> {
  const failures: string[] = [];

  for (const expected of acceptance.files) {
    let resolved: string;
    try {
      resolved = await resolveWithinRoot(root, expected.path);
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

/**
 * Execute les criteres test via le runner fourni (le shell confine
 * du run, cote runtime). Fail closed : echec, erreur ou exception
 * du runner = echec de verification, jamais d'exception.
 */
export async function verifyAcceptanceTests(
  tests: readonly TestExpectation[],
  run: (command: string) => Promise<{
    readonly ok: boolean;
    readonly output: string;
  }>
): Promise<AcceptanceResult> {
  const failures: string[] = [];

  for (const expected of tests) {
    try {
      const result = await run(expected.command);
      if (!result.ok) {
        const head = result.output.trim().slice(0, 200);
        failures.push(
          head.length > 0
            ? `expected test failed: ${expected.command} (${head})`
            : `expected test failed: ${expected.command} (no output)`
        );
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push(
        `expected test errored: ${expected.command} (${detail.slice(0, 200)})`
      );
    }
  }

  return { passed: failures.length === 0, failures };
}
