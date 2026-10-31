export type ToolPermission = "fs:read" | "fs:write" | "shell:exec";

export const MAX_PROFILE_STEPS = 100;

/**
 * Specialisation liee a un Employee : nom + version EXACTE, poses a
 * l'embauche, jamais modifies ensuite (la migration cree un nouveau
 * profil). Le runtime ne resout jamais "latest" pour un employe lie.
 */
export interface EmployeeSpecialization {
  readonly name: string;
  readonly version: string;
}

/**
 * Specialisation versionnee d'un Employee, DECLARATIVE : role, prompt
 * systeme, outils souhaites et permissions revendiquees. Le profil ne
 * s'octroie rien lui-meme : c'est le runtime qui valide chaque
 * declaration contre son propre modele (outil connu ? permission
 * requise presente ?) et rejette franchement sinon.
 */
export interface EmployeeProfileSpec {
  readonly name: string;
  readonly version: string;
  readonly role: string;
  readonly systemPrompt: string;
  readonly allowedTools: readonly string[];
  readonly permissions: readonly ToolPermission[];
  readonly maxSteps: number;
  /**
   * Binaires exiges dans l'environnement d'execution (noms de
   * commandes, resolus via le PATH du shell). Absent ou vide =
   * aucune exigence. Verifie au demarrage du run, avant le
   * premier appel LLM ; manquant = mission refusee.
   */
  readonly environment?: readonly string[];
}

const NAME_PATTERN = /^[a-z0-9-]+$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isEmployeeSpecialization(
  value: unknown
): value is EmployeeSpecialization {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const ref = value as Record<string, unknown>;

  return (
    typeof ref.name === "string" &&
    NAME_PATTERN.test(ref.name) &&
    typeof ref.version === "string" &&
    VERSION_PATTERN.test(ref.version)
  );
}

export function isEmployeeProfileSpec(
  value: unknown
): value is EmployeeProfileSpec {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const spec = value as Record<string, unknown>;

  return (
    typeof spec.name === "string" &&
    NAME_PATTERN.test(spec.name) &&
    typeof spec.version === "string" &&
    VERSION_PATTERN.test(spec.version) &&
    isNonEmptyString(spec.role) &&
    isNonEmptyString(spec.systemPrompt) &&
    Array.isArray(spec.allowedTools) &&
    spec.allowedTools.length > 0 &&
    spec.allowedTools.every(isNonEmptyString) &&
    Array.isArray(spec.permissions) &&
    spec.permissions.length > 0 &&
    spec.permissions.every(isNonEmptyString) &&
    typeof spec.maxSteps === "number" &&
    Number.isInteger(spec.maxSteps) &&
    spec.maxSteps >= 1 &&
    spec.maxSteps <= MAX_PROFILE_STEPS &&
    (spec.environment === undefined ||
      (Array.isArray(spec.environment) &&
        spec.environment.every(
          (entry): entry is string =>
            typeof entry === "string" &&
            entry.length > 0 &&
            entry.trim() === entry &&
            !entry.includes("/") &&
            !entry.includes("\\")
        )))
  );
}
