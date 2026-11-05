import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Conventions du workspace lues par le runtime (Phase 0 : esprit
 * unique). Quand le projet clone dans le workspace de session declare
 * ses regles (`AGENTS.md`, repli `CONVENTIONS.md`), elles sont
 * injectees bornees dans le contexte systeme des deux chemins (chat
 * et mission) : l'agent travaille comme un contributeur qui a lu le
 * README, sans y depenser un pas.
 */
export const WORKSPACE_CONVENTIONS_MAX_CHARS = 5_000;

const CANDIDATES = ["AGENTS.md", "CONVENTIONS.md"] as const;

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * Lit le premier fichier de conventions present a la racine du
 * workspace. Retourne null si absent, illisible ou vide. Borne :
 * jamais plus de WORKSPACE_CONVENTIONS_MAX_CHARS.
 */
export async function loadWorkspaceConventions(
  workspaceRoot: string
): Promise<string | null> {
  for (const name of CANDIDATES) {
    let raw: string;
    try {
      raw = await readFile(join(workspaceRoot, name), "utf8");
    } catch (error) {
      if (isEnoent(error)) {
        continue;
      }
      return null;
    }
    const text = raw.trim().slice(0, WORKSPACE_CONVENTIONS_MAX_CHARS);
    if (text) {
      return text;
    }
    // Vide : le candidat suivant peut encore parler.
  }
  return null;
}
