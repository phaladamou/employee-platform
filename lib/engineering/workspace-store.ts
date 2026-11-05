// lib/engineering/workspace-store.ts
// Lecture seule du workspace d'une session employe (server-only).
// Racine disque : EMPLOYEE_WORKSPACES_DIR (defaut .data/workspaces),
// un sandbox `<employeeId>/<sessionId>/` par session. Sans session :
// rien (vue neuve, jamais de fuite inter-sessions). Avec session,
// le miroir DB (table WorkspaceFile, rempli apres chaque mission)
// bouche les trous : apres un redeploiement, le disque est vide
// mais le travail de la session reste lisible en ligne. Le disque
// reste prioritaire (frais pendant un run).
import "server-only";

import { readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import { ACTIVITY_LOG_FILE } from "@/core/employee/tools/activity";
import { EmployeeWorkspaces } from "@/core/employee/workspaces/employee-workspaces";
import {
  listWorkspaceFilesDb,
  readWorkspaceFileDb,
} from "@/lib/db/queries";
import type { WorkspaceFileEntry } from "./files";
import {
  MAX_FILE_BYTES,
  createTtlCache,
  mergeWorkspaceEntries,
  workspaceTreeCacheKey,
} from "./files";

// Le poll IDE (toutes les 4 s par onglet) rescanne le disque :
// TTL court, un seul scan pour N onglets (fraicheur inchangee
// a un cycle pres, memoire bornee : un tableau par employe).
const TREE_TTL_MS = 5000;
const treeCache = createTtlCache<WorkspaceFileEntry[]>(TREE_TTL_MS);

export function workspaceRoot(): string {
  return resolve(
    process.cwd(),
    process.env.EMPLOYEE_WORKSPACES_DIR ?? ".data/workspaces"
  );
}

export function workspacePathOf(
  employeeId: string,
  sessionId?: string
): string {
  const stores = new EmployeeWorkspaces({ directory: workspaceRoot() });
  return sessionId
    ? stores.sessionPathOf(employeeId, sessionId)
    : stores.pathOf(employeeId);
}

// Invalide l'arbre disque mis en cache d'une session (apres
// synchro de fin de mission : la prochaine lecture est fraiche,
// les autres sessions gardees intactes).
export function invalidateWorkspaceTree(
  accountId: string,
  employeeId: string,
  sessionId: string
): void {
  treeCache.remove(workspaceTreeCacheKey(accountId, employeeId, sessionId));
}

async function walk(
  dir: string,
  base: string,
  out: WorkspaceFileEntry[]
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "archive" && dir === base) continue;
    // Presentation : les entrailles git et le journal d'activite
    // (affiche dans son propre panneau) ne polluent pas l'arbre.
    if (entry.name === ".git" || entry.name === ACTIVITY_LOG_FILE) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, base, out);
    } else if (entry.isFile()) {
      const info = await stat(full);
      const rel = relative(base, full).split(sep).join("/");
      out.push({
        path: rel,
        size: info.size,
        updatedAt: info.mtime.toISOString(),
      });
    }
    if (out.length > 2000) return;
  }
}

// Liste les fichiers du workspace d'une session (absent -> vide).
// Sans session : vide (vue neuve, jamais de fuite inter-sessions).
// Avec session : union disque + miroir DB de la session (disque
// prioritaire). La DB en panne ne casse jamais la lecture disque.
export async function listWorkspaceFiles(
  employeeId: string,
  options: { accountId?: string; sessionId?: string } = {}
): Promise<WorkspaceFileEntry[]> {
  if (!options.sessionId) {
    return [];
  }
  const cacheKey = workspaceTreeCacheKey(
    options.accountId,
    employeeId,
    options.sessionId
  );
  const cached = treeCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const dir = workspacePathOf(employeeId, options.sessionId);
  let disk: WorkspaceFileEntry[] = [];
  try {
    const info = await stat(dir);
    if (info.isDirectory()) {
      const out: WorkspaceFileEntry[] = [];
      await walk(dir, dir, out);
      disk = out;
    }
  } catch {
    disk = [];
  }
  if (!options.accountId) {
    disk.sort((a, b) => a.path.localeCompare(b.path));
    treeCache.set(cacheKey, disk);
    return disk;
  }
  let merged = disk;
  try {
    const rows = await listWorkspaceFilesDb({
      accountId: options.accountId,
      employeeId,
      chatId: options.sessionId,
    });
    merged = mergeWorkspaceEntries(
      disk,
      rows.map((row) => ({
        path: row.path,
        size: row.size,
        updatedAt: row.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("listWorkspaceFiles DB fallback Error:", error);
    merged = [...disk].sort((a, b) => a.path.localeCompare(b.path));
  }
  treeCache.set(cacheKey, merged);
  return merged;
}

// Lit un fichier du workspace d'une session (confinement strict +
// plafond taille). Sans session : rien. Disque d'abord ; si absent
// et accountId fourni, miroir DB de la session.
export async function readWorkspaceFile(
  employeeId: string,
  relPath: string,
  options: { accountId?: string; sessionId?: string } = {}
): Promise<{ content: string; truncated: boolean } | null> {
  if (!options.sessionId) {
    return null;
  }
  const { readFile } = await import("node:fs/promises");
  const dir = workspacePathOf(employeeId, options.sessionId);
  const resolvedBase = resolve(dir);
  const target = resolve(dir, relPath);
  if (target !== resolvedBase && !target.startsWith(`${resolvedBase}${sep}`)) {
    return null;
  }
  try {
    const info = await stat(target);
    if (info.isFile() && info.size <= MAX_FILE_BYTES * 4) {
      const buffer = await readFile(target);
      // Refuse le binaire (octet NUL dans les premiers 8 Ko).
      if (!buffer.subarray(0, 8192).includes(0)) {
        const text = buffer.toString("utf8");
        if (buffer.length > MAX_FILE_BYTES) {
          return {
            content: text.slice(0, MAX_FILE_BYTES),
            truncated: true,
          };
        }
        return { content: text, truncated: false };
      }
    }
  } catch {
    // Absent ou illisible : tentative miroir DB ci-dessous.
  }
  if (!options.accountId) {
    return null;
  }
  try {
    const row = await readWorkspaceFileDb({
      accountId: options.accountId,
      employeeId,
      chatId: options.sessionId,
      path: relPath,
    });
    if (!row) {
      return null;
    }
    if (row.size > MAX_FILE_BYTES) {
      return {
        content: row.content.slice(0, MAX_FILE_BYTES),
        truncated: true,
      };
    }
    return { content: row.content, truncated: false };
  } catch (error) {
    console.error("readWorkspaceFile DB fallback Error:", error);
    return null;
  }
}
