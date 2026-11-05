// lib/server/employee-conversation-mapping.ts
// Correspondances pures pour la persistance des conversations
// employe (sans dependance runtime : testable via node --test).
// Stockage : table Chat (une ligne par couple user/employe via
// employeeId) + table Message_v2 (role user/assistant, contenu
// texte dans parts, lien mission optionnel).

export type StoredChatRole = "user" | "assistant";
export type DisplayChatRole = "user" | "employee";

export function toStoredRole(role: DisplayChatRole): StoredChatRole {
  return role === "employee" ? "assistant" : "user";
}

export function toDisplayRole(role: string): DisplayChatRole {
  return role === "assistant" ? "employee" : "user";
}

export function textToParts(text: string): Array<{
  type: "text";
  text: string;
}> {
  return [{ type: "text", text }];
}

/** Plafond du message d'accueil (premier message persiste). */
export const GREETING_MAX_LENGTH = 500;

// Normalise le message d'accueil envoye par le client (texte
// affiche, deja traduit cote UI) : rogne, plafonne, refuse le
// vide et le non-texte. NULL = rien a sauvegarder.
export function normalizeGreetingInput(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().slice(0, GREETING_MAX_LENGTH);
  return text ? text : null;
}

export function partsToText(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts
    .map((part) => {
      if (
        typeof part !== "object" ||
        part === null ||
        (part as { type?: unknown }).type !== "text"
      ) {
        return "";
      }
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("");
}

export interface ToolCallDiffRow {
  type: "same" | "add" | "del";
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

export interface ToolCallFileChange {
  path: string;
  status: "added" | "modified";
  added: number;
  removed: number;
  rows: ToolCallDiffRow[];
  truncated: boolean;
}

export interface ToolCallRecord {
  tool: string;
  ok: boolean;
  /** Titre ecrit par l'agent, absent pour les lignes anciennes. */
  title?: string;
  /** Duree de reflexion (ms) ayant produit l'action. */
  thoughtMs?: number;
  /** Fichiers modifies (write_file), absents sinon. */
  files?: ToolCallFileChange[];
}

// Normalise les appels du noyau en objets simples stockables
// dans la colonne JSON Mission.toolCalls.
export function toStoredToolCalls(
  calls: ReadonlyArray<{
    tool: string;
    ok: boolean;
    title?: string | null;
    thoughtMs?: number;
    files?: ReadonlyArray<{
      path: string;
      status: "added" | "modified";
      added: number;
      removed: number;
      rows: ReadonlyArray<{
        type: "same" | "add" | "del";
        oldNo: number | null;
        newNo: number | null;
        text: string;
      }>;
      truncated: boolean;
    }>;
  }>
): ToolCallRecord[] {
  return calls.map((call) => ({
    tool: call.tool,
    ok: call.ok === true,
    ...(call.title ? { title: call.title } : {}),
    ...(typeof call.thoughtMs === "number" && call.thoughtMs >= 0
      ? { thoughtMs: call.thoughtMs }
      : {}),
    ...(call.files && call.files.length > 0
      ? {
          files: call.files.map((file) => ({
            path: file.path,
            status: file.status,
            added: file.added,
            removed: file.removed,
            rows: file.rows.map((row) => ({ ...row })),
            truncated: file.truncated,
          })),
        }
      : {}),
  }));
}

function asNonNegativeInt(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : null;
}

function asNullableLineNo(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return asNonNegativeInt(value) ?? undefined;
}

function toFileChange(value: unknown): ToolCallFileChange | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const entry = value as Record<string, unknown>;
  if (typeof entry.path !== "string" || !entry.path) {
    return null;
  }
  if (entry.status !== "added" && entry.status !== "modified") {
    return null;
  }
  const added = asNonNegativeInt(entry.added);
  const removed = asNonNegativeInt(entry.removed);
  if (added === null || removed === null) {
    return null;
  }
  if (!Array.isArray(entry.rows) || typeof entry.truncated !== "boolean") {
    return null;
  }
  const rows: ToolCallDiffRow[] = [];
  for (const row of entry.rows) {
    if (typeof row !== "object" || row === null) {
      return null;
    }
    const cell = row as Record<string, unknown>;
    if (cell.type !== "same" && cell.type !== "add" && cell.type !== "del") {
      return null;
    }
    const oldNo = asNullableLineNo(cell.oldNo);
    const newNo = asNullableLineNo(cell.newNo);
    if (oldNo === undefined || newNo === undefined) {
      return null;
    }
    if (typeof cell.text !== "string") {
      return null;
    }
    rows.push({ type: cell.type, oldNo, newNo, text: cell.text });
  }
  return {
    path: entry.path,
    status: entry.status,
    added,
    removed,
    rows,
    truncated: entry.truncated,
  };
}

// Revalide le JSON stocke (lignes anciennes ou ecrites a la
// main : entrees malformees ignorees, jamais d'exception).
export function toToolCallRecords(value: unknown): ToolCallRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const records: ToolCallRecord[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const tool = (entry as { tool?: unknown }).tool;
    const ok = (entry as { ok?: unknown }).ok;
    if (typeof tool !== "string" || !tool || typeof ok !== "boolean") {
      continue;
    }
    const title = (entry as { title?: unknown }).title;
    const thoughtMs = (entry as { thoughtMs?: unknown }).thoughtMs;
    const files = (entry as { files?: unknown }).files;
    records.push({
      tool,
      ok,
      ...(typeof title === "string" && title ? { title } : {}),
      ...(typeof thoughtMs === "number" && thoughtMs >= 0
        ? { thoughtMs }
        : {}),
      ...(Array.isArray(files)
        ? {
            files: files
              .map(toFileChange)
              .filter((file): file is ToolCallFileChange => file !== null),
          }
        : {}),
    });
  }
  return records;
}
