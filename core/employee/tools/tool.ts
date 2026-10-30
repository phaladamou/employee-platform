import { realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { createReadFileTool } from "./read-file";
import { createWriteFileTool } from "./write-file";
import { createRunShellTool } from "./run-shell";

export interface ToolContext {
  /** Racine du workspace : les outils ne sortent jamais de ce dossier. */
  readonly sandboxRoot: string;
  /**
   * Environnement des commandes shell. Jamais herite du processus hote :
   * absent = environnement vide (les binaires doivent alors etre appeles
   * par chemin absolu). L'hote ajoute explicitement ce qu'il autorise.
   */
  readonly env?: { readonly [variable: string]: string | undefined };
}

export type ToolArgs = {
  readonly [key: string]: unknown;
};

export interface ToolResult {
  readonly ok: boolean;
  /** Resultat utile, ou message commencant par "Error: " si ok est faux. */
  readonly output: string;
}

/**
 * Contrat d'un outil appelable par la boucle de raisonnement : un nom
 * stable, une description pour le LLM et une execution borne au sandbox.
 */
export interface EmployeeTool {
  readonly name: string;
  readonly description: string;
  /** Forme JSON des arguments, lisible par le LLM. */
  readonly argsDescription: string;
  execute(args: ToolArgs, ctx: ToolContext): Promise<ToolResult>;
}

export function toolOk(output: string): ToolResult {
  return { ok: true, output };
}

export function toolFail(reason: string): ToolResult {
  return { ok: false, output: `Error: ${reason}` };
}

function escapesWorkspace(base: string, target: string): boolean {
  const rel = relative(base, target);

  return rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * Resout un chemin fourni par le LLM dans le sandbox et retourne le
 * chemin REEL (symlinks resolves). Leve si le chemin s'echappe de la
 * racine, lexicalement (..) ou via symlink. Echec ferme sur toute autre
 * anomalie (boucle de liens, permission...).
 *
 * Limite connue : race TOCTOU acceptee (lien replante entre controle et
 * usage) — acceptable pour un outil local supervise, pas pour du
 * multi-tenant hostile.
 */
export async function resolveWithinRoot(
  root: string,
  userPath: string
): Promise<string> {
  const base = resolve(root);
  const lexical = resolve(base, userPath);

  if (escapesWorkspace(base, lexical)) {
    throw new Error(`path escapes the workspace: ${userPath}`);
  }

  let realBase: string;

  try {
    realBase = await realpath(base);
  } catch {
    // Racine absente : aucun symlink n'existe encore, le controle
    // lexical suffit (les outils echoueront ensuite en ENOENT).
    return lexical;
  }

  let current = lexical;
  const missing: string[] = [];

  for (;;) {
    try {
      const realCurrent = await realpath(current);
      const real =
        missing.length > 0 ? join(realCurrent, ...missing) : realCurrent;

      if (escapesWorkspace(realBase, real)) {
        throw new Error(`path escapes the workspace: ${userPath}`);
      }

      return real;
    } catch (error) {
      if (!isEnoent(error)) {
        throw new Error(`path escapes the workspace: ${userPath}`);
      }

      const parent = dirname(current);

      if (parent === current) {
        return lexical;
      }

      missing.unshift(current.slice(parent.length + 1));
      current = parent;
    }
  }
}

/** Les 3 outils de base d'un Employee. */
export function createCoreTools(): EmployeeTool[] {
  return [createReadFileTool(), createWriteFileTool(), createRunShellTool()];
}
