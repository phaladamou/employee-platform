import { mkdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * Dossiers de travail par employe : `<root>/<employeeId>/`, avec un
 * sous-dossier par session web : `<root>/<employeeId>/<sessionId>/`.
 *
 * - `acquire` (hire, jobs CLI/serveur) : cree le dossier employe,
 *   idempotent. Chemin historique, sans session.
 * - `acquireSession` (missions web) : cree le dossier de la session,
 *   idempotent. Chaque session a son sandbox : une nouvelle session
 *   demarre vierge, revisiter une session retrouve ses fichiers et
 *   son journal d'activite (fichiers, Activity et Terminal de l'IDE
 *   sont scopes par construction).
 * - `archive` (terminate) : deplace vers `archive/<id>-<horodatage>/`
 *   (jamais de suppression : audit). No-op si absent. Les sessions
 *   partent avec le dossier employe.
 * - Les outils se confinent via `ToolContext.workspaceRoot` (voir
 *   toolRoot dans tools/tool.ts).
 *
 * Note multi-tenant : le dossier est cle PAR EMPLOYE, pas par
 * (employeur, employe). Si deux employeurs recrutent le meme employe,
 * leurs jobs partagent son workspace. Durcissement envisageable :
 * `<employerId>/<employeeId>/` (diff de 3 lignes dans pathOf).
 */
export class EmployeeWorkspaces {
  private readonly root: string;

  constructor(options: { readonly directory: string }) {
    if (!options.directory) {
      throw new Error("EmployeeWorkspaces requires a directory");
    }
    this.root = options.directory;
  }

  /** Nom de dossier sur (jamais de separateur ni de ..). */
  static sanitizeId(employeeId: string): string {
    const safe = employeeId.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!safe) {
      throw new Error("Employee id cannot be empty");
    }
    return safe;
  }

  /** Chemin du workspace (pur, ne touche pas le disque). */
  pathOf(employeeId: string): string {
    return join(this.root, EmployeeWorkspaces.sanitizeId(employeeId));
  }

  /**
   * Chemin du workspace d'une session (pur) :
   * `<root>/<employeeId>/<sessionId>/`. Les deux ids sont
   * assainis : aucun separateur ni `..` ne peut s'echapper.
   */
  sessionPathOf(employeeId: string, sessionId: string): string {
    return join(
      this.pathOf(employeeId),
      EmployeeWorkspaces.sanitizeId(sessionId)
    );
  }

  /** Cree le workspace si absent (idempotent). Retourne son chemin. */
  async acquire(employeeId: string): Promise<string> {
    const path = this.pathOf(employeeId);
    await mkdir(path, { recursive: true });
    return path;
  }

  /**
   * Cree le workspace d'une session si absent (idempotent).
   * Retourne son chemin.
   */
  async acquireSession(
    employeeId: string,
    sessionId: string
  ): Promise<string> {
    const path = this.sessionPathOf(employeeId, sessionId);
    await mkdir(path, { recursive: true });
    return path;
  }

  /**
   * Archive le workspace (audit) : deplace vers
   * `archive/<id>-<horodatage>/`. No-op si absent (deja archive).
   * Retourne le chemin d'archive, ou null si rien a archiver.
   */
  async archive(employeeId: string, now: Date = new Date()): Promise<string | null> {
    const path = this.pathOf(employeeId);
    try {
      const info = await stat(path);
      if (!info.isDirectory()) {
        return null;
      }
    } catch {
      return null;
    }
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const target = join(
      this.root,
      "archive",
      `${EmployeeWorkspaces.sanitizeId(employeeId)}-${stamp}`
    );
    await mkdir(join(this.root, "archive"), { recursive: true });
    await rename(path, target);
    return target;
  }
}
