// lib/engineering/workspace-sync.ts
// Synchronise le workspace disque d'un employe vers son miroir en
// base (table WorkspaceFile). Zero dependance (node: uniquement),
// stockage injecte : testable via node --test, utilisable hors Next.
//
// Regles miroirs de la lecture IDE (workspace-store.ts) : .git et
// archive ignores, journal d'activite exclu, binaire refuse, plafond
// par fichier. Seuls les fichiers dont le SHA-256 a change sont
// ecrits ; les chemins disparus du disque sont elagues du miroir.
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/** Plafond par fichier, miroir de MAX_FILE_BYTES (files.ts). */
export const SYNC_MAX_FILE_BYTES = 200_000;
/** Plafond de fichiers par synchronisation (garde-fou disque). */
export const SYNC_MAX_FILES = 500;
/** Dossiers jamais synchronises (visibles nulle part dans l'IDE). */
export const SYNC_IGNORED_DIRS = new Set([".git", "archive"]);
/**
 * Fichiers jamais synchronises, miroir des exclusions IDE :
 * journal d'activite (core/employee/tools/activity.ts,
 * ACTIVITY_LOG_FILE — affiche dans son propre panneau).
 */
export const SYNC_IGNORED_FILES = new Set([".employee-activity.log"]);

export interface WorkspaceSnapshotFile {
  path: string;
  content: string;
  size: number;
  sha256: string;
}

export interface WorkspaceSnapshot {
  files: WorkspaceSnapshotFile[];
  skippedOversized: number;
  skippedBinary: number;
  truncated: boolean;
}

/** Stockage du miroir (adapte lib/db/queries en production). */
export interface WorkspaceMirrorStore {
  list(): Promise<ReadonlyArray<{ path: string; sha256: string }>>;
  upsert(files: ReadonlyArray<WorkspaceSnapshotFile>): Promise<void>;
  deleteNotIn(paths: ReadonlyArray<string>): Promise<number>;
}

export interface WorkspaceSyncLimits {
  maxFileBytes?: number;
  maxFiles?: number;
}

export interface WorkspaceSyncResult {
  /** "no-workspace" = disque absent : miroir conserve tel quel. */
  status: "synced" | "no-workspace";
  scanned: number;
  written: number;
  deleted: number;
  skippedOversized: number;
  skippedBinary: number;
  truncated: boolean;
}

function sha256Hex(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function isBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, 8192).includes(0);
}

async function walk(
  dir: string,
  base: string,
  snapshot: WorkspaceSnapshot,
  limits: { maxFileBytes: number; maxFiles: number }
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (snapshot.files.length >= limits.maxFiles) {
      snapshot.truncated = true;
      return;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // .git et archive exclus a toute profondeur (coherent avec
      // l'arbre IDE, qui ne les montre jamais).
      if (SYNC_IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      await walk(full, base, snapshot, limits);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (SYNC_IGNORED_FILES.has(entry.name)) {
      continue;
    }
    const rel = relative(base, full).split(sep).join("/");
    if (!rel || rel.length > 512) {
      continue;
    }
    const info = await stat(full);
    if (!info.isFile() || info.size > limits.maxFileBytes) {
      snapshot.skippedOversized += 1;
      continue;
    }
    const buffer = await readFile(full);
    if (isBinary(buffer)) {
      snapshot.skippedBinary += 1;
      continue;
    }
    snapshot.files.push({
      path: rel,
      content: buffer.toString("utf8"),
      size: buffer.length,
      sha256: sha256Hex(buffer),
    });
  }
}

/**
 * Photographie les fichiers synchronisables d'un dossier workspace.
 * Dossier absent -> photographie vide (jamais d'exception).
 */
export async function snapshotWorkspaceDir(
  dir: string,
  limits: WorkspaceSyncLimits = {}
): Promise<WorkspaceSnapshot> {
  const snapshot: WorkspaceSnapshot = {
    files: [],
    skippedOversized: 0,
    skippedBinary: 0,
    truncated: false,
  };
  const resolved: { maxFileBytes: number; maxFiles: number } = {
    maxFileBytes: limits.maxFileBytes ?? SYNC_MAX_FILE_BYTES,
    maxFiles: limits.maxFiles ?? SYNC_MAX_FILES,
  };
  try {
    const info = await stat(dir);
    if (!info.isDirectory()) {
      return snapshot;
    }
  } catch {
    return snapshot;
  }
  await walk(dir, dir, snapshot, resolved);
  snapshot.files.sort((a, b) => a.path.localeCompare(b.path));
  return snapshot;
}

/**
 * Synchronise le disque vers le miroir : n'ecrit que les contenus
 * dont le SHA-256 differe, elague les chemins disparus. Disque
 * absent -> no-op (un redeploiement ne doit jamais effacer la copie
 * durable en ligne).
 */
export async function syncWorkspaceToDb(input: {
  dir: string;
  store: WorkspaceMirrorStore;
  limits?: WorkspaceSyncLimits;
}): Promise<WorkspaceSyncResult> {
  try {
    const info = await stat(input.dir);
    if (!info.isDirectory()) {
      return {
        status: "no-workspace",
        scanned: 0,
        written: 0,
        deleted: 0,
        skippedOversized: 0,
        skippedBinary: 0,
        truncated: false,
      };
    }
  } catch {
    return {
      status: "no-workspace",
      scanned: 0,
      written: 0,
      deleted: 0,
      skippedOversized: 0,
      skippedBinary: 0,
      truncated: false,
    };
  }
  const snapshot = await snapshotWorkspaceDir(input.dir, input.limits);
  const known = new Map(
    (await input.store.list()).map((row) => [row.path, row.sha256])
  );
  const changed = snapshot.files.filter(
    (file) => known.get(file.path) !== file.sha256
  );
  if (changed.length > 0) {
    await input.store.upsert(changed);
  }
  // Photographie tronquee (plafond maxFiles) : elagage suspendu,
  // les chemins au-dela du plafond passeraient pour supprimes.
  const deleted = snapshot.truncated
    ? 0
    : await input.store.deleteNotIn(snapshot.files.map((file) => file.path));
  return {
    status: "synced",
    scanned: snapshot.files.length,
    written: changed.length,
    deleted,
    skippedOversized: snapshot.skippedOversized,
    skippedBinary: snapshot.skippedBinary,
    truncated: snapshot.truncated,
  };
}
