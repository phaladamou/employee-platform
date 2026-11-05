// core/employee/computer/employee-computer.ts
//
// Mini-Ordinateur d'un employe : disque dedie + binaires autorises +
// plafonds memoire/temps + politique reseau. Construit au demarrage du
// run depuis la spec (bloc "computer") et le workspace acquis, puis
// porte par le ToolContext : run_shell applique la politique, sans
// jamais la deviner. Spec sans bloc "computer" = mode historique sans
// Mini-Ordinateur (pas de restriction shell), comme `environment`
// absent = pas d'exigence.

import {
  RUN_SHELL_DEFAULT_TIMEOUT_MS,
  RUN_SHELL_MAX_TIMEOUT_MS,
} from "../tools/run-shell";
import {
  isComputerDecl,
  type ComputerDecl,
  type EmployeeProfileSpec,
} from "../profiles/profile-spec";

/** Plafond memoire par defaut d'un Mini-Ordinateur (Mo). */
export const DEFAULT_COMPUTER_MEMORY_MB = 512;

/**
 * Environnement d'execution dedie d'un employe. Immuable, snapshotte
 * au demarrage du run : rootPath vaut la racine effective du contexte
 * (workspace dedie, sinon racine partagee).
 */
export interface EmployeeComputer {
  /** Disque dur dedie : dossier confine d'execution. */
  readonly rootPath: string;
  /** Noms de binaires invocables (comparaison exacte, vide = tout refus). */
  readonly allowedBinaries: readonly string[];
  /** Plafond memoire (espace d'adressage, Mo) par commande. */
  readonly maxMemoryMb: number;
  /** Delai maximal (ms) par commande, jamais au-dela du plafond shell. */
  readonly maxExecutionTimeMs: number;
  /** Politique reseau DECLAREE (non appliquee : exigerait un netns). */
  readonly networkAccess: boolean;
}

/**
 * Construit le Mini-Ordinateur d'une spec, ou null (mode historique)
 * quand la spec ne declare aucun bloc "computer". Leve franchement
 * sur declaration invalide ou delai au-dela du plafond shell.
 */
export function buildEmployeeComputer(
  spec: EmployeeProfileSpec,
  rootPath: string
): EmployeeComputer | null {
  const decl: ComputerDecl | undefined = spec.computer;
  if (decl === undefined) {
    return null;
  }
  if (!isComputerDecl(decl)) {
    throw new Error(
      `Profile "${spec.name}" declares an invalid computer block`
    );
  }
  const maxMemoryMb = decl.maxMemoryMb ?? DEFAULT_COMPUTER_MEMORY_MB;
  const maxExecutionTimeMs =
    decl.maxExecutionTimeMs ?? RUN_SHELL_DEFAULT_TIMEOUT_MS;
  if (maxExecutionTimeMs > RUN_SHELL_MAX_TIMEOUT_MS) {
    throw new Error(
      `Profile "${spec.name}" computer timeout ${maxExecutionTimeMs} exceeds the ${RUN_SHELL_MAX_TIMEOUT_MS} ms ceiling`
    );
  }
  return {
    rootPath,
    allowedBinaries: [...decl.binaries],
    maxMemoryMb,
    maxExecutionTimeMs,
    networkAccess: decl.networkAccess,
  };
}

/** Ligne de rappel des limites, ajoutee au prompt de specialisation. */
export function describeComputerDecl(decl: ComputerDecl): string {
  const binaries =
    decl.binaries.length > 0 ? decl.binaries.join(", ") : "none";
  const memoryMb = decl.maxMemoryMb ?? DEFAULT_COMPUTER_MEMORY_MB;
  const timeoutMs = decl.maxExecutionTimeMs ?? RUN_SHELL_DEFAULT_TIMEOUT_MS;
  return (
    `Computer: allowed shell binaries [${binaries}]; ` +
    `network access: ${decl.networkAccess ? "yes" : "no"}; ` +
    `${memoryMb} MB memory; ${timeoutMs} ms per command.`
  );
}
