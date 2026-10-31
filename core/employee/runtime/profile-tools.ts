import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { delimiter, join } from "node:path";

import type { EmployeeProfileSpec, ToolPermission } from "../profiles/profile-spec";
import type { EmployeeTool } from "../tools/tool";

/**
 * Modele d'autorisation possede par le RUNTIME (jamais par le profil) :
 * chaque outil exige une permission. Un profil declare des outils et
 * des permissions ; la resolution tranche, franchement (fail fast).
 */
export const TOOL_PERMISSIONS: Record<string, ToolPermission> = {
  read_file: "fs:read",
  write_file: "fs:write",
  run_shell: "shell:exec",
};

const KNOWN_PERMISSIONS: readonly ToolPermission[] = [
  "fs:read",
  "fs:write",
  "shell:exec",
];

/**
 * Resout les outils effectifs d'un profil contre les outils disponibles.
 * Leve si le profil declare un outil inconnu, une permission inconnue,
 * ou un outil sans sa permission requise. A appeler AVANT le premier
 * appel LLM pour ne jamais demarrer une mission mal autorisee.
 */
export function resolveToolsForProfile(
  spec: EmployeeProfileSpec,
  availableTools: readonly EmployeeTool[]
): EmployeeTool[] {
  for (const permission of spec.permissions) {
    if (!KNOWN_PERMISSIONS.includes(permission)) {
      throw new Error(
        `Profile "${spec.name}" declares unknown permission "${permission}"`
      );
    }
  }

  const byName = new Map(availableTools.map((tool) => [tool.name, tool]));
  const resolved: EmployeeTool[] = [];

  for (const name of spec.allowedTools) {
    const required = TOOL_PERMISSIONS[name];
    const tool = byName.get(name);

    if (required === undefined || tool === undefined) {
      throw new Error(`Profile "${spec.name}" declares unknown tool "${name}"`);
    }
    if (!spec.permissions.includes(required)) {
      throw new Error(
        `Profile "${spec.name}" declares tool "${name}" without required permission "${required}"`
      );
    }

    resolved.push(tool);
  }

  return resolved;
}

/**
 * Refuse le run quand l'environnement ne fournit pas les binaires
 * declares par la spec (`environment`). Resolution via le PATH du
 * contexte shell (celui que `run_shell` verra), executable requis.
 * Echec ferme, avant le premier appel LLM. Sans exigence : no-op.
 */
export async function assertSpecEnvironment(
  spec: EmployeeProfileSpec,
  env: Readonly<Record<string, string | undefined>> | undefined
): Promise<void> {
  const required = spec.environment;
  if (!required || required.length === 0) {
    return;
  }
  const pathValue = env?.PATH;
  if (!pathValue) {
    throw new Error(
      `Profile "${spec.name}" requires environment [${required.join(", ")}] but no PATH is available`
    );
  }
  const dirs = pathValue.split(delimiter).filter((dir) => dir.length > 0);
  for (const name of required) {
    let found = false;
    for (const dir of dirs) {
      try {
        await access(join(dir, name), fsConstants.X_OK);
        found = true;
        break;
      } catch {
        // Continue la recherche dans le repertoire suivant.
      }
    }
    if (!found) {
      throw new Error(
        `Environment prerequisite "${name}" for profile "${spec.name}" is not available`
      );
    }
  }
}
