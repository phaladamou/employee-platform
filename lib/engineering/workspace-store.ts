// lib/engineering/workspace-store.ts
// Lecture seule du workspace disque d'un employe (server-only).
// Racine : EMPLOYEE_WORKSPACES_DIR (defaut .data/workspaces).
import "server-only";

import { readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import { ACTIVITY_LOG_FILE } from "@/core/employee/tools/activity";
import { EmployeeWorkspaces } from "@/core/employee/workspaces/employee-workspaces";
import type { WorkspaceFileEntry } from "./files";
import { MAX_FILE_BYTES, createTtlCache } from "./files";

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

export function workspacePathOf(employeeId: string): string {
  const stores = new EmployeeWorkspaces({ directory: workspaceRoot() });
  return stores.pathOf(employeeId);
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

// Liste les fichiers du workspace (absent -> liste vide).
export async function listWorkspaceFiles(
  employeeId: string
): Promise<WorkspaceFileEntry[]> {
  const cached = treeCache.get(employeeId);
  if (cached) {
    return cached;
  }
  const dir = workspacePathOf(employeeId);
  try {
    const info = await stat(dir);
    if (!info.isDirectory()) return [];
  } catch {
    return [];
  }
  const out: WorkspaceFileEntry[] = [];
  await walk(dir, dir, out);
  out.sort((a, b) => a.path.localeCompare(b.path));
  treeCache.set(employeeId, out);
  return out;
}

// Lit un fichier du workspace (confinement strict + plafond taille).
export async function readWorkspaceFile(
  employeeId: string,
  relPath: string
): Promise<{ content: string; truncated: boolean } | null> {
  const { readFile } = await import("node:fs/promises");
  const dir = workspacePathOf(employeeId);
  const resolvedBase = resolve(dir);
  const target = resolve(dir, relPath);
  if (target !== resolvedBase && !target.startsWith(`${resolvedBase}${sep}`)) {
    return null;
  }
  try {
    const info = await stat(target);
    if (!info.isFile() || info.size > MAX_FILE_BYTES * 4) return null;
    const buffer = await readFile(target);
    // Refuse le binaire (octet NUL dans les premiers 8 Ko).
    if (buffer.subarray(0, 8192).includes(0)) return null;
    const text = buffer.toString("utf8");
    if (buffer.length > MAX_FILE_BYTES) {
      return {
        content: text.slice(0, MAX_FILE_BYTES),
        truncated: true,
      };
    }
    return { content: text, truncated: false };
  } catch {
    return null;
  }
}
